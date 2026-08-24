CREATE TYPE shipment_release_state AS ENUM('PENDING','READY','EXCEPTION_PENDING','APPROVED','REJECTED','RELEASED');
CREATE TYPE shipment_state AS ENUM('DISPATCHED','IN_TRANSIT','DELIVERED');

CREATE TABLE shipment_release_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, request_number text NOT NULL,
  sales_order_id uuid NOT NULL, production_order_id uuid NOT NULL, finished_lot_id uuid NOT NULL,
  requested_quantity numeric(24,6) NOT NULL CHECK(requested_quantity>0), required_payment_amount numeric(24,6) NOT NULL CHECK(required_payment_amount>=0),
  gate_snapshot jsonb NOT NULL CHECK(jsonb_typeof(gate_snapshot)='object'), gate_hash char(64) NOT NULL,
  created_by uuid NOT NULL, correlation_id uuid NOT NULL, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,request_number), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id),
  FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),
  FOREIGN KEY(finished_lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE shipment_release_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, release_request_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), state shipment_release_state NOT NULL, reason text NOT NULL,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), actor_id uuid NOT NULL, correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,release_request_id,sequence), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(release_request_id,tenant_id) REFERENCES shipment_release_requests(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW shipment_release_effective_states AS
SELECT r.tenant_id,r.id release_request_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM shipment_release_requests r JOIN LATERAL(SELECT * FROM shipment_release_events x WHERE x.tenant_id=r.tenant_id AND x.release_request_id=r.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE FUNCTION validate_shipment_release_request() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  contract_ok boolean; credit_ok boolean; payment_ok boolean; overdue_ok boolean; order_link_ok boolean;
  quality_ok boolean; production_ok boolean; cost_ok boolean; available numeric(24,6); quantity_ok boolean;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM sales_orders o JOIN contract_signature_evidence e ON e.tenant_id=o.tenant_id AND e.id=o.signature_evidence_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.sales_order_id AND o.status='RELEASED'),
    EXISTS(SELECT 1 FROM sales_orders o JOIN effective_credit_decisions c ON c.tenant_id=o.tenant_id AND c.id=o.credit_decision_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.sales_order_id AND c.effective_status='APPROVED' AND c.valid_until>now()),
    coalesce((SELECT sum(a.amount) FROM ar_documents d JOIN ar_open_items i ON i.tenant_id=d.tenant_id AND i.ar_document_id=d.id JOIN allocation_entries a ON a.tenant_id=i.tenant_id AND a.ar_open_item_id=i.id WHERE d.tenant_id=NEW.tenant_id AND d.sales_order_id=NEW.sales_order_id),0)>=NEW.required_payment_amount,
    NOT EXISTS(SELECT 1 FROM ar_documents d JOIN ar_open_item_balances b ON b.tenant_id=d.tenant_id AND b.ar_document_id=d.id WHERE d.tenant_id=NEW.tenant_id AND d.sales_order_id=NEW.sales_order_id AND b.due_at<now() AND b.remaining_amount>0),
    EXISTS(SELECT 1 FROM production_orders p JOIN mrp_proposals mp ON mp.tenant_id=p.tenant_id AND mp.id=p.mrp_proposal_id JOIN mrp_demand_snapshots d ON d.tenant_id=mp.tenant_id AND d.mrp_run_id=mp.mrp_run_id AND d.item_version_id=p.item_version_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.production_order_id AND d.source_type='SALES_ORDER' AND d.source_id=NEW.sales_order_id),
    EXISTS(SELECT 1 FROM inventory_lot_effective_quality q WHERE q.tenant_id=NEW.tenant_id AND q.lot_id=NEW.finished_lot_id AND q.quality_status='RELEASED'),
    EXISTS(SELECT 1 FROM production_orders p JOIN production_order_effective_states s ON s.tenant_id=p.tenant_id AND s.production_order_id=p.id JOIN production_rolls r ON r.tenant_id=p.tenant_id AND r.production_order_id=p.id AND r.lot_id=NEW.finished_lot_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.production_order_id AND s.state IN('COMPLETED','CLOSED')),
    EXISTS(SELECT 1 FROM production_cost_runs c JOIN production_cost_run_effective_states s ON s.tenant_id=c.tenant_id AND s.cost_run_id=c.id WHERE c.tenant_id=NEW.tenant_id AND c.production_order_id=NEW.production_order_id AND s.state='APPROVED'),
    coalesce((SELECT sum(b.quantity) FROM inventory_balances b WHERE b.tenant_id=NEW.tenant_id AND b.lot_id=NEW.finished_lot_id),0)
  INTO contract_ok,credit_ok,payment_ok,overdue_ok,order_link_ok,quality_ok,production_ok,cost_ok,available;
  quantity_ok:=available>=NEW.requested_quantity;
  IF (NEW.gate_snapshot->>'contract_ok')::boolean IS DISTINCT FROM contract_ok OR (NEW.gate_snapshot->>'credit_ok')::boolean IS DISTINCT FROM credit_ok OR
     (NEW.gate_snapshot->>'payment_ok')::boolean IS DISTINCT FROM payment_ok OR (NEW.gate_snapshot->>'overdue_ok')::boolean IS DISTINCT FROM overdue_ok OR
     (NEW.gate_snapshot->>'order_link_ok')::boolean IS DISTINCT FROM order_link_ok OR (NEW.gate_snapshot->>'quality_ok')::boolean IS DISTINCT FROM quality_ok OR
     (NEW.gate_snapshot->>'production_ok')::boolean IS DISTINCT FROM production_ok OR (NEW.gate_snapshot->>'cost_ok')::boolean IS DISTINCT FROM cost_ok OR
     (NEW.gate_snapshot->>'quantityOk')::boolean IS DISTINCT FROM quantity_ok THEN RAISE EXCEPTION 'shipment gate snapshot does not match server evidence'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shipment_release_request_guard BEFORE INSERT ON shipment_release_requests FOR EACH ROW EXECUTE FUNCTION validate_shipment_release_request();

CREATE TABLE shipments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, shipment_number text NOT NULL,
  release_request_id uuid NOT NULL, carrier_name text NOT NULL, tracking_number text NOT NULL,
  dispatched_at timestamptz NOT NULL, actor_id uuid NOT NULL, correlation_id uuid NOT NULL, idempotency_key text NOT NULL,
  canonical_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,shipment_number), UNIQUE(tenant_id,carrier_name,tracking_number), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(release_request_id,tenant_id) REFERENCES shipment_release_requests(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE shipment_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, shipment_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), state shipment_state NOT NULL, occurred_at timestamptz NOT NULL,
  location text NOT NULL, evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,shipment_id,sequence), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(shipment_id,tenant_id) REFERENCES shipments(id,tenant_id), FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW shipment_effective_states AS
