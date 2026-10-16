import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function createSourcingPanel(
  context: OperationsViewContext,
  rfqs: readonly Record<string, unknown>[],
  supplierQuotes: readonly Record<string, unknown>[],
  suppliers: readonly Record<string, unknown>[],
  manufacturingItems: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel } = context.ports;
  const sourcingPanel = el('article', 'procurement-column sourcing-register');
  sourcingPanel.append(el('h3', '', '询价与报价'));
  for (const rfq of rfqs)
    sourcingPanel.append(
      el(
        'div',
        'procurement-card',
        `${recordText(rfq, 'rfqNumber', 'rfq_number')} · ${businessStateLabel(recordText(rfq, 'status', 'status'))} · ${String(Array.isArray(rfq.lines) ? rfq.lines.length : 0)} 项`,
      ),
    );
  for (const quote of supplierQuotes)
    sourcingPanel.append(
      el(
        'div',
        'procurement-card quote-card',
        `报价 ${recordText(quote, 'quoteReference', 'quote_reference')} · ${recordText(quote, 'supplierName', 'supplierName')} · 有效至 ${recordText(quote, 'validUntil', 'valid_until')}`,
      ),
    );
  if (permissions.has('procurement:manage')) {
    const publishedItemOptions = manufacturingItems
      .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
      .map((item) => ({
        value: String(item.id),
        label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
      }));
    const createRfq = el('button', 'secondary', '＋ 新建并发出询价单');
    createRfq.addEventListener('click', () => {
      openForm(
        workspace,
        '创建采购询价',
        '选择已发布物料版本并明确数量、交期和报价截止时间。',
        [
          { name: 'rfqNumber', label: '询价单编号', required: true },
          {
            name: 'itemVersionId',
            label: '采购物料',
            type: 'select',
            required: true,
            options: publishedItemOptions,
          },
          { name: 'quantity', label: '询价数量', type: 'number', required: true },
          { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
          { name: 'responseDue', label: '报价截止日', type: 'date', required: true },
        ],
        '发出询价单',
        async (values) => {
          await controller.submit('/api/v1/procurement-rfqs', {
            rfqNumber: values.rfqNumber,
            responseDueAt: `${values.responseDue ?? ''}T23:59:59.000Z`,
            currency: 'CNY',
            issue: true,
            lines: [
              {
                itemVersionId: values.itemVersionId,
                quantity: values.quantity,
                requiredAt: values.requiredAt,
              },
            ],
          });
          await refresh();
        },
      );
    });
    sourcingPanel.append(createRfq);
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
