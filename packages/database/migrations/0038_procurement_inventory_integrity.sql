CREATE TRIGGER supplier_quote_line_immutable BEFORE UPDATE OR DELETE ON supplier_quote_lines FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();

CREATE FUNCTION guard_rfq_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'issued RFQ is immutable'; END IF;
  IF NEW.status NOT IN('ISSUED','CANCELLED') THEN RAISE EXCEPTION 'draft RFQ can only be issued or cancelled'; END IF;
  IF (to_jsonb(NEW)-'status'-'issued_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'issued_at') THEN RAISE EXCEPTION 'RFQ issue cannot alter content'; END IF;
  IF NEW.status='ISSUED' AND (NEW.issued_at IS NULL OR NOT EXISTS(SELECT 1 FROM procurement_rfq_lines l WHERE l.rfq_id=NEW.id AND l.tenant_id=NEW.tenant_id)) THEN
    RAISE EXCEPTION 'RFQ issue requires timestamp and lines';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER procurement_rfq_update_guard BEFORE UPDATE ON procurement_rfqs FOR EACH ROW EXECUTE FUNCTION guard_rfq_update();
CREATE FUNCTION protect_issued_rfq_line() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state procurement_document_status; BEGIN
  SELECT status INTO state FROM procurement_rfqs WHERE id=OLD.rfq_id AND tenant_id=OLD.tenant_id;
  IF state<>'DRAFT' THEN RAISE EXCEPTION 'issued RFQ lines are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER procurement_rfq_line_frozen BEFORE UPDATE OR DELETE ON procurement_rfq_lines FOR EACH ROW EXECUTE FUNCTION protect_issued_rfq_line();

DROP TRIGGER purchase_order_issue_guard ON purchase_orders;
DROP FUNCTION guard_purchase_order_content();
CREATE FUNCTION guard_purchase_order_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (to_jsonb(NEW)-'status'-'ordered_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'ordered_at') THEN RAISE EXCEPTION 'purchase order content is immutable'; END IF;
  IF OLD.status='DRAFT' AND NEW.status NOT IN('ISSUED','CANCELLED') THEN RAISE EXCEPTION 'draft purchase order can only be issued or cancelled'; END IF;
  IF OLD.status='ISSUED' AND NEW.status NOT IN('PARTIALLY_RECEIVED','RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'issued purchase order has invalid transition'; END IF;
  IF OLD.status='PARTIALLY_RECEIVED' AND NEW.status NOT IN('RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'partially received purchase order has invalid transition'; END IF;
  IF OLD.status IN('RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'closed purchase order is immutable'; END IF;
  IF NEW.status='ISSUED' AND (NEW.ordered_at IS NULL OR NOT EXISTS(SELECT 1 FROM purchase_order_lines l WHERE l.purchase_order_id=NEW.id AND l.tenant_id=NEW.tenant_id)) THEN
    RAISE EXCEPTION 'purchase order issue requires timestamp and lines';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_order_update_guard BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION guard_purchase_order_update();

CREATE FUNCTION validate_receipt_line() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE po_item uuid; lot_item uuid; receipt_po uuid; line_po uuid; BEGIN
  SELECT pol.item_version_id,pol.purchase_order_id INTO po_item,line_po FROM purchase_order_lines pol WHERE pol.id=NEW.purchase_order_line_id AND pol.tenant_id=NEW.tenant_id;
  SELECT l.item_version_id INTO lot_item FROM inventory_lots l WHERE l.id=NEW.lot_id AND l.tenant_id=NEW.tenant_id;
  SELECT gr.purchase_order_id INTO receipt_po FROM goods_receipts gr WHERE gr.id=NEW.goods_receipt_id AND gr.tenant_id=NEW.tenant_id;
  IF po_item IS NULL OR po_item<>lot_item OR receipt_po<>line_po THEN RAISE EXCEPTION 'receipt line must match purchase order item, lot, and order'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goods_receipt_line_integrity BEFORE INSERT ON goods_receipt_lines FOR EACH ROW EXECUTE FUNCTION validate_receipt_line();

CREATE FUNCTION validate_inventory_movement() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE lot_item uuid; resulting numeric(24,6); BEGIN
  SELECT item_version_id INTO lot_item FROM inventory_lots WHERE id=NEW.lot_id AND tenant_id=NEW.tenant_id;
  IF lot_item IS NULL OR lot_item<>NEW.item_version_id THEN RAISE EXCEPTION 'inventory movement item must match lot'; END IF;
  SELECT coalesce(sum(quantity_delta),0)+NEW.quantity_delta INTO resulting FROM inventory_movements
   WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id AND location_id=NEW.location_id;
  IF resulting<0 THEN RAISE EXCEPTION 'inventory movement cannot create negative lot balance'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_movement_integrity BEFORE INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION validate_inventory_movement();

CREATE UNIQUE INDEX inventory_movements_sequence_unique ON inventory_movements(tenant_id,sequence);
