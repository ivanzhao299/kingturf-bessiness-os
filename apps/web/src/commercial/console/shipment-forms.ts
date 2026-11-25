import type { CommercialPermission } from '../permissions';
import type { Choice } from './console-choices';
import { finRows, finText, type FinRow } from './fin-kit';
import { opsForm, type OpsForm } from './ops-form';

export const shipmentPath = '/api/v1/shipment-releases';

export function shipmentRequest(
  orders: readonly Choice[],
  production: readonly Choice[],
  lots: readonly Choice[],
) {
  return opsForm(
    '发起发货放行申请',
    '提交时冻结九类门禁结果。未通过项进入独立例外审批。',
    [
      { name: 'requestNumber', label: '放行申请号', required: true },
      { name: 'salesOrderId', label: '销售订单', type: 'select', required: true, options: orders },
      {
        name: 'productionOrderId',
        label: '生产工单',
        type: 'select',
        required: true,
        options: production,
      },
      { name: 'finishedLotId', label: '成品批次', type: 'select', required: true, options: lots },
      { name: 'requestedQuantity', label: '发货数量', type: 'number', required: true },
      { name: 'requiredPaymentAmount', label: '发货前应收款金额', type: 'number', required: true },
      { name: 'reason', label: '发货事由', required: true },
    ],
    '执行门禁检查',
    (values) => [shipmentPath, { ...values, idempotencyKey: String(values.requestNumber) }],
  );
}

export function shipmentDecision(row: FinRow, action: 'approve-exception' | 'release') {
  const approve = action === 'approve-exception';
  return opsForm(
    approve ? '批准发货例外' : '执行仓库放行',
    '复核门禁结果并填写审批依据。',
    [
      { name: 'reason', label: '决定理由', type: 'textarea', required: true },
      { name: 'evidenceReference', label: '审批凭证编号', required: true },
    ],
    approve ? '确认批准例外' : '确认仓库放行',
    (values) => [
      `${shipmentPath}/${finText(row, 'id')}/${action}`,
      {
        reason: values.reason,
        evidence: { reference: values.evidenceReference },
        idempotencyKey: `${finText(row, 'request_number', 'requestNumber')}-${String(values.evidenceReference)}`,
      },
    ],
    '该决定将写入不可变发货证据链。',
  );
}

export function shipmentDispatch(id: string) {
  return opsForm(
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
    (values) => [
      `${shipmentPath}/${id}/dispatch`,
      {
        shipmentNumber: values.shipmentNumber,
        carrierName: values.carrierName,
        trackingNumber: values.trackingNumber,
        dispatchedAt: values.dispatchedAt,
        location: values.location,
        evidence: { sealReference: values.sealReference },
        idempotencyKey: String(values.shipmentNumber),
      },
    ],
    '确认发车后，承运与封车记录将进入发运台账。',
  );
}

export function shipmentDelivery(id: string) {
  return opsForm(
    '登记客户签收回单',
    '填写实际签收人、签收时间和回单编号。',
    [
      { name: 'receiverName', label: '签收人', required: true },
      { name: 'receivedAt', label: '签收时间', required: true },
      { name: 'proofReference', label: '回单/附件编号', required: true },
      { name: 'location', label: '签收地点', required: true },
    ],
    '确认签收',
    (values) => [
      `/api/v1/shipments/${id}/deliver`,
      {
        occurredAt: values.receivedAt,
        location: values.location,
        evidence: {
          receiverName: values.receiverName,
          receivedAt: values.receivedAt,
          proofReference: values.proofReference,
        },
        idempotencyKey: `POD-${id}`,
      },
    ],
    '确认后将记录客户签收，签收记录无法撤回。',
  );
}

export function shipmentForms(row: FinRow, permissions: ReadonlySet<CommercialPermission>) {
  const id = finText(row, 'id');
  if (!id) return [];
  const state = finText(row, 'state');
  const result: { label: string; form: OpsForm }[] = [];
  if (state === 'EXCEPTION_PENDING' && permissions.has('shipment:approve-exception'))
    result.push({ label: '批准例外', form: shipmentDecision(row, 'approve-exception') });
  if ((state === 'READY' || state === 'APPROVED') && permissions.has('shipment:release'))
    result.push({ label: '执行仓库放行', form: shipmentDecision(row, 'release') });
  if (
    state === 'RELEASED' &&
    permissions.has('shipment:dispatch') &&
    (!Array.isArray(row.shipments) || row.shipments.length === 0)
  )
    result.push({ label: '登记承运发车', form: shipmentDispatch(id) });
  if (permissions.has('shipment:track')) {
    for (const shipment of finRows(row.shipments)) {
      const shipmentId = finText(shipment, 'id');
      if (shipmentId && shipment.state !== 'DELIVERED')
        result.push({
          label: `登记签收 ${finText(shipment, 'tracking_number', 'trackingNumber')}`,
          form: shipmentDelivery(shipmentId),
        });
    }
  }
  return result;
}
