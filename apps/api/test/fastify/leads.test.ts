import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// TD-CRM-003：leads Fastify 组 GET 列表——加性键 lastActivityAt（线索名下最近一次活动时间）
// 按来源域读权限门控（项目所有者 2026-11-26 确认）：账号同时具备线索读权限与
// customer-activity:read（能力存在且作用域非空）才把活动可见范围交给仓储；否则第 5 实参为
// null，字段恒为 null。既有键的顺序与取值不变；legacy 轨不经本组。
// 线上键序 = 响应 schema 的声明序（改前 ownerOrganizationId 未声明、经 looseObject 透传时排在
// 声明键之后）；本批按该既有位置显式声明它，使加性键排在最末——改前的响应 JSON 是改后的字节前缀。
const WIRE_KEYS = [
  'id',
  'tenantId',
  'title',
  'source',
  'status',
  'ownerId',
  'customerId',
  'version',
  'createdAt',
  'updatedAt',
  'ownerOrganizationId',
] as const;
const row = {
  id: '44444444-4444-4444-8444-444444444444',
  tenantId: '11111111-1111-4111-8111-111111111111',
  customerId: '22222222-2222-4222-8222-222222222222',
  title: '学校运动场改造',
  source: '展会',
  status: 'CLAIMED',
  ownerId: 'e-1',
  ownerOrganizationId: 'org-1',
  version: 2,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
  lastActivityAt: '2026-11-21T08:00:00.000Z',
};
const team = '33333333-3333-4333-8333-333333333333';

type Grant = Readonly<{ scopes: readonly DataScope[]; fields: readonly string[] | null }>;
type Listing = NonNullable<ApiDependencies['crm']>['listLeadPage'];

const double = (items: readonly unknown[] = [row]) => {
  const listLeadPage = vi
    .fn<Listing>()
    .mockResolvedValue({ items, nextCursor: null } as unknown as Awaited<ReturnType<Listing>>);
  const repo = {
    listLeadPage,
    findLead: vi.fn().mockResolvedValue(null),
    createLead: vi.fn().mockResolvedValue(row),
    assign: vi.fn().mockResolvedValue(row),
    transitionLead: vi.fn().mockResolvedValue(row),
    claimLead: vi.fn().mockResolvedValue(row),
  } as unknown as NonNullable<ApiDependencies['crm']>;
  return { repo, listLeadPage };
};

const company: Grant = { scopes: ['COMPANY'], fields: null };

const scopeFor = (
  repo: NonNullable<ApiDependencies['crm']>,
  overrides: Readonly<{
    lead?: Grant;
    pool?: Grant;
    activity?: Grant;
    activityAnchors?: readonly ScopeAnchor[];
  }> = {},
) => {
  const permissions = new Map<string, Grant>([
    ['lead:read', overrides.lead ?? company],
    ['lead-pool:read', overrides.pool ?? company],
  ]);
  const scopeAnchors = new Map<string, readonly ScopeAnchor[]>();
  if (overrides.activity) permissions.set('customer-activity:read', overrides.activity);
  if (overrides.activityAnchors)
    scopeAnchors.set('customer-activity:read', overrides.activityAnchors);
  return {
    authorization: {
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      permissions,
      scopeAnchors,
    } as unknown as AuthorizationContext,
    // 路由组注册要求 commercial 依赖在场（同 activities.test.ts 的替身写法）。
    dependencies: { crm: repo, commercial: repo } as unknown as ApiDependencies,
    correlationId: 'corr-1',
  };
};

const list = (pathname: '/api/v1/leads' | '/api/v1/leads/pool'): ApiRequest => ({
  method: 'GET',
  pathname,
});

const itemsOf = (response: unknown) =>
  (response as { body: { items: Record<string, unknown>[] } }).body.items;

