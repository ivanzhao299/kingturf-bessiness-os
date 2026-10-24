import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import {
  appendProductionMaterial,
  appendProductionOutput,
  appendProductionReport,
  appendProductionTransition,
} from './commercial/production-actions';
import { appendShipmentDelivery, appendShipmentDispatch } from './commercial/shipment-actions';
import type { FulfillmentViewContext } from './commercial/fulfillment-view-ports';
import type { CommercialPermission } from './commercial/permissions';
import { createBehaviorElement, htmlElement } from '../test/fixtures/behavior-dom';

// The real action callback is exercised; form orchestration has its own tests.
vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const unused = (): never => {
  throw new Error('Unexpected fulfillment port');
};
const order = { id: 'production-1', order_number: 'MO-1', item_version_id: 'finished-1' };
const setup = (permissions: readonly CommercialPermission[] = []) => {
  const workspace = createBehaviorElement('main');
  const status = createBehaviorElement('p');
  status.textContent = 'before';
  const actions = createBehaviorElement('section');
  const submit = vi.fn<FulfillmentViewContext['controller']['submit']>(() => Promise.resolve());
  const load = vi.fn(() => Promise.resolve());
  const refresh = vi.fn(() => Promise.resolve());
  const views = new Map<string, readonly Record<string, unknown>[]>();
  const context: FulfillmentViewContext = {
    workspace: htmlElement(workspace),
    status: htmlElement(status),
    permissions: new Set(permissions),
    controller: {
      opportunities: [],
      views,
      message: 'loaded',
      submit,
      load,
      employees: [],
      loadOrder360: unused,
    },
    ports: {
      recordValue: unused,
      recordText: (record, camel, snake, fallback = '') => {
        const value = record[camel] ?? record[snake];
        if (typeof value === 'string') return value;
        return typeof value === 'number' ? String(value) : fallback;
      },
      inventoryLocationOption: (item) => ({ value: String(item.id), label: String(item.code) }),
      textValue: unused,
      displayMoney: unused,
      decimalValue: unused,
      businessStateLabel: unused,
      operationsNextAction: unused,
      shipmentGateLabel: unused,
      businessEventLabel: unused,
      businessEventDetailLabel: unused,
    },
  };
  const click = (index = 0) => {
    const button = actions.children[index];
    if (!button) throw new Error('Action missing');
    button.click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Form missing');
    expect(call[0]).toBe(context.workspace);
    return { fields: call[3], title: call[1], run: call[5] };
  };
  return {
    context,
    actions,
    target: htmlElement(actions),
    status,
    submit,
    load,
    refresh,
    views,
    click,
  };
};

beforeEach(() => {
  form.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
});
afterEach(() => vi.unstubAllGlobals());

