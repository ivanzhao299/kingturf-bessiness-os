CREATE TYPE procurement_document_status AS ENUM('DRAFT','ISSUED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
CREATE TYPE inventory_movement_type AS ENUM('RECEIPT','ISSUE','RETURN','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT');

CREATE TABLE suppliers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES organizations(id),supplier_number text NOT NULL,name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','ON_HOLD','INACTIVE')),currency char(3) NOT NULL REFERENCES currencies(code),
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK(payment_terms_days>=0),quality_rating_basis_points integer CHECK(quality_rating_basis_points BETWEEN 0 AND 10000),
  contact jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(contact)='object'),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,supplier_number),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE supplier_item_qualifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,supplier_id uuid NOT NULL,item_version_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN('APPROVED','CONDITIONAL','REJECTED')),valid_from date NOT NULL,valid_to date,minimum_order_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK(minimum_order_quantity>=0),
  lead_time_days integer NOT NULL CHECK(lead_time_days>=0),evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,supplier_id,item_version_id,valid_from),FOREIGN KEY(supplier_id,tenant_id) REFERENCES suppliers(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK(valid_to IS NULL OR valid_to>=valid_from)
);
CREATE TABLE procurement_rfqs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rfq_number text NOT NULL,status procurement_document_status NOT NULL DEFAULT 'DRAFT',
  response_due_at timestamptz NOT NULL,currency char(3) NOT NULL REFERENCES currencies(code),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,rfq_number),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE procurement_rfq_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rfq_id uuid NOT NULL,line_number integer NOT NULL CHECK(line_number>0),item_version_id uuid NOT NULL,
  quantity numeric(24,6) NOT NULL CHECK(quantity>0),required_at date NOT NULL,UNIQUE(id,tenant_id),UNIQUE(tenant_id,rfq_id,line_number),
  FOREIGN KEY(rfq_id,tenant_id) REFERENCES procurement_rfqs(id,tenant_id),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE supplier_quotes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rfq_id uuid NOT NULL,supplier_id uuid NOT NULL,quote_reference text NOT NULL,
  received_at timestamptz NOT NULL,valid_until date NOT NULL,terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object'),canonical_hash char(64) NOT NULL,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,supplier_id,quote_reference),
  FOREIGN KEY(rfq_id,tenant_id) REFERENCES procurement_rfqs(id,tenant_id),FOREIGN KEY(supplier_id,tenant_id) REFERENCES suppliers(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE supplier_quote_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,supplier_quote_id uuid NOT NULL,rfq_line_id uuid NOT NULL,
  unit_price numeric(24,6) NOT NULL CHECK(unit_price>=0),promised_at date NOT NULL,minimum_order_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK(minimum_order_quantity>=0),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,supplier_quote_id,rfq_line_id),FOREIGN KEY(supplier_quote_id,tenant_id) REFERENCES supplier_quotes(id,tenant_id),
  FOREIGN KEY(rfq_line_id,tenant_id) REFERENCES procurement_rfq_lines(id,tenant_id)
);
CREATE TABLE purchase_orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,po_number text NOT NULL,supplier_id uuid NOT NULL,supplier_quote_id uuid,
  status procurement_document_status NOT NULL DEFAULT 'DRAFT',currency char(3) NOT NULL REFERENCES currencies(code),ordered_at timestamptz,canonical_hash char(64) NOT NULL,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,po_number),
  FOREIGN KEY(supplier_id,tenant_id) REFERENCES suppliers(id,tenant_id),FOREIGN KEY(supplier_quote_id,tenant_id) REFERENCES supplier_quotes(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK((status='DRAFT')=(ordered_at IS NULL))
);
CREATE TABLE purchase_order_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,purchase_order_id uuid NOT NULL,line_number integer NOT NULL CHECK(line_number>0),
  item_version_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),unit_price numeric(24,6) NOT NULL CHECK(unit_price>=0),required_at date NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,purchase_order_id,line_number),FOREIGN KEY(purchase_order_id,tenant_id) REFERENCES purchase_orders(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE inventory_locations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,location_type text NOT NULL CHECK(location_type IN('RECEIVING','STORAGE','PRODUCTION','QUARANTINE','SHIPPING')),
  active boolean NOT NULL DEFAULT true,UNIQUE(id,tenant_id),UNIQUE(tenant_id,code)
);
CREATE TABLE goods_receipts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,receipt_number text NOT NULL,purchase_order_id uuid NOT NULL,received_at timestamptz NOT NULL,
  source_reference text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),canonical_hash char(64) NOT NULL,
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,receipt_number),UNIQUE(tenant_id,purchase_order_id,source_reference),
  FOREIGN KEY(purchase_order_id,tenant_id) REFERENCES purchase_orders(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE inventory_lots(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,lot_number text NOT NULL,item_version_id uuid NOT NULL,supplier_id uuid,
  goods_receipt_id uuid,manufactured_at date,expires_at date,quality_status text NOT NULL DEFAULT 'QUARANTINE' CHECK(quality_status IN('QUARANTINE','RELEASED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,lot_number),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(supplier_id,tenant_id) REFERENCES suppliers(id,tenant_id),FOREIGN KEY(goods_receipt_id,tenant_id) REFERENCES goods_receipts(id,tenant_id),CHECK(expires_at IS NULL OR manufactured_at IS NULL OR expires_at>=manufactured_at)
);
CREATE TABLE goods_receipt_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,goods_receipt_id uuid NOT NULL,purchase_order_line_id uuid NOT NULL,lot_id uuid NOT NULL,
  location_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),UNIQUE(id,tenant_id),UNIQUE(tenant_id,goods_receipt_id,purchase_order_line_id,lot_id),
  FOREIGN KEY(goods_receipt_id,tenant_id) REFERENCES goods_receipts(id,tenant_id),FOREIGN KEY(purchase_order_line_id,tenant_id) REFERENCES purchase_order_lines(id,tenant_id),
  FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),FOREIGN KEY(location_id,tenant_id) REFERENCES inventory_locations(id,tenant_id)
);
CREATE TABLE inventory_movements(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,movement_type inventory_movement_type NOT NULL,item_version_id uuid NOT NULL,lot_id uuid NOT NULL,
  location_id uuid NOT NULL,quantity_delta numeric(24,6) NOT NULL CHECK(quantity_delta<>0),occurred_at timestamptz NOT NULL,source_type text NOT NULL,source_id uuid NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY,canonical_hash char(64) NOT NULL,actor_id uuid NOT NULL,correlation_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,source_type,source_id,lot_id,location_id,movement_type),FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),FOREIGN KEY(location_id,tenant_id) REFERENCES inventory_locations(id,tenant_id),
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id),CHECK((movement_type IN('RECEIPT','RETURN','TRANSFER_IN','ADJUSTMENT_IN'))=(quantity_delta>0))
);
CREATE VIEW inventory_balances AS SELECT tenant_id,item_version_id,lot_id,location_id,sum(quantity_delta)::numeric(24,6) quantity,max(occurred_at) last_movement_at
FROM inventory_movements GROUP BY tenant_id,item_version_id,lot_id,location_id HAVING sum(quantity_delta)<>0;

