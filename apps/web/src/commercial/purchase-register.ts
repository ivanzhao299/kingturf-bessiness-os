import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createPurchaseOrderCard } from './purchase-order-cards';
import { appendPurchaseActions } from './purchase-actions';

export function createOrderPanel(
  context: OperationsViewContext,
  purchaseOrders: readonly Record<string, unknown>[],
  receipts: readonly Record<string, unknown>[],
  suppliers: readonly Record<string, unknown>[],
  manufacturingItems: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { recordText } = context.ports;
  const orderPanel = el('article', 'procurement-column purchase-register');
  orderPanel.append(el('h3', '', '采购订单与收货'));
  for (const order of purchaseOrders) {
    const orderCard = createPurchaseOrderCard(context, order, refresh);
    orderPanel.append(orderCard);
  }
  for (const receipt of receipts)
    orderPanel.append(
      el(
        'div',
        'procurement-card receipt-card',
        `收货 ${recordText(receipt, 'receiptNumber', 'receipt_number')} · ${recordText(receipt, 'poNumber', 'poNumber')} · ${String(Array.isArray(receipt.lines) ? receipt.lines.length : 0)} 批`,
      ),
    );
  appendPurchaseActions(
    context,
    orderPanel,
    purchaseOrders,
    suppliers,
    manufacturingItems,
    locations,
    refresh,
  );
  return orderPanel;
}
