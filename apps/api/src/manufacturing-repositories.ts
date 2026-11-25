import { createHash } from 'node:crypto';
import { canonicalize, DomainError } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import { writeAuditOutbox as evidence } from './audit-outbox.ts';
import {
  BOM_VERSION_PROJECTION,
  ITEM_VERSION_PROJECTION,
  ROUTING_VERSION_PROJECTION,
  company,
  json,
  type Context,
} from './manufacturing-read-repositories.ts';

import { PostgresManufacturingVersionRepository } from './manufacturing-version-repository.ts';
import { insertBomLines, insertRoutingOperations } from './manufacturing-version-contents.ts';

const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');

// U3-MFG-1/2/3：写路径（list/createItem/createBom/createRouting/publish）——投影
// 常量与 additive 只读方法见 manufacturing-read-repositories.ts（G1 拆分，本类继承）。
export class PostgresManufacturingRepository extends PostgresManufacturingVersionRepository {
  public async list(view: 'items' | 'boms' | 'routings', context: Context) {
    company(context);
    const queries = {
      items: `SELECT ${ITEM_VERSION_PROJECTION} item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY i.sku,v.version DESC`,
      boms: `SELECT ${BOM_VERSION_PROJECTION} item FROM manufacturing_bom_versions v JOIN manufacturing_boms b ON b.id=v.bom_id AND b.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY b.code,v.version DESC`,
      routings: `SELECT ${ROUTING_VERSION_PROJECTION} item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY r.code,v.version DESC`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((r) => r.item);
  }

  // U3-MFG-1（ADR-0015）：物料 keyset cursor 分页只读（additive）——投影与排序键

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
      await insertBomLines(tx, context.actor.companyId, version.id, input.lines);
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
      await insertRoutingOperations(tx, context.actor.companyId, version.id, input.operations);
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
