CREATE TYPE production_order_state AS ENUM('DRAFT','RELEASED','IN_PROGRESS','COMPLETED','CLOSED','CANCELLED');
CREATE TYPE production_material_transaction_type AS ENUM('ISSUE','RETURN');

CREATE TABLE production_orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,order_number text NOT NULL,item_version_id uuid NOT NULL,
  routing_version_id uuid NOT NULL,mrp_proposal_id uuid,planned_quantity numeric(24,6) NOT NULL CHECK(planned_quantity>0),
  planned_start_at date NOT NULL,planned_due_at date NOT NULL,source_reference text NOT NULL,created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,UNIQUE(id,tenant_id),UNIQUE(tenant_id,order_number),
  UNIQUE(tenant_id,source_reference),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(routing_version_id,tenant_id) REFERENCES manufacturing_routing_versions(id,tenant_id),
  FOREIGN KEY(mrp_proposal_id,tenant_id) REFERENCES mrp_proposals(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK(planned_due_at>=planned_start_at)
);
CREATE TABLE production_order_operations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,production_order_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  operation_code text NOT NULL,name text NOT NULL,work_center text NOT NULL,setup_minutes numeric(24,6) NOT NULL CHECK(setup_minutes>=0),
  run_minutes_per_unit numeric(24,6) NOT NULL CHECK(run_minutes_per_unit>=0),routing_operation_id uuid NOT NULL,canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,production_order_id,sequence),FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),
  FOREIGN KEY(routing_operation_id,tenant_id) REFERENCES manufacturing_routing_operations(id,tenant_id)
);
CREATE TABLE production_order_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,production_order_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  state production_order_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,production_order_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW production_order_effective_states AS
SELECT o.tenant_id,o.id production_order_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM production_orders o JOIN LATERAL(SELECT * FROM production_order_events x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE TABLE production_material_transactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,production_order_id uuid NOT NULL,transaction_type production_material_transaction_type NOT NULL,
  item_version_id uuid NOT NULL,lot_id uuid NOT NULL,location_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),
  inventory_movement_id uuid NOT NULL,reason text NOT NULL,actor_id uuid NOT NULL,correlation_id uuid NOT NULL,idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,inventory_movement_id),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(location_id,tenant_id) REFERENCES inventory_locations(id,tenant_id),FOREIGN KEY(inventory_movement_id,tenant_id) REFERENCES inventory_movements(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE production_operation_reports(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,production_order_id uuid NOT NULL,production_order_operation_id uuid NOT NULL,
  good_quantity numeric(24,6) NOT NULL CHECK(good_quantity>=0),scrap_quantity numeric(24,6) NOT NULL CHECK(scrap_quantity>=0),
  labor_minutes numeric(24,6) NOT NULL CHECK(labor_minutes>=0),machine_minutes numeric(24,6) NOT NULL CHECK(machine_minutes>=0),
  started_at timestamptz NOT NULL,completed_at timestamptz NOT NULL,operator_id uuid NOT NULL,notes text NOT NULL,idempotency_key text NOT NULL,
  correlation_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),
  FOREIGN KEY(production_order_operation_id,tenant_id) REFERENCES production_order_operations(id,tenant_id),
  FOREIGN KEY(operator_id,tenant_id) REFERENCES employees(id,company_id),CHECK(good_quantity+scrap_quantity>0),CHECK(completed_at>=started_at)
);
CREATE TABLE production_rolls(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,roll_number text NOT NULL,production_order_id uuid NOT NULL,
  operation_report_id uuid NOT NULL,item_version_id uuid NOT NULL,lot_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),
  status text NOT NULL DEFAULT 'QUARANTINE' CHECK(status IN('QUARANTINE','RELEASED','REJECTED','CONSUMED')),
  created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,UNIQUE(id,tenant_id),UNIQUE(tenant_id,roll_number),
  FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),FOREIGN KEY(operation_report_id,tenant_id) REFERENCES production_operation_reports(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id)
);

