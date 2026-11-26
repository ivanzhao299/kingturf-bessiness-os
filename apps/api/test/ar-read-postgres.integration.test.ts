import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@kingturf/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../src/app.js';
import { decimal, integer, permittedDto, string, timestamp, uuid } from '../src/app-values.js';
import { authorizeQuery } from '../src/policy.js';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';
import { qtcOperationalReadRoutes } from '../src/routes/qtc-operational-reads.js';
import { dispatchRoutes } from '../src/routes/types.js';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';
import { copyReleasedOrder } from './fixtures/released-order-copy.js';

// FIN-1：应收 additive 只读方法（listArPage / findArOpenItem）与桥轨端点的真库契约——SQL 仅在此处
// 真正执行（TD-TEST-022：仓储替身执行不到 SQL）。
//   · 默认无参：桥轨 GET 与旧轨路由、与 legacy 全量 list 是同一份数据（解析后逐键一致）；
//   · legacy 过滤参数：桥轨与旧轨在真库上逐键一致，并与独立 SQL 对拍；
//   · 加性 state=NOT_DUE / search：与独立 SQL 对拍（search 无通配符语义）；
//   · 详情：根行 + 销售订单摘要（门控）+ 核销分配（收款侧字段门控），与独立 SQL 对拍；
//   · 桥轨 POST 走真实仓储：守卫触发器拒绝 → 409 + 中文；未列入白名单的唯一约束 → 仍 500。
const DAY = 86_400_000;
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY).toISOString();
const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (record: Readonly<Record<string, unknown>>, ...keys: readonly string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
};
const numbers = (items: readonly JsonObject[]): readonly string[] =>
  items.map((item) => text(item, 'documentNumber'));
const ids = (items: readonly JsonObject[]): readonly string[] =>
  items.map((item) => text(item, 'id'));
const bodyOf = (response: ApiResponse | null): Record<string, unknown> => {
  if (!response || !isRecord(response.body)) throw new Error('Expected a JSON object body');
  return response.body;
};
const itemsOf = (response: ApiResponse | null): readonly JsonObject[] =>
  rowsOf(bodyOf(response).items);
