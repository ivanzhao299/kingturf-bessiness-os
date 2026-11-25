// MFG-6（ADR-0015）：MRP 域 Fastify 端点组。
// 读（加性）：
// - GET /api/v1/mrp-policies | mrp-demands | mrp-runs：视图轨迁移——不带查询参数时执行的正是 legacy
//   list 的那一条查询（MRP_LIST_QUERIES），响应与 legacy 全量 { items } 解析后逐键一致且没有
//   nextCursor 键；筛选（关键字 / 枚举）与键集分页（游标 = 末行 id，limit 1..100）为加性；
// - GET /api/v1/mrp-proposals：跨批次的建议列表，行与 legacy 批次行里 proposals[] 的元素同一投影，
//   缺省顺序即 legacy 批次列表摊平后的顺序；runId / state / frozen / type / 关键字筛选为加性；
// - GET /api/v1/mrp-runs/:runId：批次详情——根行与 calculations / proposals 聚合同 legacy 批次行，
//   另带解释行项（需求快照与来源单据、BOM 展开行、可用库存明细、在途采购、执行工单），后四类按
//   各自的读权限门控，未授权不带该键。
// 写（分派既有命令，与 legacy 同一条解析链、调用同一批仓储方法；legacy 轨逐字保留，双轨并行）：
// - POST /api/v1/mrp-policies            ↔ mrp-policy-create.ts      → createPolicy；
// - POST /api/v1/mrp-demands             ↔ mrp-demand-create.ts      → createDemand；
// - POST /api/v1/mrp-runs                ↔ mrp-run-create.ts         → run；
// - POST /api/v1/mrp-proposals/:id/:action ↔ mrp-proposal-commands.ts → transitionProposal。
// 零新写语义。建议决定的数据库守卫拒绝（RAISE EXCEPTION → SQLSTATE P0001）在这四个端点上映射为
// 409 加中文提示；未列入白名单的拒绝原样抛出（仍是 500，照常留诊断日志），其余端点与 legacy 轨不变。
import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../../app.ts';
import {
  allow,
  calendarDate,
  decimal,
  integer,
  jsonObject,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { guardRejection } from '../../pg-rejections.ts';
import type {
  MrpDemandPageFilter,
  MrpPage,
  MrpPolicyPageFilter,
  MrpProposalPageFilter,
  MrpRunPageFilter,
} from '../../mrp-read-repositories.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type MrpRepository = Pick<
  NonNullable<ApiDependencies['mrp']>,
  | 'listPolicyPage'
  | 'listDemandPage'
  | 'listRunPage'
  | 'listProposalPage'
  | 'findRun'
  | 'createPolicy'
  | 'createDemand'
  | 'run'
  | 'transitionProposal'
>;
type CreatePolicy = MrpRepository['createPolicy'];
type PolicyInput = Readonly<Parameters<CreatePolicy>[0]>;
type CreateDemand = MrpRepository['createDemand'];
type DemandInput = Readonly<Parameters<CreateDemand>[0]>;
type Run = MrpRepository['run'];
type RunInput = Readonly<Parameters<Run>[0]>;
type Transition = MrpRepository['transitionProposal'];
type TransitionState = Parameters<Transition>[1];
type TransitionInput = Readonly<Parameters<Transition>[2]>;

const RUN_STATUSES = ['DRAFT', 'COMPUTED', 'APPROVED', 'CANCELLED'] as const;
const PROPOSAL_STATES = ['PROPOSED', 'APPROVED', 'REJECTED', 'RELEASED', 'CANCELLED'] as const;
const PROPOSAL_TYPES = ['PURCHASE', 'PRODUCTION'] as const;
const PAGE_LIMIT_MAX = 100;

// 行键为 pg to_jsonb 蛇形命名 + 列表头列驼峰键（legacy 同形态）；数量列是 JSON 数字（numeric 经
// to_jsonb）；looseObject 透传 + .partial() 守恒口径（字段裁剪后的行仍通过响应 schema）。
const OBJECT = z.record(z.string(), z.unknown());
const POLICY_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    item_version_id: z.string(),
    sku: z.string(),
    itemName: z.string(),
    itemVersion: z.number(),
    make_or_buy: z.string(),
    safety_stock: z.number(),
    minimum_order_quantity: z.number(),
    order_multiple: z.number(),
    lead_time_days: z.number(),
    freeze_window_days: z.number(),
    effective_at: z.string(),
    created_by: z.string(),
    created_at: z.string(),
    canonical_hash: z.string(),
  })
  .partial();
