-- R1: production returns are bounded by the immutable issue ledger.
-- Do not silently bless historical over-returns: reconcile before enabling the guard.
-- Preserve the supported write order (inventory resource -> production material)
-- while making the historical scan stable during the migration window.
LOCK TABLE inventory_movements, production_material_transactions IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM production_material_transactions
    GROUP BY tenant_id,production_order_id,item_version_id,lot_id,location_id
    HAVING coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0)
      > coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)
  ) THEN
    RAISE EXCEPTION 'existing production return exceeds issue; reconcile before migration';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inventory_movements m
    WHERE m.source_type='PRODUCTION_ORDER'
      AND m.movement_type='RETURN'
      AND NOT EXISTS (
        SELECT 1 FROM production_material_transactions t
        WHERE t.tenant_id=m.tenant_id
          AND t.inventory_movement_id=m.id
          AND t.transaction_type='RETURN'
      )
  ) THEN
    RAISE EXCEPTION 'existing production return movement has no material transaction; reconcile before migration';
  END IF;
END
$$;

-- The original key allowed only one movement per production order/resource/type.
-- Production material idempotency is authoritative for this path, while the
-- canonical hash keeps identical direct movement retries unique.
ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_tenant_id_source_type_source_id_lot_id__key;
ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_tenant_id_source_type_source_id_lot_id_location_id_movement_type_key;
CREATE UNIQUE INDEX inventory_movements_business_identity
  ON inventory_movements(tenant_id,source_type,source_id,lot_id,location_id,movement_type,canonical_hash);
CREATE TABLE production_material_guards(
  tenant_id uuid NOT NULL,
  production_order_id uuid NOT NULL,
  item_version_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  location_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
  PRIMARY KEY(tenant_id,production_order_id,item_version_id,lot_id,location_id),
  FOREIGN KEY(production_order_id,tenant_id) REFERENCES production_orders(id,tenant_id),
  FOREIGN KEY(item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),
  FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(location_id,tenant_id) REFERENCES inventory_locations(id,tenant_id)
);
CREATE INDEX production_material_return_limit_lookup
  ON production_material_transactions(tenant_id,production_order_id,item_version_id,lot_id,location_id,transaction_type);

CREATE OR REPLACE FUNCTION validate_production_execution_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  state production_order_state;
  linked_order uuid;
  planned numeric(24,6);
  reported numeric(24,6);
  movement inventory_movements%ROWTYPE;
  quality text;
  bom_component boolean;
  issued numeric(24,6);
  returned numeric(24,6);
BEGIN
  -- The inventory guard is acquired by the movement INSERT first.  Keep the
  -- existing resource -> production-order lock order and perform the return
  -- aggregate check after the order advisory lock has serialized this order.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||NEW.production_order_id::text,0));
  SELECT s.state,o.planned_quantity INTO state,planned
  FROM production_orders o
  JOIN production_order_effective_states s
    ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id
  WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id;
  IF TG_TABLE_NAME='production_material_transactions' THEN
    IF state NOT IN('RELEASED','IN_PROGRESS') THEN
      RAISE EXCEPTION 'material posting requires a released or active order';
    END IF;
    SELECT * INTO movement FROM inventory_movements m
    WHERE m.tenant_id=NEW.tenant_id AND m.id=NEW.inventory_movement_id;
    SELECT quality_status INTO quality FROM inventory_lot_effective_quality
    WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id;
    SELECT EXISTS(
      SELECT 1
      FROM production_orders o
      JOIN manufacturing_bom_versions b
        ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED'
      JOIN manufacturing_bom_lines l
        ON l.tenant_id=b.tenant_id AND l.bom_version_id=b.id
      WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.production_order_id
        AND l.component_item_version_id=NEW.item_version_id
    ) INTO bom_component;
    IF NEW.transaction_type='ISSUE' AND (quality<>'RELEASED' OR NOT bom_component) THEN
      RAISE EXCEPTION 'production issue requires released BOM material';
    END IF;
    IF movement.id IS NULL
      OR movement.item_version_id<>NEW.item_version_id
      OR movement.lot_id<>NEW.lot_id
      OR movement.location_id<>NEW.location_id
      OR movement.source_type<>'PRODUCTION_ORDER'
      OR movement.source_id<>NEW.production_order_id
      OR (NEW.transaction_type='ISSUE' AND (movement.movement_type<>'ISSUE' OR movement.quantity_delta<>-NEW.quantity))
      OR (NEW.transaction_type='RETURN' AND (movement.movement_type<>'RETURN' OR movement.quantity_delta<>NEW.quantity))
    THEN
      RAISE EXCEPTION 'production material transaction must match its inventory movement';
    END IF;
    -- This mutable row complements the advisory lock. Under REPEATABLE READ
    -- a waiter that started from an older snapshot gets a serialization error
    -- instead of reusing a stale aggregate after the predecessor commits.
    INSERT INTO production_material_guards AS guard(
      tenant_id,production_order_id,item_version_id,lot_id,location_id,revision
    ) VALUES(
      NEW.tenant_id,NEW.production_order_id,NEW.item_version_id,NEW.lot_id,NEW.location_id,1
    )
    ON CONFLICT(tenant_id,production_order_id,item_version_id,lot_id,location_id)
      DO UPDATE SET revision=guard.revision+1;
    IF NEW.transaction_type='RETURN' THEN
      SELECT
        coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0),
        coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0)
      INTO issued,returned
      FROM production_material_transactions
      WHERE tenant_id=NEW.tenant_id
        AND production_order_id=NEW.production_order_id
        AND item_version_id=NEW.item_version_id
        AND lot_id=NEW.lot_id
        AND location_id=NEW.location_id;
      IF returned + NEW.quantity > issued THEN
        RAISE EXCEPTION 'production return exceeds cumulative issue for material resource';
      END IF;
    END IF;
  ELSE
    IF state<>'IN_PROGRESS' THEN
      RAISE EXCEPTION 'operation reporting requires an active order';
    END IF;
    SELECT production_order_id INTO linked_order
    FROM production_order_operations
    WHERE tenant_id=NEW.tenant_id AND id=NEW.production_order_operation_id;
    IF linked_order IS NULL OR linked_order<>NEW.production_order_id THEN
      RAISE EXCEPTION 'operation report must belong to the production order';
    END IF;
    SELECT coalesce(sum(good_quantity),0)+NEW.good_quantity INTO reported
    FROM production_operation_reports
    WHERE tenant_id=NEW.tenant_id AND production_order_operation_id=NEW.production_order_operation_id;
    IF reported>planned THEN
      RAISE EXCEPTION 'reported good quantity exceeds planned production quantity';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- Direct production ISSUE/RETURN movements must be paired with the immutable
-- production material transaction before the surrounding transaction commits.
CREATE OR REPLACE FUNCTION require_production_material_transaction()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM production_material_transactions
    WHERE tenant_id=NEW.tenant_id
      AND inventory_movement_id=NEW.id
      AND transaction_type=NEW.movement_type::text::production_material_transaction_type
  ) THEN
    RAISE EXCEPTION 'production material movement requires a material transaction';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER production_material_movement_guard
AFTER INSERT ON inventory_movements
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.source_type='PRODUCTION_ORDER' AND NEW.movement_type IN('ISSUE','RETURN'))
EXECUTE FUNCTION require_production_material_transaction();
