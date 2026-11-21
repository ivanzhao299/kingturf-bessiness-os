// U3-COM-6（ADR-0015）：sales-policies 域 Fastify 端点组（cost-models 轨不动）。
// GET 列表 = 视图轨迁移（listDefinitions('policy') + strict { items }）；GET 详情 =
// additive 只读（findDefinition：根+全部版本行）；POST 创建 = legacy definitionInput
// 同解析链（frozen 契约消息逐字节一致）；PUT 版本/发布 = legacy POST /versions 的
// 现代化动词别名（definitionVersionInput 同链，publish 旗标承载发布语义）。
// 全部响应仓储直通（无 zod 响应 schema）——与 legacy JSON 逐字节一致。
import { authorizeQuery } from '../../policy.ts';
import { allow, array, currency, objectBody, string, uuid } from '../../app-values.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { ApiRequest } from '../../api-types.ts';
import { definitionInput, definitionVersionInput } from '../commercial-definitions.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type SalesPolicyRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listDefinitions' | 'findDefinition' | 'createDefinition' | 'createDefinitionVersion'
>;

// 与 legacy commercial-definitions 上下文同源的解析器面（零漂移）。
const legacyParsers = {
  objectBody,
  allow,
  uuid,
  string,
  currency,
  array,
} as const;

export function registerSalesPolicyRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: SalesPolicyRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  const legacyContext = () => ({
    repository,
    authorization: scope.authorization,
    correlationId: scope.correlationId,
    authorize: (
      capabilityOfGrant: Parameters<typeof authorizeQuery>[1],
      fields?: readonly string[],
    ) => authorizeQuery(scope.authorization, capabilityOfGrant, fields),
    parsers: legacyParsers,
  });

  app.get('/api/v1/sales-policies', async () => {
    const grant = authorizeQuery(scope.authorization, 'sales-policy:read');
    const items = await repository.listDefinitions(
      'policy',
      scope.authorization.actor,
      grant.scopes,
    );
    return { items };
  });

  app.get('/api/v1/sales-policies/:definitionId', async (request, reply) => {
    const grant = authorizeQuery(scope.authorization, 'sales-policy:read');
    const definition = await repository.findDefinition(
      'policy',
      (request.params as { definitionId: string }).definitionId.toLowerCase(),
      scope.authorization.actor,
      grant.scopes,
    );
    if (!definition) {
      void reply.code(404).send({
        error: {
          code: 'not_found',
          message: 'Sales policy not found',
          correlationId: scope.correlationId,
        },
      });
      return;
    }
    return definition;
  });

  // POST 创建：legacy definitionInput 同解析链 → 201 直通响应。
  app.post('/api/v1/sales-policies', async (request, reply) => {
    const { grant, input } = definitionInput(
      legacyContext(),
      request as unknown as ApiRequest,
      'policy',
    );
    const created = await repository.createDefinition(
      'policy',
      input,
      scope.authorization.actor,
      grant.scopes,
      scope.correlationId,
    );
    void reply.code(201);
    return created;
  });

  // PUT 版本/发布：legacy POST /:id/versions 的现代化动词别名（同一解析链）→ 200。
  app.put('/api/v1/sales-policies/:definitionId/versions', async (request, reply) => {
    const { grant, definitionId, input } = definitionVersionInput(
      legacyContext(),
      request as unknown as ApiRequest,
      'policy',
      (request.params as { definitionId: string }).definitionId,
    );
    const created = await repository.createDefinitionVersion(
      'policy',
      definitionId,
      input,
      scope.authorization.actor,
      grant.scopes,
      scope.correlationId,
    );
    void reply.code(200);
    return created;
  });
}
