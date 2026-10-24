import assert from 'node:assert/strict';

export function fixedMrp6000Matches(quantityText, formulaText) {
  return {
    quantity6000Matches:
      typeof quantityText === 'string' && /^建议 6000(?:\.0+)? ·/u.test(quantityText.trim()),
    rounded6000Matches:
      typeof formulaText === 'string' && /按批量取整为 6000(?:\.0+)?$/u.test(formulaText.trim()),
  };
}

// Fixed synthetic oracle inputs only. Current balances after production are not run inputs.
export async function fixedMrpInputMatches(client, companyId) {
  await client.query('SET TRANSACTION READ ONLY');
  const result = await client.query(
    `WITH runs AS (
       SELECT * FROM mrp_runs WHERE tenant_id=$1
     ), demands AS (
       SELECT d.*,i.sku FROM mrp_demand_snapshots d
       JOIN runs r ON r.id=d.mrp_run_id AND r.tenant_id=d.tenant_id
       JOIN manufacturing_item_versions v ON v.id=d.item_version_id AND v.tenant_id=d.tenant_id
       JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
     ), calculations AS (
       SELECT c.*,i.sku FROM mrp_item_calculations c
       JOIN runs r ON r.id=c.mrp_run_id AND r.tenant_id=c.tenant_id
       JOIN manufacturing_item_versions v ON v.id=c.item_version_id AND v.tenant_id=c.tenant_id
       JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
     ) SELECT
       coalesce((SELECT count(*)=1 AND bool_and(run_number='MRP-KT-2026-001'
         AND as_of='2026-08-16T00:00:00Z'::timestamptz AND horizon_end='2026-12-31'::date
         AND freeze_until='2026-08-23'::date AND status='COMPUTED') FROM runs),false) "runInputMatches",
       coalesce((SELECT count(*)=2 AND count(*) FILTER(WHERE required_at='2026-08-20')=1
         AND bool_and(sku='FG-KT-PRO-50' AND (
           (required_at='2026-08-20' AND quantity=100 AND source_type='FROZEN-DEMO'
             AND source_id IN(SELECT id FROM customers WHERE tenant_id=$1 AND customer_number='KT-P1-DEMO-001')) OR
           (required_at='2026-11-15' AND quantity=8000 AND source_type='SALES-ORDER'
             AND source_id IN(SELECT id FROM sales_orders WHERE tenant_id=$1 AND order_number='SO-KT-P1-DEMO'))
         )) FROM demands),false) "demandInputMatches",
       coalesce((SELECT count(*)=6
         AND count(DISTINCT(sku,required_at))=6
         AND count(*) FILTER(WHERE sku='RM-KT-YARN-12000')=2
         AND count(*) FILTER(WHERE sku='RM-KT-BACKING-PP')=2
         AND count(*) FILTER(WHERE sku='FG-KT-PRO-50')=2
         AND bool_and(coalesce(
           (trace->>'minimumOrderQuantity')::numeric=1000
           AND (trace->>'freezeWindowDays')::integer=7 AND (
             (sku='RM-KT-YARN-12000' AND on_hand=5000 AND safety_stock=500 AND make_or_buy='BUY'
               AND (trace->>'orderMultiple')::numeric=500 AND (trace->>'leadTimeDays')::integer=14
               AND ((required_at='2026-08-20' AND gross_demand=128.75) OR (required_at='2026-11-15' AND gross_demand=10300))) OR
             (sku='RM-KT-BACKING-PP' AND on_hand=0 AND safety_stock=1000 AND make_or_buy='BUY'
               AND (trace->>'orderMultiple')::numeric=1000 AND (trace->>'leadTimeDays')::integer=10
               AND ((required_at='2026-08-20' AND gross_demand=101) OR (required_at='2026-11-15' AND gross_demand=8080))) OR
             (sku='FG-KT-PRO-50' AND on_hand=0 AND safety_stock=0 AND make_or_buy='MAKE'
               AND (trace->>'orderMultiple')::numeric=500 AND (trace->>'leadTimeDays')::integer=7
               AND ((required_at='2026-08-20' AND gross_demand=100) OR (required_at='2026-11-15' AND gross_demand=8000)))
           ),false))
         FROM calculations),false) "calculationInventoryInputMatches",
       coalesce((SELECT count(*)=6 AND bool_and(scheduled_receipts=0) FROM calculations),false) "scheduledReceiptsInputMatches"`,
    [companyId],
  );
  assert.equal(result.rows.length, 1, 'fixed MRP inputs require one boolean observation row');
  const fields = [
    'runInputMatches',
    'demandInputMatches',
    'calculationInventoryInputMatches',
    'scheduledReceiptsInputMatches',
  ];
  const row = result.rows[0];
  assert.deepEqual(Object.keys(row).sort(), [...fields].sort(), 'fixed MRP input fields required');
  for (const field of fields) assert.equal(typeof row[field], 'boolean');
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}
