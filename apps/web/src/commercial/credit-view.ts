import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CreditContractViewContext } from './credit-contract-view-ports';

function createCreditDecisionCard(
  context: CreditContractViewContext,
  decision: Record<string, unknown>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, displayMoney } = context.ports;
  const state = recordText(decision, 'effectiveStatus', 'effective_status', 'PENDING_APPROVAL');
  const card = el('article', 'qtc-card');
  card.append(
    el('p', 'eyebrow', '信用审查结果'),
    el(
      'strong',
      '',
      state === 'APPROVED'
        ? '信用已批准'
        : state === 'REJECTED'
          ? '信用已拒绝'
          : state === 'EXPIRED'
            ? '信用已过期'
            : '等待信用审批',
    ),
    el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
    el(
      'p',
      'qtc-metrics',
      `申请 ${displayMoney(decision.currency, decision.requestedAmount ?? decision.requested_amount)} · 敞口 ${displayMoney(decision.currency, decision.exposureAmount ?? decision.exposure_amount)} · 额度 ${displayMoney(decision.currency, decision.creditLimit ?? decision.limit_amount)}`,
    ),
    el(
      'p',
      'version-pin',
      `报价 ${recordText(decision, 'quoteRevisionId', 'quote_revision_id').slice(0, 8)} · 敞口快照 ${recordText(decision, 'exposureSnapshotId', 'exposure_snapshot_id').slice(0, 8)}`,
    ),
  );
  if (state === 'PENDING_APPROVAL' && permissions.has('credit:approve')) {
    const actions = el('div', 'qtc-actions');
    for (const [result, label] of [
      ['APPROVED', '批准信用'],
      ['REJECTED', '拒绝信用'],
    ] as const) {
      const button = el('button', result === 'APPROVED' ? 'primary' : 'secondary', label);
      button.addEventListener('click', () => {
        openForm(
          workspace,
          label,
          '审批决定将永久保留并影响订单释放资格。',
          [{ name: 'reason', label: '审批理由', type: 'textarea', required: true }],
          '确认决定',
          async (values) => {
            await controller.submit(
              `/api/v1/credit-decisions/${textValue(decision.id, '')}/approve`,
              { decision: result, reason: values.reason ?? '' },
            );
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      actions.append(button);
    }
    card.append(actions);
  }
  return card;
}

export function appendCreditView(context: CreditContractViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, currencyLabel } = context.ports;
  const creditPanel = el('section', 'qtc-workbench credit-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '信用审查'), el('p', '', '客户额度、应收与信用敞口'));
  if (permissions.has('credit:approve')) {
    const setLimit = el('button', 'secondary', '设置客户额度');
    setLimit.addEventListener('click', () => {
      openForm(
        workspace,
        '设置客户信用额度',
        '额度按客户、币种和有效期形成不可变版本记录。',
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
          { name: 'amount', label: '信用额度', type: 'number', required: true },
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
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          { name: 'expiresAt', label: '失效日期', type: 'date', required: true },
        ],
        '保存额度',
        async (values) => {
          await controller.submit('/api/v1/credit-limits', {
            customerId: values.customerId ?? '',
            currency: values.currency ?? 'CNY',
            amount: values.amount ?? '',
            effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
            expiresAt: new Date(`${values.expiresAt ?? ''}T23:59:59.000Z`).toISOString(),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, setLimit);
  } else heading.append(copy);
  creditPanel.append(heading);
  const limits = controller.views.get('/api/v1/credit-limits') ?? [];
  const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
    (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
  );
  if (permissions.has('credit:evaluate') && limits.length > 0 && issuedQuotes.length > 0) {
    const evaluateCredit = el('button', 'primary', '＋ 发起信用评估');
    evaluateCredit.addEventListener('click', () => {
      openForm(
        workspace,
        '发起信用评估',
        '服务器会锁定客户信用台账并重新计算敞口，不能由前端覆盖。',
        [
          {
            name: 'quoteRevisionId',
            label: '已签发报价',
            type: 'select',
            required: true,
            options: issuedQuotes.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.quoteNumber, '报价')} · 第 ${textValue(item.revision, '1')} 版 · ${textValue(item.currency, '')} ${textValue(item.total, '—')}`,
            })),
          },
          {
            name: 'creditLimitId',
            label: '信用额度版本',
            type: 'select',
            required: true,
            options: limits.map((item) => ({
              value: textValue(item.id, ''),
              label: `${currencyLabel(recordText(item, 'currency', 'currency', 'CNY'))} ${recordText(item, 'amount', 'amount', '—')} · ${recordText(item, 'expiresAt', 'expires_at', '').slice(0, 10)}`,
            })),
          },
          { name: 'validUntil', label: '信用决定有效期至', type: 'date', required: true },
        ],
        '执行信用评估',
        async (values) => {
          const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
          const opportunity = controller.opportunities.find(
            (item) => item.id === quote?.opportunityId,
          );
          if (!quote || typeof opportunity?.customerId !== 'string')
            throw new Error('报价未关联有效客户');
          await controller.submit('/api/v1/credit-decisions', {
            customerId: opportunity.customerId,
            quoteRevisionId: textValue(quote.id, ''),
            quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
            creditLimitId: values.creditLimitId ?? '',
            validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    creditPanel.append(evaluateCredit);
  }
  const decisions = controller.views.get('/api/v1/credit-decisions') ?? [];
  const list = el('div', 'qtc-list');
  for (const decision of decisions) {
    const card = createCreditDecisionCard(context, decision);
    list.append(card);
  }
  if (decisions.length === 0) list.append(el('p', 'pipeline-empty', '暂无信用决定。'));
  creditPanel.append(list);
  workspace.append(creditPanel);
}
