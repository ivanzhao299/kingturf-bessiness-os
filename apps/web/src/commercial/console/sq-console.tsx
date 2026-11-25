import { signal, type Signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  SummaryCards,
  type DataTableColumn,
} from '@kingturf/ui';
import { useState } from 'preact/hooks';
import { h, render } from 'preact';
import { confirmFormWrite, ConsoleConfirmDialog, createConfirm } from './console-confirm';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import {
  createFinList,
  finRows,
  finText,
  type FinPage,
  type FinQuery,
  type FinRow,
} from './fin-kit';
import { reloadSelectedDetail, syncSelected } from './selected-sync';
import { failureMessage } from '../../shared/api-error-message';
import { SupplierQuoteDetail } from './sq-detail';
import {
  expiryDay,
  findQuoteLine,
  lineId,
  quoteBusinessDay,
  quoteCounts,
  quoteId,
  quoteLines,
  quoteReference,
  quoteStatus,
  quoteValue,
  rfqNumber,
  SQ_PATH,
  supplierName,
  supplierQuoteFields,
  supplierQuotePayload,
} from './sq-data';
import type { Choice } from './console-choices';
import './procurement-ledger.css';

const PAGE_SIZE = 20;
export type SupplierQuotePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialQuotes: readonly FinRow[];
  rfqs: () => readonly FinRow[];
  suppliers: () => readonly Choice[];
  fetchPage: (query: FinQuery) => Promise<FinPage>;
  loadDetail: (id: string) => Promise<FinRow | null>;
  refresh: () => Promise<readonly FinRow[]>;
  submit: (path: string, payload: Record<string, unknown>) => Promise<unknown>;
  now?: () => Date;
}>;

type FormProps = Readonly<{
  ports: SupplierQuotePorts;
  error: string;
  onSubmit: (values: Readonly<Record<string, string>>, rfq: string, line: string) => Promise<void>;
}>;
const changed = (event: Readonly<{ currentTarget: HTMLSelectElement }>) =>
  event.currentTarget.value;
export function mountSupplierQuoteConsole(host: HTMLElement, ports: SupplierQuotePorts): void {
  render(h(SupplierQuoteConsolePage(ports), {}), host);
}

