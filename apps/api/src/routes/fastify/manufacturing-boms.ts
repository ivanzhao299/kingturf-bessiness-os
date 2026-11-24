// U3-MFG-2（ADR-0015）：manufacturing-boms 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listBomPage additive keyset——(code,version) 排序键与
// list('boms') 一致；status/query/productType 筛选；legacy BOM 列表无 LIMIT，故
// limit 不设默认值——无查询参数时响应与 legacy 全量 { items } 逐字节一致（无
// nextCursor 键），显式 limit（1..100）才附 nextCursor；looseObject 透传 + Date 归一
// 化）；GET 详情 = additive 只读（findBom：根行 + 产品信息 + 全部版本行项（组件含
// 单位/类型 + 替代料含换算系数）+ 最新已发布版本组件层级树（深度受限、环守卫））；
// POST 创建 = legacy manufacturingBomCreateRoutes 同解析链（负例消息逐字一致）；
// PUT /:id/publish = 现代化统一动作端点，分派 legacy publish('bom') 同链（legacy
// POST /manufacturing-bom-versions/:id/publish 轨逐字不动，双轨并行）。
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
import type { BomPageFilter } from '../../manufacturing-read-repositories.ts';
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

export type { BomPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ManufacturingBomRepository = Pick<
  NonNullable<ApiDependencies['manufacturing']>,
  'listBomPage' | 'findBom' | 'createBom' | 'publish'
>;

const VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;
const PRODUCT_TYPES = ['FINISHED_GOOD', 'SEMI_FINISHED'] as const;

// 行键为 pg to_jsonb 蛇形命名 + BOM 头列驼峰键（legacy 同形态）；looseObject 透传 +
// .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const BOM_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    bom_id: z.string(),
    version: z.number(),
    status: z.string(),
    product_item_version_id: z.string(),
    output_quantity: z.number(),
    effective_at: z.string(),
    canonical_hash: z.string(),
    published_at: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    bomId: z.string(),
    code: z.string(),
    name: z.string(),
    productItemId: z.string(),
    lines: z.array(z.unknown()),
  })
  .partial();
