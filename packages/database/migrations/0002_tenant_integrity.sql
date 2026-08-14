-- Enforce tenant ownership independently of API/repository checks.
CREATE OR REPLACE FUNCTION protect_organization_ownership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP = 'UPDATE' AND OLD.owner_organization_id IS DISTINCT FROM NEW.owner_organization_id THEN RAISE EXCEPTION 'organization ownership is immutable'; END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations p WHERE p.id=NEW.parent_id AND p.owner_organization_id=NEW.owner_organization_id AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'parent must share organization ownership'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS NOT NULL AND EXISTS (SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=NEW.id AND descendant_id=NEW.parent_id) THEN RAISE EXCEPTION 'organization hierarchy cycle'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER organizations_integrity ON organizations;
CREATE TRIGGER organizations_integrity BEFORE INSERT OR UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION protect_organization_ownership();

ALTER TABLE organizations
  ADD CONSTRAINT organizations_id_owner_unique UNIQUE (id, owner_organization_id);

ALTER TABLE employees
  ADD CONSTRAINT employees_organization_owner_fk
  FOREIGN KEY (organization_id, company_id)
  REFERENCES organizations(id, owner_organization_id);
