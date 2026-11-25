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
  CaseBadge,
  caseNumber,
  caseState,
  collectionStates,
  CollectionDetail,
} from './collection-detail';
import { CollectionCreateDrawer, collectionForms } from './collection-forms';
import { collectionSubmission, type CollectionForm } from './collection-payload';
import type { CollectionPorts } from './collection-ports';
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
  type FinRow,
} from './fin-kit';
import { reloadSelectedDetail, syncSelected } from './selected-sync';

const idOf = (row: FinRow): string => finText(row, 'id');
const columns: readonly DataTableColumn<FinRow>[] = [
  {
    key: 'number',
    header: '案件编号',
    sortable: true,
    field: caseNumber,
    render: (row) => <strong data-testid="kt-collection-number">{caseNumber(row) || '—'}</strong>,
  },
  {
    key: 'customer',
    header: '客户',
    sortable: true,
    field: (row) => finText(row, 'customerName') || '—',
  },
  {
    key: 'ar',
    header: '应收单号',
    sortable: true,
    field: (row) => finText(row, 'documentNumber') || '—',
  },
  {
    key: 'remaining',
    header: '未核销余额',
    align: 'right',
    sortable: true,
    field: (row) => finDecimalSortKey(row.remainingAmount),
    render: (row) => <FinAmount currency={row.currency} amount={row.remainingAmount} />,
  },
  {
    key: 'phase',
    header: '阶段',
    sortable: true,
    field: caseState,
    render: (row) => <CaseBadge row={row} />,
  },
  {
    key: 'assignee',
    header: '负责人',
    sortable: true,
    field: (row) => finText(row, 'assignedName') || '—',
  },
  {
    key: 'followup',
    header: '下次跟进',
    sortable: true,
    field: (row) => finText(row, 'nextActionAt'),
    render: (row) => <time class="fin-token">{finWhen(row, 'nextActionAt')}</time>,
  },
  {
    key: 'overdue',
    header: '跟进情况',
    sortable: true,
    field: (row) => (row.followupOverdue === true ? '已逾期' : ''),
    render: (row) =>
      row.followupOverdue === true ? (
        <StatusBadge tone="danger">跟进逾期</StatusBadge>
      ) : finText(row, 'nextActionAt') ? (
        '—'
      ) : (
        '未排期'
      ),
  },
];

const summaryCards = (rows: readonly FinRow[] | null): readonly SummaryCardItem[] => {
  if (!rows?.length)
    return [
      {
        id: 'active',
        label: '在办应收余额',
        value: '—',
        hint: rows === null ? '按币种汇总暂不可用' : '暂无催收案件',
      },
    ];
  return rows.flatMap((row) => {
    const currency = finText(row, 'currency');
    return [
      {
        id: `balance-${currency}`,
        label: '在办应收余额',
        value: finMoneyText(currency, row.activeBalance),
        hint: `${currency} · 未解决且未关闭的 ${finText(row, 'activeCount')} 件案件`,
      },
      {
        id: `overdue-${currency}`,
        label: '跟进逾期',
        value: finText(row, 'followupOverdueCount') || '—',
        hint: `${currency} · 在办案件中已过下次跟进时间的件数`,
      },
    ];
  });
};
const filters = [
  { key: 'ALL', label: '全部' },
  ...Object.entries(collectionStates).map(([key, label]) => ({ key, label })),
];
const CREATE = { action: 'create', subjectId: '' } as const satisfies CollectionForm;

