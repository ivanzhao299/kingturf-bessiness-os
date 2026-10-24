import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

function createRiskCard(
  context: FinanceRiskViewContext,
  evaluation: Record<string, unknown>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel, riskRuleLabel } = context.ports;
  const task = recordValue(evaluation.task);
  const findings = Array.isArray(evaluation.findings) ? evaluation.findings.map(recordValue) : [];
  const events = Array.isArray(evaluation.taskEvents) ? evaluation.taskEvents.map(recordValue) : [];
  const card = el('article', 'qtc-card risk-card');
  card.append(
    el('p', 'eyebrow', recordText(evaluation, 'orderNumber', 'orderNumber', 'ORDER')),
    el(
      'strong',
      '',
      `${businessStateLabel(recordText(evaluation, 'severity', 'severity'))}风险 · ${recordText(evaluation, 'score', 'score')} 分`,
    ),
    el(
      'span',
      `ctr-state state-${recordText(task, 'effective_state', 'effective_state', 'LOW').toLocaleLowerCase()}`,
      businessStateLabel(
        recordText(task, 'effective_state', 'effective_state', '无需任务'),
        '无需任务',
      ),
    ),
    el(
      'p',
      'qtc-metrics',
      findings.length
        ? findings
            .map(
              (finding) =>
                `${riskRuleLabel(finding.code)}：实际 ${recordText(finding, 'actual', 'amount', '—')} / 门槛 ${recordText(finding, 'threshold', 'graceDays', '—')}`,
            )
            .join('；')
        : '未命中风险规则',
    ),
  );
  const timeline = el('ol', 'risk-task-timeline');
  for (const event of events)
    timeline.append(
      el(
        'li',
        '',
        `${recordText(event, 'sequence', 'sequence')} · ${businessStateLabel(recordText(event, 'state', 'state'))} · ${recordText(event, 'reason', 'reason')}`,
      ),
    );
  card.append(timeline);
  const taskState = recordText(task, 'effective_state', 'effective_state');
  if (permissions.has('risk:manage') && typeof task.id === 'string' && taskState !== 'CLOSED') {
    const commands =
      taskState === 'OPEN'
        ? ([
            ['acknowledge', '确认'],
            ['escalate', '升级'],
            ['close', '关闭'],
          ] as const)
        : taskState === 'ACKNOWLEDGED'
          ? ([
              ['escalate', '升级'],
              ['close', '关闭'],
            ] as const)
          : ([['close', '关闭']] as const);
    for (const [action, label] of commands) {
      const command = el('button', 'secondary', label);
      command.addEventListener('click', () => {
        openForm(
          workspace,
          `${label}风险任务`,
          '本操作只追加任务事件；关闭必须提供可追溯证据编号。',
          [
            { name: 'reason', label: '处理理由', type: 'textarea', required: true },
            { name: 'evidence', label: '证据编号', required: true },
          ],
          '追加任务事件',
          async (values) => {
            await controller.submit(`/api/v1/risk-tasks/${task.id as string}/${action}`, {
              reason: values.reason ?? '',
              evidence: { reference: values.evidence ?? '' },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      card.append(command);
    }
  }
  return card;
}

export function appendRiskView(
  context: FinanceRiskViewContext,
  riskPolicyControls: HTMLElement | null,
): void {
  const { workspace, controller } = context;
  const { recordText, recordValue } = context.ports;
  const panel = el('section', 'qtc-workbench risk-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(
    el('p', 'eyebrow', '风险评估'),
    el('h2', '', '风险评价与责任任务'),
    el('p', '', '风险评价、责任任务与处置记录'),
  );
  heading.append(copy);
  panel.append(heading);
  if (riskPolicyControls) panel.append(riskPolicyControls);
  const riskPriority: Readonly<Record<string, number>> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const evaluations = [...(controller.views.get('/api/v1/risk-evaluations') ?? [])].sort(
    (left, right) =>
      (riskPriority[recordText(left, 'severity', 'severity')] ?? 9) -
      (riskPriority[recordText(right, 'severity', 'severity')] ?? 9),
  );
  if (evaluations.length) {
    const openTasks = evaluations.filter((item) => {
      const task = recordValue(item.task);
      return (
        Boolean(task.id) && recordText(task, 'effective_state', 'effective_state') !== 'CLOSED'
      );
    }).length;
    const highRisk = evaluations.filter((item) =>
      ['CRITICAL', 'HIGH'].includes(recordText(item, 'severity', 'severity')),
    ).length;
    const summary = el('div', 'workbench-summary-grid');
    summary.append(
      el('div', 'summary-card', `高风险评价\n${String(highRisk)} 项`),
      el('div', 'summary-card', `未关闭责任任务\n${String(openTasks)} 项`),
      el('div', 'summary-card', `全部评价\n${String(evaluations.length)} 项`),
    );
    panel.append(summary);
  }
  const list = el('div', 'risk-list');
  for (const evaluation of evaluations) {
    const card = createRiskCard(context, evaluation);
    list.append(card);
  }
  if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无风险评价。'));
  panel.append(list);
  workspace.append(panel);
}
