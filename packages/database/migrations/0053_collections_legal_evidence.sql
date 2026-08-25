CREATE TYPE collection_case_state AS ENUM(
  'OPEN','CONTACTING','PROMISE_ACTIVE','PROMISE_BROKEN','LEGAL_PENDING','LEGAL_ACCEPTED','RESOLVED','CLOSED'
);
CREATE TYPE collection_promise_state AS ENUM('PENDING','FULFILLED','BROKEN','CANCELLED');
CREATE TYPE legal_handoff_state AS ENUM('REQUESTED','ACCEPTED','RETURNED');
CREATE TYPE debt_evidence_package_state AS ENUM('INCOMPLETE','READY');

CREATE TABLE collection_cases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, case_number text NOT NULL,
  ar_open_item_id uuid NOT NULL, assigned_to uuid NOT NULL, priority text NOT NULL CHECK(priority IN('LOW','MEDIUM','HIGH','CRITICAL')),
  opened_at timestamptz NOT NULL, opened_balance numeric(24,6) NOT NULL CHECK(opened_balance>0),
  due_at timestamptz NOT NULL, opening_snapshot jsonb NOT NULL CHECK(jsonb_typeof(opening_snapshot)='object'),
  opening_hash char(64) NOT NULL, created_by uuid NOT NULL, correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,case_number), UNIQUE(tenant_id,ar_open_item_id), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(ar_open_item_id,tenant_id) REFERENCES ar_open_items(id,tenant_id),
  FOREIGN KEY(assigned_to,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE collection_case_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, collection_case_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), state collection_case_state NOT NULL, event_type text NOT NULL,
  reason text NOT NULL, evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,collection_case_id,sequence), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(collection_case_id,tenant_id) REFERENCES collection_cases(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW collection_case_effective_states AS
SELECT c.tenant_id,c.id collection_case_id,e.state,e.sequence,e.event_type,e.reason,e.evidence,e.actor_id,e.created_at
FROM collection_cases c JOIN LATERAL(
  SELECT * FROM collection_case_events x WHERE x.tenant_id=c.tenant_id AND x.collection_case_id=c.id ORDER BY x.sequence DESC LIMIT 1
)e ON true;

CREATE TABLE collection_followups(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, collection_case_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN('PHONE','EMAIL','LETTER','MEETING','VISIT','OTHER')),
  occurred_at timestamptz NOT NULL, contact_person text NOT NULL, outcome text NOT NULL,
  next_action_at timestamptz, evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(collection_case_id,tenant_id) REFERENCES collection_cases(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);

CREATE TABLE collection_promises(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, collection_case_id uuid NOT NULL,
  promised_amount numeric(24,6) NOT NULL CHECK(promised_amount>0), currency char(3) NOT NULL,
  promised_at timestamptz NOT NULL, due_at timestamptz NOT NULL CHECK(due_at>promised_at),
  debtor_contact text NOT NULL, evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), created_by uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(collection_case_id,tenant_id) REFERENCES collection_cases(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(currency) REFERENCES commercial_currencies(code)
);
CREATE TABLE collection_promise_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, promise_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), state collection_promise_state NOT NULL, reason text NOT NULL,
  allocation_entry_ids uuid[] NOT NULL DEFAULT '{}', evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
  actor_id uuid NOT NULL, correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,promise_id,sequence), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(promise_id,tenant_id) REFERENCES collection_promises(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW collection_promise_effective_states AS
SELECT p.tenant_id,p.id promise_id,e.state,e.sequence,e.reason,e.allocation_entry_ids,e.evidence,e.actor_id,e.created_at
FROM collection_promises p JOIN LATERAL(
  SELECT * FROM collection_promise_events x WHERE x.tenant_id=p.tenant_id AND x.promise_id=p.id ORDER BY x.sequence DESC LIMIT 1
)e ON true;

CREATE TABLE legal_handoffs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, handoff_number text NOT NULL,
  collection_case_id uuid NOT NULL, claim_amount numeric(24,6) NOT NULL CHECK(claim_amount>0),
  requested_at timestamptz NOT NULL, request_reason text NOT NULL,
  requested_by uuid NOT NULL, correlation_id uuid NOT NULL, idempotency_key text NOT NULL,
  canonical_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,handoff_number), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(collection_case_id,tenant_id) REFERENCES collection_cases(id,tenant_id),
  FOREIGN KEY(requested_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE legal_handoff_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_handoff_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), state legal_handoff_state NOT NULL, reason text NOT NULL,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'), actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, canonical_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,legal_handoff_id,sequence), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(legal_handoff_id,tenant_id) REFERENCES legal_handoffs(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW legal_handoff_effective_states AS
