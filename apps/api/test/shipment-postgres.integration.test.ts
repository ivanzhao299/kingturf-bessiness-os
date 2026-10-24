import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalize } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresProductionRepository } from '../src/production-repositories.js';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { PostgresShipmentRepository } from '../src/shipment-repositories.js';
import { PostgresOrder360Repository } from '../src/order-360-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const id = (value: JsonObject, key = 'id'): string => {
  const result = value[key];
  if (typeof result !== 'string') throw new Error('Fixture identifier missing');
  return result;
};
const event = (idempotencyKey: string) => ({
  reason: 'Fixed independent shipment decision',
  evidence: { reviewed: true },
  idempotencyKey,
});

describe('shipment exception release and Order360 shipment source on real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  let shipment: PostgresShipmentRepository;
  let productionId: string, lotId: string;
  const owned = () => {
    if (!fixture) throw new Error('Owned shipment fixture missing');
    return fixture;
  };
  const reviewer = () => ({
    ...owned().context,
    actor: { ...owned().context.actor, employeeId: owned().reviewerEmployee },
  });
  const requestInput = () => ({
    requestNumber: 'RELEASE-1',
    salesOrderId: owned().graph.orderId,
    productionOrderId: productionId,
    finishedLotId: lotId,
    requestedQuantity: '5',
    requiredPaymentAmount: '100001',
    reason: 'Fixed exception request',
    idempotencyKey: 'REQUEST-1',
  });
  const dispatchInput = () => ({
    shipmentNumber: 'SHIPMENT-1',
    carrierName: 'Synthetic carrier',
    trackingNumber: 'TRACK-1',
    dispatchedAt: '2030-01-01T00:00:00Z',
    location: 'Origin',
    evidence: { manifest: 'FIXED' },
    idempotencyKey: 'DISPATCH-1',
  });
  const trackingInput = (idempotencyKey: string) => ({
    occurredAt: '2030-01-02T00:00:00Z',
    location: 'Destination',
    evidence: {
      receiverName: 'Synthetic recipient',
      receivedAt: '2030-01-02T00:00:00Z',
      proofReference: 'FIXED-POD',
    },
    idempotencyKey,
  });
  const counts = async () =>
    (
      await owned().db.query(
        'SELECT (SELECT count(*)::integer FROM shipment_release_requests) requests,(SELECT count(*)::integer FROM shipment_release_events) releases,(SELECT count(*)::integer FROM shipments) shipments,(SELECT count(*)::integer FROM shipment_events) events,(SELECT count(*)::integer FROM audit_events) audits,(SELECT count(*)::integer FROM domain_event_outbox) outbox',
      )
    ).rows[0];
  const release = async () => {
    const { context } = owned();
    const request = await shipment.request(requestInput(), context, randomUUID());
    await shipment.transition(request.id, 'APPROVED', event('APPROVE'), reviewer(), randomUUID());
    await shipment.transition(request.id, 'RELEASED', event('RELEASE'), context, randomUUID());
    return request;
  };
  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
    const { db, context } = fixture;
    shipment = new PostgresShipmentRepository(db);
    const manufacturing = new PostgresManufacturingRepository(db);
    const product = await manufacturing.createItem(
      {
        sku: 'SHIP-FG',
        name: 'Shipment finished product',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    );
    const routing = await manufacturing.createRouting(
      {
        code: 'SHIP-ROUTING',
        name: 'Shipment routing',
        productItemId: id(product, 'itemId'),
        productItemVersionId: id(product),
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
        operations: [
          {
            sequence: 10,
            operationCode: 'MAKE',
            name: 'Make',
            workCenterCode: 'WC-1',
            setupMinutes: '1',
            runMinutesPerUnit: '1',
            instructions: {},
          },
        ],
      },
      context,
      randomUUID(),
    );
    const production = new PostgresProductionRepository(db);
    const order = await production.create(
      {
        orderNumber: 'SHIP-PRODUCTION',
        itemVersionId: id(product),
        routingVersionId: id(routing),
        plannedQuantity: '10',
        plannedStartAt: '2026-01-01T00:00:00Z',
        plannedDueAt: '2026-01-02T00:00:00Z',
        sourceReference: 'SHIP-PRODUCTION',
      },
      context,
      randomUUID(),
    );
    productionId = id(order);
    await production.transition(
      productionId,
      'RELEASED',
      event('PRODUCTION-RELEASE'),
      context,
      randomUUID(),
    );
    await production.transition(
      productionId,
      'IN_PROGRESS',
      event('PRODUCTION-START'),
      context,
      randomUUID(),
    );
    const operation = (
      await db.query<{ id: string }>(
        'SELECT id FROM production_order_operations WHERE production_order_id=$1',
        [productionId],
      )
    ).rows[0];
    if (!operation) throw new Error('Fixture operation missing');
    const report = await production.reportOperation(
      productionId,
      {
        operationId: operation.id,
        goodQuantity: '10',
        scrapQuantity: '0',
        laborMinutes: '10',
        machineMinutes: '10',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:10:00Z',
        notes: 'Fixed production report',
        idempotencyKey: 'PRODUCTION-REPORT',
      },
      context,
      randomUUID(),
    );
    const location = await new PostgresProcurementRepository(db).createLocation(
      { code: 'SHIP-LOC', name: 'Shipping warehouse', locationType: 'STORAGE' },
      context,
      randomUUID(),
    );
    const output = await production.createOutput(
      productionId,
      {
        operationReportId: id(report),
        itemVersionId: id(product),
        rollNumber: 'SHIP-ROLL',
        lotNumber: 'SHIP-LOT',
        locationId: id(location),
        quantity: '10',
        manufacturedAt: '2026-01-01',
      },
      context,
      randomUUID(),
    );
    lotId = id(output, 'lotId');
    await production.transition(
      productionId,
      'COMPLETED',
      event('PRODUCTION-COMPLETE'),
      context,
      randomUUID(),
    );
    // Genuine output remains QUARANTINE; no MRP link or approved actual cost is invented.
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('evaluates independent failed gates and writes exactly an audit-only request', async () => {
    const { context, db } = owned(),
      correlation = randomUUID();
    const request = await shipment.request(requestInput(), context, correlation);
    expect(request.state).toBe('EXCEPTION_PENDING');
    expect(request.gateSnapshot).toEqual({
      contract_ok: true,
      credit_ok: true,
      payment_ok: false,
      overdue_ok: false,
      order_link_ok: false,
      quality_ok: false,
      production_ok: true,
      cost_ok: false,
      available_quantity: '10.000000',
      quantityOk: true,
      failures: ['payment', 'overdue', 'orderLink', 'quality', 'cost'],
      evaluatedAt: request.gateSnapshot.evaluatedAt,
      formulaVersion: 'KT-L18-V1',
    });
    expect(typeof request.gateSnapshot.evaluatedAt).toBe('string');
    expect(
      (
        await db.query(
          'SELECT gate_hash,gate_snapshot FROM shipment_release_requests WHERE id=$1',
          [request.id],
        )
      ).rows,
    ).toEqual([
      {
        gate_hash: createHash('sha256').update(canonicalize(request.gateSnapshot)).digest('hex'),
        gate_snapshot: request.gateSnapshot,
      },
    ]);
    expect(
      (
        await db.query(
          'SELECT action,target_type,target_id,metadata FROM audit_events WHERE correlation_id=$1',
          [correlation],
        )
      ).rows,
    ).toEqual([
      {
        action: 'shipment.release-requested',
        target_type: 'shipment-release',
        target_id: request.id,
        metadata: request.gateSnapshot,
      },
    ]);
    expect(
      (
        await db.query(
          'SELECT count(*)::integer count FROM domain_event_outbox WHERE correlation_id=$1',
          [correlation],
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(await shipment.list(context)).toMatchObject([
      {
        id: request.id,
        state: 'EXCEPTION_PENDING',
        requested_quantity: 5,
        required_payment_amount: 100001,
        events: [{ sequence: 1, state: 'EXCEPTION_PENDING' }],
        shipments: [],
      },
    ]);
  });

  it('requires independent exception approval, then projects real dispatch and POD only for an allowed Order360 source', async () => {
    const { context, db, graph } = owned();
    const request = await shipment.request(requestInput(), context, randomUUID());
    const before = await counts();
    await expect(
      shipment.transition(request.id, 'APPROVED', event('SELF'), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      shipment.transition(request.id, 'RELEASED', event('EARLY'), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: 'exception requires approval decision' });
    await expect(
      shipment.dispatch(request.id, dispatchInput(), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: 'shipment requires released gate' });
    expect(await counts()).toEqual(before);
    await shipment.transition(request.id, 'APPROVED', event('APPROVE'), reviewer(), randomUUID());
    await shipment.transition(request.id, 'RELEASED', event('RELEASE'), context, randomUUID());
    const load = await shipment.dispatch(request.id, dispatchInput(), context, randomUUID());
    await shipment.track(load.id, 'IN_TRANSIT', trackingInput('TRANSIT'), context, randomUUID());
    const inTransit = await counts();
    await expect(
      shipment.track(
        load.id,
        'DELIVERED',
        { ...trackingInput('BAD-POD'), evidence: { receiverName: 'Synthetic recipient' } },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'delivery requires receiver, timestamp, and proof reference',
    });
    expect(await counts()).toEqual(inTransit);
    await shipment.track(load.id, 'DELIVERED', trackingInput('DELIVER'), context, randomUUID());
    expect(await shipment.list(context)).toMatchObject([
      {
        id: request.id,
        state: 'RELEASED',
        events: [
          { state: 'EXCEPTION_PENDING', sequence: 1 },
          { state: 'APPROVED', sequence: 2, actor_id: owned().reviewerEmployee },
          { state: 'RELEASED', sequence: 3 },
        ],
        shipments: [
          {
            id: load.id,
            state: 'DELIVERED',
            tracking_number: 'TRACK-1',
            events: [
              { state: 'DISPATCHED', sequence: 1 },
              { state: 'IN_TRANSIT', sequence: 2 },
              { state: 'DELIVERED', sequence: 3, evidence: trackingInput('unused').evidence },
            ],
          },
        ],
      },
    ]);
    const aggregate = new PostgresOrder360Repository(db);
    const allowed = await aggregate.get(graph.orderId, {
      ...context,
      sources: { shipments: { scopes: ['COMPANY'], anchors: [], fields: null } },
    });
    expect(allowed.shipments).toMatchObject([
      {
        id: request.id,
        state: 'RELEASED',
        releaseEvents: [
          { state: 'EXCEPTION_PENDING' },
          { state: 'APPROVED' },
          { state: 'RELEASED' },
        ],
        loads: [
          {
            id: load.id,
            state: 'DELIVERED',
            events: [{ state: 'DISPATCHED' }, { state: 'IN_TRANSIT' }, { state: 'DELIVERED' }],
          },
        ],
      },
    ]);
    if (!Array.isArray(allowed.timeline)) throw new Error('Timeline must be an array');
    expect(
      allowed.timeline
        .map((entry: unknown) => {
          if (
            typeof entry !== 'object' ||
            entry === null ||
            Array.isArray(entry) ||
            !('type' in entry)
          )
            throw new Error('Timeline row must be an object');
          return entry.type;
        })
        .sort(),
    ).toEqual(
      [
        'ORDER_RELEASED',
        'SHIPMENT_RELEASE_EXCEPTION_PENDING',
        'SHIPMENT_RELEASE_APPROVED',
        'SHIPMENT_RELEASE_RELEASED',
        'SHIPMENT_DISPATCHED',
        'SHIPMENT_IN_TRANSIT',
        'SHIPMENT_DELIVERED',
      ].sort(),
    );
    for (const scopes of [undefined, ['SELF'] as const, ['TEAM'] as const]) {
      const hidden = await aggregate.get(graph.orderId, {
        ...context,
        ...(scopes ? { sources: { shipments: { scopes, anchors: [], fields: null } } } : {}),
      });
      expect(hidden.shipments).toEqual([]);
      expect(hidden.timeline).toMatchObject([{ type: 'ORDER_RELEASED' }]);
      expect(hidden.timeline).toHaveLength(1);
    }
    const delivered = await counts();
    await expect(
      shipment.track(load.id, 'IN_TRANSIT', trackingInput('AFTER-DELIVERY'), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: 'delivered shipment is immutable' });
    await expect(
      db.query('DELETE FROM shipment_events WHERE shipment_id=$1', [load.id]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'shipment evidence is immutable' });
    expect(await counts()).toEqual(delivered);
  });

  it('keeps rejected release terminal and refuses duplicate requests rather than claiming replay support', async () => {
    const { context } = owned();
    const request = await shipment.request(requestInput(), context, randomUUID());
    await shipment.transition(request.id, 'REJECTED', event('REJECT'), reviewer(), randomUUID());
    const before = await counts();
    await expect(
      shipment.transition(request.id, 'APPROVED', event('AFTER-REJECT'), reviewer(), randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: 'terminal release state is immutable' });
    await expect(
      shipment.dispatch(request.id, dispatchInput(), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(shipment.request(requestInput(), context, randomUUID())).rejects.toMatchObject({
      code: '23505',
    });
    expect(await counts()).toEqual(before);
    expect(await shipment.list(context)).toMatchObject([{ state: 'REJECTED', shipments: [] }]);
  });

  it('denies narrow scope methods and keeps GROUP reads and foreign writes tenant-bound', async () => {
    const { context, otherContext } = owned();
    const request = await release();
    const load = await shipment.dispatch(request.id, dispatchInput(), context, randomUUID());
    const before = await counts();
    expect(await shipment.list({ ...context, scopes: ['GROUP'] })).toHaveLength(1);
    expect(await shipment.list({ ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    for (const scopes of [[], ['SELF'], ['TEAM']] as const) {
      const denied = { ...context, scopes };
      for (const operation of [
        () => shipment.list(denied),
        () => shipment.request(requestInput(), denied, randomUUID()),
        () => shipment.transition(request.id, 'APPROVED', event('DENIED'), denied, randomUUID()),
        () => shipment.dispatch(request.id, dispatchInput(), denied, randomUUID()),
        () => shipment.track(load.id, 'DELIVERED', trackingInput('DENIED'), denied, randomUUID()),
      ])
        await expect(operation()).rejects.toMatchObject({ code: 'forbidden' });
    }
    await expect(
      shipment.transition(request.id, 'RELEASED', event('FOREIGN'), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      shipment.track(load.id, 'DELIVERED', trackingInput('FOREIGN'), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      shipment.request(
        { ...requestInput(), requestNumber: 'FOREIGN', idempotencyKey: 'FOREIGN' },
        otherContext,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: '23503' });
    expect(await counts()).toEqual(before);
  });

  it('has the database independently reject a forged positive gate snapshot', async () => {
    const { context, db } = owned();
    const request = await shipment.request(requestInput(), context, randomUUID());
    const before = await counts();
    await expect(
      db.query(
        "INSERT INTO shipment_release_requests(tenant_id,request_number,sales_order_id,production_order_id,finished_lot_id,requested_quantity,required_payment_amount,gate_snapshot,gate_hash,created_by,correlation_id,idempotency_key) SELECT tenant_id,$2,sales_order_id,production_order_id,finished_lot_id,requested_quantity,required_payment_amount,jsonb_set(gate_snapshot,'{quality_ok}','true'::jsonb),gate_hash,created_by,$3,$4 FROM shipment_release_requests WHERE id=$1",
        [request.id, 'FORGED', randomUUID(), 'FORGED'],
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'shipment gate snapshot does not match server evidence',
    });
    expect(await counts()).toEqual(before);
  });

  it('rolls back a new shipment row when its later initial-event key conflicts', async () => {
    const { context } = owned();
    const request = await release();
    const load = await shipment.dispatch(request.id, dispatchInput(), context, randomUUID());
    await shipment.track(
      load.id,
      'IN_TRANSIT',
      trackingInput('COLLISION:event'),
      context,
      randomUUID(),
    );
    const before = await counts();
    await expect(
      shipment.dispatch(
        request.id,
        {
          ...dispatchInput(),
          shipmentNumber: 'SHIPMENT-2',
          trackingNumber: 'TRACK-2',
          idempotencyKey: 'COLLISION',
        },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await counts()).toEqual(before);
    expect(await shipment.list(context)).toMatchObject([
      { shipments: [{ id: load.id, state: 'IN_TRANSIT' }] },
    ]);
    await shipment.dispatch(
      request.id,
      {
        ...dispatchInput(),
        shipmentNumber: 'SHIPMENT-2',
        trackingNumber: 'TRACK-2',
        idempotencyKey: 'FRESH',
      },
      context,
      randomUUID(),
    );
    expect(await shipment.list(context)).toMatchObject([{ shipments: [{}, {}] }]);
  });
});
