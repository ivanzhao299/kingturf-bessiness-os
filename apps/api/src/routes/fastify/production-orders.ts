// U3-MFG-4（ADR-0015）：production-orders 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listProductionOrderPage additive keyset——排序键
// (created_at DESC, id DESC) 与 legacy list 一致；state 筛选 + query 关键字；limit 不设
// 默认值——无查询参数时与 legacy list 走同一条 SQL，响应与 legacy 全量 { items } 逐字节
// 一致（无 nextCursor 键），显式 limit（1..100）才附 nextCursor）；GET 详情 = additive
// 只读（findProductionOrder：根行 + 工序进度 + 报工时间线 + 物料需求与分配状态——后者
// 按 bom:read 门控，未授权不查询）；POST 创建 = legacy productionOrderCreateRoutes 同解析
// 链（负例消息逐字一致）；PUT /:id/state = 现代化统一动作端点，分派 legacy transition
// 同链——动作集与 legacy production-order-commands.ts 的 commands 表逐一对应（目标状态
// 与能力键同值），写路径已存在，零新写语义；legacy POST /:id/<command> 轨逐字不动
//（双轨并行）。
import { z } from 'zod';
import { assertStableCode } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../../app.ts';
import {
  allow,
  calendarDate,
  decimal,
  jsonObject,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../app-values.ts';
import type { ProductionOrderPageFilter } from '../../production-read-repositories.ts';
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

export type { ProductionOrderPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ProductionOrderRepository = Pick<
  NonNullable<ApiDependencies['production']>,
  'listProductionOrderPage' | 'findProductionOrder' | 'create' | 'transition'
>;

type Create = ProductionOrderRepository['create'];
type CreateInput = Readonly<Parameters<Create>[0]>;
type Transition = ProductionOrderRepository['transition'];
type TransitionState = Parameters<Transition>[1];
type TransitionInput = Readonly<Parameters<Transition>[2]>;

// 与 legacy production-order-commands.ts 的 commands 表逐一对应（动作 → 目标状态 +
// 能力键）；前态约束全部在 DB 触发器 validate_production_order_event（迁移 0042）。
const ACTIONS = {
  release: { state: 'RELEASED', capability: 'production:plan' },
  start: { state: 'IN_PROGRESS', capability: 'production:report' },
  complete: { state: 'COMPLETED', capability: 'production:close' },
  close: { state: 'CLOSED', capability: 'production:close' },
  cancel: { state: 'CANCELLED', capability: 'production:close' },
} as const satisfies Readonly<
  Record<string, Readonly<{ state: TransitionState; capability: PermissionKey }>>
>;
type ActionName = keyof typeof ACTIONS;
const actionOf = (value: string): Readonly<(typeof ACTIONS)[ActionName]> | null =>
  Object.hasOwn(ACTIONS, value) ? ACTIONS[value as ActionName] : null;

const ORDER_STATES = [
  'DRAFT',
  'RELEASED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
] as const;

// 行键为 pg to_jsonb 蛇形命名 + 列表头列驼峰键（legacy 同形态）；looseObject 透传 +
// .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const ORDER_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    order_number: z.string(),
    item_version_id: z.string(),
    routing_version_id: z.string(),
    mrp_proposal_id: z.string().nullable(),
    planned_quantity: z.number(),
    planned_start_at: z.string(),
    planned_due_at: z.string(),
    source_reference: z.string(),
    created_by: z.string(),
    created_at: z.string(),
    sku: z.string(),
    itemName: z.string(),
    state: z.string(),
    stateSequence: z.number(),
    operations: z.array(z.unknown()),
    materials: z.array(z.unknown()),
    reports: z.array(z.unknown()),
    rolls: z.array(z.unknown()),
    events: z.array(z.unknown()),
  })
  .partial();
const listQuerySchema = z.object({
  // 生效状态筛选（production_order_effective_states）。
  state: z.enum(ORDER_STATES).optional(),
  // 工单号/产品 SKU/名称关键字（服务端过滤，trim 后 1..100 字符）。
  query: z.string().trim().min(1).max(100).optional(),
  // 不设默认值：legacy 工单列表为全量（行为守恒）；显式传入才启用分页窗口。
  limit: z.coerce.number().int().min(1).max(100).optional(),
  // 末行工单 id（不透明令牌）。
  cursor: z.string().trim().min(1).max(64).optional(),
});
const listResponseSchema = z.object({
  items: z.array(ORDER_ROW_SCHEMA),
  nextCursor: z.string().optional(),
});
// 详情：根行（list 同投影）+ additive 三聚合；全部 partial 以兼容字段裁剪。
const OPERATION_PROGRESS_SCHEMA = z
  .looseObject({
    id: z.string(),
    sequence: z.number(),
    operationCode: z.string(),
    operationName: z.string(),
    workCenter: z.string(),
    plannedQuantity: z.number(),
    reportedGoodQuantity: z.number(),
    reportedScrapQuantity: z.number(),
    reportCount: z.number(),
    laborMinutes: z.number(),
    machineMinutes: z.number(),
    completed: z.boolean(),
  })
  .partial();
const REPORT_TIMELINE_SCHEMA = z
  .looseObject({
    id: z.string(),
    productionOrderOperationId: z.string(),
    sequence: z.number(),
    operationCode: z.string(),
    operationName: z.string(),
    goodQuantity: z.number(),
    scrapQuantity: z.number(),
    laborMinutes: z.number(),
    machineMinutes: z.number(),
    startedAt: z.string(),
    completedAt: z.string(),
    notes: z.string(),
    operatorId: z.string(),
    createdAt: z.string(),
  })
  .partial();
