-- JTF-P0-E07..E11: versioned platform foundations. Released migrations remain immutable.
CREATE INDEX audit_events_tenant_time_idx ON audit_events(organization_id,occurred_at DESC,id);
CREATE INDEX audit_events_actor_idx ON audit_events(organization_id,actor_id,occurred_at DESC);
CREATE INDEX audit_events_action_idx ON audit_events(organization_id,action,occurred_at DESC);
CREATE INDEX audit_events_target_idx ON audit_events(organization_id,target_type,target_id,occurred_at DESC);
CREATE INDEX audit_events_correlation_idx ON audit_events(organization_id,correlation_id);

CREATE FUNCTION reject_immutable_row_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% is immutable',TG_TABLE_NAME; END $$;
CREATE FUNCTION reject_published_row_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'published version is immutable'; END IF; RETURN NEW;
END $$;

CREATE TABLE master_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), code text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES employees(id), UNIQUE(tenant_id,code), UNIQUE(id,tenant_id)
);
CREATE TABLE master_category_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, category_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 name text NOT NULL, description text, effective_from timestamptz NOT NULL, effective_to timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES employees(id),
 CHECK(effective_to IS NULL OR effective_to>effective_from), UNIQUE(category_id,version), UNIQUE(id,tenant_id),
 FOREIGN KEY(category_id,tenant_id) REFERENCES master_categories(id,tenant_id)
);
CREATE TABLE master_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, category_id uuid NOT NULL, code text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES employees(id), UNIQUE(id,tenant_id), UNIQUE(category_id,code),
 FOREIGN KEY(category_id,tenant_id) REFERENCES master_categories(id,tenant_id)
);
CREATE TABLE master_entry_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, entry_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 label text NOT NULL, value jsonb NOT NULL DEFAULT '{}', effective_from timestamptz NOT NULL, effective_to timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES employees(id),
 CHECK(jsonb_typeof(value)='object'), CHECK(effective_to IS NULL OR effective_to>effective_from), UNIQUE(entry_id,version),
 FOREIGN KEY(entry_id,tenant_id) REFERENCES master_entries(id,tenant_id)
);
CREATE INDEX master_category_effective_idx ON master_category_versions(tenant_id,category_id,effective_from,effective_to);
CREATE INDEX master_entry_effective_idx ON master_entry_versions(tenant_id,entry_id,effective_from,effective_to);

CREATE TYPE definition_status AS ENUM('DRAFT','PUBLISHED');
CREATE TYPE reset_period AS ENUM('NEVER','DAILY','MONTHLY','YEARLY');
CREATE TABLE number_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), code text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz, created_by uuid NOT NULL REFERENCES employees(id),
 UNIQUE(tenant_id,code), UNIQUE(id,tenant_id)
);
CREATE TABLE number_definition_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, definition_id uuid NOT NULL, version integer NOT NULL,
 status definition_status NOT NULL DEFAULT 'DRAFT', prefix text NOT NULL DEFAULT '', suffix text NOT NULL DEFAULT '', padding integer NOT NULL CHECK(padding BETWEEN 1 AND 32),
 starting_value bigint NOT NULL CHECK(starting_value>=0), increment_by bigint NOT NULL CHECK(increment_by>0), reset reset_period NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES employees(id), published_at timestamptz,
 UNIQUE(definition_id,version), UNIQUE(id,tenant_id), FOREIGN KEY(definition_id,tenant_id) REFERENCES number_definitions(id,tenant_id),
 CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE number_counters (tenant_id uuid NOT NULL, definition_version_id uuid NOT NULL, period_key text NOT NULL, next_value bigint NOT NULL, PRIMARY KEY(tenant_id,definition_version_id,period_key), FOREIGN KEY(definition_version_id,tenant_id) REFERENCES number_definition_versions(id,tenant_id));
CREATE TABLE issued_numbers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, definition_version_id uuid NOT NULL, period_key text NOT NULL,
 sequence_value bigint NOT NULL, rendered_value text NOT NULL, requester_id uuid NOT NULL REFERENCES employees(id), idempotency_key text NOT NULL,
 correlation_id uuid NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(definition_version_id,tenant_id) REFERENCES number_definition_versions(id,tenant_id),
 UNIQUE(tenant_id,definition_version_id,idempotency_key), UNIQUE(tenant_id,definition_version_id,period_key,sequence_value), UNIQUE(tenant_id,rendered_value)
);

