// U3-PROC-4（ADR-0015）：goods-receipts 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listGoodsReceipts：投影/排序键 received_at DESC 与
// list('receipts') 一致，页对象形态；收货单为不可变事实（DB 触发器
// goods_receipt_immutable），无筛选/分页窗口——响应与 legacy 全量 { items } 逐字节
// 一致 + looseObject 透传 + Date 归一化）；GET 详情 = additive 只读
// （findGoodsReceipt：根行+批次行项+关联采购单数量核对）；POST 创建 = legacy
// procurementReceiptCreateRoutes 同解析链（部分收货/超收守护全在 legacy receive()
// 同链——ISSUED/PARTIALLY_RECEIVED 可续收、within_remaining 超收拒绝、批次/移动/
// 状态迁移逐字段守恒）。收货单不可变（无状态流转端点）；legacy 轨逐字不动。
// PROC-5（TD-PROC-001）：POST 创建上的守卫拒绝映射（见 RECEIPT_GUARD_HINTS）。
import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import { authorizeQuery } from '../../policy.ts';
import { guardRejection } from '../../pg-rejections.ts';
import {
  allow,
  array,
  jsonObject,
  objectBody,
  optionalCalendarDate,
  permittedDto,
  decimal,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { PermissionKey } from '@kingturf/types';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type GoodsReceiptRepository = Pick<
  NonNullable<ApiDependencies['procurement']>,
  'listGoodsReceipts' | 'findGoodsReceipt' | 'receive'
>;

// 行键为 pg to_jsonb 蛇形命名（legacy 同形态）；looseObject 透传 + .partial() 守恒口径。
const GOODS_RECEIPT_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    receipt_number: z.string(),
    purchase_order_id: z.string(),
    poNumber: z.string(),
    received_at: z.string(),
    source_reference: z.string(),
    lines: z.array(z.unknown()),
    created_at: z.string(),
  })
  .partial();
const listResponseSchema = z.object({
  items: z.array(GOODS_RECEIPT_ROW_SCHEMA),
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

// PROC-5（TD-PROC-001）：登记收货的最后一步是把采购单状态更新为 PARTIALLY_RECEIVED 或
// RECEIVED；迁移 0038 的守卫 guard_purchase_order_update 若拒绝这次状态迁移，会以 SQLSTATE
// P0001 抛出，此前一律落成 500。这里只认这个守卫里与「状态迁移」有关的三条消息（文字来自
// 迁移里的触发器函数），映射成 409 + 中文提示。同一个守卫里关于内容与签发的三条，以及收货行、
// 库存移动两个完整性触发器的消息不在白名单内：它们在收货路径上本不该出现，出现即缺陷，照旧
// 500 并留诊断日志。不回显数据库原始消息；识别规则在 pg-rejections.ts（guardRejection：
// SQLSTATE 精确为 P0001 且消息精确等于某个键）。
const RECEIPT_GUARD_HINTS = {
  'partially received purchase order has invalid transition':
    '采购单处于部分收货状态，只能继续收货、收齐或取消，不能改为其它状态；请刷新后查看采购单的最新状态',
  'issued purchase order has invalid transition':
    '已签发的采购单只能转为收货中、已收货或已取消，不能改为其它状态；请刷新后查看采购单的最新状态',
  'closed purchase order is immutable': '采购单已收货完成或已取消，不能再登记收货或修改',
} as const;

// 只包住仓储调用的结果（调用本身仍是处理器里的直接调用）：守卫拒绝 → conflict，其余原样抛出。
const settled = async <T>(pending: Promise<T>): Promise<T> => {
  try {
    return await pending;
  } catch (error: unknown) {
    const hint = guardRejection(error, RECEIPT_GUARD_HINTS);
    if (hint === null) throw error;
    throw new DomainError('conflict', hint);
  }
};

export function registerGoodsReceiptRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: GoodsReceiptRepository | null = scope.dependencies.procurement ?? null;
  const readFields = scope.authorization.permissions.get('procurement:read')?.fields;
  const requireRepository = (): GoodsReceiptRepository => {
    if (!repository)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  // GET 列表：视图轨迁移——响应与 legacy { items } 逐字节一致（收货单不可变事实）。
  app.get(
    '/api/v1/goods-receipts',
    { schema: { response: { 200: listResponseSchema } } },
    async () => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const result = await repo.listGoodsReceipts({
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      return {
        items: result.items.map((item) =>
          permittedDto(
            normalizeTimestamps(item as unknown as Record<string, unknown>),
            readFields ?? null,
          ),
        ),
      };
    },
  );

  // GET 详情：additive 只读（findGoodsReceipt，procurement:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/goods-receipts/:receiptId',
    { schema: { response: { 200: GOODS_RECEIPT_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const receiptId = uuid((request.params as { receiptId: string }).receiptId, 'receiptId');
      const found = await repo.findGoodsReceipt(receiptId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Goods receipt not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(
        normalizeTimestamps(found as unknown as Record<string, unknown>),
        readFields ?? null,
      );
    },
  );

  // POST 创建：legacy procurementReceiptCreateRoutes 同解析链（allow 五字段 →
  // authorizeQuery(Object.keys(body)) → lines 逐行解析（行 allow 六字段：purchaseOrder
  // LineId/lotNumber/locationCode/quantity/manufacturedAt/expiresAt，后两者经
  // Object.hasOwn 缺键=null 语义）→ 空数组拒绝 → stableCode/timestamp → 201 +
  // mutationDto(procurement:read)）——部分收货/超收守护全在 legacy receive() 同链。
  app.post('/api/v1/goods-receipts', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, ['receiptNumber', 'purchaseOrderId', 'receivedAt', 'sourceReference', 'lines']);
    const grant = authorizeQuery(scope.authorization, 'procurement:manage', Object.keys(body));
    const lines = array(body.lines, 'lines').map((entry, index) => {
      const line = jsonObject(entry, `lines[${String(index)}]`);
      allow(line, [
        'purchaseOrderLineId',
        'lotNumber',
        'locationCode',
        'quantity',
        'manufacturedAt',
        'expiresAt',
      ]);
      return {
        purchaseOrderLineId: uuid(line.purchaseOrderLineId, 'purchaseOrderLineId'),
        lotNumber: assertStableCode(string(line.lotNumber, 'lotNumber')),
        locationCode: assertStableCode(string(line.locationCode, 'locationCode')),
        quantity: decimal(line.quantity, 'quantity'),
        manufacturedAt: optionalCalendarDate(
          Object.hasOwn(line, 'manufacturedAt') ? line.manufacturedAt : null,
          'manufacturedAt',
        ),
        expiresAt: optionalCalendarDate(
          Object.hasOwn(line, 'expiresAt') ? line.expiresAt : null,
          'expiresAt',
        ),
      };
    });
    if (!lines.length)
      throw Object.assign(new Error('lines must not be empty'), { statusCode: 400 });
    const input = {
      receiptNumber: assertStableCode(string(body.receiptNumber, 'receiptNumber')),
      purchaseOrderId: uuid(body.purchaseOrderId, 'purchaseOrderId'),
      receivedAt: timestamp(body.receivedAt, 'receivedAt'),
      sourceReference: string(body.sourceReference, 'sourceReference'),
      lines,
    };
    const created = await settled(
      repo.receive(
        input,
        { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
        scope.correlationId,
      ),
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'procurement:read');
  });
}
