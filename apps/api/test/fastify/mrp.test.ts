import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import { buildApp, type ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// MFG-6：MRP Fastify 组契约测试——四个列表（缺省时过滤对象为空、无 nextCursor 键；筛选 / 游标 /
// limit 透传）、批次详情（additive，解释行项按读权限门控）、四个写端点（legacy 同解析链：入参
// oracle 与负例消息逐字一致）、建议决定的守卫拒绝映射（白名单 P0001 → 409 + 中文；其余 500 并
// 留诊断日志）、依赖缺失 503、未认领方法落回 null；以及新旧轨对等组。
const tenant = '11111111-1111-4111-8111-111111111111';
const itemVersion = '22222222-2222-4222-8222-222222222222';
const runId = '33333333-3333-4333-8333-333333333333';
const proposalId = '44444444-4444-4444-8444-444444444444';
const sourceId = '55555555-5555-4555-8555-555555555555';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const correlationId = 'corr-1';
const hash = 'a'.repeat(64);
const codeMessage = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';

type Row = Record<string, unknown>;
const policyRow: Row = {
  id: 'policy-1',
  tenant_id: tenant,
  item_version_id: itemVersion,
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  itemVersion: 1,
  make_or_buy: 'MAKE',
  safety_stock: 0,
  minimum_order_quantity: 1000,
  order_multiple: 500,
  lead_time_days: 7,
  freeze_window_days: 7,
  effective_at: '2026-01-01T00:00:00+00:00',
  created_by: 'e-1',
  created_at: '2026-11-25T04:53:55.165599+00:00',
  canonical_hash: hash,
};
const demandRow: Row = {
  id: 'demand-1',
  tenant_id: tenant,
  item_version_id: itemVersion,
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  itemVersion: 1,
  source_type: 'SALES-ORDER',
  source_id: sourceId,
  required_at: '2026-11-15',
  quantity: 8000,
  priority: 10,
  created_by: 'e-1',
  created_at: '2026-11-25T04:53:55.357502+00:00',
  canonical_hash: hash,
};
const explanation: Row = {
  grossDemand: 100,
  safetyStock: 0,
  onHand: 0,
  scheduledReceipts: 0,
  netRequirement: 100,
  plannedQuantity: 1000,
  freezeUntil: '2026-08-23',
  leadTimeDays: 7,
  orderMultiple: 500,
  minimumOrderQuantity: 1000,
  freezeWindowDays: 7,
};
const event = (sequence: number, state: string, reason: string, evidence: unknown): Row => ({
  id: `event-${String(sequence)}`,
  tenant_id: tenant,
  proposal_id: proposalId,
  sequence,
  state,
  reason,
  evidence,
  actor_id: 'e-1',
  correlation_id: correlationId,
  canonical_hash: hash,
  created_at: '2026-11-25T04:53:55.519212+00:00',
});
const proposalRow: Row = {
  id: proposalId,
  tenant_id: tenant,
  mrp_run_id: runId,
  calculation_id: 'calc-1',
  item_version_id: itemVersion,
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  proposal_type: 'PRODUCTION',
  quantity: 1000,
  start_at: '2026-08-13',
  due_at: '2026-08-20',
  frozen: true,
  explanation,
  effectiveState: 'RELEASED',
  canonical_hash: hash,
  created_at: '2026-11-25T04:53:55.432139+00:00',
  events: [
    event(1, 'PROPOSED', 'Deterministic MRP calculation', explanation),
    event(2, 'APPROVED', '冻结窗口内由计划经理批准', {
      approval: 'MRP-APPROVAL-1',
      freezeOverrideApproval: 'FREEZE-OVERRIDE-1',
    }),
    event(3, 'RELEASED', '释放到执行队列', { releaseBatch: 'MRP-KT-2026-001' }),
  ],
};
const calculation: Row = {
  id: 'calc-1',
  tenant_id: tenant,
  mrp_run_id: runId,
  item_version_id: itemVersion,
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  required_at: '2026-08-20',
  gross_demand: 100,
  on_hand: 0,
  scheduled_receipts: 0,
  safety_stock: 0,
  net_requirement: 100,
  planned_quantity: 1000,
  make_or_buy: 'MAKE',
  policy_id: 'policy-1',
  trace: { leadTimeDays: 7, orderMultiple: 500 },
  canonical_hash: hash,
};
const runRoot: Row = {
  id: runId,
  tenant_id: tenant,
  run_number: 'MRP-KT-2026-001',
  status: 'COMPUTED',
  as_of: '2026-08-16T00:00:00+00:00',
  horizon_end: '2026-12-31',
  freeze_until: '2026-08-23',
  input_hash: hash,
  computed_at: '2026-11-25T04:53:55.432139+00:00',
  approved_at: null,
  created_by: 'e-1',
  created_at: '2026-11-25T04:53:55.432139+00:00',
};
const runRow: Row = { ...runRoot, calculations: [calculation], proposals: [proposalRow] };
const snapshotRow: Row = {
  ...demandRow,
  id: 'snapshot-1',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  source: {
    kind: 'SALES_ORDER',
    id: sourceId,
    orderNumber: 'SO-KT-P1-DEMO',
    orderStatus: 'RELEASED',
  },
};
const executionRow: Row = {
  proposalId,
  orderId: 'order-1',
  orderNumber: 'WO-KT-2026-001',
  state: 'CLOSED',
  plannedQuantity: 1000,
  plannedStartAt: '2026-08-13',
  plannedDueAt: '2026-08-20',
};
const runDetail: Row = {
  ...runRoot,
  calculations: [calculation],
  proposals: [proposalRow],
  demandSnapshots: [snapshotRow],
  bomEdges: [],
  inventoryOffsets: [],
  scheduledReceipts: [],
  executions: [executionRow],
};

const policyBody = {
  itemVersionId: itemVersion,
  safetyStock: ' 500.000000 ',
  minimumOrderQuantity: ' 1000 ',
  orderMultiple: ' 500 ',
  leadTimeDays: 14,
  freezeWindowDays: 7,
  makeOrBuy: ' BUY ',
  effectiveAt: '2026-01-01T08:00:00+08:00',
};
const policyInput: Row = {
  itemVersionId: itemVersion,
  safetyStock: '500',
  minimumOrderQuantity: '1000',
  orderMultiple: '500',
  leadTimeDays: 14,
  freezeWindowDays: 7,
  makeOrBuy: 'BUY',
  effectiveAt: '2026-01-01T00:00:00.000Z',
};
const policyCreated: Row = { id: 'created-1', canonicalHash: hash, ...policyInput };
const demandBody = {
  itemVersionId: itemVersion,
  sourceType: ' SALES-FORECAST ',
  sourceId,
  requiredAt: ' 2026-11-15 ',
  quantity: ' 8000.000000 ',
  priority: 10,
};
const demandInput: Row = {
  itemVersionId: itemVersion,
  sourceType: 'SALES-FORECAST',
  sourceId,
  requiredAt: '2026-11-15',
  quantity: '8000',
  priority: 10,
};
const demandCreated: Row = { id: 'created-2', canonicalHash: hash, ...demandInput };
const runBody = {
  runNumber: ' MRP-KT-2026-002 ',
  asOf: '2026-01-01T08:00:00+08:00',
  horizonEnd: ' 2026-12-31 ',
};
const runInput: Row = {
  runNumber: 'MRP-KT-2026-002',
  asOf: '2026-01-01T00:00:00.000Z',
  horizonEnd: '2026-12-31',
};
const runCreated: Row = {
  id: 'created-3',
  status: 'COMPUTED',
  freezeUntil: '2026-01-08',
  inputHash: hash,
  calculationCount: 6,
  proposalCount: 5,
  ...runInput,
};
const decisionBody = { reason: ' Planner reason ', evidence: { nested: { keep: true } } };
const decisionInput = { reason: 'Planner reason', evidence: decisionBody.evidence };
const decided = (state: string): Row => ({ id: proposalId, state, sequence: 2, ...decisionInput });
// 与 legacy mrp-proposal-commands.ts 的 states 表同值（动作 → 目标状态 + 能力键）。
const PROPOSAL_ACTIONS = [
  ['approve', 'APPROVED', 'mrp:approve'],
  ['reject', 'REJECTED', 'mrp:approve'],
  ['release', 'RELEASED', 'mrp:release'],
  ['cancel', 'CANCELLED', 'mrp:approve'],
] as const;

type Repository = NonNullable<ApiDependencies['mrp']>;
type MockCall = (...args: unknown[]) => Promise<unknown>;
type Mock = ReturnType<typeof vi.fn<MockCall>>;
type Overrides = Partial<Record<string, Mock>>;
type WriteMethod = 'createPolicy' | 'createDemand' | 'run' | 'transitionProposal';
const calls: { method: string; args: unknown[] }[] = [];
const tracked = (method: string, result: unknown): Mock =>
  vi.fn<MockCall>((...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve(result);
  });
// 仓储抛错的替身：以给定原因拒绝（非 Error 的原因包成 Error）。
const rejectedWith = (cause: unknown): Mock =>
  vi.fn<MockCall>(() => Promise.reject(cause instanceof Error ? cause : new Error(String(cause))));
// 第 index 次仓储调用的实参。
const argsOf = (index: number): unknown[] => calls[index]?.args ?? [];

const repository = (overrides: Overrides = {}): Repository =>
  ({
    list: tracked('list', [policyRow]),
    listPolicyPage: tracked('listPolicyPage', { items: [policyRow], nextCursor: null }),
    listDemandPage: tracked('listDemandPage', { items: [demandRow], nextCursor: null }),
    listRunPage: tracked('listRunPage', { items: [runRow], nextCursor: null }),
    listProposalPage: tracked('listProposalPage', { items: [proposalRow], nextCursor: null }),
    findRun: tracked('findRun', runDetail),
    createPolicy: tracked('createPolicy', policyCreated),
    createDemand: tracked('createDemand', demandCreated),
    run: tracked('run', runCreated),
    transitionProposal: tracked('transitionProposal', decided('APPROVED')),
    ...overrides,
  }) as unknown as Repository;

type Grant = { scopes: string[]; fields: readonly string[] | null };
const grant = (fields: readonly string[] | null = null): Grant => ({ scopes: ['COMPANY'], fields });
const GATING_READS: readonly PermissionKey[] = [
  'sales-order:read',
  'bom:read',
  'inventory:read',
  'procurement:read',
  'production:read',
];
type ScopeOptions = Readonly<{
  policyFields?: readonly string[] | null;
  fields?: readonly string[] | null;
  // 缺省带齐五项解释行项的读权限；false 表示一项都没有。
  gating?: boolean;
}>;
// commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。logger 收 5xx 的诊断记录。
const dependencyScope = (mrp: Repository | null): ApiDependencies =>
  ({ mrp, commercial: {}, logger: { write: vi.fn() } }) as unknown as ApiDependencies;
const scopeFor = (repo: Repository | null = repository(), options: ScopeOptions = {}) => {
  const permissions = new Map<PermissionKey, Grant>([
    ['mrp-policy:read', grant(options.policyFields === undefined ? null : options.policyFields)],
    ['mrp-policy:manage', grant()],
    ['mrp:read', grant(options.fields === undefined ? null : options.fields)],
    ['mrp:run', grant()],
    ['mrp:approve', grant()],
    ['mrp:release', grant()],
  ]);
  if (options.gating !== false)
    for (const capability of GATING_READS) permissions.set(capability, grant());
  return {
    authorization: { actor, permissions } as unknown as AuthorizationContext,
    dependencies: dependencyScope(repo),
    correlationId,
  };
};
type Scope = ReturnType<typeof scopeFor>;
type Logger = { write: Mock };
const loggerOf = (scope: Scope): Mock => (scope.dependencies.logger as unknown as Logger).write;
const without = (scope: Scope, ...capabilities: PermissionKey[]): Scope => {
  for (const capability of capabilities)
    (scope.authorization.permissions as Map<PermissionKey, Grant>).delete(capability);
  return scope;
};

type RequestInit = Partial<ApiRequest> & { pathname?: string; query?: Record<string, string> };
const requestFor = (overrides: RequestInit = {}): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/mrp-policies',
  headers: { 'x-correlation-id': correlationId },
  ...overrides,
});
const post = (pathname: string, body: unknown): ApiRequest =>
  requestFor({ method: 'POST', pathname, body });