const MATERIAL_REQUIREMENT_SCHEMA = z
  .looseObject({
    lineNumber: z.number(),
    componentItemVersionId: z.string(),
    sku: z.string(),
    itemName: z.string(),
    itemType: z.string(),
    baseUnitCode: z.string(),
    bomQuantity: z.number(),
    scrapBasisPoints: z.number(),
    bomOutputQuantity: z.number(),
    plannedQuantity: z.number(),
    actualQuantity: z.number(),
    allocationStatus: z.string(),
  })
  .partial();
const detailSchema = ORDER_ROW_SCHEMA.extend({
  operationProgress: z.array(OPERATION_PROGRESS_SCHEMA),
  reportTimeline: z.array(REPORT_TIMELINE_SCHEMA),
  materialRequirements: z.array(MATERIAL_REQUIREMENT_SCHEMA).optional(),
}).partial();
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

// 与 legacy mutationDto(production:read) 同口径（按读权限字段裁剪写响应）。
function mutation(
  value: Record<string, unknown>,
  authorization: FastifyRouteScope['authorization'],
): Record<string, unknown> {
  const read = authorization.permissions.get('production:read');
  return permittedDto(value, read ? read.fields : ['version']);
}

export function registerProductionOrderRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ProductionOrderRepository | null = scope.dependencies.production ?? null;
  const readFields = scope.authorization.permissions.get('production:read')?.fields;
  const requireRepository = (): ProductionOrderRepository => {
    if (!repository)
      throw Object.assign(new Error('Production dependency unavailable'), { statusCode: 503 });
    return repository;
  };
  const scoped = (capability: PermissionKey, keys?: readonly string[]) => {
    const grant = authorizeQuery(scope.authorization, capability, keys);
    return { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；显式 limit 时附
  // nextCursor（末行工单 id）。
  app.get(
    '/api/v1/production-orders',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const context = scoped('production:read');
      const query = request.query;
      const filter: ProductionOrderPageFilter = {
        ...(query.state === undefined ? {} : { state: query.state }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const result = await repo.listProductionOrderPage(context, filter);
      return {
        items: result.items.map((item) => permittedDto(item, readFields ?? null)),
        ...(result.nextCursor === null ? {} : { nextCursor: result.nextCursor }),
      };
    },
  );

  // GET 详情：additive 只读（production:read + 字段裁剪同读轨；物料需求按 bom:read 门控）。
  app.get(
    '/api/v1/production-orders/:productionOrderId',
    { schema: { response: { 200: detailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const context = scoped('production:read');
      const orderId = uuid(
        (request.params as { productionOrderId: string }).productionOrderId,
        'productionOrderId',
      );
      const found = await repo.findProductionOrder(orderId, context, {
        materialRequirements: scope.authorization.permissions.has('bom:read'),
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Production order not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(found, readFields ?? null);
    },
  );

  // POST 创建：legacy productionOrderCreateRoutes 同解析链（allow 八字段 →
  // stableCode/uuid/decimal/calendarDate → 201 + mutationDto(production:read)）。
  app.post('/api/v1/production-orders', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'orderNumber',
      'itemVersionId',
      'routingVersionId',
      'mrpProposalId',
      'plannedQuantity',
      'plannedStartAt',
      'plannedDueAt',
      'sourceReference',
    ]);
    const context = scoped('production:plan', Object.keys(body));
    const input: CreateInput = {
      orderNumber: assertStableCode(string(body.orderNumber, 'orderNumber')),
      itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
      routingVersionId: uuid(body.routingVersionId, 'routingVersionId'),
      ...(body.mrpProposalId === undefined
        ? {}
        : { mrpProposalId: uuid(body.mrpProposalId, 'mrpProposalId') }),
      plannedQuantity: decimal(body.plannedQuantity, 'plannedQuantity'),
      plannedStartAt: calendarDate(body.plannedStartAt, 'plannedStartAt'),
      plannedDueAt: calendarDate(body.plannedDueAt, 'plannedDueAt'),
      sourceReference: assertStableCode(string(body.sourceReference, 'sourceReference')),
    };
    const created = await repo.create(input, context, scope.correlationId);
    void reply.code(201);
    return mutation(created, scope.authorization);
  });

  // PUT 状态流转：现代化统一动作端点——action ∈ release/start/complete/close/cancel，
  // 逐一分派 legacy transition 同链（与 legacy POST /:id/<command> 同一目标状态、能力键
  // 与载荷形状）。
  app.put('/api/v1/production-orders/:productionOrderId/state', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, ['action', 'reason', 'evidence', 'idempotencyKey']);
    const action = actionOf(string(body.action, 'action'));
    if (!action)
      throw Object.assign(
        new Error('action must be one of release, start, complete, close, cancel'),
        { statusCode: 400 },
      );
    const context = scoped(action.capability, Object.keys(body));
    const orderId = uuid(
      (request.params as { productionOrderId: string }).productionOrderId,
      'productionOrderId',
    );
    const input: TransitionInput = {
      reason: string(body.reason, 'reason'),
      evidence: jsonObject(body.evidence ?? {}, 'evidence'),
      idempotencyKey: assertStableCode(string(body.idempotencyKey, 'idempotencyKey')),
    };
    const result = await repo.transition(
      orderId,
      action.state,
      input,
      context,
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(result, scope.authorization);
  });
}
