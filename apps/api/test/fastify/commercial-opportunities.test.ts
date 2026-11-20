import { afterEach, describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@kingturf/domain';
import type { OpportunityDto } from '@kingturf/types';
import {
  buildCommercialOpportunitiesFastifyApp,
  type OpportunityPage,
} from '../../src/routes/fastify/commercial-opportunities.js';

// U3-COM-1：fastify 商机列表端点的 inject 契约测试——zod 入站正/负例（分页/筛选）、
// 授权谓词委托与字段遮蔽、keyset nextCursor 传递。仓储经 double 注入（PG 集成归常规轨道）。
const authorization = (fields: readonly string[] | null): AuthorizationContext =>
  ({
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([['opportunity:read', { scopes: ['TENANT'], fields }]]),
  }) as unknown as AuthorizationContext;

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

const instances: { close: () => Promise<void> }[] = [];
const repositoryCalls: unknown[][] = [];

function appWithContext(
  fields: readonly string[] | null,
  page: OpportunityPage = { items: [opportunity], nextCursor: null },
) {
  const instance = buildCommercialOpportunitiesFastifyApp({
    authorization: authorization(fields),
    repository: {
      listOpportunityPage: (...args: unknown[]) => {
        repositoryCalls.push(args);
        return Promise.resolve(page);
      },
    },
  });
  instances.push(instance);
  return instance;
}

afterEach(async () => {
  for (const instance of instances.splice(0)) await instance.close();
  repositoryCalls.length = 0;
});

describe('GET /api/v1/opportunities fastify track', () => {
  it('accepts a default request and returns the schema-validated page', async () => {
    const response = await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: Record<string, unknown>[]; nextCursor: string | null }>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: '国际学校足球场', status: 'OPEN' });
    expect(body.nextCursor).toBeNull();
    expect(repositoryCalls[0]?.[3]).toEqual({ limit: 50 });
  });

  it('passes validated pagination and filter parameters to the repository', async () => {
    await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities?limit=25&cursor=22222222-2222-4222-8222-222222222222&status=OPEN&customerId=44444444-4444-4444-8444-444444444444',
    });
    expect(repositoryCalls[0]?.[3]).toEqual({
      limit: 25,
      cursor: '22222222-2222-4222-8222-222222222222',
      status: 'OPEN',
      customerId: '44444444-4444-4444-8444-444444444444',
    });
  });

  it('continues keyset pagination through nextCursor', async () => {
    const response = await appWithContext(null, {
      items: [opportunity],
      nextCursor: '55555555-5555-4555-8555-555555555555',
    }).inject({ method: 'GET', url: '/api/v1/opportunities?limit=10' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ items: unknown[]; nextCursor: string | null }>().nextCursor).toBe(
      '55555555-5555-4555-8555-555555555555',
    );
  });

  it('masks item fields to the granted read projection', async () => {
    const response = await appWithContext(['id', 'name', 'status']).inject({
      method: 'GET',
      url: '/api/v1/opportunities',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: Record<string, unknown>[] }>();
    expect(body.items[0]).toEqual({
      id: opportunity.id,
      name: '国际学校足球场',
      status: 'OPEN',
    });
  });

  it('rejects a non-numeric limit with 400', async () => {
    const response = await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities?limit=abc',
    });
    expect(response.statusCode).toBe(400);
    expect(repositoryCalls).toHaveLength(0);
  });

  it('rejects an out-of-range limit with 400', async () => {
    for (const limit of ['0', '101']) {
      const response = await appWithContext(null).inject({
        method: 'GET',
        url: `/api/v1/opportunities?limit=${limit}`,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('rejects a malformed cursor with 400', async () => {
    const response = await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities?cursor=not-a-uuid',
    });
    expect(response.statusCode).toBe(400);
    expect(repositoryCalls).toHaveLength(0);
  });

  it('rejects an unsupported status with 400', async () => {
    const response = await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities?status=UNKNOWN',
    });
    expect(response.statusCode).toBe(400);
    expect(repositoryCalls).toHaveLength(0);
  });

  it('rejects a malformed customerId with 400', async () => {
    const response = await appWithContext(null).inject({
      method: 'GET',
      url: '/api/v1/opportunities?customerId=42',
    });
    expect(response.statusCode).toBe(400);
    expect(repositoryCalls).toHaveLength(0);
  });
});
