ALTER TABLE customer_complaints
  ADD CONSTRAINT customer_complaints_occurred_check CHECK(occurred_at<=reported_at) NOT VALID,
  ADD CONSTRAINT customer_complaints_request_check CHECK(length(trim(customer_request))>=2) NOT VALID,
  ADD CONSTRAINT customer_complaints_snapshot_check CHECK(initial_snapshot<>'{}'::jsonb) NOT VALID,
  ADD CONSTRAINT customer_complaints_deadline_order_check CHECK(response_due_at<=containment_due_at AND containment_due_at<=root_cause_due_at AND root_cause_due_at<=closure_due_at) NOT VALID;
ALTER TABLE customer_complaint_events ADD CONSTRAINT customer_complaint_events_reason_check CHECK(length(trim(reason))>=2) NOT VALID;
ALTER TABLE nonconformance_reports
  ADD CONSTRAINT nonconformance_reports_defect_check CHECK(length(trim(defect_type))>=2) NOT VALID,
  ADD CONSTRAINT nonconformance_reports_scope_check CHECK(length(trim(affected_scope))>=2) NOT VALID;
ALTER TABLE ncr_events ADD CONSTRAINT ncr_events_reason_check CHECK(length(trim(reason))>=2) NOT VALID;
ALTER TABLE capa_cases
  ADD CONSTRAINT capa_cases_root_cause_check CHECK(root_cause_snapshot<>'{}'::jsonb) NOT VALID,
  ADD CONSTRAINT capa_cases_target_check CHECK(target_at>created_at) NOT VALID;
ALTER TABLE capa_events ADD CONSTRAINT capa_events_reason_check CHECK(length(trim(reason))>=2) NOT VALID;
ALTER TABLE capa_actions ADD CONSTRAINT capa_actions_due_check CHECK(due_at>created_at) NOT VALID;
ALTER TABLE capa_action_completions ADD CONSTRAINT capa_action_completions_evidence_nonempty_check CHECK(evidence<>'{}'::jsonb) NOT VALID;
ALTER TABLE capa_verifications
  DROP CONSTRAINT capa_verifications_check,
  ADD CONSTRAINT capa_verifications_observation_check CHECK(observation_until<=verified_at) NOT VALID,
  ADD CONSTRAINT capa_verifications_standard_check CHECK(length(trim(standard))>=2) NOT VALID,
  ADD CONSTRAINT capa_verifications_scope_check CHECK(length(trim(sample_scope))>=2) NOT VALID,
  ADD CONSTRAINT capa_verifications_evidence_nonempty_check CHECK(evidence<>'{}'::jsonb) NOT VALID;

CREATE TABLE complaint_batch_commands(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,batch_key text NOT NULL,request_hash char(64) NOT NULL,
  result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),actor_id uuid NOT NULL,correlation_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,batch_key),FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);

CREATE OR REPLACE VIEW customer_complaint_effective_states AS
SELECT c.tenant_id,c.id complaint_id,e.state,e.sequence,e.reason,e.evidence,coalesce(e.assigned_to,a.assigned_to,c.assigned_to) assigned_to,e.actor_id,e.created_at
FROM customer_complaints c JOIN LATERAL(SELECT * FROM customer_complaint_events x WHERE x.tenant_id=c.tenant_id AND x.complaint_id=c.id ORDER BY x.sequence DESC LIMIT 1)e ON true
LEFT JOIN LATERAL(SELECT x.assigned_to FROM customer_complaint_events x WHERE x.tenant_id=c.tenant_id AND x.complaint_id=c.id AND x.assigned_to IS NOT NULL ORDER BY x.sequence DESC LIMIT 1)a ON true;

CREATE OR REPLACE VIEW ncr_effective_states AS
SELECT n.tenant_id,n.id ncr_id,e.state,e.sequence,e.reason,rc.root_cause_method,coalesce(rc.root_cause,'{}'::jsonb) root_cause,d.disposition,e.evidence,e.actor_id,d.approved_by,e.created_at
FROM nonconformance_reports n JOIN LATERAL(SELECT * FROM ncr_events x WHERE x.tenant_id=n.tenant_id AND x.ncr_id=n.id ORDER BY x.sequence DESC LIMIT 1)e ON true
LEFT JOIN LATERAL(SELECT x.root_cause_method,x.root_cause FROM ncr_events x WHERE x.tenant_id=n.tenant_id AND x.ncr_id=n.id AND x.root_cause_method IS NOT NULL ORDER BY x.sequence DESC LIMIT 1)rc ON true
LEFT JOIN LATERAL(SELECT x.disposition,x.approved_by FROM ncr_events x WHERE x.tenant_id=n.tenant_id AND x.ncr_id=n.id AND x.disposition IS NOT NULL ORDER BY x.sequence DESC LIMIT 1)d ON true;