const decisionRequest = (action = 'approve', body: unknown = decisionBody): ApiRequest =>
  post(`/api/v1/mrp-proposals/${proposalId}/${action}`, body);
type Response = { statusCode: number; body: unknown } | null;
const errorOf = (response: Response) =>
  (response?.body as { error: { code: string; message: string } }).error;
const bodyOf = (response: Response) => (response?.body ?? {}) as Record<string, unknown>;
const itemsOf = (response: Response) => bodyOf(response).items as Row[];

afterEach(() => {
  calls.length = 0;
});

describe('mrp fastify bridge track: lists', () => {
  it('GET 三个 legacy 列表缺省全量：过滤对象为空、无 nextCursor 键、响应即 { items }', async () => {
    const cases = [
      ['/api/v1/mrp-policies', 'listPolicyPage', policyRow],
      ['/api/v1/mrp-demands', 'listDemandPage', demandRow],
      ['/api/v1/mrp-runs', 'listRunPage', runRow],
    ] as const;
    for (const [pathname, method, row] of cases) {
      calls.length = 0;
      const response = await dispatchFastifyRouteGroup(requestFor({ pathname }), scopeFor());
      expect(response?.statusCode).toBe(200);
      expect(response?.body).toEqual({ items: [row] });
      expect(Object.keys(bodyOf(response))).toEqual(['items']);
      expect(calls).toEqual([{ method, args: [scopeContext, {}] }]);
    }
  });

  it('GET 建议列表缺省：全部批次、过滤对象为空、无 nextCursor 键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/mrp-proposals' }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [proposalRow] });
    expect(Object.keys(bodyOf(response))).toEqual(['items']);
    expect(calls).toEqual([{ method: 'listProposalPage', args: [scopeContext, {}] }]);
  });

  it('GET 列表筛选 / 游标 / limit 透传；有下一页时附 nextCursor', async () => {
    const policyCursor = String(policyRow.id);
    const proposalCursor = String(proposalRow.id);
    const page = (row: Row, nextCursor: string | null) => ({ items: [row], nextCursor });
    const scope = scopeFor(
      repository({
        listPolicyPage: tracked('listPolicyPage', page(policyRow, policyCursor)),
        listDemandPage: tracked('listDemandPage', page(demandRow, null)),
        listRunPage: tracked('listRunPage', page(runRow, null)),
        listProposalPage: tracked('listProposalPage', page(proposalRow, proposalCursor)),
      }),
    );
    const cases: readonly {
      request: RequestInit;
      method: string;
      filter: Row;
      body: Row;
    }[] = [
      {
        request: {
          pathname: '/api/v1/mrp-policies',
          query: { query: ' PRO-50 ', makeOrBuy: 'MAKE', cursor: policyCursor, limit: '50' },
        },
        method: 'listPolicyPage',
        filter: { makeOrBuy: 'MAKE', query: 'PRO-50', limit: 50, cursor: policyCursor },
        body: { items: [policyRow], nextCursor: policyCursor },
      },
      {
        request: {
          pathname: '/api/v1/mrp-demands',
          query: { query: ' 草纱 ', sourceType: 'SALES-ORDER', limit: '1' },
        },
        method: 'listDemandPage',
        filter: { sourceType: 'SALES-ORDER', query: '草纱', limit: 1 },
        body: { items: [demandRow] },
      },
      {
        request: {
          pathname: '/api/v1/mrp-runs',
          query: { status: 'COMPUTED', query: '2026', limit: '100' },
        },
        method: 'listRunPage',
        filter: { status: 'COMPUTED', query: '2026', limit: 100 },
        body: { items: [runRow] },
      },
      {
        request: {
          pathname: '/api/v1/mrp-proposals',
          query: {
            runId,
            state: 'APPROVED',
            frozen: 'true',
            freezeOverride: 'true',
            type: 'PURCHASE',
            query: ' RM-KT ',
            cursor: proposalCursor,
            limit: '20',
          },
        },
        method: 'listProposalPage',
        filter: {
          runId,
          state: 'APPROVED',
          frozen: true,
          freezeOverride: true,
          proposalType: 'PURCHASE',
          query: 'RM-KT',
          limit: 20,
          cursor: proposalCursor,
        },
        body: { items: [proposalRow], nextCursor: proposalCursor },
      },
    ];
    for (const entry of cases) {
      calls.length = 0;
      const response = await dispatchFastifyRouteGroup(requestFor(entry.request), scope);
      expect(response?.statusCode).toBe(200);
      expect(response?.body).toEqual(entry.body);
      expect(calls).toEqual([{ method: entry.method, args: [scopeContext, entry.filter] }]);
    }
    // frozen=false 与缺省是两回事：显式 false 透传为布尔值。
    calls.length = 0;
    await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/mrp-proposals', query: { frozen: 'false' } }),
      scopeFor(),
    );
    expect(calls).toEqual([
      { method: 'listProposalPage', args: [scopeContext, { frozen: false }] },
    ]);
  });

  it('GET 列表查询参数负例映射 400 invalid_request（不触达仓储）', async () => {
    const negatives: readonly (readonly [string, Record<string, string>])[] = [
      ['/api/v1/mrp-policies', { makeOrBuy: 'MAKE_OR_BUY' }],
      ['/api/v1/mrp-policies', { query: '' }],
      ['/api/v1/mrp-policies', { query: '   ' }],
      ['/api/v1/mrp-policies', { limit: '0' }],
      ['/api/v1/mrp-policies', { limit: '101' }],
      ['/api/v1/mrp-policies', { limit: 'abc' }],
      ['/api/v1/mrp-policies', { limit: '1.5' }],
      ['/api/v1/mrp-policies', { cursor: '' }],
      ['/api/v1/mrp-demands', { sourceType: '' }],
      ['/api/v1/mrp-runs', { status: 'CLOSED' }],
      ['/api/v1/mrp-proposals', { state: 'DONE' }],
      ['/api/v1/mrp-proposals', { frozen: 'yes' }],
      ['/api/v1/mrp-proposals', { type: 'MAKE' }],
    ];
    for (const [pathname, query] of negatives) {
      const response = await dispatchFastifyRouteGroup(requestFor({ pathname, query }), scopeFor());
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).code).toBe('invalid_request');
    }
    // runId 走 uuid 解析器：与 legacy 同一句消息。
    const badRun = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/mrp-proposals', query: { runId: 'abc' } }),
      scopeFor(),
    );
    expect(badRun?.statusCode).toBe(400);
    expect(errorOf(badRun).message).toBe('runId must be a UUID');
    expect(calls).toEqual([]);
  });

  it('GET 列表字段裁剪：政策按 mrp-policy:read、其余按 mrp:read 的字段清单', async () => {
    const scope = scopeFor(repository(), { policyFields: ['sku', 'make_or_buy'], fields: ['sku'] });
    expect(itemsOf(await dispatchFastifyRouteGroup(requestFor(), scope))).toEqual([
      { id: policyRow.id, sku: policyRow.sku, make_or_buy: policyRow.make_or_buy },
    ]);
    for (const [pathname, row] of [
      ['/api/v1/mrp-demands', demandRow],
      ['/api/v1/mrp-runs', runRow],
      ['/api/v1/mrp-proposals', proposalRow],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(requestFor({ pathname }), scope);
      expect(itemsOf(response)).toEqual([{ id: row.id, sku: row.sku }]);
    }
  });
});

