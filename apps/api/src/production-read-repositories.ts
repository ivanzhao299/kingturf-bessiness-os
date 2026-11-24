// U3-MFG-4（ADR-0015）：生产执行域 additive 只读仓储——工单 keyset 分页与详情聚合。
// 写路径（create/transition/transactMaterial/reportOperation/createOutput）与 legacy
// list 留在 production-repositories.ts，PostgresProductionRepository 继承本类（沿
// manufacturing-read-repositories / procurement-read-repositories 先例）。独立成文件而
// 不并入 manufacturing-read-repositories：工单端点的依赖是 dependencies.production，
// 读方法必须挂在这条仓储链上，路由才不会跨 manufacturing/production 两仓编排
//（service-boundary S3）。
import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;

// 与 production-repositories.ts 同一作用域门、同一消息（行为守恒）。
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Production execution requires company scope');
};

// U3-MFG-4：工单行投影（to_jsonb 工单列 + sku/itemName + 生效状态 + 工序/物料/报工/
// 成品卷/事件五个聚合）——legacy list、additive 分页与详情根行共用同一片段（SQL 字节与
// 提取前逐字一致，行为守恒）。
export const PRODUCTION_ORDER_PROJECTION = `to_jsonb(o)||jsonb_build_object('sku',i.sku,'itemName',i.name,'state',s.state,'stateSequence',s.sequence,
      'operations',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sequence) FROM production_order_operations x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id),'[]'::jsonb),
      'materials',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.occurred_at) FROM production_material_transactions x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id),'[]'::jsonb),
      'reports',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.completed_at) FROM production_operation_reports x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id),'[]'::jsonb),
      'rolls',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.roll_number) FROM production_rolls x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id),'[]'::jsonb),
      'events',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sequence) FROM production_order_events x WHERE x.tenant_id=o.tenant_id AND x.production_order_id=o.id),'[]'::jsonb))`;

export type ProductionOrderState =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';

// U3-MFG-4：工单分页只读过滤器——state/query/cursor/limit 全部缺省时与 legacy list 走
// 同一条 SQL（全量，nextCursor 恒 null）；任一生效时启用窗口：排序键
// (created_at DESC, id DESC) 与 legacy ORDER BY o.created_at DESC 一致（id 为并列行的
// 确定性次序——legacy 对同一 created_at 的行序本就未定义）。
export type ProductionOrderPageFilter = Readonly<{
  state?: ProductionOrderState;
  query?: string;
  cursor?: string;
  limit?: number;
}>;
export type ProductionOrderPage = Readonly<{
  items: readonly JsonObject[];
  nextCursor: string | null;
}>;

// 详情聚合按调用方读权限门控：物料需求取自已发布 BOM 行（bom:read），未授权不查询。
export type ProductionOrderDetailParts = Readonly<{ materialRequirements: boolean }>;

const PAGE_LIMIT_MAX = 100;
// 键集游标 = 末行工单 id（不透明令牌）；行序键经子查询取该行自身，避免时间戳精度损失。
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const parseProductionOrderCursor = (cursor: string): string => {
  if (!UUID_PATTERN.test(cursor))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return cursor.toLowerCase();
};

export class PostgresProductionReadRepository {
  public constructor(protected readonly db: Db) {}

