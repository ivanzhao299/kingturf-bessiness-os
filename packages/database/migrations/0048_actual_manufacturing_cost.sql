CREATE TYPE production_cost_run_state AS ENUM('CALCULATED','APPROVED','REJECTED');

CREATE TABLE production_cost_policies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),currency char(3) NOT NULL,
  labor_rate_per_hour numeric(24,6) NOT NULL CHECK(labor_rate_per_hour>=0),machine_rate_per_hour numeric(24,6) NOT NULL CHECK(machine_rate_per_hour>=0),
  overhead_rate_per_machine_hour numeric(24,6) NOT NULL CHECK(overhead_rate_per_machine_hour>=0),effective_from date NOT NULL,effective_to date,
  source_reference text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,version),UNIQUE(tenant_id,source_reference),FOREIGN KEY(currency) REFERENCES commercial_currencies(code),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE TABLE production_cost_policy_material_rates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,policy_id uuid NOT NULL,item_version_id uuid NOT NULL,
  unit_cost numeric(24,6) NOT NULL CHECK(unit_cost>=0),source_reference text NOT NULL,UNIQUE(id,tenant_id),UNIQUE(tenant_id,policy_id,item_version_id),
  FOREIGN KEY(policy_id,tenant_id) REFERENCES production_cost_policies(id,tenant_id),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE production_cost_runs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,production_order_id uuid NOT NULL,policy_id uuid NOT NULL,run_number text NOT NULL,
  planned_material numeric(24,6) NOT NULL,actual_material numeric(24,6) NOT NULL,planned_labor numeric(24,6) NOT NULL,actual_labor numeric(24,6) NOT NULL,
  planned_machine numeric(24,6) NOT NULL,actual_machine numeric(24,6) NOT NULL,planned_overhead numeric(24,6) NOT NULL,actual_overhead numeric(24,6) NOT NULL,
  planned_total numeric(24,6) NOT NULL,actual_total numeric(24,6) NOT NULL,variance_total numeric(24,6) NOT NULL,
  material_snapshot jsonb NOT NULL CHECK(jsonb_typeof(material_snapshot)='array'),labor_snapshot jsonb NOT NULL CHECK(jsonb_typeof(labor_snapshot)='array'),
  calculation_trace jsonb NOT NULL CHECK(jsonb_typeof(calculation_trace)='object'),created_by uuid NOT NULL,correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,production_order_id),UNIQUE(tenant_id,run_number),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),FOREIGN KEY(policy_id,tenant_id) REFERENCES production_cost_policies(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK(planned_total=planned_material+planned_labor+planned_machine+planned_overhead),
  CHECK(actual_total=actual_material+actual_labor+actual_machine+actual_overhead),CHECK(variance_total=actual_total-planned_total)
);
CREATE TABLE production_cost_run_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,cost_run_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  state production_cost_run_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,cost_run_id,sequence),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(cost_run_id,tenant_id) REFERENCES production_cost_runs(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW production_cost_run_effective_states AS SELECT r.tenant_id,r.id cost_run_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM production_cost_runs r JOIN LATERAL(SELECT * FROM production_cost_run_events x WHERE x.tenant_id=r.tenant_id AND x.cost_run_id=r.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE FUNCTION validate_production_cost_run() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE order_state production_order_state; missing integer; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT state INTO order_state FROM production_order_effective_states WHERE tenant_id=NEW.tenant_id AND production_order_id=NEW.production_order_id;
  IF order_state<>'COMPLETED' THEN RAISE EXCEPTION 'manufacturing cost calculation requires a completed production order'; END IF;
  SELECT count(*) INTO missing FROM manufacturing_bom_lines l JOIN manufacturing_bom_versions b ON b.id=l.bom_version_id AND b.tenant_id=l.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.product_item_version_id=(SELECT item_version_id FROM production_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_id)
  AND b.status='PUBLISHED' AND NOT EXISTS(SELECT 1 FROM production_cost_policy_material_rates x WHERE x.tenant_id=NEW.tenant_id AND x.policy_id=NEW.policy_id AND x.item_version_id=l.component_item_version_id);
  IF missing>0 THEN RAISE EXCEPTION 'manufacturing cost policy is missing BOM material rates'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_cost_run_guard BEFORE INSERT ON production_cost_runs FOR EACH ROW EXECUTE FUNCTION validate_production_cost_run();

CREATE FUNCTION validate_production_cost_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous production_cost_run_state; expected integer; calculator uuid; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.cost_run_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM production_cost_run_events WHERE tenant_id=NEW.tenant_id AND cost_run_id=NEW.cost_run_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'CALCULATED' THEN RAISE EXCEPTION 'cost run ledger must begin at CALCULATED'; END IF;
  ELSE
    IF NEW.sequence<>expected OR previous<>'CALCULATED' OR NEW.state NOT IN('APPROVED','REJECTED') THEN RAISE EXCEPTION 'cost run only allows calculated to approved or rejected'; END IF;
    SELECT created_by INTO calculator FROM production_cost_runs WHERE tenant_id=NEW.tenant_id AND id=NEW.cost_run_id;
    IF calculator=NEW.actor_id THEN RAISE EXCEPTION 'cost run calculator cannot approve or reject own calculation'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_cost_event_guard BEFORE INSERT ON production_cost_run_events FOR EACH ROW EXECUTE FUNCTION validate_production_cost_event();

CREATE FUNCTION require_approved_cost_before_close() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.state='CLOSED' AND NOT EXISTS(SELECT 1 FROM production_cost_runs r JOIN production_cost_run_effective_states s ON s.tenant_id=r.tenant_id AND s.cost_run_id=r.id WHERE r.tenant_id=NEW.tenant_id AND r.production_order_id=NEW.production_order_id AND s.state='APPROVED') THEN
    RAISE EXCEPTION 'production order close requires approved actual manufacturing cost';
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_close_cost_guard BEFORE INSERT ON production_order_events FOR EACH ROW EXECUTE FUNCTION require_approved_cost_before_close();

CREATE FUNCTION protect_production_cost_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'manufacturing cost evidence is immutable'; END $$;
CREATE TRIGGER production_cost_policy_immutable BEFORE UPDATE OR DELETE ON production_cost_policies FOR EACH ROW EXECUTE FUNCTION protect_production_cost_evidence();
CREATE TRIGGER production_cost_rate_immutable BEFORE UPDATE OR DELETE ON production_cost_policy_material_rates FOR EACH ROW EXECUTE FUNCTION protect_production_cost_evidence();
CREATE TRIGGER production_cost_run_immutable BEFORE UPDATE OR DELETE ON production_cost_runs FOR EACH ROW EXECUTE FUNCTION protect_production_cost_evidence();
CREATE TRIGGER production_cost_event_immutable BEFORE UPDATE OR DELETE ON production_cost_run_events FOR EACH ROW EXECUTE FUNCTION protect_production_cost_evidence();

INSERT INTO permissions(capability,description) VALUES
 ('manufacturing-cost:read','Read actual manufacturing cost and variance'),('manufacturing-cost:policy','Create frozen manufacturing cost policies'),
 ('manufacturing-cost:calculate','Calculate and freeze production-order cost'),('manufacturing-cost:approve','Approve or reject production-order cost') ON CONFLICT(capability) DO NOTHING;
INSERT INTO atomic_role_templates(code,name) VALUES('KT_MANUFACTURING_COST_ACCOUNTANT','制造成本核算会计'),('KT_MANUFACTURING_COST_APPROVER','制造成本审批员') ON CONFLICT(code) DO UPDATE SET name=excluded.name;
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT x.role_code,p.id FROM (VALUES
 ('KT_MANUFACTURING_COST_ACCOUNTANT','production:read'),('KT_MANUFACTURING_COST_ACCOUNTANT','bom:read'),('KT_MANUFACTURING_COST_ACCOUNTANT','manufacturing-cost:read'),('KT_MANUFACTURING_COST_ACCOUNTANT','manufacturing-cost:policy'),('KT_MANUFACTURING_COST_ACCOUNTANT','manufacturing-cost:calculate'),
 ('KT_MANUFACTURING_COST_APPROVER','production:read'),('KT_MANUFACTURING_COST_APPROVER','manufacturing-cost:read'),('KT_MANUFACTURING_COST_APPROVER','manufacturing-cost:approve'),
 ('KT_EXECUTIVE_VIEWER','manufacturing-cost:read'),('KT_SYSTEM_AUDITOR','manufacturing-cost:read'))x(role_code,capability) JOIN permissions p ON p.capability=x.capability ON CONFLICT DO NOTHING;
INSERT INTO atomic_role_conflicts(left_role_code,right_role_code,reason) VALUES('KT_MANUFACTURING_COST_ACCOUNTANT','KT_MANUFACTURING_COST_APPROVER','制造成本核算与审批必须分离') ON CONFLICT DO NOTHING;
SELECT provision_atomic_business_roles(id) FROM organizations WHERE organization_type='COMPANY' AND deleted_at IS NULL;
