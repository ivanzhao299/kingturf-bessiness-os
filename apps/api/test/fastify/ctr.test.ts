import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-5：CTR Fastify 组契约测试——GET 列表（视图轨迁移）、GET 详情（findCtr）、
// POST 创建（legacy 同解析链）、PUT 状态流转（submit|decide 分派；legacy 消息一致）。
const ctrRow: JsonObject = {
  id: '33333333-3333-4333-8333-333333333333',
  ctrId: '44444444-4444-4444-8444-444444444444',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  code: 'JSXQ-2026-001',
  version: 2,
  status: 'SUBMITTED',
  title: '学校足球场技术需求',
  requirements: { application: '足球场', pileHeightMm: 50 },
  snapshotHash: 'hash-2',
  submittedAt: '2026-11-20T00:00:00Z',
  approvals: [],
  attachments: [],
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (overrides: { findCtr?: ReturnType<typeof vi.fn> } = {}) =>
  ({
    listCommercialView: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'listCommercialView', args });
      return Promise.resolve([ctrRow]);
    }),
    findCtr:
      overrides.findCtr ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findCtr', args });
        return Promise.resolve({
          id: '44444444-4444-4444-8444-444444444444',
          opportunityId: '22222222-2222-4222-8222-222222222222',
          code: 'JSXQ-2026-001',
          versions: [ctrRow],
        });
      }),
    createCtr: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'createCtr', args });
      return Promise.resolve({ id: '44444444-4444-4444-8444-444444444444', version: 1 });
    }),
    createCtrVersion: vi.fn(),
    submitCtr: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'submitCtr', args });
      return Promise.resolve({
        id: '33333333-3333-4333-8333-333333333333',
        version: 2,
        status: 'SUBMITTED',
      });
    }),
    approveCtr: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'approveCtr', args });
      return Promise.resolve({
        id: '33333333-3333-4333-8333-333333333333',
        version: 2,
        status: 'APPROVED',
      });
    }),
    linkCtrAttachment: vi.fn(),
  }) as unknown as NonNullable<ApiDependencies['commercial']>;

const scopeFor = (repo: NonNullable<ApiDependencies['commercial']> = repository()) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['ctr:read', { scopes: ['TENANT'], fields: null }],
      ['ctr:create', { scopes: ['TENANT'], fields: null }],
      ['ctr:submit', { scopes: ['TENANT'], fields: null }],
      ['ctr:approve', { scopes: ['TENANT'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/ctrs',
  headers: { 'idempotency-key': 'fixed-key' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('ctr fastify bridge track', () => {
  it('GET 列表为视图轨迁移：listCommercialView + strict { items }', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    const body = response?.body as { items: JsonObject[] };
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items).toEqual([ctrRow]);
    expect(repositoryCalls[0]?.args[0]).toBe('ctrs');
  });

  it('GET 详情经 findCtr 返回根+版本；未命中映射 not_found 信封', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/ctrs/44444444-4444-4444-8444-444444444444' }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toMatchObject({ code: 'JSXQ-2026-001', versions: [ctrRow] });
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/ctrs/44444444-4444-4444-8444-444444444444' }),
      scopeFor(repository({ findCtr: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'CTR not found',
    });
  });

  it('POST 创建走 legacy 同解析链（trim/201/mutationDto）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          opportunityId: '22222222-2222-4222-8222-222222222222',
          code: ' ctr! ',
          title: ' title ',
          requirements: { fixed: true },
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({ id: '44444444-4444-4444-8444-444444444444', version: 1 });
    expect(repositoryCalls[0]?.args[0]).toEqual({
      opportunityId: '22222222-2222-4222-8222-222222222222',
      code: 'ctr!',
      title: 'title',
      requirements: { fixed: true },
    });
  });

  it('PUT 状态流转：submit 分派 submitCtr（expectedVersion/幂等键）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/ctr-versions/33333333-3333-4333-8333-333333333333/state',
        body: { action: 'submit', expectedVersion: 2 },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('submitCtr');
    expect(call?.args).toEqual([
      '33333333-3333-4333-8333-333333333333',
      2,
      'fixed-key',
      { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      ['TENANT'],
      [],
      'corr-1',
    ]);
  });

  it('PUT 状态流转：decide 分派 approveCtr（decision 枚举校验沿用 legacy 消息）', async () => {
    const ok = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/ctr-versions/33333333-3333-4333-8333-333333333333/state',
        body: { action: 'decide', decision: ' APPROVED ', reason: ' 规格齐备 ' },
      }),
      scopeFor(),
    );
    expect(ok?.statusCode).toBe(200);
    expect(repositoryCalls[0]?.method).toBe('approveCtr');
    expect(repositoryCalls[0]?.args[1]).toBe('APPROVED');
    expect(repositoryCalls[0]?.args[2]).toBe('规格齐备');
    const bad = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/ctr-versions/33333333-3333-4333-8333-333333333333/state',
        body: { action: 'decide', decision: 'MAYBE', reason: 'x' },
      }),
      scopeFor(),
    );
    expect(bad?.statusCode).toBe(400);
    expect((bad?.body as { error: { message: string } }).error.message).toBe(
      'decision is unsupported',
    );
  });

  it('PUT 状态流转负例（未知 action/缺幂等键/缺版本）沿用 legacy 消息', async () => {
    for (const [body, message] of [
      [{ action: 'unknown' }, 'action must be submit or decide'],
      [{ action: 'submit', expectedVersion: 2 }, 'Idempotency-Key is required'],
      [{ action: 'decide', decision: 'APPROVED', reason: 'x' }, 'Idempotency-Key is required'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: '/api/v1/ctr-versions/33333333-3333-4333-8333-333333333333/state',
          body,
          headers: {},
        }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('仓储 DomainError 映射 legacy 状态码', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/ctrs/44444444-4444-4444-8444-444444444444' }),
      scopeFor(
        repository({
          findCtr: vi.fn().mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        }),
      ),
    );
    expect(response?.statusCode).toBe(403);
    expect((response?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
