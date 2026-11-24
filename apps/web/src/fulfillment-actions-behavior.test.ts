import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
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
const setup = (permissions: readonly CommercialPermission[] = []) => {
  const workspace = createBehaviorElement('main');
  const status = createBehaviorElement('p');
  status.textContent = 'before';
  const actions = createBehaviorElement('section');
  const submit = vi.fn<FulfillmentViewContext['controller']['submit']>(() => Promise.resolve());
  const load = vi.fn(() => Promise.resolve());
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
// U3-MFG-5：工序报工 / 领退料 / 成品卷入库三张表单（原 appendProductionReport / appendProduction
// Material / appendProductionOutput）迁入 Preact 控制台抽屉，production-actions.ts 随之删除。原
// 「production action callback contracts」一组的用例随函数退役，载荷 oracle（小数原样、日期转
// ISO、无效日期 / 无效批次不提交、失败不刷新、出现条件、批次候选、报工与库位选项、绑定工单
// 成品版本）迁往同一组件测试；幂等键改为前端生成、批次库位只列工单 BOM 的批次是有意的差别。
// 本文件余下发货两组用例不在该批范围，逐字未动。

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
