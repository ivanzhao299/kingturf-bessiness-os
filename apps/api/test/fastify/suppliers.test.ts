import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-PROC-1：suppliers Fastify 组契约测试——GET 列表（默认全量 { items } 与 legacy
// 逐字节一致；status/cursor/limit 透传 + nextCursor 仅分页时附加）、GET 详情
// （additive 只读 + 404 信封）、POST 创建（legacy 同解析链，入参 oracle 与负例消息
// 逐字一致）、PUT qualification（action approve|conditional|reject 统一动作端点分派
// legacy qualifySupplier 同链）、依赖缺失 503 与 DomainError 状态映射。
const supplier = {
  id: '44444444-4444-4444-8444-444444444444',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  supplier_number: 'SUP-KT-YARN-001',
  name: '青岛金特夫草纱战略供应商',
  status: 'ACTIVE',
  currency: 'CNY',
  payment_terms_days: 30,
  quality_rating_basis_points: 9200,
  contact: { name: '王经理', phone: '13800000000' },
  qualifications: [
    { id: 'q-1', status: 'APPROVED', sku: 'RM-KT-YARN-12000', itemName: '草纱', itemVersion: 1 },
  ],
  created_at: '2026-09-20T00:00:00+00:00',
  updated_at: '2026-09-20T00:00:00+00:00',
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listSupplierPage?: ReturnType<typeof vi.fn>;
    findSupplier?: ReturnType<typeof vi.fn>;
    createSupplier?: ReturnType<typeof vi.fn>;
    qualifySupplier?: ReturnType<typeof vi.fn>;
    setSupplierStatus?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listSupplierPage:
      overrides.listSupplierPage ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listSupplierPage', args });
        return Promise.resolve({ items: [supplier], nextCursor: null });
      }),
    findSupplier:
      overrides.findSupplier ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findSupplier', args });
        return Promise.resolve(supplier);
      }),
    createSupplier:
      overrides.createSupplier ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'createSupplier', args });
        return Promise.resolve(supplier);
      }),
    qualifySupplier:
      overrides.qualifySupplier ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'qualifySupplier', args });
        return Promise.resolve({ id: 'q-2', supplierId: supplier.id, status: 'APPROVED' });
      }),
    setSupplierStatus:
      overrides.setSupplierStatus ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'setSupplierStatus', args });
        return Promise.resolve({ id: supplier.id, status: args[1] });
      }),
  }) as unknown as NonNullable<ApiDependencies['procurement']>;

