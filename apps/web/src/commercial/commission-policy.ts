import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

export function appendCommissionHeading(
  context: FinanceRiskViewContext,
  heading: HTMLElement,
  copy: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  if (permissions.has('commission-policy:manage')) {
    const createPolicy = el('button', 'secondary', '新建佣金政策');
    createPolicy.addEventListener('click', () => {
      openForm(
        workspace,
        '新建并发布佣金政策',
        '政策发布后不可修改；后续调整必须创建新版本。比例使用百分数输入。',
        [
          { name: 'code', label: '政策编码', required: true },
          { name: 'name', label: '政策名称', required: true },
          { name: 'baseRate', label: '基础佣金率（%）', type: 'number', required: true },
          { name: 'minimumMargin', label: '最低毛利率（%）', type: 'number', required: true },
          {
            name: 'releaseCollection',
            label: '释放回款比例（%）',
            type: 'number',
            required: true,
          },
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
        ],
        '发布政策',
        async (values) => {
          const bps = (value: string | undefined) => Math.round(Number(value ?? '0') * 100);
          await controller.submit('/api/v1/commission-policies', {
            code: values.code ?? '',
            name: values.name ?? '',
            applicability: { business: 'ARTIFICIAL_TURF', region: 'ALL' },
            baseRateBasisPoints: bps(values.baseRate),
            minimumMarginBasisPoints: bps(values.minimumMargin),
            releaseCollectionBasisPoints: bps(values.releaseCollection),
            effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
            rules: [
              { code: 'MIN_MARGIN', description: '实际毛利率达到政策门槛' },
              { code: 'COLLECTION_RELEASE', description: '回款比例达到释放门槛' },
            ],
            publish: true,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, createPolicy);
  } else heading.append(copy);
}

export function createCommissionPolicyCard(
  context: FinanceRiskViewContext,
  policy: Record<string, unknown>,
  percent: (value: string) => string,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { recordText, textValue, businessStateLabel } = context.ports;
  const policyCard = el('div', 'commission-policy-card');
  policyCard.append(
    el(
      'span',
      'version-pin',
      `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版 · ${businessStateLabel(recordText(policy, 'status', 'status'))} · 佣金率 ${percent(recordText(policy, 'baseRateBasisPoints', 'base_rate_basis_points', '0'))}% · 毛利门槛 ${percent(recordText(policy, 'minimumMarginBasisPoints', 'minimum_margin_basis_points', '0'))}% · 回款门槛 ${percent(recordText(policy, 'releaseCollectionBasisPoints', 'release_collection_basis_points', '0'))}%`,
    ),
  );
  if (permissions.has('commission-policy:manage') && policy.status === 'PUBLISHED') {
    const revise = el('button', 'secondary', '创建新版本');
    revise.addEventListener('click', () => {
      openForm(
        workspace,
        '创建佣金政策新版本',
        '历史版本保持不变；新版本先保存为草稿，复核后单独发布。',
        [
          { name: 'baseRate', label: '基础佣金率（%）', type: 'number', required: true },
          {
            name: 'minimumMargin',
            label: '最低毛利率（%）',
            type: 'number',
            required: true,
          },
          {
            name: 'releaseCollection',
            label: '释放回款比例（%）',
            type: 'number',
            required: true,
          },
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
        ],
        '保存版本草稿',
        async (values) => {
          const bps = (value: string | undefined) => Math.round(Number(value ?? '0') * 100);
          await controller.submit(
            `/api/v1/commission-policies/${recordText(policy, 'policyId', 'policyId')}/versions`,
            {
              baseRateBasisPoints: bps(values.baseRate),
              minimumMarginBasisPoints: bps(values.minimumMargin),
              releaseCollectionBasisPoints: bps(values.releaseCollection),
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              rules: [
                { code: 'MIN_MARGIN', description: '实际毛利率达到政策门槛' },
                { code: 'COLLECTION_RELEASE', description: '回款比例达到释放门槛' },
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
  if (permissions.has('commission-policy:manage') && policy.status === 'DRAFT') {
    const publish = el('button', 'primary', '发布此版本');
    publish.addEventListener('click', () => {
      void controller
        .submit(`/api/v1/commission-policy-versions/${textValue(policy.id, '')}/publish`, {})
        .then(async () => {
          await controller.load();
          status.textContent = controller.message;
        });
    });
    policyCard.append(publish);
  }
  return policyCard;
}
