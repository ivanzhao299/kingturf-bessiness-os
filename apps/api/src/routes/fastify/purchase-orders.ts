// U3-PROC-3（ADR-0015）：purchase-orders 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listPurchaseOrders：投影/排序键与 list('orders') 一致，页
// 对象形态 nextCursor 恒 null；无参数时响应与 legacy 全量 { items } 逐字节一致 +
// status 筛选 additive；looseObject 透传 + Date 归一化）；GET 详情 = additive 只读
// （findPurchaseOrder：根行+行项含收货状态+关联收货单）；POST 创建 = legacy
// procurementPurchaseOrderCreateRoutes 同解析链；PUT state = 现代化统一动作端点
// （action issue 分派 legacy issuePurchaseOrder 同链；action cancel 走 additive
// cancelPurchaseOrder——指令授权的合法迁移；独立审批层缺失登记 TD-PROC-003）。
// legacy POST /:id/issue 轨逐字不动（双轨并行）。
import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import { guardRejection, isCheckViolation } from '../../pg-rejections.ts';
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  array,
  calendarDate,
  currency,
  decimal,
  jsonObject,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../app-values.ts';
import type { RfqListFilter } from '../../procurement-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { PermissionKey } from '@kingturf/types';

export type { RfqListFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type PurchaseOrderRepository = Pick<
  NonNullable<ApiDependencies['procurement']>,
  | 'listPurchaseOrders'
  | 'findPurchaseOrder'
  | 'withMrpOrigins'
  | 'createPurchaseOrder'
  | 'issuePurchaseOrder'
  | 'cancelPurchaseOrder'
>;

// 行键为 pg to_jsonb 蛇形命名（legacy 同形态）；looseObject 透传 + .partial() 守恒口径。
const PURCHASE_ORDER_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    po_number: z.string(),
    status: z.string(),
    currency: z.string(),
    supplierName: z.string(),
    ordered_at: z.string().nullable(),
    mrp_proposal_id: z.string().nullable(),
    mrpProposalNumber: z.string().optional(),
    mrp_run_id: z.string().optional(),
    lines: z.array(z.unknown()),
    created_at: z.string(),
  })
  .partial();
const listQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
});
const listResponseSchema = z.object({
  items: z.array(PURCHASE_ORDER_ROW_SCHEMA),
});
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

// pg 将 timestamp 列解析为 Date 对象；legacy 轨经 JSON.stringify 隐式转 ISO 串，
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

// 与 legacy mutationDto(procurement:read) 同口径。
function mutation(
  value: Record<string, unknown>,
  authorization: FastifyRouteScope['authorization'],
  readCapability: PermissionKey,
): Record<string, unknown> {
  const read = authorization.permissions.get(readCapability);
  if (!read) return permitted(value, ['version']);
  return permitted(value, read.fields);
}

function permitted(row: Record<string, unknown>, fields: readonly string[] | null) {
  if (fields === null) return row;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => visible.has(key)));
}

// TD-PROC-015：只在采购单状态端点映射已知守卫/检查拒绝；原始数据库消息不回显。
const PURCHASE_ORDER_GUARD_HINTS = {
  'purchase order content is immutable': '采购订单内容不可变更，只能执行允许的状态动作',
  'draft purchase order can only be issued or cancelled': '草稿采购订单只能签发或取消',
  'issued purchase order has invalid transition': '已签发采购订单不能执行此状态动作',
  'partially received purchase order has invalid transition':
    '部分收货的采购订单不能执行此状态动作',
  'closed purchase order is immutable': '已收货或已取消的采购订单不可再变更',
  'purchase order issue requires timestamp and lines': '采购订单没有行项，不能签发',
} as const;
const purchaseOrderStateResult = async <T>(pending: Promise<T>): Promise<T> => {
  try {
    return await pending;
  } catch (error: unknown) {
    const hint = guardRejection(error, PURCHASE_ORDER_GUARD_HINTS);
    if (hint !== null) throw new DomainError('conflict', hint);
    if (isCheckViolation(error, 'purchase_orders_check'))
      throw new DomainError('conflict', '采购单尚未签发，当前数据库规则不允许取消未签发的采购单');
    throw error;
  }
};