describe('leads fastify bridge track — lastActivityAt additive key (TD-CRM-003)', () => {
  for (const pathname of ['/api/v1/leads', '/api/v1/leads/pool'] as const) {
    const pool = pathname.endsWith('/pool');

    it(`${pathname}：有活动读权限——活动可见范围（作用域 + 锚点）作为第 5 实参交给仓储，加性键随行返回`, async () => {
      const { repo, listLeadPage } = double();
      const response = await dispatchFastifyRouteGroup(
        list(pathname),
        scopeFor(repo, {
          activity: { scopes: ['TEAM'], fields: null },
          activityAnchors: [{ scope: 'TEAM', organizationId: team }],
        }),
      );
      expect(response?.statusCode).toBe(200);
      expect(listLeadPage).toHaveBeenCalledTimes(1);
      const args = listLeadPage.mock.calls[0];
      if (!args) throw new Error('listLeadPage was not called');
      expect(args[0]).toEqual({
        companyId: '11111111-1111-4111-8111-111111111111',
        employeeId: 'e-1',
      });
      expect(args[1]).toEqual(['COMPANY']);
      expect(args[3]).toEqual({ limit: 100, pool });
      expect(args[4]).toEqual({
        scopes: ['TEAM'],
        anchors: [{ scope: 'TEAM', organizationId: team }],
      });
      expect(itemsOf(response)).toEqual([row]);
    });

    it(`${pathname}：无 customer-activity:read——第 5 实参为 null，字段不随行`, async () => {
      const { repo, listLeadPage } = double([{ ...row, lastActivityAt: null }]);
      const response = await dispatchFastifyRouteGroup(list(pathname), scopeFor(repo));
      expect(response?.statusCode).toBe(200);
      expect(listLeadPage.mock.calls[0]?.[4]).toBeNull();
      expect(itemsOf(response)).toEqual([{ ...row, lastActivityAt: null }]);
    });

    it(`${pathname}：customer-activity:read 存在但作用域为空——同无权限（第 5 实参为 null）`, async () => {
      const { repo, listLeadPage } = double();
      await dispatchFastifyRouteGroup(
        list(pathname),
        scopeFor(repo, { activity: { scopes: [], fields: null } }),
      );
      expect(listLeadPage.mock.calls[0]?.[4]).toBeNull();
    });

    it(`${pathname}：既有 11 个键的线上顺序与取值不变，lastActivityAt 排在最末（无字段白名单）`, async () => {
      const { repo } = double();
      const response = await dispatchFastifyRouteGroup(list(pathname), scopeFor(repo));
      const item = itemsOf(response)[0] ?? {};
      expect(Object.keys(item)).toEqual([...WIRE_KEYS, 'lastActivityAt']);
      for (const key of WIRE_KEYS) expect(item[key]).toEqual(row[key]);
      // 改前的响应 JSON（既有键、既有线上顺序）= 加性响应去掉末尾的加性键：字节前缀关系。
      const before = JSON.stringify(Object.fromEntries(WIRE_KEYS.map((key) => [key, row[key]])));
      expect(JSON.stringify(item)).toBe(
        `${before.slice(0, -1)},"lastActivityAt":"${row.lastActivityAt}"}`,
      );
    });

    it(`${pathname}：仓储以 Date 形态给出的 lastActivityAt 归一为 ISO 串`, async () => {
      const { repo } = double([{ ...row, lastActivityAt: new Date('2026-11-21T08:00:00Z') }]);
      const response = await dispatchFastifyRouteGroup(list(pathname), scopeFor(repo));
      expect(itemsOf(response)).toEqual([row]);
    });

    it(`${pathname}：字段白名单（非 null）按 permittedDto 裁剪——不在白名单的键（含 lastActivityAt）不返回`, async () => {
      const grant = { scopes: ['COMPANY'] as const, fields: ['title', 'status'] };
      const { repo } = double();
      const response = await dispatchFastifyRouteGroup(
        list(pathname),
        scopeFor(repo, pool ? { pool: grant } : { lead: grant }),
      );
      expect(itemsOf(response)).toEqual([{ id: row.id, title: row.title, status: row.status }]);
    });

    it(`${pathname}：仓储行不带 lastActivityAt（旧替身形态）仍通过响应 schema`, async () => {
      const legacy = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== 'lastActivityAt'),
      );
      const { repo } = double([legacy]);
      const response = await dispatchFastifyRouteGroup(list(pathname), scopeFor(repo));
      expect(response?.statusCode).toBe(200);
      expect(itemsOf(response)).toEqual([legacy]);
    });
  }

  it.each([false, true])(
    '公海与活动可读、lead:read 缺失或作用域为空（emptyScope=%s）：仍返回 200，但跟进时间为 null',
    async (emptyScope) => {
      const { repo, listLeadPage } = double();
      listLeadPage.mockImplementation((_actor, _scopes, _anchors, _filter, activity) =>
        Promise.resolve({
          items: [{ ...row, lastActivityAt: activity === null ? null : row.lastActivityAt }],
          nextCursor: null,
        } as Awaited<ReturnType<Listing>>),
      );
      const scope = scopeFor(repo, { activity: company });
      const permissions = new Map(scope.authorization.permissions);
      if (emptyScope) permissions.set('lead:read', { scopes: [], fields: null });
      else permissions.delete('lead:read');
      const response = await dispatchFastifyRouteGroup(list('/api/v1/leads/pool'), {
        ...scope,
        authorization: { ...scope.authorization, permissions },
      });
      expect(response?.statusCode).toBe(200);
      expect(listLeadPage).toHaveBeenCalledTimes(1);
      expect(listLeadPage.mock.calls[0]?.[4]).toBeNull();
      expect(itemsOf(response)).toEqual([{ ...row, lastActivityAt: null }]);
    },
  );

  it('没有线索读权限：403 先于任何仓储调用（门控不改变授权顺序）', async () => {
    const { repo, listLeadPage } = double();
    const denied = await dispatchFastifyRouteGroup(
      list('/api/v1/leads'),
      scopeFor(repo, {
        lead: { scopes: [], fields: null },
        activity: { scopes: ['COMPANY'], fields: null },
      }),
    );
    expect(denied?.statusCode).toBe(403);
    expect((denied?.body as { error: { message: string } }).error.message).toBe(
      'Permission denied',
    );
    expect(listLeadPage).not.toHaveBeenCalled();
  });
});
