import type { JsonObject } from '@kingturf/types';
import { company, type Context, type Db } from './procurement-read-repositories.ts';

export const INVENTORY_LEDGER_PROJECTION = `jsonb_build_object('itemVersionId',b.item_version_id,'lotId',b.lot_id,'locationId',b.location_id,'quantity',b.quantity,'lastMovementAt',b.last_movement_at,'sku',i.sku,'itemName',i.name,'lotNumber',lot.lot_number,'qualityStatus',quality.quality_status,'locationCode',loc.code,'movements',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence) FROM inventory_movements m WHERE m.tenant_id=b.tenant_id AND m.lot_id=b.lot_id AND m.location_id=b.location_id),'[]'::jsonb))`;
export const INVENTORY_LEDGER_FROM = `FROM inventory_balances b JOIN manufacturing_item_versions v ON v.id=b.item_version_id AND v.tenant_id=b.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id JOIN inventory_lots lot ON lot.id=b.lot_id AND lot.tenant_id=b.tenant_id JOIN inventory_lot_effective_quality quality ON quality.lot_id=lot.id AND quality.tenant_id=lot.tenant_id JOIN inventory_locations loc ON loc.id=b.location_id AND loc.tenant_id=b.tenant_id`;
export const INVENTORY_LEDGER_LIST_SQL = `SELECT ${INVENTORY_LEDGER_PROJECTION} item ${INVENTORY_LEDGER_FROM} WHERE b.tenant_id=$1 ORDER BY i.sku,lot.lot_number,loc.code`;

export const INVENTORY_QUALITY = ['RELEASED', 'QUARANTINE', 'REJECTED'] as const;
export const INVENTORY_SORTS = ['sku', 'lot', 'location', 'quantity', 'last'] as const;
export type InventoryLedgerFilter = Readonly<{
  query?: string | undefined;
  status?: (typeof INVENTORY_QUALITY)[number] | undefined;
  location?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  sort?: (typeof INVENTORY_SORTS)[number] | undefined;
  direction?: 'asc' | 'desc' | undefined;
}>;

const INVENTORY_LEDGER_PAGE_SQL = `WITH candidates AS MATERIALIZED (
  SELECT b.lot_id,b.location_id,i.sku,lot.lot_number,loc.code,
    CASE $7::text WHEN 'quantity' THEN b.quantity END AS quantity_key,
    CASE $7 WHEN 'last' THEN b.last_movement_at END AS time_key,
    CASE $7 WHEN 'lot' THEN lot.lot_number WHEN 'location' THEN loc.code ELSE i.sku END AS text_key
  ${INVENTORY_LEDGER_FROM}
  WHERE b.tenant_id=$1
    AND ($2::text IS NULL OR strpos(lower(i.sku),lower($2))>0 OR strpos(lower(lot.lot_number),lower($2))>0)
    AND ($3::text IS NULL OR quality.quality_status=$3)
    AND ($4::uuid IS NULL OR b.location_id=$4)
), anchor AS (
  SELECT coalesce(quantity_key,0),coalesce(time_key,'-infinity'::timestamptz),text_key,sku,lot_number,code,lot_id,location_id
  FROM candidates WHERE lot_id=$5::uuid AND location_id=$6::uuid
), page_keys AS (
  SELECT lot_id,location_id,
    row_number() OVER (ORDER BY
      CASE WHEN $8::bool THEN quantity_key END, CASE WHEN $8 THEN time_key END, CASE WHEN $8 THEN text_key END,
      CASE WHEN $8 THEN sku END, CASE WHEN $8 THEN lot_number END, CASE WHEN $8 THEN code END,
      CASE WHEN $8 THEN lot_id END, CASE WHEN $8 THEN location_id END,
      CASE WHEN NOT $8 THEN quantity_key END DESC, CASE WHEN NOT $8 THEN time_key END DESC,
      CASE WHEN NOT $8 THEN text_key END DESC, CASE WHEN NOT $8 THEN sku END DESC,
      CASE WHEN NOT $8 THEN lot_number END DESC, CASE WHEN NOT $8 THEN code END DESC,
      CASE WHEN NOT $8 THEN lot_id END DESC, CASE WHEN NOT $8 THEN location_id END DESC) AS position
  FROM candidates
  WHERE $5::uuid IS NULL OR ($8 AND (coalesce(quantity_key,0),coalesce(time_key,'-infinity'),text_key,sku,lot_number,code,lot_id,location_id)>(SELECT * FROM anchor))
    OR (NOT $8 AND (coalesce(quantity_key,0),coalesce(time_key,'-infinity'),text_key,sku,lot_number,code,lot_id,location_id)<(SELECT * FROM anchor))
  ORDER BY position LIMIT $9
)
SELECT ${INVENTORY_LEDGER_PROJECTION} item, b.lot_id, b.location_id ${INVENTORY_LEDGER_FROM}
JOIN page_keys p ON p.lot_id=b.lot_id AND p.location_id=b.location_id
WHERE b.tenant_id=$1 ORDER BY p.position`;

export async function readInventoryBalancePage(
  db: Db,
  context: Context,
  filter: InventoryLedgerFilter,
) {
  company(context);
  const [lot, location] = filter.cursor?.split(':') ?? [];
  const limit = filter.limit ?? (filter.cursor === undefined ? null : 50);
  const { rows } = await db.query<{ item: JsonObject; lot_id: string; location_id: string }>(
    INVENTORY_LEDGER_PAGE_SQL,
    [
      context.actor.companyId,
      filter.query ?? null,
      filter.status ?? null,
      filter.location ?? null,
      lot ?? null,
      location ?? null,
      filter.sort ?? 'sku',
      filter.direction !== 'desc',
      limit === null ? null : limit + 1,
    ],
  );
  const page = limit === null ? rows : rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(({ item }) => item),
    nextCursor: last && rows.length > page.length ? `${last.lot_id}:${last.location_id}` : null,
  };
}

export async function readInventoryBalance(
  db: Db,
  context: Context,
  lotId: string,
  locationId: string,
  readable: Readonly<{ receipts: boolean; production: boolean }>,
) {
  company(context);
  const { rows } = await db.query<{ item: JsonObject }>(
    `SELECT ${INVENTORY_LEDGER_PROJECTION}||jsonb_build_object('origin',CASE
      WHEN lot.goods_receipt_id IS NOT NULL THEN jsonb_build_object('type','RECEIPT','id',lot.goods_receipt_id,'number',receipt.receipt_number)
      WHEN roll.id IS NOT NULL THEN jsonb_build_object('type','PRODUCTION_ROLL','id',roll.id,'number',CASE WHEN $5::bool THEN roll.roll_number END)
      ELSE NULL END) item
    ${INVENTORY_LEDGER_FROM}
    LEFT JOIN goods_receipts receipt ON $4::bool AND receipt.tenant_id=b.tenant_id AND receipt.id=lot.goods_receipt_id
    LEFT JOIN production_rolls roll ON roll.tenant_id=b.tenant_id AND roll.lot_id=lot.id
    WHERE b.tenant_id=$1 AND b.lot_id=$2 AND b.location_id=$3`,
    [context.actor.companyId, lotId, locationId, readable.receipts, readable.production],
  );
  return rows[0]?.item ?? null;
}
