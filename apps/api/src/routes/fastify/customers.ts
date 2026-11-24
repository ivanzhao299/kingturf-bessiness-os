// U3-CRM-2（ADR-0015）：customers 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listCustomers + strict { items, nextCursor: null } 键对齐
// + permittedDto(customer:read)——与 legacy 读轨同口径）；GET 详情（基本信息）与
// GET 360 = legacy customer-base/customer-360 同链复用（360 投影经导出的
// projectCustomer360Result + readCustomer360SectionGrant，双授权与 sensitive 门
// 逐字节一致）；POST 创建 = legacy 同解析链（frozen 契约消息一致）。
// 全部响应仓储直通 + Date 归一化（COM 同款守恒口径）。
// TD-WF-013（WF-A）：POST 创建遇到重复客户编号 / 重复客户名称（两个唯一约束拒绝）时映射成
// 409 + 中文提示（此前是 500）；映射只做在这个端点上，规则见 write-rejection-mapping.ts。
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import { allow, objectBody, permittedDto, strings, string, uuid } from '../../app-values.ts';
import { asCustomerConflict } from '../../write-rejection-mapping.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import { projectCustomer360Result } from '../customer-360.ts';
import type { PermissionKey } from '@kingturf/types';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type CustomerRepository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'listCustomers' | 'findCustomer' | 'createCustomer' | 'customer360'
>;

const CUSTOMER_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenantId: z.string(),
    customerNumber: z.string(),
    name: z.string(),
    status: z.string(),
    ownerId: z.string().nullable(),
    version: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .partial();
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

// pg 将 timestamp 列解析为 Date 对象；legacy 轨经 JSON.stringify 隐式转 ISO 串，
// 本轨在响应前显式归一化（行为守恒：与 legacy JSON 输出逐字节一致）。
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

// 与 legacy mutationDto(customer:read) 同口径。
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

export function registerCustomerRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: CustomerRepository | null = scope.dependencies.crm ?? null;
  const requireRepository = (): CustomerRepository => {
    if (!repository)
      throw Object.assign(new Error('CRM dependency unavailable'), { statusCode: 503 });
    return repository;
  };
  const readFields = scope.authorization.permissions.get('customer:read')?.fields;
  const sectionGrant = (capability: PermissionKey) => {
    const grant = authorizeQuery(scope.authorization, capability);
    return { scopes: grant.scopes, anchors: grant.anchors };
  };

  // GET 列表：视图轨迁移（无 cursor——legacy 即全量 100 封顶；strict 键对齐）。
  // legacy 契约：CRM 依赖缺失 503 先于权限校验（CRM matcher 门）。
  app.get('/api/v1/customers', async () => {
    const repo = requireRepository();
    const grant = authorizeQuery(scope.authorization, 'customer:read');
    const items = await repo.listCustomers(scope.authorization.actor, grant.scopes, grant.anchors);
    return {
      items: items.map((item) =>
        permittedDto(
          normalizeTimestamps(item as unknown as Record<string, unknown>),
          readFields ?? null,
        ),
      ),
      nextCursor: null,
    };
  });

  // GET 详情（基本信息）：customer:read + 字段裁剪同读轨；404 信封含 correlationId。
  app.get(
    '/api/v1/customers/:customerId',
    { schema: { response: { 200: CUSTOMER_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'customer:read');
      const found = await repo.findCustomer(
        (request.params as { customerId: string }).customerId.toLowerCase(),
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Customer not found',
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

  // GET 客户 360：legacy customer-360 路由同链（双授权 customer:read +
  // customer-360:read；sensitive 联系方式门；分区授权折叠；投影 projectCustomer360Result
  // 导出复用）——响应与 legacy 逐字节一致。
  app.get('/api/v1/customers/:customerId/360', async (request, reply) => {
    const repo = requireRepository();
    const customerId = (request.params as { customerId: string }).customerId.toLowerCase();
    const readGrant = authorizeQuery(scope.authorization, 'customer:read');
    const viewGrant = authorizeQuery(scope.authorization, 'customer-360:read');
    const readable = await repo.findCustomer(
      customerId,
      scope.authorization.actor,
      readGrant.scopes,
      readGrant.anchors,
    );
    if (!readable) {
      void reply.code(404).send({
        error: {
          code: 'not_found',
          message: 'Customer not found',
          correlationId: scope.correlationId,
        },
      });
      return;
    }
    const fields = scope.authorization.permissions.get('customer-360:read')?.fields;
    const projection360Context = {
      repository: repo,
      authorization: scope.authorization,
      authorize: (capability: Parameters<typeof authorizeQuery>[1]) =>
        authorizeQuery(scope.authorization, capability),
      uuid: (value: unknown, name: string) => uuid(value, name),
      customerNotFound: () => undefined,
      permittedDto: <T extends Record<string, unknown>>(value: T, crop: readonly string[] | null) =>
        permittedDto(value, crop),
    } as unknown as Parameters<typeof projectCustomer360Result>[0];
    const found = await repo.customer360(
      customerId,
      scope.authorization.actor,
      viewGrant.scopes,
      viewGrant.anchors,
      {
        email: fields === null || fields?.includes('contacts.email') === true,
        phone: fields === null || fields?.includes('contacts.phone') === true,
      },
      {
        ...(scope.authorization.permissions.has('customer-ownership:read')
          ? { ownership: sectionGrant('customer-ownership:read') }
          : {}),
        ...(scope.authorization.permissions.has('lead:read')
          ? { leads: sectionGrant('lead:read') }
          : {}),
        ...(scope.authorization.permissions.has('opportunity:read')
          ? { opportunities: sectionGrant('opportunity:read') }
          : {}),
        ...(scope.authorization.permissions.has('customer-activity:read')
          ? { activities: sectionGrant('customer-activity:read') }
          : {}),
      },
    );
    if (!found) {
      void reply.code(404).send({
        error: {
          code: 'not_found',
          message: 'Customer not found',
          correlationId: scope.correlationId,
        },
      });
      return;
    }
    return projectCustomer360Result(projection360Context, fields, found);
  });

  // POST 创建：legacy customer-base 同解析链（customer:create + allow 三字段）→ 201
  // + mutationDto(customer:read)。TD-WF-013：重复客户编号 / 名称 → 409 + 中文提示。
  app.post('/api/v1/customers', async (request, reply) => {
    const repo = requireRepository();
    authorizeQuery(scope.authorization, 'customer:create', ['name', 'customerNumber', 'tags']);
    const body = objectBody(request.body);
    allow(body, ['name', 'customerNumber', 'tags']);
    const input = {
      name: string(body.name, 'name'),
      customerNumber: string(body.customerNumber, 'customerNumber'),
      tags: body.tags === undefined ? [] : strings(body.tags, 'tags'),
    };
    let created: Awaited<ReturnType<CustomerRepository['createCustomer']>>;
    try {
      created = await repo.createCustomer(input, scope.authorization.actor, scope.correlationId);
    } catch (error) {
      throw asCustomerConflict(error);
    }
    void reply.code(201);
    return mutation(created, scope.authorization, 'customer:read');
  });
}
