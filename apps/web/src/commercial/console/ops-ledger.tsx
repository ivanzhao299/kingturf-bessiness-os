import { signal } from '@preact/signals';
import { DataTable, type DataTableColumn } from '@kingturf/ui';
import {
  createFinList,
  FinFilters,
  FinFacts,
  finRecord,
  finRows,
  finWhen,
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

const evidenceLabels = {
  reference: '证据编号',
  sealReference: '封车凭证',
  receiverName: '签收人',
  receivedAt: '签收时间',
  proofReference: '回单编号',
} as const;

function OpsEvidence({ value }: Readonly<{ value: unknown }>) {
  const source = finRecord(value);
  const facts = Object.entries(evidenceLabels).flatMap(([key, label]) => {
    const text = key === 'receivedAt' && source[key] ? finWhen(source, key) : finText(source, key);
    return text ? [[label, text] as const] : [];
  });
  return (
    <>
      {facts.length ? <FinFacts items={facts} /> : null}
      {Object.keys(source).length > 0 ? (
        <details>
          <summary>查看原始证据</summary>
          <code>{JSON.stringify(source)}</code>
        </details>
      ) : null}
    </>
  );
}

export function OpsTimeline({
  value,
  stateLabel,
  empty,
  testId,
}: Readonly<{
  value: unknown;
  stateLabel: (state: unknown) => string;
  empty: string;
  testId: string;
}>) {
  const events = finRows(value);
  return (
    <div data-testid={testId}>
      {events.length === 0 ? (
        <p class="fin-muted">{empty}</p>
      ) : (
        <ol class="fin-timeline">
          {events.map((event, index) => {
            const reason = finText(event, 'reason');
            const location = finText(event, 'location');
            return (
              <li key={finText(event, 'id') || String(index)}>
                <strong>{stateLabel(event.state)}</strong>
                <span class="fin-muted">
                  {finWhen(event, 'occurredAt', 'occurred_at', 'created_at')}
                </span>
                {reason ? (
                  <span>{reason === 'Inspection opened' ? '开立检验' : reason}</span>
                ) : null}
                {location ? <FinFacts items={[['地点', location]]} /> : null}
                <OpsEvidence value={event.evidence} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
