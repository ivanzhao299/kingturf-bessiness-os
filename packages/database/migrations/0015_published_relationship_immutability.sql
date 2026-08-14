-- Published business-object versions include immutable relationship metadata.
CREATE FUNCTION prevent_published_business_object_relationship_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM business_object_versions
    WHERE id = COALESCE(OLD.version_id, NEW.version_id)
      AND tenant_id = COALESCE(OLD.tenant_id, NEW.tenant_id)
      AND status = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'published business object relationships are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER business_object_relationships_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON business_object_relationships
FOR EACH ROW EXECUTE FUNCTION prevent_published_business_object_relationship_mutation();
