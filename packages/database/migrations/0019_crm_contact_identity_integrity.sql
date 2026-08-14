-- Reject empty or malformed normalized contact identities even when SQL bypasses the API.
ALTER TABLE customer_contacts
  ADD CONSTRAINT customer_contact_email_identity_valid CHECK (
    normalized_email IS NULL OR normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  ADD CONSTRAINT customer_contact_phone_identity_valid CHECK (
    normalized_phone IS NULL OR normalized_phone ~ '^\+?[0-9]{7,15}$'
  );
