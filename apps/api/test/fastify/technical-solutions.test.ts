import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import type { SolutionRevisionRepository } from '../../src/routes/fastify/technical-solutions.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-2：technical-solutions Fastify 组契约测试——GET 列表（legacy 行为守恒迁移，
// 严格 { items }）、GET 详情（additive 只读）、PUT 更新（经新修订，与 legacy
// POST /revisions 同仓储同规则）与 zod 负例/错误信封。
const revisionId = '33333333-3333-4333-8333-333333333333';
const revision: JsonObject = {
  id: '33333333-3333-4333-8333-333333333333',
  technicalSolutionId: '44444444-4444-4444-8444-444444444444',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  code: 'TS-2026-001',
  revision: 2,
  status: 'DRAFT',
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  specification: { productFamily: '足球草', pileHeightMm: 50 },
  assumptions: ['场地基础平整', '排水坡度 ≥ 0.5%'],
  createdAt: '2026-11-20T00:00:00.000Z',
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (): SolutionRevisionRepository => ({
  listCommercialView: vi.fn((...args: unknown[]) => {
    repositoryCalls.push({ method: 'listCommercialView', args });
    return Promise.resolve([revision]);
  }),
  findTechnicalSolutionRevision: vi.fn((...args: unknown[]) => {
    repositoryCalls.push({ method: 'findTechnicalSolutionRevision', args });
    return Promise.resolve(revision);
  }),
  createTechnicalSolutionRevision: vi.fn((...args: unknown[]) => {
    repositoryCalls.push({ method: 'createTechnicalSolutionRevision', args });
    return Promise.resolve(revision);
  }),
});

const scopeFor = (
  fields: readonly string[] | null,
  repo: SolutionRevisionRepository = repository(),
) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['technical-solution:read', { scopes: ['TENANT'], fields }],
      ['technical-solution:update', { scopes: ['TENANT'], fields }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/technical-solutions',
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('technical-solutions fastify bridge track', () => {
  it('GET 列表与 legacy 视图轨逐键一致（严格 { items }，同仓储同遮蔽）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(response?.statusCode).toBe(200);
    const body = response?.body as { items: JsonObject[] };
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items).toEqual([revision]);
    expect(repositoryCalls[0]?.method).toBe('listCommercialView');
    expect(repositoryCalls[0]?.args[0]).toBe('solutions');
  });

  it('GET 列表按 granted 投影遮蔽行字段', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(['id', 'code', 'revision']),
    );
    expect((response?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: revision.id,
      code: 'TS-2026-001',
      revision: 2,
    });
  });

  it('GET 详情返回修订完整面；未命中映射 legacy not_found 信封', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/technical-solutions/${revisionId}` }),
      scopeFor(null),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(revision);
    expect(repositoryCalls[0]?.method).toBe('findTechnicalSolutionRevision');
    expect(repositoryCalls[0]?.args[0]).toBe(revision.id);

    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/technical-solutions/${revisionId}` }),
      scopeFor(null, {
        ...repository(),
        findTechnicalSolutionRevision: vi.fn().mockResolvedValue(null),
      }),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; correlationId: string } }).error).toEqual({
      code: 'not_found',
      message: 'Technical solution revision not found',
      correlationId: 'corr-1',
    });
  });

  it('PUT 更新经 createTechnicalSolutionRevision（同 legacy /revisions 规则）返回遮蔽结果', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/technical-solutions/44444444-4444-4444-8444-444444444444',
        body: {
          ctrVersionId: '55555555-5555-4555-8555-555555555555',
          specification: { productFamily: '足球草' },
          assumptions: ['排水坡度 ≥ 0.5%', '场地基础平整', '场地基础平整'],
          final: true,
        },
      }),
      scopeFor(null),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual(revision);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createTechnicalSolutionRevision');
    expect(call?.args[0]).toBe('44444444-4444-4444-8444-444444444444');
    expect(call?.args[1]).toEqual({
      ctrVersionId: '55555555-5555-4555-8555-555555555555',
      specification: { productFamily: '足球草' },
      assumptions: ['场地基础平整', '排水坡度 ≥ 0.5%'],
      final: true,
    });
    expect(call?.args[5]).toBe('corr-1');
  });

  it('PUT 负例：未知字段/非 uuid/空假设/非布尔 final 全部 400 且不触仓储', async () => {
    const valid = {
      ctrVersionId: '55555555-5555-4555-8555-555555555555',
      specification: {},
      assumptions: ['场地基础平整'],
    };
    for (const body of [
      { ...valid, extra: 'field' },
      { ...valid, ctrVersionId: 'not-a-uuid' },
      { ...valid, assumptions: ['   '] },
      { ...valid, final: 'yes' },
    ]) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: '/api/v1/technical-solutions/44444444-4444-4444-8444-444444444444',
          body,
        }),
        scopeFor(null),
      );
      expect(response?.statusCode).toBe(400);
      expect(
        (response?.body as { error: { code: string; correlationId: string } }).error.code,
      ).toBe('invalid_request');
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('仓储 DomainError（forbidden/not_found）映射 legacy 状态码', async () => {
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ pathname: `/api/v1/technical-solutions/${revisionId}` }),
        scopeFor(null, {
          ...repository(),
          findTechnicalSolutionRevision: vi
            .fn()
            .mockRejectedValue(new DomainError(code, 'Permission denied')),
        }),
      );
      expect(response?.statusCode).toBe(status);
      expect((response?.body as { error: { code: string } }).error.code).toBe(code);
    }
  });
});
