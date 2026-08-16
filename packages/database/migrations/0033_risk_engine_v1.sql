CREATE TYPE risk_policy_status AS ENUM('DRAFT','PUBLISHED','RETIRED');
CREATE TYPE risk_severity AS ENUM('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE risk_task_state AS ENUM('OPEN','ACKNOWLEDGED','ESCALATED','CLOSED');

CREATE TABLE risk_policies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,code),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE risk_policy_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,policy_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),status risk_policy_status NOT NULL DEFAULT 'DRAFT',
  minimum_margin_basis_points integer NOT NULL CHECK(minimum_margin_basis_points BETWEEN -100000 AND 10000),
  overdue_grace_days integer NOT NULL CHECK(overdue_grace_days BETWEEN 0 AND 3650),
  credit_warning_days integer NOT NULL CHECK(credit_warning_days BETWEEN 0 AND 3650),
  effective_at timestamptz NOT NULL,rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='array'),
  canonical_hash char(64) NOT NULL,published_at timestamptz,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,policy_id,version),
  FOREIGN KEY(policy_id,tenant_id) REFERENCES risk_policies(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE risk_evaluations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,sales_order_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,severity risk_severity NOT NULL,score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
  findings jsonb NOT NULL CHECK(jsonb_typeof(findings)='array'),recommended_actions jsonb NOT NULL CHECK(jsonb_typeof(recommended_actions)='array'),
  canonical_input jsonb NOT NULL CHECK(jsonb_typeof(canonical_input)='object'),calculation_trace jsonb NOT NULL CHECK(jsonb_typeof(calculation_trace)='array'),
  canonical_hash char(64) NOT NULL,valid_until timestamptz NOT NULL,actor_id uuid NOT NULL,correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id),
  FOREIGN KEY(policy_version_id,tenant_id) REFERENCES risk_policy_versions(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE risk_tasks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,risk_evaluation_id uuid NOT NULL,
  assignee_employee_id uuid NOT NULL,due_at timestamptz NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,risk_evaluation_id),
  FOREIGN KEY(risk_evaluation_id,tenant_id) REFERENCES risk_evaluations(id,tenant_id),
  FOREIGN KEY(assignee_employee_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE risk_task_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,risk_task_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0),state risk_task_state NOT NULL,reason text NOT NULL,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),canonical_hash char(64) NOT NULL,
  actor_id uuid NOT NULL,correlation_id uuid NOT NULL,idempotency_key text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,risk_task_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(risk_task_id,tenant_id) REFERENCES risk_tasks(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW effective_risk_tasks AS
SELECT t.*,e.state AS effective_state,e.reason AS state_reason,e.occurred_at AS state_changed_at
FROM risk_tasks t JOIN LATERAL(
  SELECT x.state,x.reason,x.occurred_at FROM risk_task_events x
  WHERE x.tenant_id=t.tenant_id AND x.risk_task_id=t.id ORDER BY x.sequence DESC LIMIT 1
) e ON true;

CREATE FUNCTION protect_risk_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'risk evidence is immutable'; END $$;
CREATE TRIGGER risk_policy_frozen BEFORE DELETE ON risk_policies FOR EACH ROW EXECUTE FUNCTION protect_risk_immutable();
CREATE TRIGGER risk_policy_version_frozen BEFORE UPDATE OR DELETE ON risk_policy_versions FOR EACH ROW WHEN (OLD.status<>'DRAFT') EXECUTE FUNCTION protect_risk_immutable();
CREATE TRIGGER risk_evaluation_frozen BEFORE UPDATE OR DELETE ON risk_evaluations FOR EACH ROW EXECUTE FUNCTION protect_risk_immutable();
CREATE TRIGGER risk_task_frozen BEFORE UPDATE OR DELETE ON risk_tasks FOR EACH ROW EXECUTE FUNCTION protect_risk_immutable();
CREATE TRIGGER risk_task_event_frozen BEFORE UPDATE OR DELETE ON risk_task_events FOR EACH ROW EXECUTE FUNCTION protect_risk_immutable();
CREATE FUNCTION validate_risk_task_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior risk_task_state; prior_sequence integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||NEW.risk_task_id::text||':risk-task',0));
  SELECT state,sequence INTO prior,prior_sequence FROM risk_task_events WHERE tenant_id=NEW.tenant_id AND risk_task_id=NEW.risk_task_id ORDER BY sequence DESC LIMIT 1;
  IF prior IS NULL THEN
    IF NEW.sequence<>1 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'risk task must begin OPEN'; END IF;
  ELSE
    IF NEW.sequence<>prior_sequence+1 THEN RAISE EXCEPTION 'risk task event sequence is not contiguous'; END IF;
    IF NOT ((prior='OPEN' AND NEW.state IN('ACKNOWLEDGED','ESCALATED','CLOSED')) OR (prior='ACKNOWLEDGED' AND NEW.state IN('ESCALATED','CLOSED')) OR (prior='ESCALATED' AND NEW.state='CLOSED')) THEN
      RAISE EXCEPTION 'illegal risk task transition from % to %',prior,NEW.state;
    END IF;
    IF NEW.state='CLOSED' AND NEW.evidence='{}'::jsonb THEN RAISE EXCEPTION 'risk task closure requires evidence'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER risk_task_event_guard BEFORE INSERT ON risk_task_events FOR EACH ROW EXECUTE FUNCTION validate_risk_task_event();

INSERT INTO permissions(capability,description) VALUES
 ('risk-policy:read','Read versioned risk policies'),('risk-policy:manage','Manage risk policy versions'),
 ('risk:read','Read risk evaluations and tasks'),('risk:evaluate','Evaluate order risk'),('risk:manage','Acknowledge, escalate, and close risk tasks')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY['risk-policy:read','risk-policy:manage','risk:read','risk:evaluate','risk:manage']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
