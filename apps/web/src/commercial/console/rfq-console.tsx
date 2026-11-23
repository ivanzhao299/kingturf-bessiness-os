import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
  type StatusTone,
} from '@kingturf/ui';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';

// U3-PROC-2（ADR-0014 分域重写）：询价控制台——原 vanilla sourcing-register RFQ 能力面
// 等价迁移（新建并发出询价单载荷逐字节一致；报价登记表单属 supplier-quotes 域，保留
// vanilla 至 U3-PROC-3）。新增行级发布/关闭（PUT state 统一动作端点；close 为主协调
// U3-PROC-2 指令明授的新写路径）；详情抽屉含行项与报价对比（additive findRfq）。
type RfqFormKind = 'create' | null;

type RfqPageState = Readonly<{
  rfqs: readonly RfqRow[];
  statusFilter: 'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: RfqRow | null;
  detailLoading: boolean;
  activeForm: RfqFormKind;
  permissions: ReadonlySet<string>;
  ports: RfqConsolePorts;
  open: (row: RfqRow | null) => void;
  openForm: (kind: RfqFormKind) => void;
  closeForm: () => void;
  setStatusFilter: (
    next: 'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED',
  ) => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: RfqRow, action: 'issue' | 'close') => Promise<void>;
  shownCount: number;
  showMore: () => void;
}>;

// businessStateLabel 同口径（procurement_document_status 五值均有标签）。
const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  ISSUED: '已签发',
  PARTIALLY_RECEIVED: '部分收货',
  RECEIVED: '已收货',
  CANCELLED: '已取消',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'ISSUED' || status === 'RECEIVED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'DRAFT') return 'info';
  return 'neutral';
};

const text = (ports: RfqConsolePorts, row: RfqRow, camel: string, snake: string, fallback = '') =>
  ports.recordText(row, camel, snake, fallback);

