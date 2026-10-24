import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createPurchaseDocumentRow } from './purchase-documents';

export function createPurchaseOrderCard(
  context: OperationsViewContext,
  order: Record<string, unknown>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { controller, permissions } = context;
  const { recordValue, recordText, decimalValue, businessStateLabel } = context.ports;
  const lines = Array.isArray(order.lines) ? order.lines.map(recordValue) : [];
  const total = lines.reduce(
    (sum, line) =>
      sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? line.unitPrice ?? 0),
    0,
  );
  const orderCard = el(
    'div',
    'procurement-card purchase-order-card',
    `${recordText(order, 'poNumber', 'po_number')} · ${businessStateLabel(recordText(order, 'status', 'status'))}\n${recordText(order, 'supplierName', 'supplierName')} · 人民币 ${decimalValue(total)} · ${String(lines.length)} 项`,
  );
  const documents = (controller.views.get('/api/v1/contract-documents') ?? []).filter(
    (item) => recordText(item, 'subjectId', 'subject_id') === recordText(order, 'id', 'id'),
  );
  for (const item of documents) {
    const documentRow = createPurchaseDocumentRow(context, item, refresh);
    orderCard.append(documentRow);
  }
  if (permissions.has('contract-document:manage') && controller.api.uploadContractDocument) {
    const upload = el('button', 'secondary compact', '上传采购合同');
    upload.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        void controller.api
          .uploadContractDocument?.(
            'PURCHASE',
            'purchase-order',
            recordText(order, 'id', 'id'),
            file,
          )
          .then(refresh);
      });
      input.click();
    });
    orderCard.append(upload);
  }
  return orderCard;
}
