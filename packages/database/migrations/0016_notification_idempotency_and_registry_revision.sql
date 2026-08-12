-- Reviewer hardening: bind notification retries to their normalized request and
-- treat the business object definition version as its state revision.
ALTER TABLE notifications
  ADD COLUMN normalized_recipients uuid[],
  ADD COLUMN semantic_payload jsonb;

UPDATE notifications n
SET normalized_recipients = ARRAY(
      SELECT r.employee_id
      FROM notification_recipients r
      WHERE r.tenant_id = n.tenant_id AND r.notification_id = n.id
      ORDER BY r.employee_id
    ),
    semantic_payload = jsonb_build_object(
      'kind', n.kind,
      'title', n.title,
      'message', n.message,
      'subjectType', n.subject_type,
      'subjectId', n.subject_id
    );

ALTER TABLE notifications
  ALTER COLUMN normalized_recipients SET NOT NULL,
  ALTER COLUMN semantic_payload SET NOT NULL,
  ADD CONSTRAINT notifications_normalized_recipients_nonempty
    CHECK (cardinality(normalized_recipients) > 0),
  ADD CONSTRAINT notifications_semantic_payload_object
    CHECK (jsonb_typeof(semantic_payload) = 'object');
