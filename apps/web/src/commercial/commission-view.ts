import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';
import { appendCommissionHeading, createCommissionPolicyCard } from './commission-policy';
import { createCommissionCard } from './commission-ledger';

function appendCommissionAccrual(
  context: FinanceRiskViewContext,
  panel: HTMLElement,
  publishedPolicies: readonly Record<string, unknown>[],
  percent: (value: string) => string,
): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText } = context.ports;
  if (permissions.has('commission:accrue') && publishedPolicies.length) {
    const accrue = el('button', 'primary', '＋ 计算并计提佣金');
    accrue.addEventListener('click', () => {
      const orders = controller.views.get('/api/v1/sales-orders') ?? [];
      openForm(
        workspace,
        '计算并计提佣金',
        '服务器读取订单、报价毛利与核销台账，金额和状态不能由前端指定。',
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
          {
            name: 'beneficiaryEmployeeId',
            label: '佣金受益人',
            type: 'select',
            required: true,
            options: controller.employees
              .filter((item) => item.active !== false)
              .map((item) => ({ value: item.id, label: item.displayName ?? item.id })),
          },
          {
            name: 'policyVersionId',
            label: '已发布政策版本',
            type: 'select',
            required: true,
            options: publishedPolicies.map((item) => ({
              value: textValue(item.id, ''),
              label: `${recordText(item, 'code', 'code')} · 第 ${recordText(item, 'version', 'version', '1')} 版 · ${percent(recordText(item, 'baseRateBasisPoints', 'base_rate_basis_points', '0'))}%`,
            })),
          },
          { name: 'accountingPeriod', label: '会计期间（YYYY-MM）', required: true },
        ],
        '执行计提',
        async (values) => {
          await controller.submit('/api/v1/commissions/accrue', {
            salesOrderId: values.salesOrderId ?? '',
            beneficiaryEmployeeId: values.beneficiaryEmployeeId ?? '',
            policyVersionId: values.policyVersionId ?? '',
            accountingPeriod: values.accountingPeriod ?? '',
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    panel.append(accrue);
  }
}

export function appendCommissionView(context: FinanceRiskViewContext): void {
  const { workspace, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'qtc-workbench commission-workbench');
  const percent = (value: string) => String(Number(value) / 100);
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '佣金引擎与不可变台账'), el('p', '', '佣金计提、释放、支付与追回'));
  appendCommissionHeading(context, heading, copy);
  panel.append(heading);
  const policies = controller.views.get('/api/v1/commission-policies') ?? [];
  const publishedPolicies = policies.filter((item) => item.status === 'PUBLISHED');
  appendCommissionAccrual(context, panel, publishedPolicies, percent);
  if (policies.length) {
    const policyStrip = el('div', 'commission-policy-strip');
    for (const policy of policies.slice(0, 4)) {
      const policyCard = createCommissionPolicyCard(context, policy, percent);
      policyStrip.append(policyCard);
    }
    panel.append(policyStrip);
  }
  const commissionPriority: Readonly<Record<string, number>> = {
    RELEASED: 0,
    FROZEN: 1,
    ACCRUED: 2,
    PAID: 3,
    CLAWED_BACK: 4,
    CANCELLED: 5,
  };
  const cases = [...(controller.views.get('/api/v1/commissions') ?? [])].sort(
    (left, right) =>
      (commissionPriority[recordText(left, 'effectiveState', 'effective_state')] ?? 9) -
      (commissionPriority[recordText(right, 'effectiveState', 'effective_state')] ?? 9),
  );
  if (cases.length) {
    const summary = el('div', 'workbench-summary-grid');
    const released = cases.filter(
      (item) => recordText(item, 'effectiveState', 'effective_state') === 'RELEASED',
    ).length;
    const frozen = cases.filter(
      (item) => recordText(item, 'effectiveState', 'effective_state') === 'FROZEN',
    ).length;
    summary.append(
      el('div', 'summary-card', `待登记支付\n${String(released)} 笔`),
      el('div', 'summary-card', `冻结待处理\n${String(frozen)} 笔`),
      el('div', 'summary-card', `全部佣金\n${String(cases.length)} 笔`),
    );
    panel.append(summary);
  }
  const list = el('div', 'qtc-list commission-list');
  const labels: Record<string, string> = {
    ACCRUED: '已计提',
    FROZEN: '已冻结',
    RELEASED: '已释放',
    PAID: '已支付',
    CLAWED_BACK: '已追回',
    CANCELLED: '已取消',
  };
  for (const commission of cases) {
    const card = createCommissionCard(context, commission, percent, labels);
    list.append(card);
  }
  if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无佣金计提。'));
  panel.append(list);
  workspace.append(panel);
}
