import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import type { GoodsReceiptConsolePorts, GoodsReceiptRow } from './gr-ports';

// U3-PROC-4（ADR-0014 分域重写）：收货控制台——原 vanilla 收货卡片与「登记批次
// 收货」表单能力面等价迁移（登记载荷与 vanilla 逐字节一致：receivedAt 当前时刻、
// expiresAt null、manufacturedAt 必填日期）。部分收货/超收守护全在后端 legacy
// receive() 同链（前端不重复实现）；收货单不可变（无状态流转行级操作）。
type GrFormKind = 'create' | null;

type GrPageState = Readonly<{
  receipts: readonly GoodsReceiptRow[];
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: GoodsReceiptRow | null;
  detailLoading: boolean;
  activeForm: GrFormKind;
  permissions: ReadonlySet<string>;
  ports: GoodsReceiptConsolePorts;
  open: (row: GoodsReceiptRow | null) => void;
  openForm: (kind: GrFormKind) => void;
  closeForm: () => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  shownCount: number;
  showMore: () => void;
}>;

const text = (
  ports: GoodsReceiptConsolePorts,
  row: GoodsReceiptRow,
  camel: string,
  snake: string,
  fallback = '',
) => ports.recordText(row, camel, snake, fallback);

const linesOf = (row: GoodsReceiptRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

const poOf = (row: GoodsReceiptRow | null): Record<string, unknown> | null => {
  const po = row?.purchaseOrder;
  return typeof po === 'object' && po !== null ? (po as Record<string, unknown>) : null;
};

const columns = (state: GrPageState): readonly DataTableColumn<GoodsReceiptRow>[] => [
  {
    key: 'receipt',
    header: '收货单',
    field: (row) => text(state.ports, row, 'receiptNumber', 'receipt_number'),
    render: (row) => (
      <span>
        {`收货 ${text(state.ports, row, 'receiptNumber', 'receipt_number')} · ${text(state.ports, row, 'poNumber', 'poNumber', '—')}`}
      </span>
    ),
  },
  {
    key: 'batches',
    header: '批次',
    field: (row) => linesOf(row).length,
    render: (row) => `${String(linesOf(row).length)} 批`,
  },
  {
    key: 'receivedAt',
    header: '收货时间',
    field: (row) => text(state.ports, row, 'receivedAt', 'received_at'),
    render: (row) => text(state.ports, row, 'receivedAt', 'received_at', '—').slice(0, 10),
  },
  {
    key: 'source',
    header: '送货单号',
    field: (row) => text(state.ports, row, 'sourceReference', 'source_reference'),
    render: (row) => text(state.ports, row, 'sourceReference', 'source_reference', '—'),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-gr-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredReceipts = (state: GrPageState): readonly GoodsReceiptRow[] =>
  state.receipts.filter((row) => {
    if (state.search === '') return true;
    const haystack =
      `${text(state.ports, row, 'receiptNumber', 'receipt_number')}${text(state.ports, row, 'poNumber', 'poNumber')}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const ReceiptLines = ({ state }: Readonly<{ state: GrPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  if (lines.length === 0)
    return (
      <p class="console-label" data-testid="kt-gr-lines-empty">
        尚无收货行项
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-gr-lines">
      {lines.map((line, index) => (
        <li key={state.ports.textValue(line.id, String(index))}>
          {`${state.ports.textValue(line.sku, '—')} · 批次 ${state.ports.textValue(line.lotNumber ?? line.lot_number, '—')} · 库位 ${state.ports.textValue(line.locationCode ?? line.location_code, '—')} · 实收 ${state.ports.textValue(line.quantity, '—')}`}
        </li>
      ))}
    </ul>
  );
};

// 数量核对：关联采购单行项 订购数量 vs 已收数量（additive 详情 purchaseOrder 区）。
const QuantityCheck = ({ state }: Readonly<{ state: GrPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const po = poOf(row);
  if (!po) return null;
  const lines = Array.isArray(po.lines) ? (po.lines as Record<string, unknown>[]) : [];
  return (
    <div class="console-summary" data-testid="kt-gr-quantity-check">
      <p class="console-label">
        {`数量核对 · ${state.ports.textValue(po.poNumber ?? po.po_number, '—')} · ${state.ports.textValue(po.status, '—')}`}
      </p>
      <ul>
        {lines.map((line, index) => (
          <li key={state.ports.textValue(line.id, String(index))}>
            {`${state.ports.textValue(line.sku, '—')} · 订购 ${state.ports.textValue(line.quantity, '—')} · 已收 ${state.ports.textValue(line.receivedQuantity ?? line.received_quantity, '0')}`}
          </li>
        ))}
      </ul>
    </div>
  );
};

const GrDrawer = ({ state }: Readonly<{ state: GrPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  return (
    <DetailDrawer
      title={`收货单详情 · ${text(ports, row, 'receiptNumber', 'receipt_number')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-gr-detail">
        <p>
          <span class="console-label">采购订单</span>
          {text(ports, row, 'poNumber', 'poNumber', '—')}
          <span class="console-label">收货时间</span>
          {text(ports, row, 'receivedAt', 'received_at', '—').slice(0, 10)}
          <span class="console-label">送货单号</span>
          {text(ports, row, 'sourceReference', 'source_reference', '—')}
        </p>
      </div>
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-gr-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.detailLoading ? <p class="console-label">详情加载中…</p> : null}
      <p class="console-label">批次行项</p>
      <ReceiptLines state={state} />
      <QuantityCheck state={state} />
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: GrPageState }>) => (
  <DetailDrawer title="登记采购收货" onClose={state.closeForm}>
    <FormSection
      title="登记采购收货"
      description="收货将同时建立批次、收货证据和不可变 RECEIPT 库存移动。"
      fields={[
        state.ports.openOrderLineChoices.length > 0
          ? ({
              name: 'orderLine',
              label: '采购订单行',
              type: 'select',
              required: true,
              options: state.ports.openOrderLineChoices,
            } satisfies FormSectionField)
          : ({
              name: 'orderLine',
              label: '订单行编号（订单|行）',
              required: true,
            } satisfies FormSectionField),
        { name: 'receiptNumber', label: '收货单号', required: true },
        { name: 'sourceReference', label: '送货单号', required: true },
        { name: 'lotNumber', label: '供应批次号', required: true },
        state.ports.locationChoices.length > 0
          ? ({
              name: 'locationCode',
              label: '入库库位',
              type: 'select',
              required: true,
              options: state.ports.locationChoices,
            } satisfies FormSectionField)
          : ({
              name: 'locationCode',
              label: '入库库位代码',
              required: true,
            } satisfies FormSectionField),
        { name: 'quantity', label: '实收数量', type: 'number', required: true },
        { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
      ]}
      submitLabel="过账收货"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const GrView = (state: GrPageState) => {
  const visible = filteredReceipts(state);
  const shown = visible.slice(0, state.shownCount);
  const mayReceive = state.permissions.has('procurement:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-gr-page">
      <PageHeader
        title="收货管理"
        description="批次收货登记与数量核对（收货单不可变）"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-gr-refresh"
              onClick={() => {
                void state.runRefresh();
              }}
            >
              刷新
            </button>
            {mayReceive ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-gr-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 登记批次收货
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        <input
          type="search"
          placeholder="搜索收货单号或采购订单号"
          data-testid="kt-gr-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.receipt_number, 'row')}
        caption="收货单主列表（批次、收货时间与送货单号）"
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
        emptyTitle="暂无收货单"
        emptyDescription="登记收货后会出现在这里"
      />
      {state.selected ? <GrDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function GoodsReceiptConsolePage(ports: GoodsReceiptConsolePorts) {
  const bundle = {
    receipts: signal<readonly GoodsReceiptRow[]>([...ports.initialReceipts]),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<GoodsReceiptRow | null>(null),
    detailLoading: signal(false),
    activeForm: signal<GrFormKind>(null),
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
      bundle.receipts.value = await ports.refresh();
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '收货单加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 登记载荷与原 vanilla「登记批次收货」表单逐字节一致（receivedAt 当前时刻、
  // expiresAt null；部分收货/超收守护全在后端 legacy receive() 同链）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      const [purchaseOrderId, purchaseOrderLineId] = (values.orderLine ?? '').split('|');
      await ports.submit('/api/v1/goods-receipts', {
        receiptNumber: values.receiptNumber ?? '',
        purchaseOrderId: purchaseOrderId ?? '',
        receivedAt: new Date().toISOString(),
        sourceReference: values.sourceReference ?? '',
        lines: [
          {
            purchaseOrderLineId: purchaseOrderLineId ?? '',
            lotNumber: values.lotNumber ?? '',
            locationCode: values.locationCode ?? '',
            quantity: values.quantity ?? '',
            manufacturedAt: values.manufacturedAt ?? '',
            expiresAt: null,
          },
        ],
      });
      bundle.receipts.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, '收货登记失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): GrPageState => ({
    receipts: bundle.receipts.value,
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
      // 详情读取失败静默回退列表行（批次行项按列表行数据呈现）。
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
    setSearch: (next) => {
      bundle.search.value = next;
    },
    showMore: () => {
      bundle.shownCount.value = bundle.shownCount.value + 20;
    },
    shownCount: bundle.shownCount.value,
    runRefresh,
    runCreate,
  });

  const Page = () => GrView(state());
  return Page;
}
