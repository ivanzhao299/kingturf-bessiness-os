// U3-CRM-4（ADR-0015）：activities 域 Fastify 端点组。
// GET 列表 = additive 只读（listActivities：customer360 activities 同表同谓词同
// 排序）；GET 详情 = additive 只读（findActivity）；POST 创建 = legacy
// customer-activities 路由同解析链（五字段 allow、幂等键、DomainError 消息逐字节
// 一致）。响应仓储直通 + Date 归一化（COM 同款守恒口径）。
import { z } from 'zod';
import { DomainError } from '@kingturf/domain';
import { authorizeQuery } from '../../policy.ts';
import { allow, objectBody, permittedDto, string, timestamp, uuid } from '../../app-values.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type ActivityRepository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'listActivities' | 'findActivity' | 'createActivity'
>;

const ACTIVITY_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    customerId: z.string(),
    leadId: z.string().nullable(),
    type: z.string(),
    occurredAt: z.string(),
    actorId: z.string(),
    summary: z.string(),
    details: z.record(z.string(), z.unknown()),
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

// 与 legacy mutationDto(customer-activity:read) 同口径。
function mutation(
  value: Record<string, unknown>,
  authorization: AuthorizationContext,
  readCapability: PermissionKey,
): Record<string, unknown> {
  const read = authorization.permissions.get(readCapability);
  if (!read) return permitted(value, ['version']);
  return permitted(value, read.fields);
}

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

export function registerActivityRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: ActivityRepository | null = scope.dependencies.crm ?? null;
  const requireRepository = (): ActivityRepository => {
    if (!repository)
      throw Object.assign(new Error('CRM dependency unavailable'), { statusCode: 503 });
    return repository;
  };
  const readFields = scope.authorization.permissions.get('customer-activity:read')?.fields;
  const customerIdOf = (request: unknown) =>
    (request as { params: { customerId: string } }).params.customerId.toLowerCase();

  // GET 列表：additive 只读（customer-activity:read）。
  app.get(
    '/api/v1/customers/:customerId/activities',
    { schema: { querystring: z.object({ type: z.string().optional() }) } },
    async (request) => {
      const repo = requireRepository();
      const customerId = customerIdOf(request);
      const grant = authorizeQuery(scope.authorization, 'customer-activity:read');
      const all = await repo.listActivities(
        customerId,
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      const type = (request.query as { type?: string } | undefined)?.type;
      const filtered = type === undefined ? all : all.filter((row) => row.type === type);
      return {
        items: filtered.map((item) =>
          permittedDto(
            normalizeTimestamps(item as unknown as Record<string, unknown>),
            readFields ?? null,
          ),
        ),
      };
    },
  );

  // GET 详情：additive 只读（findActivity 行 id+客户绑定匹配；404 信封含 correlationId）。
  app.get(
    '/api/v1/customers/:customerId/activities/:activityId',
    { schema: { response: { 200: ACTIVITY_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const customerId = customerIdOf(request);
      const activityId = uuid((request.params as { activityId: string }).activityId, 'activityId');
      const grant = authorizeQuery(scope.authorization, 'customer-activity:read');
      const row = await repo.findActivity(
        activityId,
        customerId,
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      if (!row) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Activity not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(
        normalizeTimestamps(row as unknown as Record<string, unknown>),
        readFields ?? null,
      );
    },
  );

  // POST 创建：legacy customer-activities 同解析链（五字段 allow、幂等键、消息一致）
  // → 201 + mutationDto(customer-activity:read)。
  app.post('/api/v1/customers/:customerId/activities', async (request, reply) => {
    const repo = requireRepository();
    const customerId = uuid(customerIdOf(request), 'customerId');
    const grant = authorizeQuery(scope.authorization, 'customer-activity:create', [
      'leadId',
      'type',
      'occurredAt',
      'summary',
      'details',
    ]);
    const key = (request.headers as Record<string, string | undefined>)['idempotency-key'];
    if (!key || key.length > 128)
      throw new DomainError(
        'invalid_request',
        'Idempotency-Key is required and must be at most 128 characters',
      );
    const body = objectBody(request.body);
    allow(body, ['leadId', 'type', 'occurredAt', 'summary', 'details']);
    if (body.leadId !== null && body.leadId !== undefined && typeof body.leadId !== 'string')
      throw new DomainError('invalid_request', 'leadId must be a UUID');
    const created = await repo.createActivity(
      customerId,
      {
        leadId:
          body.leadId === null || body.leadId === undefined ? null : uuid(body.leadId, 'leadId'),
        type: string(body.type, 'type'),
        occurredAt: timestamp(body.occurredAt, 'occurredAt'),
        summary: string(body.summary, 'summary'),
        details: (body.details === undefined ? {} : objectBody(body.details)) as never,
      },
      scope.authorization.actor,
      scope.correlationId,
      key,
      grant.scopes,
      grant.anchors,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'customer-activity:read');
  });
}
