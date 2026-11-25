import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import {
  DataTable,
  StatusBadge,
  SummaryCards,
  type DataTableColumn,
  type SummaryCardItem,
} from '@kingturf/ui';
import { failureMessage } from '../../shared/api-error-message';
import { askConfirm, ConsoleConfirmDialog, createConfirm } from './console-confirm';
import {
  createFinList,
  FinAmount,
  FinFilters,
  FinPage,
  finDecimalSortKey,
  finMoneyText,
  finRows,
  finText,
  finWhen,
  type FinListSignals,
  type FinRow,
} from './fin-kit';
import {
  allocationOrderDescription,
  PaymentDetail,
  PaymentIntake,
  paymentCanRun,
  paymentReference,
  resultHash,
  runStatus,
} from './payment-detail';
import {
  PAYMENT_PATH,
  RECONCILIATION_PATH,
  type PaymentPorts,
  type PaymentTab,
} from './payment-ports';
import { paymentIntakePayload, reconciliationPayload } from './payment-payload';
import { reloadSelectedDetail, syncSelected } from './selected-sync';

const idOf = (row: FinRow): string => finText(row, 'id');
const makeList = (): FinListSignals => ({
  rows: signal<readonly FinRow[]>([]),
  nextCursor: signal<string | null>(null),
  loading: signal(true),
  loadingMore: signal(false),
  loadError: signal(''),
});
const amount = (key: string, header: string, testId: string): DataTableColumn<FinRow> => ({
  key,
  header,
  sortable: true,
  align: 'right',
  field: (row) => finDecimalSortKey(row[key]),
  render: (row) => <FinAmount currency={row.currency} amount={row[key]} testId={testId} />,
});
const paymentColumns: readonly DataTableColumn<FinRow>[] = [
  {
    key: 'reference',
    header: '银行流水号',
    sortable: true,
    field: paymentReference,
    render: (row) => (
      <strong data-testid="kt-payment-reference">{paymentReference(row) || '—'}</strong>
    ),
  },
  {
    key: 'customer',
    header: '客户',
    sortable: true,
    field: (row) => finText(row, 'customerName') || '—',
  },
  {
    key: 'currency',
    header: '币种',
    sortable: true,
    field: (row) => finText(row, 'currency') || '—',
  },
  amount('originalAmount', '到账金额', 'kt-payment-original'),
  amount('appliedAmount', '已分配', 'kt-payment-applied'),
  amount('remainingAmount', '未分配', 'kt-payment-remaining'),
  {
    key: 'received',
    header: '到账时间',
    sortable: true,
    field: (row) => finText(row, 'receivedAt'),
    render: (row) => <time class="fin-token">{finWhen(row, 'receivedAt', 'received_at')}</time>,
  },
  {
    key: 'registered',
    header: '登记时间',
    sortable: true,
    field: (row) => finText(row, 'registeredAt'),
    render: (row) => <time class="fin-token">{finWhen(row, 'registeredAt')}</time>,
  },
];
const runColumns: readonly DataTableColumn<FinRow>[] = [
  {
    key: 'time',
    header: '运行时间',
    sortable: true,
    field: (row) => finText(row, 'createdAt', 'created_at'),
    render: (row) => <time class="fin-token">{finWhen(row, 'createdAt', 'created_at')}</time>,
  },
  {
    key: 'state',
    header: '状态',
    sortable: true,
    field: runStatus,
    render: (row) => (
      <StatusBadge tone={row.status === 'COMPLETED' ? 'success' : 'neutral'}>
        {runStatus(row)}
      </StatusBadge>
    ),
  },
  {
    key: 'count',
    header: '匹配笔数',
    sortable: true,
    field: (row) => (typeof row.matchCount === 'number' ? row.matchCount : '—'),
  },
  {
    key: 'hash',
    header: '结果哈希',
    field: resultHash,
    render: (row) => (
      <code data-testid="kt-payment-run-hash" title={resultHash(row)}>
        {resultHash(row).slice(0, 12) || '—'}
      </code>
    ),
  },
];
const metrics = [
  ['receivedAmount', '到账合计', '所示币种所有可见收款的到账金额'],
  ['appliedAmount', '已分配合计', '所示币种已核销分配的收款金额'],
  ['remainingAmount', '未分配合计', '所示币种尚未核销分配的收款余额'],
] as const;
const summaryCards = (summary: readonly FinRow[] | null): readonly SummaryCardItem[] => {
  if (!summary?.length)
    return metrics.map(([key, label]) => ({
      id: key,
      label,
      value: '—',
      hint: summary === null ? '按币种汇总暂不可用' : '暂无银行收款',
    }));
  return summary.flatMap((row) =>
    metrics.map(([key, label, hint]) => ({
      id: `${key}-${finText(row, 'currency')}`,
      label,
      value: finMoneyText(row.currency, row[key]),
      hint: `${finText(row, 'currency')} · ${hint}`,
    })),
  );
};

