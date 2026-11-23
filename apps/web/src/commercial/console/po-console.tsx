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
  PoLines,
  PurchaseDocuments,
  ProgressBar,
  ReceiptProgress,
  ReceiptProgressBars,
  STATUS_LABELS,
  StatusFlow,
  documentFormFields,
  receiptProgressOf,
  type DocumentFormKind,
} from './po-detail';
import { createPurchaseOrderActions } from './po-console-actions';
import type { ContractDocumentRow, PurchaseOrderConsolePorts, PurchaseOrderRow } from './po-ports';

// U3-PROC-3（ADR-0014 分域重写）：采购单控制台——原 vanilla purchase-register PO 能力
// 面等价迁移（创建并签发载荷逐字节一致；收货卡片/登记收货表单属 goods-receipts 域，
// 保留 vanilla 至 U3-PROC-4；采购合同文档工作流（上传/OCR/复核/送签）自 PO 卡片迁移
// 至详情抽屉）。行级签发/取消（PUT state 统一动作端点；cancel 为主协调 U3-PROC-3
// 指令授权的合法迁移；独立审批层缺失登记 TD-PROC-003）。
// PROC-UX：列表新增收货进度列；详情抽屉新增状态流转图与逐行/整单收货进度条。
type PoFormKind = 'create' | null;
type PoPageState = Readonly<{
  orders: readonly PurchaseOrderRow[];
  documents: readonly ContractDocumentRow[];
  statusFilter: 'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: PurchaseOrderRow | null;
  detailLoading: boolean;
  activeForm: PoFormKind;
  activeDocumentForm: Readonly<{ documentId: string; kind: DocumentFormKind }> | null;
  permissions: ReadonlySet<string>;
  ports: PurchaseOrderConsolePorts;
  open: (row: PurchaseOrderRow | null) => void;
  openForm: (kind: PoFormKind) => void;
  closeForm: () => void;
  openDocumentForm: (documentId: string, kind: DocumentFormKind) => void;
  closeDocumentForm: () => void;
  setStatusFilter: (
    next: 'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED',
  ) => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: PurchaseOrderRow, action: 'issue' | 'cancel') => Promise<void>;
  runUpload: (orderId: string, file: File) => Promise<void>;
  runDocumentAction: (
    documentId: string,
    kind: DocumentFormKind,
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
  shownCount: number;
  showMore: () => void;
}>;

const statusTone = (status: unknown): StatusTone => {
  if (status === 'ISSUED' || status === 'RECEIVED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'DRAFT') return 'info';
  return 'neutral';
};

const text = (
  ports: PurchaseOrderConsolePorts,
  row: PurchaseOrderRow,
  camel: string,
  snake: string,
  fallback = '',
) => ports.recordText(row, camel, snake, fallback);

const linesOf = (row: PurchaseOrderRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

// 人民币合计：vanilla 卡片口径（Σ 数量×单价，decimalValue 格式化）。
const orderTotal = (ports: PurchaseOrderConsolePorts, row: PurchaseOrderRow): string => {
  const total = linesOf(row).reduce(
    (sum, line) =>
      sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? line.unitPrice ?? 0),
    0,
  );
  return ports.decimalValue(total);
};

// 列表收货进度单元：草稿未签发不呈进度条；其余按 Σ已收/Σ订购 呈百分比条。
const ProgressCell = ({ state, row }: Readonly<{ state: PoPageState; row: PurchaseOrderRow }>) => {
  if (text(state.ports, row, 'status', 'status') === 'DRAFT')
    return <span class="console-label">未签发</span>;
  const progress = receiptProgressOf(linesOf(row));
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--kt-space-2)',
        width: '100%',
        minWidth: '140px',
      }}
    >
      <ProgressBar
        value={progress.percent}
        label={`${text(state.ports, row, 'poNumber', 'po_number')}收货进度`}
      />
      <span data-testid="kt-po-progress-cell" data-percent={progress.percent}>
        {`${String(progress.percent)}%`}
      </span>
    </span>
  );
};

