import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.ts';

const path = '/api/v1/supplier-quotes';
let ownedFixture: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
const fixture = () => {
  if (!ownedFixture) throw new Error('Missing fixture');
  return ownedFixture;
};
let token: string;
let id: string;
let otherId: string;
let rfqLineId: string;

beforeAll(async () => {
  ownedFixture = await ownedProcurementApp('proc_quotes');
  const fixture = ownedFixture;
  token = await fixture.session(fixture.employee, 'ALL');
  const { repository, manufacturing, context, db, company, employee } = fixture;
  const item = await manufacturing.createItem(
    {
      sku: 'RM-PROC6-SEARCH',
      name: '测试物料',
      itemType: 'RAW_MATERIAL',
      baseUnitCode: 'KG',
      specification: {},
      effectiveAt: '2026-01-01T00:00:00Z',
      publish: true,
    },
    context,
    randomUUID(),
  );
  if (typeof item.id !== 'string') throw new Error('Missing material version');
  const supplier = await repository.createSupplier(
    {
      supplierNumber: 'SUP-PROC6',
      name: '独立报价供应商',
      currency: 'CNY',
      paymentTermsDays: 30,
      qualityRatingBasisPoints: 9000,
      contact: {},
    },
    context,
    randomUUID(),
  );
  const rfq = await repository.createRfq(
    {
      rfqNumber: 'RFQ-PROC6',
      responseDueAt: '2026-01-10T00:00:00Z',
      currency: 'CNY',
      issue: true,
      lines: [{ itemVersionId: item.id, quantity: '10', requiredAt: '2026-02-01' }],
    },
    context,
    randomUUID(),
  );
  const line = (
    await db.query<{ id: string }>('SELECT id FROM procurement_rfq_lines WHERE rfq_id=$1', [rfq.id])
  ).rows[0];
  if (!line) throw new Error('Missing seeded RFQ line');
  rfqLineId = line.id;
  const insert = async (reference: string, expiry: string) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO supplier_quotes (id,tenant_id,rfq_id,supplier_id,quote_reference,received_at,valid_until,terms,canonical_hash,created_by)
      VALUES ($1,$2,$3,$4,$5,'2026-01-09T00:00:00Z',$6,'{"currency":"CNY"}',repeat('a',64),$7)`,
      [id, company, rfq.id, supplier.id, reference, expiry, employee],
    );
    await db.query(
      `INSERT INTO supplier_quote_lines (tenant_id,supplier_quote_id,rfq_line_id,unit_price,promised_at,minimum_order_quantity)
      VALUES ($1,$2,$3,12.68,'2026-02-01',0)`,
      [company, id, line.id],
    );
    return id;
  };
  id = await insert('SQ-ALPHA', '2099-12-31');
  otherId = await insert('SQ-BETA', '2020-01-01');
}, 30000);

afterAll(async () => {
  await ownedFixture?.close();
}, 30000);

const get = (pathname: string, auth = token) =>
  fixture().dispatch({ token: auth, method: 'GET', pathname });

it('runs the default legacy SQL and keeps every JSON key and the envelope', async () => {
  const reference = await fixture().repository.list('quotes', fixture().context);
  expect(reference).toHaveLength(2);
  const response = await get(path);
  expect(response.statusCode).toBe(200);
  expect(response.body).toStrictEqual({ items: reference });
});

it('filters by expiry in business time and searches reference, supplier and SKU literally', async () => {
  for (const [query, expected] of [
    ['status=VALID', [id]],
    ['status=EXPIRED', [otherId]],
    ['query=ALPHA', [id]],
    ['query=RM-PROC6-SEARCH', [id, otherId]],
    [`query=${encodeURIComponent('独立报价供应商')}`, [id, otherId]],
    ['query=%25', []],
  ] as const) {
    const response = await get(`${path}?${query}&sort=reference&direction=asc`);
    expect(response.statusCode).toBe(200);
    expect(
      (response.body as { items: readonly { id: string }[] }).items.map((row) => row.id),
    ).toEqual(expected);
  }
});

it('paginates both directions with a stable tie-break and rejects invalid query values', async () => {
  const first = await get(`${path}?limit=1&sort=reference&direction=asc`);
  expect(first.body).toEqual({ items: [expect.objectContaining({ id })], nextCursor: id });
  expect((await get(`${path}?limit=1&sort=reference&direction=asc&cursor=${id}`)).body).toEqual({
    items: [expect.objectContaining({ id: otherId })],
  });
  const [high, low] = [id, otherId].sort().reverse();
  expect((await get(`${path}?limit=1`)).body).toEqual({
    items: [expect.objectContaining({ id: high })],
    nextCursor: high,
  });
  expect((await get(`${path}?limit=1&cursor=${String(high)}`)).body).toEqual({
    items: [expect.objectContaining({ id: low })],
  });
  expect((await get(`${path}?limit=0`)).statusCode).toBe(400);
  expect((await get(`${path}?sort=unknown`)).statusCode).toBe(400);
});

it('adds RFQ line details and keeps the existing permission and tenant boundaries', async () => {
  const response = await get(`${path}/${id}`);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    id,
    quote_reference: 'SQ-ALPHA',
    lines: [{ rfq_line_id: rfqLineId, unit_price: 12.68 }],
    rfq: { number: 'RFQ-PROC6', lines: [{ id: rfqLineId, sku: 'RM-PROC6-SEARCH', quantity: 10 }] },
  });
  const other = await fixture().session(fixture().otherEmployee, 'ALL');
  expect((await get(path, other)).body).toEqual({ items: [] });
  expect((await get(`${path}/${id}`, other)).statusCode).toBe(404);
  const noRead = await fixture().session(await fixture().addEmployee(), ['procurement:manage']);
  expect((await get(path, noRead)).statusCode).toBe(403);
});
