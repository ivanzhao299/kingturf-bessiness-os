-- Consumer delivery is independent: one consumer cannot suppress another.
ALTER TYPE attachment_state ADD VALUE 'UPLOADING';
CREATE TABLE event_consumer_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, consumer_name text NOT NULL CHECK(length(consumer_name) BETWEEN 1 AND 128), event_id uuid NOT NULL,
 state outbox_state NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 claimed_by text, last_error_code text, delivered_at timestamptz, UNIQUE(tenant_id,consumer_name,event_id), FOREIGN KEY(event_id,tenant_id) REFERENCES domain_event_outbox(id,tenant_id)
);
CREATE INDEX event_consumer_delivery_claim_idx ON event_consumer_deliveries(consumer_name,state,available_at,lease_until);
ALTER TABLE event_delivery_attempts ADD COLUMN consumer_name text NOT NULL DEFAULT 'legacy';
ALTER TABLE event_delivery_attempts DROP CONSTRAINT event_delivery_attempts_event_id_attempt_key;
ALTER TABLE event_delivery_attempts ADD UNIQUE(tenant_id,event_id,consumer_name,attempt);
