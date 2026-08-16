CREATE TYPE mrp_run_status AS ENUM('DRAFT','COMPUTED','APPROVED','CANCELLED');
CREATE TYPE mrp_proposal_type AS ENUM('PURCHASE','PRODUCTION');
CREATE TYPE mrp_proposal_state AS ENUM('PROPOSED','APPROVED','REJECTED','RELEASED','CANCELLED');

CREATE TABLE mrp_planning_policies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,item_version_id uuid NOT NULL,
  safety_stock numeric(24,6) NOT NULL DEFAULT 0 CHECK(safety_stock>=0),minimum_order_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK(minimum_order_quantity>=0),
  order_multiple numeric(24,6) NOT NULL DEFAULT 1 CHECK(order_multiple>0),lead_time_days integer NOT NULL DEFAULT 0 CHECK(lead_time_days>=0),
  freeze_window_days integer NOT NULL DEFAULT 0 CHECK(freeze_window_days>=0),make_or_buy text NOT NULL CHECK(make_or_buy IN('MAKE','BUY')),
  effective_at timestamptz NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,item_version_id,effective_at),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE mrp_demand_signals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,item_version_id uuid NOT NULL,source_type text NOT NULL,source_id uuid NOT NULL,
  required_at date NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),priority integer NOT NULL DEFAULT 100 CHECK(priority>0),
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,source_type,source_id,item_version_id,required_at),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE mrp_runs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,run_number text NOT NULL,status mrp_run_status NOT NULL DEFAULT 'DRAFT',
  as_of timestamptz NOT NULL,horizon_end date NOT NULL,freeze_until date NOT NULL,input_hash char(64) NOT NULL,computed_at timestamptz,approved_at timestamptz,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,run_number),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK(horizon_end>=as_of::date),CHECK(freeze_until>=as_of::date),
  CHECK((status='DRAFT')=(computed_at IS NULL)),CHECK((status='APPROVED')=(approved_at IS NOT NULL))
);
CREATE TABLE mrp_demand_snapshots(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,mrp_run_id uuid NOT NULL,demand_signal_id uuid NOT NULL,item_version_id uuid NOT NULL,
  required_at date NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),source_type text NOT NULL,source_id uuid NOT NULL,canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,mrp_run_id,demand_signal_id),FOREIGN KEY(mrp_run_id,tenant_id) REFERENCES mrp_runs(id,tenant_id),
  FOREIGN KEY(demand_signal_id,tenant_id) REFERENCES mrp_demand_signals(id,tenant_id),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE mrp_item_calculations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,mrp_run_id uuid NOT NULL,item_version_id uuid NOT NULL,required_at date NOT NULL,
  gross_demand numeric(24,6) NOT NULL CHECK(gross_demand>=0),on_hand numeric(24,6) NOT NULL CHECK(on_hand>=0),scheduled_receipts numeric(24,6) NOT NULL CHECK(scheduled_receipts>=0),
  safety_stock numeric(24,6) NOT NULL CHECK(safety_stock>=0),net_requirement numeric(24,6) NOT NULL CHECK(net_requirement>=0),planned_quantity numeric(24,6) NOT NULL CHECK(planned_quantity>=0),
  make_or_buy text NOT NULL CHECK(make_or_buy IN('MAKE','BUY')),policy_id uuid,trace jsonb NOT NULL CHECK(jsonb_typeof(trace)='object'),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,mrp_run_id,item_version_id,required_at),FOREIGN KEY(mrp_run_id,tenant_id) REFERENCES mrp_runs(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(policy_id,tenant_id) REFERENCES mrp_planning_policies(id,tenant_id)
);
CREATE TABLE mrp_proposals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,mrp_run_id uuid NOT NULL,calculation_id uuid NOT NULL,proposal_type mrp_proposal_type NOT NULL,
  item_version_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),start_at date NOT NULL,due_at date NOT NULL,frozen boolean NOT NULL,
  explanation jsonb NOT NULL CHECK(jsonb_typeof(explanation)='object'),canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,mrp_run_id,calculation_id),FOREIGN KEY(mrp_run_id,tenant_id) REFERENCES mrp_runs(id,tenant_id),
  FOREIGN KEY(calculation_id,tenant_id) REFERENCES mrp_item_calculations(id,tenant_id),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  CHECK(due_at>=start_at)
);
CREATE TABLE mrp_proposal_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,proposal_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  state mrp_proposal_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,proposal_id,sequence),FOREIGN KEY(proposal_id,tenant_id) REFERENCES mrp_proposals(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW mrp_proposal_effective_states AS
SELECT p.tenant_id,p.id proposal_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM mrp_proposals p JOIN LATERAL(SELECT * FROM mrp_proposal_events x WHERE x.tenant_id=p.tenant_id AND x.proposal_id=p.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE FUNCTION guard_mrp_run_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status='DRAFT' THEN
    IF NEW.status<>'COMPUTED' OR NEW.computed_at IS NULL OR NEW.approved_at IS NOT NULL THEN RAISE EXCEPTION 'MRP draft can only become computed'; END IF;
    IF (to_jsonb(NEW)-'status'-'computed_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'computed_at') THEN RAISE EXCEPTION 'MRP computation cannot alter run inputs'; END IF;
    IF NOT EXISTS(SELECT 1 FROM mrp_item_calculations c WHERE c.mrp_run_id=NEW.id AND c.tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'MRP run requires calculations'; END IF;
  ELSIF OLD.status='COMPUTED' THEN
    IF NEW.status NOT IN('APPROVED','CANCELLED') THEN RAISE EXCEPTION 'computed MRP run requires approval or cancellation'; END IF;
    IF (to_jsonb(NEW)-'status'-'approved_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'approved_at') THEN RAISE EXCEPTION 'computed MRP run is immutable'; END IF;
  ELSE RAISE EXCEPTION 'closed MRP run is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mrp_run_update_guard BEFORE UPDATE ON mrp_runs FOR EACH ROW EXECUTE FUNCTION guard_mrp_run_update();
CREATE FUNCTION protect_computed_mrp_child() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state mrp_run_status; run_id uuid; BEGIN
  run_id:=OLD.mrp_run_id;SELECT status INTO state FROM mrp_runs WHERE id=run_id AND tenant_id=OLD.tenant_id;
  IF state<>'DRAFT' THEN RAISE EXCEPTION 'computed MRP evidence is immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER mrp_demand_snapshot_frozen BEFORE UPDATE OR DELETE ON mrp_demand_snapshots FOR EACH ROW EXECUTE FUNCTION protect_computed_mrp_child();
CREATE TRIGGER mrp_calculation_frozen BEFORE UPDATE OR DELETE ON mrp_item_calculations FOR EACH ROW EXECUTE FUNCTION protect_computed_mrp_child();
CREATE TRIGGER mrp_proposal_frozen BEFORE UPDATE OR DELETE ON mrp_proposals FOR EACH ROW EXECUTE FUNCTION protect_computed_mrp_child();
CREATE FUNCTION validate_mrp_proposal_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous mrp_proposal_state; expected integer; frozen_value boolean; BEGIN
  SELECT state,sequence+1 INTO previous,expected FROM mrp_proposal_events WHERE tenant_id=NEW.tenant_id AND proposal_id=NEW.proposal_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT frozen INTO frozen_value FROM mrp_proposals WHERE id=NEW.proposal_id AND tenant_id=NEW.tenant_id;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'PROPOSED' THEN RAISE EXCEPTION 'proposal ledger must begin at PROPOSED sequence 1'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'proposal event sequence must be contiguous'; END IF;
    IF previous='PROPOSED' AND NEW.state NOT IN('APPROVED','REJECTED','CANCELLED') THEN RAISE EXCEPTION 'proposal requires approval, rejection, or cancellation'; END IF;
    IF previous='APPROVED' AND NEW.state<>'RELEASED' THEN RAISE EXCEPTION 'approved proposal can only be released'; END IF;
    IF previous IN('REJECTED','RELEASED','CANCELLED') THEN RAISE EXCEPTION 'closed proposal is immutable'; END IF;
    IF frozen_value AND NEW.state='APPROVED' AND coalesce(NEW.evidence->>'freezeOverrideApproval','')='' THEN RAISE EXCEPTION 'frozen proposal approval requires override evidence'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mrp_proposal_event_guard BEFORE INSERT ON mrp_proposal_events FOR EACH ROW EXECUTE FUNCTION validate_mrp_proposal_event();
CREATE TRIGGER mrp_proposal_event_immutable BEFORE UPDATE OR DELETE ON mrp_proposal_events FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();

INSERT INTO permissions(capability,description) VALUES
 ('mrp-policy:read','Read MRP planning policies'),('mrp-policy:manage','Manage item planning policies'),
 ('mrp:read','Read MRP demand, calculations, and proposals'),('mrp:run','Run deterministic MRP calculations'),
 ('mrp:approve','Approve or reject MRP proposals'),('mrp:release','Release approved MRP proposals')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY['mrp-policy:read','mrp-policy:manage','mrp:read','mrp:run','mrp:approve','mrp:release']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
