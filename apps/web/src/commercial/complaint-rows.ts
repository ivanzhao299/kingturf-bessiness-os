import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';
import { appendComplaintNcrAction } from './complaint-ncr';
import { runComplaintWorkflow } from './complaint-workflow';

export function createComplaintRow(
  context: OperationsViewContext,
  complaint: Record<string, unknown>,
  complaintPanel: HTMLElement,
  selected: Map<string, Record<string, unknown>>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordText, COMPLAINT_SEVERITY_LABELS, COMPLAINT_STATE_LABELS, requestId } =
    context.ports;
  const row = el('tr');
  const id = recordText(complaint, 'id', 'id');
  const state = recordText(complaint, 'state', 'state');
  const selectCell = el('td');
  if (
    state === 'REPORTED' &&
    permissions.has('complaint:triage') &&
    permissions.has('complaint:assign')
  ) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'record-select';
    checkbox.setAttribute(
      'aria-label',
      `选择投诉 ${recordText(complaint, 'complaintNumber', 'complaint_number')}`,
    );
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.set(id, complaint);
      else selected.delete(id);
      complaintPanel.dispatchEvent(new Event('change'));
    });
    selectCell.append(checkbox);
  } else selectCell.textContent = '—';
  const due = recordText(complaint, 'closureDueAt', 'closure_due_at');
  const assigneeId = recordText(complaint, 'assignedTo', 'assigned_to');
  const assignee = controller.employees.find((employee) => employee.id === assigneeId);
  const actionCell = el('td');
  const command = (action: 'investigate' | 'close', label: string, description: string) => {
    const button = el('button', action === 'close' ? 'primary' : 'secondary', label);
    button.addEventListener('click', () => {
      openForm(
        workspace,
        label,
        description,
        [
          { name: 'reason', label: '处理说明', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '证据编号', required: true },
        ],
        `确认${label}`,
        async (values) => {
          await controller.submit(`/api/v1/complaints/${id}/${action}`, {
            expectedVersion: complaint.version,
            reason: values.reason,
            evidence: { reference: values.evidenceReference },
            idempotencyKey: requestId(),
          });
          await refresh();
        },
      );
    });
    actionCell.append(button);
  };
  if (state === 'TRIAGED' && permissions.has('complaint:triage'))
    command('investigate', '开始调查', '确认责任人已接单，并填写启动调查的依据。');
  appendComplaintNcrAction(context, complaint, id, state, actionCell, refresh);
  if (['NCR_OPEN', 'CAPA_ACTIVE', 'VERIFIED'].includes(state) && controller.api.get) {
    const workflow = el('button', 'primary', '处理质量闭环');
    workflow.addEventListener('click', () => {
      void runComplaintWorkflow(context, complaint, id, command, refresh);
    });
    actionCell.append(workflow);
  }
  if (!actionCell.children.length) actionCell.textContent = '—';
  row.append(
    selectCell,
    el('td', '', recordText(complaint, 'complaintNumber', 'complaint_number')),
    el('td', '', recordText(complaint, 'customerName', 'customer_name')),
    el(
      'td',
      '',
      COMPLAINT_SEVERITY_LABELS[recordText(complaint, 'severity', 'severity')] ?? '未分级',
    ),
    el('td', '', COMPLAINT_STATE_LABELS[state] ?? '状态待确认'),
    el('td', '', assignee?.displayName ?? '待分派'),
    el(
      'td',
      recordText(complaint, 'overdue', 'overdue') === 'true' ? 'danger-note' : '',
      due ? new Date(due).toLocaleDateString('zh-CN') : '—',
    ),
    actionCell,
  );
  return row;
}
