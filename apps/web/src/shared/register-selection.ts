import { el } from '../dom';
import type { RegisterContext, RegisterBindings } from './register-types';

export function bindRegisterSelection(
  context: RegisterContext,
  bindings: Pick<
    RegisterBindings,
    | 'applySearch'
    | 'recordName'
    | 'updateSelection'
    | 'openDetailDrawer'
    | 'recordStatus'
    | 'showDrawer'
    | 'updateFieldMode'
  >,
) {
  const { sourceItems, profile, selectAll, pageSize, list, registerState } = context;
  const {
    search,
    statusFilter,
    attentionFilter,
    dateFrom,
    dateTo,
    amountFrom,
    amountTo,
    inspect,
    bulkInspect,
    sort,
    density,
    fieldMode,
  } = context.controls;
  const {
    applySearch,
    recordName,
    updateSelection,
    openDetailDrawer,
    recordStatus,
    showDrawer,
    updateFieldMode,
  } = bindings;
  search.addEventListener('input', applySearch);
  statusFilter.addEventListener('change', applySearch);
  attentionFilter.addEventListener('change', applySearch);
  dateFrom.addEventListener('change', applySearch);
  dateTo.addEventListener('change', applySearch);
  amountFrom.addEventListener('input', applySearch);
  amountTo.addEventListener('input', applySearch);
  for (const item of sourceItems) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'record-select';
    checkbox.setAttribute('aria-label', `选择 ${recordName(item)}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) registerState.selectedItems.add(item);
      else registerState.selectedItems.delete(item);
      item.classList.toggle('is-bulk-selected', checkbox.checked);
      updateSelection();
    });
    item.prepend(checkbox);
    const selectItem = () => {
      registerState.selectedItem?.classList.remove('is-selected');
      registerState.selectedItem = item;
      item.classList.add('is-selected');
      inspect.disabled = false;
    };
    item.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, select, textarea, a')) return;
      selectItem();
    });
    item.addEventListener('dblclick', () => {
      selectItem();
      openDetailDrawer(item, profile);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.target !== item) return;
      selectItem();
      openDetailDrawer(item, profile);
    });
  }
  selectAll.addEventListener('change', () => {
    const visible = registerState.filteredItems.slice(
      (registerState.page - 1) * pageSize,
      registerState.page * pageSize,
    );
    for (const item of visible) {
      const checkbox = item.querySelector<HTMLInputElement>('.record-select');
      if (selectAll.checked) registerState.selectedItems.add(item);
      else registerState.selectedItems.delete(item);
      if (checkbox) checkbox.checked = selectAll.checked;
      item.classList.toggle('is-bulk-selected', selectAll.checked);
    }
    updateSelection();
  });
  inspect.addEventListener('click', () => {
    if (registerState.selectedItem) openDetailDrawer(registerState.selectedItem, profile);
  });
  bulkInspect.addEventListener('click', () => {
    const body = el('div', 'bulk-summary');
    body.append(el('p', 'record-detail-note', '批量摘要仅用于核对，不会执行任何业务写操作。'));
    const listSummary = el('ul', 'bulk-summary-list');
    for (const item of registerState.selectedItems) {
      const row = el('li');
      row.append(
        el('strong', '', recordName(item)),
        el('span', '', recordStatus(item) || '状态未标记'),
      );
      listSummary.append(row);
    }
    body.append(listSummary);
    showDrawer(profile, `已选 ${String(registerState.selectedItems.size)} 条记录`, body);
  });
  sort.addEventListener('change', () => {
    registerState.sortMode =
      sort.value === 'name' || sort.value === 'status' ? sort.value : 'business';
    applySearch();
  });
  density.addEventListener('click', () => {
    registerState.compact = !registerState.compact;
    list.classList.toggle('is-compact', registerState.compact);
    density.textContent = registerState.compact ? '标准显示' : '紧凑显示';
  });
  fieldMode.addEventListener('change', () => {
    registerState.fields = fieldMode.value === 'key' ? 'key' : 'complete';
    updateFieldMode();
  });
}
