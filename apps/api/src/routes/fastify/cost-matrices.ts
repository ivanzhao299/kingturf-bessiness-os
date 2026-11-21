// U3-COM-4（ADR-0015）：cost-matrices 域 Fastify 端点组。
// GET 摘要（page 分页/筛选/排序——legacy 校验链原样复用，非 cursor 模型）、GET flat
// 列表、GET 详情（getCostMatrix 含 audit 门）、POST 创建、PUT 因子更新（legacy PATCH
// /factors/:factorId 的现代化动词别名，同一解析链）。全部响应为仓储直通（无 zod 响应
// schema），与 legacy JSON 输出逐字节一致——parity 零漂移；POST/PUT 走 handler 侧
// legacy parser 链（base/factors 提取导出的助手），zod 不参与请求体校验。
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { ApiRequest } from '../../api-types.ts';
import { matrixInput, summaryFilters } from '../cost-matrix-base.ts';
import { bodyAndSource, factorFields, factorValues } from '../cost-matrix-factors.ts';
import {
  allow,
  calendarDate,
  costFactorSourceType,
  currency,
  decimal,
  integer,
  jsonObject,
  objectBody,
  requireCostFactorItemSource,
  string,
  uuid,
} from '../../app-values.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type CostMatrixRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  | 'listCostMatrixSummaries'
  | 'listCostMatrices'
  | 'getCostMatrix'
  | 'createCostMatrix'
  | 'addCostMatrixFactor'
  | 'updateCostMatrixFactor'
>;

const legacyParsers = {
  objectBody,
  allow,
  uuid,
  string,
  jsonObject,
  integer,
  currency,
  decimal,
  calendarDate,
  costFactorSourceType,
  requireCostFactorItemSource,
} as const;

export function registerCostMatrixRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: CostMatrixRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  const matrixContext = () => ({
    repository,
    authorization: scope.authorization,
    correlationId: scope.correlationId,
    authorize: (
      capabilityOfGrant: Parameters<typeof authorizeQuery>[1],
      fields?: readonly string[],
    ) => authorizeQuery(scope.authorization, capabilityOfGrant, fields),
    parsers: legacyParsers,
  });
  const factorContext = () => ({
    repository,
    authorization: scope.authorization,
    correlationId: scope.correlationId,
    authorize: (
      capabilityOfGrant: Parameters<typeof authorizeQuery>[1],
      fields: readonly string[],
    ) => authorizeQuery(scope.authorization, capabilityOfGrant, fields),
    parsers: legacyParsers,
  });

  // GET 摘要：page 分页模型（非 cursor）——legacy 校验链原样，响应仓储直通。
  app.get('/api/v1/cost-matrix-summaries', async (request) => {
    const { grant, filters } = summaryFilters(matrixContext(), request as unknown as ApiRequest);
    const result = await repository.listCostMatrixSummaries(
      filters,
      scope.authorization.actor,
      grant.scopes,
    );
    return { ...result, page: filters.page, pageSize: filters.pageSize };
  });

  // GET flat 列表：视图轨迁移（cost-matrix:read）。
  app.get('/api/v1/cost-matrices', async () => {
    const grant = authorizeQuery(scope.authorization, 'cost-matrix:read');
    return {
      items: await repository.listCostMatrices(scope.authorization.actor, grant.scopes),
    };
  });

  // GET 详情：getCostMatrix（校验次序与 legacy 一致：授权→uuid→audit 门）。
  app.get('/api/v1/cost-matrices/:modelId', async (request) => {
    const grant = authorizeQuery(scope.authorization, 'cost-matrix:read');
    const modelId = uuid((request.params as { modelId: string }).modelId, 'modelId');
    const includeAudit =
      scope.authorization.permissions.get('audit:read')?.scopes.includes('COMPANY') === true;
    return await repository.getCostMatrix(
      modelId,
      scope.authorization.actor,
      grant.scopes,
      includeAudit,
    );
  });

  // POST 创建：legacy 解析链（matrixInput 导出助手）+ 201 直通响应。
  app.post('/api/v1/cost-matrices', async (request, reply) => {
    const { grant, input } = matrixInput(matrixContext(), request as unknown as ApiRequest);
    const created = await repository.createCostMatrix(
      input,
      scope.authorization.actor,
      grant.scopes,
      scope.correlationId,
    );
    void reply.code(201);
    return created;
  });

  // PUT 因子更新：legacy PATCH /factors/:factorId 的现代化动词别名（同一解析链）。
  app.put('/api/v1/cost-matrices/:modelId/factors/:factorId', async (request) => {
    const context = factorContext();
    const { grant } = bodyAndSource(context, request as unknown as ApiRequest, factorFields);
    const modelId = uuid((request.params as { modelId: string }).modelId, 'modelId');
    const factorId = uuid((request.params as { factorId: string }).factorId, 'factorId');
    const body = objectBody(request.body);
    const sourceType = costFactorSourceType(body.sourceType);
    const input = factorValues(context, body, sourceType);
    return await repository.updateCostMatrixFactor(
      modelId,
      factorId,
      input,
      scope.authorization.actor,
      grant.scopes,
      scope.correlationId,
    );
  });
}
