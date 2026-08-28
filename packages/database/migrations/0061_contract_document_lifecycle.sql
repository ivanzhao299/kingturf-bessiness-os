-- Unified purchase/sales contract file, OCR review, and electronic-signing lifecycle.
CREATE TYPE contract_business_type AS ENUM('SALES','PURCHASE');
CREATE TYPE contract_document_state AS ENUM('UPLOADED','OCR_PROCESSING','OCR_REVIEW','READY_TO_SIGN','SIGNING','SIGNED','REJECTED','VOID');
CREATE TYPE contract_signature_state AS ENUM('DRAFT','SENT','VIEWED','SIGNED','DECLINED','EXPIRED','VOID');

CREATE TABLE contract_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 business_type contract_business_type NOT NULL, subject_type text NOT NULL CHECK(subject_type IN('contract-revision','purchase-order')),
 subject_id uuid NOT NULL, attachment_id uuid NOT NULL, title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 255),
 state contract_document_state NOT NULL DEFAULT 'UPLOADED', ocr_provider text, ocr_text text,
 extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb, ocr_confidence numeric(5,4) CHECK(ocr_confidence BETWEEN 0 AND 1),
 ocr_completed_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,tenant_id), UNIQUE(tenant_id,subject_type,subject_id,attachment_id),
 FOREIGN KEY(attachment_id,tenant_id) REFERENCES attachments(id,tenant_id),
 FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id), FOREIGN KEY(reviewed_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE INDEX contract_documents_subject_idx ON contract_documents(tenant_id,subject_type,subject_id,created_at DESC);

CREATE TABLE contract_ocr_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, contract_document_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN('REQUESTED','SUCCEEDED','FAILED','REVIEWED')),
 provider text NOT NULL, payload jsonb NOT NULL, payload_hash char(64) NOT NULL,
 actor_id uuid NOT NULL, correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,tenant_id), FOREIGN KEY(contract_document_id,tenant_id) REFERENCES contract_documents(id,tenant_id),
 FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id)
);

CREATE TABLE contract_signature_envelopes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, contract_document_id uuid NOT NULL,
 provider text NOT NULL, provider_envelope_id text NOT NULL, state contract_signature_state NOT NULL DEFAULT 'DRAFT',
 signing_order text NOT NULL DEFAULT 'SEQUENTIAL' CHECK(signing_order IN('SEQUENTIAL','PARALLEL')),
 expires_at timestamptz, signed_attachment_id uuid, evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 evidence_hash char(64), sent_at timestamptz, completed_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,tenant_id), UNIQUE(tenant_id,provider,provider_envelope_id),
 FOREIGN KEY(contract_document_id,tenant_id) REFERENCES contract_documents(id,tenant_id),
 FOREIGN KEY(signed_attachment_id,tenant_id) REFERENCES attachments(id,tenant_id),
 FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE contract_signature_signers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, envelope_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0), role text NOT NULL, name text NOT NULL, contact text NOT NULL,
 status contract_signature_state NOT NULL DEFAULT 'DRAFT', signed_at timestamptz,
 UNIQUE(id,tenant_id), UNIQUE(tenant_id,envelope_id,sequence),
 FOREIGN KEY(envelope_id,tenant_id) REFERENCES contract_signature_envelopes(id,tenant_id)
);
CREATE TABLE contract_signature_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, envelope_id uuid NOT NULL,
 provider_event_id text NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL, payload_hash char(64) NOT NULL,
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,tenant_id), UNIQUE(tenant_id,provider_event_id),
 FOREIGN KEY(envelope_id,tenant_id) REFERENCES contract_signature_envelopes(id,tenant_id)
);

INSERT INTO permissions(capability,description) VALUES
 ('contract-document:read','Read purchase and sales contract files and lifecycle'),
 ('contract-document:manage','Upload and manage contract files'),
 ('contract-ocr:operate','Request and submit OCR extraction'),
 ('contract-ocr:review','Review OCR text and extracted fields'),
 ('contract-signature:send','Create and send electronic signature envelopes'),
 ('contract-signature:confirm','Confirm signed evidence and archive signed originals')
ON CONFLICT(capability) DO NOTHING;

WITH grants(role_code,capability) AS (VALUES
 ('KT_CONTRACT_SPECIALIST','contract-document:read'),('KT_CONTRACT_SPECIALIST','contract-document:manage'),
 ('KT_CONTRACT_SPECIALIST','contract-ocr:operate'),('KT_CONTRACT_SPECIALIST','contract-ocr:review'),
 ('KT_CONTRACT_SIGNATORY','contract-document:read'),('KT_CONTRACT_SIGNATORY','contract-signature:send'),('KT_CONTRACT_SIGNATORY','contract-signature:confirm'),
 ('KT_PROCUREMENT_BUYER','contract-document:read'),('KT_PROCUREMENT_BUYER','contract-document:manage'),
 ('KT_PROCUREMENT_BUYER','contract-ocr:operate'),('KT_PROCUREMENT_BUYER','contract-ocr:review'),('KT_PROCUREMENT_BUYER','contract-signature:send'),
 ('KT_SYSTEM_AUDITOR','contract-document:read'),('KT_EXECUTIVE_VIEWER','contract-document:read')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT g.role_code,p.id FROM grants g JOIN permissions p ON p.capability=g.capability
ON CONFLICT DO NOTHING;
SELECT provision_atomic_business_roles(id) FROM organizations WHERE organization_type='COMPANY' AND deleted_at IS NULL;
