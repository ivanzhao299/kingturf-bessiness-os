import { h, render } from 'preact';
import { useEffect } from 'preact/hooks';
import { DataTable, StatusBadge, SummaryCards, type DataTableColumn } from '@kingturf/ui';
import { ConsoleConfirmDialog } from './console-confirm';
import { ConsoleNotice } from './console-notice';
import { finText, finWhen, type FinRow } from './fin-kit';
import {
  balanceId,
  inventoryCounts,
  locationOptions,
  optionLabel,
  qualityOptions,
} from './inv-data';
import { InventoryDetail } from './inv-detail';
import { InventoryLocationDrawer } from './inv-location-form';
import { createInventoryState, type InventoryPorts } from './inv-state';
import './procurement-ledger.css';

type State = ReturnType<typeof createInventoryState>;
const quantity = (row: FinRow) => finText(row, 'quantity');
export const inventoryStatusFromHash = (hash: string) => {
  if (!hash.startsWith('#/procurement/inventory?')) return '';
  const status = new URLSearchParams(hash.slice(hash.indexOf('?') + 1)).get('quality');
  return qualityOptions.some((item) => item.value === status) ? (status ?? '') : '';
};

const stockColumns = (state: State): readonly DataTableColumn<FinRow>[] => [
  { key: 'sku', header: 'SKU', field: (row) => finText(row, 'sku') },
  { key: 'lot', header: '批次号', field: (row) => finText(row, 'lotNumber') },
  { key: 'location', header: '库位', field: (row) => finText(row, 'locationCode') },
  { key: 'quantity', header: '结存', field: quantity },
  {
    key: 'quality',
    header: '质量状态',
    render: (row) => {
      const quality = finText(row, 'qualityStatus');
      if (!quality) return '—';
      return (
        <StatusBadge tone={quality === 'RELEASED' ? 'success' : 'warning'}>
          {optionLabel(qualityOptions, quality)}
        </StatusBadge>
      );
    },
  },
  { key: 'last', header: '最近移动', field: (row) => finWhen(row, 'lastMovementAt') },
  {
    key: 'actions',
    header: '操作',
    align: 'right',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-inv-open"
        onClick={() => {
          state.select(row);
        }}
      >
        查看
      </button>
    ),
  },
];
const locationColumns: readonly DataTableColumn<FinRow>[] = [
  { key: 'code', header: '编码', field: (row) => finText(row, 'code'), sortable: true },
  { key: 'name', header: '名称', field: (row) => finText(row, 'name'), sortable: true },
  {
    key: 'type',
    header: '类型',
    field: (row) => optionLabel(locationOptions, finText(row, 'location_type', 'locationType')),
    sortable: true,
  },
];
const sortOptions = [
  ['sku', 'SKU'],
  ['lot', '批次号'],
  ['location', '库位'],
  ['quantity', '结存数量'],
  ['last', '最近移动'],
] as const;
const countNote: Readonly<Record<string, string>> = {
  RELEASED: '已放行的不同批次',
  QUARANTINE: '待检隔离的不同批次',
  REJECTED: '已拒收隔离的不同批次',
};

function InventoryFilters({ state }: Readonly<{ state: State }>) {
  const filter = () => {
    void state.reload(state.query());
  };
  return (
    <div class="console-filters sq-filter-controls">
      <label>
        质量状态
        <select
          name="inventoryQuality"
          data-testid="kt-inv-filter-quality"
          value={state.status.value}
          onChange={(event) => {
            state.selectStatus(event.currentTarget.value);
          }}
        >
          <option value="">全部</option>
          {qualityOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {value === 'QUARANTINE' ? '待检（隔离）' : label}
            </option>
          ))}
        </select>
      </label>
      <label>
        库位
        <select
          data-testid="kt-inv-filter-location"
          value={state.location.value}
          onChange={(event) => {
            state.location.value = event.currentTarget.value;
            filter();
          }}
        >
          <option value="">全部库位</option>
          {state.locations.value.map((row) => (
            <option key={finText(row, 'id')} value={finText(row, 'id')}>
              {finText(row, 'code')} · {finText(row, 'name')}
            </option>
          ))}
        </select>
      </label>
      <form
        class="fin-search"
        onSubmit={(event) => {
          event.preventDefault();
          state.appliedSearch.value = state.search.value.trim();
          filter();
        }}
      >
        <input
          type="search"
          aria-label="搜索批次库存"
          placeholder="SKU、批次号"
          data-testid="kt-inv-search"
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
          value={state.sort.value}
          onChange={(event) => {
            state.sort.value = event.currentTarget.value;
            filter();
          }}
        >
          {sortOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        顺序
        <select
          value={state.direction.value}
          onChange={(event) => {
            state.direction.value = event.currentTarget.value;
            filter();
          }}
        >
          <option value="asc">升序</option>
          <option value="desc">降序</option>
        </select>
      </label>
    </div>
  );
}

