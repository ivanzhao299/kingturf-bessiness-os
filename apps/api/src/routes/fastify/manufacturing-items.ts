// U3-MFG-1（ADR-0015）：manufacturing-items 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listItemPage additive keyset——(sku,version) 排序键与
// list('items') 一致；itemType/status/query 筛选；legacy 物料列表无 LIMIT，故 limit
// 不设默认值——无查询参数时响应与 legacy 全量 { items } 逐字节一致（无 nextCursor
// 键），显式 limit（1..100）才附 nextCursor；looseObject 透传）；GET 详情 = additive
// 只读（findItem：根行 + 版本历史 + 关联 BOM/被引用/工艺路线/最近工单——关联聚合按
// bom:read/routing:read/production:read 门控，未授权不查询）；POST 创建 = legacy
// manufacturingItemCreateRoutes 同解析链（负例消息逐字一致）。
import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../../app.ts';
import {
  allow,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type {
  ItemDetailParts,
  ItemPageFilter,
  ManufacturingItemType,
} from '../../manufacturing-repositories.ts';
import { authorizeQuery } from '../../policy.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

export type { ItemPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ManufacturingItemRepository = Pick<
  NonNullable<ApiDependencies['manufacturing']>,
  'listItemPage' | 'findItem' | 'createItem'
>;

const ITEM_TYPES = ['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING'] as const;
const VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;

// 行键为 pg to_jsonb 蛇形命名 + 物料根列驼峰键（legacy 同形态）；looseObject 透传 +
// .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const ITEM_VERSION_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    item_id: z.string(),
    version: z.number(),
    status: z.string(),
    specification: z.record(z.string(), z.unknown()),
    effective_at: z.string(),
    canonical_hash: z.string(),
    published_at: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    itemId: z.string(),
    sku: z.string(),
    name: z.string(),
    itemType: z.string(),
    baseUnitCode: z.string(),
  })
  .partial();
const listQuerySchema = z.object({
  itemType: z.enum(ITEM_TYPES).optional(),
  status: z.enum(VERSION_STATUSES).optional(),
  // sku/名称关键字（服务端过滤，trim 后 1..100 字符）。
  query: z.string().trim().min(1).max(100).optional(),
  // 不设默认值：legacy 物料列表为全量（行为守恒）；显式传入才启用分页窗口。
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(256).optional(),
});
const listResponseSchema = z.object({
  items: z.array(ITEM_VERSION_ROW_SCHEMA),
  nextCursor: z.string().optional(),
});
// 详情：根行 + 版本历史 + 关联聚合；聚合键仅在持对应读权限时出现，故整体 optional。
const detailSchema = z
  .looseObject({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    itemType: z.string(),
    baseUnitCode: z.string(),
    created_at: z.string(),
    versions: z.array(ITEM_VERSION_ROW_SCHEMA),
    boms: z.array(z.looseObject({ id: z.string(), code: z.string() }).partial()),
    usedIn: z.array(z.looseObject({ bomId: z.string(), role: z.string() }).partial()),
    routings: z.array(z.looseObject({ id: z.string(), code: z.string() }).partial()),
    productionOrders: z.array(z.looseObject({ id: z.string(), orderNumber: z.string() }).partial()),
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

// 关联聚合按读权限门控：能力存在且作用域非空才查询（assertPermission 同口径），
// 物料读权限不放宽 BOM/工艺路线/生产工单的可见面。
const detailParts = (authorization: FastifyRouteScope['authorization']): ItemDetailParts => {
  const readable = (capability: PermissionKey): boolean => {
    const grant = authorization.permissions.get(capability);
    return grant !== undefined && grant.scopes.length > 0;
  };
  return {
    boms: readable('bom:read'),
    routings: readable('routing:read'),
    productionOrders: readable('production:read'),
  };
};

export function registerManufacturingItemRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const repository: ManufacturingItemRepository | null = scope.dependencies.manufacturing ?? null;
  const readFields = scope.authorization.permissions.get('manufacturing-item:read')?.fields;
  const requireRepository = (): ManufacturingItemRepository => {
    if (!repository)
      throw Object.assign(new Error('Manufacturing dependency unavailable'), {
        statusCode: 503,
      });
    return repository;
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；
  // 显式 limit 时附 nextCursor（(sku,version) keyset）。
  app.get(
    '/api/v1/manufacturing-items',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'manufacturing-item:read');
      const query = request.query;
      const filter: ItemPageFilter = {
        ...(query.itemType === undefined ? {} : { itemType: query.itemType }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const result = await repo.listItemPage(
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

  // GET 详情：additive 只读（findItem，manufacturing-item:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/manufacturing-items/:itemId',
    { schema: { response: { 200: detailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'manufacturing-item:read');
      const itemId = uuid((request.params as { itemId: string }).itemId, 'itemId');
      const found = await repo.findItem(
        itemId,
        { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
        detailParts(scope.authorization),
      );
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Manufacturing item not found',
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

  // POST 创建：legacy manufacturingItemCreateRoutes 同解析链（allow 七字段 →
  // authorizeQuery(Object.keys(body)) → itemType → 解析 → 201 + mutationDto）。
  app.post('/api/v1/manufacturing-items', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'sku',
      'name',
      'itemType',
      'baseUnitCode',
      'specification',
      'effectiveAt',
      'publish',
    ]);
    const grant = authorizeQuery(
      scope.authorization,
      'manufacturing-item:manage',
      Object.keys(body),
    );
    const itemType = string(body.itemType, 'itemType');
    if (!(ITEM_TYPES as readonly string[]).includes(itemType))
      throw new DomainError('invalid_request', 'itemType is unsupported');
    const input = {
      sku: assertStableCode(string(body.sku, 'sku')),
      name: string(body.name, 'name'),
      itemType: itemType as ManufacturingItemType,
      baseUnitCode: assertStableCode(string(body.baseUnitCode, 'baseUnitCode')),
      specification: jsonObject(body.specification ?? {}, 'specification'),
      effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
      publish: body.publish === true,
    };
    const created = await repo.createItem(
      input,
      { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors },
      scope.correlationId,
    );
    void reply.code(201);
    return mutationDto(created, scope.authorization, 'manufacturing-item:read');
  });
}
