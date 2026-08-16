ALTER TABLE production_rolls ADD COLUMN inventory_movement_id uuid;
ALTER TABLE production_rolls ADD CONSTRAINT production_roll_inventory_movement_fk FOREIGN KEY(inventory_movement_id,tenant_id) REFERENCES inventory_movements(id,tenant_id);
CREATE UNIQUE INDEX production_roll_inventory_movement_unique ON production_rolls(tenant_id,inventory_movement_id);
ALTER TABLE production_rolls ALTER COLUMN inventory_movement_id SET NOT NULL;

CREATE OR REPLACE FUNCTION validate_production_order_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE previous production_order_state; expected integer; proposal_state mrp_proposal_state; planned numeric(24,6); incomplete integer; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT state,sequence+1 INTO previous,expected FROM production_order_events WHERE tenant_id=NEW.tenant_id AND production_order_id=NEW.production_order_id ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF previous IS NULL THEN IF NEW.sequence<>1 OR NEW.state<>'DRAFT' THEN RAISE EXCEPTION 'production order ledger must begin at DRAFT sequence 1'; END IF;
  ELSE
    IF NEW.sequence<>expected THEN RAISE EXCEPTION 'production order event sequence must be contiguous'; END IF;
    IF previous='DRAFT' AND NEW.state NOT IN('RELEASED','CANCELLED') THEN RAISE EXCEPTION 'draft production order can only be released or cancelled'; END IF;
    IF previous='RELEASED' AND NEW.state NOT IN('IN_PROGRESS','CANCELLED') THEN RAISE EXCEPTION 'released production order can only start or cancel'; END IF;
    IF previous='IN_PROGRESS' AND NEW.state NOT IN('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'active production order can only complete or cancel'; END IF;
    IF previous='COMPLETED' AND NEW.state<>'CLOSED' THEN RAISE EXCEPTION 'completed production order can only close'; END IF;
    IF previous IN('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'closed production order is immutable'; END IF;
    IF NEW.state='RELEASED' THEN
      IF NOT EXISTS(SELECT 1 FROM production_order_operations x WHERE x.tenant_id=NEW.tenant_id AND x.production_order_id=NEW.production_order_id) THEN RAISE EXCEPTION 'production order release requires operation snapshots'; END IF;
      SELECT s.state INTO proposal_state FROM production_orders o LEFT JOIN mrp_proposal_effective_states s ON s.tenant_id=o.tenant_id AND s.proposal_id=o.mrp_proposal_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
      IF proposal_state IS NOT NULL AND proposal_state<>'RELEASED' THEN RAISE EXCEPTION 'production order requires a released MRP proposal'; END IF;
    END IF;
    IF NEW.state='COMPLETED' THEN
      SELECT o.planned_quantity,count(*) FILTER(WHERE coalesce(r.good,0)<o.planned_quantity) INTO planned,incomplete FROM production_orders o JOIN production_order_operations x ON x.tenant_id=o.tenant_id AND x.production_order_id=o.id LEFT JOIN LATERAL(SELECT sum(good_quantity) good FROM production_operation_reports z WHERE z.tenant_id=x.tenant_id AND z.production_order_operation_id=x.id)r ON true WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id GROUP BY o.planned_quantity;
      IF incomplete IS NULL OR incomplete>0 THEN RAISE EXCEPTION 'production completion requires planned good quantity at every operation'; END IF;
    END IF;
    IF NEW.state='CLOSED' THEN
      SELECT planned_quantity INTO planned FROM production_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_id;
      IF coalesce((SELECT sum(quantity) FROM production_rolls WHERE tenant_id=NEW.tenant_id AND production_order_id=NEW.production_order_id),0)<planned THEN RAISE EXCEPTION 'production close requires serialized finished quantity'; END IF;
    END IF;
  END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validate_production_execution_entry() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state production_order_state; linked_order uuid; planned numeric(24,6); reported numeric(24,6); movement inventory_movements%ROWTYPE; quality text; bom_component boolean; BEGIN
  PERFORM pg_advisORY_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT s.state,o.planned_quantity INTO state,planned FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
  IF TG_TABLE_NAME='production_material_transactions' THEN
    IF state NOT IN('RELEASED','IN_PROGRESS') THEN RAISE EXCEPTION 'material posting requires a released or active order'; END IF;
    SELECT * INTO movement FROM inventory_movements m WHERE m.tenant_id=NEW.tenant_id AND m.id=NEW.inventory_movement_id;
    SELECT quality_status INTO quality FROM inventory_lots WHERE tenant_id=NEW.tenant_id AND id=NEW.lot_id;
    SELECT EXISTS(SELECT 1 FROM production_orders o JOIN manufacturing_bom_versions b ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED' JOIN manufacturing_bom_lines l ON l.tenant_id=b.tenant_id AND l.bom_version_id=b.id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id AND l.component_item_version_id=NEW.item_version_id) INTO bom_component;
    IF NEW.transaction_type='ISSUE' AND (quality<>'RELEASED' OR NOT bom_component) THEN RAISE EXCEPTION 'production issue requires released BOM material'; END IF;
    IF movement.id IS NULL OR movement.item_version_id<>NEW.item_version_id OR movement.lot_id<>NEW.lot_id OR movement.location_id<>NEW.location_id OR movement.source_type<>'PRODUCTION_ORDER' OR movement.source_id<>NEW.production_order_id OR (NEW.transaction_type='ISSUE' AND (movement.movement_type<>'ISSUE' OR movement.quantity_delta<>-NEW.quantity)) OR (NEW.transaction_type='RETURN' AND (movement.movement_type<>'RETURN' OR movement.quantity_delta<>NEW.quantity)) THEN RAISE EXCEPTION 'production material transaction must match its inventory movement'; END IF;
  ELSE
    IF state<>'IN_PROGRESS' THEN RAISE EXCEPTION 'operation reporting requires an active order'; END IF;
    SELECT production_order_id INTO linked_order FROM production_order_operations WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_operation_id;
    IF linked_order IS NULL OR linked_order<>NEW.production_order_id THEN RAISE EXCEPTION 'operation report must belong to the production order'; END IF;
    SELECT coalesce(sum(good_quantity),0)+NEW.good_quantity INTO reported FROM production_operation_reports WHERE tenant_id=NEW.tenant_id AND production_order_operation_id=NEW.production_order_operation_id;
    IF reported>planned THEN RAISE EXCEPTION 'reported good quantity exceeds planned production quantity'; END IF;
  END IF; RETURN NEW;
END $$;

CREATE FUNCTION validate_production_roll() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE report_order uuid; report_good numeric(24,6); rolled numeric(24,6); order_item uuid; lot_item uuid; movement inventory_movements%ROWTYPE; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT production_order_id,good_quantity INTO report_order,report_good FROM production_operation_reports WHERE tenant_id=NEW.tenant_id AND id=NEW.operation_report_id;
  SELECT item_version_id INTO order_item FROM production_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_id;
  SELECT item_version_id INTO lot_item FROM inventory_lots WHERE tenant_id=NEW.tenant_id AND id=NEW.lot_id;
  SELECT * INTO movement FROM inventory_movements WHERE tenant_id=NEW.tenant_id AND id=NEW.inventory_movement_id;
  SELECT coalesce(sum(quantity),0)+NEW.quantity INTO rolled FROM production_rolls WHERE tenant_id=NEW.tenant_id AND operation_report_id=NEW.operation_report_id;
  IF report_order<>NEW.production_order_id OR order_item<>NEW.item_version_id OR lot_item<>NEW.item_version_id OR rolled>report_good THEN RAISE EXCEPTION 'finished roll must match order, report, item, lot, and reported quantity'; END IF;
  IF movement.id IS NULL OR movement.item_version_id<>NEW.item_version_id OR movement.lot_id<>NEW.lot_id OR movement.quantity_delta<>NEW.quantity OR movement.movement_type<>'ADJUSTMENT_IN' OR movement.source_type<>'PRODUCTION_ROLL' OR movement.source_id<>NEW.id THEN RAISE EXCEPTION 'finished roll must match its inventory receipt'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_roll_integrity BEFORE INSERT ON production_rolls FOR EACH ROW EXECUTE FUNCTION validate_production_roll();
