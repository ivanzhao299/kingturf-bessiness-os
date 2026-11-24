import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { appendProductionOutput } from './commercial/production-actions';
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

// U3-MFG-4：工单状态流转（原 appendProductionTransition）已迁入 Preact 控制台，载荷 oracle 见
// console/production-order-console.test.tsx。
// U3-MFG-5：工序报工与领退料（原 appendProductionReport / appendProductionMaterial）已迁入
// Preact 控制台抽屉——函数随迁移删除，其载荷 oracle（小数原样、日期转 ISO、无效日期不提交、
// 无效批次不提交、失败不刷新、出现条件、批次候选）迁往同一组件测试
// console/production-order-console.test.tsx；幂等键改为前端生成、批次库位只列工单 BOM 的批次
// 是有意的差别。原「gates material/output…」用例里的成品卷入库部分保留为下一条；领退料部分
// 随函数退役。余下的成品卷入库随后一步迁入，届时本组用例随之退役。
describe('production action callback contracts', () => {
  it('gates output by state, permission and existing report', () => {
    const f = setup(['production:material', 'production:report']);
    appendProductionOutput(f.context, order, 'RELEASED', [{ id: 'report-1' }], f.target, f.refresh);
    appendProductionOutput(f.context, order, 'IN_PROGRESS', [], f.target, f.refresh);
    appendProductionOutput(
      setup().context,
      order,
      'IN_PROGRESS',
      [{ id: 'report-1' }],
      f.target,
      f.refresh,
    );
    expect(f.actions.children).toHaveLength(0);
    expect(form).not.toHaveBeenCalled();
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
