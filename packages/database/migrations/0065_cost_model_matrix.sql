CREATE TABLE cost_specification_models(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES organizations(id),code text NOT NULL,name text NOT NULL,
  product_item_version_id uuid,product_specification jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(product_specification)='object'),
  currency char(3) NOT NULL DEFAULT 'CNY' REFERENCES commercial_currencies(code),default_tax_rate numeric(7,6) NOT NULL DEFAULT 0.13 CHECK(default_tax_rate BETWEEN 0 AND 1),
  active boolean NOT NULL DEFAULT true,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,code),FOREIGN KEY(product_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);

CREATE TABLE cost_specification_factors(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,specification_model_id uuid NOT NULL,factor_code text NOT NULL,factor_name text NOT NULL,
  category text NOT NULL CHECK(category IN('DIRECT_MATERIAL','DIRECT_LABOR','DIRECT_ENERGY','DIRECT_OVERHEAD','FIXED','PERSONNEL','FINANCE','MARKETING','OTHER')),
  source_type text NOT NULL DEFAULT 'MANUAL' CHECK(source_type IN('MANUAL','PURCHASE_ORDER','SUPPLIER_QUOTE')),
  source_item_version_id uuid,quantity numeric(24,6) NOT NULL DEFAULT 1 CHECK(quantity>=0),manual_unit_price_tax_inclusive numeric(24,6) NOT NULL DEFAULT 0 CHECK(manual_unit_price_tax_inclusive>=0),
  tax_rate numeric(7,6) NOT NULL DEFAULT 0.13 CHECK(tax_rate BETWEEN 0 AND 1),adjustable boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,specification_model_id,factor_code),FOREIGN KEY(specification_model_id,tenant_id) REFERENCES cost_specification_models(id,tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(source_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK(source_type='MANUAL' OR source_item_version_id IS NOT NULL)
);

CREATE TABLE cost_matrix_calculations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,specification_model_id uuid NOT NULL,pricing_mode text NOT NULL CHECK(pricing_mode IN('TAX_INCLUSIVE','TAX_EXCLUSIVE')),
  currency char(3) NOT NULL REFERENCES commercial_currencies(code),direct_production_cost numeric(24,6) NOT NULL,reserved_expense_cost numeric(24,6) NOT NULL,total_cost numeric(24,6) NOT NULL,
  factor_trace jsonb NOT NULL CHECK(jsonb_typeof(factor_trace)='array'),calculated_by uuid NOT NULL,idempotency_key text NOT NULL,calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(specification_model_id,tenant_id) REFERENCES cost_specification_models(id,tenant_id),
  FOREIGN KEY(calculated_by,tenant_id) REFERENCES employees(id,company_id)
);

CREATE INDEX cost_specification_factors_model_idx ON cost_specification_factors(tenant_id,specification_model_id,sort_order);
CREATE INDEX cost_matrix_calculations_model_time_idx ON cost_matrix_calculations(tenant_id,specification_model_id,calculated_at DESC);

INSERT INTO permissions(capability,description) VALUES
 ('cost-matrix:read','Read specification cost matrices and calculations'),
 ('cost-matrix:manage','Manage specification cost models and adjustable factors'),
 ('cost-matrix:calculate','Calculate tax inclusive or exclusive specification costs')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY['cost-matrix:read','cost-matrix:manage','cost-matrix:calculate']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
