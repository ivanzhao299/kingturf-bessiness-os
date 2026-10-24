import { el } from '../dom';
import type { RegisterContext } from './register-types';
import { parseStoredRegisterView } from './register-view-parser';

export function installSavedRegisterView(context: RegisterContext) {
  const { list, viewKey, registerState } = context;
  const {
    dateFrom,
    dateTo,
    amountFrom,
    amountTo,
    selectedCount,
    sort,
    density,
    fieldMode,
    inspect,
    bulkInspect,
    saveView,
    exportList,
    exportSelected,
    reset,
    tools,
    search,
    statusFilter,
    attentionFilter,
    count,
    pager,
    statuses,
  } = context.controls;
  const advanced = document.createElement('details');
  advanced.className = 'workspace-list-advanced';
  const advancedSummary = el('summary', '', '更多筛选与列表操作');
  const updateAdvancedSummary = () => {
    advancedSummary.textContent =
      dateFrom.value || dateTo.value || amountFrom.value || amountTo.value
        ? '更多筛选与列表操作 · 已启用范围筛选'
        : '更多筛选与列表操作';
  };
  advanced.addEventListener('input', updateAdvancedSummary);
  advanced.addEventListener('toggle', updateAdvancedSummary);
  advanced.append(advancedSummary);
  const advancedControls = el('div', 'workspace-list-advanced-controls');
  advancedControls.append(
    dateFrom,
    dateTo,
    amountFrom,
    amountTo,
    selectedCount,
    sort,
    density,
    fieldMode,
    inspect,
    bulkInspect,
    saveView,
    exportList,
    exportSelected,
    reset,
  );
  advanced.append(advancedControls);
  tools.append(search, statusFilter, attentionFilter, count, advanced);
  list.parentElement.insertBefore(tools, list);
  list.parentElement.insertBefore(pager, list.nextSibling);
  try {
    const stored = globalThis.localStorage.getItem(viewKey);
    const view = parseStoredRegisterView(stored);
    search.value = typeof view?.query === 'string' ? view.query : '';
    statusFilter.value =
      typeof view?.status === 'string' && statuses.includes(view.status) ? view.status : '';
    attentionFilter.value =
      view?.attention === 'attention' || view?.attention === 'actionable' ? view.attention : '';
    dateFrom.value = typeof view?.dateFrom === 'string' ? view.dateFrom : '';
    dateTo.value = typeof view?.dateTo === 'string' ? view.dateTo : '';
    amountFrom.value = typeof view?.amountFrom === 'string' ? view.amountFrom : '';
    amountTo.value = typeof view?.amountTo === 'string' ? view.amountTo : '';
    advanced.open = Boolean(dateFrom.value || dateTo.value || amountFrom.value || amountTo.value);
    registerState.sortMode =
      view?.sortMode === 'name' || view?.sortMode === 'status' ? view.sortMode : 'business';
    sort.value = registerState.sortMode;
    registerState.compact = view?.compact === true;
    registerState.fields = view?.fields === 'key' ? 'key' : 'complete';
    list.classList.toggle('is-compact', registerState.compact);
    density.textContent = registerState.compact ? '标准显示' : '紧凑显示';
  } catch {
    // A corrupt or unavailable local view must never block the operational register.
  }
}