const listQuerySchema = z.object({
  status: z.enum(VERSION_STATUSES).optional(),
  // BOM 编码/名称关键字（服务端过滤，trim 后 1..100 字符）。
  query: z.string().trim().min(1).max(100).optional(),
  // 按产品物料类型过滤（左树「成品/半成品」）。
  productType: z.enum(PRODUCT_TYPES).optional(),
  // 不设默认值：legacy BOM 列表为全量（行为守恒）；显式传入才启用分页窗口。
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(256).optional(),
});
const listResponseSchema = z.object({
  items: z.array(BOM_ROW_SCHEMA),
  nextCursor: z.string().optional(),
});
// 详情：根行 + 产品 + 版本行项（组件/替代料）+ 最新已发布版本组件层级树。
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
          outputQuantity: z.number(),
          effective_at: z.string(),
          published_at: z.string().nullable(),
          lines: z.array(
            z
              .looseObject({
                lineNumber: z.number(),
                quantity: z.number(),
                scrapBasisPoints: z.number(),
                component: z
                  .looseObject({
                    itemId: z.string(),
                    sku: z.string(),
                    name: z.string(),
                    version: z.number(),
                    itemType: z.string(),
                    baseUnitCode: z.string(),
                  })
                  .partial(),
                substitutes: z.array(z.unknown()),
              })
              .partial(),
          ),
        })
        .partial(),
    ),
    tree: z.array(
      z
        .looseObject({
          bomVersionId: z.string(),
          code: z.string(),
          name: z.string(),
          version: z.number(),
          status: z.string(),
          lines: z.array(z.unknown()),
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

// 与 legacy mutationDto(bom:read) 同口径。
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

export function registerManufacturingBomRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ManufacturingBomRepository | null = scope.dependencies.manufacturing ?? null;
  const readFields = scope.authorization.permissions.get('bom:read')?.fields;
  const requireRepository = (): ManufacturingBomRepository => {
    if (!repository)
      throw Object.assign(new Error('Manufacturing dependency unavailable'), {
        statusCode: 503,
      });
    return repository;
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；
  // 显式 limit 时附 nextCursor（(code,version) keyset）。
  app.get(
    '/api/v1/manufacturing-boms',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'bom:read');
      const query = request.query;
      const filter: BomPageFilter = {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.productType === undefined ? {} : { productType: query.productType }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const result = await repo.listBomPage(
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

  // GET 详情：additive 只读（findBom，bom:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/manufacturing-boms/:bomId',
    { schema: { response: { 200: detailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'bom:read');
      const bomId = uuid((request.params as { bomId: string }).bomId, 'bomId');
      const found = await repo.findBom(bomId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Manufacturing BOM not found',
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

  // POST 创建：legacy manufacturingBomCreateRoutes 同解析链（allow 八字段 → 行四字段
  // → 替代料三字段（hasOwn 缺省：scrapBasisPoints=0、substitutes=[]）→ 空行拒绝 →
  // stableCode/uuid/decimal/integer/timestamp → 201 + mutationDto(bom:read)）。
  app.post('/api/v1/manufacturing-boms', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'code',
      'name',
      'productItemId',
      'productItemVersionId',
      'outputQuantity',
      'effectiveAt',
      'lines',
      'publish',
    ]);
    const grant = authorizeQuery(scope.authorization, 'bom:manage', Object.keys(body));
    const lines = array(body.lines, 'lines').map((value, index) => {
      const line = jsonObject(value, `lines[${String(index)}]`);
      allow(line, ['componentItemVersionId', 'quantity', 'scrapBasisPoints', 'substitutes']);
      return {
        componentItemVersionId: uuid(
          line.componentItemVersionId,
          `lines[${String(index)}].componentItemVersionId`,
        ),
        quantity: decimal(line.quantity, `lines[${String(index)}].quantity`),
        scrapBasisPoints: integer(
          Object.hasOwn(line, 'scrapBasisPoints') ? line.scrapBasisPoints : 0,
          `lines[${String(index)}].scrapBasisPoints`,
          0,
          10000,
        ),
        substitutes: array(
          Object.hasOwn(line, 'substitutes') ? line.substitutes : [],
          `lines[${String(index)}].substitutes`,
        ).map((entry) => {
          const substitute = jsonObject(entry, 'substitutes');
          allow(substitute, ['itemVersionId', 'priority', 'conversionFactor']);
          return {
            itemVersionId: uuid(substitute.itemVersionId, 'itemVersionId'),
            priority: integer(substitute.priority, 'priority', 1, 1000),
            conversionFactor: decimal(substitute.conversionFactor, 'conversionFactor'),
          };
        }),
      };
    });
    if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
    const input = {
      code: assertStableCode(string(body.code, 'code')),
      name: string(body.name, 'name'),
      productItemId: uuid(body.productItemId, 'productItemId'),
      productItemVersionId: uuid(body.productItemVersionId, 'productItemVersionId'),
      outputQuantity: decimal(body.outputQuantity, 'outputQuantity'),
      effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
      lines,
      publish: body.publish === true,
    };
    const created = await repo.createBom(
      input,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'bom:read');
  });

  // PUT publish：现代化统一动作端点——分派 legacy publish('bom') 同链（草稿单向发布，
  // 发布内容不可变守护全在 DB 触发器）；legacy POST 轨保留双轨。
  app.put('/api/v1/manufacturing-boms/:bomId/publish', async (request, reply) => {
    const repo = requireRepository();
    const bomId = uuid((request.params as { bomId: string }).bomId, 'bomId');
    allow(objectBody(request.body), []);
    const grant = authorizeQuery(scope.authorization, 'bom:manage');
    const result = await repo.publish(
      'bom',
      bomId,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(result, scope.authorization, 'bom:read');
  });
}
