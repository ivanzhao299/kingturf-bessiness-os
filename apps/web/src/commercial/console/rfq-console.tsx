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
import {
  CountdownBadge,
  QuoteComparison,
  RfqLines,
  activeCountdown,
  linesOf,
} from './rfq-console-detail';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';
import { failureMessage } from '../../shared/api-error-message';
import {
  askConfirm,
  ConsoleConfirmDialog,
  createConfirm,
  type ConfirmSignal,
} from './console-confirm';

// U3-PROC-2（ADR-0014 分域重写）：询价控制台——原 vanilla sourcing-register RFQ 能力面
// 等价迁移（新建并发出询价单载荷逐字节一致；报价登记表单属 supplier-quotes 域，保留
// vanilla 至 U3-PROC-3）。新增行级发布/关闭（PUT state 统一动作端点；close 为主协调
// U3-PROC-2 指令明授的新写路径）；详情抽屉含行项与报价对比（additive findRfq）。
// PROC-UX：报价对比升级为行项×供应商矩阵（推荐项标记）；已签发询价单呈截止倒计时徽章。
// 详情子组件见 rfq-console-detail.tsx。
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
  // 当前时间源（截止倒计时；测试可注入固定时钟）。
  now: () => Date;
  // TD-WF-014②：等待确认的不可逆动作（发布 / 关闭询价）；null 表示没有确认框。
  confirm: ConfirmSignal;
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

// 报价截止单元：日期（ISO 前 10 位）· 币种，其后是已签发询价单的截止倒计时徽章。
// TD-WF-014⑦：徽章紧跟在币种文字后面、中间没有任何分隔，读起来是「CNY剩 14 天」——
// 币种与倒计时连成了一句。两者以「 · 」分开，各自成段。
const DueCell = ({ state, row }: Readonly<{ state: RfqPageState; row: RfqRow }>) => {
  const countdown = activeCountdown(state, row);
  return (
    <span>
      {`${text(state.ports, row, 'responseDueAt', 'response_due_at', '—').slice(0, 10)} · ${text(state.ports, row, 'currency', 'currency', '—')}`}
      {countdown === null ? null : (
        <>
          {' · '}
          <CountdownBadge countdown={countdown} />
        </>
      )}
    </span>
  );
};

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
    render: (row) => <DueCell state={state} row={row} />,
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

const RfqDrawer = ({ state }: Readonly<{ state: RfqPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports, permissions } = state;
  const status = text(ports, row, 'status', 'status');
  const mayManage = permissions.has('procurement:manage');
  const mayIssue = mayManage && status === 'DRAFT';
  const mayClose = mayManage && (status === 'DRAFT' || status === 'ISSUED');
  const countdown = activeCountdown(state, row);
  return (
    // 宽抽屉：询价行项与「行项 × 供应商」报价对比矩阵在缺省宽度里读不了（TD-PROC-008 残余，PROC-3）。
    <DetailDrawer
      size="wide"
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
          {countdown === null ? null : <CountdownBadge countdown={countdown} />}
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
                // TD-WF-014②：发布后询价单进入询价，先确认。
                const number = text(ports, row, 'rfqNumber', 'rfq_number');
                askConfirm(state.confirm, {
                  title: '发布询价',
                  message: `发布后询价单 ${number} 进入询价，供应商可以提交报价。`,
                  confirmLabel: '确认发布',
                  run: () => state.runState(row, 'issue'),
                });
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
                // TD-WF-014②：关闭后不再接收报价，先确认（破坏性动作：初焦在「取消」上）。
                const number = text(ports, row, 'rfqNumber', 'rfq_number');
                askConfirm(state.confirm, {
                  title: '关闭询价',
                  message: `关闭后询价单 ${number} 不再接收报价。`,
                  confirmLabel: '确认关闭',
                  destructive: true,
                  run: () => state.runState(row, 'close'),
                });
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
      error={state.submitError}
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
        caption="询价单主列表（状态、行项、报价截止与倒计时）"
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
      <ConsoleConfirmDialog pending={state.confirm} />
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
    confirm: createConfirm(),
  };

  const fail = (error: unknown, fallback: string): void => {
    const message = failureMessage(error, fallback);
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
    now: () => ports.now?.() ?? new Date(),
    confirm: bundle.confirm,
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
