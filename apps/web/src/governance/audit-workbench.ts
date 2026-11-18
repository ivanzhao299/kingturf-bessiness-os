import { el } from '../dom';
import { recordValue, textValue } from '../shared/business-format';
import { governanceTable } from './presentation';

type AuditPage = Readonly<{ items: readonly unknown[]; nextCursor: string | null }>;
type AuditPageLoader = (params: Readonly<Record<string, string | undefined>>) => Promise<AuditPage>;
const EXPORT_ROW_CAP = 10_000;

const csvText = (value: unknown): string => `"${textValue(value, '').replaceAll('"', '""')}"`;

const auditRows = (page: AuditPage) => page.items.map(recordValue);

const toCsv = (rows: readonly Record<string, unknown>[], truncated: boolean): string => {
  const lines = [
    '时间,结果,操作,人员,对象类型,对象编号,关联编号',
    ...rows.map((item) =>
      [
        item.occurredAt,
        item.outcome,
        item.action,
        item.actorId,
        item.targetType,
        item.targetId,
        item.correlationId,
      ]
        .map(csvText)
        .join(','),
    ),
  ];
  if (truncated) lines.push(`# 导出上限 ${String(EXPORT_ROW_CAP)} 条，已截断`);
  return lines.join('\n');
};

const downloadCsv = (csv: string): void => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `系统审计日志-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// B2（TD-WEB-013）：审计工作台改为服务端过滤（query/outcome）+ cursor 分页；
// 「导出当前日志」按当前筛选参数循环拉取全部页（上限 10000 条），导出即筛选结果（修复原全量导出 bug）。
export function auditWorkbench(initial: AuditPage, load: AuditPageLoader): HTMLElement {
  const container = el('div', 'audit-log-workbench');
  const tools = el('div', 'audit-log-tools');
  const query = document.createElement('input');
  query.type = 'search';
  query.placeholder = '搜索操作、对象类型、人员或关联编号';
  query.setAttribute('aria-label', '搜索系统日志');
  const outcome = document.createElement('select');
  outcome.setAttribute('aria-label', '日志结果');
  for (const [value, label] of [
    ['', '全部结果'],
    ['SUCCESS', '成功'],
    ['FAILURE', '失败'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    outcome.append(option);
  }
  const result = el('div', 'audit-log-results');
  let page = initial;
  const filters = () => ({
    ...(query.value.trim() ? { query: query.value.trim() } : {}),
    ...(outcome.value ? { outcome: outcome.value } : {}),
  });
  const render = () => {
    const rows = auditRows(page);
    result.replaceChildren(governanceTable(rows, { preview: false }));
    const footer = el('div', 'governance-list-footer');
    footer.append(el('span', 'table-footnote', `筛选结果已加载 ${String(rows.length)} 条`));
    if (page.nextCursor !== null) {
      const more = el('button', 'secondary compact', '继续加载');
      more.type = 'button';
      more.addEventListener('click', () => {
        more.disabled = true;
        more.textContent = '加载中…';
        const cursor = page.nextCursor ?? undefined;
        void load({ ...filters(), ...(cursor ? { cursor } : {}) })
          .then((fetched) => {
            page = { items: [...page.items, ...fetched.items], nextCursor: fetched.nextCursor };
            render();
          })
          .catch(() => {
            more.disabled = false;
            more.textContent = '继续加载';
          });
      });
      footer.append(more);
    }
    result.append(footer);
  };
  const reload = () => {
    void load(filters())
      .then((fetched) => {
        page = fetched;
        render();
      })
      .catch(() => {
        /* 保留当前页；下一次筛选重试 */
      });
  };
  query.addEventListener('input', reload);
  outcome.addEventListener('change', reload);
  const exportButton = el('button', 'secondary compact', '导出当前日志');
  exportButton.addEventListener('click', () => {
    exportButton.disabled = true;
    exportButton.textContent = '导出中…';
    void (async () => {
      const rows: Record<string, unknown>[] = auditRows(page);
      let cursor = page.nextCursor;
      let truncated = false;
      while (cursor !== null) {
        const fetched = await load({ ...filters(), ...(cursor ? { cursor } : {}) });
        rows.push(...auditRows(fetched));
        cursor = fetched.nextCursor;
        if (rows.length >= EXPORT_ROW_CAP) {
          truncated = true;
          break;
        }
      }
      const capped = rows.slice(0, EXPORT_ROW_CAP);
      downloadCsv(toCsv(capped, truncated));
    })()
      .catch(() => {
        /* 失败保留已加载页，可重试导出 */
      })
      .finally(() => {
        exportButton.disabled = false;
        exportButton.textContent = '导出当前日志';
      });
  });
  tools.append(query, outcome, exportButton);
  container.append(tools, result);
  render();
  return container;
}
