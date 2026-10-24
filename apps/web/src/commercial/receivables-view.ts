import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

export function appendReceivablesView(context: FinanceRiskViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, displayMoney, decimalValue } = context.ports;
  const panel = el('section', 'qtc-workbench ar-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '应收与账龄'), el('p', '', '应收余额、到期日与核销进度'));
  const orders = controller.views.get('/api/v1/sales-orders') ?? [];
  if (permissions.has('ar:post') && orders.length) {
    const post = el('button', 'primary', '＋ 过账应收');
    post.addEventListener('click', () => {
      openForm(
        workspace,
        '过账应收发票',
        '发票固定关联已释放订单，余额将进入信用敞口。',
        [
          {
            name: 'salesOrderId',
            label: '销售订单',
            type: 'select',
            required: true,
            options: orders.map((item) => ({
              value: textValue(item.id, ''),
              label: `${recordText(item, 'orderNumber', 'order_number')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'total', 'total')}`,
            })),
          },
          { name: 'documentNumber', label: '发票号码', required: true },
          { name: 'amount', label: '发票金额', type: 'number', required: true },
          { name: 'dueAt', label: '到期日', type: 'date', required: true },
        ],
        '确认过账',
        async (values) => {
          const order = orders.find((item) => item.id === values.salesOrderId);
          if (!order) throw new Error('请选择有效订单');
          await controller.submit('/api/v1/ar-open-items', {
            customerId: recordText(order, 'customerId', 'customer_id'),
            salesOrderId: textValue(order.id, ''),
            documentNumber: values.documentNumber ?? '',
            documentType: 'INVOICE',
            currency: recordText(order, 'currency', 'currency', 'CNY'),
            amount: values.amount ?? '',
            dueAt: new Date(`${values.dueAt ?? ''}T23:59:59.000Z`).toISOString(),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, post);
  } else heading.append(copy);
  panel.append(heading);
  const list = el('div', 'qtc-list');
  const receivables = [...(controller.views.get('/api/v1/ar-open-items') ?? [])].sort(
    (left, right) =>
      Date.parse(recordText(left, 'dueAt', 'due_at')) -
      Date.parse(recordText(right, 'dueAt', 'due_at')),
  );
  for (const item of receivables) {
    const original = Number(recordText(item, 'originalAmount', 'original_amount', '0'));
    const remaining = Number(recordText(item, 'remainingAmount', 'remaining_amount', '0'));
    const overdue =
      remaining > 0 &&
      recordText(item, 'dueAt', 'due_at').slice(0, 10) < new Date().toISOString().slice(0, 10);
    const card = el('article', `qtc-card${overdue ? ' overdue' : ''}`);
    card.append(
      el('p', 'eyebrow', recordText(item, 'documentNumber', 'document_number', '应收单')),
      el(
        'strong',
        '',
        `未核销 ${displayMoney(recordText(item, 'currency', 'currency'), remaining)}`,
      ),
      el(
        'p',
        'qtc-metrics',
        `原始 ${decimalValue(original)} · 已核销 ${decimalValue(original - remaining)} · 到期 ${recordText(item, 'dueAt', 'due_at').slice(0, 10)}`,
      ),
    );
    if (overdue) card.append(el('span', 'opportunity-alert', '已逾期'));
    list.append(card);
  }
  if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无应收开放项。'));
  panel.append(list);
  workspace.append(panel);
}
