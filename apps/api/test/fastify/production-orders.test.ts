import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStableCode, DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import {
  allow,
  calendarDate,
  decimal,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../src/app-values.ts';
import { authorizeQuery } from '../../src/policy.ts';
import { dispatchRoutes } from '../../src/routes/types.ts';
import { productionOrderCommandRoutes } from '../../src/routes/production-order-commands.ts';
import { productionOrderCreateRoutes } from '../../src/routes/production-order-create.ts';
import { productionOrderReadRoutes } from '../../src/routes/production-reads.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-MFG-4：production-orders Fastify 组契约测试——GET 列表（无查询参数时与 legacy 全量
// { items } 逐字节一致；state/query/cursor/limit 透传 + nextCursor 仅分页时附加）、GET
// 详情（additive 只读：根行 + 工序进度 + 报工时间线 + 物料需求（bom:read 门控））、POST
// 创建（legacy 同解析链，入参 oracle 与负例消息逐字一致）、PUT state（分派 legacy
// transition 同链——五个动作逐一与 legacy POST /:id/<command> 轨对拍）、依赖缺失 503 与
// 未认领方法落回 null。
const tenant = '11111111-1111-4111-8111-111111111111';
const orderId = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const operation = (sequence: number, code: string, name: string) => ({
  id: `op-${String(sequence)}`,
  tenant_id: tenant,
  production_order_id: orderId,
  sequence,
  operation_code: code,
  name,
  work_center: `WC-${code}-01`,
  setup_minutes: 60,
  run_minutes_per_unit: 0.8,
  routing_operation_id: 'ro-1',
  canonical_hash: 'c'.repeat(64),
});
const row = {
  id: orderId,
  tenant_id: tenant,
  order_number: 'WO-KT-2026-001',
  item_version_id: '77777777-7777-4777-8777-777777777777',
  routing_version_id: '88888888-8888-4888-8888-888888888888',
  mrp_proposal_id: null,
  // 数值列为 JSON 数字（to_jsonb(numeric)）——与真库输出一致。
  planned_quantity: 1000,
  planned_start_at: '2026-08-13',
  planned_due_at: '2026-08-20',
  source_reference: 'MRP-KT-2026-001-PRODUCTION-1000',
  created_by: 'e-1',
  created_at: '2026-11-24T00:00:00+00:00',
  canonical_hash: 'a'.repeat(64),
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  state: 'CLOSED',
  stateSequence: 5,
  operations: [
    operation(10, 'TUFT', '簇绒'),
    operation(20, 'COAT', '背胶'),
    operation(30, 'PACK', '裁切包装'),
  ],
  materials: [
    { id: 'm-1', transaction_type: 'ISSUE', quantity: 1287.5 },
    { id: 'm-2', transaction_type: 'ISSUE', quantity: 10 },
    { id: 'm-3', transaction_type: 'RETURN', quantity: 2 },
  ],
  reports: [
    { id: 'r-1', production_order_operation_id: 'op-10', good_quantity: 1000 },
    { id: 'r-2', production_order_operation_id: 'op-20', good_quantity: 1000 },
    { id: 'r-3', production_order_operation_id: 'op-30', good_quantity: 1000 },
  ],
  rolls: [{ id: 'roll-1', roll_number: 'ROLL-KT-2026-001', quantity: 1000 }],
  events: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].map((state) => ({
    state,
  })),
};
const detail = {
  ...row,
  operationProgress: [
    {
      id: 'op-10',
      sequence: 10,
      operationCode: 'TUFT',
      operationName: '簇绒',
      workCenter: 'WC-TUFT-01',
      plannedQuantity: 1000,
      reportedGoodQuantity: 1000,
      reportedScrapQuantity: 12.5,
      reportCount: 1,
      laborMinutes: 860,
      machineMinutes: 800,
      completed: true,
    },
    {
      id: 'op-20',
      sequence: 20,
      operationCode: 'COAT',
      operationName: '背胶',
      workCenter: 'WC-COAT-01',
      plannedQuantity: 1000,
      reportedGoodQuantity: 400,
      reportedScrapQuantity: 0,
      reportCount: 1,
      laborMinutes: 540,
      machineMinutes: 800,
      completed: false,
    },
  ],
  reportTimeline: [
    {
      id: 'r-1',
      productionOrderOperationId: 'op-10',
      sequence: 10,
      operationCode: 'TUFT',
      operationName: '簇绒',
      goodQuantity: 1000,
      scrapQuantity: 12.5,
      laborMinutes: 860,
      machineMinutes: 800,
      startedAt: '2026-08-17T08:00:00+00:00',
      completedAt: '2026-08-17T20:00:00+00:00',
      notes: '簇绒完成并由班组长确认',
      operatorId: 'e-1',
      createdAt: '2026-08-17T20:01:00+00:00',
    },
  ],
  materialRequirements: [
    {
      lineNumber: 1,
      componentItemVersionId: 'raw-1',
      sku: 'RM-KT-YARN-12000',
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
  ],
};
const created = {
  id: '55555555-5555-4555-8555-555555555555',
  state: 'DRAFT',
  operationCount: 3,
  orderNumber: 'WO-KT-2026-042',
  itemVersionId: row.item_version_id,
  routingVersionId: row.routing_version_id,
  plannedQuantity: '1000',
  plannedStartAt: '2026-09-01',
  plannedDueAt: '2026-09-08',
  sourceReference: 'SO-KT-2026-042',
};
const transitioned = {
  id: orderId,
  state: 'RELEASED',
  sequence: 2,
  reason: '已核对排产',
  evidence: { reference: 'EV-1' },
  idempotencyKey: 'WO-KT-2026-001-RELEASE-EV-1',
};

type Repository = NonNullable<ApiDependencies['production']>;
const calls: { method: string; args: unknown[] }[] = [];
const tracked = <T>(method: string, result: T) =>
  vi.fn((...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve(result);
  });

const repository = (
  overrides: {
    list?: ReturnType<typeof vi.fn>;
    listProductionOrderPage?: ReturnType<typeof vi.fn>;
    findProductionOrder?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    transition?: ReturnType<typeof vi.fn>;
  } = {},
): Repository =>
  ({
    list: overrides.list ?? tracked('list', [row]),
    listProductionOrderPage:
      overrides.listProductionOrderPage ??
      tracked('listProductionOrderPage', { items: [row], nextCursor: null }),
    findProductionOrder: overrides.findProductionOrder ?? tracked('findProductionOrder', detail),
    create: overrides.create ?? tracked('create', created),
    transition: overrides.transition ?? tracked('transition', transitioned),
  }) as unknown as Repository;

type Grant = { scopes: string[]; fields: readonly string[] | null };
// commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
const dependencyScope = (production: Repository | null): ApiDependencies =>
  ({ production, commercial: {} }) as unknown as ApiDependencies;

const scopeFor = (
  repo: Repository | null = repository(),
  fields: readonly string[] | null = null,
  grants: Readonly<Record<string, Grant>> = {},
) => {
  const permissions = new Map<PermissionKey, Grant>(
    Object.entries({
      'production:read': { scopes: ['COMPANY'], fields },
      'production:plan': { scopes: ['COMPANY'], fields: null },
      'production:report': { scopes: ['COMPANY'], fields: null },
      'production:close': { scopes: ['COMPANY'], fields: null },
      'bom:read': { scopes: ['COMPANY'], fields: null },
      ...grants,
    }) as readonly (readonly [PermissionKey, Grant])[],
  );
  return {
    authorization: { actor, permissions } as unknown as AuthorizationContext,
    dependencies: dependencyScope(repo),
    correlationId: 'corr-1',
  };
};

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown; query?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/production-orders',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null) =>
  (response?.body as { error: { code: string; message: string } }).error;

const createBody = {
  orderNumber: ' WO-KT-2026-042 ',
  itemVersionId: row.item_version_id,
  routingVersionId: row.routing_version_id,
  plannedQuantity: ' 1000.000000 ',
  plannedStartAt: '2026-09-01',
  plannedDueAt: '2026-09-08',
  sourceReference: ' SO-KT-2026-042 ',
};
const transitionBody = {
  reason: ' 已核对排产 ',
  evidence: { reference: 'EV-1' },
  idempotencyKey: 'WO-KT-2026-001-RELEASE-EV-1',
};
// 与 legacy production-order-commands.ts commands 表同值（目标状态 + 能力键）。
const LEGACY_COMMANDS = [
  ['release', 'RELEASED', 'production:plan'],
  ['start', 'IN_PROGRESS', 'production:report'],
  ['complete', 'COMPLETED', 'production:close'],
  ['close', 'CLOSED', 'production:close'],
  ['cancel', 'CANCELLED', 'production:close'],
] as const;

afterEach(() => {
  calls.length = 0;
});

describe('production-orders fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无 nextCursor 键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(calls).toEqual([{ method: 'listProductionOrderPage', args: [scopeContext, {}] }]);
  });

  it('GET 列表 state/query/cursor/limit 透传；分页时附 nextCursor', async () => {
    const listProductionOrderPage = vi
      .fn()
      .mockResolvedValue({ items: [row], nextCursor: orderId });
    const repo = repository({ listProductionOrderPage });
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        query: { state: 'IN_PROGRESS', query: ' KT-2026 ', cursor: orderId, limit: '50' },
      }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row], nextCursor: orderId });
    expect(listProductionOrderPage).toHaveBeenCalledWith(scopeContext, {
      limit: 50,
      cursor: orderId,
      state: 'IN_PROGRESS',
      query: 'KT-2026',
    });
  });

  it('GET 列表查询参数负例映射 400 invalid_request', async () => {
    for (const query of [
      { state: 'ARCHIVED' },
      { limit: '0' },
      { limit: '101' },
      { limit: 'abc' },
      { cursor: '' },
      { query: '' },
    ]) {
      const response = await dispatchFastifyRouteGroup(requestFor({ query }), scopeFor());
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).code).toBe('invalid_request');
    }
    expect(calls).toEqual([]);
  });

  it('GET 列表字段裁剪（production:read allowlist）裁掉未授权键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['order_number', 'state']),
    );
    expect((response?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: row.id,
      order_number: row.order_number,
      state: row.state,
    });
  });

  it('GET 详情命中返回根行+工序进度+报工时间线+物料需求；404 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/production-orders/${orderId}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(detail);
    expect(calls).toEqual([
      {
        method: 'findProductionOrder',
        args: [orderId, scopeContext, { materialRequirements: true }],
      },
    ]);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/production-orders/44444444-4444-4444-8444-444444444440',
      }),
      scopeFor(repository({ findProductionOrder: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(errorOf(missing)).toEqual({
      code: 'not_found',
      message: 'Production order not found',
      correlationId: 'corr-1',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/production-orders/99999999-9999-9999-9999-999999999999',
      }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('productionOrderId must be a UUID');
    expect(calls).toHaveLength(1);
  });

  it('GET 详情物料需求按 bom:read 门控：未授权时 parts.materialRequirements=false', async () => {
    const read = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['production:read', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/production-orders/${orderId}` }),
      read,
    );
    expect(response?.statusCode).toBe(200);
    expect(calls[0]?.args[2]).toEqual({ materialRequirements: false });
  });

  it('GET 详情字段裁剪：未授权聚合键随顶层 allowlist 一并裁掉', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/production-orders/${orderId}` }),
      scopeFor(repository(), ['order_number', 'operationProgress']),
    );
    expect(response?.body).toEqual({
      id: orderId,
      order_number: detail.order_number,
      operationProgress: detail.operationProgress,
    });
  });

  it('POST 创建走 legacy 同解析链（trim/stableCode/uuid/decimal 去尾零/calendarDate；mrpProposalId 缺省不传键）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: createBody }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(created);
    expect(calls).toEqual([
      {
        method: 'create',
        args: [
          {
            orderNumber: 'WO-KT-2026-042',
            itemVersionId: row.item_version_id,
            routingVersionId: row.routing_version_id,
            plannedQuantity: '1000',
            plannedStartAt: '2026-09-01',
            plannedDueAt: '2026-09-08',
            sourceReference: 'SO-KT-2026-042',
          },
          scopeContext,
          'corr-1',
        ],
      },
    ]);
    expect(Object.hasOwn(calls[0]?.args[0] as object, 'mrpProposalId')).toBe(false);
    await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: { ...createBody, mrpProposalId: '99999999-9999-4999-8999-999999999999' },
      }),
      scopeFor(),
    );
    expect(calls[1]?.args[0]).toMatchObject({
      mrpProposalId: '99999999-9999-4999-8999-999999999999',
    });
  });

  it('POST 负例沿用 legacy 消息（未知字段/缺字段/编码/日期/数值/UUID）', async () => {
    for (const [body, message] of [
      [{ ...createBody, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...createBody, orderNumber: undefined }, 'orderNumber is required'],
      [
        { ...createBody, orderNumber: 'wo-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        { ...createBody, plannedStartAt: '2026-02-30' },
        'plannedStartAt must be a valid YYYY-MM-DD date',
      ],
      [{ ...createBody, plannedQuantity: '-1' }, 'plannedQuantity must be non-negative'],
      [{ ...createBody, itemVersionId: 'not-a-uuid' }, 'itemVersionId must be a UUID'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', body }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).message).toBe(message);
    }
    expect(calls).toEqual([]);
  });

  it('POST 响应按 production:read 字段投影（mutationDto 同口径）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: createBody }),
      scopeFor(repository(), ['orderNumber', 'state']),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({
      id: created.id,
      orderNumber: created.orderNumber,
      state: 'DRAFT',
    });
  });

  it.each(LEGACY_COMMANDS.map(([action, state]) => [action, state] as const))(
    'PUT state action %s 分派 legacy transition(→%s) 同链 → 201 + mutation 投影',
    async (action, state) => {
      const transition = vi.fn().mockResolvedValue({ ...transitioned, state });
      const response = await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: `/api/v1/production-orders/${orderId}/state`,
          body: { action, ...transitionBody },
        }),
        scopeFor(repository({ transition })),
      );
      expect(response?.statusCode).toBe(201);
      expect(response?.body).toEqual({ ...transitioned, state });
      expect(transition).toHaveBeenCalledExactlyOnceWith(
        orderId,
        state,
        {
          reason: '已核对排产',
          evidence: { reference: 'EV-1' },
          idempotencyKey: 'WO-KT-2026-001-RELEASE-EV-1',
        },
        scopeContext,
        'corr-1',
      );
    },
  );

  it('PUT state 负例：未知动作/未知字段/缺理由/DomainError 映射/能力缺失 403', async () => {
    const path = `/api/v1/production-orders/${orderId}/state`;
    const unknownAction = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: { action: 'assign', ...transitionBody } }),
      scopeFor(),
    );
    expect(unknownAction?.statusCode).toBe(400);
    expect(errorOf(unknownAction).message).toBe(
      'action must be one of release, start, complete, close, cancel',
    );
    const missingAction = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: transitionBody }),
      scopeFor(),
    );
    expect(errorOf(missingAction).message).toBe('action is required');
    const unexpected = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: path,
        body: { action: 'release', ...transitionBody, unexpected: 1 },
      }),
      scopeFor(),
    );
    expect(errorOf(unexpected).message).toBe('Unsupported fields: unexpected');
    const noReason = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: path,
        body: { action: 'release', evidence: {}, idempotencyKey: 'KEY' },
      }),
      scopeFor(),
    );
    expect(errorOf(noReason).message).toBe('reason is required');
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: { action: 'release', ...transitionBody } }),
      scopeFor(
        repository({
          transition: vi
            .fn()
            .mockRejectedValue(new DomainError('not_found', 'Production order not found')),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(404);
    expect(errorOf(conflict)).toEqual({
      code: 'not_found',
      message: 'Production order not found',
      correlationId: 'corr-1',
    });
    const denied = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: { action: 'release', ...transitionBody } }),
      scopeFor(repository(), null, { 'production:plan': { scopes: [], fields: null } }),
    );
    expect(denied?.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('PUT state 按动作取能力键：start 要 production:report，release 只要 production:plan', async () => {
    const path = `/api/v1/production-orders/${orderId}/state`;
    const reportOnly = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['production:read', { scopes: ['COMPANY'], fields: null }],
          ['production:report', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const start = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: { action: 'start', ...transitionBody } }),
      reportOnly,
    );
    expect(start?.statusCode).toBe(201);
    const release = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: path, body: { action: 'release', ...transitionBody } }),
      reportOnly,
    );
    expect(release?.statusCode).toBe(403);
    expect(calls.map((call) => call.method)).toEqual(['transition']);
  });

  it('权限负例：无 production:plan 的 POST 403；无读权限的 GET 403；依赖缺失 503；未认领方法落回 null', async () => {
    const read = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['production:read', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const deniedWrite = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: createBody }),
      read,
    );
    expect(deniedWrite?.statusCode).toBe(403);
    const deniedCommand = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/production-orders/${orderId}/state`,
        body: { action: 'release', ...transitionBody },
      }),
      read,
    );
    expect(deniedCommand?.statusCode).toBe(403);
    const none = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>(),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const deniedRead = await dispatchFastifyRouteGroup(requestFor(), none);
    expect(deniedRead?.statusCode).toBe(403);
    expect(errorOf(deniedRead).code).toBe('forbidden');
    const deniedDetail = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/production-orders/${orderId}` }),
      none,
    );
    expect(deniedDetail?.statusCode).toBe(403);
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
    expect(errorOf(unavailable).code).toBe('internal_error');
    // legacy POST /:id/<command> 轨与详情外的写端点不在认领清单内，落回 legacy 轨。
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({
          method: 'POST',
          pathname: `/api/v1/production-orders/${orderId}/release`,
          body: transitionBody,
        }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ method: 'DELETE', pathname: `/api/v1/production-orders/${orderId}` }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/production-orders/' }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('fastify bridge 行为守恒（production-orders 对比 legacy）', () => {
  const fieldsFor = (authorization: AuthorizationContext, capability: PermissionKey) =>
    authorization.permissions.get(capability)?.fields ?? null;
  // 全能力授权（legacy 命令轨按命令取能力键）。
  const fullScope = (repo: Repository, fields: readonly string[] | null = null) =>
    scopeFor(repo, fields);

  it('GET /api/v1/production-orders：新旧轨响应逐键一致（含字段遮蔽）', async () => {
    for (const fields of [null, ['order_number', 'state']] as const) {
      const authz = fullScope(repository(), fields).authorization;
      const legacyList = vi.fn().mockResolvedValue([row]);
      const bridgedPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: null });
      const repo = repository({ list: legacyList, listProductionOrderPage: bridgedPage });
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/production-orders' };
      const legacy = await dispatchRoutes(
        productionOrderReadRoutes({
          repository: repo,
          authorization: authz,
          authorizeQuery,
          permittedDto: (value) => permittedDto(value, fieldsFor(authz, 'production:read')),
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      // 两轨仓储实参等价：legacy list(scope) ↔ 桥轨 listProductionOrderPage(scope, {})。
      expect(legacyList).toHaveBeenCalledWith(scopeContext);
      expect(bridgedPage).toHaveBeenCalledWith(scopeContext, {});
    }
  });

  it('POST /api/v1/production-orders：新旧轨响应与仓储实参逐字节一致', async () => {
    for (const fields of [null, ['orderNumber', 'state']] as const) {
      const authz = fullScope(repository(), fields).authorization;
      calls.length = 0;
      const request: ApiRequest = {
        method: 'POST',
        pathname: '/api/v1/production-orders',
        body: { ...createBody, mrpProposalId: row.id },
      };
      const legacyRepo = { create: vi.fn().mockResolvedValue(created) };
      const legacy = await dispatchRoutes(
        productionOrderCreateRoutes({
          repository: legacyRepo,
          authorization: authz,
          authorizeQuery,
          correlationId: 'corr-1',
          parsers: {
            objectBody,
            allow,
            string,
            stableCode: assertStableCode,
            uuid,
            decimal,
            calendarDate,
          },
          mutationDto: (value) => mutationDto(value, authz, 'production:read'),
        }),
        request,
      );
      const legacyCall = legacyRepo.create.mock.calls[0];
      const repo = repository();
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(calls[0]?.args).toEqual(legacyCall);
    }
  });

  it.each(LEGACY_COMMANDS)(
    'PUT state(action %s) 与 legacy POST /:id/%s：响应与 transition 实参逐字节一致',
    async (action, state) => {
      for (const fields of [null, ['state', 'sequence']] as const) {
        const authz = fullScope(repository(), fields).authorization;
        const legacyTransition = vi.fn().mockResolvedValue({ ...transitioned, state });
        const legacy = await dispatchRoutes(
          productionOrderCommandRoutes({
            repository: { transition: legacyTransition },
            authorization: authz,
            authorizeQuery,
            correlationId: 'corr-1',
            parsers: {
              objectBody,
              allow,
              uuid,
              string,
              jsonObject,
              stableCode: assertStableCode,
            },
            mutationDto: (value) => mutationDto(value, authz, 'production:read'),
          }),
          {
            method: 'POST',
            pathname: `/api/v1/production-orders/${orderId}/${action}`,
            body: transitionBody,
          },
        );
        const bridgedTransition = vi.fn().mockResolvedValue({ ...transitioned, state });
        calls.length = 0;
        const bridged = await dispatchFastifyRouteGroup(
          {
            method: 'PUT',
            pathname: `/api/v1/production-orders/${orderId}/state`,
            body: { action, ...transitionBody },
          },
          {
            authorization: authz,
            dependencies: dependencyScope(repository({ transition: bridgedTransition })),
            correlationId: 'corr-1',
          },
        );
        expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
        expect(bridgedTransition.mock.calls).toEqual(legacyTransition.mock.calls);
      }
    },
  );
});