export function registerPurchaseOrderRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: PurchaseOrderRepository | null = scope.dependencies.procurement ?? null;
  const readFields = scope.authorization.permissions.get('procurement:read')?.fields;
  const requireRepository = (): PurchaseOrderRepository => {
    if (!repository)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  const originsOf = async (
    repo: PurchaseOrderRepository,
    items: readonly import('@kingturf/types').JsonObject[],
  ) => {
    const grant = scope.authorization.permissions.get('mrp:read');
    if (
      items.length === 0 ||
      grant?.fields !== null ||
      (!grant.scopes.includes('COMPANY') && !grant.scopes.includes('GROUP'))
    )
      return items;
    return repo.withMrpOrigins(items, {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: scope.authorization.scopeAnchors?.get('mrp:read') ?? [],
    });
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；status 筛选
  // 为 additive 能力（procurement:read 授权同轨）。
  app.get(
    '/api/v1/purchase-orders',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const query = request.query;
      const filter: RfqListFilter = query.status === undefined ? {} : { status: query.status };
      const result = await repo.listPurchaseOrders(
        { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
        filter,
      );
      return {
        items: (await originsOf(repo, result.items)).map((item) =>
          permittedDto(
            normalizeTimestamps(item as unknown as Record<string, unknown>),
            readFields ?? null,
          ),
        ),
      };
    },
  );

  // GET 详情：additive 只读（findPurchaseOrder，procurement:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/purchase-orders/:orderId',
    { schema: { response: { 200: PURCHASE_ORDER_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const orderId = uuid((request.params as { orderId: string }).orderId, 'orderId');
      const found = await repo.findPurchaseOrder(orderId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Purchase order not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(
        normalizeTimestamps(
          (await originsOf(repo, [found]))[0] as unknown as Record<string, unknown>,
        ),
        readFields ?? null,
      );
    },
  );

  // POST 创建：legacy procurementPurchaseOrderCreateRoutes 同解析链（allow 六字段 →
  // authorizeQuery(Object.keys(body)) → lines 逐行解析（行 allow 四字段）→ 空数组
  // 拒绝 → stableCode/supplierId/supplierQuoteId 可空/currency/issue===true → 201 +
  // mutationDto(procurement:read)）——解析顺序与消息逐字一致。
  app.post('/api/v1/purchase-orders', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'poNumber',
      'supplierId',
      'supplierQuoteId',
      'mrpProposalId',
      'currency',
      'lines',
      'issue',
    ]);
    const grant = authorizeQuery(scope.authorization, 'procurement:manage', Object.keys(body));
    const lines = array(body.lines, 'lines').map((entry, index) => {
      const line = jsonObject(entry, `lines[${String(index)}]`);
      allow(line, ['itemVersionId', 'quantity', 'unitPrice', 'requiredAt']);
      return {
        itemVersionId: uuid(line.itemVersionId, 'itemVersionId'),
        quantity: decimal(line.quantity, 'quantity'),
        unitPrice: decimal(line.unitPrice, 'unitPrice'),
        requiredAt: calendarDate(line.requiredAt, 'requiredAt'),
      };
    });
    if (!lines.length)
      throw Object.assign(new Error('lines must not be empty'), { statusCode: 400 });
    const input = {
      poNumber: assertStableCode(string(body.poNumber, 'poNumber')),
      supplierId: uuid(body.supplierId, 'supplierId'),
      supplierQuoteId:
        body.supplierQuoteId === null || body.supplierQuoteId === undefined
          ? null
          : uuid(body.supplierQuoteId, 'supplierQuoteId'),
      ...(body.mrpProposalId === undefined
        ? {}
        : { mrpProposalId: uuid(body.mrpProposalId, 'mrpProposalId') }),
      currency: currency(body.currency),
      lines,
      issue: body.issue === true,
    };
    const created = await repo.createPurchaseOrder(
      input,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'procurement:read');
  });

  // PUT 状态流转：现代化统一动作端点——action issue 分派 legacy issuePurchaseOrder
  // 同链（DRAFT→ISSUED）；action cancel 走 additive cancelPurchaseOrder（DRAFT/
  // ISSUED→CANCELLED；独立审批层缺失登记 TD-PROC-003）。legacy POST /:id/issue 轨
  // 保留并行。
  app.put('/api/v1/purchase-orders/:orderId/state', async (request, reply) => {
    const repo = requireRepository();
    const orderId = uuid((request.params as { orderId: string }).orderId, 'orderId');
    const body = objectBody(request.body);
    const action = string(body.action, 'action');
    if (action !== 'issue' && action !== 'cancel')
      throw Object.assign(new Error('action must be issue or cancel'), { statusCode: 400 });
    const grant = authorizeQuery(scope.authorization, 'procurement:manage');
    const scopeContext = {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: grant.anchors,
    };
    const result = await purchaseOrderStateResult(
      action === 'issue'
        ? repo.issuePurchaseOrder(orderId, scopeContext, scope.correlationId)
        : repo.cancelPurchaseOrder(orderId, scopeContext, scope.correlationId),
    );
    void reply.code(200);
    return mutation(result, scope.authorization, 'procurement:read');
  });
}
