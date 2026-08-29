CREATE TABLE website_lead_ingests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  external_ref text NOT NULL CHECK(length(external_ref) BETWEEN 1 AND 128),
  contact_name text NOT NULL CHECK(length(contact_name) BETWEEN 1 AND 120),
  company_name text,
  contact text NOT NULL CHECK(length(contact) BETWEEN 1 AND 200),
  country text,
  application text NOT NULL CHECK(length(application) BETWEEN 1 AND 120),
  project_brief text,
  locale text NOT NULL CHECK(locale IN ('zh','en')),
  source_page text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,external_ref),
  UNIQUE(lead_id,tenant_id),
  FOREIGN KEY(lead_id,tenant_id) REFERENCES leads(id,tenant_id)
);

CREATE INDEX website_lead_ingests_received_idx
  ON website_lead_ingests(tenant_id,received_at DESC,id);