const DEMAND_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    item_version_id: z.string(),
    sku: z.string(),
    itemName: z.string(),
    itemVersion: z.number(),
    source_type: z.string(),
    source_id: z.string(),
    required_at: z.string(),
    quantity: z.number(),
    priority: z.number(),
    created_by: z.string(),
    created_at: z.string(),
    canonical_hash: z.string(),
  })
  .partial();
const RUN_ROOT_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    run_number: z.string(),
    status: z.string(),
    as_of: z.string(),
    horizon_end: z.string(),
    freeze_until: z.string(),
    input_hash: z.string(),
    computed_at: z.string().nullable(),
    approved_at: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
  })
  .partial();
const CALCULATION_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    mrp_run_id: z.string(),
    item_version_id: z.string(),
    sku: z.string(),
    itemName: z.string(),
    required_at: z.string(),
    gross_demand: z.number(),
    on_hand: z.number(),
    scheduled_receipts: z.number(),
    safety_stock: z.number(),
    net_requirement: z.number(),
    planned_quantity: z.number(),
    make_or_buy: z.string(),
    policy_id: z.string().nullable(),
    trace: OBJECT,
    canonical_hash: z.string(),
  })
  .partial();
const PROPOSAL_EVENT_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    proposal_id: z.string(),
    sequence: z.number(),
    state: z.string(),
    reason: z.string(),
    evidence: OBJECT,
    actor_id: z.string(),
    correlation_id: z.string(),
    canonical_hash: z.string(),
    created_at: z.string(),
  })
  .partial();
const PROPOSAL_ROW_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    mrp_run_id: z.string(),
    calculation_id: z.string(),
    item_version_id: z.string(),
    sku: z.string(),
    itemName: z.string(),
    proposal_type: z.string(),
    quantity: z.number(),
    start_at: z.string(),
    due_at: z.string(),
    frozen: z.boolean(),
    explanation: OBJECT,
    effectiveState: z.string(),
    canonical_hash: z.string(),
    created_at: z.string(),
    events: z.array(PROPOSAL_EVENT_SCHEMA),
  })
  .partial();
const RUN_ROW_SCHEMA = RUN_ROOT_SCHEMA.extend({
  calculations: z.array(CALCULATION_SCHEMA),
  proposals: z.array(PROPOSAL_ROW_SCHEMA),
}).partial();
// 批次详情的解释行项（additive）。批次不保存 BOM / 库存快照：这些行项是按当前数据还原的。
const DEMAND_SNAPSHOT_SCHEMA = z
  .looseObject({
    id: z.string(),
    tenant_id: z.string(),
    mrp_run_id: z.string(),
    demand_signal_id: z.string(),
    item_version_id: z.string(),
    sku: z.string(),
    itemName: z.string(),
    itemVersion: z.number(),
    itemType: z.string(),
    baseUnitCode: z.string(),
    required_at: z.string(),
    quantity: z.number(),
    source_type: z.string(),
    source_id: z.string(),
    source: z
      .looseObject({
        kind: z.string(),
        id: z.string(),
        // 来源不是销售订单（或账号读不到订单）时为 null。
        orderNumber: z.string().nullable().optional(),
        orderStatus: z.string().nullable().optional(),
      })
      .partial(),
  })
  .partial();
