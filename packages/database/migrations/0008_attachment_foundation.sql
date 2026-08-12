-- JTF-P0-E13: bytes remain outside PostgreSQL; only safe metadata is stored here.
CREATE TYPE attachment_state AS ENUM('PENDING','AVAILABLE','DELETED');
CREATE TABLE attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), opaque_key text NOT NULL CHECK(opaque_key ~ '^[0-9a-f]{2}/[0-9a-f-]{36}$' AND length(opaque_key)<=80),
 original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 255 AND original_name !~ E'[\\\\/\\x00]'), mime_type text NOT NULL CHECK(mime_type IN('application/pdf','image/png','image/jpeg','text/plain','text/csv')),
 expected_size bigint NOT NULL CHECK(expected_size BETWEEN 1 AND 26214400), actual_size bigint, expected_checksum char(64) NOT NULL CHECK(expected_checksum ~ '^[0-9a-f]{64}$'), actual_checksum char(64),
 state attachment_state NOT NULL DEFAULT 'PENDING', version integer NOT NULL DEFAULT 1 CHECK(version>0), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz, deleted_at timestamptz,
 UNIQUE(tenant_id,opaque_key), UNIQUE(id,tenant_id)
);
CREATE TABLE attachment_bindings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, attachment_id uuid NOT NULL, object_type text NOT NULL CHECK(object_type ~ '^[a-z][a-z0-9_.-]{0,63}$'), object_id uuid NOT NULL,
 bound_by uuid NOT NULL, bound_at timestamptz NOT NULL DEFAULT now(), unbound_at timestamptz, UNIQUE(tenant_id,attachment_id,object_type,object_id), FOREIGN KEY(attachment_id,tenant_id) REFERENCES attachments(id,tenant_id)
);
CREATE INDEX attachment_object_idx ON attachment_bindings(tenant_id,object_type,object_id) WHERE unbound_at IS NULL;
INSERT INTO permissions(capability,description) VALUES ('attachment:read','Download authorized attachments'),('attachment:manage','Create and bind attachments') ON CONFLICT(capability) DO NOTHING;
