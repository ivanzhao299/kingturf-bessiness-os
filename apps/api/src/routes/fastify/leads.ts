// U3-CRM-1（ADR-0015）：leads 域 Fastify 端点组。
// GET 列表/pool = 视图轨迁移（listLeadPage keyset cursor 分页 + status 筛选；
// 默认 limit=100 与 legacy LIMIT 100 对齐，looseObject 透传 + Date 归一化——COM 同款
// 守恒口径，响应与 legacy { items, nextCursor: null } 键对齐）；GET 详情 = additive
// 只读（findLead）；POST 创建 = legacy leadCreateRoutes 同解析链（leadCreate 导出
// 助手复用）；PUT state = 现代化统一动作端点（action transition|assign|reassign|
// release|claim 分派 legacy lead-commands/lead-claim 同链）。
// TD-CRM-003：GET 列表每行追加加性键 lastActivityAt（线索名下最近一次活动时间）——按来源域
// 读权限门控：账号同时具备线索读权限与 customer-activity:read 才聚合（项目所有者
// 2026-11-26 确认）；既有键的顺序与取值不变，legacy 轨不受影响。
import { z } from 'zod';
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  expectedVersion,
  idempotency,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../app-values.ts';
import type { LeadActivityGrant, LeadPage, LeadPageFilter } from '../../crm-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies, ApiRequest } from '../../app.ts';
import type { LeadStatus, PermissionKey } from '@kingturf/types';

export type { LeadPage, LeadPageFilter };

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type LeadRepository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'listLeadPage' | 'findLead' | 'createLead' | 'assign' | 'transitionLead' | 'claimLead'
>;

const LEAD_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenantId: z.string(),
    title: z.string(),
    source: z.string(),
    status: z.string(),
    ownerId: z.string().nullable(),
    customerId: z.string().nullable(),
    version: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    // TD-CRM-003：ownerOrganizationId 是既有行键，此前靠 looseObject 透传（序列化时排在全部
    // 声明键之后、即末尾）。这里按它在线上的既有位置显式声明，使下面的加性键真正排在末尾——
    // 改前的响应 JSON 是改后响应的字节前缀。取值与校验不变（恒为字符串或 null）。
    ownerOrganizationId: z.string().nullable(),
    // TD-CRM-003 加性键：线索名下最近一次活动时间（looseObject 透传；字段白名单裁剪同其余键）。
    lastActivityAt: z.string().nullable(),
  })
  .partial();