  public async listProductionOrderPage(
    context: Context,
    filter: ProductionOrderPageFilter,
  ): Promise<ProductionOrderPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses = ['o.tenant_id=$1'];
    if (filter.state !== undefined) clauses.push(`s.state=${add(filter.state)}`);
    // 关键字：工单号/产品 SKU/名称大小写不敏感子串（strpos 无通配符语义）。
    if (filter.query !== undefined)
      clauses.push(
        `strpos(lower(o.order_number||' '||i.sku||' '||i.name),lower(${add(filter.query)}))>0`,
      );
    let keyset = '';
    if (filter.cursor !== undefined) {
      values.push(parseProductionOrderCursor(filter.cursor));
      keyset = ` AND (o.created_at,o.id)<(SELECT x.created_at,x.id FROM production_orders x WHERE x.tenant_id=$1 AND x.id=$${String(values.length)}::uuid)`;
    }
    const window = clauses.length > 1 || keyset !== '' || filter.limit !== undefined;
    let limit: number | null = null;
    if (filter.limit !== undefined) {
      limit = Math.min(Math.max(filter.limit, 1), PAGE_LIMIT_MAX);
      // 多取一行判定是否还有下一页。
      values.push(limit + 1);
    } else if (window) values.push(null);
    // 无过滤/游标/窗口时与 legacy list 同一条 SQL（逐字节）；窗口形态恒带 LIMIT
    //（NULL = 不限，参数化占位由末位实参提供）。
    const sql = window
      ? `SELECT ${PRODUCTION_ORDER_PROJECTION} item FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id JOIN manufacturing_item_versions v ON v.tenant_id=o.tenant_id AND v.id=o.item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id WHERE ${clauses.join(' AND ')}${keyset} ORDER BY o.created_at DESC,o.id DESC LIMIT $${String(values.length)}`
      : `SELECT ${PRODUCTION_ORDER_PROJECTION} item
      FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id
      JOIN manufacturing_item_versions v ON v.tenant_id=o.tenant_id AND v.id=o.item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id
      WHERE o.tenant_id=$1 ORDER BY o.created_at DESC`;
    const rows = (await this.db.query<{ item: JsonObject }>(sql, values)).rows;
    const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
    const last = limit !== null && rows.length > limit ? items[limit - 1] : null;
    return {
      items,
      nextCursor: typeof last?.id === 'string' ? last.id : null,
    };
  }

  // U3-MFG-4（ADR-0015）：工单详情只读（additive）——根行（list 同投影）+ 工序进度 +
  // 报工时间线（按工序号）+ 物料需求与分配状态（bom:read 门控）。不存在或跨租户返回 null。
  public async findProductionOrder(
    orderId: string,
    context: Context,
    parts: ProductionOrderDetailParts = { materialRequirements: false },
  ): Promise<JsonObject | null> {
    company(context);
    const scope: readonly unknown[] = [context.actor.companyId, orderId];
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${PRODUCTION_ORDER_PROJECTION} item
      FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id
      JOIN manufacturing_item_versions v ON v.tenant_id=o.tenant_id AND v.id=o.item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id
      WHERE o.tenant_id=$1 AND o.id=$2`,
        scope,
      )
    ).rows[0]?.item;
    if (!root) return null;
    const [operationProgress, reportTimeline, materialRequirements] = await Promise.all([
      this.orderOperationProgress(scope),
      this.orderReportTimeline(scope),
      parts.materialRequirements ? this.orderMaterialRequirements(scope) : Promise.resolve(null),
    ]);
    return {
      ...root,
      operationProgress,
      reportTimeline,
      ...(materialRequirements === null ? {} : { materialRequirements }),
    };
  }

  // 工序进度：每道工序的累计良品/废品/工时/报工次数；completed 与完工门禁同口径
  //（迁移 0042：每道工序累计良品 ≥ 计划数量）。
  private async orderOperationProgress(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',op.id,'sequence',op.sequence,'operationCode',op.operation_code,'operationName',op.name,'workCenter',op.work_center,'plannedQuantity',o.planned_quantity,'reportedGoodQuantity',coalesce(s.good,0),'reportedScrapQuantity',coalesce(s.scrap,0),'reportCount',coalesce(s.reports,0),'laborMinutes',coalesce(s.labor,0),'machineMinutes',coalesce(s.machine,0),'completed',coalesce(s.good,0)>=o.planned_quantity) item
        FROM production_order_operations op JOIN production_orders o ON o.tenant_id=op.tenant_id AND o.id=op.production_order_id
        LEFT JOIN LATERAL(SELECT sum(r.good_quantity) good,sum(r.scrap_quantity) scrap,sum(r.labor_minutes) labor,sum(r.machine_minutes) machine,count(*) reports FROM production_operation_reports r WHERE r.tenant_id=op.tenant_id AND r.production_order_operation_id=op.id)s ON true
        WHERE op.tenant_id=$1 AND op.production_order_id=$2 ORDER BY op.sequence`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 报工时间线：按工序号、完成时间排序。
  private async orderReportTimeline(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',r.id,'productionOrderOperationId',op.id,'sequence',op.sequence,'operationCode',op.operation_code,'operationName',op.name,'goodQuantity',r.good_quantity,'scrapQuantity',r.scrap_quantity,'laborMinutes',r.labor_minutes,'machineMinutes',r.machine_minutes,'startedAt',r.started_at,'completedAt',r.completed_at,'notes',r.notes,'operatorId',r.operator_id,'createdAt',r.created_at) item
        FROM production_operation_reports r JOIN production_order_operations op ON op.tenant_id=r.tenant_id AND op.id=r.production_order_operation_id
        WHERE r.tenant_id=$1 AND r.production_order_id=$2 ORDER BY op.sequence,r.completed_at,r.id`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 物料需求与分配状态：需求取该成品版本的已发布 BOM（选择规则与需求公式同
  // production-cost-repositories 的 planned_quantity），分配为工单物料台账的净领用量
  //（领料 − 退料）；状态在库内以精确数值比较得出。
  private async orderMaterialRequirements(scope: readonly unknown[]): Promise<JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `WITH chosen_bom AS(
          SELECT b.id,b.output_quantity FROM manufacturing_bom_versions b JOIN production_orders o ON o.tenant_id=b.tenant_id AND o.item_version_id=b.product_item_version_id
          WHERE o.tenant_id=$1 AND o.id=$2 AND b.status='PUBLISHED' ORDER BY b.published_at DESC LIMIT 1)
        ,actual_material AS(
          SELECT t.item_version_id,trunc(sum(CASE WHEN t.transaction_type='ISSUE' THEN t.quantity ELSE -t.quantity END),6) actual_quantity
          FROM production_material_transactions t WHERE t.tenant_id=$1 AND t.production_order_id=$2 GROUP BY t.item_version_id)
        SELECT jsonb_build_object('lineNumber',l.line_number,'componentItemVersionId',l.component_item_version_id,'sku',i.sku,'itemName',i.name,'itemType',i.item_type,'baseUnitCode',i.base_unit_code,'bomQuantity',l.quantity,'scrapBasisPoints',l.scrap_basis_points,'bomOutputQuantity',c.output_quantity,
          'plannedQuantity',trunc(l.quantity*(1+l.scrap_basis_points::numeric/10000)*o.planned_quantity/c.output_quantity,6),
          'actualQuantity',coalesce(a.actual_quantity,0),
          'allocationStatus',CASE WHEN coalesce(a.actual_quantity,0)<=0 THEN 'NOT_ISSUED' WHEN a.actual_quantity<trunc(l.quantity*(1+l.scrap_basis_points::numeric/10000)*o.planned_quantity/c.output_quantity,6) THEN 'PARTIAL' WHEN a.actual_quantity=trunc(l.quantity*(1+l.scrap_basis_points::numeric/10000)*o.planned_quantity/c.output_quantity,6) THEN 'ISSUED' ELSE 'OVER_ISSUED' END) item
        FROM chosen_bom c JOIN manufacturing_bom_lines l ON l.bom_version_id=c.id
        JOIN production_orders o ON o.tenant_id=l.tenant_id AND o.id=$2
        JOIN manufacturing_item_versions v ON v.tenant_id=l.tenant_id AND v.id=l.component_item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id
        LEFT JOIN actual_material a ON a.item_version_id=l.component_item_version_id ORDER BY l.line_number`,
        scope,
      )
    ).rows.map((row) => row.item);
  }
}
