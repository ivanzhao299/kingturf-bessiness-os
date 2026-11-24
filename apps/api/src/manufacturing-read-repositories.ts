// U3-MFG-1/2/3（ADR-0015）：制造域 additive 只读仓储（自 manufacturing-repositories
// 拆分——G1 ≤800 行纪律，沿 procurement-read-repositories 先例；方法体与投影 SQL
// 逐字节迁移，行为守恒）。写路径（list/createItem/createBom/createRouting/publish）
// 留在 manufacturing-repositories.ts，PostgresManufacturingRepository 继承本类。
import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

export type Db = SqlClient & Pick<Database, 'transaction'>;
export type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
export const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Manufacturing master data requires company scope');
};
export const json = (value: unknown) => value as JsonObject;

export const ITEM_VERSION_PROJECTION = `to_jsonb(v)||jsonb_build_object('itemId',i.id,'sku',i.sku,'name',i.name,'itemType',i.item_type,'baseUnitCode',i.base_unit_code)`;
// 详情抽屉「最近工单」预览行数（ORDER BY created_at DESC 的固定窗口，行数参数化）。
const ITEM_ORDER_PREVIEW = 5;

// U3-MFG-1：物料分页只读过滤器——limit 缺省=全量（legacy list 无 LIMIT，行为守恒）；
// cursor=(sku,version) 复合键集（排序键 ORDER BY i.sku,v.version DESC 与 list 一致；
// (tenant_id,sku) 与 (tenant_id,item_id,version) 唯一约束保证键集不重不漏）。
export type ManufacturingItemType =
  | 'RAW_MATERIAL'
  | 'SEMI_FINISHED'
  | 'FINISHED_GOOD'
  | 'PACKAGING';
export type ManufacturingVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type ItemPageFilter = Readonly<{
  limit?: number;
  cursor?: string;
  itemType?: ManufacturingItemType;
  status?: ManufacturingVersionStatus;
  query?: string;
}>;
export type ItemPage = Readonly<{ items: readonly JsonObject[]; nextCursor: string | null }>;
// 详情关联聚合按调用方读权限门控（bom:read/routing:read/production:read）——未授权
// 的聚合不查询，不放宽物料读权限之外的数据可见面。
export type ItemDetailParts = Readonly<{
  boms: boolean;
  routings: boolean;
  productionOrders: boolean;
}>;

// U3-MFG-2（ADR-0015）：BOM 版本行投影（to_jsonb 版本列 + BOM 头列 + lines 聚合
// ——组件 {sku,name,version} 与替代料 [{... snake 全列, sku, version}] 按 priority
// 排序）——list 与 additive 分页共用同一片段（SQL 字节与提取前逐字一致，行为守恒）。
export const BOM_VERSION_PROJECTION = `to_jsonb(v)||jsonb_build_object('bomId',b.id,'code',b.code,'name',b.name,'productItemId',b.product_item_id,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('component',(SELECT jsonb_build_object('sku',i.sku,'name',i.name,'version',iv.version) FROM manufacturing_item_versions iv JOIN manufacturing_items i ON i.id=iv.item_id AND i.tenant_id=iv.tenant_id WHERE iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id),'substitutes',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('sku',si.sku,'version',sv.version) ORDER BY s.priority) FROM manufacturing_bom_substitutes s JOIN manufacturing_item_versions sv ON sv.id=s.substitute_item_version_id AND sv.tenant_id=s.tenant_id JOIN manufacturing_items si ON si.id=sv.item_id AND si.tenant_id=sv.tenant_id WHERE s.bom_line_id=l.id AND s.tenant_id=l.tenant_id),'[]'::jsonb)) ORDER BY l.line_number) FROM manufacturing_bom_lines l WHERE l.bom_version_id=v.id AND l.tenant_id=v.tenant_id),'[]'::jsonb))`;
// 详情行项投影（additive 专用）：组件含物料根/类型/基本单位，替代料含换算系数。
export const BOM_LINE_DETAIL_PROJECTION = `jsonb_build_object('lineNumber',l.line_number,'quantity',l.quantity,'scrapBasisPoints',l.scrap_basis_points,'component',jsonb_build_object('itemId',i.id,'sku',i.sku,'name',i.name,'version',iv.version,'itemType',i.item_type,'baseUnitCode',i.base_unit_code),'substitutes',coalesce((SELECT jsonb_agg(jsonb_build_object('itemVersionId',s.substitute_item_version_id,'priority',s.priority,'conversionFactor',s.conversion_factor,'sku',si.sku,'name',si.name,'version',sv.version) ORDER BY s.priority) FROM manufacturing_bom_substitutes s JOIN manufacturing_item_versions sv ON sv.id=s.substitute_item_version_id AND sv.tenant_id=s.tenant_id JOIN manufacturing_items si ON si.id=sv.item_id AND si.tenant_id=sv.tenant_id WHERE s.bom_line_id=l.id AND s.tenant_id=l.tenant_id),'[]'::jsonb))`;
// 组件层级树展开深度上限（防深链与环；环另经已访问物料集合截断）。
const BOM_TREE_DEPTH = 3;

