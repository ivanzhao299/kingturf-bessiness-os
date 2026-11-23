import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';
import { writeAuditOutbox as evidence } from './audit-outbox.ts';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Manufacturing master data requires company scope');
};

// U3-MFG-1（ADR-0015）：物料版本行投影（to_jsonb 版本列 + 物料根列）——list 与
// additive 分页/详情版本列表共用同一片段（SQL 字节与提取前逐字一致，行为守恒）。
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

// (sku,version) 键集令牌：<sku>.<version>（sku 经 assertStableCode 不含点，末位点即分隔）。
export const itemCursor = (sku: string, version: number): string => `${sku}.${String(version)}`;
export const parseItemCursor = (cursor: string): readonly [string, number] => {
  const match = /^(.+)\.(\d{1,9})$/u.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[2])))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return [match[1] ?? '', Number(match[2])];
};

export class PostgresManufacturingRepository {
  public constructor(private readonly db: Db) {}
  public async list(view: 'items' | 'boms' | 'routings', context: Context) {
    company(context);
    const queries = {
      items: `SELECT ${ITEM_VERSION_PROJECTION} item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY i.sku,v.version DESC`,
      boms: `SELECT to_jsonb(v)||jsonb_build_object('bomId',b.id,'code',b.code,'name',b.name,'productItemId',b.product_item_id,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('component',(SELECT jsonb_build_object('sku',i.sku,'name',i.name,'version',iv.version) FROM manufacturing_item_versions iv JOIN manufacturing_items i ON i.id=iv.item_id AND i.tenant_id=iv.tenant_id WHERE iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id),'substitutes',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('sku',si.sku,'version',sv.version) ORDER BY s.priority) FROM manufacturing_bom_substitutes s JOIN manufacturing_item_versions sv ON sv.id=s.substitute_item_version_id AND sv.tenant_id=s.tenant_id JOIN manufacturing_items si ON si.id=sv.item_id AND si.tenant_id=sv.tenant_id WHERE s.bom_line_id=l.id AND s.tenant_id=l.tenant_id),'[]'::jsonb)) ORDER BY l.line_number) FROM manufacturing_bom_lines l WHERE l.bom_version_id=v.id AND l.tenant_id=v.tenant_id),'[]'::jsonb)) item FROM manufacturing_bom_versions v JOIN manufacturing_boms b ON b.id=v.bom_id AND b.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY b.code,v.version DESC`,
      routings: `SELECT to_jsonb(v)||jsonb_build_object('routingId',r.id,'code',r.code,'name',r.name,'productItemId',r.product_item_id,'operations',coalesce((SELECT jsonb_agg(to_jsonb(op) ORDER BY op.sequence) FROM manufacturing_routing_operations op WHERE op.routing_version_id=v.id AND op.tenant_id=v.tenant_id),'[]'::jsonb)) item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY r.code,v.version DESC`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((r) => r.item);
  }

  // U3-MFG-1（ADR-0015）：物料 keyset cursor 分页只读（additive）——投影与排序键
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
  public createItem(
    input: {
      sku: string;
      name: string;
      itemType: string;
      baseUnitCode: string;
      specification: JsonObject;
      effectiveAt: string;
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const item = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_items(tenant_id,sku,name,item_type,base_unit_code,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [
            context.actor.companyId,
            input.sku,
            input.name,
            input.itemType,
            input.baseUnitCode,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!item) throw new Error('Manufacturing item insert failed');
      const canonical = {
        itemId: item.id,
        specification: input.specification,
        effectiveAt: input.effectiveAt,
      };
      const version = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_item_versions(tenant_id,item_id,version,specification,effective_at,canonical_hash,created_by) VALUES($1,$2,1,$3,$4,$5,$6) RETURNING id',
          [
            context.actor.companyId,
            item.id,
            input.specification,
            input.effectiveAt,
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('Manufacturing item version insert failed');
      if (input.publish)
        await tx.query(
          "UPDATE manufacturing_item_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2",
          [version.id, context.actor.companyId],
        );
      const result = json({
        id: version.id,
        itemId: item.id,
        version: 1,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        ...input,
        canonicalHash: hash(canonical),
      });
      await evidence(
        tx,
        'manufacturing-item.created',
        'manufacturing-item',
        item.id,
        1,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }
  public createBom(
    input: {
      code: string;
      name: string;
      productItemId: string;
      productItemVersionId: string;
      outputQuantity: string;
      effectiveAt: string;
      lines: {
        componentItemVersionId: string;
        quantity: string;
        scrapBasisPoints: number;
        substitutes: { itemVersionId: string; priority: number; conversionFactor: string }[];
      }[];
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const valid = await tx.query(
        'SELECT 1 FROM manufacturing_item_versions WHERE id=$1 AND item_id=$2 AND tenant_id=$3',
        [input.productItemVersionId, input.productItemId, context.actor.companyId],
      );
      if (!valid.rowCount)
        throw new DomainError('conflict', 'BOM product root and version are inconsistent');
      const bom = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_boms(tenant_id,code,name,product_item_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [
            context.actor.companyId,
            input.code,
            input.name,
            input.productItemId,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!bom) throw new Error('BOM insert failed');
      const { publish: _publish, ...bomContent } = input;
      void _publish;
      const canonical = { bomId: bom.id, ...bomContent };
      const version = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_bom_versions(tenant_id,bom_id,version,product_item_version_id,output_quantity,effective_at,canonical_hash,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) RETURNING id',
          [
            context.actor.companyId,
            bom.id,
            input.productItemVersionId,
            input.outputQuantity,
            input.effectiveAt,
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('BOM version insert failed');
      for (const [index, line] of input.lines.entries()) {
        const inserted = (
          await tx.query<{ id: string }>(
            'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity,scrap_basis_points) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
            [
              context.actor.companyId,
              version.id,
              index + 1,
              line.componentItemVersionId,
              line.quantity,
              line.scrapBasisPoints,
            ],
          )
        ).rows[0];
        if (!inserted) throw new Error('BOM line insert failed');
        for (const substitute of line.substitutes)
          await tx.query(
            'INSERT INTO manufacturing_bom_substitutes(tenant_id,bom_line_id,substitute_item_version_id,priority,conversion_factor) VALUES($1,$2,$3,$4,$5)',
            [
              context.actor.companyId,
              inserted.id,
              substitute.itemVersionId,
              substitute.priority,
              substitute.conversionFactor,
            ],
          );
      }
      if (input.publish)
        await tx.query(
          "UPDATE manufacturing_bom_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2",
          [version.id, context.actor.companyId],
        );
      const result = json({
        id: version.id,
        bomId: bom.id,
        version: 1,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        ...input,
        canonicalHash: hash(canonical),
      });
      await evidence(tx, 'bom.created', 'bom', bom.id, 1, context, correlationId, result);
      return result;
    });
  }
  public createRouting(
    input: {
      code: string;
      name: string;
      productItemId: string;
      productItemVersionId: string;
      effectiveAt: string;
      operations: {
        operationCode: string;
        name: string;
        workCenterCode: string;
        sequence: number;
        setupMinutes: string;
        runMinutesPerUnit: string;
        instructions: JsonObject;
      }[];
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const valid = await tx.query(
        'SELECT 1 FROM manufacturing_item_versions WHERE id=$1 AND item_id=$2 AND tenant_id=$3',
        [input.productItemVersionId, input.productItemId, context.actor.companyId],
      );
      if (!valid.rowCount)
        throw new DomainError('conflict', 'Routing product root and version are inconsistent');
      const root = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_routings(tenant_id,code,name,product_item_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [
            context.actor.companyId,
            input.code,
            input.name,
            input.productItemId,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!root) throw new Error('Routing insert failed');
      const { publish: _publish, ...routingContent } = input;
      void _publish;
      const canonical = { routingId: root.id, ...routingContent };
      const version = (
        await tx.query<{ id: string }>(
          'INSERT INTO manufacturing_routing_versions(tenant_id,routing_id,version,product_item_version_id,effective_at,canonical_hash,created_by) VALUES($1,$2,1,$3,$4,$5,$6) RETURNING id',
          [
            context.actor.companyId,
            root.id,
            input.productItemVersionId,
            input.effectiveAt,
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('Routing version insert failed');
      for (const op of input.operations)
        await tx.query(
          'INSERT INTO manufacturing_routing_operations(tenant_id,routing_version_id,sequence,operation_code,name,work_center_code,setup_minutes,run_minutes_per_unit,instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            context.actor.companyId,
            version.id,
            op.sequence,
            op.operationCode,
            op.name,
            op.workCenterCode,
            op.setupMinutes,
            op.runMinutesPerUnit,
            op.instructions,
          ],
        );
      if (input.publish)
        await tx.query(
          "UPDATE manufacturing_routing_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2",
          [version.id, context.actor.companyId],
        );
      const result = json({
        id: version.id,
        routingId: root.id,
        version: 1,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        ...input,
        canonicalHash: hash(canonical),
      });
      await evidence(tx, 'routing.created', 'routing', root.id, 1, context, correlationId, result);
      return result;
    });
  }
  public publish(
    kind: 'item' | 'bom' | 'routing',
    id: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const table = {
        item: 'manufacturing_item_versions',
        bom: 'manufacturing_bom_versions',
        routing: 'manufacturing_routing_versions',
      }[kind];
      const row = (
        await tx.query<{ version: number }>(
          `UPDATE ${table} SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2 AND status='DRAFT' RETURNING version`,
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Draft manufacturing version not found');
      const result = json({ id, kind, version: row.version, status: 'PUBLISHED' });
      await evidence(
        tx,
        `${kind}.published`,
        kind,
        id,
        row.version,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }
}
