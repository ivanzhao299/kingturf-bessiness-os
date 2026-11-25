import { h, render } from 'preact';
import { SummaryCards, type SummaryCardItem } from '@kingturf/ui';
import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';

type Rows = readonly Record<string, unknown>[];
type RecordText = OperationsViewContext['ports']['recordText'];

export type ManufacturingSummaryInput = Readonly<{
  items: Rows;
  boms: Rows;
  routings: Rows;
}>;

const CARDS = [
  { id: 'items', label: '物料', route: 'manufacturing/items' },
  { id: 'boms', label: 'BOM', route: 'manufacturing/boms' },
  { id: 'routings', label: '工艺路线', route: 'manufacturing/routings' },
] as const;

function cardsFor(
  current: ManufacturingSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): readonly SummaryCardItem[] {
  return CARDS.map(({ id, label, route }): SummaryCardItem => {
    const readable = visibleRoutes.has(route);
    const count = (status: string): string =>
      readable
        ? String(current[id].filter((row) => recordText(row, 'status', 'status') === status).length)
        : '—';
    return {
      id,
      label: `${label} · 已发布版本`,
      value: count('PUBLISHED'),
      hint: `草稿 ${count('DRAFT')}`,
      href: readable ? `#/${route}` : undefined,
    };
  });
}

/** Recalculate from the refreshed full list of version rows after a write. */
export function appendManufacturingSummary(
  target: HTMLElement,
  input: () => ManufacturingSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): () => void {
  const host = el('div', 'manufacturing-summary');
  const refresh = (): void => {
    const current = input();
    const items = cardsFor(current, recordText, visibleRoutes);
    render(
      h(SummaryCards, { label: '制造主数据版本汇总', testId: 'manufacturing-summary', items }),
      host,
    );
  };
  refresh();
  target.append(host);
  return refresh;
}