describe('mrp fastify bridge track: run detail', () => {
  const detailRequest = () => requestFor({ pathname: `/api/v1/mrp-runs/${runId}` });
  const ALL_PARTS = {
    orderSources: true,
    bom: true,
    inventory: true,
    receipts: true,
    executions: true,
  };

  it('GET 详情：根行 + 两个聚合 + 需求快照，解释行项按读权限全部带上', async () => {
    const response = await dispatchFastifyRouteGroup(detailRequest(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual(runDetail);
    expect(calls).toEqual([{ method: 'findRun', args: [runId, scopeContext, ALL_PARTS] }]);
  });

  it('GET 详情门控：逐项读权限各自决定是否查询该行项', async () => {
    const none = await dispatchFastifyRouteGroup(
      detailRequest(),
      scopeFor(repository(), { gating: false }),
    );
    expect(none?.statusCode).toBe(200);
    expect(argsOf(0)[2]).toEqual({
      orderSources: false,
      bom: false,
      inventory: false,
      receipts: false,
      executions: false,
    });
    calls.length = 0;
    const partial = await dispatchFastifyRouteGroup(
      detailRequest(),
      without(scopeFor(), 'bom:read', 'production:read'),
    );
    expect(partial?.statusCode).toBe(200);
    expect(argsOf(0)[2]).toEqual({ ...ALL_PARTS, bom: false, executions: false });
  });

  it('GET 详情不读取带字段裁剪或窄范围的其它领域数据', async () => {
    const scope = scopeFor();
    const permissions = new Map(scope.authorization.permissions);
    permissions.set('sales-order:read', { scopes: ['SELF'], fields: null });
    permissions.set('production:read', { scopes: ['COMPANY'], fields: ['id'] });
    const response = await dispatchFastifyRouteGroup(detailRequest(), {
      ...scope,
      authorization: { ...scope.authorization, permissions },
    });
    expect(response?.statusCode).toBe(200);
    expect(argsOf(0)[2]).toEqual({ ...ALL_PARTS, orderSources: false, executions: false });
  });

  it('GET 详情：行项键随 mrp:read 顶层字段清单一并裁剪；404 信封；非法 id', async () => {
    const cropped = await dispatchFastifyRouteGroup(
      detailRequest(),
      scopeFor(repository(), { fields: ['run_number', 'proposals', 'demandSnapshots'] }),
    );
    expect(cropped?.body).toEqual({
      id: runId,
      run_number: runRow.run_number,
      proposals: [proposalRow],
      demandSnapshots: [snapshotRow],
    });
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/mrp-runs/66666666-6666-4666-8666-666666666666' }),
      scopeFor(repository({ findRun: tracked('findRun', null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(missing?.body).toEqual({
      error: { code: 'not_found', message: 'MRP run not found', correlationId },
    });
    // 十六进制形状但版本位不合法的 id：在认领清单内，由 uuid 解析器给 400（与 legacy 同一句消息）。
    const invalid = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/mrp-runs/66666666-6666-9666-8666-666666666666' }),
      scopeFor(),
    );
    expect(invalid?.statusCode).toBe(400);
    expect(errorOf(invalid)).toEqual({
      code: 'invalid_request',
      message: 'runId must be a UUID',
      correlationId,
    });
    // 含非十六进制字符的路径不在认领清单内：桥轨返回 null，落回 legacy 轨。
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/mrp-runs/not-a-uuid' }),
        scopeFor(),
      ),
    ).toBeNull();
  });
});

describe('mrp fastify bridge track: writes', () => {
  // 负例：逐条给 400 与 legacy 的同一句消息，且全程不触达仓储。
  const negatives = async (
    request: ApiRequest,
    cases: readonly (readonly [Record<string, unknown>, string])[],
  ): Promise<void> => {
    for (const [body, message] of cases) {
      const failed = await dispatchFastifyRouteGroup({ ...request, body }, scopeFor());
      expect(failed?.statusCode).toBe(400);
      expect(errorOf(failed).message).toBe(message);
    }
    expect(calls).toEqual([]);
  };

  it('POST 计划政策走 legacy 同解析链（trim / decimal 去尾零 / integer / timestamp / 枚举）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      post('/api/v1/mrp-policies', policyBody),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(policyCreated);
    expect(calls).toEqual([
      { method: 'createPolicy', args: [policyInput, scopeContext, correlationId] },
    ]);
  });

  it('POST 计划政策负例沿用 legacy 消息', async () => {
    await negatives(post('/api/v1/mrp-policies', policyBody), [
      [{ ...policyBody, extra: 1 }, 'Unsupported fields: extra'],
      [{ ...policyBody, makeOrBuy: 'buy' }, 'makeOrBuy is unsupported'],
      [{ ...policyBody, makeOrBuy: undefined }, 'makeOrBuy is required'],
      [{ ...policyBody, itemVersionId: 'abc' }, 'itemVersionId must be a UUID'],
      [{ ...policyBody, safetyStock: '-1' }, 'safetyStock must be non-negative'],
      [{ ...policyBody, safetyStock: '01' }, 'Invalid decimal'],
      [{ ...policyBody, leadTimeDays: 1.5 }, 'leadTimeDays must be an integer between 0 and 3650'],
      [
        { ...policyBody, freezeWindowDays: '7' },
        'freezeWindowDays must be an integer between 0 and 3650',
      ],
      [{ ...policyBody, effectiveAt: '2026-13-01' }, 'effectiveAt must be a valid timestamp'],
      [{ ...policyBody, orderMultiple: undefined }, 'orderMultiple is required'],
    ]);
  });

  it('POST 需求信号走 legacy 同解析链（stableCode / uuid / calendarDate / priority 缺省 100）→ 201', async () => {
    const request = post('/api/v1/mrp-demands', demandBody);
    const response = await dispatchFastifyRouteGroup(request, scopeFor());
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(demandCreated);
    expect(calls).toEqual([
      { method: 'createDemand', args: [demandInput, scopeContext, correlationId] },
    ]);
    calls.length = 0;
    const defaulted = await dispatchFastifyRouteGroup(
      { ...request, body: { ...demandBody, priority: undefined } },
      scopeFor(),
    );
    expect(defaulted?.statusCode).toBe(201);
    expect(argsOf(0)[0]).toEqual({ ...demandInput, priority: 100 });
    calls.length = 0;
    await negatives(request, [
      [{ ...demandBody, sourceType: 'sales forecast' }, codeMessage],
      [{ ...demandBody, sourceId: 'abc' }, 'sourceId must be a UUID'],
      [{ ...demandBody, requiredAt: '2026-02-30' }, 'requiredAt must be a valid YYYY-MM-DD date'],
      [{ ...demandBody, priority: 0 }, 'priority must be an integer between 1 and 100000'],
      [{ ...demandBody, priority: '10' }, 'priority must be an integer between 1 and 100000'],
      [{ ...demandBody, quantity: undefined }, 'quantity is required'],
      [{ ...demandBody, sourceId: undefined }, 'sourceId is required'],
    ]);
  });

  it('POST 运行计算走 legacy 同解析链（stableCode / timestamp / calendarDate）→ 201', async () => {
    const request = post('/api/v1/mrp-runs', runBody);
    const response = await dispatchFastifyRouteGroup(request, scopeFor());
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(runCreated);
    expect(calls).toEqual([{ method: 'run', args: [runInput, scopeContext, correlationId] }]);
    calls.length = 0;
    await negatives(request, [
      [{ ...runBody, runNumber: 'mrp 002' }, codeMessage],
      [{ ...runBody, asOf: 'not-time' }, 'asOf must be a valid timestamp'],
      [{ ...runBody, horizonEnd: '2026-02-30' }, 'horizonEnd must be a valid YYYY-MM-DD date'],
      [{ ...runBody, runNumber: undefined }, 'runNumber is required'],
      [{ ...runBody, asOf: null }, 'asOf is required'],
      [{ ...runBody, extra: true }, 'Unsupported fields: extra'],
    ]);
  });

  it('POST 建议决定：四个动作逐一映射目标状态与能力键；载荷与 legacy 同形', async () => {
    for (const [action, state, capability] of PROPOSAL_ACTIONS) {
      calls.length = 0;
      const response = await dispatchFastifyRouteGroup(decisionRequest(action), scopeFor());
      expect(response?.statusCode).toBe(201);
      expect(calls).toEqual([
        {
          method: 'transitionProposal',
          args: [proposalId, state, decisionInput, scopeContext, correlationId],
        },
      ]);
      // 缺该动作的能力键 → 403，不触达仓储。
      calls.length = 0;
      const denied = await dispatchFastifyRouteGroup(
        decisionRequest(action),
        without(scopeFor(), capability),
      );
      expect(denied?.statusCode).toBe(403);
      expect(calls).toEqual([]);
    }
    // evidence 缺省为空对象；路径 id 归一小写。
    const defaulted = await dispatchFastifyRouteGroup(
      decisionRequest('cancel', { reason: ' Cancelled ' }),
      scopeFor(
        repository({ transitionProposal: tracked('transitionProposal', decided('CANCELLED')) }),
      ),
    );
    expect(defaulted?.statusCode).toBe(201);
    expect(defaulted?.body).toEqual(decided('CANCELLED'));
    expect(argsOf(0).slice(0, 3)).toEqual([
      proposalId,
      'CANCELLED',
      { reason: 'Cancelled', evidence: {} },
    ]);
    calls.length = 0;
    await dispatchFastifyRouteGroup(
      {
        ...decisionRequest('reject'),
        pathname: `/api/v1/mrp-proposals/${proposalId.toUpperCase()}/reject`,
      },
      scopeFor(),
    );
    expect(argsOf(0).slice(0, 3)).toEqual([proposalId, 'REJECTED', decisionInput]);
    calls.length = 0;
    await negatives(decisionRequest('approve'), [
      [{ reason: 'x', evidence2: 1 }, 'Unsupported fields: evidence2'],
      [{ evidence: {} }, 'reason is required'],
      [{ reason: 'x', evidence: [] }, 'evidence must be a JSON object'],
      [{ reason: 'x', evidence: 'x' }, 'evidence must be a JSON object'],
    ]);
    const badId = await dispatchFastifyRouteGroup(
      { ...decisionRequest('approve'), pathname: '/api/v1/mrp-proposals/abc/approve' },
      scopeFor(),
    );
    expect(badId?.statusCode).toBe(400);
    expect(errorOf(badId).message).toBe('proposalId must be a UUID');
  });

  it('写响应按读权限字段投影（mutationDto 同口径）；读权限字段清单为空时只剩 id', async () => {
    const policy = await dispatchFastifyRouteGroup(
      post('/api/v1/mrp-policies', policyBody),
      scopeFor(repository(), { policyFields: ['makeOrBuy'] }),
    );
    expect(policy?.body).toEqual({ id: policyCreated.id, makeOrBuy: 'BUY' });
    const cases = [
      ['/api/v1/mrp-demands', demandBody, { id: demandCreated.id, quantity: '8000' }],
      ['/api/v1/mrp-runs', runBody, { id: runCreated.id, status: 'COMPUTED' }],
      [`/api/v1/mrp-proposals/${proposalId}/release`, decisionBody, { id: proposalId }],
    ] as const;
    for (const [pathname, body, expected] of cases) {
      const response = await dispatchFastifyRouteGroup(
        post(pathname, body),
        scopeFor(repository(), { fields: ['quantity', 'status'] }),
      );
      expect(response?.statusCode).toBe(201);
      expect(response?.body).toEqual(expected);
    }
    const bare = await dispatchFastifyRouteGroup(
      post('/api/v1/mrp-runs', runBody),
      scopeFor(repository(), { fields: [] }),
    );
    expect(bare?.body).toEqual({ id: runCreated.id });
  });

  it('仓储抛的 DomainError 照常映射（冲突 409 / 不存在 404），消息与 legacy 一致', async () => {
    const bodies: Readonly<Record<string, unknown>> = {
      '/api/v1/mrp-policies': policyBody,
      '/api/v1/mrp-demands': demandBody,
      '/api/v1/mrp-runs': runBody,
    };
    const methods: Readonly<Record<string, string>> = {
      '/api/v1/mrp-policies': 'createPolicy',
      '/api/v1/mrp-demands': 'createDemand',
      '/api/v1/mrp-runs': 'run',
    };
    const conflicts: readonly (readonly [string, string])[] = [
      ['/api/v1/mrp-policies', 'MRP policy requires a published item version'],
      [
        '/api/v1/mrp-demands',
        'MRP demand requires a published item version and a valid declared source',
      ],
      ['/api/v1/mrp-runs', 'MRP horizon contains no demand to calculate'],
      ['/api/v1/mrp-runs', 'MRP rejected a cyclic or excessively deep BOM graph'],
    ];
    for (const [pathname, message] of conflicts) {
      const overrides: Overrides = {};
      overrides[methods[pathname] ?? ''] = rejectedWith(new DomainError('conflict', message));
      const response = await dispatchFastifyRouteGroup(
        post(pathname, bodies[pathname]),
        scopeFor(repository(overrides)),
      );
      expect(response?.statusCode).toBe(409);
      expect(response?.body).toEqual({ error: { code: 'conflict', message, correlationId } });
    }
    const notFound = await dispatchFastifyRouteGroup(
      decisionRequest(),
      scopeFor(
        repository({
          transitionProposal: rejectedWith(new DomainError('not_found', 'MRP proposal not found')),
        }),
      ),
    );
    expect(notFound?.statusCode).toBe(404);
    expect(errorOf(notFound).message).toBe('MRP proposal not found');
    // 写端点上的普通异常：500 固定信封 + 诊断日志，不外泄原文。
    const scope = scopeFor(repository({ run: rejectedWith(new Error('boom detail')) }));
    const failed = await dispatchFastifyRouteGroup(post('/api/v1/mrp-runs', runBody), scope);
    expect(failed?.statusCode).toBe(500);
    expect(JSON.stringify(failed?.body)).not.toContain('boom detail');
    expect(loggerOf(scope)).toHaveBeenCalledTimes(1);
  });
});

describe('mrp fastify bridge track: guard rejections', () => {
  type PgError = Error & { code?: string; constraint?: string };
  const trigger = (message: string): PgError =>
    Object.assign(new Error(message), { code: 'P0001' });
  // 消息文字来自迁移 0039 / 0040 的触发器函数；提示是界面上给计划员看的中文。
  const hints: readonly (readonly [string, string])[] = [
    [
      'proposal requires approval, rejection, or cancellation',
      '这条建议不在可做决定的状态，请刷新后查看当前状态',
    ],
    ['approved proposal can only be released', '已批准的建议只能下达，不能再次批准或拒绝'],
    ['closed proposal is immutable', '这条建议已结束（已驳回、已下达或已取消），不能再变更'],
    [
      'frozen proposal approval requires override evidence',
      '冻结窗口内的建议，批准时必须提供冻结覆盖审批编号',
    ],
    [
      'proposal decisions require a computed active MRP run',
      '所属计算批次已关闭，不能再对建议做决定',
    ],
  ];

  it('白名单内的守卫拒绝 → 409 + 中文提示 + 关联 ID', async () => {
    for (const [message, hint] of hints) {
      const response = await dispatchFastifyRouteGroup(
        decisionRequest(),
        scopeFor(repository({ transitionProposal: rejectedWith(trigger(message)) })),
      );
      expect(response?.statusCode).toBe(409);
      expect(response?.body).toEqual({
        error: { code: 'conflict', message: hint, correlationId },
      });
    }
  });

  it('未列入的拒绝保持 500：固定信封、不回显数据库原文、留诊断日志', async () => {
    const unlisted: readonly (readonly [PgError, string])[] = [
      [trigger('some guard message nobody listed'), 'nobody listed'],
      [trigger('proposal event sequence must be contiguous'), 'contiguous'],
      // P0001 但没有提示文字：无从给用户看，不映射。
      [Object.assign(new Error('x'), { code: 'P0001', message: '' }), 'x'],
      [Object.assign(new Error('x'), { code: 'P0001' }), 'x'],
      // 其它 SQLSTATE（唯一约束 / CHECK 约束）与普通异常不在守卫白名单口径内。
      [
        Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
          constraint: 'mrp_runs_tenant_id_run_number_key',
        }),
        'duplicate key',
      ],
      [
        Object.assign(new Error('violates check constraint'), { code: '23514' }),
        'check constraint',
      ],
      [new Error('plain failure'), 'plain failure'],
    ];
    for (const [cause, secret] of unlisted) {
      const scope = scopeFor(repository({ transitionProposal: rejectedWith(cause) }));
      const response = await dispatchFastifyRouteGroup(decisionRequest(), scope);
      expect(response?.statusCode).toBe(500);
      expect(errorOf(response).code).toBe('internal_error');
      expect(JSON.stringify(response?.body)).not.toContain(secret);
      // 诊断日志定位到语句与 SQLSTATE，不带请求载荷，也不带异常消息原文。
      const entry = loggerOf(scope).mock.calls[0]?.[0] as {
        level: string;
        event: string;
        correlationId: string;
        statusCode: number;
        method: string;
        pathname: string;
        error: { name: string; code?: string };
      };
      expect(entry).toMatchObject({
        level: 'error',
        event: 'http.request.failed',
        correlationId,
        statusCode: 500,
        method: 'POST',
        pathname: decisionRequest().pathname,
      });
      expect(entry.error.code).toBe(cause.code);
      expect(JSON.stringify(entry)).not.toContain(secret);
    }
  });

  it('守卫映射只落在建议决定端点：其余三个写端点上的 P0001 仍是 500', async () => {
    const cases = [
      ['/api/v1/mrp-policies', policyBody, 'createPolicy'],
      ['/api/v1/mrp-demands', demandBody, 'createDemand'],
      ['/api/v1/mrp-runs', runBody, 'run'],
    ] as const;
    for (const [pathname, body, method] of cases) {
      const overrides: Overrides = {};
      overrides[method] = rejectedWith(trigger(hints[0]?.[0] ?? ''));
      const response = await dispatchFastifyRouteGroup(
        post(pathname, body),
        scopeFor(repository(overrides)),
      );
      expect(response?.statusCode).toBe(500);
    }
  });
});

