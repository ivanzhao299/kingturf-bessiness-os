import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { JsonObject } from '@kingturf/types';
import type { ApiRequest } from '../src/api-types.ts';
import { buildApp, type ApiDependencies } from '../src/app.ts';
import type { Database, SqlClient } from '@kingturf/database';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresMrpRepository } from '../src/mrp-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import type { MrpRunDetailParts } from '../src/mrp-read-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// MFG-6：MRP additive 只读与桥轨写端点在真库上的契约。
// - 三个 legacy 列表的分页方法不带筛选 / 游标 / limit 时，执行的正是 legacy list 的那一条 SQL
//  （以记录 SQL 文本的仓储包装真库，逐字节比对），数据解析后逐键一致；
// - 筛选与键集游标走查（拼接后等于缺省顺序）、坏游标、作用域门、租户隔离；
// - 批次详情：根行与 calculations / proposals 两个聚合同 legacy 批次行，解释行项齐全且按读权限门控
//  （未授权的行项不发语句、不带键）；
// - 真实仓储直通真实路由：新旧两轨列表一致；桥轨写路径（政策 → 需求 → 运行 → 冻结覆盖批准 →
//  下达）与数据库守卫拒绝的 409 + 中文映射。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const ALL_PARTS: MrpRunDetailParts = {
  orderSources: true,
  bom: true,
  inventory: true,
  receipts: true,
  executions: true,
};
const NO_PARTS: MrpRunDetailParts = {
  orderSources: false,
  bom: false,
  inventory: false,
  receipts: false,
  executions: false,
};
type RepositoryDb = SqlClient & Pick<Database, 'transaction'>;
type Page = { items: readonly JsonObject[]; nextCursor: string | null };
const rows = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is JsonObject => typeof entry === 'object' && entry !== null);
};
const through = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('MRP additive reads and bridged writes on real PostgreSQL (MFG-6)', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let mrp: PostgresMrpRepository;
  let manufacturing: PostgresManufacturingRepository;
  let production: PostgresProductionRepository;
  let finishedGood: JsonObject,
    semiFinished: JsonObject,
    yarn: JsonObject,
    backing: JsonObject,
    foreign: JsonObject;
  let yarnLot: string, backingLot: string, quarantineLot: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const item = (sku: string, itemType: string, context = state().context) =>
    manufacturing.createItem(
      {
        sku,
        name: `${sku} 名称`,
        itemType,
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2025-06-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    );
  const policy = (
    itemVersionId: string,
    makeOrBuy: 'MAKE' | 'BUY',
    effectiveAt = '2025-07-01T00:00:00Z',
  ) => ({
    itemVersionId,
    safetyStock: makeOrBuy === 'BUY' ? '5' : '0',
    minimumOrderQuantity: makeOrBuy === 'BUY' ? '20' : '0',
    orderMultiple: makeOrBuy === 'BUY' ? '10' : '1',
    leadTimeDays: makeOrBuy === 'BUY' ? 2 : 7,
    freezeWindowDays: 7,
    makeOrBuy,
    effectiveAt,
  });
  const demand = (itemVersionId: string, requiredAt: string, quantity: string) => ({
    itemVersionId,
    // 显式的合成算法需求，不是商业订单夹具。
    sourceType: 'TEST_ALGORITHM',
    sourceId: randomUUID(),
    requiredAt,
    quantity,
    priority: 100,
  });
  const runInput = (runNumber: string, horizonEnd = '2026-04-01') => ({
    runNumber,
    asOf: '2026-01-01T00:00:00Z',
    horizonEnd,
  });
  const skus = (items: readonly JsonObject[]) => items.map((row) => row.sku);
  const numbers = (items: readonly JsonObject[]) => items.map((row) => row.run_number);
  // 以记录 SQL 文本的仓储包装真库：能看到每条语句的正文与实参。
  const recordingRepository = () => {
    const { db } = state();
    const executed: { sql: string; values: readonly unknown[] }[] = [];
    const recording = new PostgresMrpRepository({
      query: (sql: string, values?: readonly unknown[]) => {
        executed.push({ sql, values: values ?? [] });
        return db.query(sql, values);
      },
      transaction: db.transaction.bind(db),
    } as unknown as RepositoryDb);
    return { recording, executed };
  };
  // 直接插入库存与在途采购的夹具行（与 production-postgres 集成测试同一种做法）。
  const seedInventoryAndReceipts = async (): Promise<void> => {
    const { db } = state();
    const { companyId, employeeId } = state().context.actor;
    const location = randomUUID();
    yarnLot = randomUUID();
    backingLot = randomUUID();
    quarantineLot = randomUUID();
    const supplier = randomUUID();
    const order = randomUUID();
    await db.query(
      'INSERT INTO inventory_locations(id,tenant_id,code,name,location_type) VALUES($1,$2,$3,$4,$5)',
      [location, companyId, 'STORE-1', 'Store', 'STORAGE'],
    );
    await db.query(
      'INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,$5),($6,$2,$7,$8,$5),($9,$2,$10,$11,$12)',
      [
        yarnLot,
        companyId,
        'LOT-YARN-1',
        identifier(yarn),
        'RELEASED',
        backingLot,
        'LOT-BACKING-1',
        identifier(backing),
        quarantineLot,
        'LOT-YARN-Q',
        identifier(yarn),
        'QUARANTINE',
      ],
    );
    const movement = async (itemVersionId: string, lotId: string, quantity: number) =>
      db.query(
        "INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,$5,now(),'TEST',$6,repeat('e',64),$7,$8)",
        [
          companyId,
          itemVersionId,
          lotId,
          location,
          quantity,
          randomUUID(),
          employeeId,
          randomUUID(),
        ],
      );
    await movement(identifier(yarn), yarnLot, 50);
    await movement(identifier(yarn), quarantineLot, 500);
    await movement(identifier(backing), backingLot, 3);
    await db.query(
      "INSERT INTO suppliers(id,tenant_id,supplier_number,name,status,currency,payment_terms_days,contact,created_by) VALUES($1,$2,'SUP-MRP','MRP supplier','ACTIVE','CNY',30,'{}',$3)",
      [supplier, companyId, employeeId],
    );
    await db.query(
      "INSERT INTO purchase_orders(id,tenant_id,po_number,supplier_id,status,currency,ordered_at,canonical_hash,created_by) VALUES($1,$2,'PO-MRP-1',$3,'ISSUED','CNY',now(),repeat('f',64),$4)",
      [order, companyId, supplier, employeeId],
    );
    await db.query(
      'INSERT INTO purchase_order_lines(tenant_id,purchase_order_id,line_number,item_version_id,quantity,unit_price,required_at) VALUES($1,$2,1,$3,30,2.5,$4)',
      [companyId, order, identifier(yarn), '2026-02-10'],
    );
  };

  beforeEach(async () => {
    fixture = await ownedPostgres('mrp_read_pg');
    const { db, context } = state();
    mrp = new PostgresMrpRepository(db);
    manufacturing = new PostgresManufacturingRepository(db);
    production = new PostgresProductionRepository(db);
    finishedGood = await item('FG-MRP', 'FINISHED_GOOD');
    semiFinished = await item('SF-MRP', 'SEMI_FINISHED');
    yarn = await item('RM-MRP-YARN', 'RAW_MATERIAL');
    backing = await item('RM-MRP-BACKING', 'RAW_MATERIAL');
    foreign = await item('RM-MRP-YARN', 'RAW_MATERIAL', state().otherContext);
    for (const [code, product, lines] of [
      [
        'BOM-FG',
        finishedGood,
        [
          { componentItemVersionId: identifier(semiFinished), quantity: '2', scrapBasisPoints: 0 },
          { componentItemVersionId: identifier(backing), quantity: '1', scrapBasisPoints: 0 },
        ],
      ],
      [
        'BOM-SF',
        semiFinished,
        [{ componentItemVersionId: identifier(yarn), quantity: '3', scrapBasisPoints: 500 }],
      ],
    ] as const) {
      await manufacturing.createBom(
        {
          code,
          name: code,
          productItemId: identifier(product, 'itemId'),
          productItemVersionId: identifier(product),
          outputQuantity: '1',
          effectiveAt: '2025-06-01T00:00:00Z',
          publish: true,
          lines: lines.map((line) => ({ ...line, substitutes: [] })),
        },
        context,
        randomUUID(),
      );
    }
    // 政策：成品两版（生效日不同，用来走键集游标），其余各一版。
    await mrp.createPolicy(
      policy(identifier(finishedGood), 'MAKE', '2025-06-01T00:00:00Z'),
      context,
      randomUUID(),
    );
    await mrp.createPolicy(policy(identifier(finishedGood), 'MAKE'), context, randomUUID());
    await mrp.createPolicy(policy(identifier(semiFinished), 'MAKE'), context, randomUUID());
    await mrp.createPolicy(policy(identifier(yarn), 'BUY'), context, randomUUID());
    await mrp.createPolicy(policy(identifier(backing), 'BUY'), context, randomUUID());
    for (const [requiredAt, quantity] of [
      ['2026-01-05', '2'],
      ['2026-02-01', '10'],
      ['2026-03-01', '5'],
    ] as const) {
      const created = await mrp.createDemand(
        demand(identifier(finishedGood), requiredAt, quantity),
        context,
        randomUUID(),
      );
      void created;
    }
    await mrp.createDemand(
      demand(identifier(semiFinished), '2026-02-15', '4'),
      context,
      randomUUID(),
    );
    await seedInventoryAndReceipts();
    await mrp.run(runInput('MRP-RUN-A'), context, randomUUID());
    await mrp.run(runInput('MRP-RUN-B'), context, randomUUID());
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('缺省无参时三个列表执行的正是 legacy list 的那一条 SQL，数据解析后逐键一致（无 nextCursor）', async () => {
    const { context } = state();
    const { recording, executed } = recordingRepository();
    for (const [view, page] of [
      ['policies', 'listPolicyPage'],
      ['demands', 'listDemandPage'],
      ['runs', 'listRunPage'],
    ] as const) {
      executed.length = 0;
      const legacy = await recording.list(view, context);
      const legacyStatements = [...executed];
      executed.length = 0;
      const result = await recording[page](context, {});
      expect(executed).toEqual(legacyStatements);
      expect(executed).toHaveLength(1);
      expect(result).toEqual({ items: through(legacy), nextCursor: null });
    }
    expect(skus(await mrp.list('policies', context))).toEqual([
      'FG-MRP',
      'FG-MRP',
      'RM-MRP-BACKING',
      'RM-MRP-YARN',
      'SF-MRP',
    ]);
    expect(rows(await mrp.list('demands', context)).map((row) => row.required_at)).toEqual([
      '2026-01-05',
      '2026-02-01',
      '2026-02-15',
      '2026-03-01',
    ]);
    expect(numbers(await mrp.list('runs', context))).toEqual(['MRP-RUN-B', 'MRP-RUN-A']);
  });

  it('筛选与键集游标：每页带 nextCursor，走查拼接后等于缺省顺序；过滤只留匹配行', async () => {
    const { context } = state();
    const walk = async (
      page: (filter: JsonObject) => Promise<Page>,
      filter: JsonObject = {},
    ): Promise<JsonObject[]> => {
      const items: JsonObject[] = [];
      let cursor: string | null = null;
      for (;;) {
        const result = await page({ ...filter, ...(cursor === null ? {} : { cursor }) });
        items.push(...result.items);
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      return items;
    };
    const policies = await mrp.list('policies', context);
    const firstPolicies = await mrp.listPolicyPage(context, { limit: 2 });
    expect(firstPolicies.items).toHaveLength(2);
    expect(firstPolicies.nextCursor).toBe(identifier(firstPolicies.items[1] ?? {}));
    expect(await walk((filter) => mrp.listPolicyPage(context, filter), { limit: 2 })).toEqual(
      through(policies),
    );
    expect(skus((await mrp.listPolicyPage(context, { makeOrBuy: 'BUY' })).items)).toEqual([
      'RM-MRP-BACKING',
      'RM-MRP-YARN',
    ]);
    expect(skus((await mrp.listPolicyPage(context, { query: 'FG-m' })).items)).toEqual([
      'FG-MRP',
      'FG-MRP',
    ]);
    expect((await mrp.listPolicyPage(context, { query: 'zzz' })).items).toEqual([]);

    const demands = await mrp.list('demands', context);
    expect(await walk((filter) => mrp.listDemandPage(context, filter), { limit: 1 })).toEqual(
      through(demands),
    );
    expect(
      (await mrp.listDemandPage(context, { sourceType: 'TEST_ALGORITHM' })).items,
    ).toHaveLength(4);
    expect((await mrp.listDemandPage(context, { sourceType: 'OTHER' })).items).toEqual([]);
    expect(
      skus((await mrp.listDemandPage(context, { query: '名称' })).items).length,
    ).toBeGreaterThan(0);

    const runs = await mrp.list('runs', context);
    expect(await walk((filter) => mrp.listRunPage(context, filter), { limit: 1 })).toEqual(
      through(runs),
    );
    expect(numbers((await mrp.listRunPage(context, { query: 'RUN-a' })).items)).toEqual([
      'MRP-RUN-A',
    ]);
    expect((await mrp.listRunPage(context, { status: 'APPROVED' })).items).toEqual([]);

    // 建议列表：缺省即 legacy 批次列表摊平后的顺序与行形态；游标跨批次走查。
    const flattened = runs.flatMap((run) => rows(run.proposals));
    expect(flattened.length).toBeGreaterThan(3);
    expect(await mrp.listProposalPage(context, {})).toEqual({
      items: flattened,
      nextCursor: null,
    });
    expect(await walk((filter) => mrp.listProposalPage(context, filter), { limit: 1 })).toEqual(
      flattened,
    );
    const runA = runs.find((run) => run.run_number === 'MRP-RUN-A');
    if (!runA) throw new Error('Fixture run missing');
    expect((await mrp.listProposalPage(context, { runId: identifier(runA) })).items).toEqual(
      through(runA.proposals),
    );
    expect(new Set(flattened.map((proposal) => proposal.effectiveState))).toEqual(
      new Set(['PROPOSED']),
    );
    expect((await mrp.listProposalPage(context, { state: 'APPROVED' })).items).toEqual([]);
    const frozen = (await mrp.listProposalPage(context, { frozen: true })).items;
    const open = (await mrp.listProposalPage(context, { frozen: false })).items;
    expect(frozen.length + open.length).toBe(flattened.length);
    expect(frozen.length).toBeGreaterThan(0);
    expect(frozen.every((proposal) => proposal.frozen === true)).toBe(true);
    expect(open.every((proposal) => proposal.frozen === false)).toBe(true);
    const productions = (await mrp.listProposalPage(context, { proposalType: 'PRODUCTION' })).items;
    expect(productions.every((proposal) => proposal.proposal_type === 'PRODUCTION')).toBe(true);
    expect(productions.length).toBeGreaterThan(0);
    expect(productions.length).toBeLessThan(flattened.length);
    expect(skus((await mrp.listProposalPage(context, { query: 'YARN' })).items)).toEqual(
      skus(flattened.filter((proposal) => proposal.sku === 'RM-MRP-YARN')),
    );
  });

  it('坏游标 400；作用域门 403；其它租户读不到任何行、详情为 null；同 SKU 不串租户', async () => {
    const { context, otherContext } = state();
    for (const page of [
      () => mrp.listPolicyPage(context, { cursor: 'not-a-uuid' }),
      () => mrp.listDemandPage(context, { cursor: 'not-a-uuid' }),
      () => mrp.listRunPage(context, { cursor: 'not-a-uuid' }),
      () => mrp.listProposalPage(context, { cursor: 'not-a-uuid' }),
    ])
      await expect(page()).rejects.toMatchObject({
        code: 'invalid_request',
        message: 'cursor must be an opaque pagination token',
      });
    const team = { ...context, scopes: ['TEAM'] as const };
    for (const page of [
      () => mrp.listPolicyPage(team, {}),
      () => mrp.listDemandPage(team, {}),
      () => mrp.listRunPage(team, {}),
      () => mrp.listProposalPage(team, {}),
      () => mrp.findRun(randomUUID(), team, ALL_PARTS),
    ])
      await expect(page()).rejects.toMatchObject({
        code: 'forbidden',
        message: 'MRP planning requires company scope',
      });
    expect((await mrp.listPolicyPage(otherContext, {})).items).toEqual([]);
    expect((await mrp.listDemandPage(otherContext, {})).items).toEqual([]);
    expect((await mrp.listRunPage(otherContext, {})).items).toEqual([]);
    expect((await mrp.listProposalPage(otherContext, {})).items).toEqual([]);
    const run = (await mrp.list('runs', context))[0];
    if (!run) throw new Error('Fixture run missing');
    expect(await mrp.findRun(identifier(run), otherContext, ALL_PARTS)).toBeNull();
    expect(await mrp.findRun(randomUUID(), context, ALL_PARTS)).toBeNull();
    expect(foreign.sku).toBe('RM-MRP-YARN');
    expect(
      (await mrp.list('policies', context)).filter(
        (row) => row.item_version_id === identifier(foreign),
      ),
    ).toEqual([]);
  });

  it('批次详情：根行与两个聚合同 legacy 批次行；解释行项齐全', async () => {
    const { context } = state();
    const run = (await mrp.list('runs', context)).find(
      (candidate) => candidate.run_number === 'MRP-RUN-A',
    );
    if (!run) throw new Error('Fixture run missing');
    const { recording, executed } = recordingRepository();
    const detail = await recording.findRun(identifier(run), context, ALL_PARTS);
    for (const key of Object.keys(run))
      if (key !== 'calculations' && key !== 'proposals')
        expect(detail?.[key], `root key ${key}`).toEqual(through(run[key]));
    expect(detail?.calculations).toEqual(through(run.calculations));
    expect(detail?.proposals).toEqual(through(run.proposals));
    expect(Object.keys(detail ?? {}).sort()).toEqual(
      [
        ...Object.keys(run),
        'demandSnapshots',
        'bomEdges',
        'inventoryOffsets',
        'scheduledReceipts',
        'executions',
      ].sort(),
    );
    // 需求快照：本批次固定下来的四条需求信号；来源不是销售订单时没有订单编号与状态。
    expect(detail?.demandSnapshots).toHaveLength(4);
    expect(rows(detail?.demandSnapshots)[0]).toMatchObject({
      sku: 'FG-MRP',
      itemVersion: 1,
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'KG',
      required_at: '2026-01-05',
      quantity: 2,
      source: {
        kind: 'TEST_ALGORITHM',
        orderNumber: null,
        orderStatus: null,
      },
    });
    // 来源 id 是需求信号写入时固定的来源业务编号（这里是一条随机 UUID）。
    const source = rows(detail?.demandSnapshots)[0]?.source as { id?: unknown };
    expect(source.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);

    // BOM 展开行：与本批次计算同一规则选出的已发布 BOM 行（两层）。
    const edges = rows(detail?.bomEdges);
    expect(
      edges.map((edge) => [
        edge.parentSku,
        edge.componentSku,
        edge.quantity,
        edge.scrapBasisPoints,
      ]),
    ).toEqual([
      ['FG-MRP', 'SF-MRP', 2, 0],
      ['FG-MRP', 'RM-MRP-BACKING', 1, 0],
      ['SF-MRP', 'RM-MRP-YARN', 3, 500],
    ]);
    expect(edges[0]).toMatchObject({ bomCode: 'BOM-FG', outputQuantity: 1, lineNumber: 1 });
    expect(edges[2]).toMatchObject({
      bomCode: 'BOM-SF',
      componentItemType: 'RAW_MATERIAL',
      componentBaseUnitCode: 'KG',
    });
    // 可用库存明细：只列质量已放行的批次（待检的那批不在内）。
    expect(
      rows(detail?.inventoryOffsets).map((offset) => [
        offset.sku,
        offset.lotNumber,
        offset.quantity,
      ]),
    ).toEqual([
      ['RM-MRP-BACKING', 'LOT-BACKING-1', 3],
      ['RM-MRP-YARN', 'LOT-YARN-1', 50],
    ]);
    expect(rows(detail?.inventoryOffsets)[1]).toMatchObject({
      lotId: yarnLot,
      locationCode: 'STORE-1',
      locationName: 'Store',
      itemName: 'RM-MRP-YARN 名称',
    });
    // 在途采购：已签发未收货的采购订单行。
    expect(detail?.scheduledReceipts).toHaveLength(1);
    expect(rows(detail?.scheduledReceipts)[0]).toMatchObject({
      sku: 'RM-MRP-YARN',
      poNumber: 'PO-MRP-1',
      lineNumber: 1,
      orderedQuantity: 30,
      receivedQuantity: 0,
      openQuantity: 30,
      requiredAt: '2026-02-10',
      poStatus: 'ISSUED',
    });
    // 还没有工单引用本批次的建议。
    expect(detail?.executions).toEqual([]);
    // 需求快照只读一次（批次里固定下来的需求信号）。
    expect(
      executed.filter((entry) =>
        entry.sql.includes("jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion'"),
      ),
    ).toHaveLength(1);
  });

  it('批次详情门控：未授权的行项不发语句、不带键；按权限逐项打开', async () => {
    const { context } = state();
    const run = (await mrp.list('runs', context))[0];
    if (!run) throw new Error('Fixture run missing');
    const { recording, executed } = recordingRepository();
    const none = await recording.findRun(identifier(run), context, NO_PARTS);
    const statements = executed.map((entry) => entry.sql).join('\n');
    expect(Object.keys(none ?? {}).sort()).toEqual(
      [
        ...Object.keys(run).filter((key) => key !== 'calculations' && key !== 'proposals'),
        'calculations',
        'proposals',
        'demandSnapshots',
      ].sort(),
    );
    expect(statements).not.toMatch(/manufacturing_bom_lines/u);
    expect(statements).not.toMatch(/inventory_movements|inventory_balances/u);
    expect(statements).not.toMatch(/purchase_order_lines/u);
    expect(statements).not.toMatch(/production_orders/u);
    expect(statements).not.toMatch(/sales_orders/u);
    // 没有销售订单读权限时来源只留类型与 id。
    expect(
      Object.keys((rows(none?.demandSnapshots)[0]?.source ?? {}) as JsonObject).sort(),
    ).toEqual(['id', 'kind']);
    executed.length = 0;
    const bomOnly = await recording.findRun(identifier(run), context, { ...NO_PARTS, bom: true });
    expect(Object.keys(bomOnly ?? {})).toContain('bomEdges');
    expect(Object.keys(bomOnly ?? {})).not.toContain('inventoryOffsets');
    expect(executed.map((entry) => entry.sql).join('\n')).toMatch(/manufacturing_bom_lines/u);
    executed.length = 0;
    const sourced = await recording.findRun(identifier(run), context, {
      ...NO_PARTS,
      orderSources: true,
    });
    expect(
      Object.keys((rows(sourced?.demandSnapshots)[0]?.source ?? {}) as JsonObject).sort(),
    ).toEqual(['id', 'kind', 'orderNumber', 'orderStatus']);
    expect(executed.map((entry) => entry.sql).join('\n')).toMatch(/sales_orders/u);
  });

  it('批次详情列出引用了本批次建议的工单及其状态', async () => {
    const { context } = state();
    const run = (await mrp.list('runs', context)).find(
      (candidate) => candidate.run_number === 'MRP-RUN-B',
    );
    if (!run) throw new Error('Fixture run missing');
    const proposal = rows(run.proposals).find(
      (candidate) => candidate.proposal_type === 'PRODUCTION' && candidate.sku === 'FG-MRP',
    );
    if (!proposal) throw new Error('Fixture production proposal missing');
    // 路由经真实仓储建立并发布；工单引用已下达的建议。
    const routing = await manufacturing.createRouting(
      {
        code: 'RT-MRP',
        name: 'MRP routing',
        productItemId: identifier(finishedGood, 'itemId'),
        productItemVersionId: identifier(finishedGood),
        effectiveAt: '2025-06-01T00:00:00Z',
        publish: true,
        operations: [
          {
            sequence: 10,
            operationCode: 'CUT',
            name: 'Cut',
            workCenterCode: 'WC-1',
            setupMinutes: '1',
            runMinutesPerUnit: '1',
            instructions: {},
          },
        ],
      },
      context,
      randomUUID(),
    );
    await mrp.transitionProposal(
      identifier(proposal),
      'APPROVED',
      { reason: 'Approved', evidence: { approval: 'A-1', freezeOverrideApproval: 'O-1' } },
      context,
      randomUUID(),
    );
    await mrp.transitionProposal(
      identifier(proposal),
      'RELEASED',
      { reason: 'Released', evidence: { reference: 'R-1' } },
      context,
      randomUUID(),
    );
    const order = await production.create(
      {
        orderNumber: 'WO-MRP-1',
        itemVersionId: identifier(finishedGood),
        routingVersionId: identifier(routing),
        mrpProposalId: identifier(proposal),
        plannedQuantity: '10',
        plannedStartAt: '2026-02-01',
        plannedDueAt: '2026-02-05',
        sourceReference: 'MRP-RUN-B-PRODUCTION',
      },
      context,
      randomUUID(),
    );
    await production.transition(
      identifier(order),
      'RELEASED',
      { reason: 'Ready', evidence: {}, idempotencyKey: 'WO-MRP-1-RELEASE' },
      context,
      randomUUID(),
    );
    const detail = await mrp.findRun(identifier(run), context, {
      ...NO_PARTS,
      executions: true,
    });
    expect(detail?.executions).toEqual([
      {
        proposalId: identifier(proposal),
        orderId: identifier(order),
        orderNumber: 'WO-MRP-1',
        state: 'RELEASED',
        plannedQuantity: 10,
        plannedStartAt: '2026-02-01',
        plannedDueAt: '2026-02-05',
      },
    ]);
  });

  describe('真实仓储直通真实路由', () => {
    type Grant = { scopes: string[]; fields: null };
    type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
    type App = ReturnType<typeof buildApp>;
    const correlation = '66666666-6666-4666-8666-666666666666';
    const CAPABILITIES: readonly PermissionKey[] = [
      'mrp-policy:read',
      'mrp-policy:manage',
      'mrp:read',
      'mrp:run',
      'mrp:approve',
      'mrp:release',
    ];
    // 同一个真实仓储，分别装进不带桥（legacy 轨）与带桥的应用。
    const apps = (extra: readonly PermissionKey[] = []) => {
      const { context } = state();
      const permissions = new Map<PermissionKey, Grant>(
        [...CAPABILITIES, ...extra].map(
          (capability) => [capability, { scopes: ['COMPANY'], fields: null }] as const,
        ),
      );
      const authorization = {
        actor: context.actor,
        permissions,
      } as unknown as AuthorizationContext;
      const base: MutableDependencies = {
        auth: {
          authenticate: () => Promise.resolve(authorization),
        } as unknown as ApiDependencies['auth'],
        organizations: {} as ApiDependencies['organizations'],
        employees: {} as ApiDependencies['employees'],
        mrp,
        logger: { write: () => undefined },
      };
      const send = (app: App, request: ApiRequest) =>
        app.dispatch({
          ...request,
          headers: {
            authorization: 'Bearer mock-only-mrp-session',
            'x-correlation-id': correlation,
          },
        });
      return {
        legacy: buildApp(base),
        bridged: buildApp({
          ...base,
          commercial: {} as NonNullable<ApiDependencies['commercial']>,
        }),
        send,
      };
    };
    const post = (pathname: string, body: unknown): ApiRequest => ({
      method: 'POST',
      pathname,
      body,
    });
    const errorOf = (response: { body: unknown }) =>
      (response.body as { error: { code: string; message: string } }).error;

    it('三个列表新旧两轨逐键一致；详情与建议列表只在桥轨上存在', async () => {
      const { legacy, bridged, send } = apps();
      for (const pathname of ['/api/v1/mrp-policies', '/api/v1/mrp-demands', '/api/v1/mrp-runs']) {
        const old = await send(legacy, { method: 'GET', pathname });
        const bridgedResponse = await send(bridged, { method: 'GET', pathname });
        expect(bridgedResponse.statusCode).toBe(200);
        expect(through(bridgedResponse)).toEqual(through(old));
        expect(Object.keys(bridgedResponse.body ?? {})).toEqual(['items']);
      }
      const run = (await mrp.list('runs', state().context))[0];
      if (!run) throw new Error('Fixture run missing');
      const detail: ApiRequest = {
        method: 'GET',
        pathname: `/api/v1/mrp-runs/${identifier(run)}`,
      };
      expect((await send(legacy, detail)).statusCode).toBe(404);
      const response = await send(bridged, detail);
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ id: identifier(run), run_number: run.run_number });
      // 账号没有解释行项的读权限：详情里只有 MRP 自己的行项。
      expect(Object.keys(response.body ?? {})).not.toContain('bomEdges');
      expect(Object.keys(response.body ?? {})).toContain('demandSnapshots');
      const proposals = await send(bridged, {
        method: 'GET',
        pathname: '/api/v1/mrp-proposals',
        query: { runId: identifier(run), frozen: 'true' },
      });
      expect(proposals.statusCode).toBe(200);
      expect(
        rows((proposals.body as { items?: unknown }).items).every(
          (proposal) => proposal.frozen === true && proposal.mrp_run_id === identifier(run),
        ),
      ).toBe(true);
    });

    it('带齐读权限的账号：详情带上全部解释行项，真库输出过路由响应 schema', async () => {
      const run = (await mrp.list('runs', state().context))[0];
      if (!run) throw new Error('Fixture run missing');
      const { bridged, send } = apps([
        'sales-order:read',
        'bom:read',
        'inventory:read',
        'procurement:read',
        'production:read',
      ]);
      const response = await send(bridged, {
        method: 'GET',
        pathname: `/api/v1/mrp-runs/${identifier(run)}`,
      });
      expect(response.statusCode).toBe(200);
      expect(Object.keys(response.body ?? {}).sort()).toEqual(
        [
          ...Object.keys(run),
          'demandSnapshots',
          'bomEdges',
          'inventoryOffsets',
          'scheduledReceipts',
          'executions',
        ].sort(),
      );
      expect(rows((response.body as { bomEdges?: unknown }).bomEdges)).toHaveLength(3);
      expect(rows((response.body as { inventoryOffsets?: unknown }).inventoryOffsets)).toHaveLength(
        2,
      );
      expect(
        rows((response.body as { scheduledReceipts?: unknown }).scheduledReceipts),
      ).toHaveLength(1);
    });

    it('桥轨写路径：政策 → 需求 → 运行 → 冻结覆盖批准 → 下达；守卫拒绝映射为 409 加中文', async () => {
      const { bridged, send } = apps();
      const created = await send(
        bridged,
        post(
          '/api/v1/mrp-policies',
          policy(identifier(semiFinished), 'BUY', '2026-03-01T00:00:00Z'),
        ),
      );
      expect(created.statusCode).toBe(201);
      expect(created.body).toMatchObject({
        makeOrBuy: 'BUY',
        orderMultiple: '10',
        leadTimeDays: 2,
        effectiveAt: '2026-03-01T00:00:00.000Z',
      });
      const demandCreated = await send(
        bridged,
        post('/api/v1/mrp-demands', demand(identifier(semiFinished), '2026-03-20', '7')),
      );
      expect(demandCreated.statusCode).toBe(201);
      expect(demandCreated.body).toMatchObject({
        quantity: '7',
        priority: 100,
        sourceType: 'TEST_ALGORITHM',
      });
      // 基准日之后没有任何需求的计划期：仓储的冲突原样映射为 409（与 legacy 同一句消息）。
      const empty = await send(
        bridged,
        post('/api/v1/mrp-runs', {
          runNumber: 'MRP-RUN-EMPTY',
          asOf: '2027-01-01T00:00:00.000Z',
          horizonEnd: '2027-02-01',
        }),
      );
      expect(empty.statusCode).toBe(409);
      expect(errorOf(empty).message).toBe('MRP horizon contains no demand to calculate');
      const run = await send(bridged, post('/api/v1/mrp-runs', runInput('MRP-RUN-C')));
      expect(run.statusCode).toBe(201);
      expect(run.body).toMatchObject({ runNumber: 'MRP-RUN-C', status: 'COMPUTED' });
      const runId = identifier(run.body as JsonObject);
      const frozen = (
        await mrp.listProposalPage(state().context, { runId, frozen: true, limit: 1 })
      ).items[0];
      if (!frozen) throw new Error('Fixture frozen proposal missing');
      const decision = (action: string, evidence: Record<string, unknown>) =>
        post(`/api/v1/mrp-proposals/${identifier(frozen)}/${action}`, {
          reason: '计划员审核计算解释后批准',
          evidence,
        });
      // 冻结窗口内、没有覆盖审批编号：触发器拒绝 → 409 + 中文。
      const overrideMissing = await send(bridged, decision('approve', { approval: 'A-1' }));
      expect(overrideMissing.statusCode).toBe(409);
      expect(errorOf(overrideMissing)).toEqual({
        code: 'conflict',
        message: '冻结窗口内的建议，批准时必须提供冻结覆盖审批编号',
        correlationId: correlation,
      });
      // 待审批的建议不能直接下达 → 409 + 中文。
      const earlyRelease = await send(bridged, decision('release', { reference: 'R-1' }));
      expect(earlyRelease.statusCode).toBe(409);
      expect(errorOf(earlyRelease).message).toBe(
        '这条建议不在可做决定的状态，请刷新后查看当前状态',
      );
      const approved = await send(
        bridged,
        decision('approve', { approval: 'A-1', freezeOverrideApproval: 'O-1' }),
      );
      expect(approved.statusCode).toBe(201);
      expect(approved.body).toMatchObject({
        id: identifier(frozen),
        state: 'APPROVED',
        sequence: 2,
      });
      // 已批准的建议不能再次批准 → 409 + 中文。
      const twice = await send(
        bridged,
        decision('approve', { approval: 'A-2', freezeOverrideApproval: 'O-2' }),
      );
      expect(twice.statusCode).toBe(409);
      expect(errorOf(twice).message).toBe('已批准的建议只能下达，不能再次批准或拒绝');
      const released = await send(
        bridged,
        post(`/api/v1/mrp-proposals/${identifier(frozen)}/release`, {
          reason: '释放到执行队列',
          evidence: { reference: 'PLAN-1' },
        }),
      );
      expect(released.statusCode).toBe(201);
      expect(released.body).toMatchObject({ state: 'RELEASED', sequence: 3 });
      // 已下达的建议不可再变更 → 409 + 中文。
      const closed = await send(bridged, decision('reject', { approval: 'A-3' }));
      expect(closed.statusCode).toBe(409);
      expect(errorOf(closed).message).toBe('这条建议已结束（已驳回、已下达或已取消），不能再变更');
      const ledger = (await mrp.listProposalPage(state().context, { runId })).items.find(
        (proposal) => identifier(proposal) === identifier(frozen),
      );
      expect(rows(ledger?.events).map((event) => [event.sequence, event.state])).toEqual([
        [1, 'PROPOSED'],
        [2, 'APPROVED'],
        [3, 'RELEASED'],
      ]);
      expect(rows(ledger?.events)[1]?.evidence).toEqual({
        approval: 'A-1',
        freezeOverrideApproval: 'O-1',
      });
      expect(ledger?.effectiveState).toBe('RELEASED');
    });

    it('桥轨写路径的解析负例与 legacy 轨同码同文，且不落库', async () => {
      const { legacy, bridged, send } = apps();
      const before = await mrp.list('policies', state().context);
      for (const request of [
        post('/api/v1/mrp-policies', { ...policy(identifier(yarn), 'BUY'), makeOrBuy: 'buy' }),
        post('/api/v1/mrp-demands', demand(identifier(yarn), '2026-02-30', '5')),
        post('/api/v1/mrp-runs', {
          runNumber: 'lower',
          asOf: '2026-01-01T00:00:00.000Z',
          horizonEnd: '2026-02-01',
        }),
        post(`/api/v1/mrp-proposals/${randomUUID()}/approve`, { evidence: {} }),
      ] as const) {
        const old = await send(legacy, request);
        const bridgedResponse = await send(bridged, request);
        expect(bridgedResponse.statusCode).toBe(400);
        expect(through(bridgedResponse)).toEqual(through(old));
      }
      expect(await mrp.list('policies', state().context)).toEqual(before);
    });
  });
});
