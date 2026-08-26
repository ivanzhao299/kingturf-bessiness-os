CREATE TYPE complaint_severity AS ENUM('LOW','MEDIUM','MAJOR','CRITICAL');
CREATE TYPE complaint_state AS ENUM('REPORTED','TRIAGED','INVESTIGATING','NCR_OPEN','CAPA_ACTIVE','VERIFIED','CLOSED','REJECTED');
CREATE TYPE ncr_state AS ENUM('OPEN','CONTAINED','ROOT_CAUSE_CONFIRMED','DISPOSITIONED','CLOSED');
CREATE TYPE capa_state AS ENUM('OPEN','ACTIONS_IN_PROGRESS','READY_FOR_VERIFICATION','VERIFIED','CLOSED');

CREATE TABLE complaint_sla_policy_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,policy_code text NOT NULL,version integer NOT NULL CHECK(version>0),
  severity complaint_severity NOT NULL,response_hours integer NOT NULL CHECK(response_hours>0),containment_hours integer NOT NULL CHECK(containment_hours>0),
  root_cause_hours integer NOT NULL CHECK(root_cause_hours>0),closure_hours integer NOT NULL CHECK(closure_hours>0),effective_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL,canonical_hash char(64) NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,policy_code,version,severity),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);

CREATE TABLE customer_complaints(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,complaint_number text NOT NULL,customer_id uuid NOT NULL,
  sales_order_id uuid,shipment_id uuid,inventory_lot_id uuid,quality_inspection_id uuid,sla_policy_version_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN('CUSTOMER_SERVICE','SALES','EMAIL','PHONE','ONSITE','OTHER')),
  defect_category text NOT NULL CHECK(defect_category IN(
    'PILE_HEIGHT','GAUGE','STITCH_DENSITY','FACE_WEIGHT','ROLL_LENGTH','COLOUR_DIFFERENCE','MIXED_BATCH','YARN_SPLITTING','SHEDDING','WEAR_RESISTANCE',
    'COATING','BACKING','LAMINATION','DELAMINATION','DRAINAGE','TUFT_BIND','FIRE','UV','ENVIRONMENTAL','LAB_NONCONFORMANCE',
    'ROLL_WIDTH','PACKAGING','LABEL','CONTAINER_LOADING','TRANSIT_DAMAGE','SHORTAGE','INSTALLATION_COMPATIBILITY','SITE_FOUNDATION','NON_PRODUCT_RESPONSIBILITY','OTHER'
  )),
  severity complaint_severity NOT NULL,occurred_at timestamptz NOT NULL,reported_at timestamptz NOT NULL,description text NOT NULL CHECK(length(trim(description))>=10),
  customer_request text NOT NULL,initial_snapshot jsonb NOT NULL CHECK(jsonb_typeof(initial_snapshot)='object'),assigned_to uuid,
  response_due_at timestamptz NOT NULL,containment_due_at timestamptz NOT NULL,root_cause_due_at timestamptz NOT NULL,closure_due_at timestamptz NOT NULL,
  reported_by uuid NOT NULL,correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,complaint_number),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id),
  FOREIGN KEY(shipment_id,tenant_id) REFERENCES shipments(id,tenant_id),FOREIGN KEY(inventory_lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(quality_inspection_id,tenant_id) REFERENCES quality_inspections(id,tenant_id),
  FOREIGN KEY(sla_policy_version_id,tenant_id) REFERENCES complaint_sla_policy_versions(id,tenant_id),
  FOREIGN KEY(assigned_to,tenant_id) REFERENCES employees(id,company_id),FOREIGN KEY(reported_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK(response_due_at>=reported_at AND containment_due_at>=reported_at AND root_cause_due_at>=reported_at AND closure_due_at>=reported_at)
);

CREATE TABLE customer_complaint_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,complaint_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  state complaint_state NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),assigned_to uuid,
  actor_id uuid NOT NULL,expected_version integer NOT NULL CHECK(expected_version>=0),correlation_id uuid NOT NULL,idempotency_key text NOT NULL,
  canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,complaint_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(complaint_id,tenant_id) REFERENCES customer_complaints(id,tenant_id),FOREIGN KEY(assigned_to,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW customer_complaint_effective_states AS
SELECT c.tenant_id,c.id complaint_id,e.state,e.sequence,e.reason,e.evidence,e.assigned_to,e.actor_id,e.created_at
FROM customer_complaints c JOIN LATERAL(SELECT * FROM customer_complaint_events x WHERE x.tenant_id=c.tenant_id AND x.complaint_id=c.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE TABLE nonconformance_reports(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,ncr_number text NOT NULL,complaint_id uuid NOT NULL,
  defect_type text NOT NULL,affected_scope text NOT NULL,responsible_organization_id uuid NOT NULL,investigator_id uuid NOT NULL,
  quarantined_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK(quarantined_quantity>=0),temporary_containment text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,ncr_number),UNIQUE(tenant_id,complaint_id),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(complaint_id,tenant_id) REFERENCES customer_complaints(id,tenant_id),
  FOREIGN KEY(responsible_organization_id) REFERENCES organizations(id),FOREIGN KEY(investigator_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE ncr_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,ncr_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),state ncr_state NOT NULL,
  reason text NOT NULL,root_cause_method text CHECK(root_cause_method IN('FIVE_WHY','FISHBONE','FAULT_TREE','OTHER')),
  root_cause jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(root_cause)='object'),disposition text CHECK(disposition IN('REWORK','REPAIR','CONCESSION','RETURN','SCRAP','SUPPLIER_CLAIM')),
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,approved_by uuid,expected_version integer NOT NULL CHECK(expected_version>=0),
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,ncr_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(ncr_id,tenant_id) REFERENCES nonconformance_reports(id,tenant_id),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(approved_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW ncr_effective_states AS
SELECT n.tenant_id,n.id ncr_id,e.state,e.sequence,e.reason,e.root_cause_method,e.root_cause,e.disposition,e.evidence,e.actor_id,e.approved_by,e.created_at
FROM nonconformance_reports n JOIN LATERAL(SELECT * FROM ncr_events x WHERE x.tenant_id=n.tenant_id AND x.ncr_id=n.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE TABLE capa_cases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,capa_number text NOT NULL,ncr_id uuid NOT NULL,owner_id uuid NOT NULL,
  target_at timestamptz NOT NULL,risk_level complaint_severity NOT NULL,root_cause_snapshot jsonb NOT NULL CHECK(jsonb_typeof(root_cause_snapshot)='object'),
  created_by uuid NOT NULL,correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,capa_number),UNIQUE(tenant_id,ncr_id),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(ncr_id,tenant_id) REFERENCES nonconformance_reports(id,tenant_id),FOREIGN KEY(owner_id,tenant_id) REFERENCES employees(id,company_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE capa_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,capa_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),state capa_state NOT NULL,
  reason text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),actor_id uuid NOT NULL,expected_version integer NOT NULL CHECK(expected_version>=0),
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,capa_id,sequence),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(capa_id,tenant_id) REFERENCES capa_cases(id,tenant_id),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE VIEW capa_effective_states AS
SELECT c.tenant_id,c.id capa_id,e.state,e.sequence,e.reason,e.evidence,e.actor_id,e.created_at
FROM capa_cases c JOIN LATERAL(SELECT * FROM capa_events x WHERE x.tenant_id=c.tenant_id AND x.capa_id=c.id ORDER BY x.sequence DESC LIMIT 1)e ON true;

