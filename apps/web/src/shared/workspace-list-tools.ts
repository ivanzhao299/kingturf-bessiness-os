import { registerProfile } from './register-profile';
import { createRegisterDrawer } from './register-drawer';
import { createRegisterControls } from './register-controls';
import { createRegisterReaders } from './register-readers';
import { createRegisterRendering } from './register-rendering';
import { createRegisterSearch } from './register-search';
import { bindRegisterSelection } from './register-selection';
import { bindRegisterActions } from './register-actions';
import { installSavedRegisterView } from './register-saved-view';
import type { RegisterState } from './register-types';

export function installWorkspaceListTools(shell: HTMLElement): void {
  const drawer = createRegisterDrawer(shell);
  const selectors = [
    '.solution-list',
    '.decision-list',
    '.quote-list',
    '.qtc-list',
    '.order-360-list',
    '.risk-list',
    '.production-order-grid',
    '.mrp-proposal-grid',
    '.shipment-grid',
  ].join(',');
  for (const list of Array.from(shell.querySelectorAll<HTMLElement>(selectors))) {
    const sourceItems = Array.from(list.children).filter(
      (item): item is HTMLElement => item instanceof HTMLElement,
    );
    if (
      sourceItems.length === 0 ||
      sourceItems.every((item) => item.classList.contains('pipeline-empty')) ||
      list.dataset.listTools === 'true' ||
      !list.parentElement
    )
      continue;
    list.dataset.listTools = 'true';
    const profile = registerProfile(list);
    list.dataset.registerProfile = profile.label;
    list.classList.add('record-register');
    list.setAttribute('role', 'table');
    list.setAttribute('aria-label', profile.label);
    list.setAttribute('aria-rowcount', String(sourceItems.length));
    for (const item of sourceItems) {
      item.setAttribute('role', 'row');
      item.tabIndex = 0;
    }
    const controls = createRegisterControls(profile, sourceItems);
    const { header } = controls;
    const pageSize = 10;
    const viewKey = `kingturf.register-view.${list.classList.item(0) ?? 'records'}`;
    const registerState: RegisterState = {
      page: 1,
      filteredItems: [...sourceItems],
      sortMode: 'business',
      compact: false,
      fields: 'complete',
      selectedItem: undefined,
      selectedItems: new Set<HTMLElement>(),
    };
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.className = 'record-select record-select-all';
    selectAll.setAttribute('aria-label', `全选当前${profile.label}结果`);
    header.prepend(selectAll);
    const context = {
      list: list as HTMLElement & { parentElement: HTMLElement },
      sourceItems,
      profile,
      controls,
      pageSize,
      viewKey,
      selectAll,
      registerState,
    };
    const readers = createRegisterReaders();
    const rendering = createRegisterRendering(context);
    const applySearch = createRegisterSearch(context, { ...readers, ...rendering });
    const bindings = { ...readers, ...rendering, applySearch, ...drawer };
    bindRegisterSelection(context, bindings);
    bindRegisterActions(context, bindings);
    installSavedRegisterView(context);
    rendering.updateFieldMode();
    applySearch();
  }
}
