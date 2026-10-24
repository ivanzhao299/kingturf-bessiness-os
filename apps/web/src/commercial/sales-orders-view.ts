import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

export function appendSalesOrdersView(context: FulfillmentViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText, textValue, decimalValue, displayMoney } = context.ports;
  const panel = el('section', 'qtc-workbench order-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '订单释放'), el('p', '', '报价、信用、合同与订单依据'));
  const quotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
    (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
  );
  const decisions = (controller.views.get('/api/v1/credit-decisions') ?? []).filter(
    (item) => recordText(item, 'effectiveStatus', 'effective_status') === 'APPROVED',
  );
  const contracts = (controller.views.get('/api/v1/contracts') ?? []).filter(
    (item) =>
      recordText(item, 'effectiveStatus', 'effectiveStatus') === 'SIGNED' &&
      Boolean(recordText(item, 'signatureEvidenceId', 'signatureEvidenceId')),
  );
  if (
    permissions.has('sales-order:create') &&
    quotes.length &&
    decisions.length &&
    contracts.length
  ) {
    const create = el('button', 'primary', '＋ 释放销售订单');
    create.addEventListener('click', () => {
      openForm(
        workspace,
        '释放销售订单',
        '请选择同一报价链上的信用和合同证据，服务器会再次验证全部引用。',
        [
          {
            name: 'quoteRevisionId',
            label: '已签发报价',
            type: 'select',
            required: true,
            options: quotes.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.quoteNumber, '报价')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'total', 'total')}`,
            })),
          },
          {
            name: 'creditDecisionId',
            label: '已批准信用决定',
            type: 'select',
            required: true,
            options: decisions.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.id, '').slice(0, 8)} · 有效至 ${recordText(item, 'validUntil', 'valid_until').slice(0, 10)}`,
            })),
          },
          {
            name: 'contractRevisionId',
            label: '已签合同',
            type: 'select',
            required: true,
            options: contracts.map((item) => ({
              value: textValue(item.id, ''),
              label: recordText(
                item,
                'contractNumber',
                'contractNumber',
                textValue(item.id, '').slice(0, 8),
              ),
            })),
          },
          {
            name: 'orderNumber',
            label: '订单编号',
            required: true,
            minLength: 3,
            maxLength: 64,
            hint: '使用公司统一订单编号，避免与已有订单重复。',
          },
          {
            name: 'description',
            label: '订单行说明',
            required: true,
            minLength: 2,
            maxLength: 500,
          },
          {
            name: 'quantity',
            label: '数量',
            type: 'number',
            required: true,
            value: '1',
            min: 0.000001,
            step: 0.000001,
          },
          {
            name: 'unitPrice',
            label: '含税单价',
            type: 'number',
            required: true,
            min: 0.000001,
            step: 0.000001,
          },
        ],
        '验证并释放',
        async (values) => {
          const quote = quotes.find((item) => item.id === values.quoteRevisionId);
          const contract = contracts.find((item) => item.id === values.contractRevisionId);
          const opportunity = controller.opportunities.find(
            (item) => item.id === quote?.opportunityId,
          );
          if (!quote || !contract || typeof opportunity?.customerId !== 'string')
            throw new Error('订单依据未形成完整客户链');
          const quantity = Number(values.quantity ?? '0');
          const unitPrice = Number(values.unitPrice ?? '0');
          const total = decimalValue(quantity * unitPrice);
          await controller.submit('/api/v1/sales-orders', {
            customerId: opportunity.customerId,
            opportunityId: textValue(quote.opportunityId, ''),
            orderNumber: values.orderNumber ?? '',
            quoteRevisionId: textValue(quote.id, ''),
            quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
            creditDecisionId: values.creditDecisionId ?? '',
            contractRevisionId: textValue(contract.id, ''),
            signatureEvidenceId: recordText(contract, 'signatureEvidenceId', 'signatureEvidenceId'),
            currency: recordText(quote, 'currency', 'currency', 'CNY'),
            total,
            lines: [
              {
                description: values.description ?? '',
                quantity: decimalValue(quantity),
                unitPrice: decimalValue(unitPrice),
                total,
              },
            ],
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, create);
  } else heading.append(copy);
  panel.append(heading);
  const list = el('div', 'qtc-list');
  for (const order of controller.views.get('/api/v1/sales-orders') ?? []) {
    const card = el('article', 'qtc-card');
    card.append(
      el('p', 'eyebrow', recordText(order, 'orderNumber', 'order_number', '销售订单')),
      el(
        'strong',
        '',
        displayMoney(
          recordText(order, 'currency', 'currency'),
          recordText(order, 'total', 'total', '—'),
        ),
      ),
      el('span', 'ctr-state state-released', recordText(order, 'status', 'status', 'RELEASED')),
      el(
        'p',
        'version-pin',
        `报价 ${recordText(order, 'quoteRevisionId', 'quote_revision_id').slice(0, 8)} · 信用 ${recordText(order, 'creditDecisionId', 'credit_decision_id').slice(0, 8)} · 合同 ${recordText(order, 'contractRevisionId', 'contract_revision_id').slice(0, 8)}`,
      ),
    );
    list.append(card);
  }
  if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无已释放订单。'));
  panel.append(list);
  workspace.append(panel);
}
