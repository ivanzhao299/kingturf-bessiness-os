import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStableCode, DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import {
  allow,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
} from '../../src/app-values.ts';
import { authorizeQuery } from '../../src/policy.ts';
import { dispatchRoutes } from '../../src/routes/types.ts';
import { manufacturingItemCreateRoutes } from '../../src/routes/manufacturing-item-create.ts';
import { manufacturingReadRoutes } from '../../src/routes/manufacturing-reads.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-MFG-1：manufacturing-items Fastify 组契约测试——GET 列表（默认全量 { items } 与
// legacy 逐字节一致；itemType/status/query/cursor/limit 透传 + nextCursor 仅分页时
// 附加）、GET 详情（additive 只读 + 404 信封 + 关联聚合按读权限门控）、POST 创建
// （legacy 同解析链，入参 oracle 与负例消息逐字一致）、与 legacy 轨逐键 parity、
// 依赖缺失 503 与 DomainError 状态映射。
const tenant = '11111111-1111-4111-8111-111111111111';
const itemId = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const row = {
  id: '55555555-5555-4555-8555-555555555555',
  tenant_id: tenant,
  item_id: itemId,
  version: 1,
  status: 'PUBLISHED',
  specification: { pileHeightMm: 50, gauge: '3/8' },
  effective_at: '2026-01-01T00:00:00+00:00',
  canonical_hash: 'a'.repeat(64),
  published_at: '2026-01-02T00:00:00+00:00',
  created_by: 'e-1',
  created_at: '2026-12-01T00:00:00+00:00',
  itemId,
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
};
const detail = {
  id: itemId,
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  created_at: '2026-12-01T00:00:00+00:00',
  versions: [row],
  boms: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      code: 'BOM-KT-PRO-50',
      name: '50mm 景观草标准 BOM',
      versions: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          version: 1,
          status: 'PUBLISHED',
          effective_at: '2026-01-01T00:00:00+00:00',
          published_at: '2026-01-02T00:00:00+00:00',
        },
      ],
    },
  ],
  usedIn: [
    {
      bomId: '66666666-6666-4666-8666-666666666666',
      code: 'BOM-KT-PRO-50',
      name: '50mm 景观草标准 BOM',
      bomVersionId: '77777777-7777-4777-8777-777777777777',
      version: 1,
      status: 'PUBLISHED',
      role: 'COMPONENT',
      lineNumber: 1,
      quantity: 1.25,
    },
  ],
  routings: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      code: 'RT-KT-PRO-50',
      name: '50mm 景观草标准工艺',
      versions: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          version: 1,
          status: 'PUBLISHED',
          effective_at: '2026-01-01T00:00:00+00:00',
          published_at: '2026-01-02T00:00:00+00:00',
        },
      ],
    },
  ],
  productionOrders: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      orderNumber: 'WO-KT-2026-001',
      state: 'CLOSED',
      plannedQuantity: 1000,
      plannedStartAt: '2026-08-13',
      plannedDueAt: '2026-08-20',
      itemVersion: 1,
      createdAt: '2026-08-06T00:00:00+00:00',
    },
  ],
};
const created = {
  id: row.id,
  itemId,
  version: 1,
  status: 'DRAFT',
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  specification: { pileHeightMm: 50 },
  effectiveAt: '2026-11-23T00:00:00.000Z',
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
    listItemPage?: ReturnType<typeof vi.fn>;
    findItem?: ReturnType<typeof vi.fn>;
    createItem?: ReturnType<typeof vi.fn>;
    list?: ReturnType<typeof vi.fn>;
  } = {},
): Repository =>
  ({
    list: overrides.list ?? tracked('list', [row]),
    listItemPage:
      overrides.listItemPage ?? tracked('listItemPage', { items: [row], nextCursor: null }),
    findItem: overrides.findItem ?? tracked('findItem', detail),
    createItem: overrides.createItem ?? tracked('createItem', created),
  }) as unknown as Repository;

// commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
const dependencyScope = (manufacturing: Repository | null): ApiDependencies =>
  ({ manufacturing, commercial: {} }) as unknown as ApiDependencies;

