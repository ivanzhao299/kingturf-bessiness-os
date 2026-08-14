-- JTF-P1-E01..E04: tenant-keyed CRM master, lead pool, assignment and 360 foundations.
CREATE TYPE customer_status AS ENUM('PROSPECT','ACTIVE','INACTIVE','ARCHIVED');
CREATE TYPE lead_status AS ENUM('NEW','POOL','CLAIMED','QUALIFIED','DISQUALIFIED','CONVERTED');
CREATE TYPE assignment_subject AS ENUM('CUSTOMER','LEAD');

CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_number text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), normalized_name text NOT NULL CHECK(length(normalized_name) BETWEEN 1 AND 200),
 status customer_status NOT NULL DEFAULT 'PROSPECT', owner_id uuid, owner_organization_id uuid,
 tags text[] NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 created_by uuid NOT NULL, updated_by uuid NOT NULL, UNIQUE(id,tenant_id), UNIQUE(tenant_id,customer_number),
 FOREIGN KEY(tenant_id) REFERENCES organizations(id), FOREIGN KEY(owner_id,tenant_id) REFERENCES employees(id,company_id),
 FOREIGN KEY(owner_organization_id,tenant_id) REFERENCES organizations(id,owner_organization_id),
 FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(updated_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE UNIQUE INDEX customers_identity_active_unique ON customers(tenant_id,normalized_name) WHERE deleted_at IS NULL;
CREATE INDEX customers_tenant_owner_idx ON customers(tenant_id,owner_id,status,updated_at DESC,id);

CREATE TABLE customer_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_id uuid NOT NULL,
 name text NOT NULL, title text, normalized_email text, normalized_phone text, is_primary boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 created_by uuid NOT NULL, updated_by uuid NOT NULL, UNIQUE(id,tenant_id), FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(updated_by,tenant_id) REFERENCES employees(id,company_id),
 CHECK(normalized_email IS NOT NULL OR normalized_phone IS NOT NULL)
);
CREATE UNIQUE INDEX customer_primary_contact_unique ON customer_contacts(tenant_id,customer_id) WHERE is_primary AND deleted_at IS NULL;
CREATE UNIQUE INDEX customer_email_identity_unique ON customer_contacts(tenant_id,normalized_email) WHERE normalized_email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX customer_phone_identity_unique ON customer_contacts(tenant_id,normalized_phone) WHERE normalized_phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX customer_contacts_tenant_customer_idx ON customer_contacts(tenant_id,customer_id,created_at,id);

CREATE TABLE customer_lifecycle_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_id uuid NOT NULL,
 from_status customer_status NOT NULL, to_status customer_status NOT NULL, actor_id uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 occurred_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id), FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE customer_ownership_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_id uuid NOT NULL, owner_id uuid NOT NULL,
 organization_id uuid NOT NULL, assigned_by uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0), started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 UNIQUE(id,tenant_id), FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id), FOREIGN KEY(owner_id,tenant_id) REFERENCES employees(id,company_id),
 FOREIGN KEY(assigned_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,owner_organization_id),
 CHECK(ended_at IS NULL OR ended_at>started_at)
);
CREATE UNIQUE INDEX customer_active_owner_unique ON customer_ownership_history(tenant_id,customer_id) WHERE ended_at IS NULL;

CREATE TABLE leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_id uuid, title text NOT NULL, source text NOT NULL,
 status lead_status NOT NULL DEFAULT 'NEW', owner_id uuid, owner_organization_id uuid, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid NOT NULL, updated_by uuid NOT NULL,
 UNIQUE(id,tenant_id), FOREIGN KEY(tenant_id) REFERENCES organizations(id), FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 FOREIGN KEY(owner_id,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(owner_organization_id,tenant_id) REFERENCES organizations(id,owner_organization_id),
 FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(updated_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE INDEX leads_pool_idx ON leads(tenant_id,status,created_at,id) WHERE deleted_at IS NULL;
CREATE TABLE lead_transitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, lead_id uuid NOT NULL, from_status lead_status NOT NULL, to_status lead_status NOT NULL,
 actor_id uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0), occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(lead_id,tenant_id) REFERENCES leads(id,tenant_id), FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE crm_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, subject_type assignment_subject NOT NULL, subject_id uuid NOT NULL,
 assignee_id uuid NOT NULL, organization_id uuid NOT NULL, assigned_by uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), assigned_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 UNIQUE(id,tenant_id), FOREIGN KEY(assignee_id,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(assigned_by,tenant_id) REFERENCES employees(id,company_id),
 FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,owner_organization_id), CHECK(ended_at IS NULL OR ended_at>assigned_at)
);
CREATE UNIQUE INDEX crm_active_assignment_unique ON crm_assignments(tenant_id,subject_type,subject_id) WHERE ended_at IS NULL;
CREATE TABLE customer_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, customer_id uuid NOT NULL, lead_id uuid, activity_type text NOT NULL,
 occurred_at timestamptz NOT NULL, actor_id uuid NOT NULL, summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 500), details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128), UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id), FOREIGN KEY(lead_id,tenant_id) REFERENCES leads(id,tenant_id), FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);
