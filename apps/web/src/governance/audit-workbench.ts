import { el } from '../dom';
import { recordValue, textValue } from '../shared/business-format';
import { governanceTable } from './presentation';
export const auditLogWorkbench = (items: readonly unknown[]): HTMLElement => {
  const container = el('div', 'audit-log-workbench');
  const tools = el('div', 'audit-log-tools');
  const query = document.createElement('input');
  query.type = 'search';
  query.placeholder = '搜索人员、操作、对象或关联编号';
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
  const render = () => {
    const keyword = query.value.trim().toLocaleLowerCase();
    const filtered = items.map(recordValue).filter((item) => {
      if (outcome.value && textValue(item.outcome, '') !== outcome.value) return false;
      if (!keyword) return true;
      return [item.action, item.actorId, item.targetType, item.targetId, item.correlationId]
        .map((value) => textValue(value, '').toLocaleLowerCase())
        .some((value) => value.includes(keyword));
    });
    result.replaceChildren(governanceTable(filtered));
    result.prepend(el('p', 'table-footnote', `筛选结果 ${String(filtered.length)} 条`));
  };
  query.addEventListener('input', render);
  outcome.addEventListener('change', render);
  const exportButton = el('button', 'secondary compact', '导出当前日志');
  exportButton.addEventListener('click', () => {
    const rows = items.map(recordValue);
    const escape = (value: unknown) => `"${textValue(value, '').replaceAll('"', '""')}"`;
    const csv = [
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
          .map(escape)
          .join(','),
      ),
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `系统审计日志-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  tools.append(query, outcome, exportButton);
  container.append(tools, result);
  render();
  return container;
};
