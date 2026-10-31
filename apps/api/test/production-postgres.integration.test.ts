import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import { PostgresProductionCostRepository } from '../src/production-cost-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; production PostgreSQL tests may not be skipped');

describe.each([
  { outputQuantity: '1', plannedTotal: '88.500000' },
  { outputQuantity: '10', plannedTotal: '43.500000' },
])(
  'KT-L15 production acceptance with BOM output $outputQuantity',
  ({ outputQuantity, plannedTotal }) => {
    const schema = `production_${randomUUID().replaceAll('-', '')}`;
    const company = randomUUID(),
      team = randomUUID(),
      employee = randomUUID(),
      approver = randomUUID(),
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
    let admin: Database,
      db: Database,
      production: PostgresProductionRepository,
      costs: PostgresProductionCostRepository,
      scopedConnection: string;

    beforeAll(async () => {
      admin = new Database(connectionString);
      await admin.query(`CREATE SCHEMA ${schema}`);
      const scoped = new URL(connectionString);
      scoped.searchParams.set('options', `-csearch_path=${schema}`);
      scopedConnection = scoped.toString();
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
        "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E2','Cost Approver','approver@production.test')",
        [approver, company, team],
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
        "INSERT INTO manufacturing_bom_versions(id,tenant_id,bom_id,version,product_item_version_id,status,output_quantity,effective_at,canonical_hash,published_at,created_by) VALUES($1,$2,$3,1,$4,'PUBLISHED',$6,now(),repeat('c',64),now(),$5)",
        [bomVersion, company, bom, finishedVersion, employee, outputQuantity],
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
      costs = new PostgresProductionCostRepository(db);
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
      await production.transactMaterial(
        order.id as string,
        {
          transactionType: 'RETURN',
          itemVersionId: materialVersion,
          lotId: materialLot,
          locationId: location,
          quantity: '2',
          reason: 'Unused return',
          occurredAt: '2026-08-17T08:30:00Z',
          idempotencyKey: 'WO-1-RETURN',
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
      const policy = await costs.createPolicy(
        {
          version: 1,
          currency: 'CNY',
          laborRatePerHour: '60',
          machineRatePerHour: '120',
          overheadRatePerMachineHour: '30',
          effectiveFrom: '2026-08-01',
          sourceReference: 'COST-POLICY-1',
          materialRates: [
            { itemVersionId: materialVersion, unitCost: '5', sourceReference: 'RM-1-STANDARD' },
          ],
        },
        context,
        randomUUID(),
      );
      const costRun = await costs.calculate(
        {
          productionOrderId: order.id as string,
          policyId: policy.id,
          runNumber: 'COST-WO-1',
          idempotencyKey: 'COST-WO-1-CALC',
        },
        context,
        randomUUID(),
      );
      expect(costRun.plannedTotal).toBe(plannedTotal);
      expect(costRun.actualTotal).toBe('237.500000');
      await expect(
        costs.decide(
          costRun.id,
          'APPROVED',
          { reason: 'Self approval', evidence: {}, idempotencyKey: 'COST-WO-1-SELF' },
          context,
          randomUUID(),
        ),
      ).rejects.toThrow(/cannot approve/u);
      await costs.decide(
        costRun.id,
        'APPROVED',
        {
          reason: 'Finance approved',
          evidence: { review: 'OK' },
          idempotencyKey: 'COST-WO-1-APPROVE',
        },
        { ...context, actor: { companyId: company, employeeId: approver } },
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
      expect(result?.materials).toHaveLength(2);
      expect(result?.reports).toHaveLength(1);
      expect(result?.rolls).toHaveLength(1);
      await expect(
        db.query('UPDATE production_operation_reports SET notes=notes WHERE tenant_id=$1', [
          company,
        ]),
      ).rejects.toThrow(/immutable/u);
      await expect(
        db.query('UPDATE production_rolls SET quantity=quantity WHERE tenant_id=$1', [company]),
      ).rejects.toThrow(/immutable/u);
      const balance = await db.query<{ quantity: string }>(
        'SELECT quantity FROM inventory_balances WHERE tenant_id=$1 AND lot_id=$2',
        [company, materialLot],
      );
      expect(Number(balance.rows[0]?.quantity)).toBe(12);
    });
    it('TD-COST-003: aggregates one actual material movement once across duplicate BOM lines', async () => {
      await db.query(
        'INSERT INTO manufacturing_bom_lines(tenant_id,bom_version_id,line_number,component_item_version_id,quantity) VALUES($1,$2,2,$3,1)',
        [company, bomVersion, materialVersion],
      );
      const order = await production.create(
        {
          orderNumber: `DUPLICATE-BOM-${outputQuantity}`,
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '10',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: 'TD-COST-003',
        },
        context,
        randomUUID(),
      );
      if (typeof order.id !== 'string') throw new Error('Order ID missing');
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          order.id,
          state,
          { reason: 'Duplicate BOM setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      await production.transactMaterial(
        order.id,
        {
          transactionType: 'ISSUE',
          itemVersionId: materialVersion,
          lotId: materialLot,
          locationId: location,
          quantity: '8',
          reason: 'Single actual movement for duplicate component',
          occurredAt: '2026-08-17T08:00:00Z',
          idempotencyKey: randomUUID(),
        },
        context,
        randomUUID(),
      );
      const operation = (
        await db.query<{ id: string }>(
          'SELECT id FROM production_order_operations WHERE production_order_id=$1',
          [order.id],
        )
      ).rows[0];
      if (!operation) throw new Error('Operation missing');
      const report = await production.reportOperation(
        order.id,
        {
          operationId: operation.id,
          goodQuantity: '10',
          scrapQuantity: '0',
          laborMinutes: '1',
          machineMinutes: '1',
          startedAt: '2026-08-17T09:00:00Z',
          completedAt: '2026-08-17T09:01:00Z',
          notes: 'Duplicate BOM cost sample',
          idempotencyKey: randomUUID(),
        },
        context,
        randomUUID(),
      );
      await production.createOutput(
        order.id,
        {
          operationReportId: report.id as string,
          itemVersionId: finishedVersion,
          rollNumber: `DUP-ROLL-${outputQuantity}`,
          lotNumber: `DUP-LOT-${outputQuantity}`,
          locationId: location,
          quantity: '10',
          manufacturedAt: '2026-08-17',
        },
        context,
        randomUUID(),
      );
      await production.transition(
        order.id,
        'COMPLETED',
        { reason: 'Duplicate BOM complete', evidence: {}, idempotencyKey: randomUUID() },
        context,
        randomUUID(),
      );
      const policy = await costs.createPolicy(
        {
          version: 700 + Number(outputQuantity),
          currency: 'CNY',
          laborRatePerHour: '60',
          machineRatePerHour: '120',
          overheadRatePerMachineHour: '30',
          effectiveFrom: '2026-08-01',
          sourceReference: 'TD-COST-003-POLICY',
          materialRates: [
            { itemVersionId: materialVersion, unitCost: '5', sourceReference: 'TD-COST-003-RATE' },
          ],
        },
        context,
        randomUUID(),
      );
      const costRun = await costs.calculate(
        {
          productionOrderId: order.id,
          policyId: policy.id,
          runNumber: `DUP-COST-${outputQuantity}`,
          idempotencyKey: randomUUID(),
        },
        context,
        randomUUID(),
      );
      expect(costRun.materialSnapshot).toHaveLength(2);
      expect(costRun.materialSnapshot[0]?.actual_quantity).toBe('8.000000');
      expect(costRun.materialSnapshot[1]?.actual_quantity).toBe('8.000000');
      expect(costRun.actualTotal).toBe('43.500000');
    });
    it('TD-COST-002: records rejected cost revision uniqueness and blocked close without changing history', async () => {
      const order = await production.create(
        {
          orderNumber: 'REJECT-WO',
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '1',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: 'TEST-REJECT',
        },
        context,
        randomUUID(),
      );
      if (typeof order.id !== 'string') throw new Error('Order ID missing');
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          order.id,
          state,
          { reason: 'Synthetic revision setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      const operation = (
        await db.query<{ id: string }>(
          'SELECT id FROM production_order_operations WHERE production_order_id=$1',
          [order.id],
        )
      ).rows[0];
      if (!operation) throw new Error('Operation missing');
      await production.reportOperation(
        order.id,
        {
          operationId: operation.id,
          goodQuantity: '1',
          scrapQuantity: '0',
          laborMinutes: '1',
          machineMinutes: '1',
          startedAt: '2026-08-17T09:00:00Z',
          completedAt: '2026-08-17T09:01:00Z',
          notes: 'Synthetic report',
          idempotencyKey: randomUUID(),
        },
        context,
        randomUUID(),
      );
      await production.transition(
        order.id,
        'COMPLETED',
        { reason: 'Completed', evidence: {}, idempotencyKey: randomUUID() },
        context,
        randomUUID(),
      );
      const policy = await costs.createPolicy(
        {
          version: 99,
          currency: 'CNY',
          laborRatePerHour: '60',
          machineRatePerHour: '120',
          overheadRatePerMachineHour: '30',
          effectiveFrom: '2026-08-01',
          sourceReference: 'REJECT-POLICY',
          materialRates: [
            { itemVersionId: materialVersion, unitCost: '5', sourceReference: 'FIXED' },
          ],
        },
        context,
        randomUUID(),
      );
      const input = {
        productionOrderId: order.id,
        policyId: policy.id,
        runNumber: 'REJECT-COST-1',
        idempotencyKey: randomUUID(),
      };
      const first = await costs.calculate(input, context, randomUUID());
      await costs.decide(
        first.id,
        'REJECTED',
        {
          reason: 'Synthetic finance rejection',
          evidence: { review: 'REVISE' },
          idempotencyKey: randomUUID(),
        },
        { ...context, actor: { companyId: company, employeeId: approver } },
        randomUUID(),
      );
      await expect(
        costs.calculate(
          { ...input, runNumber: 'REJECT-COST-2', idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        production.transition(
          order.id,
          'CLOSED',
          { reason: 'Must remain blocked', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        ),
      ).rejects.toThrow(/approved/u);
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM production_cost_runs WHERE production_order_id=$1',
            [order.id],
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
    });

    it('TD-COST-001: characterizes independent component rounding rejected by the exact total constraint', async () => {
      const order = await production.create(
        {
          orderNumber: 'ROUND-WO',
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '1',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: 'TEST-ROUND',
        },
        context,
        randomUUID(),
      );
      if (typeof order.id !== 'string') throw new Error('Synthetic rounding order missing');
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          order.id,
          state,
          { reason: 'Rounding setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      const operation = (
        await db.query<{ id: string }>(
          'SELECT id FROM production_order_operations WHERE production_order_id=$1',
          [order.id],
        )
      ).rows[0];
      if (!operation) throw new Error('Synthetic rounding operation missing');
      await production.reportOperation(
        order.id,
        {
          operationId: operation.id,
          goodQuantity: '1',
          scrapQuantity: '0',
          laborMinutes: '1',
          machineMinutes: '1',
          startedAt: '2026-08-17T09:00:00Z',
          completedAt: '2026-08-17T09:01:00Z',
          notes: 'Rounding setup',
          idempotencyKey: randomUUID(),
        },
        context,
        randomUUID(),
      );
      await production.transition(
        order.id,
        'COMPLETED',
        { reason: 'Rounding setup completed', evidence: {}, idempotencyKey: randomUUID() },
        context,
        randomUUID(),
      );
      const policy = await costs.createPolicy(
        {
          version: 100,
          currency: 'CNY',
          laborRatePerHour: '1',
          machineRatePerHour: '1',
          overheadRatePerMachineHour: '1',
          effectiveFrom: '2026-08-01',
          sourceReference: 'ROUND-POLICY',
          materialRates: [
            { itemVersionId: materialVersion, unitCost: '5', sourceReference: 'ROUND-FIXED' },
          ],
        },
        context,
        randomUUID(),
      );
      const reference = (
        await db.query<{ parts: string; total: string }>(
          'SELECT (3*round(2::numeric/60,6))::text parts,round(3*(2::numeric/60),6)::text total',
        )
      ).rows[0];
      expect(reference).toEqual({ parts: '0.099999', total: '0.100000' });
      const guard = (
        await db.query<{ conname: string }>(
          "SELECT conname FROM pg_constraint WHERE conrelid='production_cost_runs'::regclass AND pg_get_constraintdef(oid) LIKE '%planned_total%planned_material%' ",
        )
      ).rows[0];
      if (!guard) throw new Error('Existing planned component total constraint missing');
      const correlation = randomUUID();
      await expect(
        costs.calculate(
          {
            productionOrderId: order.id,
            policyId: policy.id,
            runNumber: 'ROUND-COST',
            idempotencyKey: randomUUID(),
          },
          context,
          correlation,
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: guard.conname });
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM production_cost_runs WHERE production_order_id=$1',
            [order.id],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM audit_events WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    });

    it('R1 bounds cumulative returns, preserves idempotency, and rejects direct orphan movements', async () => {
      const order = await production.create(
        {
          orderNumber: `R1-WO-${outputQuantity}`,
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '10',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: `R1-SOURCE-${outputQuantity}`,
        },
        context,
        randomUUID(),
      );
      if (typeof order.id !== 'string') throw new Error('R1 order missing');
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          order.id,
          state,
          { reason: 'R1 setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      await db.query(
        `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id)
         VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,100,now(),'R1-TEST',$5,repeat('e',64),$6,$7)`,
        [company, materialVersion, materialLot, location, randomUUID(), employee, randomUUID()],
      );
      const material = (quantity: string, type: 'ISSUE' | 'RETURN', key: string) => ({
        transactionType: type,
        itemVersionId: materialVersion,
        lotId: materialLot,
        locationId: location,
        quantity,
        reason: 'R1 test',
        occurredAt: '2026-10-31T00:00:00Z',
        idempotencyKey: key,
      });
      await production.transactMaterial(
        order.id,
        material('10', 'ISSUE', `R1-ISSUE-${outputQuantity}`),
        context,
        randomUUID(),
      );
      await expect(
        production.transactMaterial(
          order.id,
          { ...material('9', 'ISSUE', `R1-ISSUE-${outputQuantity}`) },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        production.transactMaterial(
          order.id,
          material('11', 'RETURN', `R1-OVER-${outputQuantity}`),
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /cumulative issue/u });
      await production.transactMaterial(
        order.id,
        material('3', 'ISSUE', `R1-ISSUE-2-${outputQuantity}`),
        context,
        randomUUID(),
      );
      await production.transactMaterial(
        order.id,
        material('4', 'RETURN', `R1-RETURN-4-${outputQuantity}`),
        context,
        randomUUID(),
      );
      const finalReturn = material('9', 'RETURN', `R1-RETURN-9-${outputQuantity}`);
      await production.transactMaterial(order.id, finalReturn, context, randomUUID());
      await expect(
        production.transactMaterial(order.id, finalReturn, context, randomUUID()),
      ).rejects.toMatchObject({ code: '23505' });
      expect(
        (
          await db.query<{ issued: string; returned: string; net: string }>(
            `SELECT
              coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)::text issued,
              coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0)::text returned,
              (coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)-coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0))::text net
             FROM production_material_transactions
             WHERE tenant_id=$1 AND production_order_id=$2 AND item_version_id=$3 AND lot_id=$4 AND location_id=$5`,
            [company, order.id, materialVersion, materialLot, location],
          )
        ).rows,
      ).toEqual([{ issued: '13.000000', returned: '13.000000', net: '0.000000' }]);

      const concurrentOrder = await production.create(
        {
          orderNumber: `R1-CONCURRENT-${outputQuantity}`,
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '1',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: `R1-CONCURRENT-SOURCE-${outputQuantity}`,
        },
        context,
        randomUUID(),
      );
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          concurrentOrder.id as string,
          state,
          { reason: 'R1 concurrency setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      await production.transactMaterial(
        concurrentOrder.id as string,
        material('10', 'ISSUE', `R1-CONCURRENT-ISSUE-${outputQuantity}`),
        context,
        randomUUID(),
      );
      const left = new Database(scopedConnection);
      const right = new Database(scopedConnection);
      try {
        const results = await Promise.allSettled([
          new PostgresProductionRepository(left).transactMaterial(
            concurrentOrder.id as string,
            material('7', 'RETURN', `R1-CONCURRENT-RETURN-A-${outputQuantity}`),
            context,
            randomUUID(),
          ),
          new PostgresProductionRepository(right).transactMaterial(
            concurrentOrder.id as string,
            material('7', 'RETURN', `R1-CONCURRENT-RETURN-B-${outputQuantity}`),
            context,
            randomUUID(),
          ),
        ]);
        expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
      } finally {
        await left.close();
        await right.close();
      }
      expect(
        (
          await db.query<{ issued: string; returned: string; net: string }>(
            `SELECT
              coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)::text issued,
              coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0)::text returned,
              (coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)-coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0))::text net
             FROM production_material_transactions
             WHERE tenant_id=$1 AND production_order_id=$2 AND item_version_id=$3 AND lot_id=$4 AND location_id=$5`,
            [company, concurrentOrder.id, materialVersion, materialLot, location],
          )
        ).rows,
      ).toEqual([{ issued: '10.000000', returned: '7.000000', net: '3.000000' }]);

      for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE'] as const) {
        const isolatedOrder = await production.create(
          {
            orderNumber: `R1-${isolation.replaceAll(' ', '-')}-${outputQuantity}`,
            itemVersionId: finishedVersion,
            routingVersionId: routingVersion,
            plannedQuantity: '1',
            plannedStartAt: '2026-08-16',
            plannedDueAt: '2026-08-20',
            sourceReference: `R1-${isolation}-SOURCE-${outputQuantity}`,
          },
          context,
          randomUUID(),
        );
        for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
          await production.transition(
            isolatedOrder.id as string,
            state,
            { reason: 'R1 isolation setup', evidence: {}, idempotencyKey: randomUUID() },
            context,
            randomUUID(),
          );
        await production.transactMaterial(
          isolatedOrder.id as string,
          material('10', 'ISSUE', `R1-${isolation}-ISSUE-${outputQuantity}`),
          context,
          randomUUID(),
        );
        let ready = 0;
        let releaseBarrier!: () => void;
        const barrier = new Promise<void>((resolve) => {
          releaseBarrier = resolve;
        });
        const attempt = async (connection: Database, key: string) =>
          connection.transaction(async (tx) => {
            await tx.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
            await tx.query('SELECT 1');
            ready += 1;
            if (ready === 2) releaseBarrier();
            await barrier;
            const nested = {
              query: tx.query.bind(tx),
              transaction: <T>(work: (client: typeof tx) => Promise<T>) => work(tx),
            };
            return new PostgresProductionRepository(nested).transactMaterial(
              isolatedOrder.id as string,
              material('7', 'RETURN', key),
              context,
              randomUUID(),
            );
          });
        const left = new Database(scopedConnection);
        const right = new Database(scopedConnection);
        try {
          const results = await Promise.allSettled([
            attempt(left, `R1-${isolation}-A-${outputQuantity}`),
            attempt(right, `R1-${isolation}-B-${outputQuantity}`),
          ]);
          expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
          expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
          const rejected = results.find((item) => item.status === 'rejected');
          if (rejected?.status === 'rejected')
            expect((rejected.reason as { code?: string }).code).toMatch(/^(40001|P0001|23505)$/u);
        } finally {
          await left.close();
          await right.close();
        }
        expect(
          (
            await db.query<{ issued: string; returned: string; net: string }>(
              `SELECT
                coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)::text issued,
                coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0)::text returned,
                (coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)-coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0))::text net
               FROM production_material_transactions
               WHERE tenant_id=$1 AND production_order_id=$2 AND item_version_id=$3 AND lot_id=$4 AND location_id=$5`,
              [company, isolatedOrder.id, materialVersion, materialLot, location],
            )
          ).rows,
        ).toEqual([{ issued: '10.000000', returned: '7.000000', net: '3.000000' }]);
      }

      const otherLot = randomUUID(),
        otherLocation = randomUUID(),
        otherMaterialVersion = randomUUID(),
        otherMaterialLot = randomUUID();
      await db.query(
        "INSERT INTO inventory_locations(id,tenant_id,code,name,location_type) VALUES($1,$2,$3,'R1 Other','STORAGE')",
        [otherLocation, company, `R1-LOC-${outputQuantity}`],
      );
      await db.query(
        "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,'RELEASED')",
        [otherLot, company, `R1-LOT-${outputQuantity}`, materialVersion],
      );
      await expect(
        production.transactMaterial(
          order.id,
          {
            ...material('1', 'RETURN', `R1-OTHER-LOCATION-${outputQuantity}`),
            locationId: otherLocation,
          },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /cumulative issue/u });
      await expect(
        production.transactMaterial(
          order.id,
          { ...material('1', 'RETURN', `R1-OTHER-LOT-${outputQuantity}`), lotId: otherLot },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /cumulative issue/u });

      await db.query(
        "INSERT INTO manufacturing_item_versions(id,tenant_id,item_id,version,status,specification,effective_at,canonical_hash,published_at,created_by) VALUES($1,$2,$3,2,'PUBLISHED','{}',now(),repeat('f',64),now(),$4)",
        [otherMaterialVersion, company, materialItem, employee],
      );
      await db.query(
        "INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,'RELEASED')",
        [otherMaterialLot, company, `R1-OTHER-MATERIAL-${outputQuantity}`, otherMaterialVersion],
      );
      await expect(
        production.transactMaterial(
          order.id,
          {
            ...material('1', 'RETURN', `R1-OTHER-MATERIAL-${outputQuantity}`),
            itemVersionId: otherMaterialVersion,
            lotId: otherMaterialLot,
          },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /cumulative issue/u });

      const otherOrder = await production.create(
        {
          orderNumber: `R1-OTHER-ORDER-${outputQuantity}`,
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '1',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: `R1-OTHER-ORDER-SOURCE-${outputQuantity}`,
        },
        context,
        randomUUID(),
      );
      for (const state of ['RELEASED', 'IN_PROGRESS'] as const)
        await production.transition(
          otherOrder.id as string,
          state,
          { reason: 'R1 other order setup', evidence: {}, idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        );
      await expect(
        production.transactMaterial(
          otherOrder.id as string,
          material('1', 'RETURN', `R1-OTHER-ORDER-${outputQuantity}`),
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /cumulative issue/u });

      await expect(
        production.transactMaterial(
          order.id,
          material('0', 'RETURN', `R1-ZERO-${outputQuantity}`),
          context,
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        production.transactMaterial(
          order.id,
          material('-1', 'RETURN', `R1-NEGATIVE-${outputQuantity}`),
          context,
          randomUUID(),
        ),
      ).rejects.toThrow();

      const foreignContext = {
        actor: { companyId: randomUUID(), employeeId: randomUUID() },
        scopes: ['COMPANY'] as const,
        anchors: [],
      };
      await expect(
        production.transactMaterial(
          order.id,
          material('1', 'RETURN', `R1-FOREIGN-TENANT-${outputQuantity}`),
          foreignContext,
          randomUUID(),
        ),
      ).rejects.toThrow();

      const draft = await production.create(
        {
          orderNumber: `R1-DRAFT-${outputQuantity}`,
          itemVersionId: finishedVersion,
          routingVersionId: routingVersion,
          plannedQuantity: '1',
          plannedStartAt: '2026-08-16',
          plannedDueAt: '2026-08-20',
          sourceReference: `R1-DRAFT-SOURCE-${outputQuantity}`,
        },
        context,
        randomUUID(),
      );
      await expect(
        production.transactMaterial(
          draft.id as string,
          material('1', 'RETURN', `R1-DRAFT-RETURN-${outputQuantity}`),
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001', message: /released or active/u });

      await expect(
        db.transaction(async (tx) =>
          tx.query(
            `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id)
             VALUES($1,'RETURN',$2,$3,$4,1,now(),'PRODUCTION_ORDER',$5,repeat('f',64),$6,$7)`,
            [company, materialVersion, materialLot, location, order.id, employee, randomUUID()],
          ),
        ),
      ).rejects.toThrow(/requires a material transaction/u);
    });
  },
);
