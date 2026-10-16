import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';
import { createInspectionCard } from './quality-inspection-cards';

export function appendQualityInspections(
  context: OperationsViewContext,
  panel: HTMLElement,
  plans: readonly Record<string, unknown>[],
  inspections: readonly Record<string, unknown>[],
  lots: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText } = context.ports;
  const inspectionPanel = el('article', 'quality-section quality-inspections');
  const inspectionHeading = el('div', 'panel-head');
  inspectionHeading.append(el('h3', '', '检验队列'));
  if (permissions.has('quality:inspect')) {
    const open = el('button', 'primary', '＋ 开立检验');
    open.addEventListener('click', () => {
      const publishedPlans = plans.filter(
        (item) => recordText(item, 'status', 'status') === 'PUBLISHED',
      );
      openForm(
        workspace,
        '开立批次检验',
        '开立会先将批次置于隔离状态；只有完成检验并通过放行门禁后才能进入可用库存。',
        [
          {
            name: 'planVersionId',
            label: '已发布计划',
            type: 'select',
            required: true,
            options: publishedPlans.map((item) => ({
              value: String(item.id),
              label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
            })),
          },
          {
            name: 'lotId',
            label: '待检批次',
            type: 'select',
            required: true,
            options: lots.map((item) => ({
              value: String(item.lotId ?? item.id),
              label: `${recordText(item, 'lotNumber', 'lotNumber')} · ${recordText(item, 'sku', 'sku')}`,
            })),
          },
          { name: 'inspectionNumber', label: '检验单号', required: true },
          { name: 'sourceId', label: '来源业务编号', required: true },
          { name: 'sampleSize', label: '抽样数量', type: 'number', required: true, value: '1' },
        ],
        '开立检验',
        async (values) => {
          await controller.submit('/api/v1/quality-inspections', {
            inspectionNumber: values.inspectionNumber,
            planVersionId: values.planVersionId,
            lotId: values.lotId,
            sourceType: 'PRODUCTION_ROLL',
            sourceId: values.sourceId,
            sampleSize: values.sampleSize,
          });
          await refresh();
        },
      );
    });
    inspectionHeading.append(open);
  }
  inspectionPanel.append(inspectionHeading);
  const inspectionPriority: Readonly<Record<string, number>> = {
    COMPLETED: 0,
    DISPOSITIONED: 1,
    SAMPLED: 2,
    OPEN: 3,
    RELEASED: 4,
    REJECTED: 5,
    CANCELLED: 6,
  };
  for (const inspection of [...inspections].sort(
    (left, right) =>
      (inspectionPriority[recordText(left, 'state', 'state')] ?? 9) -
      (inspectionPriority[recordText(right, 'state', 'state')] ?? 9),
  )) {
    const card = createInspectionCard(context, inspection, refresh);
    inspectionPanel.append(card);
  }
  if (!inspections.length) inspectionPanel.append(el('p', 'pipeline-empty', '暂无检验单。'));
  panel.append(inspectionPanel);
}