CREATE FUNCTION validate_complaint_relationships() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  policy_severity complaint_severity; policy_effective timestamptz; response_hours integer; containment_hours integer; root_cause_hours integer; closure_hours integer;
  order_customer uuid; shipment_order uuid; inspection_lot uuid; linked_lot uuid;
BEGIN
  SELECT severity,effective_at,p.response_hours,p.containment_hours,p.root_cause_hours,p.closure_hours INTO policy_severity,policy_effective,response_hours,containment_hours,root_cause_hours,closure_hours FROM complaint_sla_policy_versions p WHERE tenant_id=NEW.tenant_id AND id=NEW.sla_policy_version_id;
  IF policy_severity IS DISTINCT FROM NEW.severity OR policy_effective>NEW.reported_at THEN RAISE EXCEPTION 'complaint SLA policy severity or effective time mismatch'; END IF;
  IF NEW.response_due_at IS DISTINCT FROM NEW.reported_at+make_interval(hours=>response_hours) OR NEW.containment_due_at IS DISTINCT FROM NEW.reported_at+make_interval(hours=>containment_hours) OR NEW.root_cause_due_at IS DISTINCT FROM NEW.reported_at+make_interval(hours=>root_cause_hours) OR NEW.closure_due_at IS DISTINCT FROM NEW.reported_at+make_interval(hours=>closure_hours) THEN RAISE EXCEPTION 'complaint SLA deadlines must be server-derived from policy'; END IF;
  IF NEW.sales_order_id IS NOT NULL THEN SELECT customer_id INTO order_customer FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id; IF order_customer IS DISTINCT FROM NEW.customer_id THEN RAISE EXCEPTION 'complaint order must belong to customer'; END IF; END IF;
  IF NEW.shipment_id IS NOT NULL THEN
    SELECT r.sales_order_id,r.finished_lot_id INTO shipment_order,linked_lot FROM shipments s JOIN shipment_release_requests r ON r.tenant_id=s.tenant_id AND r.id=s.release_request_id WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.shipment_id;
    IF NEW.sales_order_id IS NOT NULL AND shipment_order IS DISTINCT FROM NEW.sales_order_id THEN RAISE EXCEPTION 'complaint shipment must belong to order'; END IF;
    IF NEW.inventory_lot_id IS NOT NULL AND linked_lot IS DISTINCT FROM NEW.inventory_lot_id THEN RAISE EXCEPTION 'complaint lot must belong to shipment'; END IF;
  END IF;
  IF NEW.quality_inspection_id IS NOT NULL THEN SELECT lot_id INTO inspection_lot FROM quality_inspections WHERE tenant_id=NEW.tenant_id AND id=NEW.quality_inspection_id; IF NEW.inventory_lot_id IS NOT NULL AND inspection_lot IS DISTINCT FROM NEW.inventory_lot_id THEN RAISE EXCEPTION 'complaint inspection must belong to lot'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_complaint_relationship_guard BEFORE INSERT ON customer_complaints FOR EACH ROW EXECUTE FUNCTION validate_complaint_relationships();

CREATE FUNCTION validate_ncr_creation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE complaint_status complaint_state; organization_company uuid; BEGIN
  SELECT state INTO complaint_status FROM customer_complaint_effective_states WHERE tenant_id=NEW.tenant_id AND complaint_id=NEW.complaint_id;
  IF complaint_status<>'INVESTIGATING' THEN RAISE EXCEPTION 'NCR requires investigating complaint'; END IF;
  SELECT CASE WHEN organization_type='COMPANY' THEN id ELSE owner_organization_id END INTO organization_company FROM organizations WHERE id=NEW.responsible_organization_id;
  IF organization_company IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'NCR responsible organization must belong to tenant'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ncr_creation_guard BEFORE INSERT ON nonconformance_reports FOR EACH ROW EXECUTE FUNCTION validate_ncr_creation();

