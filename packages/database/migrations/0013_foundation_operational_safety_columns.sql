-- Kept separate so PostgreSQL commits the append-only enum value before it is referenced.
ALTER TABLE attachments
  ADD COLUMN upload_token uuid,
  ADD COLUMN upload_lease_until timestamptz,
  ADD COLUMN actual_storage_key text;
ALTER TABLE attachments ADD CONSTRAINT attachments_actual_storage_key_safe CHECK (
  actual_storage_key IS NULL OR (
    actual_storage_key ~ '^[0-9a-f]{2}/[0-9a-f-]{36}\.[0-9a-f-]{36}$'
    AND length(actual_storage_key) <= 120
  )
);
ALTER TABLE attachments ADD CONSTRAINT attachments_upload_lease_consistent CHECK (
  (state = 'UPLOADING' AND upload_token IS NOT NULL AND upload_lease_until IS NOT NULL)
  OR (state <> 'UPLOADING' AND upload_token IS NULL AND upload_lease_until IS NULL)
);
CREATE INDEX attachments_upload_recovery_idx
  ON attachments(tenant_id, upload_lease_until) WHERE state = 'UPLOADING';
CREATE INDEX attachments_delete_retry_idx
  ON attachments(tenant_id, created_at) WHERE state = 'DELETE_PENDING';
