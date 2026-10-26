import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

describe('procurement and inventory repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let repository: PostgresProcurementRepository;
  let material: JsonObject, draft: JsonObject, foreign: JsonObject;
  let supplier: JsonObject,
    rfq: JsonObject,
    quote: JsonObject,
    order: JsonObject,
    location: JsonObject;
  let rfqLineId: string, orderLineId: string;
  const evidence: { correlation: string; action: string; type: string; id: string }[] = [];
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const supplierInput = {
    supplierNumber: 'SUP-1',
    name: 'Dedicated PG supplier',
    currency: 'CNY',
    paymentTermsDays: 30,
    qualityRatingBasisPoints: 9000,
    contact: { city: 'Synthetic' },
  };
  const qualification = (itemVersionId: string) => ({
    itemVersionId,
    status: 'APPROVED',
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    minimumOrderQuantity: '1',
    leadTimeDays: 2,
    evidence: { reviewed: true },
  });
  const rfqInput = (rfqNumber: string) => ({
    rfqNumber,
    responseDueAt: '2026-01-10T00:00:00Z',
    currency: 'CNY',
    issue: false,
    lines: [{ itemVersionId: identifier(material), quantity: '10', requiredAt: '2026-02-01' }],
  });
  const quoteInput = (quoteReference: string) => ({
    rfqId: identifier(rfq),
    supplierId: identifier(supplier),
    quoteReference,
    receivedAt: '2026-01-09T00:00:00Z',
    validUntil: '2026-02-01',
    terms: { incoterm: 'EXW' },
    lines: [{ rfqLineId, unitPrice: '2.5', promisedAt: '2026-02-01', minimumOrderQuantity: '1' }],
  });
  const orderInput = (poNumber: string) => ({
    poNumber,
    supplierId: identifier(supplier),
    supplierQuoteId: identifier(quote),
    currency: 'CNY',
    issue: false,
    lines: [
      {
        itemVersionId: identifier(material),
        quantity: '10',
        unitPrice: '2.5',
        requiredAt: '2026-02-01',
      },
    ],
  });
  const receiptInput = (receiptNumber: string, quantity = '10') => ({
    receiptNumber,
    purchaseOrderId: identifier(order),
    receivedAt: '2026-02-01T00:00:00Z',
    sourceReference: receiptNumber,
    lines: [
      {
        purchaseOrderLineId: orderLineId,
        lotNumber: `LOT-${receiptNumber}`,
        locationCode: 'RECV',
        quantity,
        manufacturedAt: '2026-01-01',
        expiresAt: '2027-01-01',
      },
    ],
  });
  const evidenceCounts = async (correlation: string) =>
    (
      await state().db.query<{ audit: string; outbox: string }>(
        'SELECT (SELECT count(*)::text FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::text FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  const receiptCounts = async () =>
    (
      await state().db.query(
        'SELECT (SELECT count(*)::integer FROM goods_receipts) receipts,(SELECT count(*)::integer FROM goods_receipt_lines) lines,(SELECT count(*)::integer FROM inventory_lots) lots,(SELECT count(*)::integer FROM inventory_movements) movements',
      )
    ).rows[0];
  const orderStatus = async () =>
    (
      await state().db.query<{ status: string }>('SELECT status FROM purchase_orders WHERE id=$1', [
        identifier(order),
      ])
    ).rows[0]?.status;
  const record = async (
    action: string,
    type: string,
    operation: (correlation: string) => Promise<JsonObject>,
  ) => {
    const correlation = randomUUID(),
      result = await operation(correlation);
    evidence.push({ correlation, action, type, id: identifier(result) });
    return result;
  };

  beforeEach(async () => {
    evidence.length = 0;
    fixture = await ownedPostgres('procurement_pg');
    repository = new PostgresProcurementRepository(fixture.db);
    const manufacturing = new PostgresManufacturingRepository(fixture.db);
    const createItem = (sku: string, publish: boolean, context = fixture?.context) => {
      if (!context) throw new Error('Fixture context missing');
      return manufacturing.createItem(
        {
          sku,
          name: sku,
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish,
        },
        context,
        randomUUID(),
      );
    };
    material = await createItem('RAW-1', true);
    draft = await createItem('DRAFT-1', false);
    foreign = await createItem('FOREIGN-1', true, fixture.otherContext);
    const { context } = fixture;
    supplier = await record('supplier.created', 'supplier', (correlation) =>
      repository.createSupplier(supplierInput, context, correlation),
    );
    await record('supplier.qualified', 'supplier-qualification', (correlation) =>
      repository.qualifySupplier(
        identifier(supplier),
        qualification(identifier(material)),
        context,
        correlation,
      ),
    );
    rfq = await record('rfq.created', 'rfq', (correlation) =>
      repository.createRfq(rfqInput('RFQ-1'), context, correlation),
    );
    await record('rfq.issued', 'rfq', (correlation) =>
      repository.issueRfq(identifier(rfq), context, correlation),
    );
    const rfqLine = (
      await fixture.db.query<{ id: string }>(
        'SELECT id FROM procurement_rfq_lines WHERE rfq_id=$1',
        [identifier(rfq)],
      )
    ).rows[0];
    if (!rfqLine) throw new Error('Fixture RFQ line missing');
    rfqLineId = rfqLine.id;
    quote = await record('supplier-quote.received', 'supplier-quote', (correlation) =>
      repository.createSupplierQuote(quoteInput('QUOTE-1'), context, correlation),
    );
    order = await record('purchase-order.created', 'purchase-order', (correlation) =>
      repository.createPurchaseOrder(orderInput('PO-1'), context, correlation),
    );
    await record('purchase-order.issued', 'purchase-order', (correlation) =>
      repository.issuePurchaseOrder(identifier(order), context, correlation),
    );
    const orderLine = (
      await fixture.db.query<{ id: string }>(
        'SELECT id FROM purchase_order_lines WHERE purchase_order_id=$1',
        [identifier(order)],
      )
    ).rows[0];
    if (!orderLine) throw new Error('Fixture purchase order line missing');
    orderLineId = orderLine.id;
    location = await record('inventory-location.created', 'inventory-location', (correlation) =>
      repository.createLocation(
        { code: 'RECV', name: 'Receiving', locationType: 'RECEIVING' },
        context,
        correlation,
      ),
    );
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('persists the qualified RFQ-to-receipt chain, derived stock and exact paired evidence', async () => {
    const { context, db } = state();
    const receipt = await record('goods-receipt.posted', 'goods-receipt', (correlation) =>
      repository.receive(receiptInput('GR-1'), context, correlation),
    );
    expect(receipt.status).toBe('RECEIVED');
    expect(await orderStatus()).toBe('RECEIVED');
    expect(await repository.list('suppliers', context)).toMatchObject([
      {
        supplier_number: 'SUP-1',
        qualifications: [{ status: 'APPROVED', sku: 'RAW-1', minimum_order_quantity: 1 }],
      },
    ]);
    expect(await repository.list('rfqs', context)).toMatchObject([
      { status: 'ISSUED', lines: [{ line_number: 1, sku: 'RAW-1', quantity: 10 }] },
    ]);
    expect(await repository.list('quotes', context)).toMatchObject([
      {
        quote_reference: 'QUOTE-1',
        lines: [{ lineNumber: 1, unit_price: 2.5, promised_at: '2026-02-01' }],
      },
    ]);
    expect(await repository.list('orders', context)).toMatchObject([
      { status: 'RECEIVED', lines: [{ quantity: 10, unit_price: 2.5, receivedQuantity: 10 }] },
    ]);
    expect(await repository.list('receipts', context)).toMatchObject([
      {
        id: identifier(receipt),
        lines: [{ quantity: 10, lotNumber: 'LOT-GR-1', locationCode: 'RECV' }],
      },
    ]);
    expect(await repository.list('locations', context)).toMatchObject([
      { id: identifier(location), active: true, location_type: 'RECEIVING' },
    ]);
    expect(await repository.list('inventory', context)).toMatchObject([
      {
        quantity: 10,
        sku: 'RAW-1',
        lotNumber: 'LOT-GR-1',
        qualityStatus: 'QUARANTINE',
        movements: [
          { movement_type: 'RECEIPT', quantity_delta: 10, source_type: 'GOODS_RECEIPT_LINE' },
        ],
      },
    ]);
    expect(await receiptCounts()).toEqual({ receipts: 1, lines: 1, lots: 1, movements: 1 });
    for (const { correlation, action, type, id } of evidence) {
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(
        (
          await db.query(
            'SELECT a.action,a.target_type,a.target_id,o.event_type,o.aggregate_type,o.aggregate_id,o.aggregate_version FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id WHERE a.correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([
        {
          action,
          target_type: type,
          target_id: id,
          event_type: action,
          aggregate_type: type,
          aggregate_id: id,
          aggregate_version: 1,
        },
      ]);
    }
  });

  it('requires COMPANY or GROUP scope and keeps GROUP reads and writes tenant-bounded', async () => {
    const { context, otherContext } = state();
    const views = [
      'suppliers',
      'rfqs',
      'quotes',
      'orders',
      'receipts',
      'locations',
      'inventory',
    ] as const;
    await repository.receive(receiptInput('GR-1'), context, randomUUID());
    const stock = (await repository.list('inventory', context))[0];
    if (!stock) throw new Error('Fixture stock missing');
    for (const view of views) {
      expect(await repository.list(view, { ...context, scopes: ['GROUP'] })).toHaveLength(1);
      expect(await repository.list(view, { ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    }
    for (const scopes of [[], ['SELF'], ['TEAM']] as const) {
      const denied = { ...context, scopes };
      for (const view of views)
        await expect(repository.list(view, denied)).rejects.toMatchObject({ code: 'forbidden' });
      for (const operation of [
        () => repository.createSupplier(supplierInput, denied, randomUUID()),
        () =>
          repository.qualifySupplier(
            identifier(supplier),
            qualification(identifier(material)),
            denied,
            randomUUID(),
          ),
        () => repository.createRfq(rfqInput('DENIED'), denied, randomUUID()),
        () => repository.issueRfq(identifier(rfq), denied, randomUUID()),
        () => repository.createSupplierQuote(quoteInput('DENIED'), denied, randomUUID()),
        () => repository.createPurchaseOrder(orderInput('DENIED'), denied, randomUUID()),
        () => repository.issuePurchaseOrder(identifier(order), denied, randomUUID()),
        () => repository.receive(receiptInput('DENIED'), denied, randomUUID()),
        () =>
          repository.move(
            {
              movementType: 'RETURN',
              itemVersionId: identifier(material),
              lotId: identifier(stock, 'lotId'),
              locationId: identifier(location),
              quantity: '1',
              occurredAt: '2026-02-02T00:00:00Z',
              sourceType: 'TEST_SCOPE',
              sourceId: randomUUID(),
            },
            denied,
            randomUUID(),
          ),
        () =>
          repository.createLocation(
            { code: 'DENIED', name: 'Denied', locationType: 'STORAGE' },
            denied,
            randomUUID(),
          ),
      ])
        await expect(operation()).rejects.toMatchObject({ code: 'forbidden' });
    }
    await expect(
      repository.issueRfq(identifier(rfq), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      repository.createPurchaseOrder(orderInput('FOREIGN'), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'conflict' });
    const correlation = randomUUID();
    await repository.createLocation(
      { code: 'GROUP-STOCK', name: 'Group scope within own tenant', locationType: 'STORAGE' },
      { ...context, scopes: ['GROUP'] },
      correlation,
    );
    expect(await repository.list('locations', context)).toHaveLength(2);
    expect(await repository.list('locations', { ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
  });

  it('rolls back invalid qualification, quote and issued-document inputs', async () => {
    const { context, db } = state();
    for (const version of [identifier(draft), identifier(foreign)]) {
      const correlation = randomUUID();
      await expect(
        repository.qualifySupplier(
          identifier(supplier),
          qualification(version),
          context,
          correlation,
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
    const invalid = randomUUID();
    await expect(
      repository.createRfq({ ...rfqInput('EMPTY'), lines: [], issue: true }, context, invalid),
    ).rejects.toMatchObject({ code: 'P0001', message: 'RFQ issue requires timestamp and lines' });
    await expect(
      repository.createSupplierQuote(
        {
          ...quoteInput('EXPIRED-QUALIFICATION'),
          lines: [
            {
              ...quoteInput('unused').lines[0],
              rfqLineId,
              unitPrice: '2.5',
              promisedAt: '2027-02-01',
              minimumOrderQuantity: '1',
            },
          ],
        },
        context,
        invalid,
      ),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Quoted item requires a valid supplier qualification',
    });
    await expect(
      repository.createPurchaseOrder(
        {
          ...orderInput('UNQUALIFIED'),
          lines: [
            {
              itemVersionId: identifier(draft),
              quantity: '10',
              unitPrice: '2.5',
              requiredAt: '2026-02-01',
            },
          ],
        },
        context,
        invalid,
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await evidenceCounts(invalid)).toEqual({ audit: '0', outbox: '0' });
    expect(
      (
        await db.query(
          'SELECT (SELECT count(*)::integer FROM procurement_rfqs) rfqs,(SELECT count(*)::integer FROM supplier_quotes) quotes,(SELECT count(*)::integer FROM supplier_quote_lines) quote_lines,(SELECT count(*)::integer FROM purchase_orders) orders,(SELECT count(*)::integer FROM purchase_order_lines) order_lines',
        )
      ).rows,
    ).toEqual([{ rfqs: 1, quotes: 1, quote_lines: 1, orders: 1, order_lines: 1 }]);
    await expect(repository.createSupplier(supplierInput, context, invalid)).rejects.toMatchObject({
      code: '23505',
    });
    await expect(
      repository.issuePurchaseOrder(identifier(order), context, invalid),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await evidenceCounts(invalid)).toEqual({ audit: '0', outbox: '0' });
  });

  it('rolls back receipts, lots and movements on quantity, location and later-line failures', async () => {
    const { context } = state();
    const first = receiptInput('BAD-LOT', '1').lines[0];
    if (!first) throw new Error('Fixture receipt line missing');
    for (const [input, error] of [
      [receiptInput('OVER', '11'), { code: 'conflict' }],
      [
        {
          ...receiptInput('MISSING-LINE'),
          lines: [{ ...first, purchaseOrderLineId: randomUUID() }],
        },
        { code: 'conflict' },
      ],
      [
        { ...receiptInput('MISSING-LOCATION'), lines: [{ ...first, locationCode: 'MISSING' }] },
        { code: 'not_found' },
      ],
      [{ ...receiptInput('DUPLICATE-LOT'), lines: [first, first] }, { code: '23505' }],
    ] as const) {
      const before = await receiptCounts(),
        correlation = randomUUID();
      await expect(
        repository.receive({ ...input, lines: [...input.lines] }, context, correlation),
      ).rejects.toMatchObject(error);
      expect(await receiptCounts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
      expect(await orderStatus()).toBe('ISSUED');
    }
  });

  it('nets signed movement types and rejects negative balances, mismatched lots and duplicate sources', async () => {
    const { context, db } = state();
    await repository.receive(receiptInput('GR-1'), context, randomUUID());
    const stock = (await repository.list('inventory', context))[0];
    if (!stock) throw new Error('Fixture stock missing');
    const moveInput = {
      itemVersionId: identifier(material),
      lotId: identifier(stock, 'lotId'),
      locationId: identifier(location),
      quantity: '1',
      occurredAt: '2026-02-02T00:00:00Z',
      sourceType: 'TEST_STOCK_ADJUSTMENT',
      sourceId: randomUUID(),
    };
    for (const [movementType, quantity, balance, delta] of [
      ['ADJUSTMENT_OUT', '4', 6, '-4'],
      ['RETURN', '1', 7, '1'],
      ['TRANSFER_IN', '2', 9, '2'],
      ['TRANSFER_OUT', '3', 6, '-3'],
      ['ADJUSTMENT_IN', '2', 8, '2'],
      ['ISSUE', '1', 7, '-1'],
    ] as const) {
      const correlation = randomUUID();
      expect(
        await repository.move(
          { ...moveInput, movementType, quantity, sourceId: randomUUID() },
          context,
          correlation,
        ),
      ).toMatchObject({ quantityDelta: delta });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(await repository.list('inventory', context)).toMatchObject([
        { quantity: balance, qualityStatus: 'QUARANTINE' },
      ]);
    }
    const correlation = randomUUID(),
      before = await receiptCounts();
    await expect(
      repository.move(
        { ...moveInput, movementType: 'ADJUSTMENT_OUT', quantity: '8' },
        context,
        correlation,
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'inventory movement cannot create negative lot balance',
    });
    await expect(
      repository.move(
        { ...moveInput, movementType: 'RETURN', itemVersionId: identifier(foreign) },
        context,
        correlation,
      ),
    ).rejects.toMatchObject({ code: 'P0001', message: 'inventory movement item must match lot' });
    expect(await receiptCounts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    await repository.move({ ...moveInput, movementType: 'RETURN' }, context, randomUUID());
    await expect(
      repository.move({ ...moveInput, movementType: 'RETURN' }, context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(await repository.list('inventory', context)).toMatchObject([{ quantity: 8 }]);
    await expect(
      db.query('UPDATE inventory_movements SET quantity_delta=99 WHERE lot_id=$1', [
        moveInput.lotId,
      ]),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'procurement and inventory evidence is immutable',
    });
  });

  it('completes partial then final receipt and refuses receipt against the closed order', async () => {
    const { context } = state();
    expect(
      (await repository.receive(receiptInput('PARTIAL', '4'), context, randomUUID())).status,
    ).toBe('PARTIALLY_RECEIVED');
    expect(await orderStatus()).toBe('PARTIALLY_RECEIVED');
    expect(
      (await repository.receive(receiptInput('FINAL', '6'), context, randomUUID())).status,
    ).toBe('RECEIVED');
    expect(await orderStatus()).toBe('RECEIVED');
    expect((await repository.list('inventory', context)).map((row) => row.quantity).sort()).toEqual(
      [4, 6],
    );
    expect(await receiptCounts()).toEqual({ receipts: 2, lines: 2, lots: 2, movements: 2 });
    const correlation = randomUUID();
    await expect(
      repository.receive(receiptInput('CLOSED', '1'), context, correlation),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Receipt requires an open issued purchase order',
    });
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(await receiptCounts()).toEqual({ receipts: 2, lines: 2, lots: 2, movements: 2 });
  });

  it('rolls back issue and audit when an already-seeded outbox aggregate conflicts', async () => {
    const { context, db } = state();
    const pending = await repository.createRfq(rfqInput('PENDING'), context, randomUUID());
    const collision = randomUUID(),
      correlation = randomUUID();
    await db.query(
      "INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,payload,correlation_id) VALUES($1,'rfq.issued',1,'rfq',$2,1,now(),'{}'::jsonb,$3)",
      [context.actor.companyId, identifier(pending), collision],
    );
    await expect(
      repository.issueRfq(identifier(pending), context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      (
        await db.query('SELECT status,issued_at FROM procurement_rfqs WHERE id=$1', [
          identifier(pending),
        ])
      ).rows,
    ).toEqual([{ status: 'DRAFT', issued_at: null }]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(await evidenceCounts(collision)).toEqual({ audit: '0', outbox: '1' });
  });

  it('TD-PROC-001: receives 4 + 2 + 4 with exact stock, lot links and paired evidence', async () => {
    const { context, db } = state();
    let count = 0;
    for (const [number, quantity, status, total] of [
      ['FIRST', '4', 'PARTIALLY_RECEIVED', '4.000000'],
      ['SECOND', '2', 'PARTIALLY_RECEIVED', '6.000000'],
      ['FINAL', '4', 'RECEIVED', '10.000000'],
    ] as const) {
      const correlation = randomUUID();
      const result = await repository.receive(receiptInput(number, quantity), context, correlation);
      count++;
      expect(result.status).toBe(status);
      expect(await orderStatus()).toBe(status);
      expect(await receiptCounts()).toEqual({
        receipts: count,
        lines: count,
        lots: count,
        movements: count,
      });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(
        (
          await db.query<{ total: string }>(
            'SELECT sum(quantity)::text total FROM goods_receipt_lines WHERE purchase_order_line_id=$1',
            [orderLineId],
          )
        ).rows[0]?.total,
      ).toBe(total);
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM goods_receipt_lines l JOIN inventory_lots lot ON lot.id=l.lot_id AND lot.goods_receipt_id=l.goods_receipt_id JOIN inventory_movements m ON m.source_id=l.id AND m.lot_id=lot.id AND m.location_id=l.location_id AND m.quantity_delta=l.quantity WHERE l.goods_receipt_id=$1',
            [identifier(result)],
          )
        ).rows[0]?.n,
      ).toBe(1);
      expect(
        (
          await db.query<{ total: string }>(
            'SELECT sum(quantity)::text total FROM inventory_balances WHERE tenant_id=$1',
            [context.actor.companyId],
          )
        ).rows[0]?.total,
      ).toBe(total);
    }
  });

  it('TD-PROC-001: rejects duplicate receipt identities and excess after partial stock without residual writes', async () => {
    const { context } = state();
    await repository.receive(receiptInput('PARTIAL', '4'), context, randomUUID());
    const before = await receiptCounts();
    for (const [input, code] of [
      [receiptInput('PARTIAL', '4'), '23505'],
      [{ ...receiptInput('OTHER', '4'), sourceReference: 'PARTIAL' }, '23505'],
      [receiptInput('EXCESS', '7'), 'conflict'],
    ] as const) {
      const correlation = randomUUID();
      await expect(
        repository.receive({ ...input, lines: [...input.lines] }, context, correlation),
      ).rejects.toMatchObject({ code });
      expect(await receiptCounts()).toEqual(before);
      expect(await orderStatus()).toBe('PARTIALLY_RECEIVED');
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
    const line = receiptInput('LATE', '1').lines[0];
    if (!line) throw new Error('Receipt line missing');
    const correlation = randomUUID();
    await expect(
      repository.receive({ ...receiptInput('LATE'), lines: [line, line] }, context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await receiptCounts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });

  it('TD-PROC-001: real concurrent receipts cannot over-receive and valid splits settle exactly', async () => {
    const { context, db } = state();
    const correlations = [randomUUID(), randomUUID()];
    const results = await Promise.allSettled(
      ['LEFT', 'RIGHT'].map((n, i) =>
        repository.receive(receiptInput(n, '6'), context, correlations[i] ?? randomUUID()),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    for (const result of results)
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'conflict' });
    expect(await receiptCounts()).toEqual({ receipts: 1, lines: 1, lots: 1, movements: 1 });
    expect(
      (
        await db.query<{ total: string }>(
          'SELECT sum(quantity)::text total FROM goods_receipt_lines WHERE purchase_order_line_id=$1',
          [orderLineId],
        )
      ).rows[0]?.total,
    ).toBe('6.000000');
    for (const [i, r] of results.entries())
      expect(await evidenceCounts(correlations[i] ?? '')).toEqual(
        r.status === 'fulfilled' ? { audit: '1', outbox: '1' } : { audit: '0', outbox: '0' },
      );
    expect(
      (await repository.receive(receiptInput('REST', '4'), context, randomUUID())).status,
    ).toBe('RECEIVED');
  });

  it('TD-PROC-001: two valid concurrent 4 and 6 receipts both commit once', async () => {
    const { context, db } = state();
    const correlations = [randomUUID(), randomUUID()];
    const result = await Promise.all([
      repository.receive(receiptInput('FOUR', '4'), context, correlations[0] ?? ''),
      repository.receive(receiptInput('SIX', '6'), context, correlations[1] ?? ''),
    ]);
    expect(result).toHaveLength(2);
    expect(await orderStatus()).toBe('RECEIVED');
    expect(
      (
        await db.query<{ total: string }>(
          'SELECT sum(quantity)::text total FROM goods_receipt_lines WHERE purchase_order_line_id=$1',
          [orderLineId],
        )
      ).rows,
    ).toEqual([{ total: '10.000000' }]);
    for (const correlation of correlations)
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
    expect(await receiptCounts()).toEqual({ receipts: 2, lines: 2, lots: 2, movements: 2 });
  });

  it('TD-INV-001: characterizes overlapping committed issues bypassing the existing balance sum guard', async () => {
    const { context, db } = state();
    await repository.receive(receiptInput('RACE-SEED'), context, randomUUID());
    const lot = (
      await db.query<{ id: string }>(
        "SELECT id FROM inventory_lots WHERE tenant_id=$1 AND lot_number='LOT-RACE-SEED'",
        [context.actor.companyId],
      )
    ).rows[0];
    if (!lot) throw new Error('Synthetic race lot missing');
    let arrivals = 0,
      release: (() => void) | undefined;
    const both = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gated: ConstructorParameters<typeof PostgresProcurementRepository>[0] = {
      query: db.query.bind(db),
      transaction: async (work) =>
        db.transaction(async (tx) => {
          const result = await work(tx);
          arrivals++;
          if (arrivals === 2) release?.();
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              both,
              new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                  reject(
                    new Error('Two independent move transactions did not reach commit barrier'),
                  );
                }, 2000);
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
          return result;
        }),
    };
    const moves = new PostgresProcurementRepository(gated);
    const correlations = [randomUUID(), randomUUID()];
    const results = await Promise.all(
      correlations.map((correlation) =>
        moves.move(
          {
            movementType: 'ISSUE',
            itemVersionId: identifier(material),
            lotId: lot.id,
            locationId: identifier(location),
            quantity: '7',
            occurredAt: '2026-02-01T01:00:00Z',
            sourceType: 'SYNTHETIC-RACE',
            sourceId: randomUUID(),
          },
          context,
          correlation,
        ),
      ),
    );
    expect(results).toHaveLength(2);
    expect(arrivals).toBe(2);
    const balance = (
      await db.query<{ quantity: string }>(
        'SELECT quantity FROM inventory_balances WHERE tenant_id=$1 AND lot_id=$2 AND location_id=$3',
        [context.actor.companyId, lot.id, identifier(location)],
      )
    ).rows[0];
    expect(Number(balance?.quantity)).toBe(-4);
    for (const correlation of correlations)
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
  });
});
