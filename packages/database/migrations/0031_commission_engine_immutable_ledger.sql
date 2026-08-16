CREATE TYPE commission_policy_status AS ENUM('DRAFT','PUBLISHED','RETIRED');
CREATE TYPE commission_state AS ENUM('ACCRUED','FROZEN','RELEASED','PAID','CLAWED_BACK','CANCELLED');

CREATE TABLE commission_policies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  applicability jsonb NOT NULL CHECK(jsonb_typeof(applicability)='object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,code),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);

CREATE TABLE commission_policy_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  status commission_policy_status NOT NULL DEFAULT 'DRAFT',
  base_rate_basis_points integer NOT NULL CHECK(base_rate_basis_points BETWEEN 0 AND 10000),
  minimum_margin_basis_points integer NOT NULL CHECK(minimum_margin_basis_points BETWEEN -100000 AND 10000),
  release_collection_basis_points integer NOT NULL CHECK(release_collection_basis_points BETWEEN 0 AND 10000),
  effective_at timestamptz NOT NULL,
  rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='array'),
  canonical_hash char(64) NOT NULL,
  published_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,policy_id,version),
  FOREIGN KEY(policy_id,tenant_id) REFERENCES commission_policies(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE UNIQUE INDEX commission_one_published_effective_version
  ON commission_policy_versions(tenant_id,policy_id,effective_at)
  WHERE status='PUBLISHED';

CREATE TABLE commission_cases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sales_order_id uuid NOT NULL,
  beneficiary_employee_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  accounting_period text NOT NULL CHECK(accounting_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  currency char(3) NOT NULL,
  eligible_revenue numeric(24,6) NOT NULL CHECK(eligible_revenue>=0),
  margin_amount numeric(24,6) NOT NULL,
  margin_basis_points integer NOT NULL,
  collected_amount numeric(24,6) NOT NULL CHECK(collected_amount>=0),
  collection_basis_points integer NOT NULL CHECK(collection_basis_points BETWEEN 0 AND 10000),
  commission_amount numeric(24,6) NOT NULL CHECK(commission_amount>=0),
  canonical_input jsonb NOT NULL CHECK(jsonb_typeof(canonical_input)='object'),
  calculation_trace jsonb NOT NULL CHECK(jsonb_typeof(calculation_trace)='array'),
  canonical_hash char(64) NOT NULL,
  actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,sales_order_id,beneficiary_employee_id,policy_version_id),
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id),
  FOREIGN KEY(beneficiary_employee_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(policy_version_id,tenant_id) REFERENCES commission_policy_versions(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(currency) REFERENCES commercial_currencies(code)
);

CREATE TABLE commission_ledger_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  commission_case_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0),
  state commission_state NOT NULL,
  amount numeric(24,6) NOT NULL CHECK(amount>=0),
  reason text NOT NULL,
  external_reference text,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
  canonical_hash char(64) NOT NULL,
  actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  UNIQUE(tenant_id,commission_case_id,sequence),
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(commission_case_id,tenant_id) REFERENCES commission_cases(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);

CREATE VIEW effective_commission_cases AS
SELECT c.*,latest.state AS effective_state,latest.occurred_at AS state_changed_at,
       latest.reason AS state_reason,latest.external_reference,
       coalesce((SELECT sum(e.amount) FROM commission_ledger_entries e
                 WHERE e.tenant_id=c.tenant_id AND e.commission_case_id=c.id AND e.state='PAID'),0) AS paid_amount,
       coalesce((SELECT sum(e.amount) FROM commission_ledger_entries e
                 WHERE e.tenant_id=c.tenant_id AND e.commission_case_id=c.id AND e.state='CLAWED_BACK'),0) AS clawed_back_amount
FROM commission_cases c
JOIN LATERAL(
  SELECT e.state,e.occurred_at,e.reason,e.external_reference
  FROM commission_ledger_entries e
  WHERE e.tenant_id=c.tenant_id AND e.commission_case_id=c.id
  ORDER BY e.sequence DESC LIMIT 1
) latest ON true;

