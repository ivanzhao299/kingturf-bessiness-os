// U3-PROC-1（ADR-0015）：suppliers 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listSupplierPage additive keyset（supplier_number 排序键
// 与 list('suppliers') 一致）+ status 筛选；legacy 供应商列表无 LIMIT，故 limit 不设
// 默认值——无查询参数时响应与 legacy 全量 { items } 逐字节一致，looseObject 透传 +
// Date 归一化（COM 同款守恒口径））；GET 详情 = additive 只读（findSupplier）；
// POST 创建 = legacy procurementSupplierCreateRoutes 同解析链；PUT qualification =
// 现代化统一动作端点（action approve|conditional|reject 分派 legacy qualifySupplier
// 同链；legacy POST /qualifications 轨逐字不动）。
import { z } from 'zod';
import { assertStableCode } from '@kingturf/domain';
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  calendarDate,
  currency,
  decimal,
  integer,
  jsonObject,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../app-values.ts';
import type { SupplierPageFilter } from '../../procurement-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { PermissionKey } from '@kingturf/types';

export type { SupplierPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type SupplierRepository = Pick<
  NonNullable<ApiDependencies['procurement']>,
  'listSupplierPage' | 'findSupplier' | 'createSupplier' | 'qualifySupplier'
>;

// 行键为 pg to_jsonb 蛇形命名（legacy 同形态）；looseObject 透传 + .partial() 守恒口径。
const SUPPLIER_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    supplier_number: z.string(),
    name: z.string(),
    status: z.string(),
    currency: z.string(),
    payment_terms_days: z.number(),
    contact: z.record(z.string(), z.unknown()),
    qualifications: z.array(z.unknown()),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .partial();
const listQuerySchema = z.object({
  // 不设默认值：legacy 供应商列表为全量（行为守恒）；显式传入才启用分页窗口。
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'INACTIVE']).optional(),
});
const listResponseSchema = z.object({
  items: z.array(SUPPLIER_ROW_SCHEMA),
  nextCursor: z.string().optional(),
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

// 与 legacy mutationDto(supplier:read) 同口径。
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

export function registerSupplierRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: SupplierRepository | null = scope.dependencies.procurement ?? null;
  const readFields = scope.authorization.permissions.get('supplier:read')?.fields;
  const requireRepository = (): SupplierRepository => {
    if (!repository)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  // GET 列表：视图轨迁移——无查询参数时与 legacy { items } 逐字节一致；
  // 显式 limit 时附 nextCursor（supplier_number keyset）。
  app.get(
    '/api/v1/suppliers',
    { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
    async (request) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'supplier:read');
      const query = request.query;
      const filter: SupplierPageFilter = {
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.status === undefined ? {} : { status: query.status }),
      };
      const result = await repo.listSupplierPage(
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

  // GET 详情：additive 只读（findSupplier，supplier:read + 字段裁剪同读轨）。
  app.get(
    '/api/v1/suppliers/:supplierId',
    { schema: { response: { 200: SUPPLIER_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'supplier:read');
      const supplierId = uuid((request.params as { supplierId: string }).supplierId, 'supplierId');
      const found = await repo.findSupplier(supplierId, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Supplier not found',
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

  // POST 创建：legacy procurementSupplierCreateRoutes 同解析链（allow 七字段 →
  // authorizeQuery(Object.keys(body)) → 解析 → 201 + mutationDto(supplier:read)）。
  app.post('/api/v1/suppliers', async (request, reply) => {
    const repo = requireRepository();
    const body = objectBody(request.body);
    allow(body, [
      'supplierNumber',
      'name',
      'currency',
      'paymentTermsDays',
      'qualityRatingBasisPoints',
      'contact',
    ]);
    const grant = authorizeQuery(scope.authorization, 'supplier:manage', Object.keys(body));
    const input = {
      supplierNumber: assertStableCode(string(body.supplierNumber, 'supplierNumber')),
      name: string(body.name, 'name'),
      currency: currency(body.currency),
      paymentTermsDays: integer(body.paymentTermsDays, 'paymentTermsDays', 0, 3650),
      qualityRatingBasisPoints:
        body.qualityRatingBasisPoints === null || body.qualityRatingBasisPoints === undefined
          ? null
          : integer(body.qualityRatingBasisPoints, 'qualityRatingBasisPoints', 0, 10000),
      contact: jsonObject(body.contact ?? {}, 'contact'),
    };
    const created = await repo.createSupplier(
      input,
      {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      },
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'supplier:read');
  });

  // PUT 资质审核：现代化统一动作端点——action approve|conditional|reject 映射
  // APPROVED|CONDITIONAL|REJECTED 后走 legacy qualifySupplier 同链（同解析器与
  // 状态校验语义；legacy POST /qualifications 轨保留并行）。
  app.put('/api/v1/suppliers/:supplierId/qualification', async (request, reply) => {
    const repo = requireRepository();
    const supplierId = uuid((request.params as { supplierId: string }).supplierId, 'supplierId');
    const body = objectBody(request.body);
    const action = string(body.action, 'action');
    const status =
      action === 'approve'
        ? 'APPROVED'
        : action === 'conditional'
          ? 'CONDITIONAL'
          : action === 'reject'
            ? 'REJECTED'
            : null;
    if (status === null)
      throw Object.assign(new Error('action must be approve, conditional or reject'), {
        statusCode: 400,
      });
    const grant = authorizeQuery(scope.authorization, 'supplier:manage', [
      'itemVersionId',
      'validFrom',
      'validTo',
      'minimumOrderQuantity',
      'leadTimeDays',
      'evidence',
    ]);
    allow(body, [
      'action',
      'itemVersionId',
      'validFrom',
      'validTo',
      'minimumOrderQuantity',
      'leadTimeDays',
      'evidence',
    ]);
    const input = {
      itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
      status,
      validFrom: calendarDate(body.validFrom, 'validFrom'),
      validTo:
        body.validTo === null || body.validTo === undefined
          ? null
          : calendarDate(body.validTo, 'validTo'),
      minimumOrderQuantity: decimal(body.minimumOrderQuantity, 'minimumOrderQuantity'),
      leadTimeDays: integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
      evidence: jsonObject(body.evidence ?? {}, 'evidence'),
    };
    const result = await repo.qualifySupplier(
      supplierId,
      input,
      {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      },
      scope.correlationId,
    );
    void reply.code(200);
    return mutation(result, scope.authorization, 'supplier:read');
  });
}
