-- JTF-P0-E12/E14: tenant-safe notifications and transactional event outbox.
CREATE TYPE outbox_state AS ENUM('PENDING','PROCESSING','DELIVERED','DEAD_LETTER');
CREATE TABLE domain_event_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 128), event_version integer NOT NULL CHECK(event_version>0),
 aggregate_type text NOT NULL CHECK(length(aggregate_type) BETWEEN 1 AND 64), aggregate_id uuid NOT NULL, aggregate_version integer NOT NULL CHECK(aggregate_version>0), occurred_at timestamptz NOT NULL,
 actor_id uuid, correlation_id uuid NOT NULL, causation_id uuid, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND pg_column_size(payload)<=16384), state outbox_state NOT NULL DEFAULT 'PENDING',
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, claimed_by text, last_error_code text,
 delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,event_type,aggregate_id,aggregate_version), UNIQUE(id,tenant_id)
);
CREATE INDEX domain_event_claim_idx ON domain_event_outbox(state,available_at,lease_until,created_at);
CREATE TABLE event_consumer_checkpoints (
 tenant_id uuid NOT NULL, consumer_name text NOT NULL CHECK(length(consumer_name) BETWEEN 1 AND 128), event_id uuid NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,consumer_name,event_id), FOREIGN KEY(event_id,tenant_id) REFERENCES domain_event_outbox(id,tenant_id)
);
CREATE TABLE event_delivery_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, event_id uuid NOT NULL, attempt integer NOT NULL CHECK(attempt>0), outcome text NOT NULL CHECK(outcome IN('SUCCESS','RETRY','DEAD_LETTER')),
 error_code text, occurred_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,attempt), FOREIGN KEY(event_id,tenant_id) REFERENCES domain_event_outbox(id,tenant_id)
);
CREATE TRIGGER immutable_event_attempts BEFORE UPDATE OR DELETE ON event_delivery_attempts FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER immutable_consumer_checkpoints BEFORE UPDATE OR DELETE ON event_consumer_checkpoints FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

CREATE TYPE notification_channel AS ENUM('IN_APP','EMAIL','SMS','PUSH');
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id), kind text NOT NULL CHECK(length(kind) BETWEEN 1 AND 64), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 message text NOT NULL CHECK(length(message) BETWEEN 1 AND 4000), subject_type text, subject_id uuid, idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 event_id uuid NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,idempotency_key), UNIQUE(id,tenant_id), FOREIGN KEY(event_id,tenant_id) REFERENCES domain_event_outbox(id,tenant_id)
);
CREATE TABLE notification_recipients (
 tenant_id uuid NOT NULL, notification_id uuid NOT NULL, employee_id uuid NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,notification_id,employee_id), FOREIGN KEY(notification_id,tenant_id) REFERENCES notifications(id,tenant_id)
);
CREATE INDEX notification_inbox_idx ON notification_recipients(tenant_id,employee_id,read_at,created_at DESC);
CREATE TABLE notification_preferences (
 tenant_id uuid NOT NULL, employee_id uuid NOT NULL, channel notification_channel NOT NULL, enabled boolean NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,employee_id,channel)
);
CREATE TABLE notification_delivery_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, notification_id uuid NOT NULL, employee_id uuid NOT NULL, channel notification_channel NOT NULL,
 attempt integer NOT NULL CHECK(attempt>0), state text NOT NULL CHECK(state IN('DELIVERED','RETRY','DISABLED','UNCONFIGURED')), error_code text, attempted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,notification_id,employee_id,channel,attempt), FOREIGN KEY(notification_id,tenant_id) REFERENCES notifications(id,tenant_id)
);
CREATE TRIGGER immutable_notification_delivery_attempts BEFORE UPDATE OR DELETE ON notification_delivery_attempts FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

INSERT INTO permissions(capability,description) VALUES
 ('notification:read','Read own notification inbox'),('notification:manage','Create notifications and manage preferences'),('event:operate','Operate event retries and dead letters') ON CONFLICT(capability) DO NOTHING;