CREATE FUNCTION validate_capa_creation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE investigation_state ncr_state; complaint_status complaint_state; BEGIN
  SELECT s.state,cs.state INTO investigation_state,complaint_status FROM nonconformance_reports n JOIN ncr_effective_states s ON s.tenant_id=n.tenant_id AND s.ncr_id=n.id JOIN customer_complaint_effective_states cs ON cs.tenant_id=n.tenant_id AND cs.complaint_id=n.complaint_id WHERE n.tenant_id=NEW.tenant_id AND n.id=NEW.ncr_id;
  IF investigation_state<>'DISPOSITIONED' OR complaint_status<>'NCR_OPEN' THEN RAISE EXCEPTION 'CAPA requires dispositioned NCR and NCR_OPEN complaint'; END IF;
  IF NEW.root_cause_snapshot IS DISTINCT FROM (SELECT s.root_cause FROM ncr_effective_states s WHERE s.tenant_id=NEW.tenant_id AND s.ncr_id=NEW.ncr_id) THEN RAISE EXCEPTION 'CAPA root cause snapshot must match confirmed NCR evidence'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capa_creation_guard BEFORE INSERT ON capa_cases FOR EACH ROW EXECUTE FUNCTION validate_capa_creation();

CREATE OR REPLACE FUNCTION validate_complaint_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous complaint_state; expected integer; reporter uuid; severity complaint_severity; linked_exists boolean; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.complaint_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM customer_complaint_events WHERE tenant_id=NEW.tenant_id AND complaint_id=NEW.complaint_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT reported_by,c.severity INTO reporter,severity FROM customer_complaints c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.complaint_id;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.expected_version<>0 OR NEW.state<>'REPORTED' THEN RAISE EXCEPTION 'complaint ledger must begin at REPORTED version 0'; END IF;
  ELSE
    IF NEW.sequence<>expected OR NEW.expected_version<>expected-1 THEN RAISE EXCEPTION 'complaint version conflict'; END IF;
    IF previous='REPORTED' AND NEW.state NOT IN('TRIAGED','REJECTED') OR previous='TRIAGED' AND NEW.state NOT IN('INVESTIGATING','REJECTED') OR previous='INVESTIGATING' AND NEW.state NOT IN('NCR_OPEN','CLOSED') OR previous='NCR_OPEN' AND NEW.state<>'CAPA_ACTIVE' OR previous='CAPA_ACTIVE' AND NEW.state<>'VERIFIED' OR previous='VERIFIED' AND NEW.state<>'CLOSED' OR previous IN('CLOSED','REJECTED') THEN RAISE EXCEPTION 'illegal complaint transition from % to %',previous,NEW.state; END IF;
    IF NEW.state='CLOSED' AND NEW.actor_id=reporter THEN RAISE EXCEPTION 'complaint reporter cannot close own complaint'; END IF;
    IF NEW.state='CLOSED' AND previous='INVESTIGATING' AND NOT (NEW.evidence ? 'resolutionType' AND NEW.evidence ? 'investigationConclusion' AND NEW.evidence ? 'noNcrReason') THEN RAISE EXCEPTION 'direct complaint closure requires structured investigation evidence'; END IF;
    IF NEW.state='CLOSED' AND severity IN('MAJOR','CRITICAL') AND previous<>'VERIFIED' THEN RAISE EXCEPTION 'major complaint closure requires verified CAPA'; END IF;
    IF NEW.state='NCR_OPEN' THEN SELECT EXISTS(SELECT 1 FROM nonconformance_reports n JOIN ncr_effective_states s ON s.tenant_id=n.tenant_id AND s.ncr_id=n.id WHERE n.tenant_id=NEW.tenant_id AND n.complaint_id=NEW.complaint_id AND s.state='OPEN') INTO linked_exists; IF NOT linked_exists THEN RAISE EXCEPTION 'NCR_OPEN complaint requires open NCR'; END IF; END IF;
    IF NEW.state='CAPA_ACTIVE' THEN SELECT EXISTS(SELECT 1 FROM nonconformance_reports n JOIN capa_cases c ON c.tenant_id=n.tenant_id AND c.ncr_id=n.id WHERE n.tenant_id=NEW.tenant_id AND n.complaint_id=NEW.complaint_id) INTO linked_exists; IF NOT linked_exists THEN RAISE EXCEPTION 'CAPA_ACTIVE complaint requires CAPA'; END IF; END IF;
    IF NEW.state='VERIFIED' THEN SELECT EXISTS(SELECT 1 FROM nonconformance_reports n JOIN capa_cases c ON c.tenant_id=n.tenant_id AND c.ncr_id=n.id JOIN capa_effective_states s ON s.tenant_id=c.tenant_id AND s.capa_id=c.id JOIN capa_verifications v ON v.tenant_id=c.tenant_id AND v.capa_id=c.id AND v.result='PASSED' WHERE n.tenant_id=NEW.tenant_id AND n.complaint_id=NEW.complaint_id AND s.state='VERIFIED') INTO linked_exists; IF NOT linked_exists THEN RAISE EXCEPTION 'verified complaint requires independently verified CAPA'; END IF; END IF;
  END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validate_ncr_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous ncr_state; expected integer; investigator uuid; linked_exists boolean; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.ncr_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM ncr_events WHERE tenant_id=NEW.tenant_id AND ncr_id=NEW.ncr_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  SELECT investigator_id INTO investigator FROM nonconformance_reports WHERE tenant_id=NEW.tenant_id AND id=NEW.ncr_id;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.expected_version<>0 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'NCR ledger must begin at OPEN version 0'; END IF;
  ELSE
    IF NEW.sequence<>expected OR NEW.expected_version<>expected-1 THEN RAISE EXCEPTION 'NCR version conflict'; END IF;
    IF previous='OPEN' AND NEW.state<>'CONTAINED' OR previous='CONTAINED' AND NEW.state<>'ROOT_CAUSE_CONFIRMED' OR previous='ROOT_CAUSE_CONFIRMED' AND NEW.state<>'DISPOSITIONED' OR previous='DISPOSITIONED' AND NEW.state<>'CLOSED' OR previous='CLOSED' THEN RAISE EXCEPTION 'illegal NCR transition from % to %',previous,NEW.state; END IF;
    IF NEW.state='ROOT_CAUSE_CONFIRMED' AND (NEW.root_cause_method IS NULL OR NEW.root_cause='{}'::jsonb) THEN RAISE EXCEPTION 'root cause confirmation requires structured analysis'; END IF;
    IF NEW.state='DISPOSITIONED' AND (NEW.disposition IS NULL OR NEW.approved_by IS NULL OR NEW.evidence='{}'::jsonb) THEN RAISE EXCEPTION 'NCR disposition requires approval and evidence'; END IF;
    IF NEW.state='DISPOSITIONED' AND NEW.approved_by IS DISTINCT FROM NEW.actor_id THEN RAISE EXCEPTION 'NCR disposition approver must be command actor'; END IF;
    IF NEW.state='DISPOSITIONED' AND NEW.approved_by=investigator THEN RAISE EXCEPTION 'major NCR investigator cannot approve own disposition'; END IF;
    IF NEW.state='CLOSED' THEN SELECT EXISTS(SELECT 1 FROM capa_cases c JOIN capa_effective_states s ON s.tenant_id=c.tenant_id AND s.capa_id=c.id WHERE c.tenant_id=NEW.tenant_id AND c.ncr_id=NEW.ncr_id AND s.state IN('VERIFIED','CLOSED')) INTO linked_exists; IF NOT linked_exists THEN RAISE EXCEPTION 'NCR closure requires verified CAPA'; END IF; END IF;
  END IF; RETURN NEW;
