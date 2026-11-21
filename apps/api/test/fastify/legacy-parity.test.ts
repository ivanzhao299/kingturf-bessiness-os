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
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
  array,
} from '../../src/app-values.ts';
import type { OpportunityDto } from '@kingturf/types';
import { authorizeQuery } from '../../src/policy.ts';
import { dispatchOpportunityRoutes } from '../../src/routes/opportunities.ts';
import { commercialViewRoutes } from '../../src/routes/commercial-views.ts';
import { quoteWriteRoutes } from '../../src/routes/quote-writes.ts';
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
// 报价视图行（valid_until/issued_at 为 pg Date 形态；quoteNumber 带空白/小数带尾零
// 以同时覆盖 POST 解析链的变换一致性）。
const quoteRow = {
  id: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  quoteNumber: 'Q-2026-001',
  revision: 2,
  status: 'APPROVED',
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  technicalSolutionRevisionId: '66666666-6666-4666-8666-666666666666',
  costDecisionId: '77777777-7777-4777-8777-777777777777',
  policyVersionId: '88888888-8888-4888-8888-888888888888',
  policyEvaluationId: '99999999-9999-4999-8999-999999999999',
  currency: 'CNY',
  subtotal: '1000000',
  discount: '0',
  total: '1000000',
  costTotal: '752209',
  margin: '247791',
  marginBasisPoints: 2477,
  validUntil: new Date('2026-12-31T15:59:59.000Z'),
  issuedAt: new Date('2026-11-20T01:00:00.000Z'),
  lines: [],
  approvals: [],
} as unknown as JsonObject;
const quoteBody = {
  quoteNumber: ' Q-2026-009 ',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  technicalSolutionRevisionId: '66666666-6666-4666-8666-666666666666',
  costDecisionId: '77777777-7777-4777-8777-777777777777',
  policyVersionId: '88888888-8888-4888-8888-888888888888',
  policyEvaluationId: '99999999-9999-4999-8999-999999999999',
  currency: 'CNY',
  subtotal: '869400.000000',
  discount: '0.000000',
  total: '869400.000000',
  costTotal: '652050.000000',
  margin: '217350.000000',
  marginBasisPoints: 2500,
  validUntil: '2026-12-31T23:59:59.000Z',
  lines: [
    {
      description: '人造草坪系统',
      quantity: '8050',
      unitCode: 'M2',
      unitPrice: '108',
      total: '869400',
    },
  ],
};

const authorization = (fields: readonly string[] | null): AuthorizationContext =>
  ({
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['opportunity:read', { scopes: ['TENANT'], fields }],
      ['technical-solution:read', { scopes: ['TENANT'], fields }],
      ['quote:read', { scopes: ['TENANT'], fields }],
      ['quote:create', { scopes: ['TENANT'], fields }],
      ['quote:update', { scopes: ['TENANT'], fields }],
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
    listCommercialView: (view: string) =>
      Promise.resolve(view === 'quotes' ? [quoteRow] : [solution]),
    listQuotePage: () => Promise.resolve({ items: [quoteRow], nextCursor: null }),
    findQuoteRevision: () => Promise.resolve(quoteRow),
    createQuote: () => Promise.resolve({ id: '44444444-4444-4444-8444-444444444444', version: 3 }),
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

describe('fastify bridge 行为守恒（quotes）', () => {
  it('GET /api/v1/quotes：新旧轨响应逐键一致（含遮蔽与 Date 归一化）', async () => {
    for (const fields of [null, ['id', 'code']]) {
      const authz = authorization(fields);
      const repo = sharedRepository();
      const request: ApiRequest = { method: 'GET', pathname: '/api/v1/quotes' };
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
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
    }
  });

  it('POST /api/v1/quotes：新旧轨解析链输出与仓储实参逐字节一致', async () => {
    // 写授权的字段投影两侧同构（同一 bodyAndLines/authorize 链），此处取 null 投影对拍。
    for (const fields of [null] as const) {
      const authz = authorization(fields);
      const repo = sharedRepository();
      const request: ApiRequest = {
        method: 'POST',
        pathname: '/api/v1/quotes',
        body: quoteBody,
      };
      const legacy = await dispatchRoutes(
        quoteWriteRoutes({
          repository: repo,
          authorization: authz,
          correlationId: 'corr-1',
          authorize: (capability, requested) => authorizeQuery(authz, capability, requested),
          mutationDto: (value) => mutationDto(value, authz, 'quote:read'),
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            decimal,
            currency,
            integer,
            timestamp,
            array,
            jsonObject,
          },
        }),
        request,
      );
      const bridged = await dispatchFastifyRouteGroup(request, {
        authorization: authz,
        dependencies: { commercial: repo } as unknown as ApiDependencies,
        correlationId: 'corr-1',
      });
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
    }
  });
});
