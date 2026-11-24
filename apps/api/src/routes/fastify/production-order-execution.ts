// U3-MFG-5（ADR-0015）：工单车间执行写端点组，并入 production-orders 域。三个端点的解析链
// 与各自 legacy 路由逐字一致，调用同一批仓储方法；legacy 三条路由逐字保留（双轨并行）：
// - POST /:id/operation-reports ↔ production-report.ts（allow 九字段 → production:report 授权
//   （按请求字段）→ 工单 UUID → 逐字段解析 → 201 + mutationDto(production:read)）；
// - POST /:id/materials ↔ production-material.ts（allow 八字段 → production:material 授权 →
//   业务类型枚举 → 工单 UUID → 逐字段解析 → 201 + mutationDto）；
// - POST /:id/finished-rolls ↔ production-output.ts（allow 七字段 → production:report 授权 →
//   工单 UUID → 逐字段解析 → 201 + mutationDto）。
// TD-MFG-010：数据库触发器的业务拒绝（RAISE EXCEPTION → SQLSTATE P0001，例如累计良品超过计划
// 数量、工单状态不允许、卷数量超过报工良品、退料超过累计领用量）在这三个端点上映射为业务
// 冲突——409 加触发器的提示文字，不再落成 500。范围只限这三个端点：其余 SQLSTATE（唯一约束、
// 外键、CHECK 约束）与其余端点的行为不变，legacy 三条路由也不变；数据库触发器仍是权威。
import { assertStableCode, DomainError } from '@kingturf/domain';
import { guardRejection } from '../../pg-rejections.ts';
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

// TD-MFG-010：数据库触发器的业务拒绝（RAISE EXCEPTION → SQLSTATE P0001）→ 409 + 中文提示。
// 与询价 / 客户 / 信用端点同一口径（WF-A）：只认守卫触发器里写死的消息，映射成中文；不回显
// 数据库原始消息，未列入下方白名单的拒绝原样抛出（仍是 500，照常留诊断日志）。识别规则在
// pg-rejections.ts（guardRejection：SQLSTATE 精确为 P0001 且消息精确等于某个键）。
// 这里只列工单执行三条写路径上用户可纠正的拒绝；消息文字来自迁移里的触发器函数。
const EXECUTION_GUARD_HINTS = {
  'reported good quantity exceeds planned production quantity':
    '累计良品数量超过工单的计划数量，请核对本次报工的良品数',
  'production return exceeds cumulative issue for material resource':
    '退料数量超过该物料在本工单的累计领用量，请核对退料数量',
  'operation reporting requires an active order': '工单尚未开工，不能报工',
  'material posting requires a released or active order': '工单尚未下达，不能领料或退料',
  'production issue requires released BOM material': '该批次物料不属于工单的 BOM，不能领用',
  'inventory movement cannot create negative lot balance': '该批次库存不足，请核对领料数量',
  'operation report must belong to the production order': '报工记录与工单不匹配，请刷新后重试',
  'finished roll must match its report': '成品卷与报工记录不匹配，请核对卷数量',
  'finished roll must match order, report, item, lot, and reported quantity':
    '成品卷与工单、报工或批次不匹配，请核对后重试',
} as const;
// 只包住仓储调用的结果（调用本身仍是处理器里的直接调用）：触发器拒绝 → conflict，其余原样抛出。
const settled = async <T>(pending: Promise<T>): Promise<T> => {
  try {
    return await pending;
  } catch (error: unknown) {
    const hint = guardRejection(error, EXECUTION_GUARD_HINTS);
    if (hint === null) throw error;
    throw new DomainError('conflict', hint);
  }
};

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
      const reported = await settled(
        repo.reportOperation(orderId, input, context, scope.correlationId),
      );
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
    const posted = await settled(
      repo.transactMaterial(orderId, input, context, scope.correlationId),
    );
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
      const received = await settled(
        repo.createOutput(orderId, input, context, scope.correlationId),
      );
      void reply.code(201);
      return mutation(received, scope.authorization);
    },
  );
}
