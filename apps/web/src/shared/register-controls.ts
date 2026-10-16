import { el } from '../dom';
import type { RegisterProfile } from './register-profile';

export function createRegisterControls(profile: RegisterProfile, sourceItems: HTMLElement[]) {
  const header = el('div', 'record-register-head');
  header.setAttribute('role', 'row');
  for (const label of profile.headers) {
    const column = el('span', '', label);
    column.setAttribute('role', 'columnheader');
    header.append(column);
  }
  const tools = el('div', 'workspace-list-tools');
  const search = el('input', 'filter-search');
  search.type = 'search';
  search.placeholder = '在当前列表中搜索';
  search.setAttribute('aria-label', '在当前业务列表中搜索');
  const statuses = Array.from(
    new Set(
      sourceItems.flatMap((item) =>
        Array.from(item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'))
          .map((entry) => entry.textContent.trim())
          .filter(Boolean),
      ),
    ),
  );
  const statusFilter = el('select', 'filter-select register-status-filter');
  statusFilter.setAttribute('aria-label', '按业务状态筛选');
  const allStatuses = el('option', '', '全部状态');
  allStatuses.value = '';
  statusFilter.append(allStatuses);
  for (const status of statuses) {
    const option = el('option', '', status);
    option.value = status;
    statusFilter.append(option);
  }
  const attentionFilter = el('select', 'filter-select register-attention-filter');
  attentionFilter.setAttribute('aria-label', `筛选${profile.label}关注程度`);
  for (const [value, label] of [
    ['', '全部记录'],
    ['attention', '只看需关注'],
    ['actionable', '只看可操作'],
  ] as const) {
    const option = el('option', '', label);
    option.value = value;
    attentionFilter.append(option);
  }
  const dateFrom = el('input', 'filter-search register-range-filter');
  dateFrom.type = 'date';
  dateFrom.setAttribute('aria-label', `${profile.label}开始日期`);
  dateFrom.title = '开始日期';
  const dateTo = el('input', 'filter-search register-range-filter');
  dateTo.type = 'date';
  dateTo.setAttribute('aria-label', `${profile.label}结束日期`);
  dateTo.title = '结束日期';
  const amountFrom = el('input', 'filter-search register-range-filter');
  amountFrom.type = 'number';
  amountFrom.min = '0';
  amountFrom.step = '0.01';
  amountFrom.placeholder = '最低金额';
  amountFrom.setAttribute('aria-label', `${profile.label}最低金额`);
  const amountTo = el('input', 'filter-search register-range-filter');
  amountTo.type = 'number';
  amountTo.min = '0';
  amountTo.step = '0.01';
  amountTo.placeholder = '最高金额';
  amountTo.setAttribute('aria-label', `${profile.label}最高金额`);
  const count = el('span', 'workspace-list-count', `共 ${String(sourceItems.length)} 条`);
  const sort = el('select', 'filter-select register-sort');
  sort.setAttribute('aria-label', `设置${profile.label}排序方式`);
  for (const [value, label] of [
    ['business', '业务优先'],
    ['name', '按名称排序'],
    ['status', '按状态排序'],
  ] as const) {
    const option = el('option', '', label);
    option.value = value;
    sort.append(option);
  }
  const density = el('button', 'secondary compact-action', '紧凑显示');
  density.type = 'button';
  const fieldMode = el('select', 'filter-select register-field-mode');
  fieldMode.setAttribute('aria-label', `设置${profile.label}字段显示范围`);
  for (const [value, label] of [
    ['complete', '完整字段'],
    ['key', '重点字段'],
  ] as const) {
    const option = el('option', '', label);
    option.value = value;
    fieldMode.append(option);
  }
  const saveView = el('button', 'secondary compact-action', '保存视图');
  saveView.type = 'button';
  const exportList = el('button', 'secondary compact-action', '导出当前结果');
  exportList.type = 'button';
  const inspect = el('button', 'secondary compact-action', '查看选中详情');
  inspect.type = 'button';
  inspect.disabled = true;
  const selectedCount = el('span', 'workspace-list-count register-selection-count', '已选 0 条');
  const bulkInspect = el('button', 'secondary compact-action', '查看批量摘要');
  bulkInspect.type = 'button';
  bulkInspect.disabled = true;
  const exportSelected = el('button', 'secondary compact-action', '导出已选');
  exportSelected.type = 'button';
  exportSelected.disabled = true;
  const reset = el('button', 'secondary compact-action', '重置');
  reset.type = 'button';
  const pager = el('div', 'record-register-pager');
  const previous = el('button', 'secondary compact-action', '上一页');
  previous.type = 'button';
  const pageState = el('span', 'workspace-list-count');
  const next = el('button', 'secondary compact-action', '下一页');
  next.type = 'button';
  pager.append(previous, pageState, next);
  return {
    header,
    tools,
    search,
    statuses,
    statusFilter,
    attentionFilter,
    dateFrom,
    dateTo,
    amountFrom,
    amountTo,
    count,
    sort,
    density,
    fieldMode,
    saveView,
    exportList,
    inspect,
    selectedCount,
    bulkInspect,
    exportSelected,
    reset,
    pager,
    previous,
    pageState,
    next,
  };
}

export type RegisterControls = ReturnType<typeof createRegisterControls>;
