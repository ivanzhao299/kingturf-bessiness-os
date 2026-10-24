import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

export function appendShipmentDispatch(
  context: FulfillmentViewContext,
  release: Record<string, unknown>,
  state: string,
  card: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  if (
    state === 'RELEASED' &&
    permissions.has('shipment:dispatch') &&
    (!Array.isArray(release.shipments) || release.shipments.length === 0)
  ) {
    const dispatch = el('button', 'secondary', '登记承运发车');
    dispatch.addEventListener('click', () => {
      openForm(
        workspace,
        '登记承运发车',
        '录入唯一运单与封车证据。',
        [
          { name: 'shipmentNumber', label: '发运单号', required: true },
          { name: 'carrierName', label: '承运商', required: true },
          { name: 'trackingNumber', label: '物流单号', required: true },
          { name: 'dispatchedAt', label: '发车时间', required: true },
          { name: 'location', label: '发车地点', required: true },
          { name: 'sealReference', label: '封车/装车凭证编号', required: true },
        ],
        '确认发车',
        async (values) => {
          await controller.submit(`/api/v1/shipment-releases/${String(release.id)}/dispatch`, {
            shipmentNumber: values.shipmentNumber,
            carrierName: values.carrierName,
            trackingNumber: values.trackingNumber,
            dispatchedAt: values.dispatchedAt,
            location: values.location,
            evidence: { sealReference: values.sealReference },
            idempotencyKey: String(values.shipmentNumber),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    card.append(dispatch);
  }
}

export function appendShipmentDelivery(
  context: FulfillmentViewContext,
  release: Record<string, unknown>,
  shipmentRecords: (release: Record<string, unknown>) => readonly Record<string, unknown>[],
  card: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText } = context.ports;
  for (const shipment of shipmentRecords(release)) {
    if (
      recordText(shipment, 'state', 'state') !== 'DELIVERED' &&
      permissions.has('shipment:track')
    ) {
      const pod = el(
        'button',
        'secondary',
        `登记签收 ${recordText(shipment, 'tracking_number', 'trackingNumber')}`,
      );
      pod.addEventListener('click', () => {
        openForm(
          workspace,
          '登记客户签收回单',
          '签收人、签收时间和回单编号为强制证据。',
          [
            { name: 'receiverName', label: '签收人', required: true },
            { name: 'receivedAt', label: '签收时间', required: true },
            { name: 'proofReference', label: '回单/附件编号', required: true },
            { name: 'location', label: '签收地点', required: true },
          ],
          '确认签收',
          async (values) => {
            await controller.submit(`/api/v1/shipments/${String(shipment.id)}/deliver`, {
              occurredAt: values.receivedAt,
              location: values.location,
              evidence: {
                receiverName: values.receiverName,
                receivedAt: values.receivedAt,
                proofReference: values.proofReference,
              },
              idempotencyKey: `POD-${String(shipment.id)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      card.append(pod);
    }
  }
}
