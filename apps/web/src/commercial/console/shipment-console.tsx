import { signal } from '@preact/signals';
import { DetailDrawer, PageHeader, SummaryCards, type DataTableColumn } from '@kingturf/ui';
import { render } from 'preact';
import type { ProductionOrderHostContext } from './production-order-host';
import { ConsoleConfirmDialog } from './console-confirm';
import { ConsoleNotice } from './console-notice';
import { perView } from './console-choices';
import { FocusAnchor } from './focus-anchor';
import { finDetailUrl, finReadPage } from './fin-host-kit';
import { finRecord, finText, type FinRow } from './fin-kit';
import { createOpsList, OpsLedger, opsColumn } from './ops-ledger';
import { createOpsWriter, OpsInlineForm } from './ops-form';
import { reloadSelectedDetail, syncSelected } from './selected-sync';
import { ShipmentDetail } from './shipment-detail';
import { shipmentForms, shipmentPath, shipmentRequest } from './shipment-forms';

const states: Readonly<Partial<Record<string, string>>> = {
  EXCEPTION_PENDING: '例外待审',
  READY: '待放行',
  APPROVED: '例外已批准',
  RELEASED: '已放行',
  REJECTED: '已驳回',
} as const;
const idOf = (row: FinRow) => finText(row, 'id');
const numberOf = (row: FinRow) => finText(row, 'request_number', 'requestNumber');
const stateOf = (row: FinRow) => finText(row, 'state');
const labelOf = (row: FinRow) => states[stateOf(row)] ?? '—';

function createShipmentModel(context: ProductionOrderHostContext) {
  const { controller } = context;
  const read = controller.api.get;
  const list = createOpsList((query) => finReadPage(read, shipmentPath, query), {
    summary: 'true',
  });
  const selected = signal<FinRow | null>(null);
  const detailLoading = signal(false);
  const selection = () => ({
    selected,
    rows: list.rows.peek(),
    idOf,
    loadDetail: async (id: string) => (read ? await read(finDetailUrl(shipmentPath, id)) : null),
  });
  const writer = createOpsWriter(
    (path, body) => controller.submit(path, body),
    async () => {
      const [, related] = await Promise.allSettled([list.reload(), controller.load()]);
      const current = selection();
      if (current.rows.some((row) => idOf(row) === idOf(selected.peek() ?? {})))
        syncSelected(current);
      await reloadSelectedDetail(current);
      if (related.status === 'rejected') throw related.reason;
    },
  );
  const orderChoices = (path: string) =>
    perView(controller.views, path, (rows) =>
      rows.map((row) => ({ value: idOf(row), label: finText(row, 'orderNumber', 'order_number') })),
    );
  const sales = orderChoices('/api/v1/sales-orders');
  const production = orderChoices('/api/v1/production-orders');
  const lots = perView(controller.views, '/api/v1/lot-traceability', (rows) =>
    rows
      .filter((row) => row.qualityStatus === 'RELEASED')
      .map((row) => ({
        value: finText(row, 'lotId', 'id'),
        label: `${finText(row, 'lotNumber')} · ${finText(row, 'sku')}`,
      })),
  );
  const hasRequestSources = () =>
    sales().length > 0 &&
    production().length > 0 &&
    (controller.views.get('/api/v1/lot-traceability')?.length ?? 0) > 0;
  const newRequest = () => {
    writer.open(shipmentRequest(sales(), production(), lots()));
  };
  const close = () => {
    if (writer.busy.peek()) return;
    selected.value = null;
    detailLoading.value = false;
    writer.close();
  };
  const open = async (row: FinRow) => {
    writer.close();
    writer.notice.value = '';
    selected.value = row;
    detailLoading.value = true;
    await reloadSelectedDetail(selection());
    if (idOf(selected.peek() ?? {}) === idOf(row)) detailLoading.value = false;
  };
  return { list, selected, detailLoading, writer, hasRequestSources, newRequest, close, open };
}

type Model = ReturnType<typeof createShipmentModel>;

