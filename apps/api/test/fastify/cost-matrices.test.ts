import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-4：cost-matrices Fastify 组契约测试——GET 摘要（page 分页/筛选校验链）、
// GET flat/详情、POST 创建、PUT 因子更新（legacy 同解析链，消息逐字节一致）。
const matrix = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'KT-50-3/8',
  name: '50mm 单丝加密型',
  currency: 'CNY',
  defaultTaxRate: '0.13',
  factors: [{ factorCode: 'YARN-PE', factorName: 'PE 草丝' }],
  calculations: [],
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (overrides: { getCostMatrix?: ReturnType<typeof vi.fn> } = {}) =>
  ({
    listCostMatrixSummaries: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'listCostMatrixSummaries', args });
      return Promise.resolve({ items: [matrix], total: 1 });
    }),
    listCostMatrices: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'listCostMatrices', args });
      return Promise.resolve([matrix]);
    }),
    getCostMatrix:
      overrides.getCostMatrix ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'getCostMatrix', args });
        return Promise.resolve(matrix);
      }),
    createCostMatrix: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'createCostMatrix', args });
      return Promise.resolve(matrix);
    }),
    addCostMatrixFactor: vi.fn(),
    updateCostMatrixFactor: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'updateCostMatrixFactor', args });
      return Promise.resolve(matrix);
    }),
  }) as unknown as NonNullable<ApiDependencies['commercial']>;

const scopeFor = (repo: NonNullable<ApiDependencies['commercial']> = repository()) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['cost-matrix:read', { scopes: ['TENANT'], fields: null }],
      ['cost-matrix:manage', { scopes: ['TENANT'], fields: null }],
      ['cost-matrix:calculate', { scopes: ['TENANT'], fields: null }],
      ['audit:read', { scopes: ['COMPANY'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & {
    pathname?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/cost-matrices',
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('cost-matrices fastify bridge track', () => {
  it('GET 摘要透传分页/筛选并原样返回仓储结果', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/cost-matrix-summaries',
        query: { page: '2', pageSize: '10', q: ' 草丝 ', attention: 'NEEDS_INPUT', sort: 'CODE' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [matrix], total: 1, page: 2, pageSize: 10 });
    expect(repositoryCalls[0]?.args[0]).toEqual({
      page: 2,
      pageSize: 10,
      query: '草丝',
      productFamily: '',
      attention: 'NEEDS_INPUT',
      sort: 'CODE',
    });
  });

  it('GET 摘要负例沿用 legacy 消息（attention/sort/分页范围）', async () => {
    for (const [query, message] of [
      [{ attention: 'WRONG' }, 'Invalid cost matrix attention filter'],
      [{ sort: 'WRONG' }, 'Invalid cost matrix sort'],
      [{ page: '0' }, 'page must be an integer between 1 and 100000'],
      [{ pageSize: '4' }, 'pageSize must be an integer between 5 and 100'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ pathname: '/api/v1/cost-matrix-summaries', query }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('GET flat 列表与详情（uuid 校验次序与 audit 门同 legacy）', async () => {
    const flat = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(flat?.statusCode).toBe(200);
    expect(flat?.body).toEqual({ items: [matrix] });
    const detail = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/cost-matrices/11111111-1111-4111-8111-111111111111' }),
      scopeFor(),
    );
    expect(detail?.statusCode).toBe(200);
    expect(detail?.body).toEqual(matrix);
    expect(repositoryCalls.find((c) => c.method === 'getCostMatrix')?.args).toEqual([
      '11111111-1111-4111-8111-111111111111',
      { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      ['TENANT'],
      true,
    ]);
    const bad = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/cost-matrices/bad' }),
      scopeFor(),
    );
    expect(bad?.statusCode).toBe(400);
    expect((bad?.body as { error: { message: string } }).error.message).toBe(
      'modelId must be a UUID',
    );
  });

  it('POST 创建走 legacy 解析链（201 直通）；负例沿用 legacy 消息', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: { code: ' KT-60 ', name: '60mm', currency: 'CNY', defaultTaxRate: '0.13' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual(matrix);
    expect(repositoryCalls[0]?.args[0]).toEqual({
      code: 'KT-60',
      name: '60mm',
      productSpecification: {},
      currency: 'CNY',
      defaultTaxRate: '0.13',
    });
    const bad = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: { code: 'KT', name: 'x', extra: 1 } }),
      scopeFor(),
    );
    expect((bad?.body as { error: { message: string } }).error.message).toBe(
      'Unsupported fields: extra',
    );
    expect(repositoryCalls.filter((c) => c.method === 'createCostMatrix')).toHaveLength(1);
  });

  it('PUT 因子更新走 legacy 解析链（200 直通）；未知字段沿用 legacy 消息', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname:
          '/api/v1/cost-matrices/11111111-1111-4111-8111-111111111111/factors/22222222-2222-4222-8222-222222222222',
        body: {
          factorName: 'PE 草丝',
          category: 'DIRECT_MATERIAL',
          sourceType: 'MANUAL',
          quantity: '1',
          unitCode: 'KG',
          manualUnitPriceTaxInclusive: '20',
          taxRate: '0.13',
          priceSourceName: '基准',
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual(matrix);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('updateCostMatrixFactor');
    expect(call?.args[0]).toBe('11111111-1111-4111-8111-111111111111');
    expect(call?.args[1]).toBe('22222222-2222-4222-8222-222222222222');
    const bad = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname:
          '/api/v1/cost-matrices/11111111-1111-4111-8111-111111111111/factors/22222222-2222-4222-8222-222222222222',
        body: { factorName: 'x', category: 'DIRECT_MATERIAL', sourceType: 'MANUAL', extra: 1 },
      }),
      scopeFor(),
    );
    expect((bad?.body as { error: { message: string } }).error.message).toBe(
      'Unsupported fields: extra',
    );
  });

  it('未认领路径返回 null；仓储 DomainError 映射 legacy 状态码', async () => {
    const unclaimed = await dispatchFastifyRouteGroup(
      requestFor({
        pathname: '/api/v1/cost-matrices/11111111-1111-4111-8111-111111111111/factors',
      }),
      scopeFor(),
    );
    expect(unclaimed).toBeNull();
    const detail = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/cost-matrices/11111111-1111-4111-8111-111111111111' }),
      scopeFor(
        repository({
          getCostMatrix: vi
            .fn()
            .mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        }),
      ),
    );
    expect(detail?.statusCode).toBe(403);
    expect((detail?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