const BOM_EDGE_SCHEMA = z
  .looseObject({
    parentItemVersionId: z.string(),
    parentSku: z.string(),
    parentItemName: z.string(),
    bomVersionId: z.string(),
    bomCode: z.string(),
    outputQuantity: z.number(),
    lineNumber: z.number(),
    componentItemVersionId: z.string(),
    componentSku: z.string(),
    componentItemName: z.string(),
    componentItemType: z.string(),
    componentBaseUnitCode: z.string(),
    quantity: z.number(),
    scrapBasisPoints: z.number(),
  })
  .partial();
const INVENTORY_OFFSET_SCHEMA = z
  .looseObject({
    itemVersionId: z.string(),
    sku: z.string(),
    itemName: z.string(),
    lotId: z.string(),
    lotNumber: z.string(),
    locationId: z.string().nullable(),
    locationCode: z.string().nullable(),
    locationName: z.string().nullable(),
    quantity: z.number(),
  })
  .partial();
const SCHEDULED_RECEIPT_SCHEMA = z
  .looseObject({
    itemVersionId: z.string(),
    sku: z.string(),
    itemName: z.string(),
    purchaseOrderId: z.string(),
    poNumber: z.string(),
    lineNumber: z.number(),
    orderedQuantity: z.number(),
    receivedQuantity: z.number(),
    openQuantity: z.number(),
    requiredAt: z.string(),
    poStatus: z.string(),
  })
  .partial();
const EXECUTION_SCHEMA = z
  .looseObject({
    proposalId: z.string(),
    orderId: z.string(),
    orderNumber: z.string(),
    state: z.string(),
    plannedQuantity: z.number(),
    plannedStartAt: z.string(),
    plannedDueAt: z.string(),
  })
  .partial();
const runDetailSchema = RUN_ROOT_SCHEMA.extend({
  calculations: z.array(CALCULATION_SCHEMA),
  proposals: z.array(PROPOSAL_ROW_SCHEMA),
  demandSnapshots: z.array(DEMAND_SNAPSHOT_SCHEMA),
  bomEdges: z.array(BOM_EDGE_SCHEMA).optional(),
  inventoryOffsets: z.array(INVENTORY_OFFSET_SCHEMA).optional(),
  scheduledReceipts: z.array(SCHEDULED_RECEIPT_SCHEMA).optional(),
  executions: z.array(EXECUTION_SCHEMA).optional(),
}).partial();
const notFoundSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlationId: z.string() }),
});

const pageSchema = <T extends z.ZodType>(row: T) =>
  z.object({ items: z.array(row), nextCursor: z.string().optional() });
// 筛选关键字 trim 后 1..100 字符；limit 1..100；游标是不透明令牌（末行 id）。
const keyword = z.string().trim().min(1).max(100).optional();
const paging = {
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
};
const policyQuerySchema = z.object({
  query: keyword,
  makeOrBuy: z.enum(['MAKE', 'BUY']).optional(),
  ...paging,
});
const demandQuerySchema = z.object({
  query: keyword,
  sourceType: z.string().trim().min(1).max(64).optional(),
  ...paging,
});
const runQuerySchema = z.object({
  query: keyword,
  status: z.enum(RUN_STATUSES).optional(),
  ...paging,
});
const proposalQuerySchema = z.object({
  runId: z.string().trim().min(1).max(64).optional(),
  state: z.enum(PROPOSAL_STATES).optional(),
  frozen: z.enum(['true', 'false']).optional(),
  type: z.enum(PROPOSAL_TYPES).optional(),
  query: keyword,
  ...paging,
});

// 建议决定的四个动作 → 目标状态，与 legacy mrp-proposal-commands.ts 的 states 表逐一对应；能否
// 从当前状态迁移的权威在数据库触发器 validate_mrp_proposal_event（迁移 0039）。
const PROPOSAL_ACTIONS = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  release: 'RELEASED',
  cancel: 'CANCELLED',
} as const satisfies Readonly<Record<string, TransitionState>>;
const proposalActionOf = (
  value: string,
): Readonly<(typeof PROPOSAL_ACTIONS)[keyof typeof PROPOSAL_ACTIONS]> | null =>
  Object.hasOwn(PROPOSAL_ACTIONS, value)
    ? PROPOSAL_ACTIONS[value as keyof typeof PROPOSAL_ACTIONS]
    : null;

