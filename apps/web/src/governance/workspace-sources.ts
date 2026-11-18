import { el } from '../dom';
import { governanceItems, governancePage, governanceTable } from './presentation';
import { GOVERNANCE_SOURCE_LABELS } from './presentation';
import { auditWorkbench } from './audit-workbench';
import { createGovernanceListView } from './list-view';
import type { GovernanceActionContext } from './workspace-types';

export function appendGovernanceSources(
  context: GovernanceActionContext,
  options: Readonly<{ full?: boolean }> = {},
) {
  const { surface, views, panel, controller } = context;
  for (const path of surface.paths) {
    const view = views.find((item) => item.path === path);
    const row = el('details', 'governance-source');
    const page = governancePage(view?.value);
    const items = view ? page.items : [];
    const sourceLabel = GOVERNANCE_SOURCE_LABELS[path] ?? '业务数据';
    const source = el(
      'summary',
      '',
      view?.error ? `${sourceLabel} · 读取失败` : `${sourceLabel} · ${String(items.length)} 条`,
    );
    row.append(source);
    if (view?.error) row.append(el('p', 'error', view.error));
    else if (items.length === 0 && page.nextCursor === null)
      row.append(el('p', 'empty', '当前范围内暂无记录'));
    else if (options.full && path === '/api/v1/audit-events')
      row.append(
        auditWorkbench(page, (params) =>
          controller.fetchPage<{ items: readonly unknown[]; nextCursor: string | null }>(
            '/api/v1/audit-events',
            Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)),
          ),
        ),
      );
    else if (options.full) row.append(createGovernanceListView(controller, path, view?.value));
    else row.append(governanceTable(governanceItems(view?.value)));
    panel.append(row);
  }
}
