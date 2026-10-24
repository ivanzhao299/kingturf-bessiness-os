import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function createInventoryPanel(
  context: OperationsViewContext,
  balances: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordText, businessStateLabel } = context.ports;
  const inventoryPanel = el('article', 'procurement-column inventory-register');
  inventoryPanel.append(el('h3', '', '批次库存台账'));
  for (const balance of balances) {
    const movements = Array.isArray(balance.movements) ? balance.movements : [];
    const balanceCard = el(
      'div',
      'procurement-card inventory-balance-card',
      `${recordText(balance, 'sku', 'sku')} · 批次 ${recordText(balance, 'lotNumber', 'lotNumber')}\n${recordText(balance, 'locationCode', 'locationCode')} · 结存 ${recordText(balance, 'quantity', 'quantity')} · ${businessStateLabel(recordText(balance, 'qualityStatus', 'qualityStatus'))} · ${String(movements.length)} 笔移动`,
    );
    if (permissions.has('inventory:move')) {
      const move = el('button', 'secondary', '领用 / 调整');
      move.addEventListener('click', () => {
        openForm(
          workspace,
          '登记库存移动',
          '移动记录不可修改；出库数量不得造成该批次库位负库存。',
          [
            {
              name: 'movementType',
              label: '移动类型',
              type: 'select',
              required: true,
              options: [
                { value: 'ISSUE', label: '生产领用' },
                { value: 'RETURN', label: '退料入库' },
                { value: 'ADJUSTMENT_IN', label: '盘盈' },
                { value: 'ADJUSTMENT_OUT', label: '盘亏' },
              ],
            },
            { name: 'quantity', label: '数量', type: 'number', required: true },
            { name: 'sourceType', label: '业务来源类型', required: true, value: 'WORK-ORDER' },
            { name: 'sourceId', label: '业务来源编号', required: true },
          ],
          '追加库存移动',
          async (values) => {
            await controller.submit('/api/v1/inventory-movements', {
              movementType: values.movementType,
              itemVersionId: balance.itemVersionId,
              lotId: balance.lotId,
              locationId: balance.locationId,
              quantity: values.quantity,
              occurredAt: new Date().toISOString(),
              sourceType: values.sourceType,
              sourceId: values.sourceId,
            });
            await refresh();
          },
        );
      });
      balanceCard.append(move);
    }
    inventoryPanel.append(balanceCard);
  }
  if (permissions.has('inventory:move') && !locations.length) {
    const createLocation = el('button', 'secondary', '＋ 建立首个库位');
    createLocation.addEventListener('click', () => {
      openForm(
        workspace,
        '建立库存库位',
        '库位用于批次收货和不可变库存移动。',
        [
          { name: 'code', label: '库位编码', required: true },
          { name: 'name', label: '库位名称', required: true },
          {
            name: 'locationType',
            label: '库位类型',
            type: 'select',
            required: true,
            options: [
              { value: 'RECEIVING', label: '收货区' },
              { value: 'STORAGE', label: '存储区' },
              { value: 'PRODUCTION', label: '生产区' },
              { value: 'QUARANTINE', label: '隔离区' },
              { value: 'SHIPPING', label: '发货区' },
            ],
          },
        ],
        '保存库位',
        async (values) => {
          await controller.submit('/api/v1/inventory-locations', values);
          await refresh();
        },
      );
    });
    inventoryPanel.append(createLocation);
  }
  return inventoryPanel;
}