const listQuerySchema = z.object({
  // 默认 100 = legacy LIMIT 100（行为守恒）。
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.uuid().optional(),
  status: z.string().optional(),
  pool: z.enum(['true', 'false']).optional(),
});
const listResponseSchema = z.object({
  items: z.array(LEAD_ROW_SCHEMA),
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

// 与 legacy mutationDto(lead:read) 同口径。
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

export function registerLeadRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: LeadRepository | null = scope.dependencies.crm ?? null;
  const readFields = scope.authorization.permissions.get('lead:read')?.fields;
  const requireRepository = (): LeadRepository => {
    if (!repository)
      throw Object.assign(new Error('CRM dependency unavailable'), { statusCode: 503 });
    return repository;
  };

  // TD-CRM-003：最近一次活动按来源域读权限门控（项目所有者 2026-11-26 确认）——
  // lead:read 与 customer-activity:read 均存在且作用域非空才聚合（assertPermission 同口径，
  // U3-MFG-1 关联聚合先例）。公海列表仍只需 lead-pool:read 可读，缺少 lead:read 时只隐藏跟进时间。
  const activityGrant = (): LeadActivityGrant | null => {
    const leadRead = scope.authorization.permissions.get('lead:read');
    if (leadRead === undefined || leadRead.scopes.length === 0) return null;
    const grant = scope.authorization.permissions.get('customer-activity:read');
    return grant !== undefined && grant.scopes.length > 0
      ? {
          scopes: grant.scopes,
          anchors: scope.authorization.scopeAnchors?.get('customer-activity:read') ?? [],
        }
      : null;
  };

  const listRoute = (path: string, pool: boolean) => {
    app.get(
      path,
      { schema: { querystring: listQuerySchema, response: { 200: listResponseSchema } } },
      async (request) => {
        const repo = requireRepository();
        const grant = authorizeQuery(scope.authorization, pool ? 'lead-pool:read' : 'lead:read');
        const fields = scope.authorization.permissions.get(
          pool ? 'lead-pool:read' : 'lead:read',
        )?.fields;
        const query = request.query;
        const filter: LeadPageFilter = {
          limit: query.limit,
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.status === undefined ? {} : { status: query.status }),
          pool,
        };
        const result = await repo.listLeadPage(
          scope.authorization.actor,
          grant.scopes,
          grant.anchors,
          filter,
          activityGrant(),
        );
        return {
          items: result.items.map((item) =>
            permittedDto(
              normalizeTimestamps(item as unknown as Record<string, unknown>),
              fields ?? null,
            ),
          ),
          ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
        };
      },
    );
  };
  listRoute('/api/v1/leads', false);
  listRoute('/api/v1/leads/pool', true);

  // GET 详情：additive 只读（findLead，lead:read 授权 + 字段裁剪同读轨）。
  app.get(
    '/api/v1/leads/:leadId',
    { schema: { response: { 200: LEAD_ROW_SCHEMA, 404: notFoundSchema } } },
    async (request, reply) => {
      const repo = requireRepository();
      const grant = authorizeQuery(scope.authorization, 'lead:read');
      const lead = await repo.findLead(
        (request.params as { leadId: string }).leadId.toLowerCase(),
        scope.authorization.actor,
        grant.scopes,
        grant.anchors,
      );
      if (!lead) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'Lead not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(
        normalizeTimestamps(lead as unknown as Record<string, unknown>),
        readFields ?? null,
      );
    },
  );

  // POST 创建：legacy leadCreateRoutes 同解析链（allow/解析/201 + mutationDto）。
  app.post('/api/v1/leads', async (request, reply) => {
    const repo = requireRepository();
    const grant = authorizeQuery(scope.authorization, 'lead:create', [
      'title',
      'source',
      'customerId',
      'pool',
    ]);
    const body = objectBody(request.body);
    allow(body, ['title', 'source', 'customerId', 'pool']);
    const input = {
      title: string(body.title, 'title'),
      source: string(body.source, 'source'),
      customerId:
        body.customerId === null || body.customerId === undefined
          ? null
          : uuid(body.customerId, 'customerId'),
      pool: body.pool === true,
    };
    const created = await repo.createLead(
      input,
      scope.authorization.actor,
      scope.correlationId,
      grant.scopes,
      grant.anchors,
    );
    void reply.code(201);
    return mutation(created, scope.authorization, 'lead:read');
  });

  // PUT 状态流转/认领/分配：action 分派 legacy lead-commands/lead-claim 同链。
  app.put('/api/v1/leads/:leadId/state', async (request, reply) => {
    const repo = requireRepository();
    const leadId = uuid((request.params as { leadId: string }).leadId, 'leadId');
    const body = objectBody(request.body);
    const action = string(body.action, 'action');
    const key = idempotency(request as unknown as ApiRequest);
    if (action === 'claim') {
      const grant = authorizeQuery(scope.authorization, 'lead-pool:claim');
      allow(body, ['action', 'expectedVersion']);
      const result = await repo.claimLead(
        leadId,
        expectedVersion(body.expectedVersion),
        scope.authorization.actor,
        scope.correlationId,
        key,
        grant.scopes,
        grant.anchors,
      );
      void reply.code(200);
      return mutation(result, scope.authorization, 'lead:read');
    }
    if (action === 'transition' || action === 'release') {
      const capability = action === 'release' ? 'lead-pool:release' : 'lead:lifecycle';
      const grant = authorizeQuery(scope.authorization, capability, ['status', 'reason']);
      allow(
        body,
        action === 'release'
          ? ['action', 'expectedVersion', 'reason']
          : ['action', 'status', 'expectedVersion', 'reason'],
      );
      const result = await repo.transitionLead(
        leadId,
        action === 'release' ? 'POOL' : (string(body.status, 'status') as LeadStatus),
        expectedVersion(body.expectedVersion),
        string(body.reason, 'reason'),
        scope.authorization.actor,
        scope.correlationId,
        grant.scopes,
        grant.anchors,
        action === 'release' ? 'CLAIMED' : undefined,
      );
      void reply.code(200);
      return mutation(result, scope.authorization, 'lead:read');
    }
    if (action === 'assign' || action === 'reassign') {
      const capability = action === 'assign' ? 'lead:assign' : 'lead:reassign';
      const grant = authorizeQuery(scope.authorization, capability, ['assigneeId', 'reason']);
      allow(body, ['action', 'assigneeId', 'expectedVersion', 'reason']);
      const result = await repo.assign(
        'LEAD',
        leadId,
        uuid(body.assigneeId, 'assigneeId'),
        expectedVersion(body.expectedVersion),
        string(body.reason, 'reason'),
        scope.authorization.actor,
        scope.correlationId,
        action === 'reassign',
        grant.scopes,
        grant.anchors,
      );
      void reply.code(200);
      return mutation(result, scope.authorization, 'lead:read');
    }
    throw Object.assign(
      new Error('action must be claim, transition, assign, reassign or release'),
      {
        statusCode: 400,
      },
    );
  });
}
