CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE data_scope AS ENUM ('SELF','TEAM','DEPARTMENT','REGION','COMPANY','GROUP');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_organization_id uuid, parent_id uuid,
  code text NOT NULL, name text NOT NULL, organization_type text NOT NULL CHECK (organization_type IN ('GROUP','COMPANY','REGION','DEPARTMENT','TEAM')),
  locale text NOT NULL DEFAULT 'zh-CN', currency char(3) NOT NULL DEFAULT 'CNY' CHECK (currency ~ '^[A-Z]{3}$'), active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, created_by uuid, updated_by uuid,
  CONSTRAINT organizations_owner_fk FOREIGN KEY (owner_organization_id) REFERENCES organizations(id),
  CONSTRAINT organizations_parent_fk FOREIGN KEY (parent_id) REFERENCES organizations(id),
  CONSTRAINT organizations_code_unique UNIQUE (owner_organization_id, code),
  CONSTRAINT organizations_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES organizations(id), organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_number text NOT NULL, display_name text NOT NULL, normalized_email text NOT NULL, active boolean NOT NULL DEFAULT true,
  manager_id uuid REFERENCES employees(id), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE(company_id, employee_number), UNIQUE(company_id, normalized_email)
);
CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id), employee_id uuid NOT NULL REFERENCES employees(id), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, PRIMARY KEY(organization_id, employee_id)
);
CREATE TABLE identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL UNIQUE REFERENCES employees(id), login_name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid
);
CREATE TABLE password_credentials (
  identity_id uuid PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE, algorithm text NOT NULL CHECK (algorithm = 'scrypt'), password_hash text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_id uuid NOT NULL REFERENCES identities(id) ON DELETE CASCADE, organization_id uuid NOT NULL REFERENCES organizations(id),
  token_hash char(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
CREATE INDEX sessions_active_token_idx ON sessions(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), code text NOT NULL, name text NOT NULL, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE(organization_id, code));
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), capability text NOT NULL UNIQUE CHECK (capability ~ '^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$'), description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid);
CREATE TABLE role_permission_grants (role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES permissions(id), field_allowlist text[], data_scopes data_scope[] NOT NULL CHECK (cardinality(data_scopes) > 0), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid, PRIMARY KEY(role_id, permission_id));
CREATE TABLE employee_role_assignments (employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE, role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, PRIMARY KEY(employee_id, role_id));
CREATE TABLE data_scope_grants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES permissions(id), scope data_scope NOT NULL, scope_organization_id uuid REFERENCES organizations(id), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, UNIQUE(employee_id, permission_id, scope, scope_organization_id));
CREATE TABLE organization_scope_relationships (ancestor_id uuid NOT NULL REFERENCES organizations(id), descendant_id uuid NOT NULL REFERENCES organizations(id), depth integer NOT NULL CHECK(depth >= 0), PRIMARY KEY(ancestor_id, descendant_id));
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(), action text NOT NULL, outcome text NOT NULL CHECK(outcome IN ('SUCCESS','FAILURE')), actor_id uuid, organization_id uuid, target_type text, target_id uuid, correlation_id uuid NOT NULL, metadata jsonb NOT NULL DEFAULT '{}');

CREATE FUNCTION protect_organization_ownership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.owner_organization_id IS DISTINCT FROM NEW.owner_organization_id THEN RAISE EXCEPTION 'organization ownership is immutable'; END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations p WHERE p.id=NEW.parent_id AND p.owner_organization_id=NEW.owner_organization_id AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'parent must share organization ownership'; END IF;
  IF NEW.parent_id IS NOT NULL AND EXISTS (SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=NEW.id AND descendant_id=NEW.parent_id) THEN RAISE EXCEPTION 'organization hierarchy cycle'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organizations_integrity BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION protect_organization_ownership();
