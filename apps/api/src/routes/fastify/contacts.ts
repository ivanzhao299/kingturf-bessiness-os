// U3-CRM-3（ADR-0015）：contacts 域 Fastify 端点组。
// GET 列表/详情 = additive 只读（listContacts/findContact——customer360 contacts
// 同表同谓词，sensitive 联系方式门由仓储按 customer-360:read 字段折叠）；POST 创建 =
// legacy customer-contacts 路由同解析链（DomainError 消息逐字节一致，frozen 契约）。
// legacy 无联系人更新操作（R2 行为守恒：不新增仓储写方法），PUT 不提供——更新语义
// 属新业务能力，待独立人裁。
import { normalizeContactEmail, normalizeContactPhone } from '@kingturf/domain';
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import { allow, objectBody, permittedDto, string, uuid } from '../../app-values.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { PermissionKey } from '@kingturf/types';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ContactRepository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'listContacts' | 'findContact' | 'createContact'
>;

const CONTACT_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    customerId: z.string(),
    name: z.string(),
    title: z.string().nullable(),
    email: z.string().optional(),
    phone: z.string().optional(),
    primary: z.boolean(),
    version: z.number(),
    createdAt: z.string(),
  })
  .partial();
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

function permitted(row: Record<string, unknown>, fields: readonly string[] | null) {
  if (fields === null) return row;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => visible.has(key)));
}

export function registerContactRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: ContactRepository | null = scope.dependencies.crm ?? null;
  const requireRepository = (): ContactRepository => {
    if (!repository)
      throw Object.assign(new Error('CRM dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  // sensitive 门：customer-360:read 字段裁剪决定 email/phone 可见性（与 360 路由同口径）。
  const sensitive = () => {
    const fields = scope.authorization.permissions.get('customer-360:read')?.fields;
    return {
      email: fields === null || fields?.includes('contacts.email') === true,
      phone: fields === null || fields?.includes('contacts.phone') === true,
    };
  };

  // GET 列表：additive 只读（须先过 customer 客体作用域门——legacy CRM matcher 503
  // 先于权限校验的顺序保持：仓储门在授权前执行）。
  // 响应仓储直通（无 zod 响应 schema）——sensitive 门行键变化由仓储折叠，与 legacy JSON 一致。
  app.get('/api/v1/customers/:customerId/contacts', async (request) => {
    const repo = requireRepository();
    const customerId = (request.params as { customerId: string }).customerId.toLowerCase();
    const grant = authorizeQuery(scope.authorization, 'customer-360:read');
    const items = await repo.listContacts(
      customerId,
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
      sensitive(),
    );
    return { items };
  });

  // GET 详情：additive 只读（findContact 按联接客户作用域过滤）。
  app.get(
    '/api/v1/customers/:customerId/contacts/:contactId',
    { schema: { response: { 200: CONTACT_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const contactId = uuid((request.params as { contactId: string }).contactId, 'contactId');
      const found = await repo.findContact(
        contactId,
        scope.authorization.actor,
        [],
        [],
        sensitive(),
      );
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Contact not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(found as unknown as Record<string, unknown>, null);
    },
  );

  // POST 创建：legacy customer-contacts 同解析链（customer:update contacts 字段授权、
  // email/phone 字符串校验与归一化、email/phone 至少其一）→ 201 + mutationDto。
  app.post('/api/v1/customers/:customerId/contacts', async (request, reply) => {
    const repo = requireRepository();
    const grant = authorizeQuery(scope.authorization, 'customer:update', ['contacts']);
    const body = objectBody(request.body);
    allow(body, ['name', 'title', 'email', 'phone', 'primary']);
    if (body.email !== undefined && body.email !== null && typeof body.email !== 'string')
      throw Object.assign(new Error('email must be a string'), { statusCode: 400 });
    if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string')
      throw Object.assign(new Error('phone must be a string'), { statusCode: 400 });
    const email = typeof body.email === 'string' ? normalizeContactEmail(body.email) : null;
    const phone = typeof body.phone === 'string' ? normalizeContactPhone(body.phone) : null;
    if (email === null && phone === null)
      throw Object.assign(new Error('Contact email or phone is required'), { statusCode: 400 });
    const created = await repo.createContact(
      uuid((request.params as { customerId: string }).customerId, 'customerId'),
      {
        name: string(body.name, 'name'),
        title: typeof body.title === 'string' ? body.title : null,
        email,
        phone,
        primary: body.primary === true,
      },
      scope.authorization.actor,
      scope.correlationId,
      grant.scopes,
      grant.anchors,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'customer:read');
  });
}

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
