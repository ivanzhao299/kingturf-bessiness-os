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
import { manufacturingBomCreateRoutes } from '../../src/routes/manufacturing-bom-create.ts';
import { manufacturingReadRoutes } from '../../src/routes/manufacturing-reads.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-MFG-2：manufacturing-boms Fastify 组契约测试——GET 列表（默认全量 { items } 与
// legacy 逐字节一致；status/query/productType/cursor/limit 透传 + nextCursor 仅分页
// 时附加）、GET 详情（additive 只读：根行 + 产品信息 + 各版本行项（组件含单位/类型 +
// 替代料）+ 最新已发布版本组件层级树（深度受限、环守卫））、POST 创建（legacy 同解析
// 链，入参 oracle 与负例消息逐字一致）、PUT publish（分派 legacy publish('bom') 同链）、
// 与 legacy 轨逐键 parity、依赖缺失 503 与未认领方法落回 null。
const tenant = '11111111-1111-4111-8111-111111111111';
const bomId = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const row = {
  id: '55555555-5555-4555-8555-555555555555',
  tenant_id: tenant,
  bom_id: bomId,
  version: 1,
  status: 'PUBLISHED',
  product_item_version_id: '77777777-7777-4777-8777-777777777777',
  output_quantity: 1,
  effective_at: '2026-01-01T00:00:00+00:00',
  canonical_hash: 'a'.repeat(64),
  published_at: '2026-01-02T00:00:00+00:00',
  created_by: 'e-1',
  created_at: '2026-12-01T00:00:00+00:00',
  bomId,
  code: 'BOM-KT-PRO-50',
  name: '50mm 景观草标准 BOM',
  productItemId: '66666666-6666-4666-8666-666666666666',
  lines: [
    {
      id: 'line-1',
      line_number: 1,
      quantity: 1.25,
      scrap_basis_points: 300,
      component: { sku: 'RM-KT-YARN-12000', name: '12000D 直丝草纱', version: 1 },
      substitutes: [
        {
          id: 'sub-1',
          priority: 1,
          conversion_factor: 1.05,
          sku: 'RM-KT-YARN-11000',
          version: 1,
        },
      ],
    },
  ],
};
const line = {
  lineNumber: 1,
  quantity: 1.25,
  scrapBasisPoints: 300,
  component: {
    itemId: '88888888-8888-4888-8888-888888888888',
    sku: 'RM-KT-YARN-12000',
    name: '12000D 直丝草纱',
    version: 1,
    itemType: 'RAW_MATERIAL',
    baseUnitCode: 'KG',
  },
  substitutes: [
    {
      itemVersionId: '99999999-9999-4999-8999-999999999999',
      priority: 1,
      conversionFactor: 1.05,
      sku: 'RM-KT-YARN-11000',
      name: '11000D 替代草纱',
      version: 1,
    },
  ],
};
const detail = {
  id: bomId,
  code: 'BOM-KT-PRO-50',
  name: '50mm 景观草标准 BOM',
  productItemId: '66666666-6666-4666-8666-666666666666',
  created_at: '2026-12-01T00:00:00+00:00',
  product: {
    itemId: '66666666-6666-4666-8666-666666666666',
    sku: 'FG-KT-PRO-50',
    name: '金特夫 50mm 景观草',
    itemType: 'FINISHED_GOOD',
    baseUnitCode: 'M2',
  },
  versions: [
    {
      id: row.id,
      version: 1,
      status: 'PUBLISHED',
      outputQuantity: 1,
      effective_at: '2026-01-01T00:00:00+00:00',
      published_at: '2026-01-02T00:00:00+00:00',
      lines: [line],
    },
  ],
  tree: [
    {
      bomVersionId: row.id,
      code: 'BOM-KT-PRO-50',
      name: '50mm 景观草标准 BOM',
      version: 1,
      status: 'PUBLISHED',
      lines: [{ ...line, bom: null }],
    },
  ],
};
const created = {
  id: row.id,
  bomId,
  version: 1,
  status: 'DRAFT',
  code: 'BOM-KT-PRO-50',
  name: '50mm 景观草标准 BOM',
  productItemId: '66666666-6666-4666-8666-666666666666',
  productItemVersionId: '77777777-7777-4777-8777-777777777777',
  outputQuantity: '1',
  effectiveAt: '2026-11-23T00:00:00.000Z',
  lines: [
    {
      componentItemVersionId: '88888888-8888-4888-8888-888888888888',
      quantity: '1.25',
      scrapBasisPoints: 300,
      substitutes: [],
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
    listBomPage?: ReturnType<typeof vi.fn>;
    findBom?: ReturnType<typeof vi.fn>;
    createBom?: ReturnType<typeof vi.fn>;
    publish?: ReturnType<typeof vi.fn>;
    list?: ReturnType<typeof vi.fn>;
  } = {},
): Repository =>
  ({
    list: overrides.list ?? tracked('list', [row]),
    listBomPage:
      overrides.listBomPage ?? tracked('listBomPage', { items: [row], nextCursor: null }),
    findBom: overrides.findBom ?? tracked('findBom', detail),
    createBom: overrides.createBom ?? tracked('createBom', created),
    publish:
      overrides.publish ??
      tracked('publish', { id: row.id, kind: 'bom', version: 1, status: 'PUBLISHED' }),
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
      'bom:read': { scopes: ['COMPANY'], fields },
      'bom:manage': { scopes: ['COMPANY'], fields: null },
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
  pathname: '/api/v1/manufacturing-boms',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null) =>
  (response?.body as { error: { code: string; message: string } }).error;

afterEach(() => {
  calls.length = 0;
});

describe('manufacturing-boms fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无 nextCursor 键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(calls).toEqual([{ method: 'listBomPage', args: [scopeContext, {}] }]);
  });

  it('GET 列表 status/query/productType/cursor/limit 透传；分页时附 nextCursor', async () => {
    const listBomPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: 'BOM-KT-PRO-50.1' });
    const repo = repository({ listBomPage });
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        query: {
          status: 'PUBLISHED',
          query: ' PRO-50 ',
          productType: 'FINISHED_GOOD',
          cursor: 'BOM-KT-PRO-40.2',
          limit: '50',
        },
      }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [row], nextCursor: 'BOM-KT-PRO-50.1' });
    expect(listBomPage).toHaveBeenCalledWith(scopeContext, {
      limit: 50,
      cursor: 'BOM-KT-PRO-40.2',
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

  it('GET 列表字段裁剪（bom:read allowlist）裁掉未授权键', async () => {
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

  it('GET 详情命中返回根行+产品+版本行项+层级树；404 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-boms/${bomId}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(detail);
    expect(calls[0]?.method).toBe('findBom');
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/manufacturing-boms/44444444-4444-4444-8444-444444444440' }),
      scopeFor(repository({ findBom: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(errorOf(missing)).toEqual({
      code: 'not_found',
      message: 'Manufacturing BOM not found',
      correlationId: 'corr-1',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/manufacturing-boms/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('bomId must be a UUID');
  });

  it('GET 详情字段裁剪：未授权聚合键随顶层 allowlist 一并裁掉', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-boms/${bomId}` }),
      scopeFor(repository(), ['code', 'versions']),
    );
    expect(response?.body).toEqual({ id: bomId, code: detail.code, versions: detail.versions });
  });

  // TD-WF-011（WF-A）：纯草稿 BOM 的详情现在也带组件层级树（仓储 findBom 的改动）。端点
  // 本身没改；这里钉住 HTTP 形状——草稿树原样透传、根与行项的状态是 DRAFT、替代料标记
  // 在、字段裁剪行为与已发布详情一致。真库行为见 manufacturing-postgres.integration。
  it('TD-WF-011：纯草稿 BOM 的详情透传以草稿版本为根的层级树（含替代料），裁剪规则不变', async () => {
    const draftLine = { ...line, lineNumber: 2, quantity: 9 };
    const draftDetail = {
      ...detail,
      versions: [
        {
          id: detail.versions[0]?.id,
          version: 1,
          status: 'DRAFT',
          outputQuantity: 1,
          effective_at: '2026-01-01T00:00:00+00:00',
          published_at: null,
          lines: [line, draftLine],
        },
      ],
      tree: [
        {
          bomVersionId: detail.tree[0]?.bomVersionId,
          code: 'BOM-KT-PRO-50',
          name: '50mm 景观草标准 BOM',
          version: 1,
          status: 'DRAFT',
          lines: [
            { ...line, bom: null },
            { ...draftLine, substitutes: [], bom: null },
          ],
        },
      ],
    };
    const full = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-boms/${bomId}` }),
      scopeFor(repository({ findBom: vi.fn().mockResolvedValue(draftDetail) })),
    );
    expect(full?.statusCode).toBe(200);
    expect(full?.body).toEqual(draftDetail);
    const tree = (full?.body as { tree: { status: unknown; lines: unknown[] }[] }).tree;
    expect(tree).toHaveLength(1);
    expect(tree[0]?.status).toBe('DRAFT');
    expect(tree[0]?.lines).toHaveLength(2);
    expect((tree[0]?.lines[0] as { substitutes: unknown[] }).substitutes).toEqual(line.substitutes);
    const cropped = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/manufacturing-boms/${bomId}` }),
      scopeFor(repository({ findBom: vi.fn().mockResolvedValue(draftDetail) }), ['code', 'tree']),
    );
    expect(cropped?.body).toEqual({ id: bomId, code: draftDetail.code, tree: draftDetail.tree });
  });

  it('POST 创建走 legacy 同解析链（trim/stableCode/lines 行四字段/替代料三字段/hasOwn 默认）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: ' BOM-KT-PRO-50 ',
          name: ' 50mm 景观草标准 BOM ',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          outputQuantity: ' 1.000000 ',
          effectiveAt: '2026-11-23T08:00:00+08:00',
          lines: [
            {
              componentItemVersionId: '88888888-8888-4888-8888-888888888888',
              quantity: ' 1.250000 ',
              substitutes: [
                {
                  itemVersionId: '99999999-9999-4999-8999-999999999999',
                  priority: 1,
                  conversionFactor: ' 1.050000 ',
                },
              ],
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
        method: 'createBom',
        args: [
          {
            code: 'BOM-KT-PRO-50',
            name: '50mm 景观草标准 BOM',
            productItemId: '66666666-6666-4666-8666-666666666666',
            productItemVersionId: '77777777-7777-4777-8777-777777777777',
            outputQuantity: '1',
            effectiveAt: '2026-11-23T00:00:00.000Z',
            lines: [
              {
                componentItemVersionId: '88888888-8888-4888-8888-888888888888',
                quantity: '1.25',
                scrapBasisPoints: 0,
                substitutes: [
                  {
                    itemVersionId: '99999999-9999-4999-8999-999999999999',
                    priority: 1,
                    conversionFactor: '1.05',
                  },
                ],
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

  it('POST publish 仅在严格 true 时置位；空 lines 拒绝', async () => {
    await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'BOM-KT-PRO-50',
          name: 'BOM',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          outputQuantity: '1',
          effectiveAt: '2026-11-23T00:00:00Z',
          lines: [
            { componentItemVersionId: '88888888-8888-4888-8888-888888888888', quantity: '1' },
          ],
          publish: 'yes',
        },
      }),
      scopeFor(),
    );
    expect(calls[0]?.args[0]).toMatchObject({ publish: false });
    // scrapBasisPoints/substitutes 为行级 hasOwn 缺省（非顶层）。
    expect((calls[0]?.args[0] as { lines: Record<string, unknown>[] }).lines[0]).toEqual({
      componentItemVersionId: '88888888-8888-4888-8888-888888888888',
      quantity: '1',
      scrapBasisPoints: 0,
      substitutes: [],
    });
    const empty = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'BOM-KT-PRO-50',
          name: 'BOM',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          outputQuantity: '1',
          effectiveAt: '2026-11-23T00:00:00Z',
          lines: [],
        },
      }),
      scopeFor(),
    );
    expect(empty?.statusCode).toBe(400);
    expect(errorOf(empty).message).toBe('lines must not be empty');
  });

  it('POST 负例沿用 legacy 消息（未知字段/编码/行字段/替代料字段/优先级）', async () => {
    const base = {
      code: 'BOM-KT-PRO-50',
      name: 'BOM',
      productItemId: '66666666-6666-4666-8666-666666666666',
      productItemVersionId: '77777777-7777-4777-8777-777777777777',
      outputQuantity: '1',
      effectiveAt: '2026-11-23T00:00:00Z',
      lines: [{ componentItemVersionId: '88888888-8888-4888-8888-888888888888', quantity: '1' }],
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, code: undefined }, 'code is required'],
      [
        { ...base, code: 'bom-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [
        {
          ...base,
          lines: [
            {
              componentItemVersionId: '88888888-8888-4888-8888-888888888888',
              quantity: '1',
              extra: 1,
            },
          ],
        },
        'Unsupported fields: extra',
      ],
      [
        {
          ...base,
          lines: [
            {
              componentItemVersionId: '88888888-8888-4888-8888-888888888888',
              quantity: '1',
              substitutes: [{ itemVersionId: '99999999-9999-4999-8999-999999999999', priority: 0 }],
            },
          ],
        },
        'priority must be an integer between 1 and 1000',
      ],
      [
        { ...base, lines: [{ componentItemVersionId: 'not-a-uuid', quantity: '1' }] },
        'lines[0].componentItemVersionId must be a UUID',
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

  it('POST 响应按 bom:read 字段投影（mutationDto 同口径）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'BOM-KT-PRO-51',
          name: 'BOM',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          outputQuantity: '1',
          effectiveAt: '2026-11-23T00:00:00Z',
          lines: [
            { componentItemVersionId: '88888888-8888-4888-8888-888888888888', quantity: '1' },
          ],
        },
      }),
      scopeFor(repository(), ['code', 'version']),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({ id: created.id, code: created.code, version: 1 });
  });

  it('PUT publish 分派 legacy publish(bom) 同链 → 201 + mutation 投影；负例', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
        body: {},
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(calls[0]).toEqual({
      method: 'publish',
      args: ['bom', row.id, scopeContext, 'corr-1'],
    });
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
        body: { unexpected: 1 },
      }),
      scopeFor(),
    );
    expect(missing?.statusCode).toBe(400);
    expect(errorOf(missing).message).toBe('Unsupported fields: unexpected');
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
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
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
        body: {},
      }),
      scopeFor(repository(), null, { 'bom:manage': { scopes: [], fields: null } }),
    );
    expect(denied?.statusCode).toBe(403);
  });

  it('PUT publish 把「组件未发布」的 conflict 变成 409 且消息原样；其它数据库异常仍是 500（TD-MFG-015）', async () => {
    const message =
      '无法发布 BOM：以下组件尚未发布：RAW-D（草稿纱）。请先发布这些组件版本，再发布 BOM';
    const blocked = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
        body: {},
      }),
      scopeFor(
        repository({ publish: vi.fn().mockRejectedValue(new DomainError('conflict', message)) }),
      ),
    );
    expect(blocked?.statusCode).toBe(409);
    expect(errorOf(blocked)).toEqual({ code: 'conflict', message, correlationId: 'corr-1' });
    // 触发器的其它拒绝（产品未发布等）沿用本端点既有做法：不映射，仍是 500，不回显数据库消息。
    const crashed = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/manufacturing-boms/${row.id}/publish`,
        body: {},
      }),
      scopeFor(
        repository({
          publish: vi
            .fn()
            .mockRejectedValue(
              Object.assign(
                new Error(
                  'BOM publication requires published product, component, and substitute versions',
                ),
                { code: 'P0001' },
              ),
            ),
        }),
      ),
    );
    expect(crashed?.statusCode).toBe(500);
    expect(errorOf(crashed).code).toBe('internal_error');
    expect(errorOf(crashed).message).toBe('Internal server error');
  });

  it('权限负例：无 bom:manage 的 POST/PUT 403；无读权限的 GET 403；依赖缺失 503', async () => {
    const read = {
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>([
          ['bom:read', { scopes: ['COMPANY'], fields: null }],
        ]),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repository()),
      correlationId: 'corr-1',
    };
    const deniedWrite = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          code: 'BOM-KT-PRO-50',
          name: 'BOM',
          productItemId: '66666666-6666-4666-8666-666666666666',
          productItemVersionId: '77777777-7777-4777-8777-777777777777',
          outputQuantity: '1',
          effectiveAt: '2026-11-23T00:00:00Z',
          lines: [
            { componentItemVersionId: '88888888-8888-4888-8888-888888888888', quantity: '1' },
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
        requestFor({ method: 'DELETE', pathname: `/api/v1/manufacturing-boms/${row.id}` }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(
      await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/manufacturing-boms/' }),
        scopeFor(),
      ),
    ).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('fastify bridge 行为守恒（manufacturing-boms 对比 legacy）', () => {
  const fieldsFor = (authorization: AuthorizationContext, capability: PermissionKey) =>
    authorization.permissions.get(capability)?.fields ?? null;

  it('GET /api/v1/manufacturing-boms：新旧轨响应逐键一致（含字段遮蔽）', async () => {
    for (const fields of [null, ['code', 'name']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const legacyList = vi.fn().mockResolvedValue([row]);
      const bridgedPage = vi.fn().mockResolvedValue({ items: [row], nextCursor: null });
      const repo = repository({ list: legacyList, listBomPage: bridgedPage });
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/manufacturing-boms' };
      const legacy = await dispatchRoutes(
        manufacturingReadRoutes({
          repository: () => repo,
          view: 'boms',
          capability: 'bom:read',
          authorization: authz,
          authorizeQuery,
          permittedDto: (value) => permittedDto(value, fieldsFor(authz, 'bom:read')),
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: dependencyScope(repo),
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      // 两轨仓储实参等价：legacy list('boms', scope) ↔ 桥轨 listBomPage(scope, {})。
      expect(legacyList).toHaveBeenCalledWith('boms', scopeContext);
      expect(bridgedPage).toHaveBeenCalledWith(scopeContext, {});
    }
  });

  it('POST /api/v1/manufacturing-boms：新旧轨响应与仓储实参逐字节一致', async () => {
    for (const fields of [null, ['code', 'version']] as const) {
      const authz = scopeFor(repository(), fields).authorization;
      const repo = repository();
      const body = {
        code: ' BOM-KT-PRO-50 ',
        name: ' 50mm 景观草标准 BOM ',
        productItemId: '66666666-6666-4666-8666-666666666666',
        productItemVersionId: '77777777-7777-4777-8777-777777777777',
        outputQuantity: ' 1.000000 ',
        effectiveAt: '2026-11-23T08:00:00+08:00',
        publish: true,
        lines: [
          {
            componentItemVersionId: '88888888-8888-4888-8888-888888888888',
            quantity: ' 1.250000 ',
            scrapBasisPoints: 0,
            substitutes: [
              {
                itemVersionId: '99999999-9999-4999-8999-999999999999',
                priority: 1,
                conversionFactor: ' 1.050000 ',
              },
            ],
          },
        ],
      };
      const request: ApiRequest = { method: 'POST', pathname: '/api/v1/manufacturing-boms', body };
      const legacyRepo = { createBom: vi.fn().mockResolvedValue(created) };
      calls.length = 0;
      const legacy = await dispatchRoutes(
        manufacturingBomCreateRoutes({
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
          mutationDto: (value) => mutationDto(value, authz, 'bom:read'),
        }),
        request,
      );
      const legacyCall = legacyRepo.createBom.mock.calls[0];
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
