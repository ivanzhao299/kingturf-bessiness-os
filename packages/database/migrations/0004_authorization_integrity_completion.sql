-- Complete hierarchy and direct DataScope integrity without changing released migrations.

-- PostgreSQL's default UNIQUE semantics treat NULL values as distinct. The
-- historical constraint therefore permits duplicate SELF/COMPANY/GROUP grants,
-- whose organization anchor is intentionally NULL. Keep the historical
-- migration immutable, deterministically retain the earliest grant, and close
-- that gap with a partial unique index.
WITH ranked_unanchored_grants AS (
  SELECT id, row_number() OVER (
    PARTITION BY employee_id, permission_id, scope
    ORDER BY created_at, id
  ) AS duplicate_rank
  FROM data_scope_grants
  WHERE scope_organization_id IS NULL
)
DELETE FROM data_scope_grants grants
USING ranked_unanchored_grants ranked
WHERE grants.id=ranked.id AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX data_scope_grants_unanchored_unique
ON data_scope_grants(employee_id, permission_id, scope)
WHERE scope_organization_id IS NULL;

CREATE OR REPLACE FUNCTION protect_organization_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reaches_self boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kingturf.organization_hierarchy'));
  IF TG_OP = 'UPDATE' AND OLD.owner_organization_id IS DISTINCT FROM NEW.owner_organization_id THEN
    RAISE EXCEPTION 'organization ownership is immutable';
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organizations p
    WHERE p.id=NEW.parent_id
      AND (p.id=NEW.owner_organization_id OR p.owner_organization_id=NEW.owner_organization_id)
      AND p.active AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'parent must share organization ownership';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    WITH RECURSIVE parents(id,parent_id,path) AS (
      SELECT p.id,p.parent_id,ARRAY[p.id] FROM organizations p WHERE p.id=NEW.parent_id
      UNION ALL
      SELECT p.id,p.parent_id,parents.path || p.id
      FROM parents JOIN organizations p ON p.id=parents.parent_id
      WHERE NOT p.id=ANY(parents.path)
    ) SELECT bool_or(id=NEW.id) INTO reaches_self FROM parents;
    IF COALESCE(reaches_self,false) THEN RAISE EXCEPTION 'organization hierarchy cycle'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION maintain_organization_scope_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Hierarchy writes are serialized by the BEFORE trigger. Rebuilding the
  -- materialized closure makes root moves and subtree reparents remove every
  -- obsolete path as well as insert every new path with the exact depth.
  DELETE FROM organization_scope_relationships;
  WITH RECURSIVE closure(ancestor_id,descendant_id,depth,path) AS (
    SELECT id,id,0,ARRAY[id] FROM organizations
    UNION ALL
    SELECT closure.ancestor_id,child.id,closure.depth+1,closure.path || child.id
    FROM closure JOIN organizations child ON child.parent_id=closure.descendant_id
    WHERE NOT child.id=ANY(closure.path)
  )
  INSERT INTO organization_scope_relationships(ancestor_id,descendant_id,depth)
  SELECT ancestor_id,descendant_id,min(depth) FROM closure
  GROUP BY ancestor_id,descendant_id;
  RETURN NEW;
END $$;

-- Rebuild once to remove any stale rows produced by an older trigger version.
DELETE FROM organization_scope_relationships;
WITH RECURSIVE closure(ancestor_id,descendant_id,depth,path) AS (
  SELECT id,id,0,ARRAY[id] FROM organizations
  UNION ALL
  SELECT closure.ancestor_id,child.id,closure.depth+1,closure.path || child.id
  FROM closure JOIN organizations child ON child.parent_id=closure.descendant_id
  WHERE NOT child.id=ANY(closure.path)
)
INSERT INTO organization_scope_relationships(ancestor_id,descendant_id,depth)
SELECT ancestor_id,descendant_id,min(depth) FROM closure
GROUP BY ancestor_id,descendant_id;

CREATE OR REPLACE FUNCTION enforce_authorization_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employee_company uuid; role_company uuid; scope_company uuid; scope_type text; scope_active boolean;
BEGIN
  IF TG_TABLE_NAME = 'employee_role_assignments' THEN
    SELECT company_id INTO employee_company FROM employees WHERE id=NEW.employee_id AND active AND deleted_at IS NULL;
    SELECT organization_id INTO role_company FROM roles WHERE id=NEW.role_id AND deleted_at IS NULL;
    IF employee_company IS NULL OR role_company IS NULL OR employee_company<>role_company THEN
      RAISE EXCEPTION 'employee and role must share tenant ownership';
    END IF;
  ELSIF TG_TABLE_NAME = 'role_permission_grants' THEN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id=NEW.role_id AND deleted_at IS NULL)
       OR NOT EXISTS (SELECT 1 FROM permissions WHERE id=NEW.permission_id) THEN
      RAISE EXCEPTION 'role and permission grant targets must exist';
    END IF;
  ELSE
    SELECT e.company_id INTO employee_company
    FROM employees e JOIN organizations c ON c.id=e.company_id
    WHERE e.id=NEW.employee_id AND e.active AND e.deleted_at IS NULL
      AND c.organization_type='COMPANY' AND c.active AND c.deleted_at IS NULL;
    IF employee_company IS NULL OR NOT EXISTS (SELECT 1 FROM permissions WHERE id=NEW.permission_id) THEN
      RAISE EXCEPTION 'scope grant targets must exist and be active';
    END IF;
    IF NEW.scope IN ('TEAM','DEPARTMENT','REGION') AND NEW.scope_organization_id IS NULL THEN
      RAISE EXCEPTION 'typed scope grant requires an organization anchor';
    END IF;
    IF NEW.scope IN ('SELF','COMPANY','GROUP') AND NEW.scope_organization_id IS NOT NULL THEN
      RAISE EXCEPTION 'unanchored scope may not specify an organization anchor';
    END IF;
    IF NEW.scope_organization_id IS NOT NULL THEN
      SELECT owner_organization_id,organization_type,active AND deleted_at IS NULL
      INTO scope_company,scope_type,scope_active FROM organizations WHERE id=NEW.scope_organization_id;
      IF scope_company IS DISTINCT FROM employee_company THEN RAISE EXCEPTION 'scope organization must share tenant ownership'; END IF;
      IF scope_type IS DISTINCT FROM NEW.scope::text THEN RAISE EXCEPTION 'scope organization type does not match scope'; END IF;
      IF NOT COALESCE(scope_active,false) THEN RAISE EXCEPTION 'scope organization must be active'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- reject_audit_event_mutation and its trigger remain in force from 0003.