SELECT h.tenant_id,h.id legal_handoff_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM legal_handoffs h JOIN LATERAL(
  SELECT * FROM legal_handoff_events x WHERE x.tenant_id=h.tenant_id AND x.legal_handoff_id=h.id ORDER BY x.sequence DESC LIMIT 1
)e ON true;

CREATE TABLE debt_evidence_packages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, package_number text NOT NULL,
  legal_handoff_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), state debt_evidence_package_state NOT NULL,
  generated_at timestamptz NOT NULL, manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  missing_requirements text[] NOT NULL DEFAULT '{}', package_hash char(64) NOT NULL, generated_by uuid NOT NULL,
  correlation_id uuid NOT NULL, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,package_number), UNIQUE(tenant_id,legal_handoff_id,version), UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(legal_handoff_id,tenant_id) REFERENCES legal_handoffs(id,tenant_id),
  FOREIGN KEY(generated_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((state='READY' AND cardinality(missing_requirements)=0) OR (state='INCOMPLETE' AND cardinality(missing_requirements)>0))
);
CREATE TABLE debt_evidence_package_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, package_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), evidence_type text NOT NULL, source_type text NOT NULL,
  source_id uuid NOT NULL, source_occurred_at timestamptz NOT NULL, summary jsonb NOT NULL CHECK(jsonb_typeof(summary)='object'),
  source_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id), UNIQUE(tenant_id,package_id,sequence), UNIQUE(tenant_id,package_id,evidence_type,source_type,source_id),
  FOREIGN KEY(package_id,tenant_id) REFERENCES debt_evidence_packages(id,tenant_id)
);

CREATE FUNCTION validate_collection_case() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  due_time timestamptz; balance numeric(24,6); item_currency char(3);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.ar_open_item_id::text,0));
  SELECT b.due_at,b.remaining_amount,b.currency INTO due_time,balance,item_currency
  FROM ar_open_item_balances b WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.ar_open_item_id;
  IF due_time IS NULL THEN RAISE EXCEPTION 'collection case requires an existing receivable'; END IF;
  IF due_time>=NEW.opened_at OR balance<=0 THEN RAISE EXCEPTION 'collection case requires overdue positive balance'; END IF;
  IF NEW.due_at IS DISTINCT FROM due_time OR NEW.opened_balance IS DISTINCT FROM balance THEN
    RAISE EXCEPTION 'collection opening snapshot must match receivable balance';
  END IF;
  IF NEW.opening_snapshot->>'currency' IS DISTINCT FROM item_currency::text OR
     (NEW.opening_snapshot->>'remainingAmount')::numeric IS DISTINCT FROM balance THEN
    RAISE EXCEPTION 'collection opening snapshot does not match server evidence';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collection_case_guard BEFORE INSERT ON collection_cases FOR EACH ROW EXECUTE FUNCTION validate_collection_case();

