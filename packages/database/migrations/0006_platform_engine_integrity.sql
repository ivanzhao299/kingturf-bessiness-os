-- Append-only hardening for JTF-P0-E07..E11.
CREATE FUNCTION reject_published_row_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'published version is immutable'; END IF; RETURN OLD;
END $$;
CREATE TRIGGER protect_number_published_delete BEFORE DELETE ON number_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_delete();
CREATE TRIGGER protect_workflow_published_delete BEFORE DELETE ON workflow_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_delete();
CREATE TRIGGER protect_rule_published_delete BEFORE DELETE ON rule_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_delete();

ALTER TABLE workflow_tasks ADD COLUMN assigned_actor_id uuid REFERENCES employees(id);
ALTER TABLE workflow_tasks ADD COLUMN assigned_role_code text;
ALTER TABLE workflow_tasks ADD CHECK ((assigned_actor_id IS NULL) <> (assigned_role_code IS NULL));
CREATE INDEX workflow_task_queue_idx ON workflow_tasks(tenant_id,status,assigned_actor_id,assigned_role_code,created_at);

CREATE FUNCTION enforce_workflow_tenant_and_separation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE requester uuid; actor_tenant uuid; task_tenant uuid; requires_separation boolean;
BEGIN
  SELECT i.requester_id,t.tenant_id,COALESCE((step.value->>'separateFromRequester')::boolean,false) INTO requester,task_tenant,requires_separation
  FROM workflow_tasks t JOIN workflow_instances i ON i.id=t.instance_id AND i.tenant_id=t.tenant_id
  JOIN workflow_definition_versions v ON v.id=i.definition_version_id AND v.tenant_id=i.tenant_id
  LEFT JOIN LATERAL jsonb_array_elements(v.spec->'steps') step(value) ON step.value->>'key'=t.step_key
  WHERE t.id=NEW.task_id AND t.tenant_id=NEW.tenant_id FOR UPDATE OF t,i;
  SELECT company_id INTO actor_tenant FROM employees WHERE id=NEW.actor_id;
  IF requester IS NULL OR actor_tenant IS DISTINCT FROM NEW.tenant_id OR task_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'workflow tenant boundary violation'; END IF;
  IF requires_separation AND requester=NEW.actor_id THEN RAISE EXCEPTION 'workflow separation of duties violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_decision_guard BEFORE INSERT ON workflow_decisions FOR EACH ROW EXECUTE FUNCTION enforce_workflow_tenant_and_separation();

CREATE FUNCTION enforce_workflow_employee_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employee_id uuid;
BEGIN
  employee_id := CASE TG_ARGV[0]
    WHEN 'requester_id' THEN NULLIF(to_jsonb(NEW)->>'requester_id','')::uuid
    WHEN 'assigned_actor_id' THEN NULLIF(to_jsonb(NEW)->>'assigned_actor_id','')::uuid
    WHEN 'claimed_by' THEN NULLIF(to_jsonb(NEW)->>'claimed_by','')::uuid
    ELSE NULLIF(to_jsonb(NEW)->>'actor_id','')::uuid END;
  IF employee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM employees e WHERE e.id=employee_id AND e.company_id=NEW.tenant_id) THEN RAISE EXCEPTION 'workflow employee tenant boundary violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_instance_requester_tenant BEFORE INSERT OR UPDATE OF requester_id,tenant_id ON workflow_instances FOR EACH ROW EXECUTE FUNCTION enforce_workflow_employee_tenant('requester_id');
CREATE TRIGGER workflow_task_assignee_tenant BEFORE INSERT OR UPDATE OF assigned_actor_id,tenant_id ON workflow_tasks FOR EACH ROW EXECUTE FUNCTION enforce_workflow_employee_tenant('assigned_actor_id');
CREATE TRIGGER workflow_task_claim_tenant BEFORE INSERT OR UPDATE OF claimed_by,tenant_id ON workflow_tasks FOR EACH ROW EXECUTE FUNCTION enforce_workflow_employee_tenant('claimed_by');
CREATE TRIGGER workflow_transition_actor_tenant BEFORE INSERT OR UPDATE OF actor_id,tenant_id ON workflow_transitions FOR EACH ROW EXECUTE FUNCTION enforce_workflow_employee_tenant('actor_id');

CREATE INDEX workflow_instance_subject_idx ON workflow_instances(tenant_id,subject_type,subject_id,started_at DESC);
CREATE INDEX rule_evaluation_lookup_idx ON rule_evaluations(tenant_id,rule_version_id,idempotency_key);
