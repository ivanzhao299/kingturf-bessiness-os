import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import { appendShipmentDispatch, appendShipmentDelivery } from './shipment-actions';

function appendShipmentRequest(
  context: FulfillmentViewContext,
  panel: HTMLElement,
  orders: readonly Record<string, unknown>[],
  productionOrders: readonly Record<string, unknown>[],
  lots: readonly Record<string, unknown>[],
): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText } = context.ports;
  if (
    permissions.has('shipment:request') &&
    orders.length &&
    productionOrders.length &&
    lots.length
  ) {
    const button = el('button', 'primary', '＋ 发起发货门禁检查');
    button.addEventListener('click', () => {
      openForm(
        workspace,
        '发起发货放行申请',
        '系统在提交瞬间冻结九类门禁结果；未通过项只能进入独立例外审批，不能由申请人自行绕过。',
        [
          { name: 'requestNumber', label: '放行申请号', required: true },
          {
            name: 'salesOrderId',
            label: '销售订单',
            type: 'select',
            required: true,
            options: orders.map((x) => ({
              value: String(x.id),
              label: recordText(x, 'orderNumber', 'order_number'),
            })),
          },
          {
            name: 'productionOrderId',
            label: '生产工单',
            type: 'select',
            required: true,
            options: productionOrders.map((x) => ({
              value: String(x.id),
              label: recordText(x, 'orderNumber', 'order_number'),
            })),
          },
          {
            name: 'finishedLotId',
            label: '成品批次',
            type: 'select',
            required: true,
            options: lots
              .filter((x) => recordText(x, 'qualityStatus', 'qualityStatus') === 'RELEASED')
              .map((x) => ({
                value: String(x.lotId ?? x.id),
                label: `${recordText(x, 'lotNumber', 'lotNumber')} · ${recordText(x, 'sku', 'sku')}`,
              })),
          },
          { name: 'requestedQuantity', label: '发货数量', type: 'number', required: true },
          {
            name: 'requiredPaymentAmount',
            label: '发货前应收款金额',
            type: 'number',
            required: true,
          },
          { name: 'reason', label: '发货事由', required: true },
        ],
        '执行门禁检查',
        async (values) => {
          const requestNumber = String(values.requestNumber);
          await controller.submit('/api/v1/shipment-releases', {
            ...values,
            idempotencyKey: requestNumber,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    panel.append(button);
  }
}

function createShipmentCard(
  context: FulfillmentViewContext,
  release: Record<string, unknown>,
  shipmentRecords: (release: Record<string, unknown>) => readonly Record<string, unknown>[],
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { recordText, shipmentGateLabel, businessStateLabel, operationsNextAction } = context.ports;
  const state = recordText(release, 'state', 'state');
  const snapshot = (release.gate_snapshot ?? release.gateSnapshot ?? {}) as Record<string, unknown>;
  const failures = Array.isArray(snapshot.failures)
    ? snapshot.failures.map(shipmentGateLabel).join('、')
    : '无';
  const card = el('article', 'production-order-card');
  card.append(
    el(
      'h3',
      '',
      `${recordText(release, 'request_number', 'requestNumber')} · ${businessStateLabel(state)}`,
    ),
    el(
      'p',
      '',
      `销售订单 ${recordText(release, 'orderNumber', 'orderNumber')} · 工单 ${recordText(release, 'productionOrderNumber', 'productionOrderNumber')}`,
    ),
    el(
      'p',
      '',
      `批次 ${recordText(release, 'lotNumber', 'lotNumber')} · 数量 ${recordText(release, 'requested_quantity', 'requestedQuantity')}`,
    ),
    el('p', failures === '无' ? 'success-note' : 'risk-note', `门禁未通过：${failures}`),
    el('p', 'next-action-note', `下一步：${operationsNextAction('shipment', state)}`),
  );
  const openShipmentDecision = (path: string, title: string, confirmLabel: string) => {
    openForm(
      workspace,
      title,
      '该决定将写入不可变发货证据链，请复核门禁结果并填写审批依据。',
      [
        { name: 'reason', label: '决定理由', type: 'textarea', required: true },
        { name: 'evidenceReference', label: '审批凭证编号', required: true },
      ],
      confirmLabel,
      async (values) => {
        await controller.submit(path, {
          reason: values.reason,
          evidence: { reference: values.evidenceReference },
          idempotencyKey: `${recordText(release, 'request_number', 'requestNumber')}-${String(values.evidenceReference)}`,
        });
        await controller.load();
        status.textContent = controller.message;
      },
    );
  };
  if (state === 'EXCEPTION_PENDING' && permissions.has('shipment:approve-exception')) {
    const approve = el('button', 'primary', '批准例外');
    approve.addEventListener('click', () => {
      openShipmentDecision(
        `/api/v1/shipment-releases/${String(release.id)}/approve-exception`,
        '批准发货例外',
        '确认批准例外',
      );
    });
    card.append(approve);
  }
  if ((state === 'READY' || state === 'APPROVED') && permissions.has('shipment:release')) {
    const releaseButton = el('button', 'primary', '执行仓库放行');
    releaseButton.addEventListener('click', () => {
      openShipmentDecision(
        `/api/v1/shipment-releases/${String(release.id)}/release`,
        '执行仓库放行',
        '确认仓库放行',
      );
    });
    card.append(releaseButton);
  }
  appendShipmentDispatch(context, release, state, card);
  appendShipmentDelivery(context, release, shipmentRecords, card);
  return card;
}

export function appendShipmentsView(context: FulfillmentViewContext): void {
  const { workspace, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'shipment-workbench');
  panel.setAttribute('data-testid', 'shipment-workbench');
  const releases = controller.views.get('/api/v1/shipment-releases') ?? [];
  const orders = controller.views.get('/api/v1/sales-orders') ?? [];
  const productionOrders = controller.views.get('/api/v1/production-orders') ?? [];
  const lots = controller.views.get('/api/v1/lot-traceability') ?? [];
  const shipmentRecords = (release: Record<string, unknown>): readonly Record<string, unknown>[] =>
    Array.isArray(release.shipments)
      ? release.shipments.filter(
          (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
        )
      : [];
  panel.append(
    el('p', 'eyebrow', '发货与签收'),
    el('h2', '', '发货放行与物流签收'),
    el('p', 'commercial-help', '发货门禁、例外审批与签收追踪'),
  );
  const summary = el('div', 'production-summary');
  summary.append(
    el('div', 'metric-card', `放行申请\n${String(releases.length)} 张`),
    el(
      'div',
      'metric-card',
      `例外待审\n${String(releases.filter((x) => recordText(x, 'state', 'state') === 'EXCEPTION_PENDING').length)} 张`,
    ),
    el(
      'div',
      'metric-card',
      `已放行\n${String(releases.filter((x) => recordText(x, 'state', 'state') === 'RELEASED').length)} 张`,
    ),
    el(
      'div',
      'metric-card',
      `已签收\n${String(releases.flatMap((x) => shipmentRecords(x)).filter((x) => recordText(x, 'state', 'state') === 'DELIVERED').length)} 票`,
    ),
  );
  panel.append(summary);
  appendShipmentRequest(context, panel, orders, productionOrders, lots);
  const shipmentPriority: Readonly<Record<string, number>> = {
    EXCEPTION_PENDING: 0,
    READY: 1,
    APPROVED: 2,
    RELEASED: 3,
    REJECTED: 4,
  };
  const grid = el('div', 'production-order-grid');
  for (const release of [...releases].sort(
    (left, right) =>
      (shipmentPriority[recordText(left, 'state', 'state')] ?? 9) -
      (shipmentPriority[recordText(right, 'state', 'state')] ?? 9),
  )) {
    const card = createShipmentCard(context, release, shipmentRecords);
    grid.append(card);
  }
  if (!releases.length)
    grid.append(
      el('p', 'success-note', '暂无发货放行申请；由发货申请员从已完工且质量放行的批次发起。'),
    );
  panel.append(grid);
  workspace.append(panel);
}