// 行投影取值的安全字符串化（JsonObject 值 unknown：仅接受 string，避免 [object Object]）。
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
// 行投影取值的安全数值化。
const numOr = (value: unknown, fallback = 0): number =>
  typeof value === 'number' ? value : fallback;

// TD-WF-011：组件层级树以哪个版本为根。版本行按 version DESC 排列（findBom 的 ORDER BY）。
// 有已发布版本时取其中最新的一个——与 TD-WF-011 之前逐字节一致；没有任何已发布版本时
// 取最新草稿。全部版本都不是这两种状态，或没有版本，则不出树（undefined）。
const treeRootVersion = (versions: readonly JsonObject[]): JsonObject | undefined =>
  versions.find((version) => version.status === 'PUBLISHED') ??
  versions.find((version) => version.status === 'DRAFT');

// U3-MFG-2：BOM 分页只读过滤器——limit 缺省=全量（legacy list 无 LIMIT，行为守恒）；
// cursor=(code,version) 复合键集（排序键 ORDER BY b.code,v.version DESC 与 list 一致；
// (tenant_id,code) 与 (tenant_id,bom_id,version) 唯一约束保证键集不重不漏）；
// productType 按产品物料类型过滤（左树「成品/半成品」）。
export type BomProductType = 'FINISHED_GOOD' | 'SEMI_FINISHED';
export type BomPageFilter = Readonly<{
  limit?: number;
  cursor?: string;
  status?: ManufacturingVersionStatus;
  query?: string;
  productType?: BomProductType;
}>;
export type BomPage = Readonly<{ items: readonly JsonObject[]; nextCursor: string | null }>;

// (code,version) 键集令牌：<code>.<version>（code 经 assertStableCode 不含点）。
export const bomCursor = (code: string, version: number): string => `${code}.${String(version)}`;
export const parseBomCursor = (cursor: string): readonly [string, number] => {
  const match = /^(.+)\.(\d{1,9})$/u.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return [match[1] ?? '', Number(match[2])];
};
// U3-MFG-3（ADR-0015）：工艺路线版本行投影（to_jsonb 版本列 + 路线头列 + operations
// 聚合按 sequence 升序）——list 与 additive 分页/详情共用同一片段（SQL 字节与提取前
// 逐字一致，行为守恒）。
export const ROUTING_VERSION_PROJECTION = `to_jsonb(v)||jsonb_build_object('routingId',r.id,'code',r.code,'name',r.name,'productItemId',r.product_item_id,'operations',coalesce((SELECT jsonb_agg(to_jsonb(op) ORDER BY op.sequence) FROM manufacturing_routing_operations op WHERE op.routing_version_id=v.id AND op.tenant_id=v.tenant_id),'[]'::jsonb))`;

// U3-MFG-3：工艺路线分页只读过滤器——limit 缺省=全量（legacy list 无 LIMIT，行为
// 守恒）；cursor=(code,version) 复合键集（排序键 ORDER BY r.code,v.version DESC 与
// list 一致）；productType 按产品物料类型过滤（左树「成品/半成品」）。
export type RoutingPageFilter = Readonly<{
  limit?: number;
  cursor?: string;
  status?: ManufacturingVersionStatus;
  query?: string;
  productType?: BomProductType;
}>;
export type RoutingPage = Readonly<{ items: readonly JsonObject[]; nextCursor: string | null }>;