function InventoryView({ state }: Readonly<{ state: State }>) {
  const canWrite = state.ports.permissions.has('inventory:move');
  const counts = inventoryCounts(state.all.value);
  const selected = state.selected.value;
  return (
    <div class="commercial-console-page" data-testid="kt-inv-page">
      <div class="procurement-ledger-actions">
        <button
          type="button"
          class="secondary"
          onClick={() => {
            void state.refresh();
          }}
        >
          刷新
        </button>
        {canWrite ? (
          <button
            type="button"
            class="primary"
            data-testid="kt-inv-create-location"
            onClick={() => {
              state.locationForm.value = true;
              state.notice.value = '';
              state.error.value = '';
            }}
          >
            ＋ 新建库位
          </button>
        ) : null}
      </div>
      {selected ? null : <ConsoleNotice message={state.notice.value} />}
      <SummaryCards
        label="批次库存质量状态汇总"
        testId="kt-inv-summary"
        items={qualityOptions.map(({ value, label }) => ({
          id: value.toLowerCase(),
          label,
          value: String(counts[value] ?? 0),
          hint: countNote[value],
          active: state.status.value === value,
          onSelect: () => {
            state.selectStatus(value);
          },
        }))}
      />
      <InventoryFilters state={state} />
      <DataTable
        caption="批次库位结存"
        columns={stockColumns(state)}
        rows={state.rows.value}
        rowId={balanceId}
        loading={state.loading.value}
        {...(state.loadError.value ? { error: state.loadError.value } : {})}
        emptyTitle="没有符合条件的结存"
        pagination={{
          loadedCount: state.rows.value.length,
          hasMore: state.nextCursor.value !== null,
          loading: state.loadingMore.value,
          onLoadMore: () => {
            void state.loadMore(state.query());
          },
        }}
      />
      <section data-testid="kt-inv-locations">
        <h3>库位管理</h3>
        <DataTable
          caption="库位一览"
          columns={locationColumns}
          rows={state.locations.value}
          rowId={(row) => finText(row, 'id')}
          emptyTitle="暂无库位"
        />
      </section>
      {selected ? (
        <InventoryDetail
          balance={selected}
          moving={state.moving.value}
          move={
            canWrite
              ? () => {
                  state.moving.value = true;
                  state.error.value = '';
                  state.notice.value = '';
                }
              : undefined
          }
          cancel={() => {
            state.moving.value = false;
            state.error.value = '';
          }}
          close={() => {
            state.select(null);
          }}
          orders={state.ports.orders()}
          actors={state.ports.actors}
          error={state.error.value}
          notice={state.notice.value}
          onSubmit={state.move}
        />
      ) : null}
      {state.locationForm.value && canWrite ? (
        <InventoryLocationDrawer
          close={() => {
            state.locationForm.value = false;
          }}
          error={state.error.value}
          submit={state.createLocation}
        />
      ) : null}
      <ConsoleConfirmDialog pending={state.pending} />
    </div>
  );
}

export function InventoryConsolePage(ports: InventoryPorts) {
  const state = createInventoryState(ports);
  return function InventoryPage() {
    useEffect(() => {
      if (typeof globalThis.addEventListener !== 'function' || !ports.attached) return;
      const events = new AbortController();
      globalThis.addEventListener(
        'hashchange',
        () => {
          if (!ports.attached?.()) {
            events.abort();
            return;
          }
          const hash = globalThis.location.hash;
          if (hash === '#/procurement/inventory' || hash.startsWith('#/procurement/inventory?'))
            state.selectStatus(inventoryStatusFromHash(hash));
        },
        { signal: events.signal },
      );
      return () => {
        events.abort();
      };
    }, []);
    return <InventoryView state={state} />;
  };
}

export function mountInventoryConsole(host: HTMLElement, ports: InventoryPorts) {
  render(h(InventoryConsolePage(ports), {}), host);
}
