-- Governed customer-facing document translation and multi-channel delivery.
-- Secrets are never stored here: secret_reference points to an operator-managed
-- environment/vault entry and configuration is restricted to non-secret metadata.
INSERT INTO permissions(capability,description) VALUES
  ('business-document:send','Send approved online business documents to customers'),
  ('business-document:translate','Create governed translations of online business documents'),
  ('business-document:configure','Configure document communication connectors'),
  ('business-document:audit','Read company-wide document creation and delivery audit logs')
ON CONFLICT(capability) DO NOTHING;

CREATE TABLE business_document_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  connector text NOT NULL CHECK(connector IN(
    'EMAIL','WECHAT_WORK','WHATSAPP_BUSINESS','MICROSOFT_TEAMS','TELEGRAM','LINE','TRANSLATION'
  )),
  provider text NOT NULL CHECK(provider ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 100),
  sender_identity text CHECK(sender_identity IS NULL OR length(trim(sender_identity)) BETWEEN 2 AND 200),
  secret_reference text CHECK(
    secret_reference IS NULL OR secret_reference ~ '^KINGTURF_CONNECTOR_[A-Z0-9_]{3,96}$'
  ),
  configuration jsonb NOT NULL DEFAULT '{}' CHECK(
    jsonb_typeof(configuration)='object' AND pg_column_size(configuration)<=8192
  ),
  status text NOT NULL DEFAULT 'UNCONFIGURED'
    CHECK(status IN('UNCONFIGURED','READY','DISABLED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  configured_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,connector),
  UNIQUE(id,tenant_id),
  FOREIGN KEY(configured_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK(status<>'READY' OR secret_reference IS NOT NULL)
);

CREATE TABLE business_document_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  source_version integer NOT NULL CHECK(source_version>0),
  source_hash char(64) NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
  target_locale text NOT NULL CHECK(target_locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  provider text NOT NULL CHECK(provider IN('MANUAL','CONNECTED_PROVIDER')),
  status text NOT NULL CHECK(status IN('QUEUED','READY')),
  content jsonb CHECK(content IS NULL OR jsonb_typeof(content)='object'),
  requested_by uuid NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id) REFERENCES business_documents(id,tenant_id),
  FOREIGN KEY(tenant_id,document_id,source_version)
    REFERENCES business_document_versions(tenant_id,document_id,version),
  FOREIGN KEY(requested_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='READY')=(content IS NOT NULL)),
  CHECK(provider<>'MANUAL' OR status='READY')
);

CREATE TABLE business_document_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  document_version integer NOT NULL CHECK(document_version>0),
  translation_id uuid,
  connector_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN(
    'EMAIL','WECHAT_WORK','WHATSAPP_BUSINESS','MICROSOFT_TEAMS','TELEGRAM','LINE'
  )),
  recipient_name text NOT NULL CHECK(length(trim(recipient_name)) BETWEEN 1 AND 200),
  recipient_address text NOT NULL CHECK(length(trim(recipient_address)) BETWEEN 1 AND 320),
  recipient_hash char(64) NOT NULL CHECK(recipient_hash ~ '^[0-9a-f]{64}$'),
  subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 200),
  message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 4000),
  request_hash char(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'QUEUED'
    CHECK(status IN('QUEUED','DELIVERED','RETRY','FAILED')),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 128),
  requested_by uuid NOT NULL,
  correlation_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE(tenant_id,idempotency_key),
  UNIQUE(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id) REFERENCES business_documents(id,tenant_id),
  FOREIGN KEY(tenant_id,document_id,document_version)
    REFERENCES business_document_versions(tenant_id,document_id,version),
  FOREIGN KEY(translation_id,tenant_id) REFERENCES business_document_translations(id,tenant_id),
  FOREIGN KEY(connector_id,tenant_id) REFERENCES business_document_connectors(id,tenant_id),
  FOREIGN KEY(requested_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='DELIVERED')=(delivered_at IS NOT NULL))
);

