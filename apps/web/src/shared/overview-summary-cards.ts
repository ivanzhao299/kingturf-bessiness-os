import { signal } from '@preact/signals';
import { SummaryCards, type SummaryCardItem } from '@kingturf/ui';
import { h, render } from 'preact';
import { el } from '../dom';

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
  return () => {
    snapshot.value = read();
  };
}
