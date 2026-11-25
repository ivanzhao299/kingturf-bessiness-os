import { DomainError } from '@kingturf/domain';
import type { SqlClient } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';
import { writeAuditOutbox } from './audit-outbox.ts';
import { replayCommercialCommand, retainCommercialCommand } from './command-results.ts';
import {
  BOM_LINE_DETAIL_PROJECTION,
  ITEM_VERSION_PROJECTION,
  ROUTING_VERSION_DETAIL_PROJECTION,
  PostgresManufacturingReadRepository,
  company,
  type Context,
} from './manufacturing-read-repositories.ts';
import {
  insertBomLines,
  insertRoutingOperations,
  type BomLine,
  type RoutingOperation,
} from './manufacturing-version-contents.ts';

export type VersionPatch = Readonly<{
  copyFromVersionId?: string | undefined;
  effectiveAt?: string | undefined;
}>;
export type ItemVersionPatch = VersionPatch & Readonly<{ specification?: JsonObject | undefined }>;
export type BomVersionPatch = VersionPatch &
  Readonly<{
    productItemVersionId?: string | undefined;
    outputQuantity?: string | undefined;
    lines?: readonly BomLine[] | undefined;
  }>;
export type RoutingVersionPatch = VersionPatch &
  Readonly<{
    productItemVersionId?: string | undefined;
    operations?: readonly RoutingOperation[] | undefined;
  }>;

type Kind = 'item' | 'bom' | 'routing';
type Source = Readonly<{ id: string; effective_at: string; next_version: number }>;
type ProductSource = Source & Readonly<{ product_item_version_id: string }>;
type Sources = {
  item: Source & { specification: JsonObject };
  bom: ProductSource & { output_quantity: string };
  routing: ProductSource;
};
const TABLES = {
  item: ['manufacturing_item_versions', 'item_id'],
  bom: ['manufacturing_bom_versions', 'bom_id'],
  routing: ['manufacturing_routing_versions', 'routing_id'],
} as const;
const AGGREGATES = { item: 'manufacturing-item', bom: 'bom', routing: 'routing' } as const;
async function fingerprint(tx: SqlClient, value: unknown): Promise<string> {
  // jsonb gives stable object-key order and accepts fractional values inside specification/instructions.
  const result = await one<{ hash: string }>(
    tx,
    "SELECT encode(sha256(convert_to(($1::jsonb)::text,'UTF8')),'hex') hash",
    [value],
  );
  return result.hash;
}

async function one<T extends Record<string, unknown>>(
  tx: SqlClient,
  sql: string,
  values: readonly unknown[],
): Promise<T> {
  const found = (await tx.query<T>(sql, values)).rows[0];
  if (!found) throw new Error('Manufacturing version write returned no row');
  return found;
}

async function copySource<T extends Source>(
  tx: SqlClient,
  kind: Kind,
  tenantId: string,
  rootId: string,
  patch: VersionPatch,
): Promise<T> {
  const [table, manufacturingVersionRootColumn] = TABLES[kind];
  const found = (
    await tx.query<T>(
      `SELECT v.*,v.effective_at::text AS effective_at,
         (SELECT max(n.version)+1 FROM ${table} n WHERE n.tenant_id=$1 AND n.${manufacturingVersionRootColumn}=$2) next_version
       FROM ${table} v WHERE v.tenant_id=$1 AND v.${manufacturingVersionRootColumn}=$2 AND ($3::uuid IS NULL OR v.id=$3)
       ORDER BY v.version DESC LIMIT 1`,
      [tenantId, rootId, patch.copyFromVersionId ?? null],
    )
  ).rows[0];
  if (!found) throw new DomainError('not_found', '找不到此制造主数据的来源版本');
  return found;
}

async function validateProduct(
  tx: SqlClient,
  tenantId: string,
  previousId: string,
  candidateId: string,
): Promise<void> {
  if (previousId === candidateId) return;
  const valid = await tx.query(
    'SELECT 1 FROM manufacturing_item_versions prev JOIN manufacturing_item_versions next ON next.item_id=prev.item_id AND next.tenant_id=prev.tenant_id WHERE prev.tenant_id=$1 AND prev.id=$2 AND next.id=$3',
    [tenantId, previousId, candidateId],
  );
  if (!valid.rowCount) throw new DomainError('conflict', '产品版本必须属于同一产品');
}

