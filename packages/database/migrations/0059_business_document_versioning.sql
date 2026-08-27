-- Application-native business documents with append-only version history.
INSERT INTO permissions(capability,description) VALUES
  ('business-document:read','Read online business documents and version history'),
  ('business-document:manage','Create and version online business documents')
ON CONFLICT(capability) DO NOTHING;

CREATE TABLE business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  template_key text NOT NULL CHECK(template_key ~ '^[0-9]{2}-[a-z0-9-]{2,80}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  route text NOT NULL CHECK(route ~ '^[a-z][a-z0-9-]{1,63}$'),
  subject_type text CHECK(subject_type IS NULL OR subject_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  subject_id uuid,
  state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ACTIVE','ARCHIVED')),
  current_version integer NOT NULL DEFAULT 1 CHECK(current_version > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((subject_type IS NULL) = (subject_id IS NULL))
);

CREATE TABLE business_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
  change_summary text NOT NULL CHECK(length(change_summary) BETWEEN 1 AND 500),
  canonical_hash char(64) NOT NULL CHECK(canonical_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,document_id,version),
  FOREIGN KEY(document_id,tenant_id) REFERENCES business_documents(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);

CREATE INDEX business_documents_route_idx
  ON business_documents(tenant_id,route,updated_at DESC) WHERE state <> 'ARCHIVED';
CREATE INDEX business_documents_subject_idx
  ON business_documents(tenant_id,subject_type,subject_id,updated_at DESC)
  WHERE subject_id IS NOT NULL AND state <> 'ARCHIVED';

CREATE FUNCTION protect_business_document_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'business document versions are append-only';
END $$;
CREATE TRIGGER business_document_versions_immutable
  BEFORE UPDATE OR DELETE ON business_document_versions
  FOR EACH ROW EXECUTE FUNCTION protect_business_document_version();

INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT DISTINCT rp.role_code,p.id
FROM atomic_role_template_permissions rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:read'
WHERE existing.capability='attachment:read'
ON CONFLICT DO NOTHING;

INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT DISTINCT rp.role_code,p.id
FROM atomic_role_template_permissions rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:manage'
WHERE existing.capability='attachment:manage'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT DISTINCT rp.role_id,p.id,NULL::text[],rp.data_scopes
FROM role_permission_grants rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:read'
WHERE existing.capability='attachment:read'
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT DISTINCT rp.role_id,p.id,NULL::text[],rp.data_scopes
FROM role_permission_grants rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:manage'
WHERE existing.capability='attachment:manage'
ON CONFLICT(role_id,permission_id) DO NOTHING;
