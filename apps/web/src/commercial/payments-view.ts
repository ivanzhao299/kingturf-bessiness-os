import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

export function appendPaymentsView(context: FinanceRiskViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, displayMoney } = context.ports;
  const panel = el('section', 'qtc-workbench payment-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '收款与核销'), el('p', '', '银行收款、认领与应收核销'));
  if (permissions.has('bank-payment:intake')) {
    const intake = el('button', 'primary', '＋ 登记银行收款');
    intake.addEventListener('click', () => {
      openForm(
        workspace,
        '登记银行收款',
        '银行引用和原始摘要将生成不可变哈希。',
        [
          {
            name: 'customerId',
            label: '客户',
            type: 'select',
            required: true,
            options: controller.customers.map((item) => ({
              value: item.id,
              label: item.name ?? item.id,
            })),
          },
          { name: 'bankReference', label: '银行流水号', required: true },
          { name: 'amount', label: '到账金额', type: 'number', required: true },
          {
            name: 'currency',
            label: '币种',
            type: 'select',
            required: true,
            options: [
              { value: 'CNY', label: '人民币' },
              { value: 'USD', label: '美元 USD' },
            ],
          },
          { name: 'receivedAt', label: '到账日期', type: 'date', required: true },
          { name: 'payer', label: '付款方户名', required: true },
        ],
        '保存收款',
        async (values) => {
          await controller.submit('/api/v1/bank-payments', {
            customerId: values.customerId ?? '',
            currency: values.currency ?? 'CNY',
            amount: values.amount ?? '',
            receivedAt: new Date(`${values.receivedAt ?? ''}T12:00:00.000Z`).toISOString(),
            bankReference: values.bankReference ?? '',
            rawPayload: { payer: values.payer ?? '', source: 'MANUAL_BANK_RECEIPT' },
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, intake);
  } else heading.append(copy);
  panel.append(heading);
  const list = el('div', 'qtc-list');
  for (const payment of controller.views.get('/api/v1/bank-payments') ?? []) {
    const card = el('article', 'qtc-card');
    card.append(
      el('p', 'eyebrow', recordText(payment, 'bankReference', 'bank_reference', '银行收款')),
      el(
        'strong',
        '',
        displayMoney(
          recordText(payment, 'currency', 'currency'),
          recordText(payment, 'amount', 'amount', '—'),
        ),
      ),
      el(
        'p',
        'qtc-metrics',
        `待核销 ${recordText(payment, 'remainingAmount', 'remaining_amount', '—')} · 到账 ${recordText(payment, 'receivedAt', 'received_at').slice(0, 10)}`,
      ),
    );
    if (
      permissions.has('reconciliation:run') &&
      Number(recordText(payment, 'remainingAmount', 'remaining_amount', '0')) > 0
    ) {
      const reconcile = el('button', 'primary', '运行自动核销');
      reconcile.addEventListener('click', () => {
        openForm(
          workspace,
          '运行自动核销',
          '系统将按客户、币种和稳定账龄顺序分配到账金额，并保存结果哈希。',
          [],
          '确认运行核销',
          async () => {
            await controller.submit('/api/v1/reconciliation-runs', {
              paymentId: textValue(payment.id, ''),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      card.append(reconcile);
    }
    list.append(card);
  }
  if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无银行收款。'));
  panel.append(list);
  const runs = controller.views.get('/api/v1/reconciliation-runs') ?? [];
  const latestRun = runs[0];
  if (latestRun)
    panel.append(
      el(
        'p',
        'version-pin',
        `最近核销 ${recordText(latestRun, 'resultHash', 'result_hash').slice(0, 12)} · 共 ${String(runs.length)} 次可审计运行`,
      ),
    );
  workspace.append(panel);
}
