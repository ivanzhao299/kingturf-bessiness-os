// U3-MFG-3（ADR-0015）：manufacturing-routings 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listRoutingPage additive keyset——(code,version) 排序键与
// list('routings') 一致；status/query/productType 筛选；legacy 工艺路线列表无 LIMIT，
// 故 limit 不设默认值——无查询参数时响应与 legacy 全量 { items } 逐字节一致（无
// nextCursor 键），显式 limit（1..100）才附 nextCursor；looseObject 透传 + Date 归一
// 化）；GET 详情 = additive 只读（findRouting：根行 + 产品信息 + 全部版本（工序按
// sequence 升序）——顺序步骤视图数据源）；POST 创建 = legacy
// manufacturingRoutingCreateRoutes 同解析链（负例消息逐字一致）；PUT /:id/publish =
// 现代化统一动作端点，分派 legacy publish('routing') 同链（写路径已存在——零新写
// 语义；legacy POST /manufacturing-routing-versions/:id/publish 轨逐字不动，双轨并行）。
import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../../app.ts';
import {
  allow,
  array,
  decimal,
  integer,
  jsonObject,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { RoutingPageFilter } from '../../manufacturing-read-repositories.ts';
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

export type { RoutingPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ManufacturingRoutingRepository = Pick<
  NonNullable<ApiDependencies['manufacturing']>,
  'listRoutingPage' | 'findRouting' | 'createRouting' | 'publish'
>;

const VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;
const PRODUCT_TYPES = ['FINISHED_GOOD', 'SEMI_FINISHED'] as const;

// 行键为 pg to_jsonb 蛇形命名 + 路线头列驼峰键（legacy 同形态）；looseObject 透传 +
// .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const ROUTING_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    routing_id: z.string(),
    version: z.number(),
    status: z.string(),
    product_item_version_id: z.string(),
    effective_at: z.string(),
    canonical_hash: z.string(),
    published_at: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    routingId: z.string(),
    code: z.string(),
    name: z.string(),
    productItemId: z.string(),
    operations: z.array(z.unknown()),
  })
  .partial();
const listQuerySchema = z.object({
  status: z.enum(VERSION_STATUSES).optional(),
  // 路线编码/名称关键字（服务端过滤，trim 后 1..100 字符）。
  query: z.string().trim().min(1).max(100).optional(),
  // 按产品物料类型过滤（左树「成品/半成品」）。
  productType: z.enum(PRODUCT_TYPES).optional(),
  // 不设默认值：legacy 工艺路线列表为全量（行为守恒）；显式传入才启用分页窗口。
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(256).optional(),
});
const listResponseSchema = z.object({
  items: z.array(ROUTING_ROW_SCHEMA),
  nextCursor: z.string().optional(),
});
// 详情：根行 + 产品 + 全部版本（工序按 sequence 升序）。
const detailSchema = z
  .looseObject({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    productItemId: z.string(),
    created_at: z.string(),
    product: z
      .looseObject({
        itemId: z.string(),
        sku: z.string(),
        name: z.string(),
        itemType: z.string(),
        baseUnitCode: z.string(),
      })
      .partial(),
    versions: z.array(
      z
        .looseObject({
          id: z.string(),
          version: z.number(),
          status: z.string(),
          effective_at: z.string(),
          published_at: z.string().nullable(),
          operations: z.array(
            z
              .looseObject({
                sequence: z.number(),
                operation_code: z.string(),
                name: z.string(),
                work_center_code: z.string(),
                setup_minutes: z.number(),
                run_minutes_per_unit: z.number(),
                instructions: z.record(z.string(), z.unknown()),
              })
              .partial(),
          ),
        })
        .partial(),
    ),
  })
  .partial();
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

// 与 legacy mutationDto(routing:read) 同口径。
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

export function registerManufacturingRoutingRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ManufacturingRoutingRepository | null =
    scope.dependencies.manufacturing ?? null;
  const readFields = scope.authorization.permissions.get('routing:read')?.fields;
  const requireRepository = (): ManufacturingRoutingRepository => {
    if (!repository)
      throw Object.assign(new Error('Manufacturing dependency unavailable'), {
        statusCode: 503,
      });
    return repository;
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；
  // 显式 limit 时附 nextCursor（(code,version) keyset）。
  app.get(
    '/api/v1/manufacturing-routings',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'routing:read');
      const query = request.query;
      const filter: RoutingPageFilter = {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.productType === undefined ? {} : { productType: query.productType }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const result = await repo.listRoutingPage(
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
        ...(result.nextCursor === null ? {} : { nextCursor: result.nextCursor }),
      };
    },
  );

  // GET 详情：additive 只读（findRouting，routing:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/manufacturing-routings/:routingId',
    { schema: { response: { 200: detailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'routing:read');
      const routingId = uuid((request.params as { routingId: string }).routingId, 'routingId');
      const found = await repo.findRouting(routingId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Manufacturing routing not found',
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

  // POST 创建：legacy manufacturingRoutingCreateRoutes 同解析链（allow 七字段 →
  // operations 七字段（hasOwn 缺省 instructions={}）→ 空 operations 拒绝 →
  // stableCode/uuid/decimal/integer/timestamp → 201 + mutationDto(routing:read)）。
  app.post('/api/v1/manufacturing-routings', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'code',
      'name',
      'productItemId',
      'productItemVersionId',
      'effectiveAt',
      'operations',
      'publish',
    ]);
    const grant = authorizeQuery(scope.authorization, 'routing:manage', Object.keys(body));
    const operations = array(body.operations, 'operations').map((value, index) => {
      const operation = jsonObject(value, `operations[${String(index)}]`);
      allow(operation, [
        'operationCode',
        'name',
        'workCenterCode',
        'sequence',
        'setupMinutes',
        'runMinutesPerUnit',
        'instructions',
      ]);
      return {
        operationCode: assertStableCode(string(operation.operationCode, 'operationCode')),
        name: string(operation.name, 'name'),
        workCenterCode: assertStableCode(string(operation.workCenterCode, 'workCenterCode')),
        sequence: integer(operation.sequence, 'sequence', 1, 100000),
        setupMinutes: decimal(operation.setupMinutes, 'setupMinutes'),
        runMinutesPerUnit: decimal(operation.runMinutesPerUnit, 'runMinutesPerUnit'),
        instructions: jsonObject(
          Object.hasOwn(operation, 'instructions') ? operation.instructions : {},
          'instructions',
        ),
      };
    });
    if (!operations.length)
      throw new DomainError('invalid_request', 'operations must not be empty');
    const input = {
      code: assertStableCode(string(body.code, 'code')),
      name: string(body.name, 'name'),
      productItemId: uuid(body.productItemId, 'productItemId'),
      productItemVersionId: uuid(body.productItemVersionId, 'productItemVersionId'),
      effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
      operations,
      publish: body.publish === true,
    };
    const created = await repo.createRouting(
      input,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'routing:read');
  });

  // PUT publish：现代化统一动作端点——分派 legacy publish('routing') 同链（草稿单向
  // 发布，发布内容不可变守护全在 DB 触发器）；legacy POST 轨保留双轨。
  app.put('/api/v1/manufacturing-routings/:routingId/publish', async (request, reply) => {
    const repo = requireRepository();
    const routingId = uuid((request.params as { routingId: string }).routingId, 'routingId');
    allow(objectBody(request.body), []);
    const grant = authorizeQuery(scope.authorization, 'routing:manage');
    const result = await repo.publish(
      'routing',
      routingId,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(result, scope.authorization, 'routing:read');
  });
}
