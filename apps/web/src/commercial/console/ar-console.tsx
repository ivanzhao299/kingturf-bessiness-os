// FIN-1（ADR-0014 分域重写）：应收控制台——原 vanilla「应收与账龄」卡片与「过账应收发票」弹窗
// 表单能力面等价迁移 + UX 升级（汇总卡 / 主表 / 筛选与关键字 / 键集分页 / 详情抽屉）。
// 行数据来自桥轨加性分页（带客户名、订单号与十进制金额），汇总来自同一响应的服务端聚合；
// 默认按到期日升序（与旧列表同一行序）。
import { useEffect } from 'preact/hooks';
import { DataTable, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { createArActions, createArBundle } from './ar-actions';
import { ArCreateDrawer } from './ar-create';
import { ArDetailDrawer } from './ar-detail';
import type { ArConsolePorts, ArRow } from './ar-ports';
import { ArSummaryCards } from './ar-summary';
import {
  AR_FILTERS,
  AR_STATES,
  arAgingText,
  arAmount,
  arDocumentType,
  arState,
  arStateTone,
  type ArFilter,
  type ArViewState,
} from './ar-state';
import { FinAmount, FinFilters, FinPage, finDay, finText } from './fin-kit';

const columns = (state: ArViewState): readonly DataTableColumn<ArRow>[] => {
  const money = (key: string, testId: string) => (row: ArRow) => (
    <FinAmount currency={row.currency} amount={row[key]} testId={testId} />
  );
  return [
    {
      key: 'document',
      header: '单据号',
      sortable: true,
      field: (row) => finText(row, 'documentNumber', 'document_number'),
      render: (row) => (
        <strong data-testid="kt-ar-number">
          {finText(row, 'documentNumber', 'document_number') || '—'}
        </strong>
      ),
    },
    { key: 'type', header: '类型', sortable: true, field: arDocumentType },
    {
      key: 'customer',
      header: '客户',
      sortable: true,
      field: (row) => finText(row, 'customerName'),
      render: (row) => finText(row, 'customerName') || '—',
    },
    {
      key: 'order',
      header: '销售订单号',
      sortable: true,
      field: (row) => finText(row, 'orderNumber'),
      render: (row) => finText(row, 'orderNumber') || '—',
    },
    { key: 'currency', header: '币种', field: (row) => finText(row, 'currency') || '—' },
    {
      key: 'original',
      header: '原始金额',
      sortable: true,
      field: (row) => arAmount(row, 'originalAmount'),
      render: money('originalAmount', 'kt-ar-original'),
    },
    {
      key: 'applied',
      header: '已核销',
      sortable: true,
      field: (row) => arAmount(row, 'appliedAmount'),
      render: money('appliedAmount', 'kt-ar-applied'),
    },
    {
      key: 'remaining',
      header: '未核销',
      sortable: true,
      field: (row) => arAmount(row, 'remainingAmount'),
      render: money('remainingAmount', 'kt-ar-remaining'),
    },
    {
      key: 'dueAt',
      header: '到期日',
      sortable: true,
      field: (row) => finText(row, 'dueAt', 'due_at'),
      render: (row) => finDay(row, 'dueAt', 'due_at'),
    },
    {
      key: 'aging',
      header: '账龄',
      sortable: true,
      field: (row) => finText(row, 'dueAt', 'due_at'),
      render: (row) => <span data-testid="kt-ar-aging">{arAgingText(row, Date.now())}</span>,
    },
    {
      key: 'state',
      header: '状态',
      sortable: true,
      field: arState,
      render: (row) => {
        const current = arState(row);
        return (
          <StatusBadge tone={arStateTone(current)}>{AR_STATES[current] ?? current}</StatusBadge>
        );
      },
    },
    {
      key: 'actions',
      header: '操作',
      field: () => '查看',
      render: (row) => (
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-ar-open"
          onClick={() => {
            state.open(row);
          }}
        >
          查看
        </button>
      ),
    },
  ];
};

const ArView = (state: ArViewState) => (
  <FinPage
    testId="kt-ar-page"
    title="应收单据"
    description="默认按到期日排序"
    actions={
      <>
        <button
          type="button"
          class="secondary"
          data-testid="kt-ar-refresh"
          disabled={state.loading}
          onClick={() => {
            void state.runRefresh();
          }}
        >
          刷新
        </button>
        {state.mayPost ? (
          <button
            type="button"
            class="primary"
            data-testid="kt-ar-create"
            onClick={state.openCreate}
          >
            ＋ 过账应收
          </button>
        ) : null}
      </>
    }
    notice={state.notice}
    noticeHere={state.selected === null && state.activeForm === null}
  >
    <ArSummaryCards
      summary={state.summary}
      filter={state.filter}
      onSelectOverdue={() => {
        state.setFilter('OVERDUE');
      }}
    />
    <FinFilters
      testPrefix="kt-ar"
      chips={AR_FILTERS}
      active={state.filter}
      onSelect={(key) => {
        state.setFilter(key as ArFilter);
      }}
      search={{
        value: state.search,
        applied: state.appliedSearch,
        placeholder: '搜索单据号、客户或销售订单号（回车搜索）',
        onChange: state.setSearch,
        onApply: state.applySearch,
        onClear: state.clearSearch,
      }}
    />
    <DataTable
      columns={columns(state)}
      rows={state.rows}
      rowId={(row) => state.ports.textValue(row.id, '')}
      caption="应收单据主列表（单据、客户、金额、到期日、账龄与状态）"
      loading={state.loading}
      pagination={{
        loadedCount: state.rows.length,
        hasMore: state.nextCursor !== null,
        loading: state.loadingMore,
        onLoadMore: state.loadMore,
      }}
      {...(state.loadError === '' ? {} : { error: state.loadError })}
      emptyTitle={state.filtered ? '没有符合条件的应收单据' : '暂无应收开放项'}
      {...(state.filtered ? { emptyDescription: '调整筛选或关键字后重试' } : {})}
    />
    {state.selected ? <ArDetailDrawer state={state} /> : null}
    {state.activeForm === 'create' ? <ArCreateDrawer state={state} /> : null}
  </FinPage>
);

export function ArConsolePage(ports: ArConsolePorts) {
  const bundle = createArBundle();
  const actions = createArActions(ports, bundle);
  // 写入口沿用旧页面的判断：有过账权限，且有可选的销售订单。
  const state = (): ArViewState => ({
    permissions: ports.permissions,
    ports,
    rows: bundle.rows.value,
    nextCursor: bundle.nextCursor.value,
    loading: bundle.loading.value,
    loadingMore: bundle.loadingMore.value,
    loadError: bundle.loadError.value,
    filter: bundle.filter.value,
    search: bundle.search.value,
    appliedSearch: bundle.appliedSearch.value,
    summary: bundle.summary.value,
    selected: bundle.selected.value,
    detailLoading: bundle.detailLoading.value,
    activeForm: bundle.activeForm.value,
    submitError: bundle.submitError.value,
    notice: bundle.notice.value,
    mayPost: ports.permissions.has('ar:post') && ports.salesOrderChoices.length > 0,
    filtered: bundle.filter.value !== 'ALL' || bundle.appliedSearch.value !== '',
    setFilter: actions.setFilter,
    setSearch: actions.setSearch,
    applySearch: actions.applySearch,
    clearSearch: actions.clearSearch,
    loadMore: actions.loadMore,
    runRefresh: actions.refresh,
    open: actions.open,
    openCreate: actions.openCreate,
    closeForm: actions.closeForm,
    runCreate: actions.runCreate,
  });
  const Page = () => {
    // 首屏：取第一页与汇总（每页 AR_PAGE_SIZE 行，之后「继续加载」沿游标续取）。
    useEffect(() => {
      void actions.reload();
      return ports.ledgerUpdates?.subscribe(actions.reloadLedger);
    }, []);
    return ArView(state());
  };
  return Page;
}
