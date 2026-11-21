import { describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@kingturf/domain';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import {
  allow,
  currency,
  decimal,
  error,
  expectedVersion,
  integer,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../src/app-values.ts';
import type { OpportunityDto } from '@kingturf/types';
import { authorizeQuery } from '../../src/policy.ts';
import { dispatchOpportunityRoutes } from '../../src/routes/opportunities.ts';
import { commercialViewRoutes } from '../../src/routes/commercial-views.ts';
import { dispatchRoutes } from '../../src/routes/types.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-2 行为守恒校验：同一（仓储 double + 授权上下文 + 请求）分别经 legacy
// dispatch 与生产桥 dispatchFastifyRouteGroup，断言响应逐键一致。这是「同一请求
// 经新旧轨返回一致响应」的单元级证明；PG 全量一致性由集成轨道覆盖。
// 夹具的 createdAt/updatedAt 用真实 Date 对象（pg timestamp 列的生产形态）：
// legacy 轨经 JSON.stringify 隐式转 ISO，桥轨经显式归一化——两轨输出必须逐字节一致。
const opportunity = {
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
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  updatedAt: new Date('2026-11-20T00:00:00.000Z'),
} as unknown as OpportunityDto;
const solution = {
  id: '33333333-3333-4333-8333-333333333333',
  technicalSolutionId: '44444444-4444-4444-8444-444444444444',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  code: 'TS-2026-001',
  revision: 2,
  status: 'DRAFT',
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  specification: { productFamily: '足球草' },
  assumptions: ['场地基础平整'],
  createdAt: new Date('2026-11-20T00:00:00.000Z'),
} as unknown as JsonObject;

const authorization = (fields: readonly string[] | null): AuthorizationContext =>
  ({
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['opportunity:read', { scopes: ['TENANT'], fields }],
      ['technical-solution:read', { scopes: ['TENANT'], fields }],
    ]),
  }) as unknown as AuthorizationContext;

const sharedRepository = () =>
  ({
    listOpportunities: () => Promise.resolve([opportunity]),
    findOpportunity: () => Promise.resolve(null),
    createOpportunity: () => Promise.resolve({}),
    updateOpportunity: () => Promise.resolve({}),
    transitionOpportunity: () => Promise.resolve({}),
    listOpportunityPage: () => Promise.resolve({ items: [opportunity], nextCursor: null }),
    listCommercialView: () => Promise.resolve([solution]),
  }) as unknown as NonNullable<ApiDependencies['commercial']>;

const fieldsFor = (authorization: AuthorizationContext, capability: PermissionKey) =>
  authorization.permissions.get(capability)?.fields ?? null;

describe('fastify bridge 行为守恒（legacy 对比）', () => {
  it('GET /api/v1/opportunities：新旧轨响应逐键一致（含遮蔽）', async () => {
    for (const fields of [null, ['id', 'name', 'status']]) {
      const authz = authorization(fields);
      const repo = sharedRepository();
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/opportunities' };
      const legacy = await dispatchOpportunityRoutes(
        {
          repository: repo,
          authorization: authz,
          correlationId: 'corr-1',
          authorize: (capability, requested) => authorizeQuery(authz, capability, requested),
          unavailable: () =>
            error(503, 'internal_error', 'Commercial dependency unavailable', 'corr-1'),
          notFound: () => error(404, 'not_found', 'Opportunity not found', 'corr-1'),
          permittedDto: (value) => permittedDto(value, fieldsFor(authz, 'opportunity:read')),
          mutationDto: (value) => mutationDto(value, authz, 'opportunity:read'),
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            decimal,
            currency,
            integer,
            expectedVersion,
          },
        },
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: { commercial: repo } as unknown as ApiDependencies,
        correlationId: 'corr-1',
      });
      // legacy 轨的 Date 对象在生产由 server.ts JSON.stringify 序列化；比对取同一语义形态。
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
    }
  });

  it('GET /api/v1/technical-solutions：新旧轨响应逐键一致（含遮蔽）', async () => {
    for (const fields of [null, ['id', 'code']]) {
      const authz = authorization(fields);
      const repo = sharedRepository();
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/technical-solutions' };
      const legacy = await dispatchRoutes(
        commercialViewRoutes({
          repository: repo,
          authorization: authz,
          authorize: (capability) => authorizeQuery(authz, capability),
          permittedDto: (value, capability) => permittedDto(value, fieldsFor(authz, capability)),
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: { commercial: repo } as unknown as ApiDependencies,
        correlationId: 'corr-1',
      });
      // legacy 轨的 Date 对象在生产由 server.ts JSON.stringify 序列化；比对取同一语义形态。
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
    }
  });
});