describe('mrp fastify bridge track: permissions and claims', () => {
  it('权限负例：缺读权限 403；缺写权限 403；依赖缺失 503；未认领方法落回 null', async () => {
    const readDenied: readonly (readonly [RequestInit, PermissionKey])[] = [
      [{}, 'mrp-policy:read'],
      [{ pathname: '/api/v1/mrp-demands' }, 'mrp:read'],
      [{ pathname: '/api/v1/mrp-runs' }, 'mrp:read'],
      [{ pathname: '/api/v1/mrp-proposals' }, 'mrp:read'],
      [{ pathname: `/api/v1/mrp-runs/${runId}` }, 'mrp:read'],
    ];
    for (const [init, capability] of readDenied) {
      const response = await dispatchFastifyRouteGroup(
        requestFor(init),
        without(scopeFor(), capability),
      );
      expect(response?.statusCode).toBe(403);
    }
    const writeDenied: readonly (readonly [ApiRequest, PermissionKey])[] = [
      [post('/api/v1/mrp-policies', policyBody), 'mrp-policy:manage'],
      [post('/api/v1/mrp-demands', demandBody), 'mrp:run'],
      [post('/api/v1/mrp-runs', runBody), 'mrp:run'],
      [decisionRequest('approve'), 'mrp:approve'],
      [decisionRequest('cancel'), 'mrp:approve'],
      [decisionRequest('release'), 'mrp:release'],
    ];
    for (const [request, capability] of writeDenied) {
      const response = await dispatchFastifyRouteGroup(request, without(scopeFor(), capability));
      expect(response?.statusCode).toBe(403);
    }
    expect(calls).toEqual([]);

    for (const request of [
      requestFor(),
      requestFor({ pathname: `/api/v1/mrp-runs/${runId}` }),
      requestFor({ pathname: '/api/v1/mrp-proposals' }),
      post('/api/v1/mrp-runs', runBody),
      decisionRequest('release'),
    ]) {
      const response = await dispatchFastifyRouteGroup(request, scopeFor(null));
      expect(response?.statusCode).toBe(503);
      expect(errorOf(response).code).toBe('internal_error');
    }
    // 未认领：别的方法 / 别的路径 / 不在四个动作里的决定，落回 legacy 轨（null）。
    for (const request of [
      requestFor({ method: 'DELETE' }),
      requestFor({ method: 'PUT', pathname: '/api/v1/mrp-policies' }),
      requestFor({ method: 'PATCH', pathname: '/api/v1/mrp-runs' }),
      requestFor({ pathname: '/api/v1/mrp-policies/abc' }),
      requestFor({ pathname: '/api/v1/mrp-runs/abc/detail' }),
      requestFor({ method: 'DELETE', pathname: '/api/v1/mrp-proposals' }),
      requestFor({ method: 'PUT', pathname: `/api/v1/mrp-proposals/${proposalId}` }),
      decisionRequest('undo'),
      post('/api/v1/mrp-proposals', decisionBody),
    ])
      expect(await dispatchFastifyRouteGroup(request, scopeFor())).toBeNull();
  });
});

