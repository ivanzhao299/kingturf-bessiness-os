import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

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
const evidence = async (
  tx: SqlClient,
  action: string,
  type: string,
  id: string,
  version: number,
  context: Context,
  correlationId: string,
  payload: JsonObject,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, context.actor.employeeId, context.actor.companyId, type, id, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [
      context.actor.companyId,
      action,
      type,
      id,
      version,
      context.actor.employeeId,
      correlationId,
      payload,
    ],
  );
};

export class PostgresManufacturingRepository {
  public constructor(private readonly db: Db) {}
  public async list(view: 'items' | 'boms' | 'routings', context: Context) {
    company(context);
    const queries = {
      items: `SELECT to_jsonb(v)||jsonb_build_object('itemId',i.id,'sku',i.sku,'name',i.name,'itemType',i.item_type,'baseUnitCode',i.base_unit_code) item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY i.sku,v.version DESC`,
      boms: `SELECT to_jsonb(v)||jsonb_build_object('bomId',b.id,'code',b.code,'name',b.name,'productItemId',b.product_item_id,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('component',(SELECT jsonb_build_object('sku',i.sku,'name',i.name,'version',iv.version) FROM manufacturing_item_versions iv JOIN manufacturing_items i ON i.id=iv.item_id AND i.tenant_id=iv.tenant_id WHERE iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id),'substitutes',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('sku',si.sku,'version',sv.version) ORDER BY s.priority) FROM manufacturing_bom_substitutes s JOIN manufacturing_item_versions sv ON sv.id=s.substitute_item_version_id AND sv.tenant_id=s.tenant_id JOIN manufacturing_items si ON si.id=sv.item_id AND si.tenant_id=sv.tenant_id WHERE s.bom_line_id=l.id AND s.tenant_id=l.tenant_id),'[]'::jsonb)) ORDER BY l.line_number) FROM manufacturing_bom_lines l WHERE l.bom_version_id=v.id AND l.tenant_id=v.tenant_id),'[]'::jsonb)) item FROM manufacturing_bom_versions v JOIN manufacturing_boms b ON b.id=v.bom_id AND b.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY b.code,v.version DESC`,
      routings: `SELECT to_jsonb(v)||jsonb_build_object('routingId',r.id,'code',r.code,'name',r.name,'productItemId',r.product_item_id,'operations',coalesce((SELECT jsonb_agg(to_jsonb(op) ORDER BY op.sequence) FROM manufacturing_routing_operations op WHERE op.routing_version_id=v.id AND op.tenant_id=v.tenant_id),'[]'::jsonb)) item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY r.code,v.version DESC`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((r) => r.item);
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
