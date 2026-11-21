// U3-COM-3（ADR-0015）：quotes 域 Fastify+Zod 端点组。
// GET 列表 = legacy 视图轨迁移（listQuotePage keyset cursor 分页，默认 limit=100 与
// legacy LIMIT 100 对齐；looseObject partial 透传+Date 归一化——COM-2 同款守恒口径）；
// GET 详情 = additive 只读（findQuoteRevision）；POST 创建 / PUT 版本 = 与 legacy
// quote-writes 同一解析链（复用导出的 bodyAndLines/quoteValues 与 app-values 解析器，
// 校验语义与消息逐字节一致——quote-write 契约钉死 legacy 消息文本，zod body 校验会
// 破坏冻结契约，故 POST/PUT 走 handler 侧 legacy parser 链，zod 承载查询串与响应）。
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  array,
  currency,
  decimal,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { QuotePage, QuotePageFilter } from '../../commercial-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { ApiRequest } from '../../api-types.ts';
import { bodyAndLines, quoteValues } from '../quote-writes.ts';

export type { QuotePage, QuotePageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type QuotePageRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listQuotePage' | 'findQuoteRevision' | 'createQuote'
>;

const QUOTE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ISSUED',
  'EXPIRED',
  'REJECTED',
] as const;

const QUOTE_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    quoteId: z.string(),
    opportunityId: z.string(),
    quoteNumber: z.string(),
    revision: z.number(),
    status: z.string(),
    opportunityVersion: z.number(),
    opportunitySnapshotId: z.string().nullable(),
    ctrVersionId: z.string(),
    technicalSolutionRevisionId: z.string(),
    costDecisionId: z.string(),
    policyVersionId: z.string(),
    policyEvaluationId: z.string(),
    currency: z.string(),
    subtotal: z.string(),
    discount: z.string(),
    total: z.string(),
    costTotal: z.string(),
    margin: z.string(),
    marginBasisPoints: z.number(),
    validUntil: z.string(),
    issuedAt: z.string().nullable(),
    lines: z.array(z.unknown()),
    approvals: z.array(z.unknown()),
    issuedSnapshotId: z.string().nullable(),
    issuedSnapshotHash: z.string().nullable(),
  })
  .partial();
const listQuerySchema = z.object({
  // 默认 100 = legacy LIMIT 100（行为守恒：无参请求两侧 items 完全一致）。
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.uuid().optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
});
const listResponseSchema = z.object({
  items: z.array(QUOTE_ROW_SCHEMA),
  nextCursor: z.string().optional(),
});
const revisionDetailSchema = QUOTE_ROW_SCHEMA;
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

// pg 将 timestamp/date 列解析为 Date 对象；legacy 轨经 JSON.stringify 隐式转 ISO 串，
// 本轨在 zod 响应校验前显式归一化（行为守恒：与 legacy JSON 输出逐字节一致）。
const normalizeTimestamps = <T>(item: T): T => {
  if (typeof item === 'object' && item !== null) {
    const source = item as Record<string, unknown>;
    const normalized: Record<string, unknown> = { ...source };
    for (const [key, value] of Object.entries(source))
      if (value instanceof Date) normalized[key] = value.toISOString();
    return normalized as T;
  }
  return item;
};

// 与 legacy quote-writes 上下文同源的解析器面（同一批 app-values 纯函数，零漂移）。
const legacyParsers = {
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
} as const;

export function registerQuoteRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: QuotePageRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  const readFields = scope.authorization.permissions.get('quote:read')?.fields;
  const legacyContext = () => ({
    repository,
    authorization: scope.authorization,
    correlationId: scope.correlationId,
    authorize: (
      capabilityOfGrant: Parameters<typeof authorizeQuery>[1],
      fields: readonly string[],
    ) => authorizeQuery(scope.authorization, capabilityOfGrant, fields),
    mutationDto: (value: Record<string, unknown>) =>
      mutationDto(value, scope.authorization, 'quote:read'),
    parsers: legacyParsers,
  });

  app.get(
    '/api/v1/quotes',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const grant = authorizeQuery(scope.authorization, 'quote:read');
      const query = request.query;
      const filter: QuotePageFilter = {
        limit: query.limit,
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.status === undefined ? {} : { status: query.status }),
      };
      const page = await repository.listQuotePage(
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
        filter,
      );
      return {
        items: page.items.map((item) =>
          permittedDto(
            normalizeTimestamps(item as unknown as Record<string, unknown>),
            readFields ?? null,
          ),
        ),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      };
    },
  );

  app.get(
    '/api/v1/quotes/:revisionId',
    { schema: { response: { 200: revisionDetailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const grant = authorizeQuery(scope.authorization, 'quote:read');
      const revision = await repository.findQuoteRevision(
        (request.params as { revisionId: string }).revisionId.toLowerCase(),
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      if (!revision) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Quote revision not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(
        normalizeTimestamps(revision as unknown as Record<string, unknown>),
        readFields ?? null,
      );
    },
  );

  // 与 legacy POST /api/v1/quotes 同一解析链：201 + mutationDto；body 解析经
  // bodyAndLines/quoteValues（DomainError → 桥错误信封 → 与 legacy 契约逐字节一致）。
  app.post('/api/v1/quotes', async (request, reply) => {
    const context = legacyContext();
    const { grant, lines } = bodyAndLines(
      context,
      request as unknown as ApiRequest,
      'quote:create',
    );
    const input = { ...quoteValues(context, objectBody(request.body)), lines };
    const created = await repository.createQuote(
      input,
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
      scope.correlationId,
    );
    void reply.code(201);
    return mutationDto(
      created as unknown as Record<string, unknown>,
      scope.authorization,
      'quote:read',
    );
  });

  // PUT 版本 = 经不可变新修订更新报价（与 legacy POST /:quoteId/revisions 同仓储同
  // 规则同解析链；PUT 为现代化动词别名，legacy POST 轨逐字不动）。
  app.put('/api/v1/quotes/:quoteId', async (request, reply) => {
    const context = legacyContext();
    const { grant, lines } = bodyAndLines(
      context,
      request as unknown as ApiRequest,
      'quote:update',
    );
    const quoteId = uuid((request.params as { quoteId: string }).quoteId, 'quoteId');
    const input = { quoteId, ...quoteValues(context, objectBody(request.body)), lines };
    const created = await repository.createQuote(
      input,
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
      scope.correlationId,
    );
    void reply.code(200);
    return mutationDto(
      created as unknown as Record<string, unknown>,
      scope.authorization,
      'quote:read',
    );
  });
}
