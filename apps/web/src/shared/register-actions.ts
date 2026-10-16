import type { RegisterContext, RegisterBindings } from './register-types';

export function bindRegisterActions(
  context: RegisterContext,
  bindings: Pick<
    RegisterBindings,
    'recordName' | 'recordStatus' | 'renderItems' | 'updateFieldMode' | 'applySearch'
  >,
) {
  const { viewKey, profile, sourceItems, list, registerState } = context;
  const {
    saveView,
    search,
    statusFilter,
    attentionFilter,
    dateFrom,
    dateTo,
    amountFrom,
    amountTo,
    exportList,
    exportSelected,
    previous,
    next,
    reset,
    sort,
    density,
  } = context.controls;
  const { recordName, recordStatus, renderItems, updateFieldMode, applySearch } = bindings;
  saveView.addEventListener('click', () => {
    try {
      globalThis.localStorage.setItem(
        viewKey,
        JSON.stringify({
          query: search.value,
          status: statusFilter.value,
          attention: attentionFilter.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          amountFrom: amountFrom.value,
          amountTo: amountTo.value,
          sortMode: registerState.sortMode,
          compact: registerState.compact,
          fields: registerState.fields,
        }),
      );
      saveView.textContent = '视图已保存';
    } catch {
      saveView.textContent = '当前浏览器无法保存';
    }
  });
  const exportRows = (items: readonly HTMLElement[], suffix: string) => {
    const rows = items.map((item) => [
      recordName(item),
      recordStatus(item),
      item.textContent.replace(/\s+/gu, ' ').trim(),
    ]);
    const escapeCsv = (value: string) => `"${value.replace(/"/gu, '""')}"`;
    const csv = [['业务记录', '状态', '业务摘要'], ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
    link.download = `金特夫${profile.label}-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };
  exportList.addEventListener('click', () => {
    exportRows(registerState.filteredItems, '当前结果');
  });
  exportSelected.addEventListener('click', () => {
    exportRows([...registerState.selectedItems], '已选记录');
  });
  previous.addEventListener('click', () => {
    registerState.page -= 1;
    renderItems();
  });
  next.addEventListener('click', () => {
    registerState.page += 1;
    renderItems();
  });
  reset.addEventListener('click', () => {
    search.value = '';
    statusFilter.value = '';
    attentionFilter.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    amountFrom.value = '';
    amountTo.value = '';
    registerState.sortMode = 'business';
    sort.value = 'business';
    registerState.compact = false;
    registerState.fields = 'complete';
    registerState.selectedItems.clear();
    for (const item of sourceItems) {
      item.classList.remove('is-bulk-selected');
      const checkbox = item.querySelector<HTMLInputElement>('.record-select');
      if (checkbox) checkbox.checked = false;
    }
    list.classList.remove('is-compact');
    density.textContent = '紧凑显示';
    updateFieldMode();
    applySearch();
  });
}
