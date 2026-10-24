import type { RegisterContext } from './register-types';

export function createRegisterRendering(context: RegisterContext) {
  const { list, sourceItems, pageSize, selectAll, registerState } = context;
  const {
    fieldMode,
    selectedCount,
    bulkInspect,
    exportSelected,
    header,
    count,
    pageState,
    previous,
    next,
    pager,
  } = context.controls;
  const updateFieldMode = () => {
    list.classList.toggle('is-key-fields', registerState.fields === 'key');
    for (const item of sourceItems) {
      const details = Array.from(item.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          !child.matches(
            '.record-select, button, .quality-actions, .ctr-actions, .status-badge, .ctr-state, .version-pin, .order-360-detail, [role="status"]',
          ),
      );
      details.forEach((child, index) => {
        child.classList.toggle('register-optional-field', index >= 3);
      });
    }
    fieldMode.value = registerState.fields;
  };
  const updateSelection = () => {
    selectedCount.textContent = `已选 ${String(registerState.selectedItems.size)} 条`;
    bulkInspect.disabled = registerState.selectedItems.size === 0;
    exportSelected.disabled = registerState.selectedItems.size === 0;
    const visible = registerState.filteredItems.slice(
      (registerState.page - 1) * pageSize,
      registerState.page * pageSize,
    );
    selectAll.checked =
      visible.length > 0 && visible.every((item) => registerState.selectedItems.has(item));
    selectAll.indeterminate =
      visible.some((item) => registerState.selectedItems.has(item)) && !selectAll.checked;
  };
  const renderItems = () => {
    const pageCount = Math.max(1, Math.ceil(registerState.filteredItems.length / pageSize));
    registerState.page = Math.min(Math.max(registerState.page, 1), pageCount);
    const start = (registerState.page - 1) * pageSize;
    list.replaceChildren(header, ...registerState.filteredItems.slice(start, start + pageSize));
    count.textContent = `显示 ${String(registerState.filteredItems.length)} / ${String(sourceItems.length)} 条`;
    pageState.textContent = `第 ${String(registerState.page)} / ${String(pageCount)} 页`;
    previous.disabled = registerState.page <= 1;
    next.disabled = registerState.page >= pageCount;
    pager.hidden = registerState.filteredItems.length <= pageSize;
    updateSelection();
  };
  return { updateFieldMode, updateSelection, renderItems };
}
