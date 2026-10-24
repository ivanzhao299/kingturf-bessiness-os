import { el } from '../dom';
import { governanceItems } from './presentation';
import { GOVERNANCE_SOURCE_LABELS } from './presentation';
import { governanceTable } from './presentation';
import { auditLogWorkbench } from './audit-workbench';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceSources(context: GovernanceActionContext) {
  const { surface, views, panel } = context;
  for (const path of surface.paths) {
    const view = views.find((item) => item.path === path);
    const row = el('details', 'governance-source');
    const items = view ? governanceItems(view.value) : [];
    const sourceLabel = GOVERNANCE_SOURCE_LABELS[path] ?? '业务数据';
    const source = el(
      'summary',
      '',
      view?.error ? `${sourceLabel} · 读取失败` : `${sourceLabel} · ${String(items.length)} 条`,
    );
    row.append(source);
    if (view?.error) row.append(el('p', 'error', view.error));
    else if (items.length === 0) row.append(el('p', 'empty', '当前范围内暂无记录'));
    else
      row.append(
        path === '/api/v1/audit-events' ? auditLogWorkbench(items) : governanceTable(items),
      );
    panel.append(row);
  }
}
