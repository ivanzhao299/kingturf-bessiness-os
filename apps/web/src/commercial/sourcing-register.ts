import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

// U3-PROC-2：RFQ 区退役——询价卡片与「新建并发出询价单」表单迁移至 Preact 询价
// 控制台（裁定 17 语义）；供应商报价卡片与登记表单属 supplier-quotes 域（尚未
// 迁移），保留 vanilla 待 U3-PROC-3 承接。
export function createSourcingPanel(
  context: OperationsViewContext,
  rfqs: readonly Record<string, unknown>[],
  supplierQuotes: readonly Record<string, unknown>[],
  suppliers: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText } = context.ports;
  const sourcingPanel = el('article', 'procurement-column sourcing-register');
  sourcingPanel.append(el('h3', '', '供应商报价'));
  for (const quote of supplierQuotes)
    sourcingPanel.append(
      el(
        'div',
        'procurement-card quote-card',
        `报价 ${recordText(quote, 'quoteReference', 'quote_reference')} · ${recordText(quote, 'supplierName', 'supplierName')} · 有效至 ${recordText(quote, 'validUntil', 'valid_until')}`,
      ),
    );
  if (permissions.has('procurement:manage')) {
    const rfqLineOptions = rfqs.flatMap((rfq) =>
      (Array.isArray(rfq.lines) ? rfq.lines.map(recordValue) : []).map((line) => ({
        value: `${String(rfq.id)}|${String(line.id)}`,
        label: `${recordText(rfq, 'rfqNumber', 'rfq_number')} · ${recordText(line, 'sku', 'sku')}`,
      })),
    );
    const receiveQuote = el('button', 'secondary', '＋ 登记供应商报价');
    receiveQuote.addEventListener('click', () => {
      openForm(
        workspace,
        '登记供应商报价',
        '报价必须引用已发出的询价单、有效准入供应商和精确询价明细。',
        [
          {
            name: 'rfqLine',
            label: '询价单明细',
            type: 'select',
            required: true,
            options: rfqLineOptions,
          },
          {
            name: 'supplierId',
            label: '供应商',
            type: 'select',
            required: true,
            options: suppliers.map((item) => ({
              value: String(item.id),
              label: recordText(item, 'name', 'name'),
            })),
          },
          { name: 'quoteReference', label: '供应商报价编号', required: true },
          { name: 'unitPrice', label: '单价', type: 'number', required: true },
          {
            name: 'minimumOrderQuantity',
            label: '最小订购量',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'promisedAt', label: '承诺到货日', type: 'date', required: true },
          { name: 'validUntil', label: '报价有效期', type: 'date', required: true },
        ],
        '保存不可变报价',
        async (values) => {
          const [rfqId, rfqLineId] = (values.rfqLine ?? '').split('|');
          await controller.submit('/api/v1/supplier-quotes', {
            rfqId,
            supplierId: values.supplierId,
            quoteReference: values.quoteReference,
            receivedAt: new Date().toISOString(),
            validUntil: values.validUntil,
            terms: { currency: 'CNY' },
            lines: [
              {
                rfqLineId,
                unitPrice: values.unitPrice,
                promisedAt: values.promisedAt,
                minimumOrderQuantity: values.minimumOrderQuantity,
              },
            ],
          });
          await refresh();
        },
      );
    });
    sourcingPanel.append(receiveQuote);
  }
  return sourcingPanel;
}