CREATE TABLE business_document_dispatch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  dispatch_id uuid NOT NULL,
  attempt integer NOT NULL CHECK(attempt>0),
  outcome text NOT NULL CHECK(outcome IN('DELIVERED','RETRY','FAILED','UNCONFIGURED')),
  provider_reference text,
  error_code text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,dispatch_id,attempt),
  FOREIGN KEY(dispatch_id,tenant_id) REFERENCES business_document_dispatches(id,tenant_id)
);

CREATE INDEX business_document_translations_document_idx
  ON business_document_translations(tenant_id,document_id,source_version,created_at DESC);
CREATE INDEX business_document_dispatches_document_idx
  ON business_document_dispatches(tenant_id,document_id,requested_at DESC);
CREATE INDEX business_document_dispatches_status_idx
  ON business_document_dispatches(tenant_id,status,requested_at);

CREATE FUNCTION protect_business_document_translation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status<>'QUEUED' OR NEW.status<>'READY' OR NEW.content IS NULL
    OR NEW.tenant_id<>OLD.tenant_id OR NEW.document_id<>OLD.document_id
    OR NEW.source_version<>OLD.source_version OR NEW.source_hash<>OLD.source_hash
    OR NEW.target_locale<>OLD.target_locale OR NEW.provider<>OLD.provider
    OR NEW.requested_by<>OLD.requested_by OR NEW.correlation_id<>OLD.correlation_id
    OR NEW.created_at<>OLD.created_at
  THEN RAISE EXCEPTION 'business document translation may only complete once'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER business_document_translations_delete_immutable
  BEFORE DELETE ON business_document_translations
  FOR EACH ROW EXECUTE FUNCTION protect_business_document_version();
CREATE TRIGGER business_document_translations_update_guard
  BEFORE UPDATE ON business_document_translations
  FOR EACH ROW EXECUTE FUNCTION protect_business_document_translation();
CREATE TRIGGER business_document_dispatch_attempts_immutable
  BEFORE UPDATE OR DELETE ON business_document_dispatch_attempts
  FOR EACH ROW EXECUTE FUNCTION protect_business_document_version();

WITH grants(role_code,capability) AS (VALUES
  ('KT_OPPORTUNITY_OWNER','business-document:send'),
  ('KT_OPPORTUNITY_OWNER','business-document:translate'),
  ('KT_SOLUTION_ENGINEER','business-document:translate'),
  ('KT_QUOTE_EDITOR','business-document:translate'),
  ('KT_QUOTE_ISSUER','business-document:send'),
  ('KT_CONTRACT_SPECIALIST','business-document:translate'),
  ('KT_CONTRACT_SPECIALIST','business-document:send'),
  ('KT_ORDER_OPERATOR','business-document:send'),
  ('KT_PROCUREMENT_BUYER','business-document:send'),
  ('KT_QUALITY_MANAGER','business-document:send')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT grants.role_code,p.id FROM grants JOIN permissions p ON p.capability=grants.capability
ON CONFLICT DO NOTHING;

WITH grants(role_code,capability) AS (VALUES
  ('KT_OPPORTUNITY_OWNER','business-document:send'),
  ('KT_OPPORTUNITY_OWNER','business-document:translate'),
  ('KT_SOLUTION_ENGINEER','business-document:translate'),
  ('KT_QUOTE_EDITOR','business-document:translate'),
  ('KT_QUOTE_ISSUER','business-document:send'),
  ('KT_CONTRACT_SPECIALIST','business-document:translate'),
  ('KT_CONTRACT_SPECIALIST','business-document:send'),
  ('KT_ORDER_OPERATOR','business-document:send'),
  ('KT_PROCUREMENT_BUYER','business-document:send'),
  ('KT_QUALITY_MANAGER','business-document:send')
)
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL::text[],ARRAY['COMPANY']::data_scope[]
FROM roles r JOIN grants ON grants.role_code=r.code JOIN permissions p ON p.capability=grants.capability
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL::text[],ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN'])
  AND p.capability=ANY(ARRAY[
    'business-document:send','business-document:translate',
    'business-document:configure','business-document:audit'
  ])
ON CONFLICT(role_id,permission_id) DO NOTHING;