CREATE FUNCTION validate_collection_case_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  previous collection_case_state; expected integer; current_balance numeric(24,6); package_ready boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.collection_case_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM collection_case_events
    WHERE tenant_id=NEW.tenant_id AND collection_case_id=NEW.collection_case_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN
    IF NEW.sequence<>1 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'collection case ledger must begin at OPEN'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'collection case event sequence must be contiguous'; END IF;
    IF previous='OPEN' AND NEW.state NOT IN('CONTACTING','PROMISE_ACTIVE','LEGAL_PENDING','RESOLVED') OR
       previous='CONTACTING' AND NEW.state NOT IN('PROMISE_ACTIVE','LEGAL_PENDING','RESOLVED') OR
       previous='PROMISE_ACTIVE' AND NEW.state NOT IN('CONTACTING','PROMISE_BROKEN','RESOLVED') OR
       previous='PROMISE_BROKEN' AND NEW.state NOT IN('CONTACTING','PROMISE_ACTIVE','LEGAL_PENDING','RESOLVED') OR
       previous='LEGAL_PENDING' AND NEW.state NOT IN('LEGAL_ACCEPTED','CONTACTING','PROMISE_BROKEN') OR
       previous='LEGAL_ACCEPTED' AND NEW.state NOT IN('RESOLVED','CLOSED') OR
       previous='RESOLVED' AND NEW.state<>'CLOSED' OR previous='CLOSED' THEN
      RAISE EXCEPTION 'illegal collection case transition from % to %',previous,NEW.state;
    END IF;
  END IF;
  IF NEW.state='RESOLVED' THEN
    SELECT b.remaining_amount INTO current_balance FROM collection_cases c JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
      WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.collection_case_id;
    IF current_balance>0 AND NOT (NEW.evidence ? 'resolutionReference') THEN RAISE EXCEPTION 'resolved case with balance requires resolution reference'; END IF;
  END IF;
  IF NEW.state='CLOSED' AND previous='LEGAL_ACCEPTED' THEN
    SELECT EXISTS(SELECT 1 FROM legal_handoffs h JOIN legal_handoff_effective_states s ON s.tenant_id=h.tenant_id AND s.legal_handoff_id=h.id
      JOIN debt_evidence_packages p ON p.tenant_id=h.tenant_id AND p.legal_handoff_id=h.id AND p.state='READY'
      WHERE h.tenant_id=NEW.tenant_id AND h.collection_case_id=NEW.collection_case_id AND s.state='ACCEPTED') INTO package_ready;
    IF NOT package_ready THEN RAISE EXCEPTION 'legal case closure requires ready debt evidence package'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collection_case_event_guard BEFORE INSERT ON collection_case_events FOR EACH ROW EXECUTE FUNCTION validate_collection_case_event();

CREATE FUNCTION validate_collection_promise() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  case_state collection_case_state; balance numeric(24,6); item_currency char(3);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.collection_case_id::text,0));
  SELECT s.state,b.remaining_amount,b.currency INTO case_state,balance,item_currency
  FROM collection_cases c JOIN collection_case_effective_states s ON s.tenant_id=c.tenant_id AND s.collection_case_id=c.id
  JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
  WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.collection_case_id;
  IF case_state NOT IN('OPEN','CONTACTING','PROMISE_BROKEN') THEN RAISE EXCEPTION 'case state does not allow a payment promise'; END IF;
  IF NEW.promised_amount>balance OR NEW.currency<>item_currency THEN RAISE EXCEPTION 'payment promise exceeds or mismatches receivable balance'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collection_promise_guard BEFORE INSERT ON collection_promises FOR EACH ROW EXECUTE FUNCTION validate_collection_promise();

CREATE FUNCTION validate_collection_promise_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  previous collection_promise_state; expected integer; promised numeric(24,6); allocated numeric(24,6); case_id uuid; promise_due timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.promise_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM collection_promise_events WHERE tenant_id=NEW.tenant_id AND promise_id=NEW.promise_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'PENDING' THEN RAISE EXCEPTION 'promise ledger must begin at PENDING'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'promise event sequence must be contiguous'; END IF;
    IF previous<>'PENDING' OR NEW.state NOT IN('FULFILLED','BROKEN','CANCELLED') THEN RAISE EXCEPTION 'payment promise is terminal after decision'; END IF;
  END IF;
  IF NEW.state='FULFILLED' THEN
    SELECT p.promised_amount,p.collection_case_id INTO promised,case_id FROM collection_promises p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.promise_id;
    SELECT coalesce(sum(a.amount),0) INTO allocated FROM allocation_entries a JOIN collection_cases c ON c.tenant_id=a.tenant_id
      JOIN ar_open_items i ON i.tenant_id=c.tenant_id AND i.id=c.ar_open_item_id
      WHERE c.id=case_id AND a.tenant_id=NEW.tenant_id AND a.ar_open_item_id=i.id AND a.id=ANY(NEW.allocation_entry_ids);
    IF allocated<promised THEN RAISE EXCEPTION 'fulfilled promise requires sufficient allocation evidence'; END IF;
  END IF;
  IF NEW.state='BROKEN' THEN
    SELECT due_at INTO promise_due FROM collection_promises WHERE tenant_id=NEW.tenant_id AND id=NEW.promise_id;
    IF promise_due>now() THEN RAISE EXCEPTION 'payment promise cannot be broken before due date'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collection_promise_event_guard BEFORE INSERT ON collection_promise_events FOR EACH ROW EXECUTE FUNCTION validate_collection_promise_event();

