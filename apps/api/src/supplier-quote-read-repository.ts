import type { JsonObject } from '@kingturf/types';
import { company, type Context, type Db } from './procurement-read-repositories.ts';

export const SUPPLIER_QUOTE_PROJECTION = `to_jsonb(q)||jsonb_build_object('supplierName',s.name,'rfqNumber',r.rfq_number,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lineNumber',rl.line_number,'itemVersionId',rl.item_version_id) ORDER BY rl.line_number) FROM supplier_quote_lines l JOIN procurement_rfq_lines rl ON rl.id=l.rfq_line_id AND rl.tenant_id=l.tenant_id WHERE l.supplier_quote_id=q.id AND l.tenant_id=q.tenant_id),'[]'::jsonb))`;

export const SUPPLIER_QUOTE_LIST_SQL = `SELECT ${SUPPLIER_QUOTE_PROJECTION} item FROM supplier_quotes q JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id JOIN procurement_rfqs r ON r.id=q.rfq_id AND r.tenant_id=q.tenant_id WHERE q.tenant_id=$1 ORDER BY q.received_at DESC`;

export const SUPPLIER_QUOTE_SORTS = ['received', 'reference', 'supplier', 'rfq', 'expiry'] as const;
export type SupplierQuoteFilter = Readonly<{
  query?: string | undefined;
  status?: 'VALID' | 'EXPIRED' | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  sort?: (typeof SUPPLIER_QUOTE_SORTS)[number] | undefined;
  direction?: 'asc' | 'desc' | undefined;
}>;

const SUPPLIER_QUOTE_PAGE_SQL = `WITH candidates AS (
  SELECT q.id, CASE $5::text
    WHEN 'reference' THEN q.quote_reference
    WHEN 'supplier' THEN s.name
    WHEN 'rfq' THEN r.rfq_number
    WHEN 'expiry' THEN q.valid_until::text
    ELSE (q.received_at AT TIME ZONE 'UTC')::text
  END AS sort_key
  FROM supplier_quotes q
  JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id
  JOIN procurement_rfqs r ON r.id=q.rfq_id AND r.tenant_id=q.tenant_id
  WHERE q.tenant_id=$1
    AND ($2::text IS NULL OR strpos(lower(q.quote_reference),lower($2))>0 OR strpos(lower(s.name),lower($2))>0 OR EXISTS (
      SELECT 1 FROM supplier_quote_lines l
      JOIN procurement_rfq_lines rl ON rl.id=l.rfq_line_id AND rl.tenant_id=l.tenant_id
      JOIN manufacturing_item_versions v ON v.id=rl.item_version_id AND v.tenant_id=rl.tenant_id
      JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
      WHERE l.tenant_id=q.tenant_id AND l.supplier_quote_id=q.id AND strpos(lower(i.sku),lower($2))>0
    ))
    AND ($3::text IS NULL OR ($3='VALID')=(q.valid_until >= (now() AT TIME ZONE 'Asia/Shanghai')::date))
), anchor AS (SELECT sort_key,id FROM candidates WHERE id=$4::uuid)
SELECT ${SUPPLIER_QUOTE_PROJECTION} item, c.id
FROM candidates c
JOIN supplier_quotes q ON q.id=c.id AND q.tenant_id=$1
JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id
JOIN procurement_rfqs r ON r.id=q.rfq_id AND r.tenant_id=q.tenant_id
WHERE $4::uuid IS NULL
  OR ($6::bool AND (c.sort_key,c.id)>(SELECT sort_key,id FROM anchor))
  OR (NOT $6::bool AND (c.sort_key,c.id)<(SELECT sort_key,id FROM anchor))
ORDER BY CASE WHEN $6 THEN c.sort_key END, CASE WHEN $6 THEN c.id END,
  CASE WHEN NOT $6 THEN c.sort_key END DESC, CASE WHEN NOT $6 THEN c.id END DESC
LIMIT $7`;

export async function readSupplierQuotePage(db: Db, context: Context, filter: SupplierQuoteFilter) {
  company(context);
  const limit = filter.limit ?? (filter.cursor === undefined ? null : 50);
  const { rows } = await db.query<{ item: JsonObject; id: string }>(SUPPLIER_QUOTE_PAGE_SQL, [
    context.actor.companyId,
    filter.query ?? null,
    filter.status ?? null,
    filter.cursor ?? null,
    filter.sort ?? 'received',
    filter.direction === 'asc',
    limit === null ? null : limit + 1,
  ]);
  const page = limit === null ? rows : rows.slice(0, limit);
  return {
    items: page.map(({ item }) => item),
    nextCursor: rows.length > page.length ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function readSupplierQuote(db: Db, id: string, context: Context) {
  company(context);
  const { rows } = await db.query<{ item: JsonObject }>(
    `SELECT (${SUPPLIER_QUOTE_PROJECTION})||jsonb_build_object('rfq',jsonb_build_object(
      'id',r.id,'number',r.rfq_number,'status',r.status,'currency',r.currency,'responseDueAt',r.response_due_at,
      'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',rl.id,'sku',i.sku,'name',i.name,
        'lineNumber',rl.line_number,'quantity',rl.quantity,'requiredAt',rl.required_at) ORDER BY rl.line_number)
        FROM supplier_quote_lines l
        JOIN procurement_rfq_lines rl ON rl.id=l.rfq_line_id AND rl.tenant_id=l.tenant_id
        JOIN manufacturing_item_versions v ON v.id=rl.item_version_id AND v.tenant_id=rl.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
        WHERE l.supplier_quote_id=q.id AND l.tenant_id=q.tenant_id),'[]'::jsonb))) item
    FROM supplier_quotes q
    JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id
    JOIN procurement_rfqs r ON r.id=q.rfq_id AND r.tenant_id=q.tenant_id
    WHERE q.tenant_id=$1 AND q.id=$2`,
    [context.actor.companyId, id],
  );
  return rows[0]?.item ?? null;
}
