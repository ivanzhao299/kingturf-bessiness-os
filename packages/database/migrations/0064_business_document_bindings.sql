ALTER TABLE business_documents
  ADD COLUMN customer_id uuid,
  ADD COLUMN sales_order_id uuid,
  ADD COLUMN operator_id uuid,
  ADD COLUMN salesperson_id uuid,
  ADD COLUMN assigned_to uuid;

ALTER TABLE business_documents
  ADD FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
  ADD FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id),
  ADD FOREIGN KEY(operator_id,tenant_id) REFERENCES employees(id,company_id),
  ADD FOREIGN KEY(salesperson_id,tenant_id) REFERENCES employees(id,company_id),
  ADD FOREIGN KEY(assigned_to,tenant_id) REFERENCES employees(id,company_id);

CREATE INDEX business_documents_customer_idx
  ON business_documents(tenant_id,customer_id,updated_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX business_documents_order_idx
  ON business_documents(tenant_id,sales_order_id,updated_at DESC) WHERE sales_order_id IS NOT NULL;
CREATE INDEX business_documents_assignee_idx
  ON business_documents(tenant_id,assigned_to,state,updated_at DESC) WHERE assigned_to IS NOT NULL;

CREATE FUNCTION validate_business_document_bindings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sales_order_id IS NOT NULL AND NEW.customer_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM sales_orders o WHERE o.id=NEW.sales_order_id AND o.tenant_id=NEW.tenant_id
      AND o.customer_id=NEW.customer_id
  ) THEN RAISE EXCEPTION 'business document order does not belong to selected customer'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER business_document_bindings_consistent
  BEFORE INSERT OR UPDATE OF customer_id,sales_order_id ON business_documents
  FOR EACH ROW EXECUTE FUNCTION validate_business_document_bindings();