CREATE TABLE workflow_definitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES organizations(id),code text NOT NULL,version integer NOT NULL DEFAULT 1,deleted_at timestamptz,created_by uuid NOT NULL REFERENCES employees(id),UNIQUE(tenant_id,code),UNIQUE(id,tenant_id));
CREATE TABLE workflow_definition_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,definition_id uuid NOT NULL,version integer NOT NULL,status definition_status NOT NULL DEFAULT 'DRAFT',spec jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES employees(id),published_at timestamptz,
 UNIQUE(definition_id,version),UNIQUE(id,tenant_id),FOREIGN KEY(definition_id,tenant_id) REFERENCES workflow_definitions(id,tenant_id),CHECK(jsonb_typeof(spec)='object'),CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE workflow_instances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,definition_version_id uuid NOT NULL,state text NOT NULL,requester_id uuid NOT NULL REFERENCES employees(id),subject_type text NOT NULL,subject_id uuid NOT NULL,version integer NOT NULL DEFAULT 1,idempotency_key text NOT NULL,correlation_id uuid NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,UNIQUE(tenant_id,definition_version_id,idempotency_key),UNIQUE(id,tenant_id),FOREIGN KEY(definition_version_id,tenant_id) REFERENCES workflow_definition_versions(id,tenant_id));
CREATE TABLE workflow_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,instance_id uuid NOT NULL,step_key text NOT NULL,status text NOT NULL CHECK(status IN('OPEN','CLAIMED','DECIDED','CANCELLED')),claimed_by uuid REFERENCES employees(id),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(instance_id,step_key),UNIQUE(id,tenant_id),FOREIGN KEY(instance_id,tenant_id) REFERENCES workflow_instances(id,tenant_id));
CREATE TABLE workflow_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,task_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES employees(id),decision text NOT NULL,comment text,idempotency_key text NOT NULL,correlation_id uuid NOT NULL,decided_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,task_id,idempotency_key),FOREIGN KEY(task_id,tenant_id) REFERENCES workflow_tasks(id,tenant_id));
CREATE TABLE workflow_transitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,instance_id uuid NOT NULL,from_state text,to_state text NOT NULL,actor_id uuid NOT NULL REFERENCES employees(id),reason text NOT NULL,correlation_id uuid NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(instance_id,tenant_id) REFERENCES workflow_instances(id,tenant_id));

CREATE TABLE rule_definitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES organizations(id),code text NOT NULL,version integer NOT NULL DEFAULT 1,deleted_at timestamptz,created_by uuid NOT NULL REFERENCES employees(id),UNIQUE(tenant_id,code),UNIQUE(id,tenant_id));
CREATE TABLE rule_definition_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,definition_id uuid NOT NULL,version integer NOT NULL,status definition_status NOT NULL DEFAULT 'DRAFT',ast jsonb NOT NULL,required_inputs text[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES employees(id),published_at timestamptz,UNIQUE(definition_id,version),UNIQUE(id,tenant_id),FOREIGN KEY(definition_id,tenant_id) REFERENCES rule_definitions(id,tenant_id),CHECK(jsonb_typeof(ast)='object'),CHECK((status='PUBLISHED')=(published_at IS NOT NULL)));
CREATE TABLE rule_evaluations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rule_version_id uuid NOT NULL,input jsonb NOT NULL,input_hash char(64) NOT NULL,decision boolean NOT NULL,trace jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES employees(id),idempotency_key text NOT NULL,correlation_id uuid NOT NULL,evaluated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,rule_version_id,idempotency_key),FOREIGN KEY(rule_version_id,tenant_id) REFERENCES rule_definition_versions(id,tenant_id));

CREATE TRIGGER immutable_master_category_versions BEFORE UPDATE OR DELETE ON master_category_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER immutable_master_entry_versions BEFORE UPDATE OR DELETE ON master_entry_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER protect_number_published BEFORE UPDATE ON number_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_mutation();
CREATE TRIGGER protect_workflow_published BEFORE UPDATE ON workflow_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_mutation();
CREATE TRIGGER protect_rule_published BEFORE UPDATE ON rule_definition_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_mutation();
CREATE TRIGGER immutable_issued_numbers BEFORE UPDATE OR DELETE ON issued_numbers FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER immutable_workflow_decisions BEFORE UPDATE OR DELETE ON workflow_decisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER immutable_workflow_transitions BEFORE UPDATE OR DELETE ON workflow_transitions FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER immutable_rule_evaluations BEFORE UPDATE OR DELETE ON rule_evaluations FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