const rowsOf = (value: unknown): readonly JsonObject[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

type Graph = Awaited<ReturnType<typeof ownedCommercialGraph>>;
type Grant = { scopes: string[]; fields: readonly string[] | null };
type Scope = readonly string[];

describe('FIN-1 AR open item page and detail real PostgreSQL contracts', () => {
  let fixture: Graph | undefined;
  let repository: PostgresQuoteToCashRepository;
  let customerB: string, otherCustomer: string, otherItem: string;
  // 到期日：按相对今天的天数给出；期望行序即到期日升序。
  const documents = {
    cleared: 'INV-B-CLEARED',
    graph: 'SENSITIVE-AR',
    note: 'CN-A-NOTE',
    usd: 'INV-A-USD',
    overdueB: 'INV-B-OVERDUE',
    soon: 'INV-A-SOON',
    openB: 'INV-B-OPEN',
    month: 'INV-A-MONTH',
    later: 'INV-A-LATER',
  } as const;
  const expectedOrder: readonly string[] = [
    documents.graph,
    documents.cleared,
    documents.note,
    documents.usd,
    documents.overdueB,
    documents.soon,
    documents.openB,
    documents.month,
    documents.later,
  ];
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const key = () => randomUUID();
  const post = (
    input: Parameters<PostgresQuoteToCashRepository['postAr']>[0],
    context: PostContext = state().context,
  ) => {
    const created = repository.postAr(input, key(), context, randomUUID());
    return created.then((row) => text(row, 'id'));
  };
  type PostContext = Parameters<PostgresQuoteToCashRepository['postAr']>[2];
  const invoice = (
    customerId: string,
    documentNumber: string,
    amount: string,
    dueInDays: number,
    currency = 'CNY',
    salesOrderId: string | null = null,
    documentType: 'INVOICE' | 'CREDIT_NOTE' = 'INVOICE',
    context: PostContext = state().context,
  ) =>
    post(
      {
        customerId,
        salesOrderId,
        documentNumber,
        documentType,
        currency,
        amount,
        dueAt: daysFromNow(dueInDays),
      },
      context,
    );
  // 独立 SQL：租户内全部应收行（到期日升序）。
  const sqlIds = async (
    where: string,
    values: readonly unknown[] = [],
  ): Promise<readonly string[]> =>
    (
      await state().db.query<{ id: string }>(
        `SELECT b.id FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND ${where} ORDER BY b.due_at,b.id`,
        [state().context.actor.companyId, ...values],
      )
    ).rows.map((row) => row.id);

  const authorization = (
    scopes: Scope,
    options: Readonly<{
      fields?: readonly string[] | null;
      without?: readonly PermissionKey[];
      related?: Partial<Record<'sales-order:read' | 'bank-payment:read', Grant>>;
    }> = {},
  ): AuthorizationContext => {
    const capabilities: readonly PermissionKey[] = [
      'ar:read',
      'ar:post',
      'sales-order:read',
      'bank-payment:read',
    ];
    const permissions = new Map<PermissionKey, Grant>();
    for (const capability of capabilities) {
      if (options.without?.includes(capability)) continue;
      permissions.set(capability, {
        scopes: [...scopes],
        fields: capability === 'ar:read' ? (options.fields ?? null) : null,
        ...(capability === 'sales-order:read' || capability === 'bank-payment:read'
          ? options.related?.[capability]
          : {}),
      });
    }
    return {
      actor: state().context.actor,
      permissions,
      scopeAnchors: new Map(),
    } as unknown as AuthorizationContext;
  };
  const dependencies = (): ApiDependencies =>
    ({ quoteToCash: repository, commercial: {} }) as unknown as ApiDependencies;
  // 关联 ID 落在 uuid 列上（correlation_id），与生产一致取 UUID。
  const correlationId = randomUUID();
  const request = (overrides: Partial<ApiRequest> = {}): ApiRequest => ({
    method: 'GET',
    pathname: '/api/v1/ar-open-items',
    headers: { 'x-correlation-id': correlationId },
    ...overrides,
  });
  const bridge = (req: ApiRequest, authz: AuthorizationContext): Promise<ApiResponse | null> =>
    dispatchFastifyRouteGroup(req, {
      authorization: authz,
      dependencies: dependencies(),
      correlationId,
    });
  // 旧轨路由（qtcOperationalReadRoutes）直通同一真实仓储。
  const legacyRead = async (
    authz: AuthorizationContext,
    req: ApiRequest,
    fields: readonly string[] | null,
  ): Promise<ApiResponse | null> =>
    dispatchRoutes(
      qtcOperationalReadRoutes({
        repository: () => repository,
        authorization: authz,
        authorizeQuery,
        permittedDto: (value) => permittedDto(value, fields),
        parsers: { decimal, integer, uuid, string, timestamp },
      }),
      req,
    );
  const same = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;
  const detailOf = (id: string, authz: AuthorizationContext) =>
    bridge(request({ pathname: `/api/v1/ar-open-items/${id}` }), authz);

  beforeAll(async () => {
    fixture = await ownedCommercialGraph();
    const { db, context, otherContext, reviewerEmployee, teamId, graph } = state();
    repository = new PostgresQuoteToCashRepository(db);
    const tenant = context.actor.companyId;
    // 客户乙：同租户、负责人是复核人（SELF 作用域的员工会话看不到它的应收）。
    customerB = randomUUID();
    await db.query(
      "INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES($1,$2,'FIN-B-001','财务测试客户乙','fin-b-customer','ACTIVE',$3,$4,$3,$3)",
      [customerB, tenant, reviewerEmployee, teamId],
    );
    // 外租户客户与应收：本租户的任何作用域都读不到。
    otherCustomer = randomUUID();
    await db.query(
      "INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES($1,$2,'FIN-O-001','Other tenant customer','fin-o-customer','ACTIVE',$3,(SELECT id FROM organizations WHERE organization_type='TEAM' AND owner_organization_id=$2),$3,$3)",
      [otherCustomer, otherContext.actor.companyId, otherContext.actor.employeeId],
    );
    const a = graph.customerId;
    const b = customerB;
    // 乙方的已结清样本：先只开这一张发票，收款后核销即全额分配给它。
    const clearedId = await invoice(b, documents.cleared, '100', -30);
    const payment = await repository.intakePayment(
      {
        customerId: b,
        currency: 'CNY',
        amount: '100',
        receivedAt: daysFromNow(-29),
        bankReference: `BANK-B-${randomUUID()}`,
        rawPayload: { source: 'FIN-TEST' },
      },
      key(),
      context,
      randomUUID(),
    );
    await repository.reconcile({ paymentId: text(payment, 'id') }, key(), context, randomUUID());
    const cleared = (await repository.list('ar', context)).find((row) => row.id === clearedId);
    if (text(cleared ?? {}, 'remaining_amount') !== '0')
      throw new Error('Cleared sample was not fully allocated');
    // 其余样本：甲方（演示图客户，含一张挂在已释放订单上的发票）与乙方各若干，币种与类型各异。
    await invoice(a, documents.note, '500', -10, 'CNY', null, 'CREDIT_NOTE');
    await invoice(a, documents.usd, '300', -2, 'USD');
    await invoice(b, documents.overdueB, '250', -1);
    await invoice(a, documents.soon, '1000.5', 3);
    await invoice(b, documents.openB, '70', 10);
    await invoice(a, documents.month, '2000', 20);
    await invoice(a, documents.later, '4000', 45);
    otherItem = await invoice(
      otherCustomer,
      'INV-OTHER',
      '999',
      1,
      'CNY',
      null,
      'INVOICE',
      state().otherContext,
    );
  }, 60_000);
  afterAll(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('默认无参：桥轨 GET 与旧轨路由、与 legacy 全量 list 是同一份数据（解析后逐键一致，无下一页）', async () => {
    const authz = authorization(['COMPANY']);
    const full = await repository.list('ar', state().context);
    expect(ids(full)).toEqual(await sqlIds('TRUE'));
    expect(numbers(full).slice(0, expectedOrder.length)).toEqual(expectedOrder);
    const legacy = await legacyRead(authz, request(), null);
    const bridged = await bridge(request(), authz);
    expect(bridged).toEqual(same(legacy));
    expect(bridged?.statusCode).toBe(200);
    expect(Object.keys(bodyOf(bridged))).toEqual(['items', 'nextCursor']);
    expect(bodyOf(bridged).items).toEqual(same(full));
    expect(bodyOf(bridged).nextCursor).toBeNull();
  });

  it('键集分页：显式 limit 沿游标走完，行序与全量 list 相同，游标为末行 id', async () => {
    const authz = authorization(['COMPANY']);
    const visited: string[] = [];
    const cursors: (string | null)[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const response = await bridge(
        request({ query: { limit: '3', ...(cursor ? { cursor } : {}) } }),
        authz,
      );
      expect(response?.statusCode).toBe(200);
      const body = bodyOf(response);
      visited.push(...numbers(rowsOf(body.items)));
      const next = body.nextCursor;
      if (typeof next !== 'string' && next !== null) throw new Error('Unexpected cursor shape');
      cursors.push(next);
      if (next === null) break;
      cursor = next;
    }
    expect(visited).toEqual(numbers(await repository.list('ar', state().context)));
    const allIds = await sqlIds('TRUE');
    // 末页恰好取满 limit 行：旧轨同链的既有行为——没有下一页时 nextCursor 为 null。
    expect(cursors).toEqual([allIds[2], allIds[5], null]);
    // 不存在的游标：旧轨同链的既有行为——空页。
    const ghost = await bridge(request({ query: { limit: '3', cursor: randomUUID() } }), authz);
    expect(bodyOf(ghost)).toEqual({ items: [], nextCursor: null });
  });

  const legacyFilters: readonly {
    name: string;
    query: Readonly<Record<string, string>>;
    where: string;
    values: readonly unknown[];
  }[] = [
    { name: 'state=OPEN', query: { state: 'OPEN' }, where: 'b.remaining_amount>0', values: [] },
    {
      name: 'state=CLEARED',
      query: { state: 'CLEARED' },
      where: 'b.remaining_amount=0',
      values: [],
    },
    {
      name: 'state=OVERDUE',
      query: { state: 'OVERDUE' },
      where: 'b.remaining_amount>0 AND b.due_at<now()',
      values: [],
    },
    {
      name: 'query=单据号片段',
      query: { query: 'INV-A' },
      where: `d.document_number ILIKE $2`,
      values: ['%INV-A%'],
    },
    {
      name: 'query=客户名称',
      query: { query: '客户乙' },
      where: `c.name ILIKE $2`,
      values: ['%客户乙%'],
    },
    {
      name: 'from/to 到期窗口',
      query: { from: daysFromNow(-5), to: daysFromNow(15) },
      where: 'b.due_at>=$2::timestamptz AND b.due_at<=$3::timestamptz',
      values: [new Date(daysFromNow(-5)).toISOString(), new Date(daysFromNow(15)).toISOString()],
    },
    {
      name: 'minAmount/maxAmount 余额区间',
      query: { minAmount: '70', maxAmount: '850000' },
      where: 'b.remaining_amount>=$2::numeric AND b.remaining_amount<=$3::numeric',
      values: ['70', '850000'],
    },
    {
      name: 'state + limit + cursor',
      query: { state: 'OPEN', limit: '2', cursor: '' },
      where: 'b.remaining_amount>0',
      values: [],
    },
  ];
  it.each(legacyFilters)(
    'legacy 过滤「$name」：桥轨与旧轨逐键一致，并与独立 SQL 对拍',
    async ({ query, where, values }) => {
      const authz = authorization(['COMPANY']);
      const expected = await sqlIds(where, values);
      const legacy = await legacyRead(authz, request({ query }), null);
      const bridged = await bridge(request({ query }), authz);
      expect(bridged).toEqual(same(legacy));
      expect(ids(itemsOf(bridged))).toEqual(expected.slice(0, Number(query.limit ?? 50)));
      // 旧轨同链：桥轨在未带加性参数时不触达加性方法。
      const spy = vi.spyOn(repository, 'listArPage');
      await bridge(request({ query }), authz);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    },
  );

  it('加性 state=NOT_DUE：未核销余额 > 0 且到期时间不早于当前时刻（与独立 SQL 对拍；与 OPEN 不同）', async () => {
    const authz = authorization(['COMPANY']);
    const bridged = await bridge(request({ query: { state: 'NOT_DUE' } }), authz);
    expect(bridged?.statusCode).toBe(200);
    expect(ids(itemsOf(bridged))).toEqual(await sqlIds('b.remaining_amount>0 AND b.due_at>=now()'));
    expect(numbers(itemsOf(bridged))).toEqual(
      expect.arrayContaining([documents.soon, documents.openB, documents.month, documents.later]),
    );
    const open = await bridge(request({ query: { state: 'OPEN' } }), authz);
    expect(ids(itemsOf(open))).not.toEqual(ids(itemsOf(bridged)));
    const viaRepository = await repository.listArPage(state().context, { state: 'NOT_DUE' });
    expect(ids(viaRepository.items)).toEqual(ids(itemsOf(bridged)));
  });

  it('加性 search：单据号 / 客户名称 / 销售订单号的大小写不敏感子串，无通配符语义；可叠加 legacy 过滤', async () => {
    const authz = authorization(['COMPANY']);
    const search = async (value: string, extra: Readonly<Record<string, string>> = {}) =>
      numbers(itemsOf(await bridge(request({ query: { search: value, ...extra } }), authz)));
    // 单据号（小写关键字命中大写编号）。
    expect(await search('inv-a')).toEqual([
      documents.usd,
      documents.soon,
      documents.month,
      documents.later,
    ]);
    // 客户名称。
    expect(await search('客户乙')).toEqual([
      documents.cleared,
      documents.overdueB,
      documents.openB,
    ]);
    // 销售订单号：只有挂在演示订单上的那一张。
    expect(await search('AUTH-ORDER')).toEqual([documents.graph]);
    // 字面子串：% 与 _ 不是通配符。
    expect(await search('INV%B')).toEqual([]);
    expect(await search('INV_B')).toEqual([]);
    // 叠加 legacy 过滤。
    expect(await search('inv-a', { state: 'OVERDUE' })).toEqual([documents.usd]);
    expect(await search('INV-A', { minAmount: '2000' })).toEqual([
      documents.month,
      documents.later,
    ]);
    // 去首尾空白；空白等于未传（走旧轨同链）。
    expect(await search('  AUTH-ORDER  ')).toEqual([documents.graph]);
    const spy = vi.spyOn(repository, 'listArPage');
    await bridge(request({ query: { search: '   ' } }), authz);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('加性行键：客户与订单号由 SQL 解析，金额为十进制文本，账龄天数与状态与服务端口径一致', async () => {
    const authz = authorization(['COMPANY']);
    const bridged = await bridge(request({ query: { search: 'SENSITIVE' } }), authz);
    const [row] = itemsOf(bridged);
    if (!row) throw new Error('Row missing');
    expect(row).toMatchObject({
      documentNumber: documents.graph,
      documentType: 'INVOICE',
      customerName: 'Synthetic authorization customer',
      orderNumber: 'AUTH-ORDER',
      salesOrderId: state().graph.orderId,
      originalAmount: '950000.000000',
      appliedAmount: '100000.000000',
      remainingAmount: '850000.000000',
      agingState: 'OVERDUE',
    });
    const expected = (
      await state().db.query<{ posted_ms: number; overdue: number }>(
        `SELECT floor(extract(epoch FROM d.posted_at)*1000)::bigint posted_ms,greatest(0,floor(extract(epoch FROM(now()-b.due_at))/86400))::int overdue FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id WHERE b.tenant_id=$1 AND b.id=$2`,
        [state().context.actor.companyId, text(row, 'id')],
      )
    ).rows[0];
    expect(Date.parse(text(row, 'postedAt'))).toBe(Number(expected?.posted_ms));
    expect(row.overdueDays).toBe(expected?.overdue);
    expect(typeof row.overdueDays).toBe('number');
    // 未挂订单的乙方发票：orderNumber 为 null，客户名照常解析。
    const unlinked = itemsOf(await bridge(request({ query: { search: 'INV-B-OPEN' } }), authz));
    expect(unlinked[0]).toMatchObject({
      customerName: '财务测试客户乙',
      orderNumber: null,
      salesOrderId: null,
      originalAmount: '70.000000',
      appliedAmount: '0.000000',
      remainingAmount: '70.000000',
      agingState: 'OPEN',
      overdueDays: 0,
    });
  });

  it('详情：根行与加性列表行一致；销售订单摘要与核销分配与独立 SQL 对拍', async () => {
    const authz = authorization(['COMPANY']);
    const listRow = itemsOf(await bridge(request({ query: { search: 'SENSITIVE' } }), authz))[0];
    if (!listRow) throw new Error('Row missing');
    const detail = await detailOf(text(listRow, 'id'), authz);
    expect(detail?.statusCode).toBe(200);
    const body = bodyOf(detail);
    for (const [name, value] of Object.entries(listRow)) expect(body[name]).toEqual(value);
    const orderCreatedAt = (
      await state().db.query<{ created_at: string }>(
        // to_json(...)#>>'{}' 取与 jsonb_build_object 相同的时间戳文本形态。
        "SELECT to_json(o.created_at)#>>'{}' created_at FROM sales_orders o WHERE o.id=$1 AND o.tenant_id=$2",
        [state().graph.orderId, state().context.actor.companyId],
      )
    ).rows[0]?.created_at;
    expect(body.order).toEqual({
      id: state().graph.orderId,
      orderNumber: 'AUTH-ORDER',
      status: 'RELEASED',
      currency: 'CNY',
      total: '950000.000000',
      createdAt: orderCreatedAt,
    });
    const expectedAllocations = (
      await state().db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',a.id,'amount',a.amount::text,'currency',a.currency,'allocationOrder',a.allocation_order,'createdAt',a.created_at,'reconciliationRunId',a.reconciliation_run_id,'bankPaymentId',a.bank_payment_id,'bankReference',p.bank_reference,'paymentReceivedAt',p.received_at) item FROM allocation_entries a JOIN bank_payments p ON p.tenant_id=a.tenant_id AND p.id=a.bank_payment_id WHERE a.tenant_id=$1 AND a.ar_open_item_id=$2 ORDER BY a.allocation_order,a.created_at,a.id`,
        [state().context.actor.companyId, text(listRow, 'id')],
      )
    ).rows.map((row) => row.item);
    expect(body.allocations).toEqual(expectedAllocations);
    expect(rowsOf(body.allocations)).toMatchObject([
      { amount: '100000.000000', allocationOrder: 1, bankReference: 'SENSITIVE-PAYMENT' },
    ]);
    // 未挂订单的应收没有订单摘要键；核销分配为空数组。
    const unlinked = itemsOf(await bridge(request({ query: { search: 'INV-B-OPEN' } }), authz))[0];
    if (!unlinked) throw new Error('Row missing');
    const unlinkedBody = bodyOf(await detailOf(text(unlinked, 'id'), authz));
    expect(Object.hasOwn(unlinkedBody, 'order')).toBe(false);
    expect(unlinkedBody.allocations).toEqual([]);
  });

  it('详情门控：无 sales-order:read 不带 order；无 bank-payment:read 时分配记录不带收款侧字段', async () => {
    const listRow = itemsOf(
      await bridge(request({ query: { search: 'SENSITIVE' } }), authorization(['COMPANY'])),
    )[0];
    if (!listRow) throw new Error('Row missing');
    const id = text(listRow, 'id');
    const noOrder = bodyOf(
      await detailOf(id, authorization(['COMPANY'], { without: ['sales-order:read'] })),
    );
    expect(Object.hasOwn(noOrder, 'order')).toBe(false);
    expect(noOrder.allocations).toBeDefined();
    const noPayment = bodyOf(
      await detailOf(id, authorization(['COMPANY'], { without: ['bank-payment:read'] })),
    );
    expect(Object.keys(rowsOf(noPayment.allocations)[0] ?? {}).sort()).toEqual([
      'allocationOrder',
      'amount',
      'bankPaymentId',
      'createdAt',
      'currency',
      'id',
      'reconciliationRunId',
    ]);
    // 字段授权：未列入 allowlist 的 order / allocations 随顶层一并裁掉。
    const trimmed = bodyOf(
      await detailOf(id, authorization(['COMPANY'], { fields: ['documentNumber'] })),
    );
    expect(trimmed).toEqual({ id, documentNumber: documents.graph });
  });

  it('独立关联授权：订单号搜索与订单摘要、银行引用遵守各自范围和字段授权', async () => {
    const restricted = authorization(['COMPANY'], {
      related: {
        'sales-order:read': { scopes: [], fields: null },
        'bank-payment:read': { scopes: ['COMPANY'], fields: ['received_at'] },
      },
    });
    expect(itemsOf(await bridge(request({ query: { search: 'AUTH-ORDER' } }), restricted))).toEqual(
      [],
    );
    const [row] = itemsOf(
      await bridge(request({ query: { search: documents.graph } }), restricted),
    );
    if (!row) throw new Error('Row missing');
    expect(row.orderNumber).toBeNull();
    const id = text(row, 'id');
    const body = bodyOf(await detailOf(id, restricted));
    expect(body.order).toBeUndefined();
    expect(rowsOf(body.allocations)[0]).toHaveProperty('paymentReceivedAt');
    expect(rowsOf(body.allocations)[0]).not.toHaveProperty('bankReference');

    const fieldsOnly = authorization(['COMPANY'], {
      related: {
        'sales-order:read': { scopes: ['COMPANY'], fields: ['status'] },
        'bank-payment:read': { scopes: [], fields: null },
      },
    });
    const fieldsBody = bodyOf(await detailOf(id, fieldsOnly));
    expect(fieldsBody.order).toEqual({ id: state().graph.orderId, status: 'RELEASED' });
    expect(rowsOf(fieldsBody.allocations)[0]).not.toHaveProperty('paymentReceivedAt');
    expect(rowsOf(fieldsBody.allocations)[0]).not.toHaveProperty('bankReference');
  });

  it('汇总与搜索不会披露应收字段白名单之外的信息', async () => {
    const restricted = authorization(['COMPANY'], { fields: ['documentNumber'] });
    const listed = bodyOf(await bridge(request({ query: { summary: '1' } }), restricted));
    expect(listed).not.toHaveProperty('summary');
    expect(rowsOf(listed.items)[0]).not.toHaveProperty('remainingAmount');
    expect(itemsOf(await bridge(request({ query: { search: 'AUTH-ORDER' } }), restricted))).toEqual(
      [],
    );
  });

  it('数据范围：外租户、无作用域、SELF 作用域下不可见的应收一律 404；SELF 只见自己负责客户的应收', async () => {
    const listRow = itemsOf(
      await bridge(request({ query: { search: 'INV-B-OPEN' } }), authorization(['COMPANY'])),
    )[0];
    if (!listRow) throw new Error('Row missing');
    const customerBItem = text(listRow, 'id');
    const missing = await detailOf(randomUUID(), authorization(['COMPANY']));
    expect(missing?.statusCode).toBe(404);
    const foreign = await detailOf(otherItem, authorization(['COMPANY']));
    expect(foreign?.statusCode).toBe(404);
    const selfHidden = await detailOf(customerBItem, authorization(['SELF']));
    expect(selfHidden?.statusCode).toBe(404);
    // 没有任何数据作用域 = 权限拒绝（与 legacy assertPermission 同口径），不是空结果。
    const denied = await detailOf(customerBItem, authorization([]));
    expect(denied?.statusCode).toBe(403);
    const self = await bridge(request({ query: { state: 'NOT_DUE' } }), authorization(['SELF']));
    expect(numbers(itemsOf(self))).toEqual(
      expect.arrayContaining([documents.soon, documents.month, documents.later]),
    );
    expect(numbers(itemsOf(self))).not.toContain(documents.openB);
    const deniedList = await bridge(request(), authorization([]));
    expect(deniedList?.statusCode).toBe(403);
    // 加性分页同样带数据范围谓词。
    const scoped = await repository.listArPage(
      { ...state().context, scopes: ['SELF'] },
      { search: 'INV-' },
    );
    expect(numbers(scoped.items)).toEqual([
      documents.usd,
      documents.soon,
      documents.month,
      documents.later,
    ]);
  });

  it('桥轨 POST 走真实仓储：过账后 201 并可读回；守卫拒绝 409 + 中文；唯一约束仍 500', async () => {
    const authz = authorization(['COMPANY']);
    const customerA = state().graph.customerId;
    const post = (body: JsonObject) =>
      dispatchFastifyRouteGroup(
        request({
          method: 'POST',
          body,
          headers: { 'x-correlation-id': correlationId, 'idempotency-key': randomUUID() },
        }),
        { authorization: authz, dependencies: dependencies(), correlationId },
      );
    const documentNumber = `INV-FIN-${randomUUID().slice(0, 8)}`;
    // TD-FIN-003：演示图订单已被夹具全额开票，对它再开票现在被前置校验拒绝（见
    // ar-invoice-cap-postgres.integration.test.ts）。本例验证的是过账后 201 并可读回，改用同一
    // 商业图复制出的未开票订单；下方订单号断言随之由 AUTH-ORDER 换成复制订单的订单号。
    const spareOrderNumber = 'FIN-SPARE-ORDER';
    const spare = await copyReleasedOrder(
      state().db,
      { orderId: state().graph.orderId, companyId: state().context.actor.companyId },
      spareOrderNumber,
    );
    const created = await post({
      customerId: customerA,
      salesOrderId: spare,
      documentNumber,
      documentType: 'INVOICE',
      currency: 'CNY',
      amount: '12.34',
      dueAt: daysFromNow(2),
    });
    expect(created?.statusCode).toBe(201);
    const createdId = text(bodyOf(created), 'id');
    expect(createdId).not.toBe('');
    const readBack = itemsOf(await bridge(request({ query: { search: documentNumber } }), authz));
    expect(readBack).toMatchObject([
      {
        id: createdId,
        documentNumber,
        orderNumber: spareOrderNumber,
        originalAmount: '12.340000',
        appliedAmount: '0.000000',
        remainingAmount: '12.340000',
        agingState: 'OPEN',
      },
    ]);
    // 守卫触发器 ar_document_governed_graph：单据客户与订单客户不一致。
    const mismatched = await post({
      customerId: customerB,
      salesOrderId: state().graph.orderId,
      documentNumber: `INV-FIN-${randomUUID().slice(0, 8)}`,
      documentType: 'INVOICE',
      currency: 'CNY',
      amount: '1',
      dueAt: daysFromNow(2),
    });
    expect(mismatched?.statusCode).toBe(409);
    expect(bodyOf(mismatched).error).toEqual({
      code: 'conflict',
      message: '应收单据与关联销售订单的客户或币种不一致，请核对后重试',
      correlationId,
    });
    // 未列入白名单：重复单据号（唯一约束）仍是 500，信封不含数据库原文。
    const duplicate = await post({
      customerId: customerA,
      salesOrderId: null,
      documentNumber,
      documentType: 'INVOICE',
      currency: 'CNY',
      amount: '1',
      dueAt: daysFromNow(2),
    });
    expect(duplicate?.statusCode).toBe(500);
    expect(bodyOf(duplicate).error).toEqual({
      code: 'internal_error',
      message: 'Internal server error',
      correlationId,
    });
  });

  it('summary=1：按币种汇总与独立 SQL 对拍；金额为精确十进制（超出双精度、亚分级小数都不丢）', async () => {
    const authz = authorization(['COMPANY']);
    // 精度样本（新币种 EUR，不影响前面用例的期望）：2^53+1 与 1 微单位——浮点相加会得到 …992 / 丢掉微单位。
    await invoice(state().graph.customerId, 'INV-EUR-HUGE', '9007199254740993.000001', 5, 'EUR');
    await invoice(customerB, 'INV-EUR-TINY', '0.000001', 40, 'EUR');
    const response = await bridge(request({ query: { summary: '1', state: 'CLEARED' } }), authz);
    expect(response?.statusCode).toBe(200);
    const byCurrency = Object.fromEntries(
      rowsOf(bodyOf(response).summary).map((row) => [text(row, 'currency'), row]),
    );
    // 独立 SQL（CASE WHEN 写法，不经被测语句）。
    const expected = (
      await state().db.query<{ currency: string; open: number; outstanding: string }>(
        `SELECT b.currency::text currency,sum(CASE WHEN b.remaining_amount>0 THEN 1 ELSE 0 END)::int open,sum(CASE WHEN b.remaining_amount>0 THEN b.remaining_amount ELSE 0 END)::text outstanding FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 GROUP BY b.currency ORDER BY b.currency`,
        [state().context.actor.companyId],
      )
    ).rows;
    expect(Object.keys(byCurrency).sort()).toEqual(expected.map((row) => row.currency));
    for (const row of expected) {
      const actual = byCurrency[row.currency];
      expect(text(actual ?? {}, 'openCount')).toBe(String(row.open));
      expect(text(actual ?? {}, 'outstandingAmount')).toBe(row.outstanding);
    }
    expect(byCurrency.EUR).toEqual({
      currency: 'EUR',
      openCount: 2,
      outstandingAmount: '9007199254740993.000002',
      overdueCount: 0,
      overdueAmount: '0.000000',
      due7Count: 1,
      due7Amount: '9007199254740993.000001',
      due30Count: 1,
      due30Amount: '9007199254740993.000001',
    });
    expect(text(byCurrency.EUR ?? {}, 'outstandingAmount')).not.toBe(
      String(Number('9007199254740993.000001') + Number('0.000001')),
    );
    // 已逾期 = 未核销且到期时间早于当前时刻；7 天桶含于 30 天桶（笔数与金额都不大于）。
    for (const row of rowsOf(bodyOf(response).summary)) {
      expect(Number(text(row, 'overdueCount'))).toBeLessThanOrEqual(Number(text(row, 'openCount')));
      expect(Number(text(row, 'due30Count'))).toBeLessThanOrEqual(
        Number(text(row, 'openCount')) - Number(text(row, 'overdueCount')),
      );
      expect(Number(text(row, 'due7Count'))).toBeLessThanOrEqual(Number(text(row, 'due30Count')));
      expect(text(row, 'openCount')).not.toBe('0');
    }
    // 汇总与列表口径对得上：未核销笔数 = OPEN 行数；已逾期笔数 = OVERDUE 行数。
    const open = itemsOf(
      await bridge(request({ query: { state: 'OPEN', limit: '100', summary: '1' } }), authz),
    );
    expect(open.filter((row) => text(row, 'currency') === 'CNY')).toHaveLength(
      Number(text(byCurrency.CNY ?? {}, 'openCount')),
    );
    expect(
      open.filter(
        (row) => text(row, 'currency') === 'CNY' && text(row, 'agingState') === 'OVERDUE',
      ),
    ).toHaveLength(Number(text(byCurrency.CNY ?? {}, 'overdueCount')));
    // 数据范围：SELF 只汇总自己负责客户的应收（乙方与外租户的不计入）。
    const self = bodyOf(
      await bridge(request({ query: { summary: '1' } }), authorization(['SELF'])),
    );
    const selfCny = rowsOf(self.summary).find((row) => text(row, 'currency') === 'CNY');
    expect(text(selfCny ?? {}, 'openCount')).toBe(
      String(
        open.filter(
          (row) =>
            text(row, 'currency') === 'CNY' &&
            !['财务测试客户乙', 'Other tenant customer'].includes(text(row, 'customerName')),
        ).length,
      ),
    );
  });
});
