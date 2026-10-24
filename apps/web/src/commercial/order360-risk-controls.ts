import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

export function createRiskPolicyButton(context: FulfillmentViewContext): HTMLElement {
  const { workspace, status, controller } = context;
  const create = el('button', 'secondary', '＋ 新建风险政策');
  create.addEventListener('click', () => {
    openForm(
      workspace,
      '新建风险政策',
      '政策发布后，评价会固定其版本、阈值和规则清单。',
      [
        { name: 'code', label: '政策代码', required: true },
        { name: 'name', label: '政策名称', required: true },
        {
          name: 'minimumMarginBasisPoints',
          label: '最低毛利率（bp）',
          type: 'number',
          required: true,
          value: '2500',
        },
        {
          name: 'overdueGraceDays',
          label: '逾期宽限天数',
          type: 'number',
          required: true,
          value: '0',
        },
        {
          name: 'creditWarningDays',
          label: '信用预警天数',
          type: 'number',
          required: true,
          value: '30',
        },
        { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
      ],
      '发布风险政策',
      async (values) => {
        await controller.submit('/api/v1/risk-policies', {
          code: values.code ?? '',
          name: values.name ?? '',
          minimumMarginBasisPoints: Number(values.minimumMarginBasisPoints),
          overdueGraceDays: Number(values.overdueGraceDays),
          creditWarningDays: Number(values.creditWarningDays),
          effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
          rules: [
            { code: 'LOW_MARGIN' },
            { code: 'OVERDUE_AR' },
            { code: 'CREDIT_EXPIRY' },
            { code: 'CONTRACT_SIGNATURE' },
            { code: 'ORDER_RELEASE_GATE' },
          ],
          publish: true,
        });
        await controller.load();
        status.textContent = controller.message;
      },
    );
  });
  return create;
}

export function createOrderRiskPolicyCard(
  context: FulfillmentViewContext,
  policy: Record<string, unknown>,
  riskPercent: (value: string) => string,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { recordText, textValue } = context.ports;
  const policyCard = el('article', 'version-card');
  policyCard.append(
    el(
      'strong',
      '',
      `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版`,
    ),
    el('span', 'version-pin', recordText(policy, 'status', 'status')),
    el(
      'p',
      'muted',
      `毛利门槛 ${riskPercent(recordText(policy, 'minimumMarginBasisPoints', 'minimum_margin_basis_points', '0'))}% · 逾期宽限 ${recordText(policy, 'overdueGraceDays', 'overdue_grace_days', '0')} 天 · 信用预警 ${recordText(policy, 'creditWarningDays', 'credit_warning_days', '0')} 天`,
    ),
  );
  if (permissions.has('risk-policy:manage') && policy.status === 'DRAFT') {
    const publish = el('button', 'primary', '发布版本');
    publish.addEventListener(
      'click',
      () =>
        void controller
          .submit(`/api/v1/risk-policy-versions/${textValue(policy.id, '')}/publish`, {})
          .then(() => controller.load()),
    );
    policyCard.append(publish);
  }
  if (permissions.has('risk-policy:manage') && policy.status === 'PUBLISHED') {
    const revise = el('button', 'secondary', '创建新版本');
    revise.addEventListener('click', () => {
      openForm(
        workspace,
        '创建风险政策版本',
        '新版本先保存为草稿，发布后历史评价仍固定原版本。',
        [
          {
            name: 'minimumMarginBasisPoints',
            label: '最低毛利率（bp）',
            type: 'number',
            required: true,
            value: recordText(
              policy,
              'minimumMarginBasisPoints',
              'minimum_margin_basis_points',
              '2500',
            ),
          },
          {
            name: 'overdueGraceDays',
            label: '逾期宽限天数',
            type: 'number',
            required: true,
            value: recordText(policy, 'overdueGraceDays', 'overdue_grace_days', '0'),
          },
          {
            name: 'creditWarningDays',
            label: '信用预警天数',
            type: 'number',
            required: true,
            value: recordText(policy, 'creditWarningDays', 'credit_warning_days', '30'),
          },
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
        ],
        '保存草稿',
        async (values) => {
          await controller.submit(
            `/api/v1/risk-policies/${recordText(policy, 'policyId', 'policy_id')}/versions`,
            {
              minimumMarginBasisPoints: Number(values.minimumMarginBasisPoints),
              overdueGraceDays: Number(values.overdueGraceDays),
              creditWarningDays: Number(values.creditWarningDays),
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              rules: [
                { code: 'LOW_MARGIN' },
                { code: 'OVERDUE_AR' },
                { code: 'CREDIT_EXPIRY' },
                { code: 'CONTRACT_SIGNATURE' },
                { code: 'ORDER_RELEASE_GATE' },
              ],
            },
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    policyCard.append(revise);
  }
  return policyCard;
}

export function appendOrderRiskEvaluation(
  context: FulfillmentViewContext,
  riskOrders: readonly Record<string, unknown>[],
  riskPolicies: readonly Record<string, unknown>[],
  riskPolicyControls: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText, textValue } = context.ports;
  if (permissions.has('risk:evaluate') && riskOrders.length && riskPolicies.length) {
    const evaluate = el('button', 'primary', '运行订单风险评价');
    evaluate.addEventListener('click', () => {
      openForm(
        workspace,
        '运行订单风险评价',
        '风险分数由订单利润、应收和信用事实推导。',
        [
          {
            name: 'salesOrderId',
            label: '销售订单',
            type: 'select',
            required: true,
            options: riskOrders.map((order) => ({
              value: textValue(order.id, ''),
              label: recordText(order, 'orderNumber', 'order_number'),
            })),
          },
          {
            name: 'policyVersionId',
            label: '已发布政策',
            type: 'select',
            required: true,
            options: riskPolicies
              .filter((policy) => policy.status === 'PUBLISHED')
              .map((policy) => ({
                value: textValue(policy.id, ''),
                label: `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版`,
              })),
          },
          {
            name: 'assigneeEmployeeId',
            label: '责任人',
            type: 'select',
            required: true,
            options: controller.employees.map((employee) => ({
              value: employee.id,
              label: employee.displayName ?? employee.id,
            })),
          },
          { name: 'validUntil', label: '评价有效至', type: 'date', required: true },
          { name: 'dueAt', label: '任务到期日', type: 'date', required: true },
        ],
        '计算风险',
        async (values) => {
          await controller.submit('/api/v1/risk-evaluations', {
            salesOrderId: values.salesOrderId ?? '',
            policyVersionId: values.policyVersionId ?? '',
            assigneeEmployeeId: values.assigneeEmployeeId ?? '',
            validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
            dueAt: new Date(`${values.dueAt ?? ''}T23:59:59.000Z`).toISOString(),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    riskPolicyControls.append(evaluate);
  }
}
