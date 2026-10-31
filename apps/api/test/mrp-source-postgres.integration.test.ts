import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresMrpRepository } from '../src/mrp-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

describe('TD-MRP-002 real sales order source validation', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  const state = () => {
    if (!fixture) throw new Error('Owned commercial fixture missing');
    return fixture;
  };
  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
  }, 30000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });
  it('accepts released tenant orders, rejects nonexistent/foreign/cancelled sources and keeps other demand kinds', async () => {
    const { db, context, otherContext, graph } = state();
    const manufactured = new PostgresManufacturingRepository(db);
    const item = await manufactured.createItem(
      {
        sku: 'SOURCE-FG',
        name: 'Source finished good',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        specification: {},
        effectiveAt: '2025-01-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    );
    if (typeof item.id !== 'string') throw new Error('Item version ID missing');
    const foreignItem = await manufactured.createItem(
      {
        sku: 'SOURCE-FOREIGN',
        name: 'Foreign finished good',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        specification: {},
        effectiveAt: '2025-01-01T00:00:00Z',
        publish: true,
      },
      otherContext,
      randomUUID(),
    );
    if (typeof foreignItem.id !== 'string') throw new Error('Foreign item version missing');
    const repository = new PostgresMrpRepository(db);
    const input = {
      itemVersionId: item.id,
      sourceType: 'SALES_ORDER',
      sourceId: graph.orderId,
      requiredAt: '2026-02-01',
      quantity: '10',
      priority: 100,
    };
    expect(await repository.createDemand(input, context, randomUUID())).toMatchObject({
      sourceType: 'SALES_ORDER',
      sourceId: graph.orderId,
    });
    const count = async () =>
      (await db.query<{ n: number }>('SELECT count(*)::int n FROM mrp_demand_signals')).rows;
    for (const [candidate, actor] of [
      [{ ...input, sourceId: randomUUID() }, context],
      [{ ...input, itemVersionId: foreignItem.id }, otherContext],
    ] as const) {
      const before = await count(),
        correlation = randomUUID();
      await expect(repository.createDemand(candidate, actor, correlation)).rejects.toMatchObject({
        code: 'conflict',
      });
      expect(await count()).toEqual(before);
      expect(
        (
          await db.query('SELECT count(*)::int n FROM audit_events WHERE correlation_id=$1', [
            correlation,
          ])
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect(
        (
          await db.query(
            'SELECT count(*)::int n FROM domain_event_outbox WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    }
    const cancelled = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO sales_orders(id,tenant_id,customer_id,opportunity_id,order_number,quote_revision_id,quote_snapshot_id,credit_decision_id,contract_revision_id,signature_evidence_id,status,currency,total,canonical_input,canonical_hash,actor_id,correlation_id,idempotency_key) SELECT $1,tenant_id,customer_id,opportunity_id,'SOURCE-CANCELLED',quote_revision_id,quote_snapshot_id,credit_decision_id,contract_revision_id,signature_evidence_id,'CANCELLED',currency,total,canonical_input,canonical_hash,actor_id,$2,$3 FROM sales_orders WHERE id=$4",
        [cancelled, randomUUID(), randomUUID(), graph.orderId],
      );
      await tx.query(
        'INSERT INTO sales_order_lines(tenant_id,sales_order_id,line_number,description,quantity,unit_price,total) SELECT tenant_id,$1,line_number,description,quantity,unit_price,total FROM sales_order_lines WHERE sales_order_id=$2',
        [cancelled, graph.orderId],
      );
    });
    const before = await count();
    await expect(
      repository.createDemand({ ...input, sourceId: cancelled }, context, randomUUID()),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await count()).toEqual(before);
    for (const sourceType of ['FORECAST', 'MANUAL_PLAN'])
      expect(
        await repository.createDemand(
          { ...input, sourceType, sourceId: randomUUID() },
          context,
          randomUUID(),
        ),
      ).toMatchObject({ sourceType });
  });
});
