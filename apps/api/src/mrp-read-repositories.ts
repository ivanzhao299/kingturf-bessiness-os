// MFG-6（ADR-0015）：MRP 域 additive 只读仓储——计划政策 / 需求信号 / 计算批次 / 建议四个列表的
// 键集分页与筛选，以及计算批次详情（解释一条建议的净需求所需的行项）。写路径
//（createPolicy / createDemand / run / transitionProposal）留在 mrp-repositories.ts，
// PostgresMrpRepository 继承本类（沿 production-read-repositories 先例）。
//
// 守恒口径：三个 legacy 列表的行投影与整条查询提取为模块常量，legacy list 与分页方法共用同一段
// SQL（提取前后逐字节相等）；分页方法不带筛选、游标与 limit 时执行的正是 legacy 那一条查询。
// 筛选值、游标与 limit 一律经 values.push 参数化（$N），游标是末行 id（不透明令牌）。
import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;

// 与 mrp-repositories.ts 同一作用域门、同一消息（行为守恒）。
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'MRP planning requires company scope');
};

// 行投影：legacy list、additive 分页与详情共用（列集与键序同 legacy 列表行）。
export const MRP_POLICY_PROJECTION = `to_jsonb(p)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version)`;
export const MRP_DEMAND_PROJECTION = `to_jsonb(d)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version)`;
export const MRP_RUN_PROJECTION = `to_jsonb(r)||jsonb_build_object(
        'calculations',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('sku',i.sku,'itemName',i.name) ORDER BY c.required_at,i.sku)
          FROM mrp_item_calculations c JOIN manufacturing_item_versions v ON v.id=c.item_version_id AND v.tenant_id=c.tenant_id
          JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE c.mrp_run_id=r.id AND c.tenant_id=r.tenant_id),'[]'::jsonb),
        'proposals',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('sku',i.sku,'itemName',i.name,'effectiveState',s.state,'events',
          coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM mrp_proposal_events e WHERE e.proposal_id=p.id AND e.tenant_id=p.tenant_id),'[]'::jsonb)) ORDER BY p.due_at,i.sku)
          FROM mrp_proposals p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id
          JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id JOIN mrp_proposal_effective_states s ON s.proposal_id=p.id AND s.tenant_id=p.tenant_id
          WHERE p.mrp_run_id=r.id AND p.tenant_id=r.tenant_id),'[]'::jsonb))`;
// 建议行：与 legacy 批次行里 proposals[] 的元素同一投影（跨批次的建议列表与批次详情共用）。
export const MRP_PROPOSAL_PROJECTION = `to_jsonb(p)||jsonb_build_object('sku',i.sku,'itemName',i.name,'effectiveState',s.state,'events',
          coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM mrp_proposal_events e WHERE e.proposal_id=p.id AND e.tenant_id=p.tenant_id),'[]'::jsonb))`;