function createPaymentState(ports: PaymentPorts) {
  const payments = makeList();
  const runs = makeList();
  const summary = signal<readonly FinRow[] | null>(null);
  const paymentPage = createFinList(
    (query) => ports.fetchPage('payments', query),
    payments,
    (page) => {
      summary.value = page.summary === undefined ? null : finRows(page.summary);
    },
  );
  const runPage = createFinList((query) => ports.fetchPage('reconciliations', query), runs);
  const canReadRuns = ports.permissions.has('reconciliation:read');
  const state = signal('ALL');
  const search = signal('');
  const applied = signal('');
  const selected = signal<FinRow | null>(null);
  const tab = signal<PaymentTab>('payments');
  const form = signal<'intake' | 'reconcile' | null>(null);
  const error = signal('');
  const notice = signal('');
  const busy = signal(false);
  const confirmation = createConfirm();
  const paymentQuery = () => ({
    limit: 50,
    summary: 1,
    search: applied.value,
    state: state.value === 'ALL' ? '' : state.value,
  });
  const runQuery = { limit: 50 };
  const selection = () => {
    const current = tab.value;
    return {
      selected,
      rows: (current === 'payments' ? payments : runs).rows.value,
      idOf,
      loadDetail: (id: string) => ports.loadDetail(current, id),
    };
  };
  const reloadAll = () =>
    Promise.all([
      paymentPage.reload(paymentQuery()),
      ...(canReadRuns ? [runPage.reload(runQuery)] : []),
    ]);
  const refresh = async (): Promise<void> => {
    try {
      await ports.refresh();
    } catch (cause: unknown) {
      payments.loadError.value = failureMessage(cause, '业务数据刷新失败');
    }
    await reloadAll();
    const latest = selection();
    const currentList = tab.value === 'payments' ? payments : runs;
    if (currentList.loadError.value === '' && syncSelected(latest))
      await reloadSelectedDetail(latest);
  };
  const close = () => {
    selected.value = null;
    form.value = null;
    error.value = '';
  };
  const open = (kind: PaymentTab, row: FinRow, next: typeof form.value = null) => {
    tab.value = kind;
    selected.value = row;
    form.value = next;
    notice.value = '';
    error.value = '';
    void reloadSelectedDetail(selection());
  };
  const afterWrite = async (message: string, drawer: boolean): Promise<void> => {
    if (drawer) form.value = null;
    else close();
    notice.value = message;
    await refresh();
  };
  const intake = async (values: Readonly<Record<string, string>>): Promise<void> => {
    error.value = '';
    try {
      const payload = paymentIntakePayload(values);
      await ports.submit(PAYMENT_PATH, payload);
      await afterWrite(`已登记银行收款 ${payload.bankReference}`, false);
    } catch (cause: unknown) {
      error.value = failureMessage(cause, '登记收款失败');
    }
  };
  const run = async (row: FinRow): Promise<void> => {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await ports.submit(RECONCILIATION_PATH, reconciliationPayload(idOf(row)));
      await afterWrite(`已完成核销运行 ${paymentReference(row)}`, true);
    } catch (cause: unknown) {
      error.value = failureMessage(cause, '核销运行失败');
    } finally {
      busy.value = false;
    }
  };
  const confirmRun = (): void => {
    const row = selected.value;
    if (!row || busy.value || !paymentCanRun(row, ports.permissions)) return;
    askConfirm(confirmation, {
      title: '确认运行核销',
      message: allocationOrderDescription,
      confirmLabel: '确认运行核销',
      destructive: true,
      run: () => run(row),
    });
  };
  return {
    payments,
    runs,
    summary,
    canReadRuns,
    state,
    search,
    applied,
    selected,
    tab,
    form,
    error,
    notice,
    busy,
    confirmation,
    reloadAll,
    refresh,
    close,
    open,
    intake,
    confirmRun,
    reloadPayments: () => paymentPage.reload(paymentQuery()),
    morePayments: () => {
      void paymentPage.loadMore(paymentQuery());
    },
    moreRuns: () => {
      void runPage.loadMore(runQuery);
    },
  };
}