END $$;

CREATE FUNCTION validate_capa_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous capa_state; expected integer; action_count integer; incomplete integer; passed boolean; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.capa_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM capa_events WHERE tenant_id=NEW.tenant_id AND capa_id=NEW.capa_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.expected_version<>0 OR NEW.state<>'OPEN' THEN RAISE EXCEPTION 'CAPA ledger must begin at OPEN version 0'; END IF;
  ELSE
    IF NEW.sequence<>expected OR NEW.expected_version<>expected-1 THEN RAISE EXCEPTION 'CAPA version conflict'; END IF;
    IF previous='OPEN' AND NEW.state<>'ACTIONS_IN_PROGRESS' OR previous='ACTIONS_IN_PROGRESS' AND NEW.state<>'READY_FOR_VERIFICATION' OR previous='READY_FOR_VERIFICATION' AND NEW.state NOT IN('ACTIONS_IN_PROGRESS','VERIFIED') OR previous='VERIFIED' AND NEW.state<>'CLOSED' OR previous='CLOSED' THEN RAISE EXCEPTION 'illegal CAPA transition from % to %',previous,NEW.state; END IF;
    IF NEW.state='READY_FOR_VERIFICATION' THEN SELECT count(*),count(*) FILTER(WHERE c.id IS NULL) INTO action_count,incomplete FROM capa_actions a LEFT JOIN capa_action_completions c ON c.tenant_id=a.tenant_id AND c.capa_action_id=a.id WHERE a.tenant_id=NEW.tenant_id AND a.capa_id=NEW.capa_id; IF action_count=0 OR incomplete>0 THEN RAISE EXCEPTION 'CAPA readiness requires completed actions'; END IF; END IF;
    IF NEW.state='VERIFIED' THEN SELECT EXISTS(SELECT 1 FROM capa_verifications v WHERE v.tenant_id=NEW.tenant_id AND v.capa_id=NEW.capa_id AND v.result='PASSED') INTO passed; IF NOT passed THEN RAISE EXCEPTION 'CAPA verified state requires passed independent verification'; END IF; END IF;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER capa_event_guard BEFORE INSERT ON capa_events FOR EACH ROW EXECUTE FUNCTION validate_capa_event();