CREATE FUNCTION validate_legal_handoff() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state collection_case_state; balance numeric(24,6); existing_state legal_handoff_state; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.collection_case_id::text,0));
  SELECT s.state,b.remaining_amount INTO state,balance FROM collection_cases c
  JOIN collection_case_effective_states s ON s.tenant_id=c.tenant_id AND s.collection_case_id=c.id
  JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
  WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.collection_case_id;
  IF state NOT IN('CONTACTING','PROMISE_BROKEN') THEN RAISE EXCEPTION 'legal handoff requires contacting or broken promise state'; END IF;
  IF NEW.claim_amount IS DISTINCT FROM balance THEN RAISE EXCEPTION 'legal claim amount must equal current receivable balance'; END IF;
  SELECT s.state INTO existing_state FROM legal_handoffs h JOIN legal_handoff_effective_states s ON s.tenant_id=h.tenant_id AND s.legal_handoff_id=h.id
    WHERE h.tenant_id=NEW.tenant_id AND h.collection_case_id=NEW.collection_case_id AND s.state IN('REQUESTED','ACCEPTED') LIMIT 1;
  IF existing_state IS NOT NULL THEN RAISE EXCEPTION 'collection case already has an active legal handoff'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legal_handoff_guard BEFORE INSERT ON legal_handoffs FOR EACH ROW EXECUTE FUNCTION validate_legal_handoff();

CREATE FUNCTION validate_legal_handoff_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  previous legal_handoff_state; expected integer; requester uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.legal_handoff_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM legal_handoff_events WHERE tenant_id=NEW.tenant_id AND legal_handoff_id=NEW.legal_handoff_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT requested_by INTO requester FROM legal_handoffs WHERE tenant_id=NEW.tenant_id AND id=NEW.legal_handoff_id;
  IF previous IS NULL THEN
    IF NEW.sequence<>1 OR NEW.state<>'REQUESTED' OR NEW.actor_id<>requester THEN RAISE EXCEPTION 'legal handoff ledger must begin with requester'; END IF;
  ELSE
    IF NEW.sequence<>expected OR previous<>'REQUESTED' OR NEW.state NOT IN('ACCEPTED','RETURNED') THEN RAISE EXCEPTION 'illegal legal handoff transition'; END IF;
    IF NEW.actor_id=requester THEN RAISE EXCEPTION 'legal handoff requester cannot decide own request'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legal_handoff_event_guard BEFORE INSERT ON legal_handoff_events FOR EACH ROW EXECUTE FUNCTION validate_legal_handoff_event();

CREATE FUNCTION validate_debt_evidence_package() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state legal_handoff_state; BEGIN
  SELECT s.state INTO state FROM legal_handoff_effective_states s WHERE s.tenant_id=NEW.tenant_id AND s.legal_handoff_id=NEW.legal_handoff_id;
  IF state<>'ACCEPTED' THEN RAISE EXCEPTION 'debt evidence package requires accepted legal handoff'; END IF;
  IF NEW.manifest->>'formulaVersion' IS DISTINCT FROM 'KT-L19-EVIDENCE-V1' THEN RAISE EXCEPTION 'unsupported debt evidence manifest version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER debt_evidence_package_guard BEFORE INSERT ON debt_evidence_packages FOR EACH ROW EXECUTE FUNCTION validate_debt_evidence_package();