async function validateComponents(
  tx: SqlClient,
  tenantId: string,
  lines: readonly BomLine[],
): Promise<void> {
  const ids = [
    ...new Set(
      lines.flatMap((line) => [
        line.componentItemVersionId,
        ...line.substitutes.map((entry) => entry.itemVersionId),
      ]),
    ),
  ];
  const rows = await tx.query(
    'SELECT id FROM manufacturing_item_versions WHERE tenant_id=$1 AND id=ANY($2::uuid[])',
    [tenantId, ids],
  );
  if (rows.rowCount !== ids.length) throw new DomainError('conflict', '组件或替代料版本不存在');
}

async function copyBomLines(
  tx: SqlClient,
  tenantId: string,
  versionId: string,
): Promise<readonly (BomLine & { lineNumber: number })[]> {
  return (
    await tx.query<BomLine & { lineNumber: number }>(
      `SELECT l.line_number "lineNumber", l.component_item_version_id "componentItemVersionId", l.quantity::text quantity, l.scrap_basis_points "scrapBasisPoints",
       coalesce((SELECT jsonb_agg(jsonb_build_object('itemVersionId',s.substitute_item_version_id,'priority',s.priority,'conversionFactor',s.conversion_factor::text) ORDER BY s.priority)
         FROM manufacturing_bom_substitutes s WHERE s.tenant_id=l.tenant_id AND s.bom_line_id=l.id),'[]'::jsonb) substitutes
     FROM manufacturing_bom_lines l WHERE l.tenant_id=$1 AND l.bom_version_id=$2 ORDER BY l.line_number`,
      [tenantId, versionId],
    )
  ).rows;
}

async function copyOperations(
  tx: SqlClient,
  tenantId: string,
  versionId: string,
): Promise<readonly RoutingOperation[]> {
  return (
    await tx.query<RoutingOperation>(
      'SELECT operation_code "operationCode",name,work_center_code "workCenterCode",sequence,setup_minutes::text "setupMinutes",run_minutes_per_unit::text "runMinutesPerUnit",instructions FROM manufacturing_routing_operations WHERE tenant_id=$1 AND routing_version_id=$2 ORDER BY sequence',
      [tenantId, versionId],
    )
  ).rows;
}

async function insertItemDraft(
  tx: SqlClient,
  source: Source & { specification: JsonObject },
  rootId: string,
  patch: ItemVersionPatch,
  context: Context,
): Promise<JsonObject> {
  const { companyId, employeeId } = context.actor;
  const content = {
    itemId: rootId,
    specification: patch.specification ?? source.specification,
    effectiveAt: patch.effectiveAt ?? source.effective_at,
  };
  const created = await one<{ id: string }>(
    tx,
    'INSERT INTO manufacturing_item_versions(tenant_id,item_id,version,specification,effective_at,canonical_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [
      companyId,
      rootId,
      source.next_version,
      content.specification,
      content.effectiveAt,
      await fingerprint(tx, content),
      employeeId,
    ],
  );
  const projected = await one<{ item: JsonObject }>(
    tx,
    `SELECT ${ITEM_VERSION_PROJECTION} item FROM manufacturing_item_versions v JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.id=$2`,
    [companyId, created.id],
  );
  return projected.item;
}

async function insertBomDraft(
  tx: SqlClient,
  source: ProductSource & { output_quantity: string },
  rootId: string,
  patch: BomVersionPatch,
  context: Context,
): Promise<JsonObject> {
  const { companyId, employeeId } = context.actor;
  const productItemVersionId = patch.productItemVersionId ?? source.product_item_version_id;
  const outputQuantity = patch.outputQuantity ?? source.output_quantity;
  const lines = patch.lines ?? (await copyBomLines(tx, companyId, source.id));
  const effectiveAt = patch.effectiveAt ?? source.effective_at;
  await validateProduct(tx, companyId, source.product_item_version_id, productItemVersionId);
  if (patch.lines !== undefined) await validateComponents(tx, companyId, lines);
  const created = await one<{ id: string }>(
    tx,
    'INSERT INTO manufacturing_bom_versions(tenant_id,bom_id,version,product_item_version_id,output_quantity,effective_at,canonical_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [
      companyId,
      rootId,
      source.next_version,
      productItemVersionId,
      outputQuantity,
      effectiveAt,
      await fingerprint(tx, {
        bomId: rootId,
        productItemVersionId,
        outputQuantity,
        effectiveAt,
        lines,
      }),
      employeeId,
    ],
  );
  await insertBomLines(tx, companyId, created.id, lines);
  const projected = await one<{ item: JsonObject }>(
    tx,
    `SELECT to_jsonb(v)||jsonb_build_object('outputQuantity',v.output_quantity,'outputQuantityText',v.output_quantity::text,'lines',coalesce((SELECT jsonb_agg(${BOM_LINE_DETAIL_PROJECTION} ORDER BY l.line_number)
     FROM manufacturing_bom_lines l JOIN manufacturing_item_versions iv ON iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id
     JOIN manufacturing_items i ON i.id=iv.item_id AND i.tenant_id=iv.tenant_id WHERE l.tenant_id=v.tenant_id AND l.bom_version_id=v.id),'[]'::jsonb)) item
   FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.id=$2`,
    [companyId, created.id],
  );
  return projected.item;
}

