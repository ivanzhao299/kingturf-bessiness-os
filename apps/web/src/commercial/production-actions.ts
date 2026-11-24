import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

// U3-MFG-4：工单状态流转（原 appendProductionTransition）已迁入 Preact 控制台（PUT /:id/state 统一动作端点）。
// U3-MFG-5：工序报工与领退料（原 appendProductionReport / appendProductionMaterial）已迁入
// Preact 控制台抽屉（载荷 oracle 见 console/production-order-console.test.tsx）。本文件余下的
// 成品卷入库随后一步迁入，届时本文件删除；迁入前由 console/production-order-host.ts 挂进
// 工单详情抽屉，函数体逐字节未动。
export function appendProductionOutput(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  state: string,
  reports: readonly Record<string, unknown>[],
  actions: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText, inventoryLocationOption } = context.ports;
  if (permissions.has('production:report') && state === 'IN_PROGRESS' && reports.length) {
    const locations = controller.views.get('/api/v1/inventory-locations') ?? [];
    const output = el('button', 'secondary', '＋ 成品卷入库');
    output.addEventListener('click', () => {
      openForm(
        workspace,
        '登记成品卷与待检批次',
        '卷号、成品批次和正向库存收货在同一事务内生成，初始质量状态为待检。',
        [
          {
            name: 'operationReportId',
            label: '末工序报工',
            type: 'select',
            required: true,
            options: reports.map((item) => ({
              value: String(item.id),
              label: `${recordText(item, 'completedAt', 'completed_at')} · 良品 ${recordText(item, 'goodQuantity', 'good_quantity')}`,
            })),
          },
          { name: 'rollNumber', label: '成品卷号', required: true },
          { name: 'lotNumber', label: '成品批次号', required: true },
          {
            name: 'locationId',
            label: '入库库位',
            type: 'select',
            required: true,
            options: locations.map(inventoryLocationOption),
          },
          { name: 'quantity', label: '卷数量', type: 'number', required: true },
          { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
        ],
        '生成卷号并入库',
        async (values) => {
          await controller.submit(`/api/v1/production-orders/${String(order.id)}/finished-rolls`, {
            ...values,
            itemVersionId: recordText(order, 'itemVersionId', 'item_version_id'),
          });
          await refresh();
        },
      );
    });
    actions.append(output);
  }
}