// 与 legacy mutationDto(读权限) 同口径（按读权限的字段裁剪写响应）：有读权限按它的字段清单裁剪
//（清单为 null 表示不裁），没有读权限只回 version。
const mutationOf =
  (scope: FastifyRouteScope, read: PermissionKey) =>
  (value: Record<string, unknown>): Record<string, unknown> => {
    const grant = scope.authorization.permissions.get(read);
    return permittedDto(value, grant ? grant.fields : ['version']);
  };

// 能力键 → 作用域上下文（legacy 各路由的 scopeContext 同式：actor + grant.scopes + grant.anchors）。
const scopedContextBy =
  (scope: FastifyRouteScope) => (capability: PermissionKey, keys?: readonly string[]) => {
    const grant = authorizeQuery(scope.authorization, capability, keys);
    return { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
  };

// 建议决定的数据库守卫拒绝（RAISE EXCEPTION → SQLSTATE P0001）→ 409 + 中文提示。与车间执行 /
// 询价端点同一口径（WF-A / MFG-5）：只认守卫触发器里写死的消息，不回显数据库原始消息，未列入
// 下方白名单的拒绝原样抛出（仍是 500，照常留诊断日志）。消息文字来自迁移 0039 / 0040 的触发器
// 函数 validate_mrp_proposal_event 与 validate_mrp_proposal_event_run_state。
const PROPOSAL_GUARD_HINTS = {
  'proposal requires approval, rejection, or cancellation':
    '这条建议不在可做决定的状态，请刷新后查看当前状态',
  'approved proposal can only be released': '已批准的建议只能下达，不能再次批准或拒绝',
  'closed proposal is immutable': '这条建议已结束（已驳回、已下达或已取消），不能再变更',
  'frozen proposal approval requires override evidence':
    '冻结窗口内的建议，批准时必须提供冻结覆盖审批编号',
  'proposal decisions require a computed active MRP run': '所属计算批次已关闭，不能再对建议做决定',
} as const;
// 只包住仓储调用的结果（调用本身仍是处理器里的直接调用）：触发器拒绝 → conflict，其余原样抛出。
const settled = async <T>(pending: Promise<T>): Promise<T> => {
  try {
    return await pending;
  } catch (error: unknown) {
    const hint = guardRejection(error, PROPOSAL_GUARD_HINTS);
    if (hint === null) throw error;
    throw new DomainError('conflict', hint);
  }
};

// 两组路由共用的解析结果：仓储取用、作用域上下文与字段裁剪。
type MrpRouteContext = Readonly<{
  requireRepository: () => MrpRepository;
  scoped: (
    capability: PermissionKey,
    keys?: readonly string[],
  ) => ReturnType<ReturnType<typeof scopedContextBy>>;
  fieldsOf: (capability: PermissionKey) => readonly string[] | null;
}>;
const routeContext = (scope: FastifyRouteScope): MrpRouteContext => {
  const repository: MrpRepository | null = scope.dependencies.mrp ?? null;
  return {
    requireRepository: () => {
      if (!repository)
        throw Object.assign(new Error('MRP dependency unavailable'), { statusCode: 503 });
      return repository;
    },
    scoped: scopedContextBy(scope),
    fieldsOf: (capability) => scope.authorization.permissions.get(capability)?.fields ?? null,
  };
};
const listed = (
  page: MrpPage,
  fieldsOf: MrpRouteContext['fieldsOf'],
  capability: PermissionKey,
) => ({
  items: page.items.map((item) => permittedDto(item, fieldsOf(capability))),
  ...(page.nextCursor === null ? {} : { nextCursor: page.nextCursor }),
});

// 读端点：三个 legacy 列表的视图轨迁移（无查询参数时与 legacy { items } 解析后逐键一致，无
// nextCursor）、跨批次的建议列表、批次详情。
export function registerMrpReadRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const { requireRepository, scoped, fieldsOf } = routeContext(scope);
  app.get(
    '/api/v1/mrp-policies',
    {
      schema: { querystring: policyQuerySchema, response: { 200: pageSchema(POLICY_ROW_SCHEMA) } },
    },
    async (request) => {
      const query = request.query;
      const filter: MrpPolicyPageFilter = {
        ...(query.makeOrBuy === undefined ? {} : { makeOrBuy: query.makeOrBuy }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const page = await requireRepository().listPolicyPage(scoped('mrp-policy:read'), filter);
      return listed(page, fieldsOf, 'mrp-policy:read');
    },
  );
  app.get(
    '/api/v1/mrp-demands',
    {
      schema: { querystring: demandQuerySchema, response: { 200: pageSchema(DEMAND_ROW_SCHEMA) } },
    },
    async (request) => {
      const query = request.query;
      const filter: MrpDemandPageFilter = {
        ...(query.sourceType === undefined ? {} : { sourceType: query.sourceType }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const page = await requireRepository().listDemandPage(scoped('mrp:read'), filter);
      return listed(page, fieldsOf, 'mrp:read');
    },
  );
  app.get(
    '/api/v1/mrp-runs',
    { schema: { querystring: runQuerySchema, response: { 200: pageSchema(RUN_ROW_SCHEMA) } } },
    async (request) => {
      const query = request.query;
      const filter: MrpRunPageFilter = {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const page = await requireRepository().listRunPage(scoped('mrp:read'), filter);
      return listed(page, fieldsOf, 'mrp:read');
    },
  );
  // 跨批次的建议列表：缺省顺序 = legacy 批次列表摊平。
  app.get(
    '/api/v1/mrp-proposals',
    {
      schema: {
        querystring: proposalQuerySchema,
        response: { 200: pageSchema(PROPOSAL_ROW_SCHEMA) },
      },
    },
    async (request) => {
      const query = request.query;
      const filter: MrpProposalPageFilter = {
        ...(query.runId === undefined ? {} : { runId: uuid(query.runId, 'runId') }),
        ...(query.state === undefined ? {} : { state: query.state }),
        ...(query.frozen === undefined ? {} : { frozen: query.frozen === 'true' }),
        ...(query.type === undefined ? {} : { proposalType: query.type }),
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      };
      const page = await requireRepository().listProposalPage(scoped('mrp:read'), filter);
      return listed(page, fieldsOf, 'mrp:read');
    },
  );
  // 批次详情：additive 只读（mrp:read + 字段裁剪同读轨；解释行项按各自的读权限门控）。
  app.get(
    '/api/v1/mrp-runs/:runId',
    { schema: { response: { 200: runDetailSchema, 404: notFoundSchema } } },
    async (request, reply) => {
      const runId = uuid((request.params as { runId: string }).runId, 'runId');
      const may = (capability: PermissionKey) => scope.authorization.permissions.has(capability);
      const found = await requireRepository().findRun(runId, scoped('mrp:read'), {
        orderSources: may('sales-order:read'),
        bom: may('bom:read'),
        inventory: may('inventory:read'),
        receipts: may('procurement:read'),
        executions: may('production:read'),
      });
      if (!found) {
        void reply.code(404).send({
          error: {
            code: 'not_found',
            message: 'MRP run not found',
            correlationId: scope.correlationId,
          },
        });
        return;
      }
      return permittedDto(found, fieldsOf('mrp:read'));
    },
  );
}

// 写端点：各自分派既有命令（与 legacy 同一条解析链、调用同一批仓储方法）。
export function registerMrpWriteRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const { requireRepository, scoped } = routeContext(scope);
  // POST 计划政策：legacy mrp-policy-create.ts 同解析链（allow 八字段 → 枚举 → 逐字段解析）。
  app.post('/api/v1/mrp-policies', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, [
      'itemVersionId',
      'safetyStock',
      'minimumOrderQuantity',
      'orderMultiple',
      'leadTimeDays',
      'freezeWindowDays',
      'makeOrBuy',
      'effectiveAt',
    ]);
    const context = scoped('mrp-policy:manage', Object.keys(body));
    const makeOrBuy = string(body.makeOrBuy, 'makeOrBuy');
    if (!['MAKE', 'BUY'].includes(makeOrBuy))
      throw new DomainError('invalid_request', 'makeOrBuy is unsupported');
    const input: PolicyInput = {
      itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
      safetyStock: decimal(body.safetyStock, 'safetyStock'),
      minimumOrderQuantity: decimal(body.minimumOrderQuantity, 'minimumOrderQuantity'),
      orderMultiple: decimal(body.orderMultiple, 'orderMultiple'),
      leadTimeDays: integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
      freezeWindowDays: integer(body.freezeWindowDays, 'freezeWindowDays', 0, 3650),
      makeOrBuy: makeOrBuy as PolicyInput['makeOrBuy'],
      effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
    };
    const created = await requireRepository().createPolicy(input, context, scope.correlationId);
    void reply.code(201);
    return mutationOf(scope, 'mrp-policy:read')(created);
  });

  // POST 需求信号：legacy mrp-demand-create.ts 同解析链。
  app.post('/api/v1/mrp-demands', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, ['itemVersionId', 'sourceType', 'sourceId', 'requiredAt', 'quantity', 'priority']);
    const context = scoped('mrp:run', Object.keys(body));
    const input: DemandInput = {
      itemVersionId: uuid(body.itemVersionId, 'itemVersionId'),
      sourceType: assertStableCode(string(body.sourceType, 'sourceType')),
      sourceId: uuid(body.sourceId, 'sourceId'),
      requiredAt: calendarDate(body.requiredAt, 'requiredAt'),
      quantity: decimal(body.quantity, 'quantity'),
      priority: integer(body.priority ?? 100, 'priority', 1, 100000),
    };
    const created = await requireRepository().createDemand(input, context, scope.correlationId);
    void reply.code(201);
    return mutationOf(scope, 'mrp:read')(created);
  });

  // POST 运行计算：legacy mrp-run-create.ts 同解析链。
  app.post('/api/v1/mrp-runs', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, ['runNumber', 'asOf', 'horizonEnd']);
    const context = scoped('mrp:run', Object.keys(body));
    const input: RunInput = {
      runNumber: assertStableCode(string(body.runNumber, 'runNumber')),
      asOf: timestamp(body.asOf, 'asOf'),
      horizonEnd: calendarDate(body.horizonEnd, 'horizonEnd'),
    };
    const computed = await requireRepository().run(input, context, scope.correlationId);
    void reply.code(201);
    return mutationOf(scope, 'mrp:read')(computed);
  });

  // POST 建议决定（approve / reject / release / cancel）：legacy mrp-proposal-commands.ts 同解析链
  //（能力键：release 用 mrp:release，其余用 mrp:approve；状态机权威在数据库触发器）。
  app.post('/api/v1/mrp-proposals/:proposalId/:action', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, ['reason', 'evidence']);
    // 认领清单只放行这四个动作（其余落回 legacy 轨）；这里的守卫只是不让未知动作变成 undefined 状态。
    const action = (request.params as { action: string }).action;
    const target = proposalActionOf(action);
    if (!target)
      throw Object.assign(new Error('action must be one of approve, reject, release, cancel'), {
        statusCode: 400,
      });
    const capability = action === 'release' ? 'mrp:release' : 'mrp:approve';
    const context = scoped(capability, Object.keys(body));
    const proposalId = uuid((request.params as { proposalId: string }).proposalId, 'proposalId');
    const input: TransitionInput = {
      reason: string(body.reason, 'reason'),
      evidence: jsonObject(body.evidence ?? {}, 'evidence'),
    };
    const decided = await settled(
      requireRepository().transitionProposal(
        proposalId,
        target,
        input,
        context,
        scope.correlationId,
      ),
    );
    void reply.code(201);
    return mutationOf(scope, 'mrp:read')(decided);
  });
}