// (code,version) 键集令牌（code 经 assertStableCode 不含点）；工艺路线游标独立构造
// 以保持各域自包含。
export const routingCursor = (code: string, version: number): string =>
  `${code}.${String(version)}`;
export const parseRoutingCursor = (cursor: string): readonly [string, number] => {
  const match = /^(.+)\.(\d{1,9})$/u.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return [match[1] ?? '', Number(match[2])];
};

// (sku,version) 键集令牌：<sku>.<version>（sku 经 assertStableCode 不含点，末位点即分隔）。
export const itemCursor = (sku: string, version: number): string => `${sku}.${String(version)}`;
export const parseItemCursor = (cursor: string): readonly [string, number] => {
  const match = /^(.+)\.(\d{1,9})$/u.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return [match[1] ?? '', Number(match[2])];
};

export class PostgresManufacturingReadRepository {
  public constructor(protected readonly db: Db) {}
  // （sku, version DESC）与 list('items') 一致；无 limit 时全量（nextCursor 恒 null
  // ——默认路径与 legacy 逐字节一致），显式 limit 才启用分页窗口。筛选值与游标键
  // 一律经 values.push 参数化（$N）。
  public async listItemPage(context: Context, filter: ItemPageFilter): Promise<ItemPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.itemType !== undefined) clauses.push(`i.item_type=${add(filter.itemType)}`);
    if (filter.status !== undefined) clauses.push(`v.status=${add(filter.status)}`);
    // 关键字：sku/名称大小写不敏感子串（strpos 无通配符语义，用户输入无需转义）。
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(i.sku||' '||i.name),lower(${add(filter.query)}))>0`);
    let keyset = '';
    if (filter.cursor !== undefined) {
      const [sku, version] = parseItemCursor(filter.cursor);
      values.push(sku);
      values.push(version);
      keyset = ` AND (i.sku>$${String(values.length - 1)} OR (i.sku=$${String(values.length - 1)} AND v.version<$${String(values.length)}))`;
    }
    let limitClause = '';
    let limit: number | null = null;
    if (filter.limit !== undefined) {
      limit = Math.min(Math.max(filter.limit, 1), 100);
      values.push(limit + 1);
      limitClause = ` LIMIT $${String(values.length)}`;
    }
    const rows = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${ITEM_VERSION_PROJECTION} item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''}${keyset} ORDER BY i.sku,v.version DESC${limitClause}`,
        values,
      )
    ).rows;
    const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
    const last = limit !== null && rows.length > limit ? items[limit - 1] : null;
    return {
      items,
      nextCursor:
        typeof last?.sku === 'string' && typeof last.version === 'number'
          ? itemCursor(last.sku, last.version)
          : null,
    };
  }

  // U3-MFG-1（ADR-0015）：物料详情只读（additive）——物料根行 + 版本历史（list 同
  // 投影，version DESC）；关联 BOM/被引用/工艺路线/最近工单按调用方读权限门控
  //（parts），未授权的聚合不查询。不存在或跨租户返回 null。
  public async findItem(
    itemId: string,
    context: Context,
    parts: ItemDetailParts = { boms: false, routings: false, productionOrders: false },
  ): Promise<JsonObject | null> {
    company(context);
    const scope: readonly unknown[] = [context.actor.companyId, itemId];
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',i.id,'sku',i.sku,'name',i.name,'itemType',i.item_type,'baseUnitCode',i.base_unit_code,'created_at',i.created_at) item FROM manufacturing_items i WHERE i.tenant_id=$1 AND i.id=$2`,
        scope,
      )
    ).rows[0]?.item;
    if (!root) return null;
    const versions = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${ITEM_VERSION_PROJECTION} item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.item_id=$2 ORDER BY v.version DESC`,
        scope,
      )
    ).rows.map((row) => row.item);
    let boms: readonly JsonObject[] = [];
    let usedIn: readonly JsonObject[] = [];
    if (parts.boms) {
      [boms, usedIn] = await Promise.all([this.itemBoms(scope), this.itemUsedIn(scope)]);
    }
    const routings = parts.routings ? await this.itemRoutings(scope) : [];
    const productionOrders = parts.productionOrders ? await this.itemProductionOrders(scope) : [];
    return {
      ...root,
      versions,
      ...(parts.boms ? { boms, usedIn } : {}),
      ...(parts.routings ? { routings } : {}),
      ...(parts.productionOrders ? { productionOrders } : {}),
    };
  }

  // 以该物料为产品的 BOM（含各版本状态，version DESC）。
  private async itemBoms(scope: readonly unknown[]): Promise<readonly JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(b)||jsonb_build_object('versions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'version',x.version,'status',x.status,'effective_at',x.effective_at,'published_at',x.published_at) ORDER BY x.version DESC) FROM manufacturing_bom_versions x WHERE x.tenant_id=b.tenant_id AND x.bom_id=b.id),'[]'::jsonb)) item FROM manufacturing_boms b WHERE b.tenant_id=$1 AND b.product_item_id=$2 ORDER BY b.code`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 该物料版本被 BOM 引用的位置：主料行（COMPONENT）与替代料（SUBSTITUTE）。
  private async itemUsedIn(scope: readonly unknown[]): Promise<readonly JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT item FROM (
          SELECT jsonb_build_object('bomId',b.id,'code',b.code,'name',b.name,'bomVersionId',x.id,'version',x.version,'status',x.status,'role','COMPONENT','lineNumber',l.line_number,'quantity',l.quantity) item
          FROM manufacturing_bom_lines l JOIN manufacturing_bom_versions x ON x.id=l.bom_version_id AND x.tenant_id=l.tenant_id JOIN manufacturing_boms b ON b.id=x.bom_id AND b.tenant_id=x.tenant_id JOIN manufacturing_item_versions v ON v.id=l.component_item_version_id AND v.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND v.item_id=$2
          UNION ALL
          SELECT jsonb_build_object('bomId',b.id,'code',b.code,'name',b.name,'bomVersionId',x.id,'version',x.version,'status',x.status,'role','SUBSTITUTE','lineNumber',l.line_number,'priority',s.priority) item
          FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id AND l.tenant_id=s.tenant_id JOIN manufacturing_bom_versions x ON x.id=l.bom_version_id AND x.tenant_id=l.tenant_id JOIN manufacturing_boms b ON b.id=x.bom_id AND b.tenant_id=x.tenant_id JOIN manufacturing_item_versions v ON v.id=s.substitute_item_version_id AND v.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND v.item_id=$2
        ) u ORDER BY u.item->>'code',u.item->>'version',u.item->>'lineNumber'`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 以该物料为产品的工艺路线（含各版本状态，version DESC）。
  private async itemRoutings(scope: readonly unknown[]): Promise<readonly JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(r)||jsonb_build_object('versions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'version',x.version,'status',x.status,'effective_at',x.effective_at,'published_at',x.published_at) ORDER BY x.version DESC) FROM manufacturing_routing_versions x WHERE x.tenant_id=r.tenant_id AND x.routing_id=r.id),'[]'::jsonb)) item FROM manufacturing_routings r WHERE r.tenant_id=$1 AND r.product_item_id=$2 ORDER BY r.code`,
        scope,
      )
    ).rows.map((row) => row.item);
  }

  // 最近工单预览：引用该物料任一版本的生产工单，按创建时间倒序取前 N（行数参数化）。
  private async itemProductionOrders(scope: readonly unknown[]): Promise<readonly JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',o.id,'orderNumber',o.order_number,'state',s.state,'plannedQuantity',o.planned_quantity,'plannedStartAt',o.planned_start_at,'plannedDueAt',o.planned_due_at,'itemVersion',v.version,'createdAt',o.created_at) item
        FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id JOIN manufacturing_item_versions v ON v.tenant_id=o.tenant_id AND v.id=o.item_version_id
        WHERE o.tenant_id=$1 AND v.item_id=$2 ORDER BY o.created_at DESC,o.id LIMIT $3`,
        [...scope, ITEM_ORDER_PREVIEW],
      )
    ).rows.map((row) => row.item);
  }

  // U3-MFG-2（ADR-0015）：BOM keyset cursor 分页只读（additive）——投影与排序键
  // （code, version DESC）与 list('boms') 一致；无 limit 时全量（nextCursor 恒 null
  // ——默认路径与 legacy 逐字节一致），显式 limit 才启用分页窗口。status/query/
  // productType（产品物料类型）筛选值与游标键一律经 values.push 参数化（$N）。
  public async listBomPage(context: Context, filter: BomPageFilter): Promise<BomPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.status !== undefined) clauses.push(`v.status=${add(filter.status)}`);
    // 关键字：BOM 编码/名称大小写不敏感子串（strpos 无通配符语义）。
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(b.code||' '||b.name),lower(${add(filter.query)}))>0`);
    // 左树「成品/半成品」按产品物料类型过滤。
    if (filter.productType !== undefined) clauses.push(`pi.item_type=${add(filter.productType)}`);
    let keyset = '';
    if (filter.cursor !== undefined) {
      const [code, version] = parseBomCursor(filter.cursor);
      values.push(code);
      values.push(version);
      keyset = ` AND (b.code>$${String(values.length - 1)} OR (b.code=$${String(values.length - 1)} AND v.version<$${String(values.length)}))`;
    }
    let limitClause = '';
    let limit: number | null = null;
    if (filter.limit !== undefined) {
      limit = Math.min(Math.max(filter.limit, 1), 100);
      values.push(limit + 1);
      limitClause = ` LIMIT $${String(values.length)}`;
    }
    const rows = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${BOM_VERSION_PROJECTION} item FROM manufacturing_bom_versions v JOIN manufacturing_boms b ON b.id=v.bom_id AND b.tenant_id=v.tenant_id JOIN manufacturing_items pi ON pi.id=b.product_item_id AND pi.tenant_id=b.tenant_id WHERE v.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''}${keyset} ORDER BY b.code,v.version DESC${limitClause}`,
        values,
      )
    ).rows;
    const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
    const last = limit !== null && rows.length > limit ? items[limit - 1] : null;
    return {
      items,
      nextCursor:
        typeof last?.code === 'string' && typeof last.version === 'number'
          ? bomCursor(last.code, last.version)
          : null,
    };
  }

  // U3-MFG-2（ADR-0015）：BOM 详情只读（additive）——根行 + 产品信息 + 全部版本
  // （每版本行项：组件含物料根/类型/基本单位 + 替代料含换算系数）+ 组件层级树
  // （深度 ≤ BOM_TREE_DEPTH、按组件物料 id 环守卫；叶节点无子 BOM 时 line.bom 为 null）。
  // 不存在或跨租户返回 null。
  // TD-WF-011（WF-A）：树根取「最新已发布版本」；BOM 还没有任何已发布版本（纯草稿）时，
  // 取最新草稿版本——此前这种情况 tree 恒为空，发布前无法核对行项。见 treeRootVersion。
  public async findBom(bomId: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const scope: readonly unknown[] = [context.actor.companyId, bomId];
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',b.id,'code',b.code,'name',b.name,'productItemId',b.product_item_id,'created_at',b.created_at,'product',jsonb_build_object('itemId',pi.id,'sku',pi.sku,'name',pi.name,'itemType',pi.item_type,'baseUnitCode',pi.base_unit_code)) item FROM manufacturing_boms b JOIN manufacturing_items pi ON pi.id=b.product_item_id AND pi.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.id=$2`,
        scope,
      )
    ).rows[0]?.item;
    if (!root) return null;
    const versions = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(v)||jsonb_build_object('outputQuantity',v.output_quantity) item FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.bom_id=$2 ORDER BY v.version DESC`,
        scope,
      )
    ).rows.map((row) => row.item);
    const versionIds = versions.map((version) => textOf(version.id));
    const linesByVersion = await this.bomLinesByVersions(scope[0] as string, versionIds);
    // JsonObject 只读索引签名（noUncheckedIndexedAccess）：以非变异展开注入行项。
    const enriched: readonly JsonObject[] = versions.map((version) => ({
      ...version,
      lines: linesByVersion.get(textOf(version.id)) ?? [],
    }));
    const treeRoot = treeRootVersion(enriched);
    const tree =
      treeRoot === undefined
        ? []
        : [
            await this.bomNode(
              context.actor.companyId,
              {
                id: textOf(treeRoot.id),
                code: textOf(root.code),
                name: textOf(root.name),
                version: numOr(treeRoot.version),
                status: textOf(treeRoot.status),
              },
              new Set([textOf(root.productItemId)]),
              0,
            ),
          ];
    return { ...root, versions: enriched, tree };
  }

  // 一次取全部版本的行项（组件含物料根/类型/单位 + 替代料），按版本 id 分组。
  private async bomLinesByVersions(
    tenantId: string,
    versionIds: readonly string[],
  ): Promise<Map<string, JsonObject[]>> {
    const grouped = new Map<string, JsonObject[]>();
    if (versionIds.length === 0) return grouped;
    const rows = (
      await this.db.query<{ bom_version_id: string; line: JsonObject }>(
        `SELECT l.bom_version_id,${BOM_LINE_DETAIL_PROJECTION} line FROM manufacturing_bom_lines l JOIN manufacturing_item_versions iv ON iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=iv.item_id AND i.tenant_id=iv.tenant_id WHERE l.tenant_id=$1 AND l.bom_version_id=ANY($2::uuid[]) ORDER BY l.bom_version_id,l.line_number`,
        [tenantId, versionIds],
      )
    ).rows;
    for (const row of rows) {
      const lines = grouped.get(row.bom_version_id) ?? [];
      lines.push(row.line);
      grouped.set(row.bom_version_id, lines);
    }
    return grouped;
  }

  // 组件层级树：以指定已发布版本为根返回单节点；每个组件行若存在已发布 BOM，取其中
  // 编码最小者的最新已发布版本继续展开（深度 ≤ BOM_TREE_DEPTH）；已访问物料集合防环
  // （BOM 环经组件物料出现，物料去重即可截断）。每深度级两批查询（BOM 头 + 全部行项）。
  private async bomNode(
    tenantId: string,
    version: JsonObject,
    visited: Set<string>,
    depth: number,
  ): Promise<JsonObject> {
    const versionId = textOf(version.id);
    const lines = (await this.bomLinesByVersions(tenantId, [versionId])).get(versionId) ?? [];
    if (depth >= BOM_TREE_DEPTH || lines.length === 0)
      return this.treeNode(version, lines, new Map());
    const componentItemIds = lines
      .map((line) => textOf((line.component as JsonObject).itemId))
      .filter((itemId) => !visited.has(itemId));
    if (componentItemIds.length === 0) return this.treeNode(version, lines, new Map());
    for (const itemId of componentItemIds) visited.add(itemId);
    const children = await this.publishedBomsForItems(tenantId, componentItemIds);
    if (children.length === 0) return this.treeNode(version, lines, new Map());
    const childNodes = new Map<string, JsonObject>();
    for (const child of children) {
      const childVersionId = textOf(child.bomVersionId);
      childNodes.set(
        textOf(child.productItemId),
        await this.bomNode(
          tenantId,
          {
            id: childVersionId,
            code: textOf(child.code),
            name: textOf(child.name),
            version: numOr(child.version),
            status: textOf(child.status),
          },
          visited,
          depth + 1,
        ),
      );
    }
    return this.treeNode(version, lines, childNodes);
  }

  // 组装树节点：组件行挂对应子 BOM 节点（无子 BOM 的组件行 line.bom 为 null）。
  private treeNode(
    version: JsonObject,
    lines: readonly JsonObject[],
    childNodes: ReadonlyMap<string, JsonObject>,
  ): JsonObject {
    return {
      bomVersionId: textOf(version.id),
      code: textOf(version.code),
      name: textOf(version.name),
      version: numOr(version.version),
      status: textOf(version.status),
      lines: lines.map((line) => ({
        ...line,
        bom: childNodes.get(textOf((line.component as JsonObject).itemId)) ?? null,
      })),
    };
  }

  // 组件物料的已发布 BOM（每物料取编码最小者；bomVersionId 取其最新已发布版本）。
  private async publishedBomsForItems(
    tenantId: string,
    itemIds: readonly string[],
  ): Promise<readonly JsonObject[]> {
    const rows = (
      await this.db.query<{
        item: JsonObject;
      }>(
        `SELECT DISTINCT ON (b.product_item_id) jsonb_build_object('productItemId',b.product_item_id,'bomVersionId',v.id,'code',b.code,'name',b.name,'version',v.version,'status',v.status) item FROM manufacturing_bom_versions v JOIN manufacturing_boms b ON b.id=v.bom_id AND b.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.status='PUBLISHED' AND b.product_item_id=ANY($2::uuid[]) ORDER BY b.product_item_id,b.code,v.version DESC`,
        [tenantId, itemIds],
      )
    ).rows;
    return rows.map((row) => row.item);
  }

  // U3-MFG-3（ADR-0015）：工艺路线 keyset cursor 分页只读（additive）——投影与排序键
  // （code, version DESC）与 list('routings') 一致；无 limit 时全量（nextCursor 恒
  // null——默认路径与 legacy 逐字节一致），显式 limit 才启用分页窗口。筛选值与游标键
  // 一律经 values.push 参数化（$N）。
  public async listRoutingPage(context: Context, filter: RoutingPageFilter): Promise<RoutingPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.status !== undefined) clauses.push(`v.status=${add(filter.status)}`);
    // 关键字：路线编码/名称大小写不敏感子串（strpos 无通配符语义）。
    if (filter.query !== undefined)
      clauses.push(`strpos(lower(r.code||' '||r.name),lower(${add(filter.query)}))>0`);
    // 左树「成品/半成品」按产品物料类型过滤。
    if (filter.productType !== undefined) clauses.push(`pi.item_type=${add(filter.productType)}`);
    let keyset = '';
    if (filter.cursor !== undefined) {
      const [code, version] = parseRoutingCursor(filter.cursor);
      values.push(code);
      values.push(version);
      keyset = ` AND (r.code>$${String(values.length - 1)} OR (r.code=$${String(values.length - 1)} AND v.version<$${String(values.length)}))`;
    }
    let limitClause = '';
    let limit: number | null = null;
    if (filter.limit !== undefined) {
      limit = Math.min(Math.max(filter.limit, 1), 100);
      values.push(limit + 1);
      limitClause = ` LIMIT $${String(values.length)}`;
    }
    const rows = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${ROUTING_VERSION_PROJECTION} item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id JOIN manufacturing_items pi ON pi.id=r.product_item_id AND pi.tenant_id=r.tenant_id WHERE v.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''}${keyset} ORDER BY r.code,v.version DESC${limitClause}`,
        values,
      )
    ).rows;
    const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
    const last = limit !== null && rows.length > limit ? items[limit - 1] : null;
    return {
      items,
      nextCursor:
        typeof last?.code === 'string' && typeof last.version === 'number'
          ? routingCursor(last.code, last.version)
          : null,
    };
  }

  // U3-MFG-3（ADR-0015）：工艺路线详情只读（additive）——根行 + 产品信息 + 全部版本
  //（每版本工序按 sequence 升序，list 同投影）。不存在或跨租户返回 null。
  public async findRouting(routingId: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const scope: readonly unknown[] = [context.actor.companyId, routingId];
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'productItemId',r.product_item_id,'created_at',r.created_at,'product',jsonb_build_object('itemId',pi.id,'sku',pi.sku,'name',pi.name,'itemType',pi.item_type,'baseUnitCode',pi.base_unit_code)) item FROM manufacturing_routings r JOIN manufacturing_items pi ON pi.id=r.product_item_id AND pi.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.id=$2`,
        scope,
      )
    ).rows[0]?.item;
    if (!root) return null;
    const versions = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${ROUTING_VERSION_PROJECTION} item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.routing_id=$2 ORDER BY v.version DESC`,
        scope,
      )
    ).rows.map((row) => row.item);
    return { ...root, versions };
  }
}
