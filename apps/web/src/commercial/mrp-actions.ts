import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function appendMrpActions(
  context: OperationsViewContext,
  actions: HTMLElement,
  publishedItemOptions: readonly { value: string; label: string }[],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  if (permissions.has('mrp-policy:manage')) {
    const policy = el('button', 'secondary', '＋ 计划政策');
    policy.addEventListener('click', () => {
      openForm(
        workspace,
        '新建物料计划政策',
        '政策按生效时间追加，固定安全库存、批量、交期和制造/采购方式。',
        [
          {
            name: 'itemVersionId',
            label: '物料版本',
            type: 'select',
            required: true,
            options: publishedItemOptions,
          },
          {
            name: 'makeOrBuy',
            label: '供应方式',
            type: 'select',
            required: true,
            options: [
              { value: 'MAKE', label: '自制' },
              { value: 'BUY', label: '采购' },
            ],
          },
          { name: 'safetyStock', label: '安全库存', type: 'number', required: true, value: '0' },
          {
            name: 'minimumOrderQuantity',
            label: '最小批量',
            type: 'number',
            required: true,
            value: '0',
          },
          {
            name: 'orderMultiple',
            label: '批量倍数',
            type: 'number',
            required: true,
            value: '1',
          },
          {
            name: 'leadTimeDays',
            label: '提前期（天）',
            type: 'number',
            required: true,
            value: '0',
          },
          {
            name: 'freezeWindowDays',
            label: '冻结窗口（天）',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
        ],
        '保存政策',
        async (values) => {
          await controller.submit('/api/v1/mrp-policies', {
            itemVersionId: values.itemVersionId,
            makeOrBuy: values.makeOrBuy,
            safetyStock: values.safetyStock,
            minimumOrderQuantity: values.minimumOrderQuantity,
            orderMultiple: values.orderMultiple,
            leadTimeDays: Number(values.leadTimeDays),
            freezeWindowDays: Number(values.freezeWindowDays),
            effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
          });
          await refresh();
        },
      );
    });
    actions.append(policy);
  }
  if (permissions.has('mrp:run')) {
    const demand = el('button', 'secondary', '＋ 需求信号');
    demand.addEventListener('click', () => {
      openForm(
        workspace,
        '登记独立需求',
        '需求必须引用已发布物料和业务来源，运行时生成不可变快照。',
        [
          {
            name: 'itemVersionId',
            label: '需求物料',
            type: 'select',
            required: true,
            options: publishedItemOptions,
          },
          { name: 'sourceType', label: '来源类型', required: true, value: 'SALES-FORECAST' },
          { name: 'sourceId', label: '来源业务编号', required: true },
          { name: 'requiredAt', label: '需求日期', type: 'date', required: true },
          { name: 'quantity', label: '需求数量', type: 'number', required: true },
          { name: 'priority', label: '优先级', type: 'number', required: true, value: '100' },
        ],
        '保存需求',
        async (values) => {
          await controller.submit('/api/v1/mrp-demands', {
            itemVersionId: values.itemVersionId,
            sourceType: values.sourceType,
            sourceId: values.sourceId,
            requiredAt: values.requiredAt,
            quantity: values.quantity,
            priority: Number(values.priority),
          });
          await refresh();
        },
      );
    });
    const run = el('button', 'primary', '运行物料需求计算');
    run.addEventListener('click', () => {
      openForm(
        workspace,
        '运行物料需求计算',
        '运行将固定需求、BOM、政策、合格库存和在途采购快照，并生成可解释建议。',
        [
          { name: 'runNumber', label: '运行编号', required: true },
          { name: 'asOf', label: '计划基准日', type: 'date', required: true },
          { name: 'horizonEnd', label: '计划截止日', type: 'date', required: true },
        ],
        '开始计算',
        async (values) => {
          await controller.submit('/api/v1/mrp-runs', {
            runNumber: values.runNumber,
            asOf: `${values.asOf ?? ''}T00:00:00.000Z`,
            horizonEnd: values.horizonEnd,
          });
          await refresh();
        },
      );
    });
    actions.append(demand, run);
  }
}