CREATE TABLE capa_actions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,capa_id uuid NOT NULL,action_type text NOT NULL CHECK(action_type IN('CORRECTIVE','PREVENTIVE')),
  description text NOT NULL CHECK(length(trim(description))>=5),owner_id uuid NOT NULL,due_at timestamptz NOT NULL,created_by uuid NOT NULL,
  correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(capa_id,tenant_id) REFERENCES capa_cases(id,tenant_id),
  FOREIGN KEY(owner_id,tenant_id) REFERENCES employees(id,company_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE capa_action_completions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,capa_action_id uuid NOT NULL,completed_by uuid NOT NULL,completed_at timestamptz NOT NULL,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,capa_action_id),UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(capa_action_id,tenant_id) REFERENCES capa_actions(id,tenant_id),FOREIGN KEY(completed_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE capa_verifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,capa_id uuid NOT NULL,verifier_id uuid NOT NULL,verified_at timestamptz NOT NULL,
  standard text NOT NULL,sample_scope text NOT NULL,observation_until timestamptz NOT NULL,result text NOT NULL CHECK(result IN('PASSED','FAILED')),
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),correlation_id uuid NOT NULL,idempotency_key text NOT NULL,canonical_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(capa_id,tenant_id) REFERENCES capa_cases(id,tenant_id),
  FOREIGN KEY(verifier_id,tenant_id) REFERENCES employees(id,company_id),CHECK(observation_until>=verified_at)
);