const scopeFor = (
  repo: NonNullable<ApiDependencies['procurement']> | null = repository(),
  fields: readonly string[] | null = null,
) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['supplier:read', { scopes: ['COMPANY'], fields }],
      ['supplier:manage', { scopes: ['COMPANY'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  // commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
  dependencies: {
    procurement: repo,
    commercial: repository(),
  } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown; query?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/suppliers',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('suppliers fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无 nextCursor 键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [supplier] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(repositoryCalls[0]?.args[1]).toEqual({});
  });

  it('GET 列表 status/cursor/limit 透传；分页时附 nextCursor', async () => {
    const repo = repository({
      listSupplierPage: vi
        .fn()
        .mockResolvedValue({ items: [supplier], nextCursor: 'SUP-KT-YARN-002' }),
    });
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { status: 'ACTIVE', cursor: 'SUP-KT-YARN-000', limit: '50' } }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [supplier], nextCursor: 'SUP-KT-YARN-002' });
    expect(
      (repo as unknown as { listSupplierPage: ReturnType<typeof vi.fn> }).listSupplierPage,
    ).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['COMPANY'] }), {
      limit: 50,
      cursor: 'SUP-KT-YARN-000',
      status: 'ACTIVE',
    });
    const invalid = await dispatchFastifyRouteGroup(
      requestFor({ query: { status: 'BOGUS' } }),
      scopeFor(),
    );
    expect(invalid?.statusCode).toBe(400);
    expect((invalid?.body as { error: { code: string } }).error.code).toBe('invalid_request');
  });

  it('GET 列表字段裁剪（supplier:read allowlist）裁掉未授权键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['name']),
    );
    const items = (response?.body as { items: Record<string, unknown>[] }).items;
    expect(items[0]).toEqual({ id: supplier.id, name: supplier.name });
  });

  it('GET 详情命中返回行；未命中映射 not_found 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/suppliers/${supplier.id}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(supplier);
    expect(repositoryCalls[0]?.args[0]).toBe(supplier.id);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/suppliers/44444444-4444-4444-8444-444444444440' }),
      scopeFor(repository({ findSupplier: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Supplier not found',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/suppliers/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect((malformed?.body as { error: { message: string } }).error.message).toBe(
      'supplierId must be a UUID',
    );
  });

  it('POST 创建走 legacy 同解析链（trim/stableCode/currency/contact 默认空对象）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          supplierNumber: ' SUP-KT-YARN-001 ',
          name: ' 青岛金特夫草纱战略供应商 ',
          currency: 'CNY',
          paymentTermsDays: 30,
          qualityRatingBasisPoints: null,
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createSupplier');
    expect(call?.args[0]).toEqual({
      supplierNumber: 'SUP-KT-YARN-001',
      name: '青岛金特夫草纱战略供应商',
      currency: 'CNY',
      paymentTermsDays: 30,
      qualityRatingBasisPoints: null,
      contact: {},
    });
    expect(call?.args[1]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(call?.args[2]).toBe('corr-1');
  });

  it('POST 负例沿用 legacy 消息（未知字段/编码/币种/整数范围/非对象 contact）', async () => {
    const base = {
      supplierNumber: 'SUP-KT-YARN-001',
      name: '草纱供应商',
      currency: 'CNY',
      paymentTermsDays: 30,
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [
        { ...base, supplierNumber: 'sup-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...base, currency: 'cny' }, 'Currency must be ISO 4217 uppercase'],
      [
        { ...base, paymentTermsDays: 4000 },
        'paymentTermsDays must be an integer between 0 and 3650',
      ],
      [{ ...base, contact: [] }, 'contact must be a JSON object'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', body }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
  });

  it('PUT qualification：approve/conditional/reject 分派 legacy qualifySupplier 同链 → 200', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/suppliers/${supplier.id}/qualification`,
        body: {
          action: 'approve',
          itemVersionId: '55555555-5555-4555-8555-555555555555',
          validFrom: '2026-11-01',
          validTo: null,
          minimumOrderQuantity: '1000',
          leadTimeDays: 14,
          evidence: { reference: 'QA-2026-001' },
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('qualifySupplier');
    expect(call?.args[0]).toBe(supplier.id);
    expect(call?.args[1]).toEqual({
      itemVersionId: '55555555-5555-4555-8555-555555555555',
      status: 'APPROVED',
      validFrom: '2026-11-01',
      validTo: null,
      minimumOrderQuantity: '1000',
      leadTimeDays: 14,
      evidence: { reference: 'QA-2026-001' },
    });
    expect(call?.args[2]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    for (const pair of [
      ['conditional', 'CONDITIONAL'],
      ['reject', 'REJECTED'],
    ] as const) {
      repositoryCalls.length = 0;
      const [action, status] = pair;
      await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: `/api/v1/suppliers/${supplier.id}/qualification`,
          body: {
            action,
            itemVersionId: '55555555-5555-4555-8555-555555555555',
            validFrom: '2026-11-01',
            minimumOrderQuantity: '0',
            leadTimeDays: 7,
            evidence: {},
          },
        }),
        scopeFor(),
      );
      expect((repositoryCalls[0]?.args[1] as { status: string }).status).toBe(status);
    }
  });

  it('PUT qualification 负例：未知 action 400、非 uuid supplierId 400、无 supplier:manage 403', async () => {
    const unknownAction = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/suppliers/${supplier.id}/qualification`,
        body: {
          action: 'pause',
          validFrom: '2026-11-01',
          minimumOrderQuantity: '0',
          leadTimeDays: 7,
        },
      }),
      scopeFor(),
    );
    expect(unknownAction?.statusCode).toBe(400);
    expect((unknownAction?.body as { error: { message: string } }).error.message).toBe(
      'action must be approve, conditional or reject',
    );
    const badId = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/suppliers/99999999-9999-9999-9999-999999999999/qualification',
        body: {
          action: 'approve',
          validFrom: '2026-11-01',
          minimumOrderQuantity: '0',
          leadTimeDays: 7,
        },
      }),
      scopeFor(),
    );
    expect(badId?.statusCode).toBe(400);
    expect((badId?.body as { error: { message: string } }).error.message).toBe(
      'supplierId must be a UUID',
    );
    const denied = {
      authorization: {
        actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
        permissions: new Map([['supplier:read', { scopes: ['COMPANY'], fields: null }]]),
      } as unknown as AuthorizationContext,
      dependencies: {
        procurement: repository(),
        commercial: repository(),
      } as unknown as ApiDependencies,
      correlationId: 'corr-1',
    };
    const forbidden = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/suppliers/${supplier.id}/qualification`,
        body: {
          action: 'approve',
          validFrom: '2026-11-01',
          minimumOrderQuantity: '0',
          leadTimeDays: 7,
        },
      }),
      denied,
    );
    expect(forbidden?.statusCode).toBe(403);
    expect((forbidden?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });

  it('仓储 DomainError 映射 legacy 状态码；依赖缺失 503', async () => {
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/suppliers/${supplier.id}/qualification`,
        body: {
          action: 'approve',
          itemVersionId: '55555555-5555-4555-8555-555555555555',
          validFrom: '2026-11-01',
          minimumOrderQuantity: '0',
          leadTimeDays: 7,
        },
      }),
      scopeFor(
        repository({
          qualifySupplier: vi
            .fn()
            .mockRejectedValue(
              new DomainError('conflict', 'Supplier qualification requires a published item'),
            ),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(409);
    expect((conflict?.body as { error: { code: string } }).error.code).toBe('conflict');
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
  });

  // PROC-5（TD-PROC-002）：供应商状态写端点。合法迁移、幂等重放与并发的行为在真库测试
  //（supplier-state-postgres.integration.test.ts）；这里钉住 HTTP 形状：请求怎么解析、仓储怎么被
  // 调用、响应怎么裁剪、哪些请求在到达仓储之前就被拒。
  const ACTOR = { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' };
  type Grant = Readonly<{ scopes: readonly string[]; fields: readonly string[] | null }>;
  // 权限可定制的授权上下文（scopeFor 只有一种固定组合）。
  const scopeWith = (
    repo: NonNullable<ApiDependencies['procurement']>,
    grants: [string, Grant][],
  ) => ({
    authorization: {
      actor: ACTOR,
      permissions: new Map(grants),
    } as unknown as AuthorizationContext,
    dependencies: {
      procurement: repo,
      commercial: repository(),
    } as unknown as ApiDependencies,
    correlationId: 'corr-1',
  });
  const stateRequest = (
    request: {
      body?: unknown;
      key?: string | null;
      pathname?: string;
    } = {},
  ): ApiRequest => ({
    method: 'PUT',
    pathname: request.pathname ?? `/api/v1/suppliers/${supplier.id}/state`,
    headers: {
      'x-correlation-id': 'corr-1',
      ...(request.key === null ? {} : { 'idempotency-key': request.key ?? 'state-key-1' }),
    },
    ...(request.body === undefined ? { body: { status: 'ON_HOLD' } } : { body: request.body }),
  });
  const errorOf = (response: { body: unknown } | null): { code: string; message: string } => {
    if (!response) throw new Error('Expected a bridge response');
    const error = (response.body as { error?: unknown }).error;
    if (typeof error !== 'object' || error === null) throw new Error('Expected an error envelope');
    return error as { code: string; message: string };
  };

  it('PUT state：三个目标状态各自分派 setSupplierStatus（供应商、状态、幂等键、作用域、关联 ID）→ 200 + { id, status }', async () => {
    for (const status of ['ON_HOLD', 'INACTIVE', 'ACTIVE'] as const) {
      repositoryCalls.length = 0;
      const response = await dispatchFastifyRouteGroup(
        stateRequest({ body: { status }, key: `state-key-${status}` }),
        scopeFor(),
      );
      // 桥轨认领了这个路径（认领之前这里得到 null，请求落回 legacy 轨）。
      expect(response).not.toBeNull();
      expect(response?.statusCode).toBe(200);
      expect(response?.body).toEqual({ id: supplier.id, status });
      expect(repositoryCalls).toHaveLength(1);
      expect(repositoryCalls[0]?.method).toBe('setSupplierStatus');
      expect(repositoryCalls[0]?.args).toEqual([
        supplier.id,
        status,
        `state-key-${status}`,
        { actor: ACTOR, scopes: ['COMPANY'], anchors: [] },
        'corr-1',
      ]);
    }
  });

  it('PUT state 负例：未知字段、未知或缺失的状态、非对象请求体、缺幂等键、幂等键超长 → 400，仓储不被调用', async () => {
    for (const [request, message] of [
      [stateRequest({ body: { status: 'ON_HOLD', reason: 'x' } }), 'Unsupported fields: reason'],
      [stateRequest({ body: { status: 'PAUSED' } }), 'status must be ON_HOLD, INACTIVE or ACTIVE'],
      [stateRequest({ body: { status: 'on_hold' } }), 'status must be ON_HOLD, INACTIVE or ACTIVE'],
      [stateRequest({ body: {} }), 'status is required'],
      [stateRequest({ body: [] }), 'A JSON object body is required'],
      [stateRequest({ key: null }), 'Idempotency-Key is required'],
      [stateRequest({ key: 'k'.repeat(129) }), 'Idempotency-Key is required'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(request, scopeFor());
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).message).toBe(message);
    }
    expect(repositoryCalls).toHaveLength(0);
    // 路径参数不是 uuid：同样到不了仓储。
    const badId = await dispatchFastifyRouteGroup(
      stateRequest({ pathname: '/api/v1/suppliers/99999999-9999-9999-9999-999999999999/state' }),
      scopeFor(),
    );
    expect(badId?.statusCode).toBe(400);
    expect(errorOf(badId).message).toBe('supplierId must be a UUID');
    expect(repositoryCalls).toHaveLength(0);
  });

  it('PUT state：没有 supplier:manage、或该权限的字段白名单不含 status → 403，仓储不被调用', async () => {
    const read: [string, Grant] = ['supplier:read', { scopes: ['COMPANY'], fields: null }];
    for (const grants of [
      [read],
      [read, ['supplier:manage', { scopes: ['COMPANY'], fields: ['name'] }]] as [string, Grant][],
    ]) {
      const response = await dispatchFastifyRouteGroup(
        stateRequest(),
        scopeWith(repository(), grants),
      );
      expect(response?.statusCode).toBe(403);
      expect(errorOf(response).code).toBe('forbidden');
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('PUT state：仓储的非法迁移 conflict → 409 + 中文原样；供应商不存在 not_found → 404 信封', async () => {
    const message = '供应商当前为「已停用」，不能变更为「已停用」';
    const illegal = await dispatchFastifyRouteGroup(
      stateRequest({ body: { status: 'INACTIVE' } }),
      scopeFor(
        repository({
          setSupplierStatus: vi.fn().mockRejectedValue(new DomainError('conflict', message)),
        }),
      ),
    );
    expect(illegal?.statusCode).toBe(409);
    expect(illegal?.body).toEqual({
      error: { code: 'conflict', message, correlationId: 'corr-1' },
    });
    const missing = await dispatchFastifyRouteGroup(
      stateRequest(),
      scopeFor(
        repository({
          setSupplierStatus: vi
            .fn()
            .mockRejectedValue(new DomainError('not_found', 'Supplier not found')),
        }),
      ),
    );
    expect(missing?.statusCode).toBe(404);
    expect(missing?.body).toEqual({
      error: { code: 'not_found', message: 'Supplier not found', correlationId: 'corr-1' },
    });
  });

  it('PUT state：响应按 supplier:read 裁剪——没有读权限、或字段白名单不含 status 时只剩 id', async () => {
    const manage: [string, Grant] = ['supplier:manage', { scopes: ['COMPANY'], fields: null }];
    for (const grants of [
      [manage],
      [manage, ['supplier:read', { scopes: ['COMPANY'], fields: ['name'] }]] as [string, Grant][],
    ]) {
      const response = await dispatchFastifyRouteGroup(
        stateRequest(),
        scopeWith(repository(), grants),
      );
      expect(response?.statusCode).toBe(200);
      expect(response?.body).toEqual({ id: supplier.id });
    }
    const partial = await dispatchFastifyRouteGroup(
      stateRequest(),
      scopeWith(repository(), [
        manage,
        ['supplier:read', { scopes: ['COMPANY'], fields: ['status'] }],
      ]),
    );
    expect(partial?.body).toEqual({ id: supplier.id, status: 'ON_HOLD' });
  });
});
