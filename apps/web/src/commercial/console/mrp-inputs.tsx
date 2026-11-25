// MFG-6：三个输入页签——计算批次 / 需求信号 / 计划政策。数据是路由加载时读进来的列表快照
//（controller.views 同源，写操作之后经 refresh 端口重读）；搜索 / 排序在快照上做，行多时经
//「继续加载」展开。批次行上的「查看建议」切到建议页签并选中该批次。
import { useState } from 'preact/hooks';
import { DataTable, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import type { MrpRow } from './mrp-ports';
import {
  RUN_STATE_LABELS,
  TYPE_LABELS,
  dayOf,
  idOf,
  numOf,
  records,
  rowText,
  textOf,
} from './mrp-state';
import type { MrpViewState } from './mrp-console-actions';

type Props = Readonly<{ state: MrpViewState }>;
const controlValue = (event: Event): string => (event.target as { value?: string }).value ?? '';
const text = (state: MrpViewState, row: MrpRow, camel: string, snake: string): string =>
  rowText(state.ports.recordText, row, camel, snake);
const pendingOf = (row: MrpRow): number =>
  records(row.proposals).filter((proposal) => textOf(proposal.effectiveState) === 'PROPOSED')
    .length;
const runTone = (status: string): 'success' | 'info' | 'neutral' | 'danger' =>
  status === 'COMPUTED'
    ? 'success'
    : status === 'DRAFT'
      ? 'info'
      : status === 'CANCELLED'
        ? 'danger'
        : 'neutral';
const itemCell = (state: MrpViewState, row: MrpRow, testId: string) => (
  <span class="po-cell">
    <strong data-testid={testId}>{text(state, row, 'sku', 'sku')}</strong>
    <small class="po-muted">{text(state, row, 'itemName', 'itemName')}</small>
  </span>
);

const runColumns = (state: MrpViewState): readonly DataTableColumn<MrpRow>[] => [
  {
    key: 'number',
    header: '运行编号',
    sortable: true,
    field: (row) => text(state, row, 'runNumber', 'run_number'),
    render: (row) => (
      <span class="po-cell">
        <strong data-testid="kt-mrp-run-number">
          {text(state, row, 'runNumber', 'run_number')}
        </strong>
        <small class="po-muted">{`基准 ${dayOf(row.as_of)} · 截止 ${text(state, row, 'horizonEnd', 'horizon_end')}`}</small>
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    sortable: true,
    field: (row) => text(state, row, 'status', 'status'),
    render: (row) => {
      const status = text(state, row, 'status', 'status');
      return (
        <StatusBadge tone={runTone(status)}>
          {RUN_STATE_LABELS[status] ?? state.ports.businessStateLabel(status)}
        </StatusBadge>
      );
    },
  },
  {
    key: 'freeze',
    header: '冻结至',
    sortable: true,
    field: (row) => text(state, row, 'freezeUntil', 'freeze_until'),
    render: (row) => text(state, row, 'freezeUntil', 'freeze_until'),
  },
  {
    key: 'counts',
    header: '计算行 / 建议',
    field: (row) => records(row.proposals).length,
    render: (row) =>
      `${String(records(row.calculations).length)} 行 / ${String(records(row.proposals).length)} 条`,
  },
  {
    key: 'pending',
    header: '待处理建议',
    sortable: true,
    field: pendingOf,
    render: (row) => String(pendingOf(row)),
  },
  {
    key: 'hash',
    header: '输入哈希',
    field: (row) => text(state, row, 'inputHash', 'input_hash'),
    render: (row) => `${text(state, row, 'inputHash', 'input_hash').slice(0, 16)}…`,
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看建议',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-mrp-run-proposals"
        onClick={() => {
          state.setRun(idOf(row));
          state.setTab('proposals');
        }}
      >
        查看建议
      </button>
    ),
  },
];

const demandColumns = (state: MrpViewState): readonly DataTableColumn<MrpRow>[] => [
  {
    key: 'item',
    header: '物料',
    sortable: true,
    field: (row) => text(state, row, 'sku', 'sku'),
    render: (row) => itemCell(state, row, 'kt-mrp-demand-sku'),
  },
  {
    key: 'source',
    header: '来源',
    field: (row) => text(state, row, 'sourceType', 'source_type'),
    render: (row) => (
      <span class="po-cell">
        <span>{text(state, row, 'sourceType', 'source_type')}</span>
        <small class="po-muted">{`来源 ${text(state, row, 'sourceId', 'source_id').slice(0, 8)}…`}</small>
      </span>
    ),
  },
  {
    key: 'required',
    header: '需求日期',
    sortable: true,
    field: (row) => text(state, row, 'requiredAt', 'required_at'),
    render: (row) => text(state, row, 'requiredAt', 'required_at'),
  },
  {
    key: 'quantity',
    header: '需求数量',
    sortable: true,
    align: 'right',
    field: (row) => numOf(row.quantity),
    render: (row) => text(state, row, 'quantity', 'quantity'),
  },
  {
    key: 'priority',
    header: '优先级',
    sortable: true,
    align: 'right',
    field: (row) => numOf(row.priority),
    render: (row) => text(state, row, 'priority', 'priority'),
  },
  {
    key: 'created',
    header: '登记时间',
    sortable: true,
    field: (row) => text(state, row, 'createdAt', 'created_at'),
    render: (row) => dayOf(row.created_at),
  },
];

const NUMBER_COLUMNS: readonly (readonly [string, string, string])[] = [
  ['safetyStock', 'safety_stock', '安全库存'],
  ['minimumOrderQuantity', 'minimum_order_quantity', '最小批量'],
  ['orderMultiple', 'order_multiple', '批量倍数'],
  ['leadTimeDays', 'lead_time_days', '提前期（天）'],
  ['freezeWindowDays', 'freeze_window_days', '冻结窗口（天）'],
];
const numberColumns = (state: MrpViewState): readonly DataTableColumn<MrpRow>[] =>
  NUMBER_COLUMNS.map(
    ([camel, snake, header]): DataTableColumn<MrpRow> => ({
      key: camel,
      header,
      sortable: true,
      align: 'right',
      field: (row) => numOf(row[snake]),
      render: (row) => text(state, row, camel, snake),
    }),
  );
const policyColumns = (state: MrpViewState): readonly DataTableColumn<MrpRow>[] => [
  {
    key: 'item',
    header: '物料',
    sortable: true,
    field: (row) => text(state, row, 'sku', 'sku'),
    render: (row) => itemCell(state, row, 'kt-mrp-policy-sku'),
  },
  {
    key: 'mode',
    header: '供应方式',
    sortable: true,
    field: (row) => text(state, row, 'makeOrBuy', 'make_or_buy'),
    render: (row) => TYPE_LABELS[text(state, row, 'makeOrBuy', 'make_or_buy')] ?? '',
  },
  ...numberColumns(state),
  {
    key: 'effective',
    header: '生效日期',
    sortable: true,
    field: (row) => text(state, row, 'effectiveAt', 'effective_at'),
    render: (row) => dayOf(row.effective_at),
  },
];

// 快照页签的通用外壳：搜索框（边输入边过滤）+ 计数 + 表格 + 行多时的「继续加载」。
const SnapshotTable = ({
  state,
  testId,
  placeholder,
  caption,
  empty,
  columns,
  rows,
  searchKeys,
  filter,
}: Readonly<{
  state: MrpViewState;
  testId: 'runs' | 'demands' | 'policies';
  placeholder: string;
  caption: string;
  empty: string;
  columns: readonly DataTableColumn<MrpRow>[];
  rows: readonly MrpRow[];
  searchKeys: readonly string[];
  filter: Readonly<{ label: string; key: string; labels?: Readonly<Record<string, string>> }>;
}>) => {
  const [filterValue, setFilterValue] = useState('');
  const needle = state.inputSearch.trim().toLowerCase();
  const filtered = needle !== '' || filterValue !== '';
  const options = [...new Set(rows.map((row) => textOf(row[filter.key])).filter(Boolean))].sort();
  const matched = rows.filter(
    (row) =>
      (filterValue === '' || filterValue === textOf(row[filter.key])) &&
      searchKeys.some((key) => textOf(row[key]).toLowerCase().includes(needle)),
  );
  const shown = matched.slice(0, state.shownCount);
  return (
    <section class="mrp-panel" data-testid={`kt-mrp-${testId}`}>
      <p class="mrp-toolbar">
        <label class="mrp-field">
          <span>{filter.label}</span>
          <select
            value={filterValue}
            onChange={(event) => {
              setFilterValue(controlValue(event));
              state.setInputSearch(state.inputSearch);
            }}
            data-testid={`kt-mrp-${testId}-filter`}
          >
            <option value="">全部</option>
            {options.map((value) => (
              <option key={value} value={value}>
                {filter.labels?.[value] ?? value}
              </option>
            ))}
          </select>
        </label>
        <input
          aria-label={placeholder}
          type="search"
          placeholder={placeholder}
          data-testid={`kt-mrp-${testId}-search`}
          value={state.inputSearch}
          onInput={(event) => {
            state.setInputSearch(controlValue(event));
          }}
        />
        <span class="console-hint">{`共 ${String(matched.length)} 条，显示 ${String(shown.length)} 条`}</span>
        {matched.length > shown.length ? (
          <button
            type="button"
            class="secondary compact"
            data-testid={`kt-mrp-${testId}-more`}
            onClick={state.showMore}
          >
            继续加载
          </button>
        ) : null}
      </p>
      <DataTable
        columns={columns}
        rows={shown}
        rowId={idOf}
        caption={caption}
        loading={state.loading}
        emptyTitle={!filtered ? empty : '没有符合条件的记录'}
        emptyDescription={!filtered ? '新建后会出现在这里' : '调整筛选条件或关键字后重试'}
      />
    </section>
  );
};

export const MrpRuns = ({ state }: Props) => (
  <SnapshotTable
    state={state}
    testId="runs"
    placeholder="搜索运行编号"
    searchKeys={['run_number']}
    filter={{ label: '状态', key: 'status', labels: RUN_STATE_LABELS }}
    caption="计算批次列表（运行编号、状态、冻结截止日、计算行与建议数）"
    empty="还没有计算批次"
    columns={runColumns(state)}
    rows={state.snapshot.runs ?? []}
  />
);

export const MrpDemands = ({ state }: Props) => (
  <SnapshotTable
    state={state}
    testId="demands"
    placeholder="搜索物料 SKU 或名称"
    searchKeys={['sku', 'itemName']}
    filter={{ label: '来源类型', key: 'source_type' }}
    caption="需求信号列表（物料、来源、需求日期、数量与优先级）"
    empty="还没有需求信号"
    columns={demandColumns(state)}
    rows={state.snapshot.demands ?? []}
  />
);

export const MrpPolicies = ({ state }: Props) => (
  <SnapshotTable
    state={state}
    testId="policies"
    placeholder="搜索物料 SKU 或名称"
    searchKeys={['sku', 'itemName']}
    filter={{ label: '供应方式', key: 'make_or_buy', labels: TYPE_LABELS }}
    caption="计划政策列表（供应方式、安全库存、批量、提前期、冻结窗口与生效日期）"
    empty="还没有计划政策"
    columns={policyColumns(state)}
    rows={state.snapshot.policies ?? []}
  />
);