CREATE FUNCTION validate_production_order_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous production_order_state; expected integer; proposal_state mrp_proposal_state; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM production_order_events WHERE tenant_id=NEW.tenant_id AND production_order_id=NEW.production_order_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'DRAFT' THEN RAISE EXCEPTION 'production order ledger must begin at DRAFT sequence 1'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'production order event sequence must be contiguous'; END IF;
    IF previous='DRAFT' AND NEW.state NOT IN('RELEASED','CANCELLED') THEN RAISE EXCEPTION 'draft production order can only be released or cancelled'; END IF;
    IF previous='RELEASED' AND NEW.state NOT IN('IN_PROGRESS','CANCELLED') THEN RAISE EXCEPTION 'released production order can only start or cancel'; END IF;
    IF previous='IN_PROGRESS' AND NEW.state NOT IN('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'active production order can only complete or cancel'; END IF;
    IF previous='COMPLETED' AND NEW.state<>'CLOSED' THEN RAISE EXCEPTION 'completed production order can only close'; END IF;
    IF previous IN('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'closed production order is immutable'; END IF;
    IF NEW.state='RELEASED' THEN
      IF NOT EXISTS(SELECT 1 FROM production_order_operations x WHERE x.tenant_id=NEW.tenant_id AND x.production_order_id=NEW.production_order_id) THEN RAISE EXCEPTION 'production order release requires operation snapshots'; END IF;
      SELECT s.state INTO proposal_state FROM production_orders o LEFT JOIN mrp_proposal_effective_states s ON s.tenant_id=o.tenant_id AND s.proposal_id=o.mrp_proposal_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
      IF proposal_state IS NOT NULL AND proposal_state<>'RELEASED' THEN RAISE EXCEPTION 'production order requires a released MRP proposal'; END IF;
    END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_order_event_guard BEFORE INSERT ON production_order_events FOR EACH ROW EXECUTE FUNCTION validate_production_order_event();

CREATE FUNCTION validate_production_execution_entry() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state production_order_state; linked_order uuid; planned numeric(24,6); reported numeric(24,6); movement inventory_movements%ROWTYPE; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT s.state,o.planned_quantity INTO state,planned FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
  IF state NOT IN('RELEASED','IN_PROGRESS') THEN RAISE EXCEPTION 'production execution requires a released or active order'; END IF;
  IF TG_TABLE_NAME='production_material_transactions' THEN
    SELECT * INTO movement FROM inventory_movements m WHERE m.tenant_id=NEW.tenant_id AND m.id=NEW.inventory_movement_id;
    IF movement.id IS NULL OR movement.item_version_id<>NEW.item_version_id OR movement.lot_id<>NEW.lot_id OR movement.location_id<>NEW.location_id OR
      movement.source_type<>'PRODUCTION_ORDER' OR movement.source_id<>NEW.production_order_id OR
      (NEW.transaction_type='ISSUE' AND (movement.movement_type<>'ISSUE' OR movement.quantity_delta<>-NEW.quantity)) OR
      (NEW.transaction_type='RETURN' AND (movement.movement_type<>'RETURN' OR movement.quantity_delta<>NEW.quantity)) THEN RAISE EXCEPTION 'production material transaction must match its inventory movement'; END IF;
  ELSE
    SELECT production_order_id INTO linked_order FROM production_order_operations WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_operation_id;
    IF linked_order IS NULL OR linked_order<>NEW.production_order_id THEN RAISE EXCEPTION 'operation report must belong to the production order'; END IF;
    SELECT coalesce(sum(good_quantity),0)+NEW.good_quantity INTO reported FROM production_operation_reports WHERE tenant_id=NEW.tenant_id AND production_order_operation_id=NEW.production_order_operation_id;
    IF reported>planned THEN RAISE EXCEPTION 'reported good quantity exceeds planned production quantity'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_material_transaction_guard BEFORE INSERT ON production_material_transactions FOR EACH ROW EXECUTE FUNCTION validate_production_execution_entry();
CREATE TRIGGER production_operation_report_guard BEFORE INSERT ON production_operation_reports FOR EACH ROW EXECUTE FUNCTION validate_production_execution_entry();

CREATE FUNCTION protect_production_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'production execution evidence is immutable'; END $$;
CREATE TRIGGER production_order_immutable BEFORE UPDATE OR DELETE ON production_orders FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();
CREATE TRIGGER production_operation_immutable BEFORE UPDATE OR DELETE ON production_order_operations FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();
CREATE TRIGGER production_event_immutable BEFORE UPDATE OR DELETE ON production_order_events FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();
CREATE TRIGGER production_material_transaction_immutable BEFORE UPDATE OR DELETE ON production_material_transactions FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();
CREATE TRIGGER production_operation_report_immutable BEFORE UPDATE OR DELETE ON production_operation_reports FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();
CREATE TRIGGER production_roll_immutable BEFORE UPDATE OR DELETE ON production_rolls FOR EACH ROW EXECUTE FUNCTION protect_production_evidence();

INSERT INTO permissions(capability,description) VALUES
 ('production:read','Read production orders and execution evidence'),('production:plan','Create and release production orders'),
 ('production:material','Issue and return production material'),('production:report','Report operations and finished rolls'),
 ('production:close','Complete and close production orders') ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p WHERE r.code='SUPER_ADMIN'
AND p.capability=ANY(ARRAY['production:read','production:plan','production:material','production:report','production:close']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
