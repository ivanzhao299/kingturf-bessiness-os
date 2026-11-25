import type { ProductionOrderHostContext } from './production-order-host';
import { revealRelatedRecord } from '../related-record';
import {
  FinFacts,
  FinSection,
  FinTable,
  finRecord,
  finRows,
  finText,
  finWhen,
  type FinRow,
} from './fin-kit';
import { OpsTimeline } from './ops-ledger';

const related = [
  {
    label: '销售订单',
    route: 'sales-orders',
    capability: 'sales-order:read',
    id: ['sales_order_id', 'salesOrderId'],
    number: ['orderNumber', 'order_number'],
  },
  {
    label: '生产工单',
    route: 'production-orders',
    capability: 'production:read',
    id: ['production_order_id', 'productionOrderId'],
    number: ['productionOrderNumber', 'production_order_number'],
  },
  {
    label: '成品批次',
    route: 'quality-inspection',
    capability: 'traceability:read',
    id: ['finished_lot_id', 'finishedLotId'],
    number: ['lotNumber', 'lot_number'],
  },
] as const;

const gateChecks = [
  ['contract', 'contract_ok'],
  ['credit', 'credit_ok'],
  ['payment', 'payment_ok'],
  ['overdue', 'overdue_ok'],
  ['orderLink', 'order_link_ok'],
  ['quality', 'quality_ok'],
  ['production', 'production_ok'],
  ['cost', 'cost_ok'],
  ['inventory', 'quantityOk'],
] as const;

function RelatedBasis({
  row,
  context,
  close,
}: Readonly<{ row: FinRow; context: ProductionOrderHostContext; close: () => void }>) {
  return (
    <FinFacts
      items={related.map(({ label, route, capability, id, number }) => {
        const value = finText(row, ...number) || '—';
        const key = finText(row, ...id);
        if (!key || !context.permissions.has(capability)) return [label, value];
        return [
          label,
          <a
            class="fin-link"
            href={`#/${route}`}
            data-testid={`kt-shipment-link-${route}`}
            onClick={() => {
              close();
              revealRelatedRecord(context.workspace, route, key);
            }}
          >
            {value}
          </a>,
        ];
      })}
    />
  );
}

function ShipmentGate({
  row,
  context,
}: Readonly<{ row: FinRow; context: ProductionOrderHostContext }>) {
  const gate = finRecord(row.gate_snapshot ?? row.gateSnapshot);
  const failures = Array.isArray(gate.failures)
    ? gate.failures.map(context.ports.shipmentGateLabel)
    : [];
  return (
    <FinSection title="放行依据" testId="kt-shipment-gate">
      <FinFacts
        items={[
          ['申请数量', finText(row, 'requested_quantity', 'requestedQuantity') || '—'],
          ['库存可用量', finText(gate, 'available_quantity') || '—'],
          ['发货前应收款', finText(row, 'required_payment_amount', 'requiredPaymentAmount') || '—'],
          ['检查时间', finWhen(gate, 'evaluatedAt')],
          ['门禁未通过', Array.isArray(gate.failures) ? failures.join('、') || '无' : '—'],
        ]}
      />
      <FinTable
        testId="kt-shipment-checks"
        head={['门禁项目', '冻结结论']}
        empty="暂无门禁记录"
        rows={gateChecks.map(([key, column]) => [
          context.ports.shipmentGateLabel(key),
          gate[column] === true ? '通过' : gate[column] === false ? '未通过' : '—',
        ])}
      />
    </FinSection>
  );
}

export function ShipmentDetail({
  row,
  context,
  close,
}: Readonly<{ row: FinRow; context: ProductionOrderHostContext; close: () => void }>) {
  const label = context.ports.businessStateLabel;
  return (
    <>
      <RelatedBasis row={row} context={context} close={close} />
      <ShipmentGate row={row} context={context} />
      <FinSection title="放行与审批记录" testId="kt-shipment-release-events">
        <OpsTimeline
          testId="kt-shipment-approval-table"
          value={row.events}
          stateLabel={label}
          empty="暂无放行记录"
        />
      </FinSection>
      <FinSection title="发运与签收" testId="kt-shipment-tracking">
        {finRows(row.shipments).length === 0 ? <p>暂无发运记录</p> : null}
        {finRows(row.shipments).map((shipment) => (
          <section class="fin-section" key={finText(shipment, 'id')}>
            <FinFacts
              items={[
                ['发运单', finText(shipment, 'shipment_number', 'shipmentNumber') || '—'],
                ['承运商', finText(shipment, 'carrier_name', 'carrierName') || '—'],
                ['物流单号', finText(shipment, 'tracking_number', 'trackingNumber') || '—'],
                ['状态', label(shipment.state)],
              ]}
            />
            <OpsTimeline
              testId="kt-shipment-events"
              value={shipment.events}
              stateLabel={label}
              empty="暂无物流事件"
            />
          </section>
        ))}
      </FinSection>
    </>
  );
}