function tableOptions(list: FinListSignals, loadMore: () => void) {
  return {
    rows: list.rows.value,
    rowId: idOf,
    loading: list.loading.value,
    ...(list.loadError.value === '' ? {} : { error: list.loadError.value }),
    pagination: {
      loadedCount: list.rows.value.length,
      hasMore: list.nextCursor.value !== null,
      loading: list.loadingMore.value,
      onLoadMore: loadMore,
    },
  };
}

export function PaymentConsolePage(ports: PaymentPorts) {
  const model = createPaymentState(ports);
  const actionColumn = (tab: PaymentTab): DataTableColumn<FinRow> => ({
    key: 'actions',
    header: '操作',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid={tab === 'payments' ? 'kt-payment-open' : 'kt-payment-open-run'}
        onClick={() => {
          model.open(tab, row);
        }}
      >
        查看
      </button>
    ),
  });
  return function PaymentPage() {
    useEffect(() => {
      void model.reloadAll();
    }, []);
    const selected = model.selected.value;
    const tab = model.tab.value;
    const form = model.form.value;
    return (
      <FinPage
        testId="kt-payment-page"
        title="银行收款"
        description=""
        notice={model.notice.value}
        noticeHere={selected === null && form === null}
        actions={
          <>
            <button
              type="button"
              class="secondary"
              onClick={() => {
                void model.refresh();
              }}
            >
              刷新
            </button>
            {ports.permissions.has('bank-payment:intake') ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-payment-intake"
                onClick={() => {
                  model.close();
                  model.notice.value = '';
                  model.form.value = 'intake';
                }}
              >
                ＋ 登记银行收款
              </button>
            ) : null}
          </>
        }
      >
        <SummaryCards
          label="收款汇总"
          testId="kt-payment-summary"
          items={summaryCards(model.summary.value)}
        />
        <FinFilters
          testPrefix="kt-payment"
          chips={[
            { key: 'ALL', label: '全部' },
            { key: 'OPEN', label: '待核销' },
            { key: 'CLEARED', label: '已分配完毕' },
          ]}
          active={model.state.value}
          onSelect={(key) => {
            model.state.value = key;
            void model.reloadPayments();
          }}
          search={{
            value: model.search.value,
            applied: model.applied.value,
            placeholder: '搜索银行流水号或客户',
            onChange: (value) => {
              model.search.value = value;
            },
            onApply: () => {
              model.applied.value = model.search.value.trim();
              void model.reloadPayments();
            },
            onClear: () => {
              model.search.value = '';
              model.applied.value = '';
              void model.reloadPayments();
            },
          }}
        />
        <DataTable
          {...tableOptions(model.payments, model.morePayments)}
          caption="银行收款记录"
          columns={[...paymentColumns, actionColumn('payments')]}
          emptyTitle="暂无银行收款"
        />
        {model.canReadRuns ? (
          <section class="fin-section" data-testid="kt-payment-runs">
            <h3>核销运行</h3>
            <DataTable
              {...tableOptions(model.runs, model.moreRuns)}
              caption="核销运行记录（最近运行在前）"
              columns={[...runColumns, actionColumn('reconciliations')]}
              emptyTitle="暂无核销运行"
            />
          </section>
        ) : null}
        {selected ? (
          <PaymentDetail
            tab={tab}
            row={selected}
            notice={model.notice.value}
            canRun={tab === 'payments' && paymentCanRun(selected, ports.permissions)}
            busy={model.busy.value}
            runningForm={form === 'reconcile'}
            error={model.error.value}
            onOpenRun={() => {
              model.notice.value = '';
              model.error.value = '';
              model.form.value = 'reconcile';
            }}
            onClose={model.close}
            onSubmitRun={model.confirmRun}
          />
        ) : null}
        {form === 'intake' ? (
          <PaymentIntake
            customers={ports.customers}
            error={model.error.value}
            onClose={model.close}
            onSubmit={model.intake}
          />
        ) : null}
        <ConsoleConfirmDialog pending={model.confirmation} />
      </FinPage>
    );
  };
}
