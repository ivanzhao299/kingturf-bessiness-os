// U3-PROC-2（ADR-0015）：procurement-rfqs 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listRfqs：投影/排序键与 list('rfqs') 一致 + status 筛选；
// legacy RFQ 列表无查询参数，无参数时响应与 legacy 全量 { items } 逐字节一致，
// looseObject 透传 + Date 归一化——COM 同款守恒口径）；GET 详情 = additive 只读
// （findRfq：根行+行项+报价对比）；POST 创建 = legacy procurementRfqCreateRoutes
// 同解析链；PUT state = 现代化统一动作端点（action issue 分派 legacy issueRfq 同链；
// action close 走 additive closeRfq——主协调 U3-PROC-2 指令明授的新写路径）。
// legacy POST /:id/issue 轨逐字不动（双轨并行）。
import { z } from 'zod';
import { assertStableCode } from '@kingturf/domain';
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
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { RfqListFilter } from '../../procurement-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { PermissionKey } from '@kingturf/types';

export type { RfqListFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type RfqRepository = Pick<
  NonNullable<ApiDependencies['procurement']>,
  'listRfqs' | 'findRfq' | 'createRfq' | 'issueRfq' | 'closeRfq'
>;

// 行键为 pg to_jsonb 蛇形命名（legacy 同形态）；looseObject 透传 + .partial() 守恒口径。
const RFQ_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    rfq_number: z.string(),
    status: z.string(),
    response_due_at: z.string(),
    currency: z.string(),
    issued_at: z.string().nullable(),
    lines: z.array(z.unknown()),
    created_at: z.string(),
  })
  .partial();
const listQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
});
const listResponseSchema = z.object({
  items: z.array(RFQ_ROW_SCHEMA),
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

export function registerRfqRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: RfqRepository | null = scope.dependencies.procurement ?? null;
  const readFields = scope.authorization.permissions.get('procurement:read')?.fields;
  const requireRepository = (): RfqRepository => {
    if (!repository)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；status 筛选
  // 为 additive 能力（procurement:read 授权同轨）。
  app.get(
    '/api/v1/procurement-rfqs',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const query = request.query;
      const filter: RfqListFilter = query.status === undefined ? {} : { status: query.status };
      const result = await repo.listRfqs(
        { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
        filter,
      );
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

  // GET 详情：additive 只读（findRfq，procurement:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/procurement-rfqs/:rfqId',
    { schema: { response: { 200: RFQ_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const rfqId = uuid((request.params as { rfqId: string }).rfqId, 'rfqId');
      const found = await repo.findRfq(rfqId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'RFQ not found',
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

  // POST 创建：legacy procurementRfqCreateRoutes 同解析链（allow 五字段 →
  // authorizeQuery(Object.keys(body)) → lines 逐行解析/空数组拒绝 → 标量解析 →
  // 201 + mutationDto(procurement:read)）——解析顺序与消息逐字一致。
  app.post('/api/v1/procurement-rfqs', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, ['rfqNumber', 'responseDueAt', 'currency', 'lines', 'issue']);
    const grant = authorizeQuery(scope.authorization, 'procurement:manage', Object.keys(body));
    const lines = array(body.lines, 'lines').map((entry, index) => {
      const line = jsonObject(entry, `lines[${String(index)}]`);
      allow(line, ['itemVersionId', 'quantity', 'requiredAt']);
      return {
        itemVersionId: uuid(line.itemVersionId, 'itemVersionId'),
        quantity: decimal(line.quantity, 'quantity'),
        requiredAt: calendarDate(line.requiredAt, 'requiredAt'),
      };
    });
    if (!lines.length)
      throw Object.assign(new Error('lines must not be empty'), { statusCode: 400 });
    const input = {
      rfqNumber: assertStableCode(string(body.rfqNumber, 'rfqNumber')),
      responseDueAt: timestamp(body.responseDueAt, 'responseDueAt'),
      currency: currency(body.currency),
      lines,
      issue: body.issue === true,
    };
    const created = await repo.createRfq(
      input,
      {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'procurement:read');
  });

  // PUT 状态流转：现代化统一动作端点——action issue 分派 legacy issueRfq 同链
  // （DRAFT→ISSUED）；action close 走 additive closeRfq（DRAFT/ISSUED→CANCELLED，
  // 主协调 U3-PROC-2 指令明授）。legacy POST /:id/issue 轨保留并行。
  app.put('/api/v1/procurement-rfqs/:rfqId/state', async (request, reply) => {
    const repo = requireRepository();
    const rfqId = uuid((request.params as { rfqId: string }).rfqId, 'rfqId');
    const body = objectBody(request.body);
    const action = string(body.action, 'action');
    if (action !== 'issue' && action !== 'close')
      throw Object.assign(new Error('action must be issue or close'), { statusCode: 400 });
    const grant = authorizeQuery(scope.authorization, 'procurement:manage');
    const scopeContext = {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: grant.anchors,
    };
    const result =
      action === 'issue'
        ? await repo.issueRfq(rfqId, scopeContext, scope.correlationId)
        : await repo.closeRfq(rfqId, scopeContext, scope.correlationId);
    void reply.code(200);
    return mutation(result, scope.authorization, 'procurement:read');
  });
}