const columns = (state: PoPageState): readonly DataTableColumn<PurchaseOrderRow>[] => [
  {
    key: 'order',
    header: '采购订单',
    field: (row) => text(state.ports, row, 'poNumber', 'po_number'),
    render: (row) => (
      <span>
        {text(state.ports, row, 'poNumber', 'po_number')} ·{' '}
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
    key: 'supplier',
    header: '供应商',
    field: (row) => text(state.ports, row, 'supplierName', 'supplierName'),
    render: (row) => text(state.ports, row, 'supplierName', 'supplierName', '—'),
  },
  {
    key: 'total',
    header: '金额',
    field: (row) => orderTotal(state.ports, row),
    render: (row) =>
      `${text(state.ports, row, 'currency', 'currency', '—')} ${orderTotal(state.ports, row)}`,
  },
  {
    key: 'lines',
    header: '行项',
    field: (row) => linesOf(row).length,
    render: (row) => `${String(linesOf(row).length)} 项`,
  },
  {
    key: 'progress',
    header: '收货进度',
    sortable: true,
    field: (row) => receiptProgressOf(linesOf(row)).percent,
    render: (row) => <ProgressCell state={state} row={row} />,
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-po-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredOrders = (state: PoPageState): readonly PurchaseOrderRow[] =>
  state.orders.filter((row) => {
    const status = text(state.ports, row, 'status', 'status');
    if (state.statusFilter !== 'ALL' && status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const haystack =
      `${text(state.ports, row, 'poNumber', 'po_number')}${text(state.ports, row, 'supplierName', 'supplierName')}${status}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const PoDrawer = ({ state }: Readonly<{ state: PoPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports, permissions } = state;
  const status = text(ports, row, 'status', 'status');
  const mayManage = permissions.has('procurement:manage');
  const mayIssue = mayManage && status === 'DRAFT';
  const mayCancel = mayManage && (status === 'DRAFT' || status === 'ISSUED');
  const activeDocument = state.activeDocumentForm
    ? (state.documents.find(
        (item) => ports.textValue(item.id, '') === state.activeDocumentForm?.documentId,
      ) ?? null)
    : null;
  return (
    <DetailDrawer
      title={`采购订单详情 · ${text(ports, row, 'poNumber', 'po_number')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-po-detail">
        <p>
          <span class="console-label">状态</span>
          <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>
          <span class="console-label">供应商</span>
          {text(ports, row, 'supplierName', 'supplierName', '—')}
          <span class="console-label">币种</span>
          {text(ports, row, 'currency', 'currency', '—')}
        </p>
        <p>
          <span class="console-label">签发时间</span>
          {text(ports, row, 'orderedAt', 'ordered_at', '—').slice(0, 10)}
          <span class="console-label">金额</span>
          {orderTotal(ports, row)}
        </p>
      </div>
      <StatusFlow state={state} />
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-po-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-po-actions">
          {mayIssue ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-po-issue"
              onClick={() => {
                void state.runState(row, 'issue');
              }}
            >
              签发订单
            </button>
          ) : null}
          {mayCancel ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-po-cancel"
              onClick={() => {
                void state.runState(row, 'cancel');
              }}
            >
              取消订单
            </button>
          ) : null}
        </div>
      ) : null}
      {state.detailLoading ? <p class="console-label">详情加载中…</p> : null}
      <p class="console-label">订单行项</p>
      <PoLines state={state} />
      <ReceiptProgressBars state={state} />
      <ReceiptProgress state={state} />
      <PurchaseDocuments state={state} />
      {state.activeDocumentForm && activeDocument ? (
        <FormSection
          title={
            state.activeDocumentForm.kind === 'ocr'
              ? '采购合同 OCR 识别结果'
              : state.activeDocumentForm.kind === 'review'
                ? '复核采购合同'
                : '发起采购合同电子签署'
          }
          description={
            state.activeDocumentForm.kind === 'ocr'
              ? '识别内容完成复核后才能发起签署。'
              : state.activeDocumentForm.kind === 'review'
                ? '请对照原件校正全文与关键字段。'
                : '录入签署平台任务信息并按顺序通知签署人。'
          }
          fields={documentFormFields(state, activeDocument, state.activeDocumentForm.kind)}
          submitLabel={
            state.activeDocumentForm.kind === 'ocr'
              ? '保存识别结果'
              : state.activeDocumentForm.kind === 'review'
                ? '确认可送签'
                : '确认发起'
          }
          onSubmit={(values) =>
            state.runDocumentAction(
              state.activeDocumentForm?.documentId ?? '',
              state.activeDocumentForm?.kind ?? 'ocr',
              values,
            )
          }
        />
      ) : null}
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: PoPageState }>) => (
  <DetailDrawer title="创建采购订单" onClose={state.closeForm}>
    <FormSection
      title="创建采购订单"
      description="订单只允许选择已准入供应商和已发布物料版本。"
      fields={[
        { name: 'poNumber', label: '采购订单号', required: true },
        state.ports.supplierChoices.length > 0
          ? ({
              name: 'supplierId',
              label: '供应商',
              type: 'select',
              required: true,
              options: state.ports.supplierChoices,
            } satisfies FormSectionField)
          : ({
              name: 'supplierId',
              label: '供应商编号',
              required: true,
            } satisfies FormSectionField),
        state.ports.itemVersionChoices.length > 0
          ? ({
              name: 'itemVersionId',
              label: '物料',
              type: 'select',
              required: true,
              options: state.ports.itemVersionChoices,
            } satisfies FormSectionField)
          : ({
              name: 'itemVersionId',
              label: '物料版本编号',
              required: true,
            } satisfies FormSectionField),
        { name: 'quantity', label: '数量', type: 'number', required: true },
        { name: 'unitPrice', label: '含税单价', type: 'number', required: true },
        { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
      ]}
      submitLabel="签发采购订单"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const PoView = (state: PoPageState) => {
  const visible = filteredOrders(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('procurement:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-po-page">
      <PageHeader
        title="采购订单"
        description="采购订单签发、取消与收货进度，采购合同文件工作流"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-po-refresh"
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
                data-testid="kt-po-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 创建并签发采购订单
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
              data-testid={`kt-po-filter-${option.toLowerCase()}`}
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
          placeholder="搜索采购订单号、供应商或状态"
          data-testid="kt-po-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.po_number, 'row')}
        caption="采购订单主列表（状态、供应商、金额与收货进度）"
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
        emptyTitle="暂无采购订单"
        emptyDescription="创建采购订单后会出现在这里"
      />
      {state.selected ? <PoDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function PurchaseOrderConsolePage(ports: PurchaseOrderConsolePorts) {
  const bundle = {
    orders: signal<readonly PurchaseOrderRow[]>([...ports.initialOrders]),
    documents: signal<readonly ContractDocumentRow[]>([...ports.initialDocuments]),
    statusFilter: signal<
      'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
    >('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<PurchaseOrderRow | null>(null),
    detailLoading: signal(false),
    activeForm: signal<PoFormKind>(null),
    activeDocumentForm: signal<Readonly<{ documentId: string; kind: DocumentFormKind }> | null>(
      null,
    ),
    shownCount: signal(20),
  };

  const { closeForm, runRefresh, runCreate, runState, runUpload, runDocumentAction } =
    createPurchaseOrderActions(ports, bundle);

  const state = (): PoPageState => ({
    orders: bundle.orders.value,
    documents: bundle.documents.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    detailLoading: bundle.detailLoading.value,
    activeForm: bundle.activeForm.value,
    activeDocumentForm: bundle.activeDocumentForm.value,
    permissions: ports.permissions,
    ports,
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.activeDocumentForm.value = null;
      bundle.submitError.value = '';
      if (!row) return;
      // 详情读取失败静默回退列表行（行项收货状态/收货记录按列表行数据呈现）。
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
    openDocumentForm: (documentId, kind) => {
      bundle.activeDocumentForm.value = { documentId, kind };
      bundle.submitError.value = '';
    },
    closeDocumentForm: () => {
      bundle.activeDocumentForm.value = null;
    },
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
    runUpload,
    runDocumentAction,
  });

  const Page = () => PoView(state());
  return Page;
}