CREATE FUNCTION validate_complaint_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous complaint_state; expected integer; reporter uuid; severity complaint_severity; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.complaint_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM customer_complaint_events WHERE tenant_id=NEW.tenant_id AND complaint_id=NEW.complaint_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT reported_by,c.severity INTO reporter,severity FROM customer_complaints c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.complaint_id;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.expected_version<>0 OR NEW.state<>'REPORTED' THEN RAISE EXCEPTION 'complaint ledger must begin at REPORTED version 0'; END IF;
  ELSE
    IF NEW.sequence<>expected OR NEW.expected_version<>expected-1 THEN RAISE EXCEPTION 'complaint version conflict'; END IF;
    IF previous='REPORTED' AND NEW.state NOT IN('TRIAGED','REJECTED') OR previous='TRIAGED' AND NEW.state<>'INVESTIGATING' OR
       previous='INVESTIGATING' AND NEW.state NOT IN('NCR_OPEN','CLOSED') OR previous='NCR_OPEN' AND NEW.state<>'CAPA_ACTIVE' OR
       previous='CAPA_ACTIVE' AND NEW.state<>'VERIFIED' OR previous='VERIFIED' AND NEW.state<>'CLOSED' OR previous IN('CLOSED','REJECTED') THEN
      RAISE EXCEPTION 'illegal complaint transition from % to %',previous,NEW.state;
    END IF;
    IF NEW.state='CLOSED' AND NEW.actor_id=reporter THEN RAISE EXCEPTION 'complaint reporter cannot close own complaint'; END IF;
    IF NEW.state='CLOSED' AND severity IN('MAJOR','CRITICAL') AND previous<>'VERIFIED' THEN RAISE EXCEPTION 'major complaint closure requires verified CAPA'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER customer_complaint_event_guard BEFORE INSERT ON customer_complaint_events FOR EACH ROW EXECUTE FUNCTION validate_complaint_event();

CREATE FUNCTION validate_ncr_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous ncr_state; expected integer; investigator uuid; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.ncr_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM ncr_events WHERE tenant_id=NEW.tenant_id AND ncr_id=NEW.ncr_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT investigator_id INTO investigator FROM nonconformance_reports WHERE tenant_id=NEW.tenant_id AND id=NEW.ncr_id;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.expected_version<>0 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'NCR ledger must begin at OPEN version 0'; END IF;
  ELSE
    IF NEW.sequence<>expected OR NEW.expected_version<>expected-1 THEN RAISE EXCEPTION 'NCR version conflict'; END IF;
    IF previous='OPEN' AND NEW.state<>'CONTAINED' OR previous='CONTAINED' AND NEW.state<>'ROOT_CAUSE_CONFIRMED' OR
       previous='ROOT_CAUSE_CONFIRMED' AND NEW.state<>'DISPOSITIONED' OR previous='DISPOSITIONED' AND NEW.state<>'CLOSED' OR previous='CLOSED' THEN
      RAISE EXCEPTION 'illegal NCR transition from % to %',previous,NEW.state;
    END IF;
    IF NEW.state='ROOT_CAUSE_CONFIRMED' AND (NEW.root_cause_method IS NULL OR NEW.root_cause='{}'::jsonb) THEN RAISE EXCEPTION 'root cause confirmation requires structured analysis'; END IF;
    IF NEW.state='DISPOSITIONED' AND (NEW.disposition IS NULL OR NEW.approved_by IS NULL) THEN RAISE EXCEPTION 'NCR disposition requires approval'; END IF;
    IF NEW.state='DISPOSITIONED' AND NEW.approved_by=investigator THEN RAISE EXCEPTION 'major NCR investigator cannot approve own disposition'; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER ncr_event_guard BEFORE INSERT ON ncr_events FOR EACH ROW EXECUTE FUNCTION validate_ncr_event();

CREATE FUNCTION validate_capa_verification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE incomplete integer; self_owned integer; state capa_state; BEGIN
  SELECT s.state INTO state FROM capa_effective_states s WHERE s.tenant_id=NEW.tenant_id AND s.capa_id=NEW.capa_id;
  SELECT count(*) FILTER(WHERE c.id IS NULL),count(*) FILTER(WHERE a.owner_id=NEW.verifier_id) INTO incomplete,self_owned
  FROM capa_actions a LEFT JOIN capa_action_completions c ON c.tenant_id=a.tenant_id AND c.capa_action_id=a.id WHERE a.tenant_id=NEW.tenant_id AND a.capa_id=NEW.capa_id;
  IF state<>'READY_FOR_VERIFICATION' OR incomplete>0 THEN RAISE EXCEPTION 'CAPA verification requires all actions complete and ready state'; END IF;
  IF self_owned>0 THEN RAISE EXCEPTION 'CAPA action owner cannot verify own action'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capa_verification_guard BEFORE INSERT ON capa_verifications FOR EACH ROW EXECUTE FUNCTION validate_capa_verification();

