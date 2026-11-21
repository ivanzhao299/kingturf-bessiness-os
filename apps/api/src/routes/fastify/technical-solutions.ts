// U3-COM-2（ADR-0015）：technical-solutions 域 Fastify+Zod 端点组。
// GET 列表 = legacy commercialViewRoutes('solutions') 的行为守恒迁移（同仓储
// listCommercialView + 同遮蔽 + 严格 { items } 信封，无分页字段）；
// GET 详情 = 新增 additive 只读（findTechnicalSolutionRevision）；
// PUT 更新 = 经新修订更新方案（与 legacy POST /:id/revisions 同仓储
// createTechnicalSolutionRevision 同规则——修订不可变是域模型，PUT 为现代化动词别名）。
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import { mutationDto, permittedDto } from '../../app-values.ts';
import type { JsonObject } from '@kingturf/types';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type SolutionRevisionRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listCommercialView' | 'findTechnicalSolutionRevision' | 'createTechnicalSolutionRevision'
>;

const SOLUTION_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    technicalSolutionId: z.string(),
    opportunityId: z.string(),
    code: z.string(),
    revision: z.number(),
    status: z.string(),
    ctrVersionId: z.string(),
    specification: z.record(z.string(), z.unknown()),
    assumptions: z.array(z.unknown()),
    createdAt: z.string(),
  })
  .partial();
const listResponseSchema = z.object({ items: z.array(SOLUTION_ROW_SCHEMA) });
const revisionDetailSchema = SOLUTION_ROW_SCHEMA;
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});
const updateBodySchema = z
  .object({
    ctrVersionId: z.uuid(),
    specification: z.record(z.string(), z.unknown()),
    // p.strings 同语义：非空字符串数组，去重并排序。
    assumptions: z
      .array(z.string().refine((value) => value.trim() !== ''))
      .transform((values) => [...new Set(values)].sort()),
    final: z.boolean().optional(),
  })
  .strict();

// legacy p.uuid 的小写归一（A1-P3-2 同 UUID 大小写双写防绕过口径）。
const lowercaseUuid = (value: string): string => value.toLowerCase();

// pg 将 timestamp 列解析为 Date 对象；legacy 轨经 JSON.stringify 隐式转 ISO 串，
// 本轨在 zod 响应校验前显式归一化（行为守恒：与 legacy JSON 输出逐字节一致）。
const normalizeTimestamps = <T>(item: T): T => {
  if (!(item instanceof Map) && typeof item === 'object' && item !== null) {
    const source = item as Record<string, unknown>;
    const normalized: Record<string, unknown> = { ...source };
    for (const [key, value] of Object.entries(source))
      if (value instanceof Date) normalized[key] = value.toISOString();
    return normalized as T;
  }
  return item;
};

export function registerTechnicalSolutionRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: SolutionRevisionRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  const readFields = scope.authorization.permissions.get('technical-solution:read')?.fields;

  app.get(
    '/api/v1/technical-solutions',
    { schema: { response: { 200: listResponseSchema } } },
    async () => {
      const grant = authorizeQuery(scope.authorization, 'technical-solution:read');
      const items = await repository.listCommercialView(
        'solutions',
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      return {
        items: items.map((item) =>
          permittedDto(
            normalizeTimestamps(item as unknown as Record<string, unknown>),
            readFields ?? null,
          ),
        ),
      };
    },
  );

  app.get(
    '/api/v1/technical-solutions/:revisionId',
    { schema: { response: { 200: revisionDetailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const grant = authorizeQuery(scope.authorization, 'technical-solution:read');
      const revision = await repository.findTechnicalSolutionRevision(
        lowercaseUuid((request.params as { revisionId: string }).revisionId),
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      if (!revision) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Technical solution revision not found',
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

  app.put(
    '/api/v1/technical-solutions/:solutionId',
    { schema: { body: updateBodySchema } },
    async (request) => {
      const body = request.body;
      const grant = authorizeQuery(
        scope.authorization,
        'technical-solution:update',
        Object.keys(body),
      );
      const result = await repository.createTechnicalSolutionRevision(
        lowercaseUuid((request.params as { solutionId: string }).solutionId),
        {
          ctrVersionId: body.ctrVersionId,
          specification: body.specification as JsonObject,
          assumptions: body.assumptions,
          final: body.final === true,
        },
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
        scope.correlationId,
      );
      return mutationDto(
        result as unknown as Record<string, unknown>,
        scope.authorization,
        'technical-solution:read',
      );
    },
  );
}