type Grant = { scopes: string[]; fields: readonly string[] | null };
const scopeFor = (
  repo: Repository | null = repository(),
  fields: readonly string[] | null = null,
  grants: Readonly<Record<string, Grant>> = {},
) => {
  const permissions = new Map<PermissionKey, Grant>(
    Object.entries({
      'manufacturing-item:read': { scopes: ['COMPANY'], fields },
      'manufacturing-item:manage': { scopes: ['COMPANY'], fields: null },
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
  pathname: '/api/v1/manufacturing-items',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null) =>
  (response?.body as { error: { code: string; message: string } }).error;

afterEach(() => {
  calls.length = 0;
});

describe('manufacturing-items fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无 nextCursor 键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(calls).toEqual([{ method: 'listItemPage', args: [scopeContext, {}] }]);
  });

  it('GET 列表 itemType/status/query/cursor/limit 透传；分页时附 nextCursor', async () => {
    const listItemPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: 'FG-KT-PRO-50.1' });
    const repo = repository({ listItemPage });
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        query: {
          itemType: 'FINISHED_GOOD',
          status: 'PUBLISHED',
          query: ' PRO-50 ',
          cursor: 'FG-KT-PRO-40.2',
          limit: '50',
        },
      }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row], nextCursor: 'FG-KT-PRO-50.1' });
    expect(listItemPage).toHaveBeenCalledWith(scopeContext, {
      limit: 50,
      cursor: 'FG-KT-PRO-40.2',
      itemType: 'FINISHED_GOOD',
      status: 'PUBLISHED',
      // 关键字经 schema trim（空白关键字视为未提供）。
      query: 'PRO-50',
    });
  });

  it('GET 列表查询参数负例映射 400 invalid_request', async () => {
    for (const query of [
      { itemType: 'BOGUS' },
      { status: 'ARCHIVED' },
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

  it('GET 列表字段裁剪（manufacturing-item:read allowlist）裁掉未授权键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['sku', 'name']),
    );
    expect((response?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: row.id,
      sku: row.sku,
      name: row.name,
    });
  });

  it('GET 详情命中返回详情；404 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-items/${itemId}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(detail);
    expect(calls[0]?.method).toBe('findItem');
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/manufacturing-items/44444444-4444-4444-8444-444444444440' }),
      scopeFor(repository({ findItem: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(errorOf(missing)).toEqual({
      code: 'not_found',
      message: 'Manufacturing item not found',
      correlationId: 'corr-1',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/manufacturing-items/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('itemId must be a UUID');
  });

  it('GET 详情关联聚合按读权限门控（bom:read/routing:read/production:read）', async () => {
    await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-items/${itemId}` }),
      scopeFor(repository(), null, {
        'bom:read': { scopes: ['COMPANY'], fields: null },
        'routing:read': { scopes: ['COMPANY'], fields: null },
        'production:read': { scopes: ['COMPANY'], fields: null },
      }),
    );
    expect(calls[0]?.args).toEqual([
      itemId,
      scopeContext,
      { boms: true, routings: true, productionOrders: true },
    ]);
    calls.length = 0;
    await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-items/${itemId}` }),
      scopeFor(repository(), null, {
        // 能力存在但作用域为空——默认拒绝，同 assertPermission 口径。
        'bom:read': { scopes: [], fields: null },
        'routing:read': { scopes: [], fields: null },
      }),
    );
    expect(calls[0]?.args).toEqual([
      itemId,
      scopeContext,
      { boms: false, routings: false, productionOrders: false },
    ]);
  });

  it('GET 详情字段裁剪：未授权聚合键随顶层 allowlist 一并裁掉', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-items/${itemId}` }),
      scopeFor(repository(), ['sku', 'versions'], {
        'bom:read': { scopes: ['COMPANY'], fields: null },
        'production:read': { scopes: ['COMPANY'], fields: null },
      }),
    );
    expect(response?.body).toEqual({ id: itemId, sku: detail.sku, versions: detail.versions });
  });

  it('POST 创建走 legacy 同解析链（trim/stableCode/specification 默认空对象/timestamp 归一）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          sku: ' FG-KT-PRO-50 ',
          name: ' 金特夫 50mm 景观草 ',
          itemType: ' FINISHED_GOOD ',
          baseUnitCode: ' M2 ',
          effectiveAt: '2026-11-23T08:00:00+08:00',
          publish: false,
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(created);
    expect(calls).toEqual([
      {
        method: 'createItem',
        args: [
          {
            sku: 'FG-KT-PRO-50',
            name: '金特夫 50mm 景观草',
            itemType: 'FINISHED_GOOD',
            baseUnitCode: 'M2',
            specification: {},
            effectiveAt: '2026-11-23T00:00:00.000Z',
            publish: false,
          },
          scopeContext,
          'corr-1',
        ],
      },
    ]);
  });

  it('POST publish 仅在严格 true 时置位；specification 原样透传', async () => {
    await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          sku: 'FG-KT-PRO-50',
          name: '景观草',
          itemType: 'FINISHED_GOOD',
          baseUnitCode: 'M2',
          specification: { pileHeightMm: 50, gauge: '3/8' },
          effectiveAt: '2026-11-23T00:00:00Z',
          publish: 'yes',
        },
      }),
      scopeFor(),
    );
    expect(calls[0]?.args[0]).toMatchObject({
      specification: { pileHeightMm: 50, gauge: '3/8' },
      publish: false,
    });
  });

  it('POST 负例沿用 legacy 消息（未知字段/类型/编码/规格对象/时间戳）', async () => {
    const base = {
      sku: 'FG-KT-PRO-50',
      name: '景观草',
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'M2',
      effectiveAt: '2026-11-23T00:00:00Z',
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, itemType: undefined }, 'itemType is required'],
      [{ ...base, itemType: 'SERVICE' }, 'itemType is unsupported'],
      [{ ...base, sku: undefined }, 'sku is required'],
      [
        { ...base, sku: 'fg-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        { ...base, baseUnitCode: 'm2' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...base, specification: [] }, 'specification must be a JSON object'],
      [{ ...base, effectiveAt: 'not-a-time' }, 'effectiveAt must be a valid timestamp'],
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

  it('POST 响应按 manufacturing-item:read 字段投影（mutationDto 同口径）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          sku: 'FG-KT-PRO-51',
          name: '景观草',
          itemType: 'FINISHED_GOOD',
          baseUnitCode: 'M2',
          effectiveAt: '2026-11-23T00:00:00Z',
        },
      }),
      scopeFor(repository(), ['sku', 'version']),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({ id: created.id, sku: created.sku, version: 1 });
  });

  it('权限负例：无 manufacturing-item:manage 的 POST 403；无读权限的 GET 403', async () => {
    const read = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['manufacturing-item:read', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const deniedWrite = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: { sku: 'FG-KT-PRO-50', name: '景观草', itemType: 'FINISHED_GOOD' },
      }),
      read,
    );
    expect(deniedWrite?.statusCode).toBe(403);
    expect(errorOf(deniedWrite).message).toBe('Permission denied');
    const deniedField = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: { sku: 'FG-KT-PRO-50', name: '景观草', itemType: 'FINISHED_GOOD' },
      }),
      scopeFor(repository(), null, {
        'manufacturing-item:manage': { scopes: ['COMPANY'], fields: ['sku'] },
      }),
    );
    expect(deniedField?.statusCode).toBe(403);
    expect(errorOf(deniedField).message).toBe('Field permission denied');
    const none = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>(),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    for (const pathname of [
      '/api/v1/manufacturing-items',
      `/api/v1/manufacturing-items/${itemId}`,
    ]) {
      const response = await dispatchFastifyRouteGroup(requestFor({ pathname }), none);
      expect(response?.statusCode).toBe(403);
      expect(errorOf(response).code).toBe('forbidden');
    }
    expect(calls).toEqual([]);
  });

  it('仓储 DomainError 映射 legacy 状态码；依赖缺失 503；未认领方法落回 null', async () => {
    const body = {
      sku: 'FG-KT-PRO-50',
      name: '景观草',
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'M2',
      effectiveAt: '2026-11-23T00:00:00Z',
    };
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body }),
      scopeFor(
        repository({
          createItem: vi.fn().mockRejectedValue(new DomainError('conflict', 'duplicate sku')),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(409);
    expect(errorOf(conflict).code).toBe('conflict');
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
    expect(errorOf(unavailable).code).toBe('internal_error');
    expect(
      await dispatchFastifyRouteGroup(requestFor({ method: 'PUT', body }), scopeFor()),
    ).toBeNull();
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/manufacturing-items/' }),
        scopeFor(),
      ),
    ).toBeNull();
  });
});

describe('fastify bridge 行为守恒（manufacturing-items 对比 legacy）', () => {
  const fieldsFor = (authorization: AuthorizationContext, capability: PermissionKey) =>
    authorization.permissions.get(capability)?.fields ?? null;

  it('GET /api/v1/manufacturing-items：新旧轨响应逐键一致（含字段遮蔽）', async () => {
    for (const fields of [null, ['sku', 'name']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const legacyList = vi.fn().mockResolvedValue([row]);
      const bridgedPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: null });
      const repo = repository({ list: legacyList, listItemPage: bridgedPage });
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/manufacturing-items' };
      const legacy = await dispatchRoutes(
        manufacturingReadRoutes({
          repository: () => repo,
          view: 'items',
          capability: 'manufacturing-item:read',
          authorization: authz,
          authorizeQuery,
          permittedDto: (value) => permittedDto(value, fieldsFor(authz, 'manufacturing-item:read')),
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      // 两轨仓储实参等价：legacy list('items', scope) ↔ 桥轨 listItemPage(scope, {})。
      expect(legacyList).toHaveBeenCalledWith('items', scopeContext);
      expect(bridgedPage).toHaveBeenCalledWith(scopeContext, {});
    }
  });

  it('POST /api/v1/manufacturing-items：新旧轨响应与仓储实参逐字节一致', async () => {
    for (const fields of [null, ['sku', 'version']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const repo = repository();
      const body = {
        sku: ' FG-KT-PRO-50 ',
        name: ' 金特夫 50mm 景观草 ',
        itemType: ' FINISHED_GOOD ',
        baseUnitCode: ' M2 ',
        specification: { pileHeightMm: 50 },
        effectiveAt: '2026-11-23T08:00:00+08:00',
        publish: true,
      };
      const request: ApiRequest = { method: 'POST', pathname: '/api/v1/manufacturing-items', body };
      const legacyRepo = { createItem: vi.fn().mockResolvedValue(created) };
      calls.length = 0;
      const legacy = await dispatchRoutes(
        manufacturingItemCreateRoutes({
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
            timestamp,
          },
          mutationDto: (value) => mutationDto(value, authz, 'manufacturing-item:read'),
        }),
        request,
      );
      const legacyCall = legacyRepo.createItem.mock.calls[0];
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
