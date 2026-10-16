import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { PricingViewContext, PolicyViewContext } from './pricing-view-ports';

export function appendPolicyHeading(
  context: PolicyViewContext,
  policyHeading: HTMLElement,
  policyCopy: HTMLElement,
): void {
  const { workspace, status, controller, permissions, policyPanel } = context;
  if (permissions.has('sales-policy:manage')) {
    const createPolicy = el('button', 'secondary', '新建销售政策');
    createPolicy.addEventListener('click', () => {
      openForm(
        workspace,
        '新建销售政策',
        '低于最低毛利率将阻止通过；超过折扣上限将要求人工审批。',
        [
          { name: 'code', label: '政策编号', required: true, placeholder: 'SP-2026-01' },
          { name: 'name', label: '政策名称', required: true, placeholder: '标准销售政策' },
          {
            name: 'minimumMargin',
            label: '最低毛利率（%）',
            type: 'number',
            required: true,
            value: '20',
          },
          {
            name: 'maximumDiscount',
            label: '最大折扣（%）',
            type: 'number',
            required: true,
            value: '10',
          },
        ],
        '发布政策',
        async (values) => {
          const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
          const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
          await controller.submit('/api/v1/sales-policies', {
            code: values.code ?? '',
            name: values.name ?? '',
            rules: [
              {
                when: {
                  op: 'lt',
                  left: { op: 'input', path: 'marginBasisPoints' },
                  right: { op: 'literal', value: minimumMargin },
                },
                effect: {
                  passed: false,
                  approvalRequired: true,
                  minimumMarginBasisPoints: minimumMargin,
                },
                reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
              },
              {
                when: {
                  op: 'gt',
                  left: { op: 'input', path: 'discountBasisPoints' },
                  right: { op: 'literal', value: maximumDiscount },
                },
                effect: { approvalRequired: true, maximumDiscountBasisPoints: maximumDiscount },
                reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
              },
            ],
            publish: true,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    policyHeading.append(policyCopy, createPolicy);
  } else policyHeading.append(policyCopy);
  policyPanel.append(policyHeading);
}

export function appendPolicyCatalog(context: PolicyViewContext): void {
  const { workspace, status, controller, permissions, policies, policyPanel } = context;
  const { textValue } = context.ports;
  const policyCatalog = el('div', 'definition-catalog');
  const latestPolicyVersions = new Map<string, number>();
  for (const policy of policies) {
    const definitionId = textValue(policy.definitionId, '');
    latestPolicyVersions.set(
      definitionId,
      Math.max(latestPolicyVersions.get(definitionId) ?? 0, Number(policy.version ?? 0)),
    );
  }
  for (const policy of policies) {
    const policyCard = el('article', 'definition-card');
    const rules = Array.isArray(policy.rules) ? policy.rules : [];
    policyCard.append(
      el(
        'strong',
        '',
        `${textValue(policy.code, '政策')} · 第 ${textValue(policy.version, '1')} 版`,
      ),
      el(
        'span',
        `ctr-state state-${textValue(policy.status, 'DRAFT').toLocaleLowerCase()}`,
        textValue(policy.status, 'DRAFT'),
      ),
      el('p', 'muted', `${textValue(policy.name, '')} · ${String(rules.length)} 条规则`),
    );
    if (
      permissions.has('sales-policy:manage') &&
      Number(policy.version) === latestPolicyVersions.get(textValue(policy.definitionId, ''))
    ) {
      const revisePolicy = el('button', 'secondary', '新建政策版本');
      revisePolicy.addEventListener('click', () => {
        openForm(
          workspace,
          `修订 ${textValue(policy.code, '销售政策')}`,
          '新版本只影响后续评估，历史政策决策保持原版本引用。',
          [
            {
              name: 'minimumMargin',
              label: '最低毛利率（%）',
              type: 'number',
              required: true,
              value: '20',
            },
            {
              name: 'maximumDiscount',
              label: '最大折扣（%）',
              type: 'number',
              required: true,
              value: '10',
            },
          ],
          '发布新版本',
          async (values) => {
            const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
            const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
            await controller.submit(
              `/api/v1/sales-policies/${textValue(policy.definitionId, '')}/versions`,
              {
                rules: [
                  {
                    when: {
                      op: 'lt',
                      left: { op: 'input', path: 'marginBasisPoints' },
                      right: { op: 'literal', value: minimumMargin },
                    },
                    effect: {
                      passed: false,
                      approvalRequired: true,
                      minimumMarginBasisPoints: minimumMargin,
                    },
                    reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
                  },
                  {
                    when: {
                      op: 'gt',
                      left: { op: 'input', path: 'discountBasisPoints' },
                      right: { op: 'literal', value: maximumDiscount },
                    },
                    effect: {
                      approvalRequired: true,
                      maximumDiscountBasisPoints: maximumDiscount,
                    },
                    reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
                  },
                ],
                publish: true,
              },
            );
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      policyCard.append(revisePolicy);
    }
    policyCatalog.append(policyCard);
  }
  policyPanel.append(policyCatalog);
}

export function appendPolicyEvaluations(context: PolicyViewContext): void {
  const { workspace, status, controller, permissions, publishedPolicies, policyPanel } = context;
  const { textValue } = context.ports;
  const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
  if (
    permissions.has('sales-policy:evaluate') &&
    publishedPolicies.length > 0 &&
    costs.length > 0
  ) {
    const evaluatePolicy = el('button', 'primary', '＋ 评估报价政策');
    evaluatePolicy.addEventListener('click', () => {
      openForm(
        workspace,
        '评估销售政策',
        '利润率和折扣以百分比输入；其他项目上下文由成本决策固定。',
        [
          {
            name: 'policyVersionId',
            label: '已发布政策',
            type: 'select',
            required: true,
            options: publishedPolicies.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.code, '政策')} · 第 ${textValue(item.version, '1')} 版`,
            })),
          },
          {
            name: 'costDecisionId',
            label: '成本决策',
            type: 'select',
            required: true,
            options: costs.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
            })),
          },
          {
            name: 'margin',
            label: '拟定毛利率（%）',
            type: 'number',
            required: true,
            value: '30',
          },
          {
            name: 'discount',
            label: '拟定折扣（%）',
            type: 'number',
            required: true,
            value: '0',
          },
        ],
        '执行政策评估',
        async (values) => {
          await controller.submit('/api/v1/sales-policy-evaluations', {
            policyVersionId: values.policyVersionId ?? '',
            costDecisionId: values.costDecisionId ?? '',
            context: {
              marginBasisPoints: Math.round(Number(values.margin ?? 0) * 100),
              discountBasisPoints: Math.round(Number(values.discount ?? 0) * 100),
            },
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    policyPanel.append(evaluatePolicy);
  }
  const evaluations = controller.views.get('/api/v1/sales-policy-evaluations') ?? [];
  const evaluationList = el('div', 'decision-list');
  for (const evaluation of evaluations) {
    const card = el('article', 'decision-card');
    const passed = evaluation.passed === true;
    const approval = evaluation.approvalRequired === true;
    card.append(
      el('p', 'eyebrow', '销售政策判定'),
      el('strong', passed ? 'decision-pass' : 'decision-fail', passed ? '政策通过' : '政策未通过'),
      el('p', 'muted', approval ? '需要人工审批' : '无需额外审批'),
      el(
        'p',
        'version-pin',
        `政策 ${textValue(evaluation.policyVersionId, '').slice(0, 8)} · 成本 ${textValue(evaluation.costDecisionId, '').slice(0, 8)}`,
      ),
    );
    const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
    for (const reason of reasons) card.append(el('p', 'rule-hit', textValue(reason, '规则命中')));
    card.append(
      el(
        'p',
        'policy-boundary',
        `最低毛利率 ${String(Number(evaluation.minimumMarginBasisPoints ?? 0) / 100)}% · 最大折扣 ${String(Number(evaluation.maximumDiscountBasisPoints ?? 0) / 100)}%`,
      ),
      el('code', 'input-hash', textValue(evaluation.inputHash, '')),
    );
    evaluationList.append(card);
  }
  if (evaluations.length === 0)
    evaluationList.append(el('p', 'pipeline-empty', '暂无销售政策评估结果。'));
  policyPanel.append(evaluationList);
}

export function appendPolicyView(pricingContext: PricingViewContext): void {
  const { workspace, controller } = pricingContext;
  const policyPanel = el('section', 'decision-workbench policy-workbench');
  const policyHeading = el('div', 'pipeline-heading');
  const policyCopy = el('div');
  policyCopy.append(el('h2', '', '销售政策评估'), el('p', '', '毛利、折扣与审批政策'));
  const policies = controller.views.get('/api/v1/sales-policies') ?? [];
  const publishedPolicies = policies.filter((item) => item.status === 'PUBLISHED');
  const context: PolicyViewContext = {
    ...pricingContext,
    policies,
    publishedPolicies,
    policyPanel,
  };
  appendPolicyHeading(context, policyHeading, policyCopy);
  appendPolicyCatalog(context);
  appendPolicyEvaluations(context);
  workspace.append(policyPanel);
}