SELECT s.tenant_id,s.id shipment_id,e.state,e.sequence,e.occurred_at,e.location,e.evidence,e.actor_id,e.created_at
FROM shipments s JOIN LATERAL(SELECT * FROM shipment_events x WHERE x.tenant_id=s.tenant_id AND x.shipment_id=s.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE FUNCTION validate_shipment_release_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous shipment_release_state; expected integer; requester uuid; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.release_request_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM shipment_release_events WHERE tenant_id=NEW.tenant_id AND release_request_id=NEW.release_request_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state NOT IN('READY','EXCEPTION_PENDING') THEN RAISE EXCEPTION 'release ledger must begin at READY or EXCEPTION_PENDING'; END IF;
    IF (NEW.state='READY') IS DISTINCT FROM (coalesce(jsonb_array_length((SELECT gate_snapshot->'failures' FROM shipment_release_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.release_request_id)),0)=0) THEN RAISE EXCEPTION 'release initial state must match gate failures'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'release event sequence must be contiguous'; END IF;
    IF previous='READY' AND NEW.state<>'RELEASED' THEN RAISE EXCEPTION 'ready release can only be released'; END IF;
    IF previous='EXCEPTION_PENDING' AND NEW.state NOT IN('APPROVED','REJECTED') THEN RAISE EXCEPTION 'exception requires approval decision'; END IF;
    IF previous='APPROVED' AND NEW.state<>'RELEASED' THEN RAISE EXCEPTION 'approved exception can only be released'; END IF;
    IF previous IN('REJECTED','RELEASED') THEN RAISE EXCEPTION 'terminal release state is immutable'; END IF;
  END IF;
  IF NEW.state IN('APPROVED','REJECTED') THEN SELECT created_by INTO requester FROM shipment_release_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.release_request_id; IF requester=NEW.actor_id THEN RAISE EXCEPTION 'shipment requester cannot approve own exception'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shipment_release_event_guard BEFORE INSERT ON shipment_release_events FOR EACH ROW EXECUTE FUNCTION validate_shipment_release_event();

CREATE FUNCTION validate_shipment() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE release_state shipment_release_state; previous shipment_state; expected integer; BEGIN
  IF TG_TABLE_NAME='shipments' THEN SELECT state INTO release_state FROM shipment_release_effective_states WHERE tenant_id=NEW.tenant_id AND release_request_id=NEW.release_request_id; IF release_state<>'RELEASED' THEN RAISE EXCEPTION 'shipment requires released gate'; END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.shipment_id::text,0));
    SELECT state,sequence+1 INTO previous,expected FROM shipment_events WHERE tenant_id=NEW.tenant_id AND shipment_id=NEW.shipment_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
    IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'DISPATCHED' THEN RAISE EXCEPTION 'shipment ledger must begin at DISPATCHED'; END IF;
    ELSE IF NEW.sequence<>expected THEN RAISE EXCEPTION 'shipment event sequence must be contiguous'; END IF; IF previous='DISPATCHED' AND NEW.state NOT IN('IN_TRANSIT','DELIVERED') THEN RAISE EXCEPTION 'invalid shipment transition'; END IF; IF previous='IN_TRANSIT' AND NEW.state<>'DELIVERED' THEN RAISE EXCEPTION 'in-transit shipment can only be delivered'; END IF; IF previous='DELIVERED' THEN RAISE EXCEPTION 'delivered shipment is immutable'; END IF; END IF;
    IF NEW.state='DELIVERED' AND NOT (NEW.evidence ? 'receiverName' AND NEW.evidence ? 'receivedAt' AND NEW.evidence ? 'proofReference') THEN RAISE EXCEPTION 'delivery requires receiver, timestamp, and proof reference'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER shipment_guard BEFORE INSERT ON shipments FOR EACH ROW EXECUTE FUNCTION validate_shipment();