function ShipmentSummary({ model }: Readonly<{ model: Model }>) {
  const summary = finRecord(model.list.summary.value);
  return (
    <SummaryCards
      label="发货状态汇总"
      testId="kt-shipment-summary"
      items={[
        {
          id: 'requests',
          label: '放行申请',
          value: finText(summary, 'requests') || '—',
          hint: '全部放行申请 · 张',
        },
        {
          id: 'exceptions',
          label: '例外待审',
          value: finText(summary, 'exceptions') || '—',
          hint: '待例外审批的放行申请 · 张',
        },
        {
          id: 'released',
          label: '已放行',
          value: finText(summary, 'released') || '—',
          hint: '已执行仓库放行的申请 · 张',
        },
        {
          id: 'delivered',
          label: '已签收',
          value: finText(summary, 'delivered') || '—',
          hint: '已登记签收的发运单 · 票',
        },
      ]}
    />
  );
}

const shipmentColumns = (open: Model['open']): readonly DataTableColumn<FinRow>[] => [
  {
    key: 'request',
    header: '放行申请号',
    sortable: true,
    field: numberOf,
    render: (row) => <strong data-testid="kt-shipment-number">{numberOf(row) || '—'}</strong>,
  },
  opsColumn('销售订单', 'orderNumber', 'order_number'),
  opsColumn('生产工单', 'productionOrderNumber', 'production_order_number'),
  opsColumn('成品批次', 'lotNumber', 'lot_number'),
  {
    key: 'state',
    header: '状态',
    sortable: true,
    field: stateOf,
    render: (row) => (
      <span class={`console-chip state-${stateOf(row).toLowerCase()}`}>{labelOf(row)}</span>
    ),
  },
  {
    key: 'actions',
    header: '操作',
    render: (row) =>
      idOf(row) ? (
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-shipment-open"
          onClick={() => {
            void open(row);
          }}
        >
          查看
        </button>
      ) : (
        '—'
      ),
  },
];

function ShipmentDrawer({
  model,
  context,
}: Readonly<{ model: Model; context: ProductionOrderHostContext }>) {
  const { writer } = model;
  const row = model.selected.value;
  const form = writer.form.value;
  if (!row && !form) return null;
  return (
    <DetailDrawer
      title={row ? numberOf(row) || '发货放行' : (form?.title ?? '')}
      onClose={model.close}
      footer={<ConsoleNotice message={writer.notice.value} />}
    >
      {row ? <ShipmentDetail row={row} context={context} close={model.close} /> : null}
      {row && !form && !model.detailLoading.value ? (
        <div class="fin-filters">
          {shipmentForms(row, context.permissions).map((action) => (
            <button
              key={action.label}
              type="button"
              class="secondary compact"
              onClick={() => {
                writer.open(action.form);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {model.detailLoading.value ? <p role="status">正在加载详情…</p> : null}
      <OpsInlineForm model={writer} />
      <FocusAnchor token={`${form?.title ?? ''}|${stateOf(row ?? {})}|${writer.notice.value}`} />
    </DetailDrawer>
  );
}

export function mountShipmentConsole(host: HTMLElement, context: ProductionOrderHostContext) {
  const model = createShipmentModel(context);
  const columns = shipmentColumns(model.open);
  const Page = () => (
    <div class="commercial-console-page fin-page">
      <PageHeader
        title="发货放行与物流签收"
        actions={
          context.permissions.has('shipment:request') && model.hasRequestSources() ? (
            <button
              class="primary"
              type="button"
              data-testid="kt-shipment-create"
              onClick={model.newRequest}
            >
              ＋ 发起发货门禁检查
            </button>
          ) : undefined
        }
      />
      {model.selected.value || model.writer.form.value ? null : (
        <ConsoleNotice message={model.writer.notice.value} />
      )}
      <ShipmentSummary model={model} />
      <OpsLedger
        prefix="kt-shipment"
        label="发货放行"
        states={states}
        columns={columns}
        model={model.list}
      />
      <ShipmentDrawer model={model} context={context} />
      <ConsoleConfirmDialog pending={model.writer.confirmation} />
    </div>
  );
  render(<Page />, host);
  void model.list.reload();
}
