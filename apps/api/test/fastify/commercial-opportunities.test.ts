import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { OpportunityDto } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import type { OpportunityPage } from '../../src/routes/fastify/commercial-opportunities.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-2：经生产桥 dispatchFastifyRouteGroup 的 inject 契约测试（认证/授权在
// app.ts 上游已完成，此处从授权上下文起步）——zod 入站正/负例（分页/筛选）、
// 授权谓词委托与字段遮蔽、nextCursor 缺省键与 legacy { items } 逐键一致。
const opportunity: OpportunityDto = {
  id: '22222222-2222-4222-8222-222222222222',
  tenantId: '11111111-1111-4111-8111-111111111111',
  customerId: null,
  leadId: null,
  name: '国际学校足球场',
  status: 'OPEN',
  ownerId: '33333333-3333-4333-8333-333333333333',
  ownerOrganizationId: '44444444-4444-4444-8444-444444444444',
  value: { amount: '500000.000000', currency: 'CNY' },
  probabilityBasisPoints: 3000,
  expectedCloseDate: '2026-12-01',
  version: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
};

const repositoryCalls: unknown[][] = [];

const scopeFor = (fields: readonly string[] | null, page: OpportunityPage) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([['opportunity:read', { scopes: ['TENANT'], fields }]]),
  } as unknown as AuthorizationContext,
  dependencies: {
    commercial: {
      listOpportunityPage: (...args: unknown[]) => {
        repositoryCalls.push(args);
        return Promise.resolve(page);
      },
    },
  } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (query: Record<string, string> = {}): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/opportunities',
  ...(Object.keys(query).length > 0 ? { query, hasQuery: true } : {}),
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('GET /api/v1/opportunities fastify bridge track', () => {
  it('default request returns { items } only — key parity with the legacy body', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(null, { items: [opportunity], nextCursor: null }),
    );
    expect(response?.statusCode).toBe(200);
    const body = response?.body as { items: Record<string, unknown>[]; nextCursor?: unknown };
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: '国际学校足球场', status: 'OPEN' });
    expect(repositoryCalls[0]?.[3]).toEqual({ limit: 100 });
  });

  it('passes validated pagination and filter parameters to the repository', async () => {
    await dispatchFastifyRouteGroup(
      requestFor({
        limit: '25',
        cursor: '22222222-2222-4222-8222-222222222222',
        status: 'OPEN',
        customerId: '44444444-4444-4444-8444-444444444444',
      }),
      scopeFor(null, { items: [opportunity], nextCursor: null }),
    );
    expect(repositoryCalls[0]?.[3]).toEqual({
      limit: 25,
      cursor: '22222222-2222-4222-8222-222222222222',
      status: 'OPEN',
      customerId: '44444444-4444-4444-8444-444444444444',
    });
  });

  it('continues keyset pagination through nextCursor when the page overflows', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ limit: '10' }),
      scopeFor(null, {
        items: [opportunity],
        nextCursor: '55555555-5555-4555-8555-555555555555',
      }),
    );
    expect(response?.statusCode).toBe(200);
    expect((response?.body as { nextCursor?: string }).nextCursor).toBe(
      '55555555-5555-4555-8555-555555555555',
    );
  });

  it('masks item fields to the granted read projection', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(['id', 'name', 'status'], { items: [opportunity], nextCursor: null }),
    );
    expect(response?.statusCode).toBe(200);
    expect((response?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: opportunity.id,
      name: '国际学校足球场',
      status: 'OPEN',
    });
  });

  it('returns null for unclaimed paths so the legacy track keeps serving them', async () => {
    const response = await dispatchFastifyRouteGroup(
      { method: 'GET', pathname: '/api/v1/opportunities/22222222-2222-4222-8222-222222222222' },
      scopeFor(null, { items: [], nextCursor: null }),
    );
    expect(response).toBeNull();
    expect(repositoryCalls).toHaveLength(0);
  });

  it('maps zod validation failures to the legacy 400 envelope with correlation id', async () => {
    for (const query of [
      { limit: 'abc' },
      { limit: '0' },
      { limit: '101' },
      { cursor: 'not-a-uuid' },
      { status: 'UNKNOWN' },
      { customerId: '42' },
    ]) {
      const response = await dispatchFastifyRouteGroup(
        requestFor(query),
        scopeFor(null, { items: [opportunity], nextCursor: null }),
      );
      expect(response?.statusCode).toBe(400);
      const body = response?.body as { error: { code: string; correlationId: string } };
      expect(body.error.code).toBe('invalid_request');
      expect(body.error.correlationId).toBe('corr-1');
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('maps repository DomainError rejections to the legacy status mapping', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), {
      authorization: {
        actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
        permissions: new Map([['opportunity:read', { scopes: ['TENANT'], fields: null }]]),
      } as unknown as AuthorizationContext,
      dependencies: {
        commercial: {
          listOpportunityPage: vi
            .fn()
            .mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        },
      } as unknown as ApiDependencies,
      correlationId: 'corr-1',
    });
    expect(response?.statusCode).toBe(403);
    expect((response?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