CREATE TRIGGER shipment_event_guard BEFORE INSERT ON shipment_events FOR EACH ROW EXECUTE FUNCTION validate_shipment();

CREATE FUNCTION protect_shipment_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'shipment evidence is immutable'; END $$;
CREATE TRIGGER shipment_release_request_immutable BEFORE UPDATE OR DELETE ON shipment_release_requests FOR EACH ROW EXECUTE FUNCTION protect_shipment_evidence();
CREATE TRIGGER shipment_release_event_immutable BEFORE UPDATE OR DELETE ON shipment_release_events FOR EACH ROW EXECUTE FUNCTION protect_shipment_evidence();
CREATE TRIGGER shipment_immutable BEFORE UPDATE OR DELETE ON shipments FOR EACH ROW EXECUTE FUNCTION protect_shipment_evidence();
CREATE TRIGGER shipment_event_immutable BEFORE UPDATE OR DELETE ON shipment_events FOR EACH ROW EXECUTE FUNCTION protect_shipment_evidence();

INSERT INTO permissions(capability,description) VALUES
 ('shipment:read','Read shipment release and proof of delivery'),('shipment:request','Evaluate shipment gates and request release'),
 ('shipment:approve-exception','Approve shipment gate exception'),('shipment:release','Release an eligible shipment'),
 ('shipment:dispatch','Create carrier dispatch'),('shipment:track','Record tracking and proof of delivery') ON CONFLICT(capability) DO NOTHING;
INSERT INTO atomic_role_templates(code,name) VALUES
 ('KT_SHIPMENT_REQUESTER','发货申请员'),('KT_SHIPMENT_EXCEPTION_APPROVER','发货例外审批员'),
 ('KT_WAREHOUSE_SHIPMENT_RELEASER','仓库发货放行员'),('KT_LOGISTICS_COORDINATOR','物流履约员') ON CONFLICT(code) DO NOTHING;
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT x.role_code,p.id FROM (VALUES
 ('KT_SHIPMENT_REQUESTER','shipment:read'),('KT_SHIPMENT_REQUESTER','shipment:request'),
 ('KT_SHIPMENT_EXCEPTION_APPROVER','shipment:read'),('KT_SHIPMENT_EXCEPTION_APPROVER','shipment:approve-exception'),
 ('KT_WAREHOUSE_SHIPMENT_RELEASER','shipment:read'),('KT_WAREHOUSE_SHIPMENT_RELEASER','shipment:release'),
 ('KT_WAREHOUSE_SHIPMENT_RELEASER','shipment:dispatch'),('KT_LOGISTICS_COORDINATOR','shipment:read'),('KT_LOGISTICS_COORDINATOR','shipment:track')) x(role_code,capability) JOIN permissions p ON p.capability=x.capability ON CONFLICT DO NOTHING;
INSERT INTO atomic_role_conflicts(left_role_code,right_role_code,reason) VALUES
 ('KT_SHIPMENT_EXCEPTION_APPROVER','KT_SHIPMENT_REQUESTER','发货申请与例外审批必须分离') ON CONFLICT DO NOTHING;
SELECT provision_atomic_business_roles(id) FROM organizations WHERE organization_type='COMPANY' AND deleted_at IS NULL;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN']) AND p.capability LIKE 'shipment:%' ON CONFLICT DO NOTHING;
