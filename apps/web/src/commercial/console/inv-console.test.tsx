import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { confirmAction, dismissConfirm } from '../../../test/fixtures/confirm-dialog';
import { InventoryConsolePage, inventoryStatusFromHash } from './inv-console';
import { inventoryCounts, workOrderChoices } from './inv-data';
import type { InventoryPorts } from './inv-state';

const at = new Date('2026-11-25T11:00:00Z');
const balance = {
  lotId: 'lot',
  locationId: 'loc',
  itemVersionId: 'item',
  locationCode: 'RAW-A01',
  sku: 'RAW-SKU',
  lotNumber: 'LOT-P6',
  quantity: 5,
  qualityStatus: 'QUARANTINE',
  origin: { type: 'RECEIPT', number: 'GR-P6' },
  movements: [],
};
const location = { id: 'loc', code: 'RAW-A01', name: '库区一', location_type: 'STORAGE' };
const order = { value: 'work-1', label: '工单一' };
const moved = {
  ...balance,
  quantity: 3.5,
  movements: [
    {
      movement_type: 'ISSUE',
      quantity_delta: -1.5,
      source_type: 'WORK-ORDER',
      source_id: 'work-1',
      actor_id: 'actor',
      occurred_at: at.toISOString(),
    },
  ],
};
const ports = () =>
  ({
    permissions: new Set(['inventory:move']),
    initialBalances: [balance],
    initialLocations: [location],
    initialStatus: '',
    orders: () => [order],
    actors: new Map([['actor', '测试仓管']]),
    refresh: vi.fn().mockResolvedValue({
      balances: [moved],
      locations: [
        location,
        { id: 'loc-2', code: 'RAW-A02', name: '库区二', location_type: 'STORAGE' },
      ],
    }),
    fetchPage: vi.fn().mockResolvedValue({ items: [moved], nextCursor: null }),
    loadDetail: vi.fn().mockResolvedValueOnce(balance).mockResolvedValue(moved),
    submit: vi.fn().mockResolvedValue({}),
    now: () => at,
  }) satisfies InventoryPorts;

let host: TestElement | undefined;
const mount = (io: InventoryPorts) => {
  host = installGlobalTestDom().document.createElement('div');
  render(h(InventoryConsolePage(io), {}), host);
  return host;
};
const locate = (panel: TestElement, selector: string) => {
  const found = panel.querySelector(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found as TestElement;
};
const byId = (panel: TestElement, id: string) => locate(panel, `[data-testid="${id}"]`);
const click = (node: TestElement) =>
  act(() => {
    node.click();
  });
const enter = (panel: TestElement, name: string, value: string, event = 'input') =>
  act(() => {
    const field = locate(panel, `[name="${name}"]`);
    field.value = value;
    field.dispatchEvent(new Event(event, { bubbles: true }));
  });
const submit = (panel: TestElement) =>
  click(locate(locate(panel, 'form.form-section'), 'button[type="submit"]'));
const openMovement = async (panel: TestElement, type: string, quantity: string) => {
  await click(byId(panel, 'kt-inv-open'));
  expect(byId(panel, 'kt-inv-detail').textContent).toContain('收货单 · GR-P6');
  await click(byId(panel, 'kt-inv-move'));
  await vi.waitFor(() => {
    expect(panel.querySelector('[name="movementType"]')).not.toBeNull();
  });
  await enter(panel, 'movementType', type);
  await enter(panel, 'quantity', quantity);
  await enter(panel, 'sourceId', order.value, 'change');
};
afterEach(() => {
  if (host) render(null, host);
  host = undefined;
});

it('posts the byte-equivalent movement only on confirm and refreshes the open ledger', async () => {
  const io = ports();
  const panel = mount(io);
  await openMovement(panel, 'ISSUE', '1.5');
  await submit(panel);
  expect(io.submit).not.toHaveBeenCalled();
  await dismissConfirm(panel);
  expect(io.submit).not.toHaveBeenCalled();
  await submit(panel);
  await confirmAction(panel, '确认库存移动', '确认登记', { destructive: true });
  expect(JSON.stringify(io.submit.mock.calls)).toBe(
    JSON.stringify([
      [
        '/api/v1/inventory-movements',
        {
          movementType: 'ISSUE',
          itemVersionId: 'item',
          lotId: 'lot',
          locationId: 'loc',
          quantity: '1.5',
          occurredAt: at.toISOString(),
          sourceType: 'WORK-ORDER',
          sourceId: 'work-1',
        },
      ],
    ]),
  );
  expect(byId(panel, 'kt-inv-movements').textContent).toContain('测试仓管');
  expect(byId(panel, 'kt-inv-movements').textContent).toContain('工单一');
  expect(byId(panel, 'console-notice').textContent).toBe('已登记生产领用');
});

it('displays stock rejection in the form and preserves fields', async () => {
  const io = ports();
  io.submit.mockRejectedValueOnce(new Error('本次出库会使该批次库位结存为负'));
  const panel = mount(io);
  await openMovement(panel, 'ADJUSTMENT_OUT', '9');
  await submit(panel);
  await confirmAction(panel, '确认库存移动', '确认登记', { destructive: true });
  expect(locate(panel, 'form.form-section [role="alert"]').textContent).toBe(
    '本次出库会使该批次库位结存为负',
  );
  expect(locate(panel, '[name="quantity"]').value).toBe('9');
  expect(io.refresh).not.toHaveBeenCalled();
});

it('creates another location with the legacy payload and hides write actions from read-only users', async () => {
  const io = ports();
  const panel = mount(io);
  expect(byId(panel, 'kt-inv-locations').textContent).toContain('RAW-A01');
  await click(byId(panel, 'kt-inv-create-location'));
  await enter(panel, 'code', ' RAW-A02 ');
  await enter(panel, 'name', ' 库区二 ');
  await enter(panel, 'locationType', 'STORAGE');
  await submit(panel);
  expect(JSON.stringify(io.submit.mock.calls)).toBe(
    JSON.stringify([
      ['/api/v1/inventory-locations', { code: 'RAW-A02', name: '库区二', locationType: 'STORAGE' }],
    ]),
  );
  await vi.waitFor(() => {
    expect(byId(panel, 'kt-inv-locations').textContent).toContain('RAW-A02');
  });
  render(null, panel);
  const readOnly = mount({ ...io, permissions: new Set(['inventory:read']) });
  expect(readOnly.querySelector('[data-testid="kt-inv-create-location"]')).toBeNull();
  await click(byId(readOnly, 'kt-inv-open'));
  expect(readOnly.querySelector('[data-testid="kt-inv-move"]')).toBeNull();
});

it('loads minimal source candidates for an inventory-only writer and keeps the movement payload', async () => {
  const io = ports();
  const load = vi.fn().mockResolvedValue([order]);
  const panel = mount({ ...io, orders: () => [], loadMovementSources: load });
  await openMovement(panel, 'ADJUSTMENT_IN', '1.5');
  expect(load).toHaveBeenCalledTimes(1);
  expect(locate(panel, '[name="sourceId"]').textContent).toContain('工单一');
  await submit(panel);
  await confirmAction(panel, '确认库存移动', '确认登记', { destructive: true });
  expect(io.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/inventory-movements', {
    movementType: 'ADJUSTMENT_IN',
    itemVersionId: 'item',
    lotId: 'lot',
    locationId: 'loc',
    quantity: '1.5',
    occurredAt: at.toISOString(),
    sourceType: 'WORK-ORDER',
    sourceId: 'work-1',
  });
});

