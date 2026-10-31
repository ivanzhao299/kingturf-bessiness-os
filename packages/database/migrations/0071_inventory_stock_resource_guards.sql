-- Synchronization metadata only: immutable inventory movements remain the balance authority.
LOCK TABLE inventory_movements IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM inventory_movements
    GROUP BY tenant_id,item_version_id,lot_id,location_id
    HAVING sum(quantity_delta)<0
  ) THEN
    RAISE EXCEPTION 'existing inventory balance is negative; reconcile before migration';
  END IF;
END
$$;

CREATE TABLE inventory_stock_guards(
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  location_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
  PRIMARY KEY(tenant_id,lot_id,location_id),
  FOREIGN KEY(lot_id,tenant_id) REFERENCES inventory_lots(id,tenant_id),
  FOREIGN KEY(location_id,tenant_id) REFERENCES inventory_locations(id,tenant_id)
);

CREATE INDEX inventory_movements_stock_resource
  ON inventory_movements(tenant_id,lot_id,location_id);

CREATE OR REPLACE FUNCTION validate_inventory_movement()
RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  lot_item uuid;
  resulting numeric(24,6);
BEGIN
  SELECT item_version_id INTO lot_item FROM inventory_lots
    WHERE id=NEW.lot_id AND tenant_id=NEW.tenant_id;
  IF lot_item IS NULL OR lot_item<>NEW.item_version_id THEN
    RAISE EXCEPTION 'inventory movement item must match lot';
  END IF;

  -- A real update also prevents stale RR/Serializable snapshots from succeeding.
  INSERT INTO inventory_stock_guards AS guard(tenant_id,lot_id,location_id,revision)
    VALUES(NEW.tenant_id,NEW.lot_id,NEW.location_id,1)
  ON CONFLICT(tenant_id,lot_id,location_id)
    DO UPDATE SET revision=guard.revision+1;

  -- Keep this separate from the guard statement: RC needs the post-wait snapshot.
  SELECT coalesce(sum(quantity_delta),0)+NEW.quantity_delta INTO resulting
    FROM inventory_movements
    WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id AND location_id=NEW.location_id;
  IF resulting<0 THEN
    RAISE EXCEPTION 'inventory movement cannot create negative lot balance';
  END IF;
  RETURN NEW;
END
$$;