CREATE FUNCTION validate_capa_action() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state capa_state; owner uuid; BEGIN
  IF TG_TABLE_NAME='capa_actions' THEN SELECT s.state INTO state FROM capa_effective_states s WHERE s.tenant_id=NEW.tenant_id AND s.capa_id=NEW.capa_id; IF state NOT IN('OPEN','ACTIONS_IN_PROGRESS') THEN RAISE EXCEPTION 'CAPA action requires open action state'; END IF;
  ELSE SELECT a.owner_id,s.state INTO owner,state FROM capa_actions a JOIN capa_effective_states s ON s.tenant_id=a.tenant_id AND s.capa_id=a.capa_id WHERE a.tenant_id=NEW.tenant_id AND a.id=NEW.capa_action_id; IF state<>'ACTIONS_IN_PROGRESS' OR owner IS DISTINCT FROM NEW.completed_by THEN RAISE EXCEPTION 'CAPA action completion requires assigned owner and active state'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capa_action_guard BEFORE INSERT ON capa_actions FOR EACH ROW EXECUTE FUNCTION validate_capa_action();
CREATE TRIGGER capa_action_completion_guard BEFORE INSERT ON capa_action_completions FOR EACH ROW EXECUTE FUNCTION validate_capa_action();

CREATE OR REPLACE FUNCTION validate_capa_verification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE action_count integer; incomplete integer; self_owned integer; state capa_state; capa_owner uuid; capa_creator uuid; investigator uuid; latest_completion timestamptz; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.capa_id::text,0));
  SELECT s.state INTO state FROM capa_effective_states s WHERE s.tenant_id=NEW.tenant_id AND s.capa_id=NEW.capa_id;
  SELECT count(*),count(*) FILTER(WHERE c.id IS NULL),count(*) FILTER(WHERE a.owner_id=NEW.verifier_id OR c.completed_by=NEW.verifier_id),max(c.completed_at) INTO action_count,incomplete,self_owned,latest_completion FROM capa_actions a LEFT JOIN capa_action_completions c ON c.tenant_id=a.tenant_id AND c.capa_action_id=a.id WHERE a.tenant_id=NEW.tenant_id AND a.capa_id=NEW.capa_id;
  IF state<>'READY_FOR_VERIFICATION' OR action_count=0 OR incomplete>0 THEN RAISE EXCEPTION 'CAPA verification requires all actions complete and ready state'; END IF;
  SELECT c.owner_id,c.created_by,n.investigator_id INTO capa_owner,capa_creator,investigator FROM capa_cases c JOIN nonconformance_reports n ON n.tenant_id=c.tenant_id AND n.id=c.ncr_id WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.capa_id;
  IF NEW.verifier_id=ANY(ARRAY[capa_owner,capa_creator,investigator]) THEN RAISE EXCEPTION 'CAPA owner, creator, or investigator cannot verify effectiveness'; END IF;
  IF self_owned>0 THEN RAISE EXCEPTION 'CAPA action owner cannot verify own action'; END IF;
  IF NEW.verified_at<latest_completion OR NEW.verified_at<NEW.observation_until THEN RAISE EXCEPTION 'CAPA verification must follow action completion and observation window'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER complaint_batch_commands_immutable BEFORE UPDATE OR DELETE ON complaint_batch_commands FOR EACH ROW EXECUTE FUNCTION protect_complaint_quality_evidence();