const linesOf = (row: RfqRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

const quotesOf = (row: RfqRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.quotes) ? (row.quotes as Record<string, unknown>[]) : [];

const columns = (state: RfqPageState): readonly DataTableColumn<RfqRow>[] => [
  {
    key: 'rfq',
    header: '询价单',
    field: (row) => text(state.ports, row, 'rfqNumber', 'rfq_number'),
    render: (row) => (
      <span>
        {text(state.ports, row, 'rfqNumber', 'rfq_number')} ·{' '}
        {STATUS_LABELS[text(state.ports, row, 'status', 'status')] ??
          text(state.ports, row, 'status', 'status')}
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => text(state.ports, row, 'status', 'status'),
    render: (row) => {
      const status = text(state.ports, row, 'status', 'status');
      return <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>;
    },
  },
  {
    key: 'lines',
    header: '行项',
    field: (row) => linesOf(row).length,
    render: (row) => `${String(linesOf(row).length)} 项`,
  },
  {
    key: 'due',
    header: '报价截止',
    field: (row) => text(state.ports, row, 'responseDueAt', 'response_due_at'),
    render: (row) =>
      `${text(state.ports, row, 'responseDueAt', 'response_due_at', '—').slice(0, 10)} · ${text(state.ports, row, 'currency', 'currency', '—')}`,
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-rfq-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredRfqs = (state: RfqPageState): readonly RfqRow[] =>
  state.rfqs.filter((row) => {
    const status = text(state.ports, row, 'status', 'status');
    if (state.statusFilter !== 'ALL' && status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const haystack = `${text(state.ports, row, 'rfqNumber', 'rfq_number')}${status}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const RfqLines = ({ state }: Readonly<{ state: RfqPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  if (lines.length === 0)
    return (
      <p class="console-label" data-testid="kt-rfq-lines-empty">
        尚无询价行项
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-rfq-lines">
      {lines.map((line, index) => (
        <li key={state.ports.textValue(line.id, String(index))}>
          {`${state.ports.textValue(line.sku, '—')} · ${state.ports.textValue(line.itemName, '—')} · 数量 ${state.ports.textValue(line.quantity, '—')} · 要求到货 ${state.ports.textValue(line.requiredAt ?? line.required_at, '—')}`}
        </li>
      ))}
    </ul>
  );
};

const QuoteComparison = ({ state }: Readonly<{ state: RfqPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const quotes = quotesOf(row);
  if (quotes.length === 0) return null;
  return (
    <div class="console-summary" data-testid="kt-rfq-quotes">
      <p class="console-label">报价对比</p>
      <ul>
        {quotes.map((quote, index) => (
          <li key={state.ports.textValue(quote.id, String(index))}>
            {`${state.ports.textValue(quote.supplierName ?? quote.supplier_name, '—')} · ${state.ports.textValue(quote.quoteReference ?? quote.quote_reference, '—')} · 收于 ${state.ports.textValue(quote.receivedAt ?? quote.received_at, '—').slice(0, 10)} · 有效至 ${state.ports.textValue(quote.validUntil ?? quote.valid_until, '—')}`}
            <ul>
              {(Array.isArray(quote.lines) ? (quote.lines as Record<string, unknown>[]) : []).map(
                (line, lineIndex) => (
                  <li key={state.ports.textValue(line.id, String(lineIndex))}>
                    {`行 ${state.ports.textValue(line.lineNumber ?? line.line_number, String(lineIndex + 1))} · ${state.ports.textValue(line.sku, '—')} · 单价 ${state.ports.textValue(line.unitPrice ?? line.unit_price, '—')} · 承诺 ${state.ports.textValue(line.promisedAt ?? line.promised_at, '—')} · MOQ ${state.ports.textValue(line.minimumOrderQuantity ?? line.minimum_order_quantity, '—')}`}
                  </li>
                ),
              )}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

const RfqDrawer = ({ state }: Readonly<{ state: RfqPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports, permissions } = state;
  const status = text(ports, row, 'status', 'status');
  const mayManage = permissions.has('procurement:manage');
  const mayIssue = mayManage && status === 'DRAFT';
  const mayClose = mayManage && (status === 'DRAFT' || status === 'ISSUED');
  return (
    <DetailDrawer
      title={`询价单详情 · ${text(ports, row, 'rfqNumber', 'rfq_number')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-rfq-detail">
        <p>
          <span class="console-label">状态</span>
          <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>
          <span class="console-label">币种</span>
          {text(ports, row, 'currency', 'currency', '—')}
          <span class="console-label">截止</span>
          {text(ports, row, 'responseDueAt', 'response_due_at', '—').slice(0, 10)}
        </p>
      </div>
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-rfq-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-rfq-actions">
          {mayIssue ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-rfq-issue"
              onClick={() => {
                void state.runState(row, 'issue');
              }}
            >
              发布询价
            </button>
          ) : null}
          {mayClose ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-rfq-close"
              onClick={() => {
                void state.runState(row, 'close');
              }}
            >
              关闭询价
            </button>
          ) : null}
        </div>
      ) : null}
      {state.detailLoading ? <p class="console-label">详情加载中…</p> : null}
      <p class="console-label">询价行项</p>
      <RfqLines state={state} />
      <QuoteComparison state={state} />
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: RfqPageState }>) => (
  <DetailDrawer title="创建采购询价" onClose={state.closeForm}>
    <FormSection
      title="创建采购询价"
      description="选择已发布物料版本并明确数量、交期和报价截止时间。"
      fields={[
        { name: 'rfqNumber', label: '询价单编号', required: true },
        state.ports.itemVersionChoices.length > 0
          ? ({
              name: 'itemVersionId',
              label: '采购物料',
              type: 'select',
              required: true,
              options: state.ports.itemVersionChoices,
            } satisfies FormSectionField)
          : ({
              name: 'itemVersionId',
              label: '物料版本编号',
              required: true,
            } satisfies FormSectionField),
        { name: 'quantity', label: '询价数量', type: 'number', required: true },
        { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
        { name: 'responseDue', label: '报价截止日', type: 'date', required: true },
      ]}
      submitLabel="发出询价单"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const RfqView = (state: RfqPageState) => {
  const visible = filteredRfqs(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('procurement:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-rfq-page">
      <PageHeader
        title="询价管理"
        description="询价单创建、发布与关闭，行项与报价对比"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-rfq-refresh"
              onClick={() => {
                void state.runRefresh();
              }}
            >
              刷新
            </button>
            {mayCreate ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-rfq-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建并发出询价单
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const).map(
          (option) => (
            <button
              key={option}
              type="button"
              class={
                state.statusFilter === option ? 'secondary compact active' : 'secondary compact'
              }
              data-testid={`kt-rfq-filter-${option.toLowerCase()}`}
              onClick={() => {
                state.setStatusFilter(option);
              }}
            >
              {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
            </button>
          ),
        )}
        <input
          type="search"
          placeholder="搜索询价单编号或状态"
          data-testid="kt-rfq-search"
          value={state.search}
          onInput={(event) => {
            state.setSearch((event.target as { value?: string }).value ?? '');
          }}
        />
      </div>
      {state.loadError !== '' ? (
        <p class="console-error" role="alert">
          {state.loadError}
        </p>
      ) : null}
      <DataTable
        columns={columns(state)}
        rows={shown}
        rowId={(row) => state.ports.textValue(row.id ?? row.rfq_number, 'row')}
        caption="询价单主列表（状态、行项与报价截止）"
        loading={state.loading}
        pagination={{
          loadedCount: shown.length,
          hasMore: visible.length > shown.length,
          loading: false,
          onLoadMore: () => {
            state.showMore();
          },
        }}
        {...(state.loadError === '' ? {} : { error: state.loadError })}
        emptyTitle="暂无询价单"
        emptyDescription="新建询价单后会出现在这里"
      />
      {state.selected ? <RfqDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function RfqConsolePage(ports: RfqConsolePorts) {
  const bundle = {
    rfqs: signal<readonly RfqRow[]>([...ports.initialRfqs]),
    statusFilter: signal<
      'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
    >('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<RfqRow | null>(null),
    detailLoading: signal(false),
    activeForm: signal<RfqFormKind>(null),
    shownCount: signal(20),
  };

  const fail = (error: unknown, fallback: string): void => {
    const message = error instanceof Error ? error.message : fallback;
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = message;
    else bundle.loadError.value = message;
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.rfqs.value = await ports.refresh();
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '询价单加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 创建载荷与原 vanilla「新建并发出询价单」表单逐字节一致（responseDueAt 拼接
  // T23:59:59.000Z、currency 固定 CNY、issue:true、单行项）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/procurement-rfqs', {
        rfqNumber: values.rfqNumber ?? '',
        responseDueAt: `${values.responseDue ?? ''}T23:59:59.000Z`,
        currency: 'CNY',
        issue: true,
        lines: [
          {
            itemVersionId: values.itemVersionId ?? '',
            quantity: values.quantity ?? '',
            requiredAt: values.requiredAt ?? '',
          },
        ],
      });
      bundle.rfqs.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, '询价单创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 状态流转走统一动作端点（PUT state：issue 分派 legacy issueRfq；close additive）。
  const runState = async (row: RfqRow, action: 'issue' | 'close'): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/procurement-rfqs/${ports.textValue(row.id, '')}/state`,
        { action },
        'PUT',
      );
      bundle.rfqs.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, '询价单状态流转失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): RfqPageState => ({
    rfqs: bundle.rfqs.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    detailLoading: bundle.detailLoading.value,
    activeForm: bundle.activeForm.value,
    permissions: ports.permissions,
    ports,
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      if (!row) return;
      // 详情读取失败静默回退列表行（行项/报价对比区按列表行数据呈现）。
      bundle.detailLoading.value = true;
      void ports
        .loadDetail(ports.textValue(row.id, ''))
        .then((detail) => {
          if (detail) bundle.selected.value = detail;
        })
        .catch(() => undefined)
        .finally(() => {
          bundle.detailLoading.value = false;
        });
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.submitError.value = '';
    },
    closeForm,
    setStatusFilter: (next) => {
      bundle.statusFilter.value = next;
    },
    setSearch: (next) => {
      bundle.search.value = next;
    },
    showMore: () => {
      bundle.shownCount.value = bundle.shownCount.value + 20;
    },
    shownCount: bundle.shownCount.value,
    runRefresh,
    runCreate,
    runState,
  });

  const Page = () => RfqView(state());
  return Page;
}
