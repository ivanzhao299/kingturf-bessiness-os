-- The original trigger declared a PL/pgSQL record named `q` and also used `q`
-- as the quotes table alias. PostgreSQL resolves the identifier as the record,
-- so the sales-order branch failed before it could validate the graph.
CREATE OR REPLACE FUNCTION validate_qtc_pins() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pinned_quote record;
BEGIN
  IF TG_TABLE_NAME='credit_decisions' THEN
    SELECT r.status,r.valid_until,s.quote_revision_id INTO pinned_quote
    FROM quote_revisions r
    JOIN quote_issued_snapshots s ON s.tenant_id=r.tenant_id AND s.id=NEW.quote_snapshot_id
    WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.quote_revision_id;
    IF pinned_quote.status IS DISTINCT FROM 'ISSUED'
       OR pinned_quote.valid_until<=now()
       OR pinned_quote.quote_revision_id IS DISTINCT FROM NEW.quote_revision_id THEN
      RAISE EXCEPTION 'credit decision requires exact unexpired issued quote snapshot';
    END IF;
  ELSIF TG_TABLE_NAME='contract_revisions' THEN
    IF NOT EXISTS(
      SELECT 1 FROM quote_issued_snapshots s
      WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.quote_snapshot_id
        AND s.quote_revision_id=NEW.quote_revision_id
    ) THEN
      RAISE EXCEPTION 'contract requires exact issued quote snapshot';
    END IF;
  ELSIF TG_TABLE_NAME='sales_orders' THEN
    IF NOT EXISTS(
      SELECT 1
      FROM quote_revisions qr
      JOIN quotes quote_root ON quote_root.id=qr.quote_id AND quote_root.tenant_id=qr.tenant_id
      JOIN opportunities o ON o.id=quote_root.opportunity_id AND o.tenant_id=quote_root.tenant_id
      JOIN quote_issued_snapshots qs ON qs.tenant_id=qr.tenant_id
        AND qs.id=NEW.quote_snapshot_id AND qs.quote_revision_id=qr.id
      JOIN effective_credit_decisions cd ON cd.tenant_id=qr.tenant_id
        AND cd.id=NEW.credit_decision_id AND cd.quote_revision_id=qr.id
        AND cd.quote_snapshot_id=qs.id
      JOIN contracts c ON c.tenant_id=qr.tenant_id AND c.customer_id=cd.customer_id
        AND c.opportunity_id=o.id
      JOIN contract_revisions cr ON cr.tenant_id=c.tenant_id AND cr.contract_id=c.id
        AND cr.id=NEW.contract_revision_id AND cr.quote_revision_id=qr.id
        AND cr.quote_snapshot_id=qs.id
      JOIN contract_signature_evidence se ON se.tenant_id=cr.tenant_id
        AND se.id=NEW.signature_evidence_id AND se.contract_revision_id=cr.id
      WHERE qr.tenant_id=NEW.tenant_id AND qr.id=NEW.quote_revision_id
        AND qr.status='ISSUED' AND qr.valid_until>now()
        AND cd.effective_status='APPROVED' AND cd.valid_until>now()
        AND NEW.customer_id=cd.customer_id AND NEW.customer_id=c.customer_id
        AND NEW.opportunity_id=o.id AND NEW.currency=qr.currency AND NEW.total=qr.total
    ) THEN
      RAISE EXCEPTION 'order commercial graph is stale, unapproved, unsigned, or inconsistent';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A CASE expression still resolves every referenced NEW field against the
-- trigger's row type. Split the two trigger sources explicitly so the order
-- row is never asked for a sales_order_id column it does not have.
CREATE OR REPLACE FUNCTION validate_sales_order_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_key uuid; tenant_key uuid; expected numeric(24,6); actual numeric(24,6);
BEGIN
  IF TG_TABLE_NAME='sales_orders' THEN
    order_key:=NEW.id;
    tenant_key:=NEW.tenant_id;
  ELSE
    order_key:=NEW.sales_order_id;
    tenant_key:=NEW.tenant_id;
  END IF;
  SELECT total INTO expected FROM sales_orders WHERE id=order_key AND tenant_id=tenant_key;
  SELECT sum(total) INTO actual FROM sales_order_lines
  WHERE sales_order_id=order_key AND sales_order_lines.tenant_id=tenant_key;
  IF expected IS NULL OR actual IS NULL OR actual<>expected THEN
    RAISE EXCEPTION 'sales order requires lines totaling order total';
  END IF;
  RETURN NULL;
END $$;
