import { signal } from '@preact/signals';
import { SummaryCards, type SummaryCardItem } from '@kingturf/ui';
import { h, render } from 'preact';
import { el } from '../dom';

const refreshByPanel = new WeakMap<Element, () => void>();

// TD-WEB-018：路由补载可能分别保留旧概览和新宿主，或保留旧宿主和新概览。
// 在重算时查找工作区保留的面板，避免把数据写入已移除的候选面板。
export function refreshWorkspaceOverview(workspace: HTMLElement, panelClass: string): void {
  const panel = Array.from(workspace.children).find((child) =>
    child.classList.contains(panelClass),
  );
  if (panel) refreshByPanel.get(panel)?.();
}

export function appendOverviewCards<T>(
  target: HTMLElement,
  read: () => T,
  itemsOf: (snapshot: T) => readonly SummaryCardItem[],
  label: string,
  testId: string,
): () => void {
  const snapshot = signal(read());
  const host = el('div');
  const Cards = () =>
    h(SummaryCards, {
      label,
      items: itemsOf(snapshot.value),
      testId,
      itemTestId: (id) => `${testId}-${id}`,
    });
  target.append(host);
  render(h(Cards, null), host);
  const refresh = () => {
    snapshot.value = read();
  };
  refreshByPanel.set(target, refresh);
  return refresh;
}