CREATE FUNCTION protect_collection_legal_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'collection and legal evidence is immutable';
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY[
  'collection_cases','collection_case_events','collection_followups','collection_promises','collection_promise_events',
  'legal_handoffs','legal_handoff_events','debt_evidence_packages','debt_evidence_package_items'
] LOOP EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_collection_legal_evidence()',t,t); END LOOP; END $$;

CREATE INDEX collection_cases_queue ON collection_cases(tenant_id,due_at,priority,opened_at);
CREATE INDEX collection_case_events_timeline ON collection_case_events(tenant_id,collection_case_id,created_at,sequence);
CREATE INDEX collection_followups_timeline ON collection_followups(tenant_id,collection_case_id,occurred_at);
CREATE INDEX collection_promises_due ON collection_promises(tenant_id,due_at);
CREATE INDEX legal_handoffs_case ON legal_handoffs(tenant_id,collection_case_id,requested_at);
CREATE INDEX debt_evidence_packages_handoff ON debt_evidence_packages(tenant_id,legal_handoff_id,version);

INSERT INTO permissions(capability,description) VALUES
 ('collection:read','Read collection queue and evidence'),('collection:manage','Create cases, follow-ups, and payment promises'),
 ('collection:escalate','Confirm broken promises and request legal handoff'),('collection:close','Resolve and close collection cases'),
 ('legal-case:read','Read legal handoffs and debt evidence'),('legal-case:decide','Accept or return legal handoffs'),
 ('debt-evidence:generate','Generate immutable debt evidence packages') ON CONFLICT(capability) DO NOTHING;
INSERT INTO atomic_role_templates(code,name) VALUES
 ('KT_COLLECTION_SPECIALIST','催收专员'),('KT_COLLECTION_MANAGER','催收主管'),('KT_LEGAL_CASE_MANAGER','法务案件管理员') ON CONFLICT(code) DO NOTHING;
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT x.role_code,p.id FROM (VALUES
 ('KT_COLLECTION_SPECIALIST','collection:read'),('KT_COLLECTION_SPECIALIST','collection:manage'),('KT_COLLECTION_SPECIALIST','collection:escalate'),
 ('KT_COLLECTION_SPECIALIST','ar:read'),('KT_COLLECTION_SPECIALIST','sales-order:read'),('KT_COLLECTION_SPECIALIST','order-360:read'),
 ('KT_COLLECTION_MANAGER','collection:read'),('KT_COLLECTION_MANAGER','collection:escalate'),('KT_COLLECTION_MANAGER','collection:close'),
 ('KT_COLLECTION_MANAGER','legal-case:read'),('KT_COLLECTION_MANAGER','ar:read'),('KT_COLLECTION_MANAGER','order-360:read'),
 ('KT_LEGAL_CASE_MANAGER','collection:read'),('KT_LEGAL_CASE_MANAGER','legal-case:read'),('KT_LEGAL_CASE_MANAGER','legal-case:decide'),
 ('KT_LEGAL_CASE_MANAGER','debt-evidence:generate'),('KT_LEGAL_CASE_MANAGER','contract:read'),('KT_LEGAL_CASE_MANAGER','ar:read'),
 ('KT_LEGAL_CASE_MANAGER','shipment:read'),('KT_LEGAL_CASE_MANAGER','order-360:read'),
 ('KT_EXECUTIVE_VIEWER','collection:read'),('KT_EXECUTIVE_VIEWER','legal-case:read')
)x(role_code,capability) JOIN permissions p ON p.capability=x.capability ON CONFLICT DO NOTHING;
INSERT INTO atomic_role_conflicts(left_role_code,right_role_code,reason) VALUES
 ('KT_COLLECTION_SPECIALIST','KT_LEGAL_CASE_MANAGER','催收执行与法务受理必须分离') ON CONFLICT DO NOTHING;
SELECT provision_atomic_business_roles(id) FROM organizations WHERE organization_type='COMPANY' AND deleted_at IS NULL;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN']) AND p.capability=ANY(ARRAY[
 'collection:read','collection:manage','collection:escalate','collection:close','legal-case:read','legal-case:decide','debt-evidence:generate'
]) ON CONFLICT DO NOTHING;
