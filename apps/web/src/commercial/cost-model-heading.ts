import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { PricingViewContext } from './pricing-view-ports';

export function appendCostModelHeading(
  context: PricingViewContext,
  costHeading: HTMLElement,
  costCopy: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  if (permissions.has('cost-model:manage')) {
    const createModel = el('button', 'secondary', '新建成本模型');
    createModel.addEventListener('click', () => {
      openForm(
        workspace,
        '新建成本模型',
        '发布后该版本可用于成本核算；管理费按成本小计的比例追加。',
        [
          { name: 'code', label: '模型编号', required: true, placeholder: 'CM-2026-01' },
          { name: 'name', label: '模型名称', required: true, placeholder: '标准项目成本模型' },
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
          {
            name: 'overheadPercent',
            label: '管理费率（%）',
            type: 'number',
            required: true,
            value: '3',
          },
        ],
        '发布模型',
        async (values) => {
          const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
          await controller.submit('/api/v1/cost-models', {
            code: values.code ?? '',
            name: values.name ?? '',
            currency: values.currency ?? 'CNY',
            rules: [
              {
                when: { op: 'literal', value: true },
                adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
              },
            ],
            publish: true,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    costHeading.append(costCopy, createModel);
  } else costHeading.append(costCopy);
}
