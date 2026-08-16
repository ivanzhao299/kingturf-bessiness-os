CREATE TRIGGER inventory_lot_quality_base_immutable BEFORE UPDATE OF quality_status ON inventory_lots FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();
CREATE TRIGGER inventory_lot_delete_forbidden BEFORE DELETE ON inventory_lots FOR EACH ROW EXECUTE FUNCTION protect_quality_evidence();

CREATE OR REPLACE FUNCTION validate_production_execution_entry() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state production_order_state; linked_order uuid; planned numeric(24,6); reported numeric(24,6); movement inventory_movements%ROWTYPE; quality text; bom_component boolean; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT s.state,o.planned_quantity INTO state,planned FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
  IF TG_TABLE_NAME='production_material_transactions' THEN
    IF state NOT IN('RELEASED','IN_PROGRESS') THEN RAISE EXCEPTION 'material posting requires a released or active order'; END IF;
    SELECT * INTO movement FROM inventory_movements m WHERE m.tenant_id=NEW.tenant_id AND m.id=NEW.inventory_movement_id;
    SELECT quality_status INTO quality FROM inventory_lot_effective_quality WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id;
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