CREATE INDEX customer_activities_timeline_idx ON customer_activities(tenant_id,customer_id,occurred_at DESC,id);
CREATE TABLE crm_command_results (
 tenant_id uuid NOT NULL REFERENCES organizations(id), idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 command_type text NOT NULL, subject_id uuid NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,idempotency_key)
);

CREATE FUNCTION validate_crm_assignment_subject() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.subject_type='CUSTOMER' AND NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.subject_id AND tenant_id=NEW.tenant_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'customer assignment tenant boundary violation'; END IF;
 IF NEW.subject_type='LEAD' AND NOT EXISTS(SELECT 1 FROM leads WHERE id=NEW.subject_id AND tenant_id=NEW.tenant_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'lead assignment tenant boundary violation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_assignment_subject_guard BEFORE INSERT OR UPDATE ON crm_assignments FOR EACH ROW EXECUTE FUNCTION validate_crm_assignment_subject();

CREATE FUNCTION protect_ended_crm_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.ended_at IS NOT NULL OR NEW.tenant_id<>OLD.tenant_id OR NEW.subject_type<>OLD.subject_type OR NEW.subject_id<>OLD.subject_id OR NEW.assignee_id<>OLD.assignee_id OR NEW.organization_id<>OLD.organization_id OR NEW.assigned_by<>OLD.assigned_by OR NEW.reason<>OLD.reason OR NEW.assigned_at<>OLD.assigned_at THEN RAISE EXCEPTION 'crm assignment history is immutable'; END IF;
 IF NEW.ended_at IS NULL OR NEW.ended_at<=OLD.assigned_at THEN RAISE EXCEPTION 'crm assignment may only be ended once'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION protect_customer_ownership_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.ended_at IS NOT NULL OR NEW.tenant_id<>OLD.tenant_id OR NEW.customer_id<>OLD.customer_id OR NEW.owner_id<>OLD.owner_id OR NEW.organization_id<>OLD.organization_id OR NEW.assigned_by<>OLD.assigned_by OR NEW.reason<>OLD.reason OR NEW.started_at<>OLD.started_at THEN RAISE EXCEPTION 'customer ownership history is immutable'; END IF;
 IF NEW.ended_at IS NULL OR NEW.ended_at<=OLD.started_at THEN RAISE EXCEPTION 'customer ownership may only be ended once'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER customer_lifecycle_immutable BEFORE UPDATE OR DELETE ON customer_lifecycle_history FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER customer_ownership_delete_immutable BEFORE DELETE ON customer_ownership_history FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER customer_ownership_update_guard BEFORE UPDATE ON customer_ownership_history FOR EACH ROW EXECUTE FUNCTION protect_customer_ownership_history();
CREATE TRIGGER lead_transitions_immutable BEFORE UPDATE OR DELETE ON lead_transitions FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER crm_assignments_immutable BEFORE DELETE ON crm_assignments FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER crm_assignments_update_guard BEFORE UPDATE ON crm_assignments FOR EACH ROW EXECUTE FUNCTION protect_ended_crm_assignment();
CREATE TRIGGER customer_activities_immutable BEFORE UPDATE OR DELETE ON customer_activities FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

INSERT INTO permissions(capability,description) VALUES
 ('customer:read','Read customers'),('customer:create','Create customers'),('customer:update','Update customers'),('customer:lifecycle','Change customer lifecycle'),('customer:deduplicate','Review customer duplicates'),
 ('customer-ownership:read','Read ownership history'),('customer-ownership:assign','Assign customer ownership'),('customer-activity:read','Read activities'),('customer-activity:create','Create activities'),('customer-360:read','Read Customer 360'),
 ('lead:read','Read leads'),('lead:create','Create leads'),('lead:update','Update leads'),('lead:lifecycle','Change lead lifecycle'),('lead-pool:read','Read lead pool'),('lead-pool:claim','Claim pool leads'),('lead-pool:release','Release leads'),('lead:assign','Assign leads'),('lead:reassign','Reassign leads')
ON CONFLICT(capability) DO NOTHING;
