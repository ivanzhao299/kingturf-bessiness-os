CREATE TYPE quality_plan_status AS ENUM('DRAFT','PUBLISHED','RETIRED');
CREATE TYPE quality_inspection_state AS ENUM('OPEN','SAMPLED','COMPLETED','DISPOSITIONED','CANCELLED');
CREATE TYPE quality_disposition_state AS ENUM('QUARANTINE','RELEASED','REJECTED');

CREATE TABLE quality_inspection_plans(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,item_version_id uuid NOT NULL,
  inspection_stage text NOT NULL CHECK(inspection_stage IN('INCOMING','IN_PROCESS','FINAL')),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,code),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE quality_inspection_plan_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,inspection_plan_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
  status quality_plan_status NOT NULL DEFAULT 'DRAFT',sampling_method text NOT NULL,acceptance_rule jsonb NOT NULL CHECK(jsonb_typeof(acceptance_rule)='object'),
  effective_at timestamptz NOT NULL,published_at timestamptz,canonical_hash char(64) NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,inspection_plan_id,version),FOREIGN KEY(inspection_plan_id,tenant_id) REFERENCES quality_inspection_plans(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE quality_plan_characteristics(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,inspection_plan_version_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  code text NOT NULL,name text NOT NULL,data_type text NOT NULL CHECK(data_type IN('NUMERIC','BOOLEAN','TEXT')),unit_code text,
  lower_limit numeric(24,6),upper_limit numeric(24,6),required boolean NOT NULL DEFAULT true,instructions text NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,inspection_plan_version_id,sequence),UNIQUE(tenant_id,inspection_plan_version_id,code),
  FOREIGN KEY(inspection_plan_version_id,tenant_id) REFERENCES quality_inspection_plan_versions(id,tenant_id),
  CHECK(lower_limit IS NULL OR upper_limit IS NULL OR upper_limit>=lower_limit),CHECK((data_type='NUMERIC') OR (lower_limit IS NULL AND upper_limit IS NULL))
);
CREATE TABLE quality_inspections(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,inspection_number text NOT NULL,inspection_plan_version_id uuid NOT NULL,
  lot_id uuid NOT NULL,source_type text NOT NULL,source_id uuid NOT NULL,sample_size numeric(24,6) NOT NULL CHECK(sample_size>0),
  opened_by uuid NOT NULL,opened_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,inspection_number),UNIQUE(tenant_id,source_type,source_id,inspection_plan_version_id,lot_id),
  FOREIGN KEY(inspection_plan_version_id,tenant_id) REFERENCES quality_inspection_plan_versions(id,tenant_id),
  FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),FOREIGN KEY(opened_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE quality_inspection_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,inspection_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  state quality_inspection_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,inspection_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(inspection_id,tenant_id) REFERENCES quality_inspections(id,tenant_id),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW quality_inspection_effective_states AS
SELECT q.tenant_id,q.id inspection_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at FROM quality_inspections q
JOIN LATERAL(SELECT * FROM quality_inspection_events x WHERE x.tenant_id=q.tenant_id AND x.inspection_id=q.id ORDER BY x.sequence DESC LIMIT 1)e ON true;
CREATE TABLE quality_inspection_results(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,inspection_id uuid NOT NULL,characteristic_id uuid NOT NULL,
  measured_numeric numeric(24,6),measured_boolean boolean,measured_text text,passed boolean NOT NULL,notes text NOT NULL,inspector_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,inspection_id,characteristic_id),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(inspection_id,tenant_id) REFERENCES quality_inspections(id,tenant_id),FOREIGN KEY(characteristic_id,tenant_id) REFERENCES quality_plan_characteristics(id,tenant_id),
  FOREIGN KEY(inspector_id,tenant_id) REFERENCES employees(id,company_id),
  CHECK((measured_numeric IS NOT NULL)::integer+(measured_boolean IS NOT NULL)::integer+(measured_text IS NOT NULL)::integer=1)
);
CREATE TABLE inventory_lot_quality_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,lot_id uuid NOT NULL,inspection_id uuid,sequence integer NOT NULL CHECK(sequence>0),
  state quality_disposition_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,lot_id,sequence),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(inspection_id,tenant_id) REFERENCES quality_inspections(id,tenant_id),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW inventory_lot_effective_quality AS