// legacy list 的三条查询（提取前是 list() 内联的同一段文本）。
export const MRP_LIST_QUERIES = {
  policies: `SELECT ${MRP_POLICY_PROJECTION} item
        FROM mrp_planning_policies p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE p.tenant_id=$1 ORDER BY i.sku,p.effective_at DESC`,
  demands: `SELECT ${MRP_DEMAND_PROJECTION} item
        FROM mrp_demand_signals d JOIN manufacturing_item_versions v ON v.id=d.item_version_id AND v.tenant_id=d.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE d.tenant_id=$1 ORDER BY d.required_at,d.priority,i.sku`,
  runs: `SELECT ${MRP_RUN_PROJECTION} item
        FROM mrp_runs r WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
} as const;

export type MrpRunStatus = 'DRAFT' | 'COMPUTED' | 'APPROVED' | 'CANCELLED';
export type MrpProposalState = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RELEASED' | 'CANCELLED';
export type MrpProposalType = 'PURCHASE' | 'PRODUCTION';
export type MrpMakeOrBuy = 'MAKE' | 'BUY';

// 分页过滤器：全部缺省时与 legacy list 走同一条查询（全量，nextCursor 恒 null）；任一生效时启用
// 窗口，行序在 legacy 排序键之后补 id 作为并列行的确定性次序。
export type MrpPolicyPageFilter = Readonly<{
  // 物料 SKU / 名称关键字（大小写不敏感子串）。
  query?: string;
  makeOrBuy?: MrpMakeOrBuy;
  cursor?: string;
  limit?: number;
}>;
export type MrpDemandPageFilter = Readonly<{
  // 物料 SKU / 名称 / 来源类型关键字。
  query?: string;
  sourceType?: string;
  cursor?: string;
  limit?: number;
}>;
export type MrpRunPageFilter = Readonly<{
  // 运行编号关键字。
  query?: string;
  status?: MrpRunStatus;
  cursor?: string;
  limit?: number;
}>;
export type MrpProposalPageFilter = Readonly<{
  // 所属计算批次；缺省为全部批次。
  runId?: string;
  state?: MrpProposalState;
  frozen?: boolean;
  freezeOverride?: boolean;
  proposalType?: MrpProposalType;
  // 物料 SKU / 名称关键字。
  query?: string;
  cursor?: string;
  limit?: number;
}>;
export type MrpPage = Readonly<{ items: readonly JsonObject[]; nextCursor: string | null }>;

// 详情的解释行项按调用方读权限门控：未授权的行项不查询、响应里也不带该键。
export type MrpRunDetailParts = Readonly<{
  // 需求来源里的销售订单编号与状态（sales-order:read）。
  orderSources: boolean;
  // 计算时展开用到的 BOM 行（bom:read）。
  bom: boolean;
  // 可用库存的批次 / 库位明细（inventory:read）。
  inventory: boolean;
  // 在途采购（未收完的采购订单行，procurement:read）。
  receipts: boolean;
  // 由本批次建议建立的生产工单（production:read）。
  executions: boolean;
}>;

// 需求快照查询（两条固定语句）。快照表没有优先级列，排序取自它引用的需求信号（不可变台账）。
const DEMAND_SNAPSHOT_FROM = `FROM mrp_demand_snapshots d JOIN manufacturing_item_versions v ON v.id=d.item_version_id AND v.tenant_id=d.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
        JOIN mrp_demand_signals s ON s.id=d.demand_signal_id AND s.tenant_id=d.tenant_id`;
// 公开 API 的来源词表是 SALES-ORDER；迁移 0051 之前写入的行是 SALES_ORDER，两种都认。
const DEMAND_SNAPSHOTS = `SELECT to_jsonb(d)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version,'itemType',i.item_type,'baseUnitCode',i.base_unit_code,
          'source',jsonb_build_object('kind',CASE WHEN d.source_type IN('SALES_ORDER','SALES-ORDER') THEN 'SALES_ORDER' ELSE d.source_type END,'id',d.source_id)) item
        ${DEMAND_SNAPSHOT_FROM}
        WHERE d.tenant_id=$1 AND d.mrp_run_id=$2 ORDER BY d.required_at,s.priority,d.id`;
const DEMAND_SNAPSHOTS_WITH_SOURCE = `SELECT to_jsonb(d)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version,'itemType',i.item_type,'baseUnitCode',i.base_unit_code,
          'source',jsonb_build_object('kind',CASE WHEN d.source_type IN('SALES_ORDER','SALES-ORDER') THEN 'SALES_ORDER' ELSE d.source_type END,'id',d.source_id,'orderNumber',o.order_number,'orderStatus',o.status)) item
        ${DEMAND_SNAPSHOT_FROM}
        LEFT JOIN sales_orders o ON d.source_type IN('SALES_ORDER','SALES-ORDER') AND o.id=d.source_id AND o.tenant_id=d.tenant_id
        WHERE d.tenant_id=$1 AND d.mrp_run_id=$2 ORDER BY d.required_at,s.priority,d.id`;

const PAGE_LIMIT_MAX = 100;
// 键集游标 = 末行 id（不透明令牌）。
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const parseMrpCursor = (cursor: string): string => {
  if (!UUID_PATTERN.test(cursor))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return cursor.toLowerCase();
};

// 窗口形态：limit 多取一行判定是否还有下一页。
const windowOf = (values: unknown[], limit: number | undefined): number | null => {
  if (limit === undefined) return null;
  const capped = Math.min(Math.max(limit, 1), PAGE_LIMIT_MAX);
  values.push(capped + 1);
  return capped;
};
const pageOf = (rows: readonly { item: JsonObject }[], limit: number | null): MrpPage => {
  const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
  const last = limit !== null && rows.length > limit ? items[limit - 1] : null;
  return { items, nextCursor: typeof last?.id === 'string' ? last.id : null };
};

export class PostgresMrpReadRepository {
  public constructor(protected readonly db: Db) {}

  public async listPolicyPage(context: Context, filter: MrpPolicyPageFilter): Promise<MrpPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.makeOrBuy !== undefined) clauses.push(`p.make_or_buy=${add(filter.makeOrBuy)}`);
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(i.sku||' '||i.name),lower(${add(filter.query)}))>0`);
    // 键集游标：游标行的行序键经 LATERAL 子查询取得（并进 FROM），比较条件并入 WHERE。
    let keyset = '';
    if (filter.cursor !== undefined) {
      values.push(parseMrpCursor(filter.cursor));
      keyset = ` JOIN LATERAL(SELECT i0.sku anchor_sku,p0.effective_at anchor_at,p0.id anchor_id FROM mrp_planning_policies p0 JOIN manufacturing_item_versions v0 ON v0.id=p0.item_version_id AND v0.tenant_id=p0.tenant_id JOIN manufacturing_items i0 ON i0.id=v0.item_id AND i0.tenant_id=v0.tenant_id WHERE p0.tenant_id=$1 AND p0.id=$${String(values.length)}) a ON true`;
      clauses.push(
        `(i.sku>a.anchor_sku OR (i.sku=a.anchor_sku AND (p.effective_at<a.anchor_at OR (p.effective_at=a.anchor_at AND p.id>$${String(values.length)}))))`,
      );
    }
    const limit = windowOf(values, filter.limit);
    const limitClause = limit === null ? '' : ` LIMIT $${String(values.length)}`;
    const window = clauses.length > 0 || keyset !== '' || limit !== null;
    const sql = window
      ? `SELECT ${MRP_POLICY_PROJECTION} item FROM mrp_planning_policies p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id${keyset} WHERE p.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''} ORDER BY i.sku,p.effective_at DESC,p.id${limitClause}`
      : MRP_LIST_QUERIES.policies;
    return pageOf((await this.db.query<{ item: JsonObject }>(sql, values)).rows, limit);
  }

  public async listDemandPage(context: Context, filter: MrpDemandPageFilter): Promise<MrpPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.sourceType !== undefined) clauses.push(`d.source_type=${add(filter.sourceType)}`);
    if (filter.query !== undefined)
      clauses.push(
        `strpos(lower(i.sku||' '||i.name||' '||d.source_type),lower(${add(filter.query)}))>0`,
      );
    let keyset = '';
    if (filter.cursor !== undefined) {
      values.push(parseMrpCursor(filter.cursor));
      keyset = ` JOIN LATERAL(SELECT d0.required_at anchor_at,d0.priority anchor_priority,i0.sku anchor_sku FROM mrp_demand_signals d0 JOIN manufacturing_item_versions v0 ON v0.id=d0.item_version_id AND v0.tenant_id=d0.tenant_id JOIN manufacturing_items i0 ON i0.id=v0.item_id AND i0.tenant_id=v0.tenant_id WHERE d0.tenant_id=$1 AND d0.id=$${String(values.length)}) a ON true`;
      clauses.push(
        `(d.required_at,d.priority,i.sku,d.id)>(a.anchor_at,a.anchor_priority,a.anchor_sku,$${String(values.length)})`,
      );
    }
    const limit = windowOf(values, filter.limit);
    const limitClause = limit === null ? '' : ` LIMIT $${String(values.length)}`;
    const window = clauses.length > 0 || keyset !== '' || limit !== null;
    const sql = window
      ? `SELECT ${MRP_DEMAND_PROJECTION} item FROM mrp_demand_signals d JOIN manufacturing_item_versions v ON v.id=d.item_version_id AND v.tenant_id=d.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id${keyset} WHERE d.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''} ORDER BY d.required_at,d.priority,i.sku,d.id${limitClause}`
      : MRP_LIST_QUERIES.demands;
    return pageOf((await this.db.query<{ item: JsonObject }>(sql, values)).rows, limit);
  }

  public async listRunPage(context: Context, filter: MrpRunPageFilter): Promise<MrpPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.status !== undefined) clauses.push(`r.status=${add(filter.status)}`);
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(r.run_number),lower(${add(filter.query)}))>0`);
    let keyset = '';
    if (filter.cursor !== undefined) {
      values.push(parseMrpCursor(filter.cursor));
      // 行序键经子查询取该行自身，避免时间戳精度损失。
      keyset = ` AND (r.created_at,r.id)<(SELECT x.created_at,x.id FROM mrp_runs x WHERE x.tenant_id=$1 AND x.id=$${String(values.length)}::uuid)`;
    }
    const limit = windowOf(values, filter.limit);
    const limitClause = limit === null ? '' : ` LIMIT $${String(values.length)}`;
    const window = clauses.length > 0 || keyset !== '' || limit !== null;
    const sql = window
      ? `SELECT ${MRP_RUN_PROJECTION} item
        FROM mrp_runs r WHERE r.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''}${keyset} ORDER BY r.created_at DESC,r.id DESC${limitClause}`
      : MRP_LIST_QUERIES.runs;
    return pageOf((await this.db.query<{ item: JsonObject }>(sql, values)).rows, limit);
  }

  // 建议列表（跨批次）：行与 legacy 批次行里 proposals[] 的元素同一投影；行序 = 批次按 legacy
  // 批次序（created_at DESC），批次内按 due_at、SKU——即 legacy 批次列表摊平后的顺序。
  public async listProposalPage(context: Context, filter: MrpProposalPageFilter): Promise<MrpPage> {
    company(context);
    return this.proposalsOf(context, filter);
  }

  // 计算批次详情（additive 只读）：根行与 calculations / proposals 两个聚合同 legacy 批次行，
  // 另带解释行项——需求快照（含来源单据）、BOM 展开行、可用库存明细、在途采购、执行工单。
  // 后四类按读权限门控，未授权不带该键。不存在或跨租户返回 null。
  public async findRun(
    runId: string,
    context: Context,
    parts: MrpRunDetailParts,
  ): Promise<JsonObject | null> {
    company(context);
    const scope: readonly unknown[] = [context.actor.companyId, runId];
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(r) item FROM mrp_runs r WHERE r.tenant_id=$1 AND r.id=$2`,
        scope,
      )
    ).rows[0]?.item;
    if (!root) return null;
    const asOf = root.as_of;
    if (typeof asOf !== 'string') throw new Error('MRP run basis date missing');
    const calculations = await this.calculationsOf(scope);
    const proposals = await this.proposalsOf(context, { runId });
    const snapshots = await this.demandSnapshotsOf(scope, parts.orderSources);
    const [bom, inventory, receipts, executions] = await Promise.all([
      parts.bom ? this.bomEdgesOf(scope, asOf) : Promise.resolve(null),
      parts.inventory ? this.inventoryOffsetsOf(scope) : Promise.resolve(null),
      parts.receipts ? this.scheduledReceiptsOf(scope) : Promise.resolve(null),
      parts.executions ? this.executionsOf(scope) : Promise.resolve(null),
    ]);
    return {
      ...root,
      calculations,
      proposals: proposals.items,
      demandSnapshots: snapshots,
      ...(bom === null ? {} : { bomEdges: bom }),
      ...(inventory === null ? {} : { inventoryOffsets: inventory }),
      ...(receipts === null ? {} : { scheduledReceipts: receipts }),
      ...(executions === null ? {} : { executions }),
    };
  }

  // 计算行：与 legacy 批次行里 calculations[] 的元素同一投影（SKU 与名称）。
  private async calculationsOf(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(c)||jsonb_build_object('sku',i.sku,'itemName',i.name) item
        FROM mrp_item_calculations c JOIN manufacturing_item_versions v ON v.id=c.item_version_id AND v.tenant_id=c.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE c.tenant_id=$1 AND c.mrp_run_id=$2 ORDER BY c.required_at,i.sku`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 建议行读取：批次详情只取一个批次的全部建议（runId，不带窗口）；列表按筛选与键集游标取窗口。
  private async proposalsOf(context: Context, filter: MrpProposalPageFilter): Promise<MrpPage> {
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.runId !== undefined) clauses.push(`p.mrp_run_id=${add(filter.runId)}`);
    if (filter.state !== undefined) clauses.push(`s.state=${add(filter.state)}`);
    if (filter.frozen !== undefined) clauses.push(`p.frozen=${add(filter.frozen)}`);
    if (filter.freezeOverride !== undefined) {
      values.push(filter.freezeOverride);
      clauses.push(
        `EXISTS(SELECT 1 FROM mrp_proposal_events e WHERE e.proposal_id=p.id AND e.tenant_id=p.tenant_id AND e.state='APPROVED' AND NULLIF(btrim(e.evidence->>'freezeOverrideApproval'),'') IS NOT NULL)=$${String(values.length)}`,
      );
    }
    if (filter.proposalType !== undefined)
      clauses.push(`p.proposal_type=${add(filter.proposalType)}`);
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(i.sku||' '||i.name),lower(${add(filter.query)}))>0`);
    let keyset = '';
    if (filter.cursor !== undefined) {
      values.push(parseMrpCursor(filter.cursor));
      keyset = ` JOIN LATERAL(SELECT r0.created_at anchor_created,r0.id anchor_run_id,p0.due_at anchor_due,i0.sku anchor_sku FROM mrp_proposals p0 JOIN mrp_runs r0 ON r0.id=p0.mrp_run_id AND r0.tenant_id=p0.tenant_id JOIN manufacturing_item_versions v0 ON v0.id=p0.item_version_id AND v0.tenant_id=p0.tenant_id JOIN manufacturing_items i0 ON i0.id=v0.item_id AND i0.tenant_id=v0.tenant_id WHERE p0.tenant_id=$1 AND p0.id=$${String(values.length)}) a ON true`;
      // 游标行之后 = 同一批次里排在它后面的建议，或排在该批次之后的批次（批次序 created_at DESC）。
      clauses.push(
        `((r.id=a.anchor_run_id AND (p.due_at,i.sku,p.id)>(a.anchor_due,a.anchor_sku,$${String(values.length)})) OR (r.created_at,r.id)<(a.anchor_created,a.anchor_run_id))`,
      );
    }
    const limit = windowOf(values, filter.limit);
    const limitClause = limit === null ? '' : ` LIMIT $${String(values.length)}`;
    const sql = `SELECT ${MRP_PROPOSAL_PROJECTION} item FROM mrp_proposals p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id
          JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id JOIN mrp_proposal_effective_states s ON s.proposal_id=p.id AND s.tenant_id=p.tenant_id
          JOIN mrp_runs r ON r.id=p.mrp_run_id AND r.tenant_id=p.tenant_id${keyset} WHERE p.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''} ORDER BY r.created_at DESC,r.id DESC,p.due_at,i.sku,p.id${limitClause}`;
    return pageOf((await this.db.query<{ item: JsonObject }>(sql, values)).rows, limit);
  }

  // 需求快照：本批次固定下来的需求信号（按需求日期、优先级排序——快照表不存优先级，取自不可变的
  // 需求信号行）。有销售订单读权限时带订单编号与状态；没有时整条语句不触碰 sales_orders。
  private async demandSnapshotsOf(
    scope: readonly unknown[],
    orderSources: boolean,
  ): Promise<JsonObject[]> {
    const sql = orderSources ? DEMAND_SNAPSHOTS_WITH_SOURCE : DEMAND_SNAPSHOTS;
    return (await this.db.query<{ item: JsonObject }>(sql, scope)).rows.map((row) => row.item);
  }

  // BOM 展开行：与本批次计算同一规则（需求快照物料为根，逐层取基准日已生效的最新已发布 BOM
  // 版本，环处截断，深度上限 20）。批次不保存 BOM 快照，这里按当前已发布版本还原。
  private async bomEdgesOf(scope: readonly unknown[], asOf: string): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `WITH RECURSIVE exploded(item_version_id,path,depth) AS (
          SELECT d.item_version_id,ARRAY[d.item_version_id],0 FROM mrp_demand_snapshots d WHERE d.tenant_id=$1 AND d.mrp_run_id=$2
          UNION ALL
          SELECT l.component_item_version_id,e.path||l.component_item_version_id,e.depth+1
          FROM exploded e JOIN LATERAL(SELECT v.id FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.product_item_version_id=e.item_version_id AND v.status='PUBLISHED' AND v.effective_at<=$3::timestamptz ORDER BY v.effective_at DESC,v.version DESC LIMIT 1)b ON true
          JOIN manufacturing_bom_lines l ON l.bom_version_id=b.id AND l.tenant_id=$1 WHERE e.depth<20 AND NOT l.component_item_version_id=ANY(e.path)
        ), edges AS (
          SELECT DISTINCT e.item_version_id,b.id bom_version_id,b.output_quantity,l.line_number,l.component_item_version_id,l.quantity,l.scrap_basis_points
          FROM exploded e JOIN LATERAL(SELECT v.id,v.output_quantity FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.product_item_version_id=e.item_version_id AND v.status='PUBLISHED' AND v.effective_at<=$3::timestamptz ORDER BY v.effective_at DESC,v.version DESC LIMIT 1)b ON true
          JOIN manufacturing_bom_lines l ON l.bom_version_id=b.id AND l.tenant_id=$1
        )
        SELECT jsonb_build_object('parentItemVersionId',x.item_version_id,'parentSku',pi.sku,'parentItemName',pi.name,'bomVersionId',x.bom_version_id,'bomCode',bm.code,'outputQuantity',x.output_quantity,
          'lineNumber',x.line_number,'componentItemVersionId',x.component_item_version_id,'componentSku',ci.sku,'componentItemName',ci.name,'componentItemType',ci.item_type,'componentBaseUnitCode',ci.base_unit_code,
          'quantity',x.quantity,'scrapBasisPoints',x.scrap_basis_points) item
        FROM edges x JOIN manufacturing_item_versions pv ON pv.id=x.item_version_id AND pv.tenant_id=$1 JOIN manufacturing_items pi ON pi.id=pv.item_id AND pi.tenant_id=pv.tenant_id
        JOIN manufacturing_bom_versions bv ON bv.id=x.bom_version_id AND bv.tenant_id=$1 JOIN manufacturing_boms bm ON bm.id=bv.bom_id AND bm.tenant_id=bv.tenant_id
        JOIN manufacturing_item_versions cv ON cv.id=x.component_item_version_id AND cv.tenant_id=$1 JOIN manufacturing_items ci ON ci.id=cv.item_id AND ci.tenant_id=cv.tenant_id
        ORDER BY pi.sku,x.line_number`,
        [...scope, asOf],
      )
    ).rows.map((row) => row.item);
  }

  // 可用库存明细：与本批次计算同一口径（质量已放行的批次）的当前结存。批次不保存库存快照。
  private async inventoryOffsetsOf(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('itemVersionId',b.item_version_id,'sku',i.sku,'itemName',i.name,'lotId',l.id,'lotNumber',l.lot_number,'locationId',loc.id,'locationCode',loc.code,'locationName',loc.name,'quantity',b.quantity) item
        FROM inventory_balances b JOIN inventory_lot_effective_quality q ON q.lot_id=b.lot_id AND q.tenant_id=b.tenant_id
        JOIN inventory_lots l ON l.id=b.lot_id AND l.tenant_id=b.tenant_id
        LEFT JOIN inventory_locations loc ON loc.id=b.location_id AND loc.tenant_id=b.tenant_id
        JOIN manufacturing_item_versions v ON v.id=b.item_version_id AND v.tenant_id=b.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
        WHERE b.tenant_id=$1 AND q.quality_status='RELEASED' AND b.item_version_id IN(SELECT c.item_version_id FROM mrp_item_calculations c WHERE c.tenant_id=$1 AND c.mrp_run_id=$2)
        ORDER BY i.sku,l.lot_number,loc.code`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 在途采购：本批次计算到的物料上，已签发 / 部分收货的采购订单行及其未收数量（当前值）。
  private async scheduledReceiptsOf(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('itemVersionId',pol.item_version_id,'sku',i.sku,'itemName',i.name,'purchaseOrderId',p.id,'poNumber',p.po_number,'lineNumber',pol.line_number,'orderedQuantity',pol.quantity,
          'receivedQuantity',coalesce(rc.received,0),'openQuantity',pol.quantity-coalesce(rc.received,0),'requiredAt',pol.required_at,'poStatus',p.status) item
        FROM purchase_order_lines pol JOIN purchase_orders p ON p.id=pol.purchase_order_id AND p.tenant_id=pol.tenant_id
        LEFT JOIN LATERAL(SELECT sum(grl.quantity) received FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=pol.id AND grl.tenant_id=pol.tenant_id)rc ON true
        JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
        WHERE pol.tenant_id=$1 AND p.status IN('ISSUED','PARTIALLY_RECEIVED') AND pol.item_version_id IN(SELECT c.item_version_id FROM mrp_item_calculations c WHERE c.tenant_id=$1 AND c.mrp_run_id=$2)
        ORDER BY i.sku,p.po_number,pol.line_number`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 执行工单：引用了本批次建议的生产工单及其当前状态。
  private async executionsOf(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('proposalId',o.mrp_proposal_id,'orderId',o.id,'orderNumber',o.order_number,'state',s.state,'plannedQuantity',o.planned_quantity,'plannedStartAt',o.planned_start_at,'plannedDueAt',o.planned_due_at) item
        FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id
        WHERE o.tenant_id=$1 AND o.mrp_proposal_id IN(SELECT p.id FROM mrp_proposals p WHERE p.tenant_id=$1 AND p.mrp_run_id=$2)
        ORDER BY o.created_at,o.id`,
        scope,
      )
    ).rows.map((row) => row.item);
  }
}
