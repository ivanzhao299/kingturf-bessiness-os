import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function appendQualityPlans(
  context: OperationsViewContext,
  panel: HTMLElement,
  plans: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel, qualityStageLabel } = context.ports;
  const planPanel = el('article', 'quality-section quality-plans');
  planPanel.append(el('h3', '', '检验计划'));
  if (permissions.has('quality-plan:manage')) {
    const createPlan = el('button', 'primary', '＋ 创建检验计划');
    createPlan.addEventListener('click', () => {
      openForm(
        workspace,
        '创建检验计划',
        '计划版本发布后不可修改；每个特性必须有明确的数据类型和验收边界。',
        [
          { name: 'code', label: '计划编码', required: true },
          { name: 'name', label: '计划名称', required: true },
          { name: 'itemVersionId', label: '物料版本编号', required: true },
          {
            name: 'inspectionStage',
            label: '检验阶段',
            type: 'select',
            required: true,
            options: [
              { value: 'INCOMING', label: '来料' },
              { value: 'IN_PROCESS', label: '过程' },
              { value: 'FINAL', label: '终检' },
            ],
          },
          { name: 'samplingMethod', label: '抽样方式', required: true, value: '全检' },
          { name: 'acceptanceRule', label: '验收规则', required: true, value: '全部必检项通过' },
          { name: 'effectiveAt', label: '生效时间', type: 'datetime-local', required: true },
          { name: 'characteristicCode', label: '特性编码', required: true },
          { name: 'characteristicName', label: '特性名称', required: true },
          { name: 'lowerLimit', label: '下限（可选）', type: 'number' },
          { name: 'upperLimit', label: '上限（可选）', type: 'number' },
        ],
        '保存并发布计划',
        async (values) => {
          await controller.submit('/api/v1/quality-plans', {
            code: values.code,
            name: values.name,
            itemVersionId: values.itemVersionId,
            inspectionStage: values.inspectionStage,
            samplingMethod: values.samplingMethod,
            acceptanceRule: { description: values.acceptanceRule },
            effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
            characteristics: [
              {
                code: values.characteristicCode,
                name: values.characteristicName,
                dataType: 'NUMERIC',
                lowerLimit: values.lowerLimit ?? undefined,
                upperLimit: values.upperLimit ?? undefined,
                required: true,
                instructions: '',
              },
            ],
            publish: true,
          });
          await refresh();
        },
      );
    });
    planPanel.append(createPlan);
  }
  for (const plan of plans) {
    const row = el('article', 'quality-plan-card');
    const characteristics = Array.isArray(plan.characteristics)
      ? plan.characteristics.map(recordValue)
      : [];
    row.append(
      el('strong', '', `${recordText(plan, 'code', 'code')} · ${recordText(plan, 'name', 'name')}`),
      el(
        'span',
        `ctr-state state-${recordText(plan, 'status', 'status', 'DRAFT').toLowerCase()}`,
        `${businessStateLabel(recordText(plan, 'status', 'status', 'DRAFT'))} · 第 ${recordText(plan, 'version', 'version', '1')} 版`,
      ),
      el(
        'p',
        'muted',
        `${qualityStageLabel(recordText(plan, 'inspectionStage', 'inspection_stage'))} · ${characteristics.map((item) => recordText(item, 'name', 'name')).join('、') || '暂无特性'}`,
      ),
    );
    if (
      permissions.has('quality-plan:manage') &&
      recordText(plan, 'status', 'status') === 'DRAFT' &&
      typeof plan.id === 'string'
    ) {
      const publish = el('button', 'secondary', '发布计划');
      publish.addEventListener('click', () => {
        openForm(
          workspace,
          '发布检验计划',
          '发布后计划版本不可修改，请确认检验阶段、特性和验收边界。',
          [{ name: 'confirmation', label: '发布确认说明', type: 'textarea', required: true }],
          '确认发布',
          async () => {
            await controller.submit(`/api/v1/quality-plans/${plan.id as string}/publish`, {});
            await refresh();
          },
        );
      });
      row.append(publish);
    }
    planPanel.append(row);
  }
  if (!plans.length) planPanel.append(el('p', 'pipeline-empty', '暂无检验计划。'));
  panel.append(planPanel);
}
