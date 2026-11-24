import { randomUUID } from 'node:crypto';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../src/app.js';
import type { ApiRequest } from '../src/api-types.js';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.js';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import type {
  ProductionOrderPageFilter,
  ProductionOrderState,
} from '../src/production-read-repositories.js';
import { PostgresProductionCostRepository } from '../src/production-cost-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const text = (record: JsonObject, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};
const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const rows = (value: unknown): readonly JsonObject[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const numbers = (items: readonly JsonObject[]): readonly string[] =>
  items.map((item) => text(item, 'order_number'));
type TransitionState = Parameters<PostgresProductionRepository['transition']>[1];
type RepositoryDb = ConstructorParameters<typeof PostgresProductionRepository>[0];

// U3-MFG-4：工单 additive 只读方法（listProductionOrderPage / findProductionOrder）的真库
// 契约——两条方法的 SQL 仅在此处真正执行（TD-TEST-022：仓储替身执行不到 SQL）。夹具
// 经既有写路径建立一张走完整生命周期的工单与各状态样本。
describe('U3-MFG-4 production order page and detail real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresProductionRepository;
  let finished: JsonObject, material: JsonObject, routing: JsonObject;
  let closedOrder: JsonObject,
    progressOrder: JsonObject,
    releasedOrder: JsonObject,
    completedOrder: JsonObject;
  let location: string, lot: string, approver: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const reload = async (orderId: string): Promise<JsonObject> => {
    const found = (await repository.list(state().context)).find((item) => item.id === orderId);
    if (!found) throw new Error('Production order missing after write');
    return found;
  };
  const createOrder = async (orderNumber: string): Promise<JsonObject> => {
    const created = await repository.create(
      {
        orderNumber,
        itemVersionId: identifier(finished),
        routingVersionId: identifier(routing),
        plannedQuantity: '1000',
        plannedStartAt: '2026-08-13',
        plannedDueAt: '2026-08-20',
        sourceReference: `manual:${orderNumber}`,
      },
      state().context,
      randomUUID(),
    );
    return reload(identifier(created));
  };
  const transition = (order: JsonObject, target: TransitionState, key: string) =>
    repository.transition(
      identifier(order),
      target,
      { reason: `${key} reason`, evidence: { reference: key }, idempotencyKey: key },
      state().context,
      randomUUID(),
    );
  const postMaterial = (
    order: JsonObject,
    transactionType: 'ISSUE' | 'RETURN',
    quantity: string,
    key: string,
  ) =>
    repository.transactMaterial(
      identifier(order),
      {
        transactionType,
        itemVersionId: identifier(material),
        lotId: lot,
        locationId: location,
        quantity,
        reason: `${transactionType} for fixture`,
        occurredAt: '2026-08-17T08:00:00Z',
        idempotencyKey: key,
      },
      state().context,
      randomUUID(),
    );
  const operationOf = (order: JsonObject, sequence: number): string => {
    const operation = rows(order.operations).find((item) => item.sequence === sequence);
    if (!operation) throw new Error(`Operation ${String(sequence)} missing`);
    return identifier(operation);
  };
  const report = async (order: JsonObject, sequence: number, good: string, scrap: string) => {
    await repository.reportOperation(
      identifier(order),
      {
        operationId: operationOf(order, sequence),
        goodQuantity: good,
        scrapQuantity: scrap,
        laborMinutes: '60',
        machineMinutes: '55',
        startedAt: '2026-08-17T08:00:00Z',
        completedAt: '2026-08-17T09:00:00Z',
        notes: `Sequence ${String(sequence)} report`,
        idempotencyKey: `${text(order, 'order_number')}-${String(sequence)}-REPORT`,
      },
      state().context,
      randomUUID(),
    );
    return reload(identifier(order));
  };
  const receiveRoll = async (order: JsonObject, suffix: string) => {
    const finalOperation = operationOf(order, 30);
    const finalReport = rows(order.reports).find(
      (item) => item.production_order_operation_id === finalOperation,
    );
    if (!finalReport) throw new Error('Final operation report missing');
    await repository.createOutput(
      identifier(order),
      {
        operationReportId: identifier(finalReport),
        itemVersionId: identifier(finished),
        rollNumber: `ROLL-${suffix}`,
        lotNumber: `FG-LOT-${suffix}`,
        locationId: location,
        quantity: '1000',
        manufacturedAt: '2026-08-19',
      },
      state().context,
      randomUUID(),
    );
  };
  const walk = async (
    filter: ProductionOrderPageFilter,
  ): Promise<Readonly<{ visited: readonly string[]; cursors: readonly (string | null)[] }>> => {
    const visited: string[] = [];
    const cursors: (string | null)[] = [];
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const page = await repository.listProductionOrderPage(state().context, {
        ...filter,
        ...(cursor ? { cursor } : {}),
      });
      visited.push(...numbers(page.items));
      cursors.push(page.nextCursor);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    return { visited, cursors };
  };

  beforeAll(async () => {
    fixture = await ownedPostgres('production_read_pg');
    const { db, context, company, team } = state();
    repository = new PostgresProductionRepository(db);
    const manufacturing = new PostgresManufacturingRepository(db);
    const item = (sku: string, name: string, itemType: string, baseUnitCode: string) =>
      manufacturing.createItem(
        {
          sku,
          name,
          itemType,
          baseUnitCode,
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        context,
        randomUUID(),
      );
    finished = await item('FG-PRO-50', '50mm 景观草', 'FINISHED_GOOD', 'M2');
    material = await item('RM-YARN', '草纱', 'RAW_MATERIAL', 'KG');
    // BOM：每 1000 产出需草纱 1250，含 3% 损耗 → 计划 1000 的工单需求 1287.5。
    await manufacturing.createBom(
      {
        code: 'BOM-PRO-50',
        name: '50mm 景观草 BOM',
        productItemId: identifier(finished, 'itemId'),
        productItemVersionId: identifier(finished),
        outputQuantity: '1000',
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        lines: [
          {
            componentItemVersionId: identifier(material),
            quantity: '1250',
            scrapBasisPoints: 300,
            substitutes: [],
          },
        ],
      },
      context,
      randomUUID(),
    );
    // 工序按乱序给出（30/10/20）：详情各聚合必须按工序号升序返回。
    routing = await manufacturing.createRouting(
      {
        code: 'RT-PRO-50',
        name: '50mm 景观草标准工艺',
        productItemId: identifier(finished, 'itemId'),
        productItemVersionId: identifier(finished),
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        operations: [
          {
            operationCode: 'PACK',
            name: '裁切包装',
            workCenterCode: 'WC-PACK-01',
            sequence: 30,
            setupMinutes: '30',
            runMinutesPerUnit: '0.2',
            instructions: {},
          },
          {
            operationCode: 'TUFT',
            name: '簇绒',
            workCenterCode: 'WC-TUFT-01',
            sequence: 10,
            setupMinutes: '60',
            runMinutesPerUnit: '0.8',
            instructions: {},
          },
          {
            operationCode: 'COAT',
            name: '背胶',
            workCenterCode: 'WC-COAT-01',
            sequence: 20,
            setupMinutes: '45',
            runMinutesPerUnit: '0.5',
            instructions: {},
          },
        ],
      },
      context,
      randomUUID(),
    );
    // 库存：库位 + 已放行草纱批次 + 初始入库（领料门禁：已放行且属于工单 BOM 的批次物料）。
    location = randomUUID();
    lot = randomUUID();
    await db.query(
      "INSERT INTO inventory_locations(id,tenant_id,code,name,location_type) VALUES($1,$2,'PROD-1','Production','PRODUCTION')",
      [location, company],
    );
    await db.query(
      "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,'LOT-YARN-1',$3,'RELEASED')",
      [lot, company, identifier(material)],
    );
    await db.query(
      "INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,20000,now(),'TEST',$5,repeat('a',64),$6,$7)",
      [
        company,
        identifier(material),
        lot,
        location,
        randomUUID(),
        context.actor.employeeId,
        randomUUID(),
      ],
    );
    // 第二名员工：关单前的成本审批须由非计算人批准（迁移 0048）。
    approver = randomUUID();
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E2','Cost Approver','approver@production-read.test')",
      [approver, company, team],
    );

    // 样本工单：草稿 ×3、已取消、已放行、进行中、已完成、已关闭 各至少一张。
    for (const orderNumber of ['WO-DRAFT-1', 'WO-DRAFT-2', 'WO-DRAFT-3'])
      await createOrder(orderNumber);
    await transition(await createOrder('WO-CANCELLED-1'), 'CANCELLED', 'WO-CANCELLED-1-CANCEL');
    releasedOrder = await createOrder('WO-RELEASED-1');
    await transition(releasedOrder, 'RELEASED', 'WO-RELEASED-1-RELEASE');
    progressOrder = await createOrder('WO-PROGRESS-1');
    await transition(progressOrder, 'RELEASED', 'WO-PROGRESS-1-RELEASE');
    await transition(progressOrder, 'IN_PROGRESS', 'WO-PROGRESS-1-START');
    // 领料 1300 > 需求 1287.5 → 超领；仅前两道工序有报工。
    await postMaterial(progressOrder, 'ISSUE', '1300', 'WO-PROGRESS-1-ISSUE');
    progressOrder = await report(progressOrder, 10, '1000', '12.5');
    progressOrder = await report(progressOrder, 20, '400', '0');
    completedOrder = await createOrder('WO-COMPLETED-1');
    await transition(completedOrder, 'RELEASED', 'WO-COMPLETED-1-RELEASE');
    await transition(completedOrder, 'IN_PROGRESS', 'WO-COMPLETED-1-START');
    // 领料恰为需求 → 已领足。
    await postMaterial(completedOrder, 'ISSUE', '1287.5', 'WO-COMPLETED-1-ISSUE');
    for (const sequence of [30, 20, 10])
      completedOrder = await report(completedOrder, sequence, '1000', '0');
    await receiveRoll(completedOrder, 'COMPLETED-1');
    await transition(completedOrder, 'COMPLETED', 'WO-COMPLETED-1-COMPLETE');
    closedOrder = await createOrder('WO-CLOSED-1');
    await transition(closedOrder, 'RELEASED', 'WO-CLOSED-1-RELEASE');
    await transition(closedOrder, 'IN_PROGRESS', 'WO-CLOSED-1-START');
    // 领料 1287.5 后退料 2 → 净领 1285.5 < 需求 → 部分领料。
    await postMaterial(closedOrder, 'ISSUE', '1287.5', 'WO-CLOSED-1-ISSUE');
    await postMaterial(closedOrder, 'RETURN', '2', 'WO-CLOSED-1-RETURN');
    for (const sequence of [30, 20, 10])
      closedOrder = await report(closedOrder, sequence, '1000', sequence === 10 ? '12.5' : '0');
    await receiveRoll(closedOrder, 'CLOSED-1');
    await transition(closedOrder, 'COMPLETED', 'WO-CLOSED-1-COMPLETE');
    const costs = new PostgresProductionCostRepository(db);
    const policy = await costs.createPolicy(
      {
        version: 1,
        currency: 'CNY',
        laborRatePerHour: '60',
        machineRatePerHour: '120',
        overheadRatePerMachineHour: '30',
        effectiveFrom: '2026-08-01',
        sourceReference: 'COST-POLICY-1',
        materialRates: [
          { itemVersionId: identifier(material), unitCost: '5', sourceReference: 'RM-1-STD' },
        ],
      },
      context,
      randomUUID(),
    );
    const costRun = await costs.calculate(
      {
        productionOrderId: identifier(closedOrder),
        policyId: identifier(policy),
        runNumber: 'COST-WO-CLOSED-1',
        idempotencyKey: 'COST-WO-CLOSED-1-CALC',
      },
      context,
      randomUUID(),
    );
    await costs.decide(
      costRun.id,
      'APPROVED',
      {
        reason: 'Finance approved',
        evidence: { review: 'OK' },
        idempotencyKey: 'COST-WO-CLOSED-1-APPROVE',
      },
      { ...context, actor: { companyId: company, employeeId: approver } },
      randomUUID(),
    );
    await transition(closedOrder, 'CLOSED', 'WO-CLOSED-1-CLOSE');
  }, 60_000);
  afterAll(async () => {
    await fixture?.close();
  });

  // 创建顺序的倒序（legacy ORDER BY created_at DESC）。
  const ALL_NUMBERS = [
    'WO-CLOSED-1',
    'WO-COMPLETED-1',
    'WO-PROGRESS-1',
    'WO-RELEASED-1',
    'WO-CANCELLED-1',
    'WO-DRAFT-3',
    'WO-DRAFT-2',
    'WO-DRAFT-1',
  ];

  it('listProductionOrderPage with no filter is byte-identical to the legacy list and emits no cursor', async () => {
    const { context } = state();
    const page = await repository.listProductionOrderPage(context, {});
    const legacy = await repository.list(context);
    expect(JSON.stringify(page.items)).toBe(JSON.stringify(legacy));
    expect(page.nextCursor).toBeNull();
    expect(numbers(page.items)).toEqual(ALL_NUMBERS);
  });

  it('listProductionOrderPage filters by each effective state and by a literal case-insensitive keyword', async () => {
    const { context } = state();
    const expected: Readonly<Record<string, readonly string[]>> = {
      DRAFT: ['WO-DRAFT-3', 'WO-DRAFT-2', 'WO-DRAFT-1'],
      RELEASED: ['WO-RELEASED-1'],
      IN_PROGRESS: ['WO-PROGRESS-1'],
      COMPLETED: ['WO-COMPLETED-1'],
      CLOSED: ['WO-CLOSED-1'],
      CANCELLED: ['WO-CANCELLED-1'],
    };
    for (const [status, orderNumbers] of Object.entries(expected)) {
      const page = await repository.listProductionOrderPage(context, {
        state: status as ProductionOrderState,
      });
      expect(numbers(page.items)).toEqual(orderNumbers);
      expect(page.nextCursor).toBeNull();
    }
    const of = async (query: string) =>
      numbers((await repository.listProductionOrderPage(context, { query })).items);
    expect(await of('CLOSED-1')).toEqual(['WO-CLOSED-1']);
    expect(await of('pro-50')).toEqual(ALL_NUMBERS);
    expect(await of('景观草')).toEqual(ALL_NUMBERS);
    expect(await of('NO-SUCH-ORDER')).toEqual([]);
    // 状态与关键字叠加。
    expect(
      numbers(
        (await repository.listProductionOrderPage(context, { state: 'DRAFT', query: 'DRAFT-2' }))
          .items,
      ),
    ).toEqual(['WO-DRAFT-2']);
  });

  it('listProductionOrderPage keyset cursor walks the full ordered list exactly once across pages', async () => {
    const { db, context } = state();
    // 独立序：直接按排序键取全量 id，作为键集走查的期望（不依赖被测方法的输出）。
    const oracle = (
      await db.query<{ id: string; order_number: string }>(
        'SELECT o.id,o.order_number FROM production_orders o WHERE o.tenant_id=$1 ORDER BY o.created_at DESC,o.id DESC',
        [context.actor.companyId],
      )
    ).rows;
    const ids = oracle.map((row) => row.id);
    expect(oracle.map((row) => row.order_number)).toEqual(ALL_NUMBERS);
    expect(await walk({ limit: 3 })).toEqual({
      visited: ALL_NUMBERS,
      cursors: [ids[2], ids[5], null],
    });
    expect(await walk({ limit: 2 })).toEqual({
      visited: ALL_NUMBERS,
      cursors: [ids[1], ids[3], ids[5], null],
    });
    // 窗口形态与过滤叠加：仅草稿按 2 条一页走查，不重不漏。
    expect(await walk({ state: 'DRAFT', limit: 2 })).toEqual({
      visited: ['WO-DRAFT-3', 'WO-DRAFT-2', 'WO-DRAFT-1'],
      cursors: [ids[6], null],
    });
    // 游标即末行工单 id；不存在的游标返回空页且不发游标。
    expect(
      await repository.listProductionOrderPage(context, { limit: 3, cursor: randomUUID() }),
    ).toEqual({ items: [], nextCursor: null });
    // limit 越界钳制到 100：单页返回全量，不发游标。
    const clamped = await repository.listProductionOrderPage(context, { limit: 1000 });
    expect(clamped.items).toHaveLength(ALL_NUMBERS.length);
    expect(clamped.nextCursor).toBeNull();
  });

  it('listProductionOrderPage rejects malformed cursors and non-company scopes; tenants stay isolated', async () => {
    const { context, otherContext } = state();
    const malformed = repository.listProductionOrderPage(context, { cursor: 'not-a-cursor' });
    await expect(malformed).rejects.toBeInstanceOf(DomainError);
    await expect(malformed).rejects.toThrow('cursor must be an opaque pagination token');
    const team = { ...context, scopes: ['TEAM'] as const };
    await expect(repository.listProductionOrderPage(team, {})).rejects.toThrow(
      'Production execution requires company scope',
    );
    expect(await repository.listProductionOrderPage(otherContext, {})).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(
      (await repository.listProductionOrderPage(otherContext, { limit: 5 })).nextCursor,
    ).toBeNull();
  });

  it('findProductionOrder returns the root, sequence-ordered progress, report timeline and material allocation', async () => {
    const { context } = state();
    const legacy = await reload(identifier(closedOrder));
    const found = await repository.findProductionOrder(identifier(closedOrder), context, {
      materialRequirements: true,
    });
    if (!found) throw new Error('Detail missing');
    // 根行与 legacy 列表行同投影、逐字节一致。
    const { operationProgress, reportTimeline, materialRequirements, ...root } = found;
    expect(JSON.stringify(root)).toBe(JSON.stringify(legacy));
    expect(text(found, 'state')).toBe('CLOSED');
    expect(rows(found.events).map((event) => [event.state, event.sequence])).toEqual([
      ['DRAFT', 1],
      ['RELEASED', 2],
      ['IN_PROGRESS', 3],
      ['COMPLETED', 4],
      ['CLOSED', 5],
    ]);
    // legacy 投影里的数值列是 JSON 数字（to_jsonb(numeric)），不是定标字符串。
    expect(rows(found.materials).map((entry) => [entry.transaction_type, entry.quantity])).toEqual([
      ['ISSUE', 1287.5],
      ['RETURN', 2],
    ]);
    expect(rows(found.rolls).map((entry) => [entry.roll_number, entry.quantity])).toEqual([
      ['ROLL-CLOSED-1', 1000],
    ]);
    expect(found.planned_quantity).toBe(1000);
    expect(rows(operationProgress).map((item) => item.sequence)).toEqual([10, 20, 30]);
    expect(rows(operationProgress).map((item) => item.completed)).toEqual([true, true, true]);
    expect(operationProgress).toEqual([
      {
        id: operationOf(legacy, 10),
        sequence: 10,
        operationCode: 'TUFT',
        operationName: '簇绒',
        workCenter: 'WC-TUFT-01',
        plannedQuantity: 1000,
        reportedGoodQuantity: 1000,
        reportedScrapQuantity: 12.5,
        reportCount: 1,
        laborMinutes: 60,
        machineMinutes: 55,
        completed: true,
      },
      expect.objectContaining({
        id: operationOf(legacy, 20),
        operationCode: 'COAT',
        reportedGoodQuantity: 1000,
        reportedScrapQuantity: 0,
        reportCount: 1,
        completed: true,
      }),
      expect.objectContaining({
        id: operationOf(legacy, 30),
        operationCode: 'PACK',
        operationName: '裁切包装',
        workCenter: 'WC-PACK-01',
        reportedGoodQuantity: 1000,
        completed: true,
      }),
    ]);
    expect(
      rows(reportTimeline).map((item) => [
        item.sequence,
        item.operationCode,
        item.goodQuantity,
        item.scrapQuantity,
      ]),
    ).toEqual([
      [10, 'TUFT', 1000, 12.5],
      [20, 'COAT', 1000, 0],
      [30, 'PACK', 1000, 0],
    ]);
    expect(rows(reportTimeline)[0]).toMatchObject({
      productionOrderOperationId: operationOf(legacy, 10),
      laborMinutes: 60,
      machineMinutes: 55,
      startedAt: '2026-08-17T08:00:00+00:00',
      completedAt: '2026-08-17T09:00:00+00:00',
      notes: 'Sequence 10 report',
      operatorId: context.actor.employeeId,
    });
    expect(materialRequirements).toEqual([
      {
        lineNumber: 1,
        componentItemVersionId: identifier(material),
        sku: 'RM-YARN',
        itemName: '草纱',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        bomQuantity: 1250,
        scrapBasisPoints: 300,
        bomOutputQuantity: 1000,
        plannedQuantity: 1287.5,
        actualQuantity: 1285.5,
        allocationStatus: 'PARTIAL',
      },
    ]);
  });

  it('findProductionOrder reports partial progress, over-issue, issued and not-issued allocation', async () => {
    const { context } = state();
    const parts = { materialRequirements: true };
    const progress = await repository.findProductionOrder(
      identifier(progressOrder),
      context,
      parts,
    );
    expect(
      rows(progress?.operationProgress).map((item) => [
        item.sequence,
        item.completed,
        item.reportCount,
        item.reportedGoodQuantity,
        item.reportedScrapQuantity,
      ]),
    ).toEqual([
      [10, true, 1, 1000, 12.5],
      [20, false, 1, 400, 0],
      [30, false, 0, 0, 0],
    ]);
    expect(rows(progress?.reportTimeline).map((item) => item.sequence)).toEqual([10, 20]);
    expect(progress?.materialRequirements).toEqual([
      expect.objectContaining({
        plannedQuantity: 1287.5,
        actualQuantity: 1300,
        allocationStatus: 'OVER_ISSUED',
      }),
    ]);
    const completed = await repository.findProductionOrder(
      identifier(completedOrder),
      context,
      parts,
    );
    expect(text(completed ?? {}, 'state')).toBe('COMPLETED');
    expect(completed?.materialRequirements).toEqual([
      expect.objectContaining({ allocationStatus: 'ISSUED' }),
    ]);
    const released = await repository.findProductionOrder(
      identifier(releasedOrder),
      context,
      parts,
    );
    expect(released?.materialRequirements).toEqual([
      expect.objectContaining({ actualQuantity: 0, allocationStatus: 'NOT_ISSUED' }),
    ]);
    expect(
      rows(released?.operationProgress).map((item) => [
        item.sequence,
        item.completed,
        item.reportCount,
      ]),
    ).toEqual([
      [10, false, 0],
      [20, false, 0],
      [30, false, 0],
    ]);
    expect(released?.reportTimeline).toEqual([]);
  });

  it('findProductionOrder leaves the BOM aggregate unqueried without the permission gate', async () => {
    const { context, db } = state();
    // 以记录 SQL 文本的仓储包装真库：门控关闭时执行到的语句不含 BOM 表，开启时才有。
    const executed: string[] = [];
    const recording = new PostgresProductionRepository({
      query: (text: string, values?: readonly unknown[]) => {
        executed.push(text);
        return db.query(text, values);
      },
      transaction: db.transaction.bind(db),
    } as unknown as RepositoryDb);
    const ungated = await recording.findProductionOrder(identifier(closedOrder), context);
    expect(Object.hasOwn(ungated ?? {}, 'materialRequirements')).toBe(false);
    expect(rows(ungated?.operationProgress)).toHaveLength(3);
    expect(executed.some((text) => text.includes('manufacturing_bom'))).toBe(false);
    executed.length = 0;
    const gated = await recording.findProductionOrder(identifier(closedOrder), context, {
      materialRequirements: true,
    });
    expect(rows(gated?.materialRequirements)).toHaveLength(1);
    expect(executed.filter((text) => text.includes('manufacturing_bom_lines'))).toHaveLength(1);
  });

  it('findProductionOrder hides unknown ids and other tenants and keeps the company scope guard', async () => {
    const { context, otherContext } = state();
    expect(
      await repository.findProductionOrder(identifier(closedOrder), otherContext, {
        materialRequirements: true,
      }),
    ).toBeNull();
    expect(await repository.findProductionOrder(randomUUID(), context)).toBeNull();
    const team = { ...context, scopes: ['TEAM'] as const };
    await expect(repository.findProductionOrder(randomUUID(), team)).rejects.toThrow(
      'Production execution requires company scope',
    );
  });

  // 仓储替身执行不到 SQL，路由契约测试又只用替身——两层之间还需要一条「真实仓储输出能过
  // 路由响应 schema」的证明（TD-TEST-022 的教训：加性 SQL 只被替身执行，线上 500）。
  it('real repository output passes the Fastify route schemas and the bridged write path', async () => {
    const { context } = state();
    type Grant = Readonly<{ fields: readonly string[] | null; scopes: readonly string[] }>;
    const authorize = (...capabilities: readonly PermissionKey[]) =>
      ({
        actor: context.actor,
        permissions: new Map<PermissionKey, Grant>(
          capabilities.map((capability) => [capability, { scopes: ['COMPANY'], fields: null }]),
        ),
      }) as unknown as AuthorizationContext;
    const dependencies = { production: repository, commercial: {} } as unknown as ApiDependencies;
    const send = (
      request: ApiRequest,
      authorization = authorize('production:read', 'bom:read', 'production:plan'),
    ) =>
      dispatchFastifyRouteGroup(request, {
        authorization,
        dependencies,
        correlationId: randomUUID(),
      });
    const body = (response: { body: unknown } | null) => (response?.body ?? {}) as JsonObject;

    const listed = await send({ method: 'GET', pathname: '/api/v1/production-orders' });
    expect(listed?.statusCode).toBe(200);
    expect(Object.keys(body(listed))).toEqual(['items']);
    // 与 legacy 轨解析后逐键一致。线上 JSON 文本的键序不同：桥轨经 zod 序列化器按 schema
    // 键序输出、未声明键在后——这是自 U3-COM-2 起全部桥轨端点的既有性质（对
    // manufacturing-routings 同样成立），JSON 对象键序无语义；此处钉定差异仅限键序。
    const legacyItems = await repository.list(context);
    expect(body(listed).items).toEqual(legacyItems);
    expect(rows(body(listed).items).map((item) => Object.keys(item).sort())).toEqual(
      legacyItems.map((item) => Object.keys(item).sort()),
    );
    const paged = await send({
      method: 'GET',
      pathname: '/api/v1/production-orders',
      query: { state: 'DRAFT', query: 'draft', limit: '2' },
    });
    expect(paged?.statusCode).toBe(200);
    expect(rows(body(paged).items).map((item) => item.order_number)).toEqual([
      'WO-DRAFT-3',
      'WO-DRAFT-2',
    ]);
    expect(body(paged).nextCursor).toBeTypeOf('string');
    const nextPage = await send({
      method: 'GET',
      pathname: '/api/v1/production-orders',
      query: {
        state: 'DRAFT',
        query: 'draft',
        limit: '2',
        cursor: text(body(paged), 'nextCursor'),
      },
    });
    expect(rows(body(nextPage).items).map((item) => item.order_number)).toEqual(['WO-DRAFT-1']);
    expect(Object.hasOwn(body(nextPage), 'nextCursor')).toBe(false);

    for (const sample of [closedOrder, progressOrder, releasedOrder, completedOrder]) {
      const detailed = await send({
        method: 'GET',
        pathname: `/api/v1/production-orders/${identifier(sample)}`,
      });
      expect(detailed?.statusCode).toBe(200);
      expect(rows(body(detailed).operationProgress)).toHaveLength(3);
      expect(rows(body(detailed).materialRequirements)).toHaveLength(1);
    }
    const ungated = await send(
      { method: 'GET', pathname: `/api/v1/production-orders/${identifier(closedOrder)}` },
      authorize('production:read'),
    );
    expect(ungated?.statusCode).toBe(200);
    expect(Object.hasOwn(body(ungated), 'materialRequirements')).toBe(false);
    const missing = await send({
      method: 'GET',
      pathname: `/api/v1/production-orders/${randomUUID()}`,
    });
    expect(missing?.statusCode).toBe(404);

    const created = await send({
      method: 'POST',
      pathname: '/api/v1/production-orders',
      body: {
        orderNumber: 'WO-BRIDGED-1',
        itemVersionId: identifier(finished),
        routingVersionId: identifier(routing),
        plannedQuantity: '500',
        plannedStartAt: '2026-09-01',
        plannedDueAt: '2026-09-08',
        // 经路由须过 assertStableCode（大写字母/数字/下划线/连字符）。
        sourceReference: 'WO-BRIDGED-1-SOURCE',
      },
    });
    expect(created?.statusCode).toBe(201);
    expect(body(created).state).toBe('DRAFT');
    const released = await send({
      method: 'PUT',
      pathname: `/api/v1/production-orders/${text(body(created), 'id')}/state`,
      body: {
        action: 'release',
        reason: 'Ready',
        evidence: {},
        idempotencyKey: 'WO-BRIDGED-1-RELEASE',
      },
    });
    expect(released?.statusCode).toBe(201);
    expect(body(released)).toMatchObject({ state: 'RELEASED', sequence: 2 });
    // DB 触发器仍是状态机权威：已放行的工单再次下达被拒（500 不外泄内部细节）。
    const repeated = await send({
      method: 'PUT',
      pathname: `/api/v1/production-orders/${text(body(created), 'id')}/state`,
      body: {
        action: 'release',
        reason: 'Again',
        evidence: {},
        idempotencyKey: 'WO-BRIDGED-1-RELEASE-2',
      },
    });
    expect(repeated?.statusCode).toBe(500);
    expect((body(repeated).error as JsonObject).code).toBe('internal_error');
    expect(text(await reload(text(body(created), 'id')), 'state')).toBe('RELEASED');
  });
});
