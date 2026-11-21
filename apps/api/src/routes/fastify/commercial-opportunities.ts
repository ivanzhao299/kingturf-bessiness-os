// U3-COM-1/2（ADR-0015 双轨→接线）：commercial 商机域 Fastify+Zod 首端点。
// 插件式注册进 routes/fastify/registry.ts 生产桥；授权上下文/仓储经逐请求 scope
// 注入（AsyncLocalStorage），与 node:http 轨共用 authorizeQuery/permittedDto
// 同一口径。默认 limit=100 与 legacy listOpportunities 的 LIMIT 100 对齐（行为守恒：
// 相同请求 items 内容/排序/遮蔽一致；nextCursor 仅在超出页长时出现）。
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import { permittedDto } from '../../app-values.ts';
import type { OpportunityPage, OpportunityPageFilter } from '../../commercial-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';

export type { OpportunityPage, OpportunityPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type OpportunityPageRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listOpportunityPage'
>;

const OPPORTUNITY_STATUSES = ['OPEN', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST', 'CANCELLED'] as const;

const moneySchema = z.object({ amount: z.string(), currency: z.string() });
// 行级字段遮蔽（permittedDto）可能裁剪任意列：出站 DTO 以 partial 口径校验。
const opportunityDtoSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    customerId: z.string().nullable(),
    leadId: z.string().nullable(),
    name: z.string(),
    status: z.enum(OPPORTUNITY_STATUSES),
    ownerId: z.string(),
    ownerOrganizationId: z.string(),
    value: moneySchema,
    probabilityBasisPoints: z.number(),
    expectedCloseDate: z.string(),
    version: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .partial();
const listQuerySchema = z.object({
  // 默认 100 = legacy LIMIT 100（行为守恒：无参请求两侧 items 完全一致）。
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.uuid().optional(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  customerId: z.uuid().optional(),
});
const listResponseSchema = z.object({
  items: z.array(opportunityDtoSchema),
  // 无游标时字段缺省（与 legacy { items } 逐键一致），仅在超出页长时出现。
  nextCursor: z.string().optional(),
});

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

export function registerCommercialOpportunitiesRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: OpportunityPageRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  app.get(
    '/api/v1/opportunities',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      // 与 node:http 轨同一授权助手与字段遮蔽：capability/scopes/anchors/permittedDto 单一口径。
      const grant = authorizeQuery(scope.authorization, 'opportunity:read');
      const query = request.query;
      const filter: OpportunityPageFilter = {
        limit: query.limit,
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
      };
      const page = await repository.listOpportunityPage(
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
        filter,
      );
      const fields = scope.authorization.permissions.get('opportunity:read')?.fields ?? null;
      return {
        items: page.items.map((item) =>
          permittedDto(normalizeTimestamps(item) as unknown as Record<string, unknown>, fields),
        ),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      };
    },
  );
}
