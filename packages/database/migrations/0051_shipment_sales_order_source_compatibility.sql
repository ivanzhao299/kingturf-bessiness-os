-- Existing MRP demand data uses the public API vocabulary SALES-ORDER.
-- Accept the legacy underscore spelling as well, without rewriting immutable snapshots.
CREATE OR REPLACE FUNCTION validate_shipment_release_request() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  contract_ok boolean; credit_ok boolean; payment_ok boolean; overdue_ok boolean; order_link_ok boolean;
  quality_ok boolean; production_ok boolean; cost_ok boolean; available numeric(24,6); quantity_ok boolean;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM sales_orders o JOIN contract_signature_evidence e ON e.tenant_id=o.tenant_id AND e.id=o.signature_evidence_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.sales_order_id AND o.status='RELEASED'),
    EXISTS(SELECT 1 FROM sales_orders o JOIN effective_credit_decisions c ON c.tenant_id=o.tenant_id AND c.id=o.credit_decision_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.sales_order_id AND c.effective_status='APPROVED' AND c.valid_until>now()),
    coalesce((SELECT sum(a.amount) FROM ar_documents d JOIN ar_open_items i ON i.tenant_id=d.tenant_id AND i.ar_document_id=d.id JOIN allocation_entries a ON a.tenant_id=i.tenant_id AND a.ar_open_item_id=i.id WHERE d.tenant_id=NEW.tenant_id AND d.sales_order_id=NEW.sales_order_id),0)>=NEW.required_payment_amount,
    NOT EXISTS(SELECT 1 FROM ar_documents d JOIN ar_open_item_balances b ON b.tenant_id=d.tenant_id AND b.ar_document_id=d.id WHERE d.tenant_id=NEW.tenant_id AND d.sales_order_id=NEW.sales_order_id AND b.due_at<now() AND b.remaining_amount>0),
    EXISTS(SELECT 1 FROM production_orders p JOIN mrp_proposals mp ON mp.tenant_id=p.tenant_id AND mp.id=p.mrp_proposal_id JOIN mrp_demand_snapshots d ON d.tenant_id=mp.tenant_id AND d.mrp_run_id=mp.mrp_run_id AND d.item_version_id=p.item_version_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.production_order_id AND d.source_type IN('SALES_ORDER','SALES-ORDER') AND d.source_id=NEW.sales_order_id),
    EXISTS(SELECT 1 FROM inventory_lot_effective_quality q WHERE q.tenant_id=NEW.tenant_id AND q.lot_id=NEW.finished_lot_id AND q.quality_status='RELEASED'),
    EXISTS(SELECT 1 FROM production_orders p JOIN production_order_effective_states s ON s.tenant_id=p.tenant_id AND s.production_order_id=p.id JOIN production_rolls r ON r.tenant_id=p.tenant_id AND r.production_order_id=p.id AND r.lot_id=NEW.finished_lot_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.production_order_id AND s.state IN('COMPLETED','CLOSED')),
    EXISTS(SELECT 1 FROM production_cost_runs c JOIN production_cost_run_effective_states s ON s.tenant_id=c.tenant_id AND s.cost_run_id=c.id WHERE c.tenant_id=NEW.tenant_id AND c.production_order_id=NEW.production_order_id AND s.state='APPROVED'),
    coalesce((SELECT sum(b.quantity) FROM inventory_balances b WHERE b.tenant_id=NEW.tenant_id AND b.lot_id=NEW.finished_lot_id),0)
  INTO contract_ok,credit_ok,payment_ok,overdue_ok,order_link_ok,quality_ok,production_ok,cost_ok,available;
  quantity_ok:=available>=NEW.requested_quantity;
  IF (NEW.gate_snapshot->>'contract_ok')::boolean IS DISTINCT FROM contract_ok OR (NEW.gate_snapshot->>'credit_ok')::boolean IS DISTINCT FROM credit_ok OR
     (NEW.gate_snapshot->>'payment_ok')::boolean IS DISTINCT FROM payment_ok OR (NEW.gate_snapshot->>'overdue_ok')::boolean IS DISTINCT FROM overdue_ok OR
     (NEW.gate_snapshot->>'order_link_ok')::boolean IS DISTINCT FROM order_link_ok OR (NEW.gate_snapshot->>'quality_ok')::boolean IS DISTINCT FROM quality_ok OR
     (NEW.gate_snapshot->>'production_ok')::boolean IS DISTINCT FROM production_ok OR (NEW.gate_snapshot->>'cost_ok')::boolean IS DISTINCT FROM cost_ok OR
     (NEW.gate_snapshot->>'quantityOk')::boolean IS DISTINCT FROM quantity_ok THEN RAISE EXCEPTION 'shipment gate snapshot does not match server evidence'; END IF;
  RETURN NEW;
END $$;
