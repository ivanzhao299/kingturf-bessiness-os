// U3-COM-1（ADR-0015 双轨）：commercial 商机域 Fastify+Zod 现代化首端点。
// 与 routes/opportunities.ts 的 node:http 轨并行——原轨逐字不动（行为守恒）；
// 本文件为独立装配入口，生产 server.ts 不引用（令牌认证中间件接线属后续子批），
// 经 buildCommercialOpportunitiesFastifyApp 工厂注入授权上下文与仓储后独立可用。
// 分页契约与 routes/qtc-operational-reads.ts 同口径：uuid keyset cursor + nextCursor。
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import { permittedDto } from '../../app-values.ts';
import type { OpportunityPage, OpportunityPageFilter } from '../../commercial-repositories.ts';
import type { AuthorizationContext, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';

export type { OpportunityPage, OpportunityPageFilter };

export type OpportunityPageRepository = Readonly<{
  listOpportunityPage: (
    actor: AuthorizationContext['actor'],
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    filter: OpportunityPageFilter,
  ) => Promise<OpportunityPage>;
}>;

export type OpportunityRouteDeps = Readonly<{
  authorization: AuthorizationContext;
  repository: OpportunityPageRepository;
}>;

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
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  customerId: z.uuid().optional(),
});
const listResponseSchema = z.object({
  items: z.array(opportunityDtoSchema),
  nextCursor: z.string().nullable(),
});

export function buildCommercialOpportunitiesFastifyApp(deps: OpportunityRouteDeps) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- serializerCompiler/validatorCompiler 的泛型签名在 strict 模式下退化为 any；与 server-fastify.ts 同一豁免口径
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);

  app.get(
    '/api/v1/opportunities',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      // 与 node:http 轨同一授权助手与字段遮蔽：capability/scopes/anchors/permittedDto 单一口径。
      const grant = authorizeQuery(deps.authorization, 'opportunity:read');
      const page = await deps.repository.listOpportunityPage(
        deps.authorization.actor,
        grant.scopes,
        grant.anchors,
        {
          limit: request.query.limit,
          ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
          ...(request.query.status === undefined ? {} : { status: request.query.status }),
          ...(request.query.customerId === undefined
            ? {}
            : { customerId: request.query.customerId }),
        },
      );
      const fields = deps.authorization.permissions.get('opportunity:read')?.fields ?? null;
      return {
        items: page.items.map((item) =>
          permittedDto(item as unknown as Record<string, unknown>, fields),
        ),
        nextCursor: page.nextCursor,
      };
    },
  );

  return app;
}
