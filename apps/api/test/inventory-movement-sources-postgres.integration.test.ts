import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PostgresProductionRepository } from '../src/production-repositories.ts';
import { PostgresProductionCostRepository } from '../src/production-cost-repositories.ts';
import type { JsonObject } from '@kingturf/types';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.ts';

const sources = '/api/v1/inventory-movement-sources';
const text = (row: JsonObject, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
};
const idOf = (row: JsonObject) => {
  if (typeof row.id !== 'string') throw new Error('Missing fixture id');
  return row.id;
};
let owned: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
const fixture = () => {
  if (!owned) throw new Error('Missing inventory sources fixture');
  return owned;
};
let reader: string, mover: string, neither: string, foreign: string, restricted: string;
let restrictedEmployee: string, location: string, item: string;
let production: PostgresProductionRepository;
let expected: { value: string; label: string }[];
const get = (token: string, pathname = sources) =>
  fixture().dispatch({ token, method: 'GET', pathname });

const approveCloseCost = async (orderId: string, finished: JsonObject) => {
  const { manufacturing, context, db } = fixture();
  const material = await manufacturing.createItem(
    {
      sku: 'RM-PG2-SOURCES',
      name: '关单夹具原料',
      itemType: 'RAW_MATERIAL',
      baseUnitCode: 'KG',
      specification: {},
      effectiveAt: '2026-01-01T00:00:00Z',
      publish: true,
    },
    context,
    randomUUID(),
  );
  await manufacturing.createBom(
    {
      code: 'BOM-PG2-SOURCES',
      name: '关单夹具BOM',
      productItemId: text(finished, 'itemId'),
      productItemVersionId: item,
      outputQuantity: '1',
      effectiveAt: '2026-01-01T00:00:00Z',
      publish: true,
      lines: [
        {
          componentItemVersionId: idOf(material),
          quantity: '1',
          scrapBasisPoints: 0,
          substitutes: [],
        },
      ],
    },
    context,
    randomUUID(),
  );
  const costs = new PostgresProductionCostRepository(db);
  const policy = await costs.createPolicy(
    {
      version: 1,
      currency: 'CNY',
      laborRatePerHour: '60',
      machineRatePerHour: '60',
      overheadRatePerMachineHour: '30',
      effectiveFrom: '2026-01-01',
      sourceReference: 'PG2-SOURCE-COST',
      materialRates: [
        { itemVersionId: idOf(material), unitCost: '1', sourceReference: 'PG2-SOURCE-RATE' },
      ],
    },
    context,
    randomUUID(),
  );
  const run = await costs.calculate(
    {
      productionOrderId: orderId,
      policyId: policy.id,
      runNumber: 'PG2-SOURCE-COST',
      idempotencyKey: randomUUID(),
    },
    context,
    randomUUID(),
  );
  const approver = await fixture().addEmployee();
  await costs.decide(
    run.id,
    'APPROVED',
    { reason: 'PG2 seed', evidence: {}, idempotencyKey: randomUUID() },
    { ...context, actor: { ...context.actor, employeeId: approver } },
    randomUUID(),
  );
};

beforeAll(async () => {
  owned = await ownedProcurementApp('inventory_sources_pg');
  production = new PostgresProductionRepository(owned.db);
  reader = await owned.session(owned.employee, ['inventory:read']);
  mover = await owned.session(await owned.addEmployee(), ['inventory:move']);
  neither = await owned.session(await owned.addEmployee(), ['procurement:read']);
  foreign = await owned.session(owned.otherEmployee, ['inventory:read']);
  restrictedEmployee = await owned.addEmployee();
  restricted = await owned.session(restrictedEmployee, ['inventory:read']);
  const finished = await owned.manufacturing.createItem(
    {
      sku: 'FG-PG2-SOURCES',
      name: '来源候选成品',
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'M2',
      specification: {},
      effectiveAt: '2026-01-01T00:00:00Z',
      publish: true,
    },
    owned.context,
    randomUUID(),
  );
  item = idOf(finished);
  const routing = await owned.manufacturing.createRouting(
    {
      code: 'RT-PG2-SOURCES',
      name: '来源候选工艺',
      productItemId: text(finished, 'itemId'),
      productItemVersionId: item,
      effectiveAt: '2026-01-01T00:00:00Z',
      publish: true,
      operations: [
        {
          sequence: 10,
          operationCode: 'PACK',
          name: '包装',
          workCenterCode: 'PACK',
          setupMinutes: '0',
          runMinutesPerUnit: '1',
          instructions: {},
        },
      ],
    },
    owned.context,
    randomUUID(),
  );
  location = idOf(
    await owned.repository.createLocation(
      { code: 'PG2-SRC', name: '来源候选库位', locationType: 'STORAGE' },
      owned.context,
      randomUUID(),
    ),
  );
  const transition = (
    id: string,
    state: 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED',
  ) =>
    production.transition(
      id,
      state,
      { reason: 'PG2 seed', evidence: {}, idempotencyKey: randomUUID() },
      fixture().context,
      randomUUID(),
    );
  for (const state of ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED']) {
    const order = await production.create(
      {
        orderNumber: `WO-PG2-${state}`,
        itemVersionId: item,
        routingVersionId: idOf(routing),
        plannedQuantity: '1',
        plannedStartAt: '2026-11-01T00:00:00Z',
        plannedDueAt: '2026-12-10T00:00:00Z',
        sourceReference: randomUUID(),
      },
      owned.context,
      randomUUID(),
    );
    const id = idOf(order);
    if (state === 'DRAFT') continue;
    if (state === 'CANCELLED') {
      await transition(id, 'CANCELLED');
      continue;
    }
    await transition(id, 'RELEASED');
    if (state === 'RELEASED') continue;
    await transition(id, 'IN_PROGRESS');
    if (state === 'IN_PROGRESS') continue;
    const operation = (
      await owned.db.query<{ id: string }>(
        'SELECT id FROM production_order_operations WHERE production_order_id=$1',
        [id],
      )
    ).rows[0];
    if (!operation) throw new Error('Missing fixture operation');
    const report = await production.reportOperation(
      id,
      {
        operationId: operation.id,
        goodQuantity: '1',
        scrapQuantity: '0',
        laborMinutes: '1',
        machineMinutes: '1',
        startedAt: '2026-11-02T00:00:00Z',
        completedAt: '2026-11-02T01:00:00Z',
        notes: 'seed',
        idempotencyKey: randomUUID(),
      },
      owned.context,
      randomUUID(),
    );
    await transition(id, 'COMPLETED');
    if (state === 'COMPLETED') continue;
    await production.createOutput(
      id,
      {
        operationReportId: idOf(report),
        itemVersionId: item,
        rollNumber: 'ROLL-PG2-CLOSED',
        lotNumber: 'LOT-PG2-CLOSED',
        locationId: location,
        quantity: '1',
        manufacturedAt: '2026-11-02',
      },
      owned.context,
      randomUUID(),
    );
    await approveCloseCost(id, finished);
    await transition(id, 'CLOSED');
  }
  // 与原前端 workOrderChoices 同口径，逐键比较全量仓储派生结果和最小候选投影。
  expected = (await production.list(owned.context))
    .filter((row) =>
      ['DRAFT', 'RELEASED', 'IN_PROGRESS'].includes(
        text(row, 'status', 'effectiveStatus', 'state'),
      ),
    )
    .map((row) => ({ value: idOf(row), label: text(row, 'order_number', 'orderNumber') }));
}, 60_000);

