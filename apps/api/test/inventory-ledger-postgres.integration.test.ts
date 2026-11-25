import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.ts';

const path = '/api/v1/inventory-balances';
const movements = '/api/v1/inventory-movements';
let owned: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
let admin: string;
let readOnly: string;
let itemVersionId: string;
let locationId: string;
let firstLot: string;
const fixture = () => {
  if (!owned) throw new Error('Inventory fixture missing');
  return owned;
};
const textId = (row: { id?: unknown }) => {
  if (typeof row.id !== 'string') throw new Error('Missing id');
  return row.id;
};

beforeAll(async () => {
  owned = await ownedProcurementApp('proc_inventory');
  const { context, manufacturing, db, repository, company, employee } = owned;
  admin = await owned.session(employee, 'ALL');
  readOnly = await owned.session(await owned.addEmployee(), ['inventory:read']);
  itemVersionId = textId(
    await manufacturing.createItem(
      {
        sku: 'RM-P6-INVENTORY',
        name: '库存测试物料',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    ),
  );
  locationId = textId(
    await repository.createLocation(
      { code: 'P6-TEST', name: '验收库位', locationType: 'STORAGE' },
      context,
      randomUUID(),
    ),
  );
  const addLot = async (code: string, quality: string, quantity: string) => {
    const id = randomUUID();
    await db.query(
      'INSERT INTO inventory_lots(id,tenant_id,lot_number,item_version_id,quality_status) VALUES($1,$2,$3,$4,$5)',
      [id, company, code, itemVersionId, quality],
    );
    await repository.move(
      {
        movementType: 'ADJUSTMENT_IN',
        itemVersionId,
        lotId: id,
        locationId,
        quantity,
        occurredAt: '2026-11-25T08:00:00Z',
        sourceType: 'MANUAL',
        sourceId: randomUUID(),
      },
      context,
      randomUUID(),
    );
    return id;
  };
  firstLot = await addLot('LOT-P6-FIRST', 'QUARANTINE', '3.5');
  await addLot('LOT-P6-SECOND', 'RELEASED', '12');
}, 30000);

afterAll(async () => {
  await owned?.close();
}, 30000);

const get = (pathname: string, token = admin) =>
  fixture().dispatch({ token, method: 'GET', pathname });
const move = (quantity: string, token = admin, sourceId = randomUUID()) =>
  fixture().dispatch({
    token,
    method: 'POST',
    pathname: movements,
    body: {
      movementType: 'ADJUSTMENT_OUT',
      itemVersionId,
      lotId: firstLot,
      locationId,
      quantity,
      occurredAt: '2026-11-25T09:00:00Z',
      sourceType: 'WORK-ORDER',
      sourceId,
    },
  });

it('returns the exact unfiltered legacy list, nested movement keys included', async () => {
  const legacy = await fixture().repository.list('inventory', fixture().context);
  expect(legacy).toHaveLength(2);
  const response = await get(path);
  expect(response.statusCode).toBe(200);
  expect(response.body).toStrictEqual({ items: legacy });
});

it('filters, sorts numeric quantities, and uses both parts of the location-aware cursor', async () => {
  const first = await get(
    `${path}?limit=1&sort=quantity&direction=asc&location=${locationId}&query=rm-p6`,
  );
  const nextCursor = `${firstLot}:${locationId}`;
  expect(first.statusCode).toBe(200);
  expect(first.body).toEqual({
    items: [expect.objectContaining({ lotId: firstLot, quantity: 3.5 })],
    nextCursor,
  });
  expect(
    (await get(`${path}?limit=1&sort=quantity&direction=asc&cursor=${nextCursor}`)).body,
  ).toEqual({ items: [expect.objectContaining({ lotNumber: 'LOT-P6-SECOND', quantity: 12 })] });
  expect((await get(`${path}?limit=1&sort=quantity&direction=desc`)).body).toMatchObject({
    items: [{ lotNumber: 'LOT-P6-SECOND', quantity: 12 }],
  });
  expect((await get(`${path}?status=QUARANTINE&query=P6-FIRST`)).body).toEqual({
    items: [expect.objectContaining({ lotId: firstLot, qualityStatus: 'QUARANTINE' })],
  });
  expect((await get(`${path}?cursor=${firstLot}`)).statusCode).toBe(400);
});

it('reads a location-specific movement history with the existing read and tenant gates', async () => {
  const response = await get(`${path}/${firstLot}/${locationId}`, readOnly);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    lotId: firstLot,
    locationId,
    quantity: 3.5,
    origin: null,
    movements: [
      { movement_type: 'ADJUSTMENT_IN', source_type: 'MANUAL', actor_id: fixture().employee },
    ],
  });
  const other = await fixture().session(fixture().otherEmployee, 'ALL');
  expect((await get(`${path}/${firstLot}/${locationId}`, other)).statusCode).toBe(404);
  expect((await move('1', readOnly)).statusCode).toBe(403);
});

it('maps the exact negative-stock guard to Chinese 409 and preserves the append-only write', async () => {
  const sourceId = randomUUID();
  const refused = await move('4', admin, sourceId);
  expect(refused.statusCode).toBe(409);
  expect(refused.body).toMatchObject({
    error: { message: '本次出库会使该批次库位结存为负，请减少数量或刷新库存后重试' },
  });
  expect((await get(`${path}/${firstLot}/${locationId}`)).body).toMatchObject({
    quantity: 3.5,
    movements: [{ movement_type: 'ADJUSTMENT_IN' }],
  });
  expect((await move('1', admin, sourceId)).statusCode).toBe(201);
  expect((await get(`${path}/${firstLot}/${locationId}`)).body).toMatchObject({
    quantity: 2.5,
    movements: [
      { movement_type: 'ADJUSTMENT_IN' },
      { movement_type: 'ADJUSTMENT_OUT', source_id: sourceId, quantity_delta: -1 },
    ],
  });
  expect((await move('1', admin, sourceId)).statusCode).toBe(500);
});
