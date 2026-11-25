import { describe, expect, it, vi } from 'vitest';
import { createOpsWriter, trimOpsValues, type OpsForm } from './commercial/console/ops-form';
import {
  shipmentForms,
  shipmentDecision,
  shipmentRequest,
} from './commercial/console/shipment-forms';
import type { CommercialPermission } from './commercial/permissions';

const unused = (): never => {
  throw new Error('Unexpected port');
};
const setup = () => {
  const submit = vi.fn<(path: string, body: Record<string, unknown>) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const load = vi.fn(() => Promise.resolve());
  const writer = createOpsWriter(submit, load);
  const choose = (form: OpsForm) => ({
    fields: form.fields,
    run: (values: Readonly<Record<string, string>>) => {
      writer.open(form);
      const pending = writer.write(values);
      void writer.confirmation.peek()?.run();
      return pending;
    },
  });
  return { submit, load, writer, choose };
};
const grants = (...values: CommercialPermission[]) => new Set(values);

describe('shipment action callback contracts', () => {
  it('gates dispatch by state, permission and existing shipment', () => {
    const permissions = grants('shipment:dispatch');
    expect(
      shipmentForms({ id: 'release-1', state: 'RELEASED', shipments: [{}] }, permissions),
    ).toHaveLength(0);
    expect(
      shipmentForms({ id: 'release-1', state: 'DRAFT', shipments: [] }, permissions),
    ).toHaveLength(0);
    expect(
      shipmentForms({ id: 'release-1', state: 'RELEASED', shipments: [] }, grants()),
    ).toHaveLength(0);
  });

  it.each([[], undefined, 'legacy-non-array'])(
    'preserves current eligible shipments shape %j and dispatch evidence',
    async (shipments) => {
      const f = setup();
      const [action] = shipmentForms(
        { id: 'release-1', shipments, state: 'RELEASED' },
        grants('shipment:dispatch'),
      );
      if (!action) throw new Error('Dispatch missing');
      const opened = f.choose(action.form);
      expect(opened.fields.every((field) => field.required)).toBe(true);
      const values = {
        shipmentNumber: 'SHIP-1',
        carrierName: 'Carrier',
        trackingNumber: 'TRACK-1',
        dispatchedAt: '2026-10-17T03:00:00Z',
        location: 'Gate',
        sealReference: 'SEAL-1',
      };
      let complete: () => void = unused;
      let loaded: () => void = unused;
      f.load.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            loaded = resolve;
          }),
      );
      f.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      const pending = opened.run(values);
      await Promise.resolve();
      expect(f.submit).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/shipment-releases/release-1/dispatch',
        {
          shipmentNumber: 'SHIP-1',
          carrierName: 'Carrier',
          trackingNumber: 'TRACK-1',
          dispatchedAt: '2026-10-17T03:00:00Z',
          location: 'Gate',
          evidence: { sealReference: 'SEAL-1' },
          idempotencyKey: 'SHIP-1',
        },
      );
      expect(JSON.stringify(f.submit.mock.calls[0]?.[1])).toBe(
        '{"shipmentNumber":"SHIP-1","carrierName":"Carrier","trackingNumber":"TRACK-1","dispatchedAt":"2026-10-17T03:00:00Z","location":"Gate","evidence":{"sealReference":"SEAL-1"},"idempotencyKey":"SHIP-1"}',
      );
      expect(f.load).not.toHaveBeenCalled();
      expect(f.writer.notice.peek()).not.toContain('失败');
      complete();
      await Promise.resolve();
      expect(f.load).toHaveBeenCalledTimes(1);
      expect(f.writer.notice.peek()).not.toContain('失败');
      loaded();
      await pending;
      expect(f.load).toHaveBeenCalledTimes(1);
      expect(f.writer.notice.peek()).toContain('成功');
      f.submit.mockRejectedValueOnce(new Error('dispatch rejected'));
      await opened.run(values);
      expect(f.writer.error.peek()).toContain('dispatch rejected');
      expect(f.load).toHaveBeenCalledTimes(1);

      f.load.mockRejectedValueOnce(new Error('reload rejected'));
      await opened.run(values);
      expect(f.writer.notice.peek()).toContain('reload rejected');
    },
  );

  it('omits delivered/no-permission rows and binds POD to the clicked shipment', async () => {
    const records = [
      { id: 'delivered-1', state: 'DELIVERED' },
      { id: 'shipment-1', state: 'DISPATCHED', tracking_number: 'TRACK-1' },
      { id: 'shipment-2', state: 'IN_TRANSIT', trackingNumber: 'TRACK-2' },
    ];
    const f = setup();
    const release = { id: 'release-1', shipments: records };
    expect(shipmentForms(release, grants())).toHaveLength(0);
    const actions = shipmentForms(release, grants('shipment:track'));
    expect(actions.map(({ label }) => label)).toEqual(['登记签收 TRACK-1', '登记签收 TRACK-2']);
    const action = actions[1];
    if (!action) throw new Error('Delivery missing');
    const opened = f.choose(action.form);
    const values = {
      receiverName: 'Receiver',
      receivedAt: '2026-10-17T04:00:00Z',
      proofReference: 'POD-REF',
      location: 'Customer gate',
    };
    await opened.run(values);
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/shipments/shipment-2/deliver', {
      occurredAt: '2026-10-17T04:00:00Z',
      location: 'Customer gate',
      evidence: {
        receiverName: 'Receiver',
        receivedAt: '2026-10-17T04:00:00Z',
        proofReference: 'POD-REF',
      },
      idempotencyKey: 'POD-shipment-2',
    });
    expect(JSON.stringify(f.submit.mock.calls[0]?.[1])).toBe(
      '{"occurredAt":"2026-10-17T04:00:00Z","location":"Customer gate","evidence":{"receiverName":"Receiver","receivedAt":"2026-10-17T04:00:00Z","proofReference":"POD-REF"},"idempotencyKey":"POD-shipment-2"}',
    );
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.writer.notice.peek()).toContain('成功');
    f.submit.mockRejectedValueOnce(new Error('delivery rejected'));
    await opened.run(values);
    expect(f.writer.error.peek()).toContain('delivery rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
  });
});

it('preserves shipment request and release decision bytes', () => {
  const create = shipmentRequest([], [], []);
  const payload = trimOpsValues({
    requestNumber: ' REL-1 ',
    salesOrderId: 'SO',
    productionOrderId: 'WO',
    finishedLotId: 'LOT',
    requestedQuantity: '2.5',
    requiredPaymentAmount: '0',
    reason: '订单交付',
  });
  expect(JSON.stringify(create.payload(payload))).toBe(
    '["/api/v1/shipment-releases",{"requestNumber":"REL-1","salesOrderId":"SO","productionOrderId":"WO","finishedLotId":"LOT","requestedQuantity":"2.5","requiredPaymentAmount":"0","reason":"订单交付","idempotencyKey":"REL-1"}]',
  );
  for (const action of ['approve-exception', 'release'] as const) {
    const form = shipmentDecision({ id: 'release-1', request_number: 'REL-1' }, action);
    expect(JSON.stringify(form.payload({ reason: '已核对', evidenceReference: 'E-1' }))).toBe(
      `["/api/v1/shipment-releases/release-1/${action}",{"reason":"已核对","evidence":{"reference":"E-1"},"idempotencyKey":"REL-1-E-1"}]`,
    );
  }
});