it('keeps source read failures inside the movement form and sends no write', async () => {
  const io = ports();
  const panel = mount({
    ...io,
    orders: () => [],
    loadMovementSources: vi.fn().mockRejectedValue(new Error('来源读取失败')),
  });
  await click(byId(panel, 'kt-inv-open'));
  await click(byId(panel, 'kt-inv-move'));
  await vi.waitFor(() => {
    expect(locate(panel, 'form.form-section [role="alert"]').textContent).toBe('来源读取失败');
  });
  expect(locate(panel, '[name="sourceId"]').textContent).toContain('暂无可选业务来源');
  expect(io.submit).not.toHaveBeenCalled();
});

it('does not apply a late source failure to a newly selected inventory balance', async () => {
  const io = ports();
  const other = { ...balance, lotId: 'lot-other', lotNumber: 'LOT-OTHER' };
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<readonly { value: string; label: string }[]>((_resolve, reject) => {
    rejectFirst = reject;
  });
  const load = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValue([{ value: 'work-2', label: '新选择工单' }]);
  const panel = mount({
    ...io,
    initialBalances: [balance, other],
    loadMovementSources: load,
    loadDetail: (key) => Promise.resolve(key.startsWith('lot-other:') ? other : balance),
  });
  await click(panel.querySelectorAll('[data-testid="kt-inv-open"]')[0] as TestElement);
  await click(byId(panel, 'kt-inv-move'));
  await click(locate(panel, '.drawer-close'));
  await click(panel.querySelectorAll('[data-testid="kt-inv-open"]')[1] as TestElement);
  await click(byId(panel, 'kt-inv-move'));
  await vi.waitFor(() => {
    expect(locate(panel, '[name="sourceId"]').textContent).toContain('新选择工单');
  });
  // 新选择的表单已就绪后旧请求拒绝，旧错误/空候选不得覆盖新来源。
  await act(async () => {
    rejectFirst(new Error('旧批次来源读取失败'));
    await first.catch(() => undefined);
  });
  await vi.waitFor(() => {
    expect(locate(panel, '[name="sourceId"]').textContent).toContain('新选择工单');
  });
  expect(byId(panel, 'kt-inv-detail').textContent).not.toContain('旧批次来源读取失败');
  expect(io.submit).not.toHaveBeenCalled();
});

it('deduplicates lot counts and supports only unfinished work orders and explicit quality deep links', () => {
  expect(inventoryCounts([balance, { ...balance, locationId: 'loc-2' }])).toEqual({
    RELEASED: 0,
    QUARANTINE: 1,
    REJECTED: 0,
  });
  expect(
    workOrderChoices([
      { id: 'open', order_number: 'WO-OPEN', state: 'IN_PROGRESS' },
      { id: 'closed', order_number: 'WO-CLOSE', state: 'COMPLETED' },
    ]),
  ).toEqual([{ value: 'open', label: 'WO-OPEN' }]);
  expect(inventoryStatusFromHash('#/procurement/inventory?quality=QUARANTINE')).toBe('QUARANTINE');
  expect(inventoryStatusFromHash('#/procurement/inventory?quality=unsupported')).toBe('');
});
