-- JTF-P1-E11..E17 governed repair: strengthen immutable commercial graph
-- invariants without rewriting the original ledger migration.

CREATE FUNCTION validate_qtc_governed_graph() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'credit_decisions' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM credit_limits cl
      JOIN credit_exposure_snapshots es
        ON es.tenant_id = cl.tenant_id
       AND es.id = NEW.exposure_snapshot_id
       AND es.customer_id = NEW.customer_id
       AND es.currency = cl.currency
      JOIN quote_revisions qr
        ON qr.tenant_id = cl.tenant_id
       AND qr.id = NEW.quote_revision_id
       AND qr.currency = cl.currency
       AND NEW.currency = cl.currency
       AND qr.total = NEW.requested_amount
      WHERE cl.tenant_id = NEW.tenant_id
        AND cl.id = NEW.credit_limit_id
        AND cl.customer_id = NEW.customer_id
        AND NEW.valid_until <= cl.expires_at
        AND NEW.valid_until <= qr.valid_until
    ) THEN
      RAISE EXCEPTION 'credit decision validity or currency is inconsistent with pinned evidence';
    END IF;
  ELSIF TG_TABLE_NAME = 'credit_approvals' THEN
    IF NOT EXISTS (
      SELECT 1 FROM credit_decisions d
      WHERE d.tenant_id = NEW.tenant_id
        AND d.id = NEW.credit_decision_id
        AND d.valid_until > now()
        AND d.status = 'PENDING_APPROVAL'
    ) THEN
      RAISE EXCEPTION 'credit approval requires a current pending decision';
    END IF;
  ELSIF TG_TABLE_NAME = 'contract_revisions' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM contracts c
      JOIN opportunities o
        ON o.tenant_id = c.tenant_id
       AND o.id = c.opportunity_id
       AND o.customer_id = c.customer_id
      JOIN quotes q
        ON q.tenant_id = o.tenant_id
       AND q.opportunity_id = o.id
      JOIN quote_revisions qr
        ON qr.tenant_id = q.tenant_id
       AND qr.quote_id = q.id
       AND qr.id = NEW.quote_revision_id
       AND qr.status = 'ISSUED'
      JOIN quote_issued_snapshots s
        ON s.tenant_id = qr.tenant_id
       AND s.id = NEW.quote_snapshot_id
       AND s.quote_revision_id = qr.id
      WHERE c.tenant_id = NEW.tenant_id AND c.id = NEW.contract_id
    ) THEN
      RAISE EXCEPTION 'contract revision is inconsistent with its customer opportunity quote';
    END IF;
  ELSIF TG_TABLE_NAME = 'ar_documents' AND NEW.sales_order_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM sales_orders o
      WHERE o.tenant_id = NEW.tenant_id
        AND o.id = NEW.sales_order_id
        AND o.customer_id = NEW.customer_id
        AND o.currency = NEW.currency
    ) THEN
      RAISE EXCEPTION 'AR document is inconsistent with its sales order';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER credit_decision_governed_graph
  BEFORE INSERT ON credit_decisions
  FOR EACH ROW EXECUTE FUNCTION validate_qtc_governed_graph();
CREATE TRIGGER credit_approval_governed_graph
  BEFORE INSERT ON credit_approvals
  FOR EACH ROW EXECUTE FUNCTION validate_qtc_governed_graph();
CREATE TRIGGER contract_revision_governed_graph
  BEFORE INSERT ON contract_revisions
  FOR EACH ROW EXECUTE FUNCTION validate_qtc_governed_graph();
CREATE TRIGGER ar_document_governed_graph
  BEFORE INSERT ON ar_documents
  FOR EACH ROW EXECUTE FUNCTION validate_qtc_governed_graph();

CREATE FUNCTION enforce_order_credit_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE live_exposure numeric(24,6); limit_amount numeric(24,6);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || NEW.customer_id::text || ':credit-ledger',0));
  SELECT es.exposure_amount,cl.amount INTO live_exposure,limit_amount
  FROM credit_decisions d
  JOIN credit_limits cl ON cl.id=d.credit_limit_id AND cl.tenant_id=d.tenant_id AND cl.effective_at<=now() AND cl.expires_at>now()
  JOIN LATERAL (
    SELECT greatest(0,
      coalesce((SELECT sum(CASE WHEN ad.document_type='INVOICE' THEN b.remaining_amount ELSE -b.remaining_amount END) FROM ar_open_item_balances b JOIN ar_documents ad ON ad.id=b.ar_document_id AND ad.tenant_id=b.tenant_id WHERE b.tenant_id=d.tenant_id AND b.customer_id=d.customer_id AND b.currency=d.currency),0)
      + coalesce((SELECT sum(o.total-coalesce((SELECT sum(ad.amount) FROM ar_documents ad WHERE ad.tenant_id=o.tenant_id AND ad.sales_order_id=o.id AND ad.document_type='INVOICE'),0)) FROM sales_orders o WHERE o.tenant_id=d.tenant_id AND o.customer_id=d.customer_id AND o.currency=d.currency AND o.status='RELEASED'),0)
      - coalesce((SELECT sum(b.remaining_amount) FROM bank_payment_balances b WHERE b.tenant_id=d.tenant_id AND b.customer_id=d.customer_id AND b.currency=d.currency),0)
    )::numeric(24,6) AS exposure_amount
  ) es ON true
  WHERE d.id=NEW.credit_decision_id AND d.tenant_id=NEW.tenant_id AND d.customer_id=NEW.customer_id AND d.currency=NEW.currency;
  IF live_exposure IS NULL OR live_exposure+NEW.total>limit_amount THEN
    RAISE EXCEPTION 'sales order exceeds current customer credit capacity';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_order_current_credit_capacity BEFORE INSERT ON sales_orders FOR EACH ROW EXECUTE FUNCTION enforce_order_credit_capacity();

CREATE FUNCTION validate_sales_order_line_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_total numeric(24,6); line_total numeric(24,6);
BEGIN
  SELECT o.total, coalesce(sum(l.total), 0)
    INTO order_total, line_total
    FROM sales_orders o
    LEFT JOIN sales_order_lines l
      ON l.tenant_id = o.tenant_id AND l.sales_order_id = o.id
   WHERE o.tenant_id = NEW.tenant_id AND o.id = NEW.sales_order_id
   GROUP BY o.id;
  IF order_total IS NULL OR line_total <> order_total THEN
    RAISE EXCEPTION 'sales order lines must exactly equal the pinned order total';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER sales_order_line_total
  AFTER INSERT ON sales_order_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_sales_order_line_total();