describe('production action callback contracts', () => {
  it.each([
    ['DRAFT', 'production:plan', 'release', '下达工单'],
    ['RELEASED', 'production:report', 'start', '开始生产'],
    ['IN_PROGRESS', 'production:close', 'complete', '完工确认'],
    ['COMPLETED', 'production:close', 'close', '关闭工单'],
  ] as const)(
    'gates %s and submits fixed %s transition before refresh',
    async (state, permission, action, title) => {
      const denied = setup();
      appendProductionTransition(denied.context, order, state, denied.target, denied.refresh);
      expect(denied.actions.children).toHaveLength(0);
      const f = setup([permission]);
      appendProductionTransition(f.context, order, state, f.target, f.refresh);
      expect(f.actions.children[0]?.textContent).toBe(title);
      const opened = f.click();
      expect(opened.title).toBe(title);
      expect(opened.fields.map((field) => [field.name, field.required])).toEqual([
        ['reason', true],
        ['evidenceReference', true],
      ]);
      let complete: () => void = unused;
      f.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      const pending = opened.run({ reason: 'fixed reason', evidenceReference: 'EV-1' });
      expect(f.submit).toHaveBeenCalledExactlyOnceWith(
        `/api/v1/production-orders/production-1/${action}`,
        {
          reason: 'fixed reason',
          evidence: { reference: 'EV-1' },
          idempotencyKey: `MO-1-${action.toUpperCase()}-EV-1`,
        },
      );
      expect(f.refresh).not.toHaveBeenCalled();
      complete();
      await pending;
      expect(f.refresh).toHaveBeenCalledTimes(1);
      f.submit.mockRejectedValueOnce(new Error('command rejected'));
      await expect(
        opened.run({ reason: 'fixed reason', evidenceReference: 'EV-2' }),
      ).rejects.toThrow('command rejected');
      expect(f.refresh).toHaveBeenCalledTimes(1);
    },
  );

  it('does not offer terminal transitions or non-running reports', () => {
    const f = setup(['production:plan', 'production:report', 'production:close']);
    appendProductionTransition(f.context, order, 'CLOSED', f.target, f.refresh);
    appendProductionReport(f.context, order, 'RELEASED', [], f.target, f.refresh);
    appendProductionReport(setup().context, order, 'IN_PROGRESS', [], f.target, f.refresh);
    expect(f.actions.children).toHaveLength(0);
    expect(form).not.toHaveBeenCalled();
  });

  it('preserves report decimals and key, converts dates, and rejects bad dates before submission', async () => {
    const f = setup(['production:report']);
    appendProductionReport(
      f.context,
      order,
      'IN_PROGRESS',
      [{ id: 'op-1', sequence: 2, name: '织造' }],
      f.target,
      f.refresh,
    );
    const opened = f.click();
    expect(opened.fields.find((field) => field.name === 'operationId')?.options).toEqual([
      { value: 'op-1', label: '2 · 织造' },
    ]);
    expect(opened.fields.find((field) => field.name === 'scrapQuantity')?.value).toBe('0');
    const values = {
      operationId: 'op-1',
      goodQuantity: '10.25',
      scrapQuantity: '0',
      laborMinutes: '12.5',
      machineMinutes: '20',
      startedAt: '2026-10-17T01:00:00Z',
      completedAt: '2026-10-17T02:00:00Z',
      notes: 'fixed',
      idempotencyKey: 'REPORT-1',
    };
    await opened.run(values);
    expect(f.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/production-orders/production-1/operation-reports',
      {
        ...values,
        startedAt: '2026-10-17T01:00:00.000Z',
        completedAt: '2026-10-17T02:00:00.000Z',
      },
    );
    expect(f.refresh).toHaveBeenCalledTimes(1);
    await expect(opened.run({ ...values, startedAt: 'invalid' })).rejects.toThrow(RangeError);
    expect(f.submit).toHaveBeenCalledTimes(1);
    expect(f.refresh).toHaveBeenCalledTimes(1);
    f.submit.mockRejectedValueOnce(new Error('report rejected'));
    await expect(opened.run(values)).rejects.toThrow('report rejected');
    expect(f.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(['RELEASED', 'IN_PROGRESS'])(
    'uses append-time inventory snapshot for %s material and rejects invalid choices',
    async (state) => {
      const f = setup(['production:material']);
      f.views.set('/api/v1/inventory-balances', [
        {
          itemVersionId: 'raw-1',
          lotId: 'lot-1',
          locationId: 'loc-1',
          sku: 'RAW',
          lotNumber: 'LOT',
          locationCode: 'L1',
          quantity: '9.5',
        },
      ]);
      appendProductionMaterial(f.context, order, state, f.target, f.refresh);
      f.views.set('/api/v1/inventory-balances', [{ itemVersionId: 'wrong-later-snapshot' }]);
      const opened = f.click();
      expect(opened.fields.find((field) => field.name === 'balance')?.options).toEqual([
        { value: '0', label: 'RAW · LOT · L1 · 可用 9.5' },
      ]);
      const values = {
        balance: '0',
        transactionType: 'RETURN',
        quantity: '2.25',
        reason: 'unused',
        occurredAt: '2026-10-17T03:00:00Z',
        idempotencyKey: 'MAT-1',
      };
      await opened.run(values);
      expect(f.submit).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/production-orders/production-1/materials',
        {
          transactionType: 'RETURN',
          itemVersionId: 'raw-1',
          lotId: 'lot-1',
          locationId: 'loc-1',
          quantity: '2.25',
          reason: 'unused',
          occurredAt: '2026-10-17T03:00:00.000Z',
          idempotencyKey: 'MAT-1',
        },
      );
      await expect(opened.run({ ...values, balance: '99' })).rejects.toThrow('请选择有效批次库位');
      await expect(opened.run({ ...values, occurredAt: 'invalid' })).rejects.toThrow(RangeError);
      expect(f.submit).toHaveBeenCalledTimes(1);
      expect(f.refresh).toHaveBeenCalledTimes(1);
      f.submit.mockRejectedValueOnce(new Error('material rejected'));
      await expect(opened.run(values)).rejects.toThrow('material rejected');
      expect(f.refresh).toHaveBeenCalledTimes(1);
    },
  );

  it('gates material/output and handles absent inventory with no invented API lookup', async () => {
    const f = setup(['production:material', 'production:report']);
    appendProductionMaterial(f.context, order, 'DRAFT', f.target, f.refresh);
    appendProductionOutput(f.context, order, 'RELEASED', [{ id: 'report-1' }], f.target, f.refresh);
    appendProductionOutput(f.context, order, 'IN_PROGRESS', [], f.target, f.refresh);
    appendProductionMaterial(setup().context, order, 'RELEASED', f.target, f.refresh);
    appendProductionOutput(
      setup().context,
      order,
      'IN_PROGRESS',
      [{ id: 'report-1' }],
      f.target,
      f.refresh,
    );
    expect(f.actions.children).toHaveLength(0);
    appendProductionMaterial(f.context, order, 'RELEASED', f.target, f.refresh);
    const opened = f.click();
    expect(opened.fields.find((field) => field.name === 'balance')?.options).toEqual([]);
    await expect(opened.run({ balance: '0' })).rejects.toThrow('请选择有效批次库位');
    expect(f.submit).not.toHaveBeenCalled();
    expect(f.refresh).not.toHaveBeenCalled();
  });

  it('binds output to order item version and fixed report/location options', async () => {
    const f = setup(['production:report']);
    f.views.set('/api/v1/inventory-locations', [{ id: 'loc-1', code: 'L1' }]);
    appendProductionOutput(
      f.context,
      order,
      'IN_PROGRESS',
      [{ id: 'report-1', completed_at: 'finished', good_quantity: '10.25' }],
      f.target,
      f.refresh,
    );
    f.views.set('/api/v1/inventory-locations', []);
    const opened = f.click();
    expect(opened.fields.find((field) => field.name === 'operationReportId')?.options).toEqual([
      { value: 'report-1', label: 'finished · 良品 10.25' },
    ]);
    expect(opened.fields.find((field) => field.name === 'locationId')?.options).toEqual([
      { value: 'loc-1', label: 'L1' },
    ]);
    const values = {
      operationReportId: 'report-1',
      rollNumber: 'ROLL-1',
      lotNumber: 'FIN-1',
      locationId: 'loc-1',
      quantity: '10.25',
      manufacturedAt: '2026-10-17',
    };
    await opened.run(values);
    expect(f.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/production-orders/production-1/finished-rolls',
      { ...values, itemVersionId: 'finished-1' },
    );
    expect(f.refresh).toHaveBeenCalledTimes(1);
    f.submit.mockRejectedValueOnce(new Error('output rejected'));
    await expect(opened.run(values)).rejects.toThrow('output rejected');
    expect(f.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('shipment action callback contracts', () => {
  it('gates dispatch by state, permission and existing shipment', () => {
    const f = setup(['shipment:dispatch']);
    appendShipmentDispatch(f.context, { id: 'release-1', shipments: [{}] }, 'RELEASED', f.target);
    appendShipmentDispatch(f.context, { id: 'release-1', shipments: [] }, 'DRAFT', f.target);
    appendShipmentDispatch(
      setup().context,
      { id: 'release-1', shipments: [] },
      'RELEASED',
      f.target,
    );
    expect(f.actions.children).toHaveLength(0);
    expect(form).not.toHaveBeenCalled();
  });

  it.each([[], undefined, 'legacy-non-array'])(
    'preserves current eligible shipments shape %j and dispatch evidence',
    async (shipments) => {
      const f = setup(['shipment:dispatch']);
      appendShipmentDispatch(f.context, { id: 'release-1', shipments }, 'RELEASED', f.target);
      const opened = f.click();
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
      expect(f.load).not.toHaveBeenCalled();
      expect(f.status.textContent).toBe('before');
      complete();
      await Promise.resolve();
      expect(f.load).toHaveBeenCalledTimes(1);
      expect(f.status.textContent).toBe('before');
      loaded();
      await pending;
      expect(f.load).toHaveBeenCalledTimes(1);
      expect(f.status.textContent).toBe('loaded');
      f.status.textContent = 'unchanged';
      f.submit.mockRejectedValueOnce(new Error('dispatch rejected'));
      await expect(opened.run(values)).rejects.toThrow('dispatch rejected');
      expect(f.load).toHaveBeenCalledTimes(1);
      expect(f.status.textContent).toBe('unchanged');
      f.load.mockRejectedValueOnce(new Error('reload rejected'));
      await expect(opened.run(values)).rejects.toThrow('reload rejected');
      expect(f.status.textContent).toBe('unchanged');
    },
  );

  it('omits delivered/no-permission rows and binds POD to the clicked shipment', async () => {
    const records = [
      { id: 'delivered-1', state: 'DELIVERED' },
      { id: 'shipment-1', state: 'DISPATCHED', tracking_number: 'TRACK-1' },
      { id: 'shipment-2', state: 'IN_TRANSIT', trackingNumber: 'TRACK-2' },
    ];
    const f = setup(['shipment:track']);
    const release = { id: 'release-1' };
    const shipmentRecords = vi.fn<(value: Record<string, unknown>) => typeof records>(
      () => records,
    );
    appendShipmentDelivery(setup().context, release, shipmentRecords, f.target);
    expect(f.actions.children).toHaveLength(0);
    appendShipmentDelivery(f.context, release, shipmentRecords, f.target);
    expect(shipmentRecords.mock.calls[1]?.[0]).toBe(release);
    expect(f.actions.children.map((node) => node.textContent)).toEqual([
      '登记签收 TRACK-1',
      '登记签收 TRACK-2',
    ]);
    const opened = f.click(1);
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
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('loaded');
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('delivery rejected'));
    await expect(opened.run(values)).rejects.toThrow('delivery rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });
});