afterAll(async () => {
  await owned?.close();
}, 30_000);

it('inventory-only readers obtain the exact legacy work-order choices with only value and label', async () => {
  const result = await get(reader);
  expect(result.statusCode).toBe(200);
  expect(result.body).toStrictEqual({ items: expected });
  expect(expected).toHaveLength(3);
  expect(expected.map((row) => row.label).sort()).toEqual([
    'WO-PG2-DRAFT',
    'WO-PG2-IN_PROGRESS',
    'WO-PG2-RELEASED',
  ]);
  expect((await get(reader, '/api/v1/production-orders')).statusCode).toBe(403);
});

it('inventory:move alone can read the candidates and submit the unchanged movement payload', async () => {
  const response = await get(mover);
  expect(response.statusCode).toBe(200);
  expect(response.body).toStrictEqual({ items: expected });
  const lot = randomUUID();
  await fixture().db.query(
    'INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,$5)',
    [lot, fixture().company, 'LOT-PG2-MOVE', item, 'RELEASED'],
  );
  const result = await fixture().dispatch({
    token: mover,
    method: 'POST',
    pathname: '/api/v1/inventory-movements',
    body: {
      movementType: 'ADJUSTMENT_IN',
      itemVersionId: item,
      lotId: lot,
      locationId: location,
      quantity: '1.5',
      occurredAt: '2026-11-26T00:00:00Z',
      sourceType: 'WORK-ORDER',
      sourceId: expected[0]?.value,
    },
  });
  expect(result.statusCode).toBe(201);
  expect(
    (
      await fixture().db.query(
        'SELECT source_type,source_id,quantity_delta FROM inventory_movements WHERE lot_id=$1',
        [lot],
      )
    ).rows,
  ).toEqual([
    { source_type: 'WORK-ORDER', source_id: expected[0]?.value, quantity_delta: '1.500000' },
  ]);
});

it('returns 403 without either inventory permission and isolates foreign tenants', async () => {
  expect((await get(neither)).statusCode).toBe(403);
  expect(await get(foreign)).toMatchObject({ statusCode: 200, body: { items: [] } });
});

it('keeps the existing company-scope gate and enforces the selected inventory grant field allowlist', async () => {
  const update = (fields: string[] | null, scopes: string[]) =>
    fixture().db.query(
      `UPDATE role_permission_grants g SET field_allowlist=$2::text[],data_scopes=$3::data_scope[]
     FROM permissions p WHERE p.id=g.permission_id AND p.capability='inventory:read'
     AND g.role_id IN(SELECT role_id FROM employee_role_assignments WHERE employee_id=$1)`,
      [restrictedEmployee, fields, scopes],
    );
  await update(null, ['TEAM']);
  expect((await get(restricted)).statusCode).toBe(403);
  await update(['value'], ['COMPANY']);
  expect((await get(restricted)).statusCode).toBe(403);
  await update(['value', 'label'], ['COMPANY']);
  expect(await get(restricted)).toMatchObject({ statusCode: 200, body: { items: expected } });
  await update(null, ['GROUP']);
  expect(await get(restricted)).toMatchObject({ statusCode: 200, body: { items: expected } });
});