CREATE FUNCTION validate_commission_policy_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='DRAFT' AND NEW.status='PUBLISHED'
     AND NEW.published_at IS NOT NULL
     AND (NEW.base_rate_basis_points,NEW.minimum_margin_basis_points,
          NEW.release_collection_basis_points,NEW.effective_at,NEW.rules,NEW.canonical_hash,
          NEW.policy_id,NEW.tenant_id,NEW.version,NEW.created_by,NEW.created_at)
         IS NOT DISTINCT FROM
         (OLD.base_rate_basis_points,OLD.minimum_margin_basis_points,
          OLD.release_collection_basis_points,OLD.effective_at,OLD.rules,OLD.canonical_hash,
          OLD.policy_id,OLD.tenant_id,OLD.version,OLD.created_by,OLD.created_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'commission policy versions only allow DRAFT to PUBLISHED transition';
END $$;
CREATE TRIGGER commission_policy_version_publish_guard
  BEFORE UPDATE ON commission_policy_versions FOR EACH ROW
  EXECUTE FUNCTION validate_commission_policy_publish();

CREATE FUNCTION validate_commission_ledger_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior commission_state; prior_sequence integer; case_amount numeric(24,6); paid numeric(24,6);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||NEW.commission_case_id::text||':commission',0));
  SELECT commission_amount INTO case_amount FROM commission_cases
    WHERE id=NEW.commission_case_id AND tenant_id=NEW.tenant_id;
  SELECT state,sequence INTO prior,prior_sequence FROM commission_ledger_entries
    WHERE tenant_id=NEW.tenant_id AND commission_case_id=NEW.commission_case_id
    ORDER BY sequence DESC LIMIT 1;
  IF prior IS NULL THEN
    IF NEW.state<>'ACCRUED' OR NEW.sequence<>1 OR NEW.amount<>case_amount THEN
      RAISE EXCEPTION 'commission ledger must begin with exact ACCRUED amount';
    END IF;
  ELSE
    IF NEW.sequence<>prior_sequence+1 THEN RAISE EXCEPTION 'commission ledger sequence is not contiguous'; END IF;
    IF NOT ((prior='ACCRUED' AND NEW.state IN('FROZEN','RELEASED','CANCELLED'))
      OR (prior='FROZEN' AND NEW.state IN('RELEASED','CANCELLED'))
      OR (prior='RELEASED' AND NEW.state IN('FROZEN','PAID','CANCELLED'))
      OR (prior='PAID' AND NEW.state='CLAWED_BACK')) THEN
      RAISE EXCEPTION 'illegal commission state transition from % to %',prior,NEW.state;
    END IF;
    SELECT coalesce(sum(amount),0) INTO paid FROM commission_ledger_entries
      WHERE tenant_id=NEW.tenant_id AND commission_case_id=NEW.commission_case_id AND state='PAID';
    IF NEW.state='PAID' AND NEW.amount<>case_amount THEN RAISE EXCEPTION 'commission payment must equal accrued amount'; END IF;
    IF NEW.state='CLAWED_BACK' AND NEW.amount<>paid THEN RAISE EXCEPTION 'commission clawback must equal paid amount'; END IF;
    IF NEW.state NOT IN('PAID','CLAWED_BACK') AND NEW.amount<>0 THEN RAISE EXCEPTION 'commission control states must have zero amount'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_ledger_transition_guard
  BEFORE INSERT ON commission_ledger_entries FOR EACH ROW
  EXECUTE FUNCTION validate_commission_ledger_transition();

CREATE FUNCTION protect_commission_frozen_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'commission evidence is immutable'; END $$;
CREATE TRIGGER commission_policy_frozen BEFORE DELETE ON commission_policies
  FOR EACH ROW EXECUTE FUNCTION protect_commission_frozen_row();
CREATE TRIGGER commission_policy_version_frozen BEFORE DELETE ON commission_policy_versions
  FOR EACH ROW EXECUTE FUNCTION protect_commission_frozen_row();
CREATE TRIGGER commission_case_frozen BEFORE UPDATE OR DELETE ON commission_cases
  FOR EACH ROW EXECUTE FUNCTION protect_commission_frozen_row();
CREATE TRIGGER commission_ledger_frozen BEFORE UPDATE OR DELETE ON commission_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION protect_commission_frozen_row();

INSERT INTO permissions(capability,description) VALUES
  ('commission-policy:read','Read versioned commission policies'),
  ('commission-policy:manage','Create and publish commission policies'),
  ('commission:read','Read commission calculations and immutable ledger'),
  ('commission:accrue','Accrue server-derived commission'),
  ('commission:manage','Freeze, release, cancel, and claw back commission'),
  ('commission:pay','Record commission payment evidence')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY[
  'commission-policy:read','commission-policy:manage','commission:read',
  'commission:accrue','commission:manage','commission:pay'
]::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