describe('fastify bridge 行为守恒（mrp 对比 legacy）', () => {
  // 对拍走真实的请求入口 app.dispatch：同一个请求分别经不装 commercial 的应用（桥轨不介入，
  // 全部落 legacy 轨）与装了 commercial 的应用（MRP 路径被认领，走 Fastify 桥），两轨共用同一个
  // 仓储替身——仓储实参、状态码、响应体与响应头都逐字节一致。
  const correlation = '66666666-6666-4666-8666-666666666666';
  type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
  const appFor = (repo: Repository, authorization: AuthorizationContext, bridged: boolean) => {
    const dependencies: MutableDependencies = {
      auth: {
        authenticate: vi.fn().mockResolvedValue(authorization),
      } as unknown as ApiDependencies['auth'],
      organizations: {} as ApiDependencies['organizations'],
      employees: {} as ApiDependencies['employees'],
      mrp: repo,
    };
    if (bridged) {
      dependencies.commercial = {} as NonNullable<ApiDependencies['commercial']>;
      dependencies.logger = {
        write: vi.fn(),
      };
    }
    return buildApp(dependencies);
  };
  const send = (app: ReturnType<typeof buildApp>, request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: { authorization: 'Bearer mock-only-mrp-session', 'x-correlation-id': correlation },
    });
  const both = async (request: ApiRequest, repo: Repository, options: ScopeOptions = {}) => {
    const authorization = scopeFor(repo, options).authorization;
    const legacy = await send(appFor(repo, authorization, false), request);
    const bridged = await send(appFor(repo, authorization, true), request);
    return { legacy, bridged };
  };
  const through = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  // 按读权限字段清单裁剪后的行（id 恒可见；清单为 null 表示不裁）。
  const projected = (row: Row, fields: readonly string[] | null): Row =>
    fields === null
      ? row
      : Object.fromEntries(
          Object.entries(row).filter(([key]) => key === 'id' || fields.includes(key)),
        );

  it('GET 三个列表：新旧轨的状态码、响应体与响应头一致（含字段遮蔽）', async () => {
    for (const fields of [null, ['sku']] as const) {
      for (const [pathname, row, method] of [
        ['/api/v1/mrp-policies', policyRow, 'listPolicyPage'],
        ['/api/v1/mrp-demands', demandRow, 'listDemandPage'],
        ['/api/v1/mrp-runs', runRow, 'listRunPage'],
      ] as const) {
        const legacyList = vi.fn<MockCall>().mockResolvedValue([row]);
        const bridgedPage = vi.fn<MockCall>().mockResolvedValue({ items: [row], nextCursor: null });
        const repo = repository({ list: legacyList, [method]: bridgedPage });
        const { legacy, bridged } = await both(requestFor({ pathname }), repo, {
          policyFields: fields,
          fields,
        });
        expect(through(legacy)).toEqual(through(bridged));
        expect(bridged.statusCode).toBe(200);
        expect(bridged.headers?.['x-correlation-id']).toBe(correlation);
        expect(bridged.body).toEqual({ items: [projected(row, fields)] });
        // 两轨仓储实参等价：legacy list(视图, 作用域) ↔ 桥轨分页方法(作用域, 缺省空过滤)。
        const view = pathname.endsWith('policies')
          ? 'policies'
          : pathname.endsWith('demands')
            ? 'demands'
            : 'runs';
        expect(legacyList).toHaveBeenCalledTimes(1);
        expect(legacyList.mock.calls[0]?.[0]).toBe(view);
        expect(bridgedPage).toHaveBeenCalledTimes(1);
        expect(bridgedPage.mock.calls[0]?.[0]).toEqual(legacyList.mock.calls[0]?.[1]);
        expect(bridgedPage.mock.calls[0]?.[1]).toEqual({});
      }
    }
  });

  it('四个写端点：新旧轨的状态码、响应体、响应头与仓储实参逐字节一致（含字段裁剪与负例）', async () => {
    const requests: readonly (readonly [ApiRequest, WriteMethod, Row | null])[] = [
      [post('/api/v1/mrp-policies', policyBody), 'createPolicy', policyCreated],
      [post('/api/v1/mrp-demands', demandBody), 'createDemand', demandCreated],
      [post('/api/v1/mrp-runs', runBody), 'run', runCreated],
      ...PROPOSAL_ACTIONS.map(([action, state]): readonly [ApiRequest, WriteMethod, Row] => [
        decisionRequest(action),
        'transitionProposal',
        decided(state),
      ]),
      // 负例：解析拒绝在两轨上是同一句消息、同一个状态码，且都不触达仓储。
      [post('/api/v1/mrp-policies', { ...policyBody, makeOrBuy: 'buy' }), 'createPolicy', null],
      [
        post('/api/v1/mrp-demands', { ...demandBody, sourceType: 'bad code' }),
        'createDemand',
        null,
      ],
      [post('/api/v1/mrp-runs', { ...runBody, horizonEnd: '2026-02-30' }), 'run', null],
      [decisionRequest('approve', { evidence: {} }), 'transitionProposal', null],
      [decisionRequest('approve', { reason: 'x', evidence: 'x' }), 'transitionProposal', null],
    ];
    let succeeded = 0;
    let rejected = 0;
    let cropped = 0;
    for (const fields of [null, ['sku', 'quantity', 'status']] as const) {
      for (const [request, method, result] of requests) {
        const write =
          result === null ? vi.fn<MockCall>() : vi.fn<MockCall>().mockResolvedValue(result);
        const { legacy, bridged } = await both(request, repository({ [method]: write }), {
          policyFields: fields,
          fields,
        });
        expect(through(legacy)).toEqual(through(bridged));
        // 同一个仓储方法被两轨各调用一次，实参（含作用域与关联 ID）逐字节一致。
        expect(write).toHaveBeenCalledTimes(result === null ? 0 : 2);
        expect(write.mock.calls[1]).toEqual(write.mock.calls[0]);
        if (result === null) {
          rejected += 1;
          expect(bridged.statusCode).toBe(400);
          expect(bridged.headers?.['x-correlation-id']).toBe(correlation);
        } else {
          succeeded += 1;
          expect(bridged.statusCode).toBe(201);
          // 政策写响应按 mrp-policy:read 的清单裁剪，其余按 mrp:read（本例两份清单同值）。
          const body = projected(result, fields);
          if (Object.keys(body).length < Object.keys(result).length) cropped += 1;
          expect(bridged.body).toEqual(body);
        }
      }
    }
    // 元断言：成功、解析拒绝、字段裁剪三类结果都真的出现过（对拍不是空转）。
    expect(succeeded).toBe(7 * 2);
    expect(rejected).toBe(5 * 2);
    expect(cropped).toBe(7);
  });

  it('GET 批次详情与建议列表是加性端点：legacy 轨没有它们（404），桥轨 200', async () => {
    const legacyApp = appFor(repository(), scopeFor().authorization, false);
    for (const pathname of ['/api/v1/mrp-proposals', `/api/v1/mrp-runs/${runId}`])
      expect((await send(legacyApp, requestFor({ pathname }))).statusCode).toBe(404);
    const { bridged } = await both(requestFor({ pathname: '/api/v1/mrp-proposals' }), repository());
    expect(bridged.statusCode).toBe(200);
    expect(bridged.body).toEqual({ items: [proposalRow] });
  });
});
