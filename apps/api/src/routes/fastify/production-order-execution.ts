// U3-MFG-5（ADR-0015）：工单车间执行写端点组，并入 production-orders 域。三个端点的解析链
// 与各自 legacy 路由逐字一致，调用同一批仓储方法；legacy 三条路由逐字保留（双轨并行）：
// - POST /:id/operation-reports ↔ production-report.ts（allow 九字段 → production:report 授权
//   （按请求字段）→ 工单 UUID → 逐字段解析 → 201 + mutationDto(production:read)）；
// - POST /:id/materials ↔ production-material.ts（allow 八字段 → production:material 授权 →
//   业务类型枚举 → 工单 UUID → 逐字段解析 → 201 + mutationDto）；
// - POST /:id/finished-rolls ↔ production-output.ts（allow 七字段 → production:report 授权 →
//   工单 UUID → 逐字段解析 → 201 + mutationDto）。
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { ApiDependencies } from '../../app.ts';
import {
  allow,
  calendarDate,
  decimal,
  objectBody,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { mutation, scopedContextBy } from './production-orders.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ProductionOrderExecutionRepository = Pick<
  NonNullable<ApiDependencies['production']>,
  'reportOperation' | 'transactMaterial' | 'createOutput'
>;
type Report = ProductionOrderExecutionRepository['reportOperation'];
type ReportInput = Readonly<Parameters<Report>[1]>;
type Material = ProductionOrderExecutionRepository['transactMaterial'];
type MaterialInput = Readonly<Parameters<Material>[1]>;
type Output = ProductionOrderExecutionRepository['createOutput'];
type OutputInput = Readonly<Parameters<Output>[1]>;

const orderIdOf = (request: { params: unknown }): string =>
  uuid((request.params as { productionOrderId: string }).productionOrderId, 'productionOrderId');

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
      const orderId = orderIdOf(request);
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

  // POST 领料/退料：legacy production-material.ts 同解析链（授权先于业务类型枚举；批次
  // 是否属于工单 BOM、批次质量与累计领用量的门禁在 transactMaterial 与数据库触发器）。
  app.post('/api/v1/production-orders/:productionOrderId/materials', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'transactionType',
      'itemVersionId',
      'lotId',
      'locationId',
      'quantity',
      'reason',
      'occurredAt',
      'idempotencyKey',
    ]);
    const context = scoped('production:material', Object.keys(body));
    const transactionType = string(body.transactionType, 'transactionType');
    if (!['ISSUE', 'RETURN'].includes(transactionType))
      throw new DomainError('invalid_request', 'transactionType is unsupported');
    const orderId = orderIdOf(request);
    const input: MaterialInput = {
      transactionType: transactionType as MaterialInput['transactionType'],
      itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
      lotId: uuid(body.lotId, 'lotId'),
      locationId: uuid(body.locationId, 'locationId'),
      quantity: decimal(body.quantity, 'quantity'),
      reason: string(body.reason, 'reason'),
      occurredAt: timestamp(body.occurredAt, 'occurredAt'),
      idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
    };
    const posted = await repo.transactMaterial(orderId, input, context, scope.correlationId);
    void reply.code(201);
    return mutation(posted, scope.authorization);
  });

  // POST 成品卷入库：legacy production-output.ts 同解析链（卷号、成品批次与正向库存收货在
  // createOutput 同一事务内生成；与报工/工单/批次的匹配门禁在数据库触发器）。
  app.post(
    '/api/v1/production-orders/:productionOrderId/finished-rolls',
    async (request, reply) => {
      const repo = requireRepository();
      const body = objectBody(request.body);
      allow(body, [
        'operationReportId',
        'itemVersionId',
        'rollNumber',
        'lotNumber',
        'locationId',
        'quantity',
        'manufacturedAt',
      ]);
      const context = scoped('production:report', Object.keys(body));
      const orderId = orderIdOf(request);
      const input: OutputInput = {
        operationReportId: uuid(body.operationReportId, 'operationReportId'),
        itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
        rollNumber: assertStableCode(string(body.rollNumber, 'rollNumber')),
        lotNumber: assertStableCode(string(body.lotNumber, 'lotNumber')),
        locationId: uuid(body.locationId, 'locationId'),
        quantity: decimal(body.quantity, 'quantity'),
        manufacturedAt: calendarDate(body.manufacturedAt, 'manufacturedAt'),
      };
      const received = await repo.createOutput(orderId, input, context, scope.correlationId);
      void reply.code(201);
      return mutation(received, scope.authorization);
    },
  );
}