function QuoteForm({ ports, error, onSubmit }: FormProps) {
  const [rfq, setRfq] = useState('');
  const [line, setLine] = useState('');
  const documents = ports.rfqs();
  const lines = finRows(documents.find((item) => quoteId(item) === rfq)?.lines);
  return (
    <div class="sq-form">
      <FocusAnchor token={rfq} />
      <div class="console-filters sq-rfq-fields">
        <label>
          询价单
          <select
            aria-required="true"
            value={rfq}
            data-testid="kt-sq-form-rfq"
            name="rfqId"
            onChange={(event) => {
              setRfq(changed(event));
              setLine('');
            }}
          >
            <option value="">请选择询价单</option>
            {documents.map((item) => (
              <option key={quoteId(item)} value={quoteId(item)}>
                {rfqNumber(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          询价明细
          <select
            aria-required="true"
            value={line}
            disabled={rfq === ''}
            name="rfqLineId"
            data-testid="kt-sq-form-line"
            onChange={(event) => {
              setLine(changed(event));
            }}
          >
            <option value="">请选择询价明细</option>
            {lines.map((item) => (
              <option key={quoteId(item)} value={quoteId(item)}>
                {finText(item, 'line_number', 'lineNumber')} · {finText(item, 'sku')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormSection
        title="报价内容"
        fields={supplierQuoteFields(ports.suppliers())}
        error={error}
        submitLabel="保存不可变报价"
        onSubmit={(values) => onSubmit(values, rfq, line)}
      />
    </div>
  );
}

const columnsFor = (
  rfqs: readonly FinRow[],
  today: string,
  open: (row: FinRow) => void,
): readonly DataTableColumn<FinRow>[] => [
  {
    key: 'reference',
    header: '报价编号',
    field: quoteReference,
    render: (row) => `报价 ${quoteReference(row)}`,
  },
  { key: 'supplier', header: '供应商', field: supplierName },
  {
    key: 'rfq',
    header: '询价单 · 明细',
    field: (row) =>
      [
        rfqNumber(row),
        ...quoteLines(row).map(
          (line) =>
            finText(findQuoteLine(row, rfqs, lineId(line)) ?? {}, 'sku') ||
            finText(line, 'lineNumber'),
        ),
      ]
        .filter(Boolean)
        .join(' · '),
  },
  { key: 'price', header: '单价', field: (row) => quoteValue(row, 'unit_price') },
  { key: 'moq', header: '最小订购量', field: (row) => quoteValue(row, 'minimum_order_quantity') },
  { key: 'promised', header: '承诺到货日', field: (row) => quoteValue(row, 'promised_at') },
  { key: 'expiry', header: '有效期', field: expiryDay },
  {
    key: 'state',
    header: '状态',
    field: (row) => quoteStatus(row, today) ?? '—',
    render: (row) => {
      const state = quoteStatus(row, today);
      if (state === null) return '—';
      return (
        <StatusBadge tone={state === 'VALID' ? 'success' : 'neutral'}>
          {state === 'VALID' ? '有效' : '已过期'}
        </StatusBadge>
      );
    },
  },
  {
    key: 'actions',
    header: '操作',
    align: 'right',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-sq-open"
        onClick={() => {
          open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const initialRows = (rows: readonly FinRow[]) =>
  [...rows].sort((left, right) => {
    const latest = finText(right, 'received_at').localeCompare(finText(left, 'received_at'));
    return latest || quoteId(right).localeCompare(quoteId(left));
  });
const sorts: readonly (readonly [string, string])[] = [
  ['received', '收件时间'],
  ['reference', '报价编号'],
  ['supplier', '供应商'],
  ['rfq', '询价单'],
  ['expiry', '有效期'],
];

function createSupplierQuoteState(ports: SupplierQuotePorts) {
  const all = signal(ports.initialQuotes);
  const ordered = initialRows(ports.initialQuotes);
  const rows = signal<readonly FinRow[]>(ordered.slice(0, PAGE_SIZE));
  const nextCursor = signal(ordered.length > PAGE_SIZE ? quoteId(rows.value.at(-1) ?? {}) : null);
  const loading = signal(false);
  const loadingMore = signal(false);
  const loadError = signal('');
  const { reload, loadMore } = createFinList(ports.fetchPage, {
    rows,
    nextCursor,
    loading,
    loadingMore,
    loadError,
  });
  const selected: Signal<FinRow | null> = signal(null);
  const form = signal(false);
  const submitError = signal('');
  const notice = signal('');
  const pending = createConfirm();
  const status = signal('');
  const search = signal('');
  const appliedSearch = signal('');
  const sort = signal('received');
  const direction = signal('desc');
  const now = () => ports.now?.() ?? new Date();
  const query = () => ({
    limit: PAGE_SIZE,
    status: status.value,
    query: appliedSearch.value,
    sort: sort.value,
    direction: direction.value,
  });
  const selection = () => ({
    selected,
    rows: all.value,
    idOf: quoteId,
    loadDetail: ports.loadDetail,
  });
  const refresh = async (afterWrite: boolean) => {
    try {
      all.value = await ports.refresh();
      if (syncSelected(selection())) void reloadSelectedDetail(selection());
      await reload(query());
    } catch (error: unknown) {
      loadError.value = failureMessage(
        error,
        afterWrite ? '报价已保存，列表刷新失败' : '报价列表刷新失败',
      );
    }
  };
  const save: FormProps['onSubmit'] = async (values, rfq, line) => {
    submitError.value = '';
    if (rfq === '' || line === '') {
      submitError.value = rfq === '' ? '请选择询价单' : '请选择询价明细';
      return;
    }
    if (
      !(await confirmFormWrite(pending, {
        title: '登记供应商报价',
        message: `报价 ${values.quoteReference ?? ''} 保存后不可修改。`,
        confirmLabel: '确认登记',
        destructive: true,
      }))
    )
      return;
    try {
      await ports.submit(SQ_PATH, supplierQuotePayload(values, rfq, line, now()));
    } catch (error: unknown) {
      submitError.value = failureMessage(error, '登记供应商报价失败');
      return;
    }
    form.value = false;
    notice.value = `已登记供应商报价 ${values.quoteReference ?? ''}`;
    await refresh(true);
  };
  const open = (row: FinRow) => {
    selected.value = row;
    notice.value = '';
    void reloadSelectedDetail(selection());
  };
  const selectStatus = (next: string) => {
    status.value = next;
    void reload(query());
  };

  return {
    ports,
    all,
    rows,
    nextCursor,
    loading,
    loadingMore,
    loadError,
    reload,
    loadMore,
    selected,
    form,
    submitError,
    notice,
    pending,
    status,
    search,
    appliedSearch,
    sort,
    direction,
    now,
    query,
    refresh,
    save,
    open,
    selectStatus,
  };
}

function SupplierQuoteView({
  state,
}: Readonly<{ state: ReturnType<typeof createSupplierQuoteState> }>) {
  const counts = quoteCounts(state.all.value, state.now());
  const selectedRow = state.selected.value;
  const canWrite = state.ports.permissions.has('procurement:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-sq-page">
      <PageHeader
        title="供应商报价"
        description="按询价明细查看和对比供应商报价"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              onClick={() => {
                void state.refresh(false);
              }}
            >
              刷新
            </button>
            {canWrite ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-sq-create"
                onClick={() => {
                  state.form.value = true;
                  state.submitError.value = '';
                  state.notice.value = '';
                }}
              >
                ＋ 登记供应商报价
              </button>
            ) : null}
          </>
        }
      />
      <ConsoleNotice message={state.notice.value} />
      <SummaryCards
        label="供应商报价汇总"
        testId="kt-sq-summary"
        items={[
          {
            id: 'valid',
            label: '有效报价',
            value: String(counts.valid),
            hint: '有效期在今日或之后',
            active: state.status.value === 'VALID',
            onSelect: () => {
              state.selectStatus('VALID');
            },
          },
          {
            id: 'expiring',
            label: '七天内到期',
            value: String(counts.expiring),
            hint: '仍有效，最迟第七天到期',
          },
          {
            id: 'expired',
            label: '已过期报价',
            value: String(counts.expired),
            hint: '有效期早于今日',
            active: state.status.value === 'EXPIRED',
            onSelect: () => {
              state.selectStatus('EXPIRED');
            },
          },
        ]}
      />
      <div class="console-filters sq-filter-controls">
        {(
          [
            ['', '全部'],
            ['VALID', '有效'],
            ['EXPIRED', '已过期'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={label}
            class="secondary compact"
            data-testid={`kt-sq-filter-${value.toLowerCase() || 'all'}`}
            aria-pressed={state.status.value === value}
            onClick={() => {
              state.selectStatus(value);
            }}
          >
            {label}
          </button>
        ))}
        <form
          class="fin-search"
          onSubmit={(event) => {
            event.preventDefault();
            state.appliedSearch.value = state.search.value.trim();
            void state.reload(state.query());
          }}
        >
          <input
            type="search"
            aria-label="搜索供应商报价"
            placeholder="报价编号、供应商、SKU"
            data-testid="kt-sq-search"
            value={state.search.value}
            onInput={(event) => {
              state.search.value = event.currentTarget.value;
            }}
          />
          <button type="submit" class="secondary compact">
            搜索
          </button>
        </form>
        <label>
          排序
          <select
            aria-label="供应商报价排序字段"
            value={state.sort.value}
            onChange={(event) => {
              state.sort.value = changed(event);
              void state.reload(state.query());
            }}
          >
            {sorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          顺序
          <select
            aria-label="供应商报价排序顺序"
            value={state.direction.value}
            onChange={(event) => {
              state.direction.value = changed(event);
              void state.reload(state.query());
            }}
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </label>
      </div>
      <DataTable
        caption="供应商报价台账"
        columns={columnsFor(state.ports.rfqs(), quoteBusinessDay(state.now()), state.open)}
        rows={state.rows.value}
        rowId={quoteId}
        loading={state.loading.value}
        {...(state.loadError.value === '' ? {} : { error: state.loadError.value })}
        emptyTitle="没有符合条件的报价"
        pagination={{
          loadedCount: state.rows.value.length,
          hasMore: state.nextCursor.value !== null,
          loading: state.loadingMore.value,
          onLoadMore: () => {
            void state.loadMore(state.query());
          },
        }}
      />
      {selectedRow ? (
        <SupplierQuoteDetail
          quote={selectedRow}
          all={state.all.value}
          rfqs={state.ports.rfqs()}
          close={() => {
            state.selected.value = null;
          }}
        />
      ) : null}
      {state.form.value && canWrite ? (
        <DetailDrawer
          title="登记供应商报价"
          onClose={() => {
            state.form.value = false;
          }}
        >
          <QuoteForm ports={state.ports} error={state.submitError.value} onSubmit={state.save} />
        </DetailDrawer>
      ) : null}
      <ConsoleConfirmDialog pending={state.pending} />
    </div>
  );
}

export function SupplierQuoteConsolePage(ports: SupplierQuotePorts) {
  const state = createSupplierQuoteState(ports);
  return () => <SupplierQuoteView state={state} />;
}
