// FIN-1（ADR-0015）：ar-open-items 域 Fastify 端点组。
// GET 列表 = 旧轨同链 + 加性筛选。未带加性参数（state=NOT_DUE / search）时直接分派 legacy
// listOperationalPage('ar', …)——与旧轨同一条 SQL、同一份代码（默认无参 = limit 50 窗口，
// 响应 { items, nextCursor } 与旧轨解析后逐键一致）；legacy 查询参数（state / minAmount /
// maxAmount / limit / cursor / query / from / to）沿用 qtc-operational-reads.ts 的解析链、
// 校验顺序与消息。带加性参数时走 additive listArPage（同一组过滤子句 + NOT_DUE 与
// 单据号 / 客户 / 订单号关键字）。
// GET /:id = additive 只读详情：根行（同投影）+ 关联销售订单摘要（sales-order:read 门控）+
// 核销分配记录（收款侧字段按 bank-payment:read 门控，未授权不触碰收款表）。
// POST = legacy qtcArPostRoutes 同解析链（负例消息逐字一致）；legacy 轨逐字保留（双轨并行）。
// 守卫触发器拒绝（SQLSTATE P0001）按白名单映射为 409 + 中文（write-rejection-mapping.ts；
// 未列入的保持 500 并留诊断日志，不回显数据库原文）。
import { z } from 'zod';
import { DomainError } from '@kingturf/domain';
import type { JsonObject, OperationalListFilter, Page, PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../../app.ts';
import {
  allow,
  currency,
  decimal,
  idempotency,
  integer,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import type { ArDetailParts, ArListState, ArPageFilter } from '../../qtc-read-repositories.ts';
import { asArDocumentGuard } from '../../write-rejection-mapping.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ArRepository = Pick<
  NonNullable<ApiDependencies['quoteToCash']>,
  'listOperationalPage' | 'listArPage' | 'findArOpenItem' | 'postAr'
>;
type Post = ArRepository['postAr'];
type PostInput = Readonly<Parameters<Post>[0]>;

const STATES: readonly string[] = ['OPEN', 'CLEARED', 'OVERDUE', 'NOT_DUE'];
const ADDITIVE_STATE: ArListState = 'NOT_DUE';
const SEARCH_MAX = 100;

// 行键为 pg to_jsonb 蛇形命名 + 列表头列驼峰键（legacy 同形态）+ 加性驼峰键（金额为十进制
// 文本）；looseObject 透传 + .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const AR_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    ar_document_id: z.string(),
    customer_id: z.string(),
    currency: z.string(),
    original_amount: z.number(),
    due_at: z.string(),
    created_at: z.string(),
    remaining_amount: z.number(),
    documentNumber: z.string(),
    documentType: z.string(),
    salesOrderId: z.string().nullable(),
    customerName: z.string().nullable(),
    orderNumber: z.string().nullable(),
    postedAt: z.string(),
    originalAmount: z.string(),
    appliedAmount: z.string(),
    remainingAmount: z.string(),
    overdueDays: z.number(),
    agingState: z.string(),
  })
  .partial();
const listResponseSchema = z.object({
  items: z.array(AR_ROW_SCHEMA),
  nextCursor: z.string().nullable().optional(),
});
const detailSchema = AR_ROW_SCHEMA.extend({
  order: z
    .looseObject({
      id: z.string(),
      orderNumber: z.string(),
      status: z.string(),
      currency: z.string(),
      total: z.string(),
      createdAt: z.string(),
    })
    .partial()
    .nullable(),
  allocations: z.array(
    z
      .looseObject({
        id: z.string(),
        amount: z.string(),
        currency: z.string(),
        allocationOrder: z.number(),
        createdAt: z.string(),
        reconciliationRunId: z.string().nullable(),
        bankPaymentId: z.string(),
        bankReference: z.string(),
        paymentReceivedAt: z.string(),
      })
      .partial(),
  ),
}).partial();
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

// 列表查询解析结果：window 为 legacy 过滤实参（键序 limit / cursor / query / from / to /
// minAmount / maxAmount，与 legacy 同序）；state / search 为加性筛选（null / 空串 = 未传）。
type ArListQuery = Readonly<{
  window: Omit<ArPageFilter, 'state' | 'search'>;
  state: ArListState | null;
  search: string;
}>;

// legacy 查询参数解析：与 qtc-operational-reads.ts 同解析链、同校验顺序、同消息（state 多接受
// 加性取值 NOT_DUE；加性 search 排在 legacy 参数之后校验，空白视为未传，超长 400）。
const parseListQuery = (query: Readonly<Record<string, unknown>>): ArListQuery => {
  const state = query.state;
  if (state && !STATES.includes(state as string))
    throw new DomainError('invalid_request', 'state is unsupported');
  const minimum = query.minAmount ? decimal(query.minAmount, 'minAmount') : undefined;
  const maximum = query.maxAmount ? decimal(query.maxAmount, 'maxAmount') : undefined;
  if (minimum && maximum && Number(minimum) > Number(maximum))
    throw new DomainError('invalid_request', 'minAmount must not exceed maxAmount');
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > SEARCH_MAX)
    throw new DomainError('invalid_request', `search exceeds ${String(SEARCH_MAX)} characters`);
  return {
    state: state ? (state as ArListState) : null,
    search,
    window: {
      limit: query.limit ? integer(Number(query.limit), 'limit', 1, 100) : 50,
      ...(query.cursor ? { cursor: uuid(query.cursor, 'cursor') } : {}),
      ...(query.query ? { query: string(query.query, 'query') } : {}),
      ...(query.from ? { from: timestamp(query.from, 'from') } : {}),
      ...(query.to ? { to: timestamp(query.to, 'to') } : {}),
      ...(minimum ? { minAmount: minimum } : {}),
      ...(maximum ? { maxAmount: maximum } : {}),
    },
  };
};