CREATE FUNCTION protect_procurement_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'procurement and inventory evidence is immutable'; END $$;
CREATE TRIGGER supplier_quote_immutable BEFORE UPDATE OR DELETE ON supplier_quotes FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE TRIGGER goods_receipt_immutable BEFORE UPDATE OR DELETE ON goods_receipts FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE TRIGGER goods_receipt_line_immutable BEFORE UPDATE OR DELETE ON goods_receipt_lines FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE TRIGGER inventory_movement_immutable BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE FUNCTION guard_purchase_order_content() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'issued purchase order is immutable except receipt progress'; END IF;
  IF NEW.status NOT IN('ISSUED','CANCELLED') THEN RAISE EXCEPTION 'draft purchase order can only be issued or cancelled'; END IF;
  IF (to_jsonb(NEW)-'status'-'ordered_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'ordered_at') THEN RAISE EXCEPTION 'purchase order issue cannot alter content'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_order_issue_guard BEFORE UPDATE ON purchase_orders FOR EACH ROW WHEN(OLD.status='DRAFT') EXECUTE FUNCTION guard_purchase_order_content();
CREATE FUNCTION protect_issued_purchase_order_line() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state procurement_document_status; BEGIN
  SELECT status INTO state FROM purchase_orders WHERE id=OLD.purchase_order_id AND tenant_id=OLD.tenant_id;
  IF state<>'DRAFT' THEN RAISE EXCEPTION 'issued purchase order lines are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER purchase_order_line_frozen BEFORE UPDATE OR DELETE ON purchase_order_lines FOR EACH ROW EXECUTE FUNCTION protect_issued_purchase_order_line();

INSERT INTO permissions(capability,description) VALUES
 ('supplier:read','Read suppliers and qualifications'),('supplier:manage','Manage suppliers and qualifications'),
 ('procurement:read','Read RFQs, quotes, purchase orders, and receipts'),('procurement:manage','Create and issue procurement documents'),
 ('inventory:read','Read lots, movements, and derived balances'),('inventory:move','Post governed inventory movements')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY['supplier:read','supplier:manage','procurement:read','procurement:manage','inventory:read','inventory:move']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