async function insertRoutingDraft(
  tx: SqlClient,
  source: ProductSource,
  rootId: string,
  patch: RoutingVersionPatch,
  context: Context,
): Promise<JsonObject> {
  const { companyId, employeeId } = context.actor;
  const productItemVersionId = patch.productItemVersionId ?? source.product_item_version_id;
  const operations = patch.operations ?? (await copyOperations(tx, companyId, source.id));
  const effectiveAt = patch.effectiveAt ?? source.effective_at;
  await validateProduct(tx, companyId, source.product_item_version_id, productItemVersionId);
  const created = await one<{ id: string }>(
    tx,
    'INSERT INTO manufacturing_routing_versions(tenant_id,routing_id,version,product_item_version_id,effective_at,canonical_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [
      companyId,
      rootId,
      source.next_version,
      productItemVersionId,
      effectiveAt,
      await fingerprint(tx, { routingId: rootId, productItemVersionId, effectiveAt, operations }),
      employeeId,
    ],
  );
  await insertRoutingOperations(tx, companyId, created.id, operations);
  const projected = await one<{ item: JsonObject }>(
    tx,
    `SELECT ${ROUTING_VERSION_DETAIL_PROJECTION} item FROM manufacturing_routing_versions v JOIN manufacturing_routings r ON r.id=v.routing_id AND r.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.id=$2`,
    [companyId, created.id],
  );
  return projected.item;
}

export class PostgresManufacturingVersionRepository extends PostgresManufacturingReadRepository {
  private continueDraft<K extends Kind>(
    kind: K,
    rootId: string,
    patch: VersionPatch,
    key: string,
    context: Context,
    correlationId: string,
    insert: (tx: SqlClient, source: Sources[K]) => Promise<JsonObject>,
  ): Promise<JsonObject> {
    company(context);
    const { companyId, employeeId } = context.actor;
    const aggregate = AGGREGATES[kind];
    return this.db.transaction(async (tx) => {
      const command = {
        type: `${aggregate}.version-created`,
        subjectId: rootId,
        actorId: employeeId,
        requestHash: await fingerprint(tx, patch),
      };
      const replayed = await replayCommercialCommand(tx, companyId, key, command);
      if (replayed) return replayed;
      const source = await copySource<Sources[K]>(tx, kind, companyId, rootId, patch);
      const result = await insert(tx, source);
      await writeAuditOutbox(
        tx,
        command.type,
        aggregate,
        rootId,
        source.next_version,
        context,
        correlationId,
        { ...result, copyFromVersionId: source.id },
      );
      await retainCommercialCommand(tx, companyId, key, command, result);
      return result;
    });
  }

  public createItemVersion(
    rootId: string,
    patch: ItemVersionPatch,
    key: string,
    context: Context,
    correlationId: string,
  ): Promise<JsonObject> {
    return this.continueDraft(
      'item',
      rootId,
      patch,
      key,
      context,
      correlationId,
      (tx, source: Source & { specification: JsonObject }) =>
        insertItemDraft(tx, source, rootId, patch, context),
    );
  }

  public createBomVersion(
    rootId: string,
    patch: BomVersionPatch,
    key: string,
    context: Context,
    correlationId: string,
  ): Promise<JsonObject> {
    return this.continueDraft(
      'bom',
      rootId,
      patch,
      key,
      context,
      correlationId,
      (tx, source: ProductSource & { output_quantity: string }) =>
        insertBomDraft(tx, source, rootId, patch, context),
    );
  }

  public createRoutingVersion(
    rootId: string,
    patch: RoutingVersionPatch,
    key: string,
    context: Context,
    correlationId: string,
  ): Promise<JsonObject> {
    return this.continueDraft(
      'routing',
      rootId,
      patch,
      key,
      context,
      correlationId,
      (tx, source: ProductSource) => insertRoutingDraft(tx, source, rootId, patch, context),
    );
  }
}
