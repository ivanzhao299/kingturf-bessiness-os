import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function createInspectionCard(
  context: OperationsViewContext,
  inspection: Record<string, unknown>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel, operationsNextAction } = context.ports;
  const state = recordText(inspection, 'state', 'state', 'OPEN');
  const card = el('article', 'quality-inspection-card');
  const results = Array.isArray(inspection.results) ? inspection.results.map(recordValue) : [];
  const events = Array.isArray(inspection.events) ? inspection.events.map(recordValue) : [];
  card.append(
    el(
      'strong',
      '',
      `${recordText(inspection, 'inspectionNumber', 'inspection_number')} · ${recordText(inspection, 'lotNumber', 'lot_number')}`,
    ),
    el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
    el(
      'p',
      'muted',
      `${recordText(inspection, 'planCode', 'plan_code')} · ${String(results.length)} 项结果 · ${String(events.length)} 条状态证据`,
    ),
    el('p', 'next-action-note', `下一步：${operationsNextAction('quality', state)}`),
  );
  const actions = el('div', 'quality-actions');
  const command = (action: 'sample' | 'complete' | 'cancel', label: string) => {
    const button = el('button', action === 'complete' ? 'primary' : 'secondary', label);
    button.addEventListener('click', () => {
      openForm(
        workspace,
        label,
        '状态变化写入不可变检验事件；请提供操作理由和证据编号。',
        [
          { name: 'reason', label: '操作理由', type: 'textarea', required: true },
          { name: 'evidence', label: '证据编号', required: true },
          { name: 'idempotencyKey', label: '幂等键', required: true },
        ],
        `确认${label}`,
        async (values) => {
          await controller.submit(
            `/api/v1/quality-inspections/${String(inspection.id)}/${action}`,
            {
              reason: values.reason,
              evidence: { reference: values.evidence },
              idempotencyKey: values.idempotencyKey,
            },
          );
          await refresh();
        },
      );
    });
    actions.append(button);
  };
  if (permissions.has('quality:inspect')) {
    if (state === 'OPEN') command('sample', '开始抽样');
    if (state === 'SAMPLED') command('complete', '完成检验');
    if (state === 'OPEN' || state === 'SAMPLED') command('cancel', '取消检验');
    if ((state === 'SAMPLED' || state === 'COMPLETED') && typeof inspection.id === 'string') {
      const result = el('button', 'secondary', '＋ 记录结果');
      result.addEventListener('click', () => {
        openForm(
          workspace,
          '记录检验结果',
          '结果按计划特性逐项保存；服务端会校验数据类型和必检项。',
          [
            { name: 'characteristicId', label: '特性编号', required: true },
            { name: 'measuredNumeric', label: '实测数值', type: 'number' },
            { name: 'passed', label: '通过（true/false）', required: true, value: 'true' },
            { name: 'notes', label: '备注', type: 'textarea' },
            { name: 'idempotencyKey', label: '幂等键', required: true },
          ],
          '保存结果',
          async (values) => {
            await controller.submit(
              `/api/v1/quality-inspections/${inspection.id as string}/results`,
              {
                characteristicId: values.characteristicId,
                measuredNumeric: values.measuredNumeric ?? undefined,
                passed: values.passed === 'true',
                notes: values.notes ?? '',
                occurredAt: new Date().toISOString(),
                idempotencyKey: values.idempotencyKey,
              },
            );
            await refresh();
          },
        );
      });
      actions.append(result);
    }
  }
  if (
    permissions.has('quality:disposition') &&
    (state === 'COMPLETED' || state === 'SAMPLED') &&
    typeof inspection.id === 'string'
  ) {
    for (const [action, label] of [
      ['release', '放行批次'],
      ['reject', '拒收批次'],
    ] as const) {
      const button = el('button', action === 'release' ? 'primary' : 'secondary', label);
      button.addEventListener('click', () => {
        openForm(
          workspace,
          label,
          '批次处置会同步更新质量状态和库存可用性，并追加追溯证据。',
          [
            { name: 'reason', label: '处置理由', type: 'textarea', required: true },
            { name: 'evidence', label: '证据编号', required: true },
            { name: 'idempotencyKey', label: '幂等键', required: true },
          ],
          `确认${label}`,
          async (values) => {
            await controller.submit(
              `/api/v1/quality-inspections/${inspection.id as string}/${action}`,
              {
                reason: values.reason,
                evidence: { reference: values.evidence },
                idempotencyKey: values.idempotencyKey,
              },
            );
            await refresh();
          },
        );
      });
      actions.append(button);
    }
  }
  if (actions.children.length) card.append(actions);
  return card;
}