function createCollectionState(ports: CollectionPorts) {
  const list = {
    rows: signal<readonly FinRow[]>([]),
    nextCursor: signal<string | null>(null),
    loading: signal(true),
    loadingMore: signal(false),
    loadError: signal(''),
  };
  const summary = signal<readonly FinRow[] | null>(null);
  const state = signal('ALL');
  const search = signal('');
  const applied = signal('');
  const selected = signal<FinRow | null>(null);
  const detailLoading = signal(false);
  const form = signal<CollectionForm | null>(null);
  const error = signal('');
  const notice = signal('');
  const busy = signal(false);
  const confirmation = createConfirm();
  const page = createFinList(ports.fetchPage, list, (value) => {
    summary.value = value.summary === undefined ? null : finRows(value.summary);
  });
  const query = () => ({
    limit: 50,
    summary: 1,
    state: state.value === 'ALL' ? '' : state.value,
    search: applied.value,
  });
  const reload = () => page.reload(query());
  const selection = () => ({ selected, rows: list.rows.value, idOf, loadDetail: ports.loadDetail });
  const closeForm = () => {
    form.value = null;
    error.value = '';
  };
  const close = () => {
    selected.value = null;
    detailLoading.value = false;
    closeForm();
  };
  const openForm = (next: CollectionForm) => {
    error.value = '';
    notice.value = '';
    form.value = next;
  };
  const open = async (row: FinRow): Promise<void> => {
    closeForm();
    selected.value = row;
    notice.value = '';
    detailLoading.value = true;
    await reloadSelectedDetail(selection());
    if (finText(selected.peek() ?? {}, 'id') === idOf(row)) detailLoading.value = false;
  };
  const reloadLedger = async (): Promise<void> => {
    await reload();
    const current = selection();
    if (list.loadError.value === '' && syncSelected(current)) await reloadSelectedDetail(current);
  };
  const refresh = async (): Promise<void> => {
    let refreshError = '';
    try {
      await ports.refresh();
    } catch (cause: unknown) {
      refreshError = failureMessage(cause, '关联业务数据刷新失败');
    }
    await reloadLedger();
    if (list.loadError.value === '' && refreshError !== '') list.loadError.value = refreshError;
  };
  const submit = async (
    current: CollectionForm,
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    if (busy.value || form.value !== current) return;
    busy.value = true;
    error.value = '';
    try {
      const { path, body } = collectionSubmission(current, values);
      await ports.submit(path, body);
      closeForm();
      notice.value = collectionForms[current.action].success;
      await refresh();
      ports.ledgerUpdates?.publish();
    } catch (cause: unknown) {
      error.value = failureMessage(cause, '催收操作失败');
    } finally {
      busy.value = false;
    }
  };
  const prepare = (values: Readonly<Record<string, string>>): Promise<void> | void => {
    const current = form.value;
    if (!current || busy.value) return;
    const info = collectionForms[current.action];
    if (!info.confirm) return submit(current, values);
    askConfirm(confirmation, {
      title: info.title,
      message: info.confirm,
      confirmLabel: info.submit,
      destructive: true,
      run: () => submit(current, values),
    });
  };
  return {
    list,
    summary,
    state,
    search,
    applied,
    selected,
    detailLoading,
    form,
    error,
    notice,
    busy,
    confirmation,
    close,
    closeForm,
    open,
    openForm,
    prepare,
    refresh,
    reload,
    reloadLedger,
    loadMore: () => {
      void page.loadMore(query());
    },
  };
}

export function CollectionConsolePage(ports: CollectionPorts) {
  const model = createCollectionState(ports);
  const tableColumns = [
    ...columns,
    {
      key: 'actions',
      header: '操作',
      render: (row: FinRow) => (
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-collection-open"
          onClick={() => {
            void model.open(row);
          }}
        >
          查看
        </button>
      ),
    },
  ];
  return function CollectionPage() {
    useEffect(() => {
      void model.reload();
      return ports.ledgerUpdates?.subscribe(model.reloadLedger);
    }, []);
    const form = model.form.value;
    const selected = model.selected.value;
    const list = model.list;
    const canCreate =
      ports.permissions.has('collection:manage') &&
      ports.receivables.length > 0 &&
      ports.employees.length > 0;
    return (
      <FinPage
        testId="kt-collection-page"
        title="催收案件"
        description=""
        notice={model.notice.value}
        noticeHere={form === null && selected === null}
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
            {canCreate ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-collection-create"
                onClick={() => {
                  model.close();
                  model.openForm(CREATE);
                }}
              >
                ＋ 建立催收案件
              </button>
            ) : null}
          </>
        }
      >
        <SummaryCards
          label="催收汇总"
          testId="kt-collection-summary"
          items={summaryCards(model.summary.value)}
        />
        <FinFilters
          testPrefix="kt-collection"
          chips={filters}
          active={model.state.value}
          onSelect={(value) => {
            model.state.value = value;
            void model.reload();
          }}
          search={{
            value: model.search.value,
            applied: model.applied.value,
            placeholder: '搜索案件号、客户或应收单号',
            onChange: (value) => {
              model.search.value = value;
            },
            onApply: () => {
              model.applied.value = model.search.value.trim();
              void model.reload();
            },
            onClear: () => {
              model.search.value = '';
              model.applied.value = '';
              void model.reload();
            },
          }}
        />
        <DataTable
          rows={list.rows.value}
          columns={tableColumns}
          rowId={idOf}
          caption="催收案件台账"
          loading={list.loading.value}
          {...(list.loadError.value === '' ? {} : { error: list.loadError.value })}
          emptyTitle="暂无符合条件的催收案件"
          pagination={{
            loadedCount: list.rows.value.length,
            loading: list.loadingMore.value,
            hasMore: list.nextCursor.value !== null,
            onLoadMore: model.loadMore,
          }}
        />
        {selected ? (
          <CollectionDetail
            row={selected}
            ports={ports}
            form={form}
            notice={model.notice.value}
            error={model.error.value}
            busy={model.busy.value}
            loading={model.detailLoading.value}
            close={model.close}
            closeForm={model.closeForm}
            openForm={model.openForm}
            submit={model.prepare}
          />
        ) : null}
        {form?.action === 'create' ? (
          <CollectionCreateDrawer
            action="create"
            row={null}
            ports={ports}
            error={model.error.value}
            onSubmit={model.prepare}
            onClose={model.close}
          />
        ) : null}
        <ConsoleConfirmDialog pending={model.confirmation} />
      </FinPage>
    );
  };
}
