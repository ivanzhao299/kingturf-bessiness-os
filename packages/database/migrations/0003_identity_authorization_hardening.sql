-- Append-only identity and authorization hardening.

ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64);

-- A tenant root owns itself logically, while its persisted owner is NULL.
-- Keep the historical migration immutable and correct the ownership guard here.
CREATE OR REPLACE FUNCTION protect_organization_ownership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  -- Serialize hierarchy changes so two concurrent reparents cannot both pass
  -- cycle validation against stale closure state.
  PERFORM pg_advisory_xact_lock(hashtext('kingturf.organization_hierarchy'));
  IF TG_OP = 'UPDATE' AND OLD.owner_organization_id IS DISTINCT FROM NEW.owner_organization_id THEN RAISE EXCEPTION 'organization ownership is immutable'; END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organizations p
    WHERE p.id=NEW.parent_id
      AND (p.id=NEW.owner_organization_id OR p.owner_organization_id=NEW.owner_organization_id)
      AND p.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'parent must share organization ownership'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=NEW.id AND descendant_id=NEW.parent_id
  ) THEN RAISE EXCEPTION 'organization hierarchy cycle'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION maintain_organization_scope_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM organization_scope_relationships
    WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'organization hierarchy cycle';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO organization_scope_relationships(ancestor_id, descendant_id, depth)
    VALUES (NEW.id, NEW.id, 0);
    IF NEW.parent_id IS NOT NULL THEN
      INSERT INTO organization_scope_relationships(ancestor_id, descendant_id, depth)
      SELECT ancestor_id, NEW.id, depth + 1
      FROM organization_scope_relationships WHERE descendant_id = NEW.parent_id;
    END IF;
  ELSIF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
    DELETE FROM organization_scope_relationships r
    USING organization_scope_relationships subtree
    WHERE subtree.ancestor_id = NEW.id
      AND r.descendant_id = subtree.descendant_id
      AND r.ancestor_id NOT IN (
        SELECT descendant_id FROM organization_scope_relationships WHERE ancestor_id = NEW.id
      );

    IF NEW.parent_id IS NOT NULL THEN
      INSERT INTO organization_scope_relationships(ancestor_id, descendant_id, depth)
      SELECT supertree.ancestor_id, subtree.descendant_id,
             supertree.depth + subtree.depth + 1
      FROM organization_scope_relationships supertree
      CROSS JOIN organization_scope_relationships subtree
      WHERE supertree.descendant_id = NEW.parent_id
        AND subtree.ancestor_id = NEW.id
      ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER organizations_scope_relationships
AFTER INSERT OR UPDATE OF parent_id ON organizations
FOR EACH ROW EXECUTE FUNCTION maintain_organization_scope_relationships();

-- Backfill closure rows for organizations accepted before this migration.
WITH RECURSIVE closure(ancestor_id, descendant_id, depth) AS (
  SELECT id, id, 0 FROM organizations
  UNION ALL
  SELECT closure.ancestor_id, child.id, closure.depth + 1
  FROM closure JOIN organizations child ON child.parent_id = closure.descendant_id
)
INSERT INTO organization_scope_relationships(ancestor_id, descendant_id, depth)
SELECT ancestor_id, descendant_id, min(depth) FROM closure
GROUP BY ancestor_id, descendant_id
ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;

ALTER TABLE roles ADD CONSTRAINT roles_id_organization_unique UNIQUE(id, organization_id);
ALTER TABLE permissions ADD CONSTRAINT permissions_id_unique_for_tenant UNIQUE(id);
ALTER TABLE employees ADD CONSTRAINT employees_id_company_unique UNIQUE(id, company_id);

CREATE OR REPLACE FUNCTION enforce_authorization_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employee_company uuid; role_company uuid; scope_company uuid;
BEGIN
  IF TG_TABLE_NAME = 'employee_role_assignments' THEN
    SELECT company_id INTO employee_company FROM employees WHERE id = NEW.employee_id AND deleted_at IS NULL;
    SELECT organization_id INTO role_company FROM roles WHERE id = NEW.role_id AND deleted_at IS NULL;
    IF employee_company IS NULL OR role_company IS NULL OR employee_company <> role_company THEN
      RAISE EXCEPTION 'employee and role must share tenant ownership';
    END IF;
  ELSIF TG_TABLE_NAME = 'role_permission_grants' THEN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id=NEW.role_id AND deleted_at IS NULL)
       OR NOT EXISTS (SELECT 1 FROM permissions WHERE id=NEW.permission_id) THEN
      RAISE EXCEPTION 'role and permission grant targets must exist';
    END IF;
  ELSE
    SELECT company_id INTO employee_company FROM employees WHERE id = NEW.employee_id AND deleted_at IS NULL;
    IF employee_company IS NULL OR NOT EXISTS (SELECT 1 FROM permissions WHERE id=NEW.permission_id) THEN
      RAISE EXCEPTION 'scope grant targets must exist';
    END IF;
    IF NEW.scope IN ('TEAM','DEPARTMENT','REGION') AND NEW.scope_organization_id IS NULL THEN
      RAISE EXCEPTION 'typed scope grant requires an organization anchor';
    END IF;
    IF NEW.scope IN ('SELF','COMPANY','GROUP') AND NEW.scope_organization_id IS NOT NULL THEN
      RAISE EXCEPTION 'unanchored scope may not specify an organization anchor';
    END IF;
    IF NEW.scope_organization_id IS NOT NULL THEN
      SELECT owner_organization_id INTO scope_company FROM organizations
      WHERE id=NEW.scope_organization_id AND deleted_at IS NULL;
      IF scope_company IS DISTINCT FROM employee_company THEN
        RAISE EXCEPTION 'scope organization must share tenant ownership';
      END IF;
      IF (SELECT organization_type FROM organizations WHERE id=NEW.scope_organization_id) <> NEW.scope::text THEN
        RAISE EXCEPTION 'scope organization type does not match scope';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER employee_role_assignments_tenant BEFORE INSERT OR UPDATE ON employee_role_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_authorization_tenant();
CREATE TRIGGER role_permission_grants_tenant BEFORE INSERT OR UPDATE ON role_permission_grants
FOR EACH ROW EXECUTE FUNCTION enforce_authorization_tenant();
CREATE TRIGGER data_scope_grants_tenant BEFORE INSERT OR UPDATE ON data_scope_grants
FOR EACH ROW EXECUTE FUNCTION enforce_authorization_tenant();

CREATE OR REPLACE FUNCTION reject_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit events are immutable'; END $$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
