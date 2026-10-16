import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

export function createProductionCostPolicyButton(
  context: FulfillmentViewContext,
  policies: readonly Record<string, unknown>[],
  materialItems: readonly Record<string, unknown>[],
): HTMLElement {
  const { workspace, status, controller } = context;
  const { recordText } = context.ports;
  const createPolicy = el('button', 'primary', '＋ 新建成本政策');
  createPolicy.addEventListener('click', () => {
    const latestVersion = policies.reduce(
      (max, policy) => Math.max(max, Number(recordText(policy, 'version', 'version') || 0)),
      0,
    );
    openForm(
      workspace,
      '建立制造成本政策',
      '发布后费率和材料单价保持只读；每个已发布原材料版本都必须给出可追溯计价来源。',
      [
        {
          name: 'version',
          label: '政策版本',
          type: 'number',
          required: true,
          value: String(latestVersion + 1),
        },
        {
          name: 'currency',
          label: '币种',
          type: 'select',
          required: true,
          value: 'CNY',
          options: [{ value: 'CNY', label: '人民币' }],
        },
        {
          name: 'laborRatePerHour',
          label: '人工小时费率',
          type: 'number',
          required: true,
        },
        {
          name: 'machineRatePerHour',
          label: '机器小时费率',
          type: 'number',
          required: true,
        },
        {
          name: 'overheadRatePerMachineHour',
          label: '制造费用/机器小时',
          type: 'number',
          required: true,
        },
        {
          name: 'effectiveFrom',
          label: '生效日期',
          type: 'date',
          required: true,
        },
        { name: 'sourceReference', label: '政策来源编号', required: true },
        ...materialItems.map((item) => ({
          name: `materialRate_${String(item.id)}`,
          label: `${recordText(item, 'sku', 'sku')} 材料单位成本`,
          type: 'number' as const,
          required: true,
        })),
      ],
      '发布成本政策',
      async (values) => {
        await controller.submit('/api/v1/production-cost-policies', {
          version: Number(values.version),
          currency: values.currency,
          laborRatePerHour: values.laborRatePerHour,
          machineRatePerHour: values.machineRatePerHour,
          overheadRatePerMachineHour: values.overheadRatePerMachineHour,
          effectiveFrom: values.effectiveFrom,
          sourceReference: values.sourceReference,
          materialRates: materialItems.map((item) => ({
            itemVersionId: String(item.id),
            unitCost: values[`materialRate_${String(item.id)}`],
            sourceReference: `${String(values.sourceReference)}-${recordText(item, 'sku', 'sku')}`,
          })),
        });
        await controller.load();
        status.textContent = controller.message;
      },
    );
  });
  return createPolicy;
}
