import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStableCode, DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import {
  allow,
  array,
  decimal,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../src/app-values.ts';
import { authorizeQuery } from '../../src/policy.ts';
import { dispatchRoutes } from '../../src/routes/types.ts';
import { manufacturingRoutingCreateRoutes } from '../../src/routes/manufacturing-routing-create.ts';
import { manufacturingReadRoutes } from '../../src/routes/manufacturing-reads.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-MFG-3：manufacturing-routings Fastify 组契约测试——GET 列表（默认全量 { items } 与
// legacy 逐字节一致；status/query/productType/cursor/limit 透传 + nextCursor 仅分页时
// 附加）、GET 详情（additive 只读：根行 + 产品信息 + 全部版本（工序按 sequence 升序））、
// POST 创建（legacy 同解析链，入参 oracle 与负例消息逐字一致）、PUT publish（分派 legacy
// publish('routing') 同链——写路径已存在，零新写语义）、与 legacy 轨逐键 parity、依赖缺失
// 503 与未认领方法落回 null。
const tenant = '11111111-1111-4111-8111-111111111111';
const routingId = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const row = {
  id: '55555555-5555-4555-8555-555555555555',
  tenant_id: tenant,
  routing_id: routingId,
  version: 1,
  status: 'PUBLISHED',
  product_item_version_id: '77777777-7777-4777-8777-777777777777',
  effective_at: '2026-01-01T00:00:00+00:00',
  canonical_hash: 'a'.repeat(64),
  published_at: '2026-01-02T00:00:00+00:00',
  created_by: 'e-1',
  created_at: '2026-12-01T00:00:00+00:00',
  routingId,
  code: 'RT-KT-PRO-50',
  name: '50mm 景观草标准工艺',
  productItemId: '66666666-6666-4666-8666-666666666666',
  operations: [
    {
      id: 'op-1',
      sequence: 10,
      operation_code: 'TUFT',
      name: '簇绒',
      work_center_code: 'WC-TUFT-01',
      setup_minutes: 60,
      run_minutes_per_unit: 0.8,
      instructions: {},
    },
    {
      id: 'op-2',
      sequence: 20,
      operation_code: 'COAT',
      name: '背胶',
      work_center_code: 'WC-COAT-01',
      setup_minutes: 45,
      run_minutes_per_unit: 0.5,
      instructions: {},
    },
  ],
};
const detail = {
  id: routingId,
  code: 'RT-KT-PRO-50',
  name: '50mm 景观草标准工艺',
  productItemId: '66666666-6666-4666-8666-666666666666',
  created_at: '2026-12-01T00:00:00+00:00',
  product: {
    itemId: '66666666-6666-4666-8666-666666666666',
    sku: 'FG-KT-PRO-50',
    name: '金特夫 50mm 景观草',
    itemType: 'FINISHED_GOOD',
    baseUnitCode: 'M2',
  },
  versions: [row],
};
const created = {
  id: row.id,
  routingId,
  version: 1,
  status: 'DRAFT',
  code: 'RT-KT-PRO-50',
  name: '50mm 景观草标准工艺',
  productItemId: '66666666-6666-4666-8666-666666666666',
  productItemVersionId: '77777777-7777-4777-8777-777777777777',
  effectiveAt: '2026-11-24T00:00:00.000Z',
  operations: [
    {
      operationCode: 'TUFT',
      name: '簇绒',
      workCenterCode: 'WC-TUFT-01',
      sequence: 10,
      setupMinutes: '60',
      runMinutesPerUnit: '0.8',
      instructions: {},
    },
  ],
  publish: false,
  canonicalHash: 'b'.repeat(64),
};

type Repository = NonNullable<ApiDependencies['manufacturing']>;
const calls: { method: string; args: unknown[] }[] = [];
const tracked = <T>(method: string, result: T) =>
  vi.fn((...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve(result);
  });

const repository = (
  overrides: {
    listRoutingPage?: ReturnType<typeof vi.fn>;
    findRouting?: ReturnType<typeof vi.fn>;
    createRouting?: ReturnType<typeof vi.fn>;
    publish?: ReturnType<typeof vi.fn>;
    list?: ReturnType<typeof vi.fn>;
  } = {},
): Repository =>
  ({
    list: overrides.list ?? tracked('list', [row]),
    listRoutingPage:
      overrides.listRoutingPage ?? tracked('listRoutingPage', { items: [row], nextCursor: null }),
    findRouting: overrides.findRouting ?? tracked('findRouting', detail),
    createRouting: overrides.createRouting ?? tracked('createRouting', created),
    publish:
      overrides.publish ??
      tracked('publish', { id: row.id, kind: 'routing', version: 1, status: 'PUBLISHED' }),
  }) as unknown as Repository;

type Grant = { scopes: string[]; fields: readonly string[] | null };
// commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
const dependencyScope = (manufacturing: Repository | null): ApiDependencies =>
  ({ manufacturing, commercial: {} }) as unknown as ApiDependencies;

const scopeFor = (
  repo: Repository | null = repository(),
  fields: readonly string[] | null = null,
  grants: Readonly<Record<string, Grant>> = {},
) => {
  const permissions = new Map<PermissionKey, Grant>(
    Object.entries({
      'routing:read': { scopes: ['COMPANY'], fields },
      'routing:manage': { scopes: ['COMPANY'], fields: null },
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
  pathname: '/api/v1/manufacturing-routings',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null) =>
  (response?.body as { error: { code: string; message: string } }).error;

afterEach(() => {
  calls.length = 0;
});

describe('manufacturing-routings fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无 nextCursor 键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(calls).toEqual([{ method: 'listRoutingPage', args: [scopeContext, {}] }]);
  });

  it('GET 列表 status/query/productType/cursor/limit 透传；分页时附 nextCursor', async () => {
    const listRoutingPage = vi
      .fn()
      .mockResolvedValue({ items: [row], nextCursor: 'RT-KT-PRO-50.1' });
    const repo = repository({ listRoutingPage });
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        query: {
          status: 'PUBLISHED',
          query: ' PRO-50 ',
          productType: 'FINISHED_GOOD',
          cursor: 'RT-KT-PRO-40.2',
          limit: '50',
        },
      }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row], nextCursor: 'RT-KT-PRO-50.1' });
    expect(listRoutingPage).toHaveBeenCalledWith(scopeContext, {
      limit: 50,
      cursor: 'RT-KT-PRO-40.2',
      status: 'PUBLISHED',
      query: 'PRO-50',
      productType: 'FINISHED_GOOD',
    });
  });

  it('GET 列表查询参数负例映射 400 invalid_request', async () => {
    for (const query of [
      { status: 'ARCHIVED' },
      { productType: 'RAW_MATERIAL' },
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

  it('GET 列表字段裁剪（routing:read allowlist）裁掉未授权键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['code', 'name']),
    );
    expect((response?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: row.id,
      code: row.code,
      name: row.name,
    });
  });

  it('GET 详情命中返回根行+产品+全部版本（工序升序）；404 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-routings/${routingId}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(detail);
    expect(calls[0]?.method).toBe('findRouting');
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/manufacturing-routings/44444444-4444-4444-8444-444444444440',
      }),
      scopeFor(repository({ findRouting: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(errorOf(missing)).toEqual({
      code: 'not_found',
      message: 'Manufacturing routing not found',
      correlationId: 'corr-1',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/manufacturing-routings/99999999-9999-9999-9999-999999999999',
      }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('routingId must be a UUID');
  });

  it('GET 详情字段裁剪：未授权聚合键随顶层 allowlist 一并裁掉', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-routings/${routingId}` }),
      scopeFor(repository(), ['code', 'versions']),
    );
    expect(response?.body).toEqual({ id: routingId, code: detail.code, versions: detail.versions });
  });

  it('POST 创建走 legacy 同解析链（trim/stableCode/operations 七字段/instructions hasOwn 默认）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: ' RT-KT-PRO-50 ',
          name: ' 50mm 景观草标准工艺 ',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          effectiveAt: '2026-11-24T08:00:00+08:00',
          operations: [
            {
              operationCode: ' TUFT ',
              name: ' 簇绒 ',
              workCenterCode: ' WC-TUFT-01 ',
              sequence: 10,
              setupMinutes: ' 60 ',
              runMinutesPerUnit: ' 0.800000 ',
            },
          ],
          publish: false,
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(created);
    expect(calls).toEqual([
      {
        method: 'createRouting',
        args: [
          {
            code: 'RT-KT-PRO-50',
            name: '50mm 景观草标准工艺',
            productItemId: '66666666-6666-4666-8666-666666666666',
            productItemVersionId: '77777777-7777-4777-8777-777777777777',
            effectiveAt: '2026-11-24T00:00:00.000Z',
            operations: [
              {
                operationCode: 'TUFT',
                name: '簇绒',
                workCenterCode: 'WC-TUFT-01',
                sequence: 10,
                setupMinutes: '60',
                runMinutesPerUnit: '0.8',
                instructions: {},
              },
            ],
            publish: false,
          },
          scopeContext,
          'corr-1',
        ],
      },
    ]);
  });

  it('POST publish 仅在严格 true 时置位；空 operations 拒绝', async () => {
    await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'RT-KT-PRO-50',
          name: 'RT',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          effectiveAt: '2026-11-24T00:00:00Z',
          operations: [
            {
              operationCode: 'TUFT',
              name: '簇绒',
              workCenterCode: 'WC-TUFT-01',
              sequence: 10,
              setupMinutes: '60',
              runMinutesPerUnit: '0.8',
              instructions: { checkpoint: true },
            },
          ],
          publish: 'yes',
        },
      }),
      scopeFor(),
    );
    expect(calls[0]?.args[0]).toMatchObject({
      publish: false,
      operations: [{ instructions: { checkpoint: true } }],
    });
    const empty = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'RT-KT-PRO-50',
          name: 'RT',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          effectiveAt: '2026-11-24T00:00:00Z',
          operations: [],
        },
      }),
      scopeFor(),
    );
    expect(empty?.statusCode).toBe(400);
    expect(errorOf(empty).message).toBe('operations must not be empty');
  });

  it('POST 负例沿用 legacy 消息（未知字段/编码/工序字段/工序码/序列范围）', async () => {
    const base = {
      code: 'RT-KT-PRO-50',
      name: 'RT',
      productItemId: '66666666-6666-4666-8666-666666666666',
      productItemVersionId: '77777777-7777-4777-8777-777777777777',
      effectiveAt: '2026-11-24T00:00:00Z',
      operations: [
        {
          operationCode: 'TUFT',
          name: '簇绒',
          workCenterCode: 'WC-TUFT-01',
          sequence: 10,
          setupMinutes: '60',
          runMinutesPerUnit: '0.8',
        },
      ],
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, code: undefined }, 'code is required'],
      [
        { ...base, code: 'rt-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        {
          ...base,
          operations: [
            {
              operationCode: 'TUFT',
              name: '簇绒',
              workCenterCode: 'WC-TUFT-01',
              sequence: 10,
              setupMinutes: '60',
              runMinutesPerUnit: '0.8',
              extra: 1,
            },
          ],
        },
        'Unsupported fields: extra',
      ],
      [
        { ...base, operations: [{ ...base.operations[0], operationCode: 'tuft' }] },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        { ...base, operations: [{ ...base.operations[0], sequence: 0 }] },
        'sequence must be an integer between 1 and 100000',
      ],
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

  it('POST 响应按 routing:read 字段投影（mutationDto 同口径）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'RT-KT-PRO-51',
          name: 'RT',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          effectiveAt: '2026-11-24T00:00:00Z',
          operations: [
            {
              operationCode: 'TUFT',
              name: '簇绒',
              workCenterCode: 'WC-TUFT-01',
              sequence: 10,
              setupMinutes: '60',
              runMinutesPerUnit: '0.8',
            },
          ],
        },
      }),
      scopeFor(repository(), ['code', 'version']),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({ id: created.id, code: created.code, version: 1 });
  });

  it('PUT publish 分派 legacy publish(routing) 同链 → 201 + mutation 投影；负例', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-routings/${row.id}/publish`,
        body: {},
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(calls[0]).toEqual({
      method: 'publish',
      args: ['routing', row.id, scopeContext, 'corr-1'],
    });
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-routings/${row.id}/publish`,
        body: { unexpected: 1 },
      }),
      scopeFor(),
    );
    expect(missing?.statusCode).toBe(400);
    expect(errorOf(missing).message).toBe('Unsupported fields: unexpected');
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-routings/${row.id}/publish`,
        body: {},
      }),
      scopeFor(
        repository({
          publish: vi
            .fn()
            .mockRejectedValue(
              new DomainError('not_found', 'Draft manufacturing version not found'),
            ),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(404);
    const denied = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-routings/${row.id}/publish`,
        body: {},
      }),
      scopeFor(repository(), null, { 'routing:manage': { scopes: [], fields: null } }),
    );
    expect(denied?.statusCode).toBe(403);
  });

  it('权限负例：无 routing:manage 的 POST/PUT 403；无读权限的 GET 403；依赖缺失 503', async () => {
    const read = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['routing:read', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const deniedWrite = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'RT-KT-PRO-50',
          name: 'RT',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          effectiveAt: '2026-11-24T00:00:00Z',
          operations: [
            {
              operationCode: 'TUFT',
              name: '簇绒',
              workCenterCode: 'WC-TUFT-01',
              sequence: 10,
              setupMinutes: '60',
              runMinutesPerUnit: '0.8',
            },
          ],
        },
      }),
      read,
    );
    expect(deniedWrite?.statusCode).toBe(403);
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
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
    expect(errorOf(unavailable).code).toBe('internal_error');
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ method: 'DELETE', pathname: `/api/v1/manufacturing-routings/${row.id}` }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/manufacturing-routings/' }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('fastify bridge 行为守恒（manufacturing-routings 对比 legacy）', () => {
  const fieldsFor = (authorization: AuthorizationContext, capability: PermissionKey) =>
    authorization.permissions.get(capability)?.fields ?? null;

  it('GET /api/v1/manufacturing-routings：新旧轨响应逐键一致（含字段遮蔽）', async () => {
    for (const fields of [null, ['code', 'name']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const legacyList = vi.fn().mockResolvedValue([row]);
      const bridgedPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: null });
      const repo = repository({ list: legacyList, listRoutingPage: bridgedPage });
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/manufacturing-routings' };
      const legacy = await dispatchRoutes(
        manufacturingReadRoutes({
          repository: () => repo,
          view: 'routings',
          capability: 'routing:read',
          authorization: authz,
          authorizeQuery,
          permittedDto: (value) => permittedDto(value, fieldsFor(authz, 'routing:read')),
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      // 两轨仓储实参等价：legacy list('routings', scope) ↔ 桥轨 listRoutingPage(scope, {})。
      expect(legacyList).toHaveBeenCalledWith('routings', scopeContext);
      expect(bridgedPage).toHaveBeenCalledWith(scopeContext, {});
    }
  });

  it('POST /api/v1/manufacturing-routings：新旧轨响应与仓储实参逐字节一致', async () => {
    for (const fields of [null, ['code', 'version']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const repo = repository();
      const body = {
        code: ' RT-KT-PRO-50 ',
        name: ' 50mm 景观草标准工艺 ',
        productItemId: '66666666-6666-4666-8666-666666666666',
        productItemVersionId: '77777777-7777-4777-8777-777777777777',
        effectiveAt: '2026-11-24T08:00:00+08:00',
        publish: true,
        operations: [
          {
            operationCode: ' TUFT ',
            name: ' 簇绒 ',
            workCenterCode: ' WC-TUFT-01 ',
            sequence: 10,
            setupMinutes: ' 60 ',
            runMinutesPerUnit: ' 0.800000 ',
            instructions: {},
          },
        ],
      };
      const request: ApiRequest = {
        method: 'POST',
        pathname: '/api/v1/manufacturing-routings',
        body,
      };
      const legacyRepo = { createRouting: vi.fn().mockResolvedValue(created) };
      calls.length = 0;
      const legacy = await dispatchRoutes(
        manufacturingRoutingCreateRoutes({
          repository: () => legacyRepo,
          authorization: authz,
          authorizeQuery,
          correlationId: 'corr-1',
          parsers: {
            objectBody,
            allow,
            string,
            stableCode: assertStableCode,
            jsonObject,
            array,
            uuid,
            decimal,
            integer,
            timestamp,
          },
          mutationDto: (value) => mutationDto(value, authz, 'routing:read'),
        }),
        request,
      );
      const legacyCall = legacyRepo.createRouting.mock.calls[0];
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(calls[0]?.args).toEqual(legacyCall);
    }
  });
});
