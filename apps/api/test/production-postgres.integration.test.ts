import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresProductionRepository } from '../src/production-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; production PostgreSQL tests may not be skipped');

describe('KT-L15 PostgreSQL production execution acceptance', () => {
  const schema = `production_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID(),
    team = randomUUID(),
    employee = randomUUID(),
    finishedItem = randomUUID(),
    finishedVersion = randomUUID(),
    materialItem = randomUUID(),
    materialVersion = randomUUID(),
    bom = randomUUID(),
    bomVersion = randomUUID(),
    routing = randomUUID(),
    routingVersion = randomUUID(),
    routingOperation = randomUUID(),
    location = randomUUID(),
    materialLot = randomUUID();
  const context = {
    actor: { companyId: company, employeeId: employee },
    scopes: ['COMPANY'] as const,
    anchors: [],
  };
  let admin: Database, db: Database, production: PostgresProductionRepository;

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'PROD','Production','COMPANY')",
      [company],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'SHOP','Shop','TEAM')",
      [team, company],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E1','Operator','operator@production.test')",
      [employee, company, team],
    );
    await db.query(
      "INSERT INTO manufacturing_items(id,tenant_id,sku,name,item_type,base_unit_code,created_by) VALUES($1,$2,'FG-1','Finished','FINISHED_GOOD','M2',$3),($4,$2,'RM-1','Material','RAW_MATERIAL','KG',$3)",
      [finishedItem, company, employee, materialItem],
    );
    await db.query(
      "INSERT INTO manufacturing_item_versions(id,tenant_id,item_id,version,status,specification,effective_at,canonical_hash,published_at,created_by) VALUES($1,$3,$4,1,'PUBLISHED','{}',now(),repeat('a',64),now(),$5),($2,$3,$6,1,'PUBLISHED','{}',now(),repeat('b',64),now(),$5)",
      [finishedVersion, materialVersion, company, finishedItem, employee, materialItem],
    );
    await db.query(
      "INSERT INTO manufacturing_boms(id,tenant_id,code,name,product_item_id,created_by) VALUES($1,$2,'BOM-1','BOM',$3,$4)",
      [bom, company, finishedItem, employee],
    );
    await db.query(
      "INSERT INTO manufacturing_bom_versions(id,tenant_id,bom_id,version,product_item_version_id,status,output_quantity,effective_at,canonical_hash,published_at,created_by) VALUES($1,$2,$3,1,$4,'PUBLISHED',1,now(),repeat('c',64),now(),$5)",
      [bomVersion, company, bom, finishedVersion, employee],
    );
    await db.query(
      'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity) VALUES($1,$2,1,$3,1)',
      [company, bomVersion, materialVersion],
    );
    await db.query(
      "INSERT INTO manufacturing_routings(id,tenant_id,code,name,product_item_id,created_by) VALUES($1,$2,'RT-1','Routing',$3,$4)",
      [routing, company, finishedItem, employee],
    );
    await db.query(
      "INSERT INTO manufacturing_routing_versions(id,tenant_id,routing_id,version,product_item_version_id,status,effective_at,canonical_hash,published_at,created_by) VALUES($1,$2,$3,1,$4,'PUBLISHED',now(),repeat('d',64),now(),$5)",
      [routingVersion, company, routing, finishedVersion, employee],
    );
    await db.query(
      "INSERT INTO manufacturing_routing_operations(id,tenant_id,routing_version_id,sequence,operation_code,name,work_center_code,setup_minutes,run_minutes_per_unit,instructions) VALUES($1,$2,$3,10,'MAKE','Make','WC-1',1,1,'{}')",
      [routingOperation, company, routingVersion],
    );
    await db.query(
      "INSERT INTO inventory_locations(id,tenant_id,code,name,location_type) VALUES($1,$2,'PROD-1','Production','PRODUCTION')",
      [location, company],
    );
    await db.query(
      "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,'RM-LOT-1',$3,'RELEASED')",
      [materialLot, company, materialVersion],
    );
    await db.query(
      "INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,20,now(),'TEST',$5,repeat('e',64),$6,$7)",
      [company, materialVersion, materialLot, location, randomUUID(), employee, randomUUID()],
    );
    production = new PostgresProductionRepository(db);
  });

  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('executes and freezes order, material, operation, roll, inventory, and state evidence', async () => {
    const order = await production.create(
      {
        orderNumber: 'WO-1',
        itemVersionId: finishedVersion,
        routingVersionId: routingVersion,
        plannedQuantity: '10',
        plannedStartAt: '2026-08-16',
        plannedDueAt: '2026-08-20',
        sourceReference: 'TEST-WO-1',
      },
      context,
      randomUUID(),
    );
    await production.transition(
      order.id as string,
      'RELEASED',
      { reason: 'Ready', evidence: {}, idempotencyKey: 'WO-1-RELEASE' },
      context,
      randomUUID(),
    );
    await production.transition(
      order.id as string,
      'IN_PROGRESS',
      { reason: 'Start', evidence: {}, idempotencyKey: 'WO-1-START' },
      context,
      randomUUID(),
    );
    await production.transactMaterial(
      order.id as string,
      {
        transactionType: 'ISSUE',
        itemVersionId: materialVersion,
        lotId: materialLot,
        locationId: location,
        quantity: '10',
        reason: 'BOM issue',
        occurredAt: '2026-08-17T08:00:00Z',
        idempotencyKey: 'WO-1-ISSUE',
      },
      context,
      randomUUID(),
    );
    const listed = await production.list(context);
    const operation = (listed[0]?.operations as { id: string }[])[0];
    expect(operation).toBeDefined();
    const report = await production.reportOperation(
      order.id as string,
      {
        operationId: operation?.id ?? '',
        goodQuantity: '10',
        scrapQuantity: '1',
        laborMinutes: '60',
        machineMinutes: '55',
        startedAt: '2026-08-17T08:00:00Z',
        completedAt: '2026-08-17T09:00:00Z',
        notes: 'Completed',
        idempotencyKey: 'WO-1-REPORT',
      },
      context,
      randomUUID(),
    );
    await expect(
      production.reportOperation(
        order.id as string,
        {
          operationId: operation?.id ?? '',
          goodQuantity: '1',
          scrapQuantity: '0',
          laborMinutes: '1',
          machineMinutes: '1',
          startedAt: '2026-08-17T09:00:00Z',
          completedAt: '2026-08-17T09:01:00Z',
          notes: 'Excess',
          idempotencyKey: 'WO-1-REPORT-EXCESS',
        },
        context,
        randomUUID(),
      ),
    ).rejects.toThrow(/exceeds planned/u);
    await production.createOutput(
      order.id as string,
      {
        operationReportId: report.id as string,
        itemVersionId: finishedVersion,
        rollNumber: 'ROLL-1',
        lotNumber: 'FG-LOT-1',
        locationId: location,
        quantity: '10',
        manufacturedAt: '2026-08-17',
      },
      context,
      randomUUID(),
    );
    await production.transition(
      order.id as string,
      'COMPLETED',
      { reason: 'Done', evidence: {}, idempotencyKey: 'WO-1-COMPLETE' },
      context,
      randomUUID(),
    );
    await production.transition(
      order.id as string,
      'CLOSED',
      { reason: 'Closed', evidence: {}, idempotencyKey: 'WO-1-CLOSE' },
      context,
      randomUUID(),
    );
    const result = (await production.list(context))[0];
    expect(result?.state).toBe('CLOSED');
    expect(result?.materials).toHaveLength(1);
    expect(result?.reports).toHaveLength(1);
    expect(result?.rolls).toHaveLength(1);
    await expect(
      db.query('UPDATE production_operation_reports SET notes=notes WHERE tenant_id=$1', [company]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query('UPDATE production_rolls SET quantity=quantity WHERE tenant_id=$1', [company]),
    ).rejects.toThrow(/immutable/u);
    const balance = await db.query<{ quantity: string }>(
      'SELECT quantity FROM inventory_balances WHERE tenant_id=$1 AND lot_id=$2',
      [company, materialLot],
    );
    expect(Number(balance.rows[0]?.quantity)).toBe(10);
  });
});
