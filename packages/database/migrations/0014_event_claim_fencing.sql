-- A lease generation token fences stale handlers even when worker names are reused.
ALTER TABLE event_consumer_deliveries ADD COLUMN claim_token uuid;
UPDATE event_consumer_deliveries SET claim_token=gen_random_uuid() WHERE state='PROCESSING';
ALTER TABLE event_consumer_deliveries ADD CONSTRAINT event_consumer_delivery_claim_consistent CHECK (
  (state='PROCESSING' AND claim_token IS NOT NULL AND claimed_by IS NOT NULL AND lease_until IS NOT NULL)
  OR (state<>'PROCESSING' AND claim_token IS NULL AND claimed_by IS NULL AND lease_until IS NULL)
);

