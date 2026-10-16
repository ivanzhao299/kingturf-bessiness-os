import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

export function createCommissionCard(
  context: FinanceRiskViewContext,
  commission: Record<string, unknown>,
  percent: (value: string) => string,
  labels: Record<string, string>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, recordValue, displayMoney, commissionNextAction } = context.ports;
  const state = recordText(commission, 'effectiveState', 'effective_state', 'ACCRUED');
  const ledger = Array.isArray(commission.ledger)
    ? commission.ledger.map((item) => recordValue(item))
    : [];
  const card = el('article', 'qtc-card commission-card');
  card.append(
    el(
      'p',
      'eyebrow',
      `${recordText(commission, 'orderNumber', 'orderNumber', 'ORDER')} · ${recordText(commission, 'accountingPeriod', 'accounting_period')}`,
    ),
    el(
      'strong',
      '',
      displayMoney(
        recordText(commission, 'currency', 'currency'),
        recordText(commission, 'commissionAmount', 'commission_amount', '—'),
      ),
    ),
    el('span', `ctr-state state-${state.toLocaleLowerCase()}`, labels[state] ?? state),
    el(
      'p',
      'qtc-metrics',
      `收入 ${recordText(commission, 'eligibleRevenue', 'eligible_revenue', '—')} · 毛利率 ${percent(recordText(commission, 'marginBasisPoints', 'margin_basis_points', '0'))}% · 计提时回款 ${percent(recordText(commission, 'collectionBasisPoints', 'collection_basis_points', '0'))}%`,
    ),
    el(
      'p',
      'muted',
      `受益人 ${recordText(commission, 'beneficiaryName', 'beneficiaryName', '—')} · 政策 ${recordText(commission, 'policyCode', 'policyCode', '—')} 第 ${recordText(commission, 'policyVersion', 'policyVersion', '—')} 版`,
    ),
    el('p', 'next-action-note', `下一步：${commissionNextAction(state)}`),
  );
  const timeline = el('ol', 'commission-ledger');
  for (const entry of ledger)
    timeline.append(
      el(
        'li',
        '',
        `${recordText(entry, 'sequence', 'sequence')} · ${labels[recordText(entry, 'state', 'state')] ?? recordText(entry, 'state', 'state')} · ${recordText(entry, 'reason', 'reason')} · ${recordText(entry, 'externalReference', 'external_reference', '无外部引用')}`,
      ),
    );
  card.append(timeline);
  const actions = el('div', 'qtc-actions');
  const addCommand = (
    action: 'freeze' | 'release' | 'pay' | 'clawback' | 'cancel',
    label: string,
    needsReference = false,
  ) => {
    const button = el(
      'button',
      action === 'pay' || action === 'release' ? 'primary' : 'secondary',
      label,
    );
    button.addEventListener('click', () => {
      openForm(
        workspace,
        label,
        '该操作追加一条不可变佣金台账，不会覆盖任何历史记录。',
        [
          { name: 'reason', label: '操作理由', type: 'textarea', required: true },
          ...(needsReference
            ? [{ name: 'externalReference', label: '外部凭证号', required: true } as const]
            : []),
        ],
        '确认追加台账',
        async (values) => {
          await controller.submit(`/api/v1/commissions/${textValue(commission.id, '')}/${action}`, {
            reason: values.reason ?? '',
            ...(needsReference ? { externalReference: values.externalReference ?? '' } : {}),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(button);
  };
  if (permissions.has('commission:manage')) {
    if (state === 'ACCRUED') addCommand('freeze', '冻结');
    if (state === 'ACCRUED' || state === 'FROZEN') addCommand('release', '复核并释放');
    if (['ACCRUED', 'FROZEN', 'RELEASED'].includes(state)) addCommand('cancel', '取消');
    if (state === 'RELEASED') addCommand('freeze', '重新冻结');
    if (state === 'PAID') addCommand('clawback', '追回', true);
  }
  if (state === 'RELEASED' && permissions.has('commission:pay'))
    addCommand('pay', '记录支付', true);
  if (actions.children.length > 0) card.append(actions);
  return card;
}
