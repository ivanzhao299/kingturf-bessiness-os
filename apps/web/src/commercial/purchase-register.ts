import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { appendReceiveGoodsAction } from './purchase-actions';

// U3-PROC-3：采购订单区退役——PO 卡片（含金额/供应商/行项呈现）与「创建并签发
// 采购订单」表单、采购合同文档工作流迁移至 Preact 采购单控制台（裁定 17 语义）；
// 收货卡片与「登记批次收货」表单属 goods-receipts 域（尚未迁移），保留 vanilla
// 待 U3-PROC-4 承接。
export function createOrderPanel(
  context: OperationsViewContext,
  purchaseOrders: readonly Record<string, unknown>[],
  receipts: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { recordText } = context.ports;
  const orderPanel = el('article', 'procurement-column purchase-register');
  orderPanel.append(el('h3', '', '采购收货'));
  for (const receipt of receipts)
    orderPanel.append(
      el(
        'div',
        'procurement-card receipt-card',
        `收货 ${recordText(receipt, 'receiptNumber', 'receipt_number')} · ${recordText(receipt, 'poNumber', 'poNumber')} · ${String(Array.isArray(receipt.lines) ? receipt.lines.length : 0)} 批`,
      ),
    );
  appendReceiveGoodsAction(context, orderPanel, purchaseOrders, locations, refresh);
  return orderPanel;
}
