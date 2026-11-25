import { signal } from '@preact/signals';
import { DataTable, type DataTableColumn } from '@kingturf/ui';
import {
  createFinList,
  FinFilters,
  type FinPage,
  type FinQuery,
  type FinRow,
  finText,
} from './fin-kit';

export function createOpsList(fetch: (query: FinQuery) => Promise<FinPage>, extra: FinQuery = {}) {
  const list = {
    rows: signal<readonly FinRow[]>([]),
    nextCursor: signal<string | null>(null),
    loading: signal(true),
    loadingMore: signal(false),
    loadError: signal(''),
  };
  const state = signal('');
  const search = signal('');
  const applied = signal('');
  const summary = signal<unknown>(null);
  const pages = createFinList(fetch, list, (page) => {
    summary.value = page.summary ?? null;
  });
  const query = () => ({ limit: 25, ...extra, state: state.value, query: applied.value });
  return {
    ...list,
    state,
    search,
    applied,
    summary,
    reload: () => pages.reload(query()),
    more: () => pages.loadMore(query()),
  };
}

export const opsColumn = (header: string, ...keys: readonly string[]): DataTableColumn<FinRow> => ({
  key: keys[0] ?? header,
  header,
  sortable: true,
  field: (row) => finText(row, ...keys),
  render: (row) => finText(row, ...keys) || '—',
});

type Props = Readonly<{
  prefix: string;
  label: string;
  states: Readonly<Partial<Record<string, string>>>;
  columns: readonly DataTableColumn<FinRow>[];
  model: ReturnType<typeof createOpsList>;
}>;

export const OpsLedger = ({ prefix, label, states, columns, model }: Props) => (
  <section aria-label={label} data-testid={`${prefix}-ledger`}>
    <FinFilters
      testPrefix={prefix}
      chips={[
        { key: '', label: '全部' },
        ...Object.entries(states).map(([key, name]) => ({ key, label: name ?? key })),
      ]}
      active={model.state.value}
      onSelect={(state) => {
        model.state.value = state;
        void model.reload();
      }}
      search={{
        value: model.search.value,
        applied: model.applied.value,
        placeholder: `搜索${label}`,
        onChange: (value) => {
          model.search.value = value;
        },
        onApply: () => {
          model.applied.value = model.search.value.trim();
          void model.reload();
        },
        onClear: () => {
          model.applied.value = '';
          model.search.value = '';
          void model.reload();
        },
      }}
    />
    <div data-testid={`${prefix}-table`}>
      <DataTable
        rows={model.rows.value}
        columns={columns}
        rowId={(row) =>
          finText(row, 'id', 'lotId') || `row-${String(model.rows.value.indexOf(row))}`
        }
        caption={label}
        loading={model.loading.value}
        {...(model.loadError.value ? { error: model.loadError.value } : {})}
        emptyTitle={`暂无${label}`}
        pagination={{
          loadedCount: model.rows.value.length,
          hasMore: model.nextCursor.value !== null,
          loading: model.loadingMore.value || model.loading.value,
          onLoadMore: () => {
            void model.more();
          },
        }}
      />
    </div>
  </section>
);