const envelope = (page: Page<JsonObject>, fields: readonly string[] | null) => ({
  items: page.items.map((item) => permittedDto(item, fields)),
  nextCursor: page.nextCursor,
});

export function registerArOpenItemRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ArRepository | null = scope.dependencies.quoteToCash ?? null;
  const readFields = scope.authorization.permissions.get('ar:read')?.fields;
  const requireRepository = (): ArRepository => {
    if (!repository)
      throw Object.assign(new Error('QuoteToCash dependency unavailable'), { statusCode: 503 });
    return repository;
  };
  // 能力键 → 作用域上下文（legacy 各路由的 scopeContext 同式：actor + grant.scopes + grant.anchors）。
  const scoped = (capability: PermissionKey, keys?: readonly string[]) => {
    const grant = authorizeQuery(scope.authorization, capability, keys);
    return { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
  };

  // GET 列表：未带加性参数时与 legacy GET 同链（listOperationalPage('ar', filter, scope)）。
  app.get(
    '/api/v1/ar-open-items',
    { schema: { response: { 200: listResponseSchema } } },
    async (request) => {
      // 与 legacy 同序：授权先于任何查询值、仓储方法与 actor 的读取。
      const context = scoped('ar:read');
      const query = parseListQuery((request.query ?? {}) as Readonly<Record<string, unknown>>);
      const repo = requireRepository();
      if (query.search !== '' || query.state === ADDITIVE_STATE) {
        const page = await repo.listArPage(context, {
          ...query.window,
          ...(query.state === null ? {} : { state: query.state }),
          ...(query.search === '' ? {} : { search: query.search }),
        });
        return envelope(page, readFields ?? null);
      }
      // 加性参数未生效：旧轨同链。此处 state 只可能是 legacy 三取值之一。
      const state: OperationalListFilter['state'] =
        query.state === 'OPEN' || query.state === 'CLEARED' || query.state === 'OVERDUE'
          ? query.state
          : undefined;
      const page = await repo.listOperationalPage(
        'ar',
        { ...query.window, ...(state === undefined ? {} : { state }) },
        context,
      );
      return envelope(page, readFields ?? null);
    },
  );

  // GET 详情：additive 只读（ar:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/ar-open-items/:arOpenItemId',
    { schema: { response: { 200: detailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const context = scoped('ar:read');
      const arOpenItemId = uuid(
        (request.params as { arOpenItemId: string }).arOpenItemId,
        'arOpenItemId',
      );
      const parts: ArDetailParts = {
        order: scope.authorization.permissions.has('sales-order:read'),
        payment: scope.authorization.permissions.has('bank-payment:read'),
      };
      const found = await requireRepository().findArOpenItem(arOpenItemId, context, parts);
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'AR open item not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(found, readFields ?? null);
    },
  );

  // POST 过账：legacy qtcArPostRoutes 同解析链（objectBody → allow 七字段 → documentType
  // 枚举 → uuid / string / currency / decimal / timestamp → 幂等键 → ar:post 授权 →
  // 201 + mutationDto(ar:read)）。
  app.post('/api/v1/ar-open-items', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, [
      'customerId',
      'salesOrderId',
      'documentNumber',
      'documentType',
      'currency',
      'amount',
      'dueAt',
    ]);
    const documentType = string(body.documentType, 'documentType');
    if (!['INVOICE', 'CREDIT_NOTE'].includes(documentType))
      throw new DomainError('invalid_request', 'documentType is unsupported');
    const repo = requireRepository();
    const input: PostInput = {
      customerId: uuid(body.customerId, 'customerId'),
      salesOrderId: body.salesOrderId === null ? null : uuid(body.salesOrderId, 'salesOrderId'),
      documentNumber: string(body.documentNumber, 'documentNumber'),
      documentType: documentType as PostInput['documentType'],
      currency: currency(body.currency),
      amount: decimal(body.amount, 'amount'),
      dueAt: timestamp(body.dueAt, 'dueAt'),
    };
    const key = idempotency(request as unknown as ApiRequest);
    const context = scoped('ar:post', Object.keys(body));
    let result: Record<string, unknown>;
    try {
      result = await repo.postAr(input, key, context, scope.correlationId);
    } catch (error: unknown) {
      throw asArDocumentGuard(error);
    }
    void reply.code(201);
    return mutation(result, scope.authorization);
  });
}

// 与 legacy mutationDto(ar:read) 同口径（按读权限字段裁剪写响应）。
function mutation(
  value: Record<string, unknown>,
  authorization: FastifyRouteScope['authorization'],
): Record<string, unknown> {
  const read = authorization.permissions.get('ar:read');
  return permittedDto(value, read ? read.fields : ['version']);
}
