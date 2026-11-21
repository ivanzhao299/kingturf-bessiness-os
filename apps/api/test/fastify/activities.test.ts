import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-CRM-4：activities Fastify 组契约测试——GET 列表（additive 只读，type 筛选，
// Date→ISO 归一化）、GET 详情（客户绑定单行查询，404 信封）、POST 创建（legacy
// customer-activities 同解析链：五字段 allow、幂等键、消息逐字节一致）。
const activity = {
  id: '44444444-4444-4444-8444-444444444444',
  customerId: '22222222-2222-4222-8222-222222222222',
  leadId: null,
  type: 'NOTE',
  occurredAt: '2026-11-20T08:00:00.000Z',
  actorId: 'e-1',
  summary: '周例会跟进',
  details: {},
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listActivities?: ReturnType<typeof vi.fn>;
    findActivity?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listActivities:
      overrides.listActivities ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listActivities', args });
        return Promise.resolve([activity]);
      }),
    findActivity:
      overrides.findActivity ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findActivity', args });
        return Promise.resolve(activity);
      }),
    createActivity: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'createActivity', args });
      return Promise.resolve(activity);
    }),
  }) as unknown as NonNullable<ApiDependencies['crm']>;

const scopeFor = (repo: NonNullable<ApiDependencies['crm']> = repository()) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['customer-activity:read', { scopes: ['TENANT'], fields: null }],
      ['customer-activity:create', { scopes: ['TENANT'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { crm: repo, commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/customers/22222222-2222-4222-8222-222222222222/activities',
  headers: { 'idempotency-key': 'fixed-key' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('activities fastify bridge track', () => {
  it('GET 列表：仓储直通 + Date→ISO 归一化；客户作用域门先于授权', async () => {
    const repo = repository({
      listActivities: vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listActivities', args });
        return Promise.resolve([{ ...activity, occurredAt: new Date('2026-11-20T08:00:00Z') }]);
      }),
    });
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor(repo));
    expect(response?.statusCode).toBe(200);
    expect((response?.body as { items: unknown[] }).items).toEqual([activity]);
    expect(repositoryCalls[0]?.args[0]).toBe('22222222-2222-4222-8222-222222222222');
    expect(repositoryCalls[0]?.args[2]).toEqual(['TENANT']);
  });

  it('GET 列表 type 查询筛选只保留匹配活动', async () => {
    const repo = repository({
      listActivities: vi.fn(() =>
        Promise.resolve([activity, { ...activity, id: 'a-2', type: 'MEETING' }]),
      ),
    });
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { type: 'NOTE' } }),
      scopeFor(repo),
    );
    expect(response?.statusCode).toBe(200);
    expect((response?.body as { items: unknown[] }).items).toEqual([activity]);
  });

  it('GET 详情非 uuid 映射 400 且不触达仓储；命中返回行；未命中映射 not_found 信封', async () => {
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/customers/22222222-2222-4222-8222-222222222222/activities/bad',
      }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect((malformed?.body as { error: { message: string } }).error.message).toBe(
      'activityId must be a UUID',
    );
    expect(repositoryCalls).toHaveLength(0);
    const found = await dispatchFastifyRouteGroup(
      requestFor({
        pathname:
          '/api/v1/customers/22222222-2222-4222-8222-222222222222/activities/44444444-4444-4444-8444-444444444444',
      }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(activity);
    expect(repositoryCalls[0]?.method).toBe('findActivity');
    const missing = await dispatchFastifyRouteGroup(
      requestFor({
        pathname:
          '/api/v1/customers/22222222-2222-4222-8222-222222222222/activities/44444444-4444-4444-8444-444444444444',
      }),
      scopeFor(repository({ findActivity: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Activity not found',
    });
  });

  it('POST 创建走 legacy 同解析链（五字段 allow、幂等键透传、details 缺省 {}）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          leadId: null,
          type: 'NOTE',
          occurredAt: '2026-11-20T08:00:00Z',
          summary: '周例会跟进',
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(activity);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createActivity');
    expect(call?.args[0]).toBe('22222222-2222-4222-8222-222222222222');
    expect(call?.args[1]).toEqual({
      leadId: null,
      type: 'NOTE',
      occurredAt: '2026-11-20T08:00:00.000Z',
      summary: '周例会跟进',
      details: {},
    });
    expect(call?.args[4]).toBe('fixed-key');
    expect(call?.args[5]).toEqual(['TENANT']);
  });

  it('POST 负例沿用 legacy 消息（幂等键、未知字段、字段类型、非 uuid 引用）', async () => {
    const base = { type: 'NOTE', occurredAt: '2026-11-20T08:00:00Z', summary: 's' };
    const cases: readonly (readonly [Partial<ApiRequest>, string])[] = [
      [{ headers: {} }, 'Idempotency-Key is required and must be at most 128 characters'],
      [{ body: { ...base, unexpected: 1 } }, 'Unsupported fields: unexpected'],
      [{ body: { ...base, type: 42 } }, 'type is required'],
      [{ body: { ...base, summary: 42 } }, 'summary is required'],
      [{ body: { ...base, occurredAt: 'not-a-time' } }, 'occurredAt must be a valid timestamp'],
      [{ body: { ...base, leadId: 'bad' } }, 'leadId must be a UUID'],
    ];
    for (const [overrides, message] of cases) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', ...overrides }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
    const badCustomer = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', pathname: '/api/v1/customers/bad/activities', body: base }),
      scopeFor(),
    );
    expect(badCustomer?.statusCode).toBe(400);
    expect((badCustomer?.body as { error: { message: string } }).error.message).toBe(
      'customerId must be a UUID',
    );
    expect(repositoryCalls).toHaveLength(0);
  });

  it('仓储 DomainError 映射 legacy 状态码', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(
        repository({
          listActivities: vi
            .fn()
            .mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        }),
      ),
    );
    expect(response?.statusCode).toBe(403);
    expect((response?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
