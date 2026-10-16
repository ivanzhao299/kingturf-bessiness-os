import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { appendComplaintActions } from './complaint-actions';
import { createComplaintRow } from './complaint-rows';

export function appendComplaints(
  context: OperationsViewContext,
  panel: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { controller, permissions } = context;
  if (permissions.has('complaint:read')) {
    const complaints = controller.views.get('/api/v1/complaints') ?? [];
    const slaPolicies = controller.views.get('/api/v1/complaint-sla-policies') ?? [];
    const complaintPanel = el('article', 'quality-section complaint-ledger');
    const complaintHead = el('div', 'panel-head');
    complaintHead.append(el('h3', '', '客户投诉与整改闭环'));
    const selected = new Map<string, Record<string, unknown>>();
    appendComplaintActions(context, complaintHead, complaintPanel, selected, slaPolicies, refresh);
    const tableWrap = el('div', 'governance-table-wrap complaint-table-wrap');
    const table = el('table', 'governance-table complaint-table');
    const head = el('thead');
    const headRow = el('tr');
    for (const label of ['选择', '投诉单号', '客户', '等级', '状态', '负责人', '关闭期限', '操作'])
      headRow.append(el('th', '', label));
    head.append(headRow);
    const body = el('tbody');
    for (const complaint of complaints) {
      const row = createComplaintRow(context, complaint, complaintPanel, selected, refresh);
      body.append(row);
    }
    table.append(head, body);
    tableWrap.append(table);
    complaintPanel.append(tableWrap);
    if (!complaints.length)
      complaintPanel.append(el('p', 'pipeline-empty', '当前没有可见的客户投诉。'));
    panel.append(complaintPanel);
  }
}
