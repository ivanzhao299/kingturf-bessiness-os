-- JTF-P0-E15: generic, data-only business object schemas.
CREATE TABLE business_object_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), code text NOT NULL CHECK(code ~ '^[A-Z][A-Z0-9_-]{0,63}$'), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 128),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(tenant_id,code), UNIQUE(id,tenant_id)
);
CREATE TABLE business_object_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, definition_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), status definition_status NOT NULL DEFAULT 'DRAFT',
 schema jsonb NOT NULL CHECK(jsonb_typeof(schema)='object' AND pg_column_size(schema)<=32768), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 UNIQUE(definition_id,version), UNIQUE(id,tenant_id), FOREIGN KEY(definition_id,tenant_id) REFERENCES business_object_definitions(id,tenant_id), CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE business_object_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, version_id uuid NOT NULL, field_key text NOT NULL CHECK(field_key ~ '^[a-z][a-zA-Z0-9_]{0,63}$'), target_definition_id uuid NOT NULL,
 cardinality text NOT NULL CHECK(cardinality IN('ONE','MANY')), UNIQUE(version_id,field_key), FOREIGN KEY(version_id,tenant_id) REFERENCES business_object_versions(id,tenant_id), FOREIGN KEY(target_definition_id,tenant_id) REFERENCES business_object_definitions(id,tenant_id)
);
CREATE TRIGGER protect_business_object_published BEFORE UPDATE ON business_object_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_mutation();
CREATE TRIGGER protect_business_object_published_delete BEFORE DELETE ON business_object_versions FOR EACH ROW EXECUTE FUNCTION reject_published_row_delete();
INSERT INTO permissions(capability,description) VALUES ('business-object:read','Read business object schemas'),('business-object:manage','Create and publish business object schemas') ON CONFLICT(capability) DO NOTHING;
