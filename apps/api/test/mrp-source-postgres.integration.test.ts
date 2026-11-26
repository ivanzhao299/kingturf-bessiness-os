import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalize } from '@kingturf/domain';
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

  // TD-MFG-012（项目所有者裁定 2026-11-26）：SALES_ORDER 为准；SALES-ORDER 作为别名接受并归一
  // 存储为 SALES_ORDER。此前别名写法不等于 'SALES_ORDER'，绕过了「已放行销售订单」的校验。
  it('TD-MFG-012: stores the SALES-ORDER alias as SALES_ORDER and gives it the same released-order check', async () => {
    const { db, context, graph } = state();
    const item = await new PostgresManufacturingRepository(db).createItem(
      {
        sku: 'SOURCE-ALIAS',
        name: 'Alias finished good',
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
    const repository = new PostgresMrpRepository(db);
    const base = {
      itemVersionId: item.id,
      sourceId: graph.orderId,
      requiredAt: '2026-03-01',
      quantity: '4',
      priority: 100,
    };
    const aliased = await repository.createDemand(
      { ...base, sourceType: 'SALES-ORDER' },
      context,
      randomUUID(),
    );
    // 归一存储：行里与响应里都是 SALES_ORDER；内容指纹等于「同一请求用规范写法」的指纹
    // （指纹 = sha256(canonicalize(归一后的入参))，这里独立重算一遍作对照）。
    expect(aliased).toMatchObject({
      sourceType: 'SALES_ORDER',
      sourceId: graph.orderId,
      canonicalHash: createHash('sha256')
        .update(canonicalize({ ...base, sourceType: 'SALES_ORDER' }))
        .digest('hex'),
    });
    // 归一之后别名与规范写法落在同一个唯一键上：同一条需求不能换一种写法再登记一次。
    await expect(
      repository.createDemand({ ...base, sourceType: 'SALES_ORDER' }, context, randomUUID()),
    ).rejects.toMatchObject({ code: '23505' });
    const storedType = async (id: unknown) =>
      (
        await db.query<{ source_type: string }>(
          'SELECT source_type FROM mrp_demand_signals WHERE id=$1',
          [id],
        )
      ).rows[0]?.source_type;
    expect(await storedType(aliased.id)).toBe('SALES_ORDER');
    // 别名不再绕过校验：不存在或已取消的订单一律拒绝，且不留行与证据。
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
    const count = async () =>
      (await db.query<{ n: number }>('SELECT count(*)::int n FROM mrp_demand_signals')).rows[0]?.n;
    for (const sourceId of [randomUUID(), cancelled]) {
      const before = await count();
      const correlation = randomUUID();
      await expect(
        repository.createDemand(
          { ...base, sourceType: 'SALES-ORDER', sourceId },
          context,
          correlation,
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(await count()).toBe(before);
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM audit_events WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM domain_event_outbox WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    }
    // 存量行不改（本项没有迁移）：迁移之前用别名写法写入的行原样保留，读侧照旧兼容。
    const legacyId = randomUUID();
    await db.query(
      "INSERT INTO mrp_demand_signals(id,tenant_id,item_version_id,source_type,source_id,required_at,quantity,priority,created_by,canonical_hash) VALUES($1,$2,$3,'SALES-ORDER',$4,'2026-03-02','1',100,$5,$6)",
      [
        legacyId,
        context.actor.companyId,
        item.id,
        graph.orderId,
        context.actor.employeeId,
        'a'.repeat(64),
      ],
    );
    await repository.createDemand(
      { ...base, sourceType: 'SALES-ORDER', requiredAt: '2026-03-03' },
      context,
      randomUUID(),
    );
    expect(await storedType(legacyId)).toBe('SALES-ORDER');
  });
});
