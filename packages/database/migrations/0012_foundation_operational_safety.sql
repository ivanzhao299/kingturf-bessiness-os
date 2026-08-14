-- Durable, fenced attachment I/O. Enum additions are append-only PostgreSQL changes.
ALTER TYPE attachment_state ADD VALUE 'DELETE_PENDING';
