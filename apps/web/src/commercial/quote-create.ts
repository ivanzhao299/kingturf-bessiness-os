import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { QuoteViewContext } from './pricing-view-ports';

export function appendQuoteHeading(
  context: QuoteViewContext,
  quoteHeading: HTMLElement,
  quoteCopy: HTMLElement,
): void {
  const { workspace, controller, permissions, policies, costs } = context;
  const { textValue } = context.ports;
  if (permissions.has('quote:create') && costs.length > 0 && policies.length > 0) {
    const createQuote = el('button', 'primary', '＋ 新建报价');
    createQuote.setAttribute('data-create-quote', 'true');
    createQuote.addEventListener('click', () => {
      openForm(
        workspace,
        '新建销售报价',
        '系统先校验销售政策，再由服务器重算每一行、折扣与毛利。',
        [
          { name: 'quoteNumber', label: '报价编号', required: true, placeholder: 'Q-2026-001' },
          {
            name: 'costDecisionId',
            label: '成本决策',
            type: 'select',
            required: true,
            ...(controller.preferredQuoteCostDecisionId
              ? { value: controller.preferredQuoteCostDecisionId }
              : {}),
            options: costs.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
            })),
          },
          {
            name: 'policyVersionId',
            label: '销售政策版本',
            type: 'select',
            required: true,
            options: policies.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.code, '政策')} · 第 ${textValue(item.version, '1')} 版`,
            })),
          },
          {
            name: 'turfQuantity',
            label: '草坪数量（㎡）',
            type: 'number',
            required: true,
            value: '8050',
          },
          {
            name: 'turfPrice',
            label: '草坪销售单价（元/㎡）',
            type: 'number',
            required: true,
            value: '108',
          },
          {
            name: 'installationQuantity',
            label: '铺装数量（㎡）',
            type: 'number',
            required: true,
            value: '8050',
          },
          {
            name: 'installationPrice',
            label: '铺装销售单价（元/㎡）',
            type: 'number',
            required: true,
            value: '28',
          },
          {
            name: 'serviceQuantity',
            label: '项目服务项数量',
            type: 'number',
            required: true,
            value: '1',
          },
          {
            name: 'servicePrice',
            label: '项目服务费（元）',
            type: 'number',
            required: true,
            value: '60000',
          },
          {
            name: 'discountPercent',
            label: '整单折扣（%）',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'validUntil', label: '报价有效期至', type: 'date', required: true },
        ],
        '校验并创建报价',
        (values) => submitQuoteCreation(context, values),
      );
    });
    quoteHeading.append(quoteCopy, createQuote);
  } else quoteHeading.append(quoteCopy);
}

export async function submitQuoteCreation(
  context: QuoteViewContext,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  const { workspace, status, controller, solutions, costs, ctrs } = context;
  const { textValue, decimalValue, replaceRouteView, rebuildWorkspace } = context.ports;
  const cost = costs.find((item) => item.id === values.costDecisionId);
  if (!cost) throw new Error('请选择有效成本决策');
  const solutionId = textValue(cost.technicalSolutionRevisionId, '');
  const solution = solutions.find((item) => item.id === solutionId);
  if (!solution) throw new Error('成本决策对应的技术方案不可见');
  const ctrVersionId = textValue(solution.ctrVersionId, '');
  const ctr = ctrs.find((item) => item.id === ctrVersionId);
  if (!ctr) throw new Error('技术方案对应的技术需求版本不可见');
  const currency = textValue(cost.currency, 'CNY');
  const lineInputs = [
    ['人造草坪系统', values.turfQuantity, 'M2', values.turfPrice],
    ['铺装施工服务', values.installationQuantity, 'M2', values.installationPrice],
    ['项目技术服务', values.serviceQuantity, 'EA', values.servicePrice],
  ] as const;
  const lines = lineInputs.map(([description, quantity, unitCode, unitPrice]) => ({
    description,
    quantity: decimalValue(Number(quantity ?? 0)),
    unitCode,
    unitPrice: decimalValue(Number(unitPrice ?? 0)),
    total: decimalValue(Number(quantity ?? 0) * Number(unitPrice ?? 0)),
  }));
  const subtotal = lines.reduce((sum, line) => sum + Number(line.total), 0);
  const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
  const total = subtotal - discount;
  const costTotal = Number(cost.total ?? 0);
  const margin = total - costTotal;
  if (total <= 0) throw new Error('折扣后报价金额必须大于零');
  const marginBasisPoints = Math.trunc((margin * 10_000) / total);
  const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
  await controller.submit('/api/v1/sales-policy-evaluations', {
    policyVersionId: values.policyVersionId ?? '',
    costDecisionId: values.costDecisionId ?? '',
    context: { marginBasisPoints, discountBasisPoints },
  });
  const policyEvaluation = controller.revisionState;
  if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string') {
    const reasons = Array.isArray(policyEvaluation?.reasons)
      ? policyEvaluation.reasons.map((item) => textValue(item, '')).filter(Boolean)
      : [];
    throw new Error(`销售政策未通过${reasons.length > 0 ? `：${reasons.join('；')}` : ''}`);
  }
  await controller.submit('/api/v1/quotes', {
    quoteNumber: values.quoteNumber ?? '',
    opportunityId: textValue(cost.opportunityId, ''),
    ctrVersionId,
    technicalSolutionRevisionId: solutionId,
    costDecisionId: values.costDecisionId ?? '',
    policyVersionId: values.policyVersionId ?? '',
    policyEvaluationId: policyEvaluation.id,
    currency,
    subtotal: decimalValue(subtotal),
    discount: decimalValue(discount),
    total: decimalValue(total),
    costTotal: decimalValue(costTotal),
    margin: decimalValue(margin),
    marginBasisPoints,
    validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
    lines,
  });
  controller.preferredQuoteCostDecisionId = '';
  await controller.refreshViews(['/api/v1/sales-policy-evaluations', '/api/v1/quotes']);
  controller.message = `报价 ${values.quoteNumber ?? ''} 已创建为草稿，等待报价审批`;
  status.textContent = controller.message;
  const refreshedWorkspace = rebuildWorkspace();
  replaceRouteView(workspace, refreshedWorkspace);
}
