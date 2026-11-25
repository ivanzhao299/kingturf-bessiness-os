import type { SqlClient } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';

export type BomSubstitute = Readonly<{
  itemVersionId: string;
  priority: number;
  conversionFactor: string;
}>;
export type BomLine = Readonly<{
  componentItemVersionId: string;
  quantity: string;
  scrapBasisPoints: number;
  substitutes: readonly BomSubstitute[];
}>;
export type RoutingOperation = Readonly<{
  operationCode: string;
  name: string;
  workCenterCode: string;
  sequence: number;
  setupMinutes: string;
  runMinutesPerUnit: string;
  instructions: JsonObject;
}>;

export async function insertBomLines(
  tx: SqlClient,
  tenantId: string,
  versionId: string,
  lines: readonly (BomLine & { lineNumber?: number })[],
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    const inserted = (
      await tx.query<{ id: string }>(
        'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity,scrap_basis_points) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [
          tenantId,
          versionId,
          line.lineNumber ?? index + 1,
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
          tenantId,
          inserted.id,
          substitute.itemVersionId,
          substitute.priority,
          substitute.conversionFactor,
        ],
      );
  }
}

export async function insertRoutingOperations(
  tx: SqlClient,
  tenantId: string,
  versionId: string,
  operations: readonly RoutingOperation[],
): Promise<void> {
  for (const operation of operations)
    await tx.query(
      'INSERT INTO manufacturing_routing_operations(tenant_id,routing_version_id,sequence,operation_code,name,work_center_code,setup_minutes,run_minutes_per_unit,instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        tenantId,
        versionId,
        operation.sequence,
        operation.operationCode,
        operation.name,
        operation.workCenterCode,
        operation.setupMinutes,
        operation.runMinutesPerUnit,
        operation.instructions,
      ],
    );
}
