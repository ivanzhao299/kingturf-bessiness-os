// MFG-6：建议页签——建议是主角。批次切换（历史批次可切换查看）、状态 / 冻结窗口筛选、SKU 与名称
// 搜索、可排序的主表、键集分页（继续加载）；每行有状态徽章和「下一步」动作（按状态与能力键出现，
// 与 legacy 卡片的按钮条件逐条一致）。详情抽屉在 mrp-detail.tsx。
import { DataTable, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import type { MrpRow } from './mrp-ports';
import {
  RUN_STATE_LABELS,
  STATE_FILTERS,
  STATE_LABELS,
  TYPE_LABELS,
  dayOf,
  idOf,
  numOf,
  rowText,
  stateTone,
} from './mrp-state';
import { decisionActions, type MrpViewState } from './mrp-console-actions';

type Props = Readonly<{ state: MrpViewState }>;
const text = (
  state: MrpViewState,
  row: MrpRow,
  camel: string,
  snake: string,
  fallback = '',
): string => rowText(state.ports.recordText, row, camel, snake, fallback);
const chip = (active: boolean): string =>
  active ? 'secondary compact active' : 'secondary compact';
const controlValue = (event: Event): string => (event.target as { value?: string }).value ?? '';

const columns = (state: MrpViewState): readonly DataTableColumn<MrpRow>[] => [
  {
    key: 'sku',
    header: '物料',
    sortable: true,
    field: (row) => text(state, row, 'sku', 'sku'),
    render: (row) => (
      <span class="po-cell">
        <strong data-testid="kt-mrp-proposal-sku">{text(state, row, 'sku', 'sku', '—')}</strong>
        <small class="po-muted">{text(state, row, 'itemName', 'itemName')}</small>
      </span>
    ),
  },
  {
    key: 'proposal',
    header: '建议',
    sortable: true,
    field: (row) => numOf(row.quantity),
    render: (row) => (
      <span class="po-cell">
        <span>{`${TYPE_LABELS[text(state, row, 'proposalType', 'proposal_type')] ?? '建议'} ${text(state, row, 'quantity', 'quantity')}`}</span>
        <small class="po-muted">{`${dayOf(row.start_at)} → ${dayOf(row.due_at)}`}</small>
      </span>
    ),
  },
  {
    key: 'state',
    header: '状态',
    sortable: true,
    field: (row) => text(state, row, 'effectiveState', 'effectiveState'),
    render: (row) => {
      const status = text(state, row, 'effectiveState', 'effectiveState');
      return (
        <span class="mrp-badges">
          <StatusBadge tone={stateTone(status)}>
            {STATE_LABELS[status] ?? state.ports.businessStateLabel(status)}
          </StatusBadge>
          {row.frozen === true ? (
            <span data-testid="kt-mrp-frozen">
              <StatusBadge tone="warning">冻结窗口内</StatusBadge>
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    key: 'actions',
    header: '操作与下一步',
    field: () => '查看',
    render: (row) => {
      const status = text(state, row, 'effectiveState', 'effectiveState');
      return (
        <span class="po-cell">
          <span class="po-row-actions">
            <button
              type="button"
              class="secondary compact"
              data-testid="kt-mrp-open"
              onClick={() => {
                state.open(row);
              }}
            >
              查看
            </button>
            {decisionActions(state, row).map((action) => (
              <button
                key={action.form}
                type="button"
                class="secondary compact"
                data-testid={`kt-mrp-${action.form}`}
                disabled={state.loading}
                onClick={() => {
                  state.openForm(action.form, row);
                }}
              >
                {action.label}
              </button>
            ))}
          </span>
          <small class="po-muted">{`下一步：${state.ports.operationsNextAction(status)}`}</small>
        </span>
      );
    },
  },
];

// 批次标题：运行编号 · 状态，以及基准日、冻结截止日与输入哈希（legacy 批次卡片的文字）。
const RunHeader = ({ state }: Props) => {
  const current = (state.snapshot.runs ?? []).find((run) => idOf(run) === state.runId);
  if (!current) return <p class="console-hint">还没有计算批次</p>;
  const status = text(state, current, 'status', 'status');
  return (
    <p class="mrp-run-header" data-testid="kt-mrp-run-header">
      <strong class="mrp-run-heading" data-testid="kt-mrp-run-heading">
        {`${text(state, current, 'runNumber', 'run_number')} · ${RUN_STATE_LABELS[status] ?? state.ports.businessStateLabel(status)}`}
      </strong>
      <span class="mrp-run-meta">{`基准 ${dayOf(current.as_of)} · 冻结至 ${text(state, current, 'freezeUntil', 'freeze_until')} · 输入哈希 ${text(state, current, 'inputHash', 'input_hash').slice(0, 16)}…`}</span>
    </p>
  );
};

export const MrpProposals = ({ state }: Props) => {
  const runs = state.snapshot.runs ?? [];
  const filtered = state.stateFilter !== 'ALL' || state.overrideOnly || state.appliedQuery !== '';
  return (
    <section class="mrp-panel" data-testid="kt-mrp-proposals">
      <div class="commercial-console-filters">
        <label class="mrp-field">
          <span>计算批次</span>
          <select
            data-testid="kt-mrp-run-select"
            value={state.runId}
            onChange={(event) => {
              state.setRun(controlValue(event));
            }}
          >
            {runs.length === 0 ? <option value="">还没有计算批次</option> : null}
            {runs.map((run) => (
              <option key={idOf(run)} value={idOf(run)}>
                {`${text(state, run, 'runNumber', 'run_number')} · ${RUN_STATE_LABELS[text(state, run, 'status', 'status')] ?? ''}`}
              </option>
            ))}
          </select>
        </label>
        {STATE_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            class={chip(state.stateFilter === option)}
            aria-pressed={state.stateFilter === option}
            data-testid={`kt-mrp-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStateFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : STATE_LABELS[option]}
          </button>
        ))}
        <button
          type="button"
          class={chip(state.overrideOnly)}
          aria-pressed={state.overrideOnly}
          data-testid="kt-mrp-filter-override"
          onClick={() => {
            state.setOverrideOnly(!state.overrideOnly);
          }}
        >
          有冻结覆盖
        </button>
        <form
          class="mrp-search"
          data-testid="kt-mrp-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            state.applySearch();
          }}
        >
          <input
            aria-label="搜索物料 SKU 或名称"
            type="search"
            placeholder="搜索物料 SKU 或名称（回车搜索）"
            data-testid="kt-mrp-search"
            value={state.search}
            onInput={(event) => {
              state.setSearch(controlValue(event));
            }}
          />
          <button type="submit" class="secondary compact" data-testid="kt-mrp-search-submit">
            搜索
          </button>
          {state.search !== '' || state.appliedQuery !== '' ? (
            <button
              type="button"
              class="secondary compact"
              data-testid="kt-mrp-search-clear"
              onClick={state.clearSearch}
            >
              清除
            </button>
          ) : null}
        </form>
      </div>
      <RunHeader state={state} />
      <div data-testid="kt-mrp-proposal-table">
        <DataTable
          columns={columns(state)}
          rows={state.proposals}
          rowId={idOf}
          caption="物料需求建议主列表（物料、建议、状态与下一步）"
          loading={state.loading}
          pagination={{
            loadedCount: state.proposals.length,
            hasMore: state.nextCursor !== null,
            loading: state.loadingMore,
            onLoadMore: state.loadMore,
          }}
          {...(state.loadError === '' ? {} : { error: state.loadError })}
          emptyTitle={filtered ? '没有符合条件的建议' : '这个批次没有建议'}
          emptyDescription={
            filtered
              ? '调整状态、冻结覆盖或关键字后重试'
              : '运行物料需求计算后，净需求大于零的物料会出现在这里'
          }
        />
      </div>
    </section>
  );
};
