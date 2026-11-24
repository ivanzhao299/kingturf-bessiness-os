// U3-MFG-5（ADR-0015）：工单车间执行写端点组，并入 production-orders 域。
// POST /:id/operation-reports 的解析链与 legacy production-report.ts 逐字一致（allow 九字段
// → production:report 授权（按请求字段）→ 工单 UUID → 逐字段解析 → 201 + mutationDto
// (production:read)），调用同一仓储方法 reportOperation；legacy 路由逐字保留（双轨并行）。
import { assertStableCode } from '@kingturf/domain';
import type { ApiDependencies } from '../../app.ts';
import { allow, decimal, objectBody, string, timestamp, uuid } from '../../app-values.ts';
import { mutation, scopedContextBy } from './production-orders.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ProductionOrderExecutionRepository = Pick<
  NonNullable<ApiDependencies['production']>,
  'reportOperation'
>;
type Report = ProductionOrderExecutionRepository['reportOperation'];
type ReportInput = Readonly<Parameters<Report>[1]>;

export function registerProductionOrderExecutionRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ProductionOrderExecutionRepository | null =
    scope.dependencies.production ?? null;
  const requireRepository = (): ProductionOrderExecutionRepository => {
    if (!repository)
      throw Object.assign(new Error('Production dependency unavailable'), { statusCode: 503 });
    return repository;
  };
  const scoped = scopedContextBy(scope);

  // POST 工序报工：legacy production-report.ts 同解析链。
  app.post(
    '/api/v1/production-orders/:productionOrderId/operation-reports',
    async (request, reply) => {
      const repo = requireRepository();
      const body = objectBody(request.body);
      allow(body, [
        'operationId',
        'goodQuantity',
        'scrapQuantity',
        'laborMinutes',
        'machineMinutes',
        'startedAt',
        'completedAt',
        'notes',
        'idempotencyKey',
      ]);
      const context = scoped('production:report', Object.keys(body));
      const orderId = uuid(
        (request.params as { productionOrderId: string }).productionOrderId,
        'productionOrderId',
      );
      const input: ReportInput = {
        operationId: uuid(body.operationId, 'operationId'),
        goodQuantity: decimal(body.goodQuantity, 'goodQuantity'),
        scrapQuantity: decimal(body.scrapQuantity, 'scrapQuantity'),
        laborMinutes: decimal(body.laborMinutes, 'laborMinutes'),
        machineMinutes: decimal(body.machineMinutes, 'machineMinutes'),
        startedAt: timestamp(body.startedAt, 'startedAt'),
        completedAt: timestamp(body.completedAt, 'completedAt'),
        notes: string(body.notes ?? '', 'notes'),
        idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
      };
      const reported = await repo.reportOperation(orderId, input, context, scope.correlationId);
      void reply.code(201);
      return mutation(reported, scope.authorization);
    },
  );
}
