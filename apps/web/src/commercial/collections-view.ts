import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';
import {
  appendCollectionFollowups,
  appendCollectionEscalations,
  appendCollectionLegalHandoff,
} from './collection-actions';

function appendCollectionHeading(
  context: FinanceRiskViewContext,
  receivables: readonly Record<string, unknown>[],
  heading: HTMLElement,
  copy: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText } = context.ports;
  if (permissions.has('collection:manage') && receivables.length && controller.employees.length) {
    const create = el('button', 'primary', '＋ 建立催收案件');
    create.addEventListener('click', () => {
      openForm(
        workspace,
        '建立逾期催收案件',
        '余额、币种和到期日由服务器重新核对；同一应收项目只能建立一个案件。',
        [
          { name: 'caseNumber', label: '案件编号', required: true },
          {
            name: 'arOpenItemId',
            label: '逾期应收',
            type: 'select',
            required: true,
            options: receivables.map((item) => ({
              value: textValue(item.id, ''),
              label: `${recordText(item, 'documentNumber', 'document_number')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'remainingAmount', 'remaining_amount')}`,
            })),
          },
          {
            name: 'assignedTo',
            label: '催收责任人',
            type: 'select',
            required: true,
            options: controller.employees.map((item) => ({
              value: item.id,
              label: item.displayName ?? item.employeeNumber ?? item.id,
            })),
          },
          {
            name: 'priority',
            label: '优先级',
            type: 'select',
            required: true,
            options: [
              { value: 'CRITICAL', label: '紧急' },
              { value: 'HIGH', label: '高' },
              { value: 'MEDIUM', label: '中' },
              { value: 'LOW', label: '低' },
            ],
          },
          { name: 'reason', label: '建案原因', type: 'textarea', required: true },
        ],
        '确认建案',
        async (values) => {
          await controller.submit('/api/v1/collection-cases', {
            caseNumber: values.caseNumber ?? '',
            arOpenItemId: values.arOpenItemId ?? '',
            assignedTo: values.assignedTo ?? '',
            priority: values.priority ?? 'HIGH',
            reason: values.reason ?? '',
            idempotencyKey: `COL-${Date.now().toString(36)}`,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, create);
  } else heading.append(copy);
}

function createCollectionCard(
  context: FinanceRiskViewContext,
  item: Record<string, unknown>,
): HTMLElement {
  const { permissions } = context;
  const { textValue, recordText, displayMoney, businessStateLabel } = context.ports;
  const caseId = textValue(item.id, '');
  const state = recordText(item, 'state', 'state');
  const promises = Array.isArray(item.promises)
    ? (item.promises as readonly Record<string, unknown>[])
    : [];
  const handoffs =
    permissions.has('legal-case:read') && Array.isArray(item.legalHandoffs)
      ? (item.legalHandoffs as readonly Record<string, unknown>[])
      : [];
  const card = el('article', 'qtc-card collection-case-card');
  card.append(
    el('p', 'eyebrow', recordText(item, 'caseNumber', 'case_number', 'COLLECTION')),
    el(
      'strong',
      '',
      `${recordText(item, 'customerName', 'customer_name', '客户')} · ${displayMoney(recordText(item, 'currency', 'currency'), recordText(item, 'remainingAmount', 'remaining_amount', '0'))}`,
    ),
    el(
      'p',
      'qtc-metrics',
      `${businessStateLabel(state)} · 逾期 ${recordText(item, 'overdueDays', 'overdue_days', '0')} 天 · ${recordText(item, 'documentNumber', 'document_number', '应收单据')}`,
    ),
  );
  const actions = el('div', 'inline-actions');
  appendCollectionFollowups(context, item, caseId, state, actions);
  appendCollectionEscalations(context, caseId, state, promises, actions);
  for (const handoff of handoffs) {
    appendCollectionLegalHandoff(context, handoff, actions);
  }
  if (actions.childElementCount) card.append(actions);
  for (const handoff of handoffs) {
    const packages = Array.isArray(handoff.packages)
      ? (handoff.packages as readonly Record<string, unknown>[])
      : [];
    for (const evidencePackage of packages)
      card.append(
        el(
          'p',
          'version-pin',
          `证据包 ${recordText(evidencePackage, 'packageNumber', 'package_number')} · ${businessStateLabel(recordText(evidencePackage, 'state', 'state'))} · ${recordText(evidencePackage, 'packageHash', 'package_hash').slice(0, 12)}`,
        ),
      );
  }
  return card;
}

export function appendCollectionsView(context: FinanceRiskViewContext): void {
  const { workspace, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'qtc-workbench collection-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '催收与法务证据'), el('p', '', '逾期催收、付款承诺与法务移交'));
  const receivables = (controller.views.get('/api/v1/ar-open-items') ?? []).filter(
    (item) =>
      Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0 &&
      Date.parse(recordText(item, 'dueAt', 'due_at')) < Date.now(),
  );
  appendCollectionHeading(context, receivables, heading, copy);
  panel.append(heading);
  const cases = controller.views.get('/api/v1/collection-cases') ?? [];
  const list = el('div', 'qtc-list collection-case-list');
  for (const item of cases) {
    const card = createCollectionCard(context, item);
    list.append(card);
  }
  if (!list.childElementCount)
    list.append(el('p', 'pipeline-empty', '暂无催收案件；逾期应收可从这里建立闭环。'));
  panel.append(list);
  workspace.append(panel);
}