CREATE FUNCTION protect_complaint_quality_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'complaint, NCR, and CAPA evidence is immutable'; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY[
  'complaint_sla_policy_versions','customer_complaints','customer_complaint_events','nonconformance_reports','ncr_events',
  'capa_cases','capa_events','capa_actions','capa_action_completions','capa_verifications'
] LOOP EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_complaint_quality_evidence()',t,t); END LOOP; END $$;

CREATE INDEX complaints_queue ON customer_complaints(tenant_id,closure_due_at,severity,created_at,id);
CREATE INDEX complaints_customer ON customer_complaints(tenant_id,customer_id,created_at,id);
CREATE INDEX complaints_order ON customer_complaints(tenant_id,sales_order_id,created_at,id);
CREATE INDEX complaints_lot ON customer_complaints(tenant_id,inventory_lot_id,created_at,id);
CREATE INDEX complaint_events_timeline ON customer_complaint_events(tenant_id,complaint_id,created_at,sequence);
CREATE INDEX ncr_queue ON nonconformance_reports(tenant_id,investigator_id,created_at,id);
CREATE INDEX capa_queue ON capa_cases(tenant_id,target_at,risk_level,created_at,id);
CREATE INDEX capa_actions_owner ON capa_actions(tenant_id,owner_id,due_at,id);

INSERT INTO permissions(capability,description) VALUES
 ('complaint:read','Read customer complaint queues and evidence'),('complaint:create','Register customer complaints'),
 ('complaint:triage','Triage and prioritize customer complaints'),('complaint:assign','Assign complaint responsibility'),('complaint:close','Close verified complaints'),
 ('ncr:read','Read nonconformance investigations'),('ncr:manage','Contain and investigate nonconformance'),('ncr:disposition','Approve nonconformance disposition'),
 ('capa:read','Read corrective and preventive actions'),('capa:manage','Create and complete CAPA actions'),('capa:verify','Independently verify CAPA effectiveness')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO atomic_role_templates(code,name) VALUES
 ('KT_COMPLAINT_REGISTRAR','客诉登记员'),('KT_COMPLAINT_COORDINATOR','客诉协调员'),('KT_QUALITY_INVESTIGATOR','质量调查员'),
 ('KT_QUALITY_MANAGER','质量经理'),('KT_CAPA_OWNER','整改措施责任人'),('KT_CAPA_VERIFIER','整改效果验证员') ON CONFLICT(code) DO NOTHING;
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT x.role_code,p.id FROM (VALUES
 ('KT_COMPLAINT_REGISTRAR','complaint:read'),('KT_COMPLAINT_REGISTRAR','complaint:create'),
 ('KT_COMPLAINT_COORDINATOR','complaint:read'),('KT_COMPLAINT_COORDINATOR','complaint:triage'),('KT_COMPLAINT_COORDINATOR','complaint:assign'),
 ('KT_QUALITY_INVESTIGATOR','complaint:read'),('KT_QUALITY_INVESTIGATOR','ncr:read'),('KT_QUALITY_INVESTIGATOR','ncr:manage'),
 ('KT_QUALITY_MANAGER','complaint:read'),('KT_QUALITY_MANAGER','complaint:close'),('KT_QUALITY_MANAGER','ncr:read'),('KT_QUALITY_MANAGER','ncr:disposition'),('KT_QUALITY_MANAGER','capa:read'),
 ('KT_CAPA_OWNER','capa:read'),('KT_CAPA_OWNER','capa:manage'),('KT_CAPA_VERIFIER','capa:read'),('KT_CAPA_VERIFIER','capa:verify'),
 ('KT_EXECUTIVE_VIEWER','complaint:read'),('KT_EXECUTIVE_VIEWER','ncr:read'),('KT_EXECUTIVE_VIEWER','capa:read')
)x(role_code,capability) JOIN permissions p ON p.capability=x.capability ON CONFLICT DO NOTHING;
INSERT INTO atomic_role_conflicts(left_role_code,right_role_code,reason) VALUES
 ('KT_COMPLAINT_REGISTRAR','KT_QUALITY_MANAGER','客诉登记与最终关闭必须分离'),
 ('KT_QUALITY_INVESTIGATOR','KT_QUALITY_MANAGER','重大不合格调查与处置批准必须分离'),
 ('KT_CAPA_OWNER','KT_CAPA_VERIFIER','整改措施执行与效果验证必须分离') ON CONFLICT DO NOTHING;
SELECT provision_atomic_business_roles(id) FROM organizations WHERE organization_type='COMPANY' AND deleted_at IS NULL;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN']) AND p.capability=ANY(ARRAY[
 'complaint:read','complaint:create','complaint:triage','complaint:assign','complaint:close',
 'ncr:read','ncr:manage','ncr:disposition','capa:read','capa:manage','capa:verify'
]) ON CONFLICT DO NOTHING;
