-- Governed document review, independent approval, and approved-version locking.
INSERT INTO permissions(capability,description) VALUES
  ('business-document:approve','Independently approve or reject an online business document')
ON CONFLICT(capability) DO NOTHING;

ALTER TABLE business_documents DROP CONSTRAINT business_documents_state_check;
ALTER TABLE business_documents ADD CONSTRAINT business_documents_state_check
  CHECK(state IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','ARCHIVED'));

CREATE TABLE business_document_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  action text NOT NULL CHECK(action IN ('SUBMITTED','APPROVED','REJECTED')),
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 2 AND 500),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(document_id,tenant_id) REFERENCES business_documents(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);

CREATE INDEX business_document_review_events_idx
  ON business_document_review_events(tenant_id,document_id,created_at DESC);

CREATE TRIGGER business_document_review_events_immutable
  BEFORE UPDATE OR DELETE ON business_document_review_events
  FOR EACH ROW EXECUTE FUNCTION protect_business_document_version();

INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT DISTINCT rp.role_code,p.id
FROM atomic_role_template_permissions rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:approve'
WHERE existing.capability IN ('quote:approve','contract:approve')
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT DISTINCT rp.role_id,p.id,NULL::text[],rp.data_scopes
FROM role_permission_grants rp
JOIN permissions existing ON existing.id=rp.permission_id
JOIN permissions p ON p.capability='business-document:approve'
WHERE existing.capability IN ('quote:approve','contract:approve')
ON CONFLICT(role_id,permission_id) DO NOTHING;