SELECT l.tenant_id,l.id lot_id,coalesce(e.state::text,l.quality_status) quality_status,e.inspection_id,e.reason,e.evidence,e.actor_id,e.created_at,e.sequence
FROM inventory_lots l LEFT JOIN LATERAL(SELECT * FROM inventory_lot_quality_events x WHERE x.tenant_id=l.tenant_id AND x.lot_id=l.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE FUNCTION guard_quality_plan_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'published quality plan is immutable'; END IF;
  IF NEW.status<>'PUBLISHED' OR NEW.published_at IS NULL THEN RAISE EXCEPTION 'quality plan only allows draft to published'; END IF;
  IF (to_jsonb(NEW)-'status'-'published_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'published_at') THEN RAISE EXCEPTION 'quality plan publication cannot alter content'; END IF;
  IF NOT EXISTS(SELECT 1 FROM quality_plan_characteristics c WHERE c.tenant_id=NEW.tenant_id AND c.inspection_plan_version_id=NEW.id) THEN RAISE EXCEPTION 'quality plan publication requires characteristics'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quality_plan_publish_guard BEFORE UPDATE ON quality_inspection_plan_versions FOR EACH ROW EXECUTE FUNCTION guard_quality_plan_version();
CREATE FUNCTION protect_quality_plan_child() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE plan_state quality_plan_status; BEGIN
  SELECT status INTO plan_state FROM quality_inspection_plan_versions WHERE tenant_id=OLD.tenant_id AND id=OLD.inspection_plan_version_id;
  IF plan_state<>'DRAFT' THEN RAISE EXCEPTION 'published quality plan characteristics are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER quality_characteristic_frozen BEFORE UPDATE OR DELETE ON quality_plan_characteristics FOR EACH ROW EXECUTE FUNCTION protect_quality_plan_child();

CREATE FUNCTION validate_quality_inspection_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous quality_inspection_state; expected integer; missing integer; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.inspection_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM quality_inspection_events WHERE tenant_id=NEW.tenant_id AND inspection_id=NEW.inspection_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'inspection ledger must begin at OPEN sequence 1'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'inspection event sequence must be contiguous'; END IF;
    IF previous='OPEN' AND NEW.state NOT IN('SAMPLED','CANCELLED') THEN RAISE EXCEPTION 'open inspection can only sample or cancel'; END IF;
    IF previous='SAMPLED' AND NEW.state NOT IN('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'sampled inspection can only complete or cancel'; END IF;
    IF previous='COMPLETED' AND NEW.state<>'DISPOSITIONED' THEN RAISE EXCEPTION 'completed inspection requires disposition'; END IF;
    IF previous IN('DISPOSITIONED','CANCELLED') THEN RAISE EXCEPTION 'closed inspection is immutable'; END IF;
    IF NEW.state='COMPLETED' THEN
      SELECT count(*) INTO missing FROM quality_inspections q JOIN quality_inspection_plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.inspection_plan_version_id JOIN quality_plan_characteristics c ON c.tenant_id=v.tenant_id AND c.inspection_plan_version_id=v.id LEFT JOIN quality_inspection_results r ON r.tenant_id=q.tenant_id AND r.inspection_id=q.id AND r.characteristic_id=c.id WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.inspection_id AND c.required AND r.id IS NULL;
      IF missing>0 THEN RAISE EXCEPTION 'inspection completion requires all mandatory results'; END IF;
    END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER quality_inspection_event_guard BEFORE INSERT ON quality_inspection_events FOR EACH ROW EXECUTE FUNCTION validate_quality_inspection_event();

CREATE FUNCTION validate_quality_result() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE inspection_state quality_inspection_state; plan_id uuid; characteristic_plan uuid; data_kind text; lower_value numeric(24,6); upper_value numeric(24,6); derived_pass boolean; BEGIN
  SELECT s.state,q.inspection_plan_version_id INTO inspection_state,plan_id FROM quality_inspections q JOIN quality_inspection_effective_states s ON s.tenant_id=q.tenant_id AND s.inspection_id=q.id WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.inspection_id;
  SELECT inspection_plan_version_id,data_type,lower_limit,upper_limit INTO characteristic_plan,data_kind,lower_value,upper_value FROM quality_plan_characteristics WHERE tenant_id=NEW.tenant_id AND id=NEW.characteristic_id;
  IF inspection_state<>'SAMPLED' OR plan_id<>characteristic_plan THEN RAISE EXCEPTION 'inspection result requires sampled inspection and pinned characteristic'; END IF;
  IF (data_kind='NUMERIC' AND NEW.measured_numeric IS NULL) OR (data_kind='BOOLEAN' AND NEW.measured_boolean IS NULL) OR (data_kind='TEXT' AND NEW.measured_text IS NULL) THEN RAISE EXCEPTION 'inspection result value does not match characteristic type'; END IF;
  IF data_kind='NUMERIC' THEN derived_pass:=(lower_value IS NULL OR NEW.measured_numeric>=lower_value) AND (upper_value IS NULL OR NEW.measured_numeric<=upper_value); IF NEW.passed<>derived_pass THEN RAISE EXCEPTION 'numeric inspection pass result must match specification limits'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quality_result_guard BEFORE INSERT ON quality_inspection_results FOR EACH ROW EXECUTE FUNCTION validate_quality_result();

CREATE FUNCTION validate_lot_quality_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous quality_disposition_state; expected integer; inspection_state quality_inspection_state; failed integer; inspection_lot uuid; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.lot_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM inventory_lot_quality_events WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'QUARANTINE' THEN RAISE EXCEPTION 'lot quality ledger must begin at QUARANTINE sequence 1'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'lot quality event sequence must be contiguous'; END IF;
    IF previous<>'QUARANTINE' THEN RAISE EXCEPTION 'dispositioned lot quality is immutable'; END IF;
    IF NEW.state NOT IN('RELEASED','REJECTED') OR NEW.inspection_id IS NULL THEN RAISE EXCEPTION 'quarantined lot requires inspected release or rejection'; END IF;
    SELECT s.state,q.lot_id INTO inspection_state,inspection_lot FROM quality_inspections q JOIN quality_inspection_effective_states s ON s.tenant_id=q.tenant_id AND s.inspection_id=q.id WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.inspection_id;
    IF inspection_state<>'COMPLETED' OR inspection_lot<>NEW.lot_id THEN RAISE EXCEPTION 'lot disposition requires its completed inspection'; END IF;
    SELECT count(*) INTO failed FROM quality_inspection_results WHERE tenant_id=NEW.tenant_id AND inspection_id=NEW.inspection_id AND NOT passed;
    IF NEW.state='RELEASED' AND failed>0 THEN RAISE EXCEPTION 'failed inspection cannot release lot'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER inventory_lot_quality_event_guard BEFORE INSERT ON inventory_lot_quality_events FOR EACH ROW EXECUTE FUNCTION validate_lot_quality_event();

CREATE FUNCTION protect_quality_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'quality evidence is immutable'; END $$;
CREATE TRIGGER quality_inspection_immutable BEFORE UPDATE OR DELETE ON quality_inspections FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();
CREATE TRIGGER quality_inspection_event_immutable BEFORE UPDATE OR DELETE ON quality_inspection_events FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();
CREATE TRIGGER quality_result_immutable BEFORE UPDATE OR DELETE ON quality_inspection_results FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();
CREATE TRIGGER inventory_lot_quality_event_immutable BEFORE UPDATE OR DELETE ON inventory_lot_quality_events FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();

INSERT INTO permissions(capability,description) VALUES
 ('quality-plan:read','Read inspection plans and characteristics'),('quality-plan:manage','Create and publish inspection plans'),
 ('quality:read','Read inspections, results, and lot dispositions'),('quality:inspect','Open, sample, and record inspections'),
 ('quality:disposition','Release or reject inspected lots'),('traceability:read','Read end-to-end lot genealogy') ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p WHERE r.code='SUPER_ADMIN'
AND p.capability=ANY(ARRAY['quality-plan:read','quality-plan:manage','quality:read','quality:inspect','quality:disposition','traceability:read']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
