import assert from 'node:assert/strict';

const baseUrl = (process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:14331').replace(/\/$/u, '');
const login = process.env.KINGTURF_ADMIN_LOGIN ?? 'admin';
const password = process.env.KINGTURF_ADMIN_PASSWORD;
if (!password) throw new Error('KINGTURF_ADMIN_PASSWORD is required');

const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ login, password }),
});
assert.equal(response.status, 200, 'administrator login must succeed');
const { token } = await response.json();
const get = async (path) => {
  const result = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(result.status, 200, `${path} must be readable`);
  return (await result.json()).items;
};

const [
  quotes,
  decisions,
  contracts,
  orders,
  receivables,
  payments,
  runs,
  policies,
  commissions,
  risks,
  manufacturingItems,
  manufacturingBoms,
  manufacturingRoutings,
  suppliers,
  procurementRfqs,
  supplierQuotes,
  purchaseOrders,
  goodsReceipts,
  inventoryBalances,
  mrpPolicies,
  mrpDemands,
  mrpRuns,
] = await Promise.all([
  get('/api/v1/quotes'),
  get('/api/v1/credit-decisions'),
  get('/api/v1/contracts'),
  get('/api/v1/sales-orders'),
  get('/api/v1/ar-open-items'),
  get('/api/v1/bank-payments'),
  get('/api/v1/reconciliation-runs'),
  get('/api/v1/commission-policies'),
  get('/api/v1/commissions'),
  get('/api/v1/risk-evaluations'),
  get('/api/v1/manufacturing-items'),
  get('/api/v1/manufacturing-boms'),
  get('/api/v1/manufacturing-routings'),
  get('/api/v1/suppliers'),
  get('/api/v1/procurement-rfqs'),
  get('/api/v1/supplier-quotes'),
  get('/api/v1/purchase-orders'),
  get('/api/v1/goods-receipts'),
  get('/api/v1/inventory-balances'),
  get('/api/v1/mrp-policies'),
  get('/api/v1/mrp-demands'),
  get('/api/v1/mrp-runs'),
]);
const finishedGood = manufacturingItems.find(
  (item) => item.sku === 'FG-KT-PRO-50' && item.status === 'PUBLISHED',
);
assert(finishedGood, 'published finished-good master version is required');
assert.match(finishedGood.canonical_hash ?? finishedGood.canonicalHash, /^[0-9a-f]{64}$/u);
const bom = manufacturingBoms.find(
  (item) => item.code === 'BOM-KT-PRO-50' && item.status === 'PUBLISHED',
);
assert.equal(bom?.lines?.length, 2, 'published BOM must contain two governed component lines');
assert.equal(
  bom.lines[0].substitutes.length,
  1,
  'primary yarn must retain its approved substitute',
);
const routing = manufacturingRoutings.find(
  (item) => item.code === 'RT-KT-PRO-50' && item.status === 'PUBLISHED',
);
assert.deepEqual(
  routing?.operations?.map((operation) => operation.operation_code),
  ['TUFT', 'COAT', 'PACK'],
  'published routing operations must remain ordered and complete',
);
assert.equal(
  mrpPolicies.length >= 3,
  true,
  'MRP policies for finished good, yarn, and backing are required',
);
assert.equal(mrpDemands.length >= 2, true, 'both frozen and order demand signals are required');
const mrpRun = mrpRuns.find((item) => (item.run_number ?? item.runNumber) === 'MRP-KT-2026-001');
assert.equal(mrpRun?.status, 'COMPUTED');
assert.equal(mrpRun.calculations.length, 6, 'two demand dates must expand into six item buckets');
assert.equal(mrpRun.proposals.length, 6, 'each positive net requirement must create a proposal');
assert.equal(mrpRun.proposals.filter((proposal) => proposal.frozen).length, 3);
assert(mrpRun.proposals.every((proposal) => proposal.effectiveState === 'RELEASED'));
assert(
  mrpRun.proposals.every(
    (proposal) =>
      proposal.events.map((event) => event.state).join(',') === 'PROPOSED,APPROVED,RELEASED',
  ),
);
const longRangeYarn = mrpRun.calculations.find(
  (item) => item.sku === 'RM-KT-YARN-12000' && item.required_at === '2026-11-15',
);
assert.equal(
  Number(longRangeYarn?.gross_demand),
  10300,
  'BOM quantity and 3% scrap must yield 10300kg gross yarn demand',
);
assert.equal(Number(longRangeYarn?.safety_stock), 500);
assert.equal(
  Number(longRangeYarn?.planned_quantity),
  10000,
  'cumulative prior plan and 500kg multiple must be applied',
);
for (const calculation of mrpRun.calculations)
  assert.match(calculation.canonical_hash, /^[0-9a-f]{64}$/u);
const supplier = suppliers.find(
  (item) => (item.supplier_number ?? item.supplierNumber) === 'SUP-KT-YARN-001',
);
assert.equal(supplier?.status, 'ACTIVE', 'active strategic yarn supplier is required');
assert(
  supplier.qualifications.some(
    (item) => item.status === 'APPROVED' && (item.item_version_id ?? item.itemVersionId),
  ),
  'supplier must retain an approved published-item qualification',
);
const procurementRfq = procurementRfqs.find(
  (item) => (item.rfq_number ?? item.rfqNumber) === 'RFQ-KT-YARN-2026-001',
);
assert.equal(procurementRfq?.status, 'ISSUED');
assert.equal(procurementRfq.lines.length, 1);
const supplierQuote = supplierQuotes.find(
  (item) => (item.quote_reference ?? item.quoteReference) === 'SQ-KT-YARN-2026-001',
);
assert.match(supplierQuote?.canonical_hash ?? supplierQuote?.canonicalHash, /^[0-9a-f]{64}$/u);
const purchaseOrder = purchaseOrders.find(
  (item) => (item.po_number ?? item.poNumber) === 'PO-KT-YARN-2026-001',
);
assert.equal(purchaseOrder?.status, 'RECEIVED');
assert.equal(Number(purchaseOrder.lines[0].quantity), 5000);
assert.equal(Number(purchaseOrder.lines[0].receivedQuantity), 5000);
const goodsReceipt = goodsReceipts.find(
  (item) => (item.receipt_number ?? item.receiptNumber) === 'GR-KT-YARN-2026-001',
);
assert.equal(goodsReceipt?.lines[0].lotNumber, 'LOT-KT-YARN-20260920-A');
const yarnBalance = inventoryBalances.find(
  (item) => item.lotNumber === 'LOT-KT-YARN-20260920-A' && item.locationCode === 'RAW-A01',
);
assert.equal(Number(yarnBalance?.quantity), 5000, 'receipt must derive 5000 kg lot balance');
assert.deepEqual(
  yarnBalance.movements.map((movement) => movement.movement_type),
  ['RECEIPT'],
  'inventory balance must be derived from the immutable movement ledger',
);
const quote = quotes.find(
  (item) => item.quoteNumber === 'Q-KT-P1-DEMO' && item.status === 'ISSUED',
);
assert(quote?.issuedSnapshotId, 'the seeded issued quote and snapshot are required');
const quoteDecisions = decisions.filter(
  (item) => (item.quote_revision_id ?? item.quoteRevisionId) === quote.id,
);
const statuses = new Set(
  quoteDecisions.map((item) => item.effective_status ?? item.effectiveStatus),
);
for (const expected of ['APPROVED', 'REJECTED', 'EXPIRED'])
  assert(statuses.has(expected), `credit scenario ${expected} is required`);

const orderNumber = process.env.KINGTURF_DEMO_ORDER ?? 'SO-KT-P1-DEMO';
const order = orders.find((item) => (item.order_number ?? item.orderNumber) === orderNumber);
assert(order, `released order ${orderNumber} is required`);
assert.equal(order.quote_revision_id ?? order.quoteRevisionId, quote.id);
const approvedDecision = quoteDecisions.find(
  (item) => (item.effective_status ?? item.effectiveStatus) === 'APPROVED',
);
assert.equal(order.credit_decision_id ?? order.creditDecisionId, approvedDecision?.id);
const contract = contracts.find(
  (item) => item.contractNumber === 'CT-KT-P1-DEMO' && item.effectiveStatus === 'SIGNED',
);
assert(contract?.signatureEvidenceId, 'the seeded signed contract is required');
assert.equal(order.contract_revision_id ?? order.contractRevisionId, contract.id);
const openItem = receivables.find(
  (item) => (item.salesOrderId ?? item.sales_order_id) === order.id,
);
assert(openItem, 'the demo order must have an AR open item');
const paymentReference = process.env.KINGTURF_DEMO_PAYMENT ?? 'BANK-KT-P1-DEMO';
const payment = payments.find(
  (item) => (item.bank_reference ?? item.bankReference) === paymentReference,
);
assert(payment, `bank payment ${paymentReference} is required`);
assert.equal(Number(payment.remaining_amount ?? payment.remainingAmount), 0);
const finalPayment = payments.find(
  (item) => (item.bank_reference ?? item.bankReference) === 'BANK-KT-P1-DEMO-FINAL',
);
assert(finalPayment, 'the final collection payment is required');
assert.equal(Number(finalPayment.remaining_amount ?? finalPayment.remainingAmount), 0);
assert.equal(Number(openItem.remaining_amount ?? openItem.remainingAmount), 0);
assert.equal(
  Number(payment.amount) + Number(finalPayment.amount),
  Number(openItem.original_amount),
);
assert(runs.some((item) => (item.input?.paymentId ?? item.input?.payment_id) === payment.id));
assert(runs.some((item) => (item.input?.paymentId ?? item.input?.payment_id) === finalPayment.id));
const commissionPolicy = policies.find(
  (item) => item.code === 'COM-KT-P1-2026' && Number(item.version) === 1,
);
assert.equal(commissionPolicy?.status, 'PUBLISHED', 'published commission policy V1 is required');
const commission = commissions.find(
  (item) =>
    (item.sales_order_id ?? item.salesOrderId) === order.id &&
    (item.policy_version_id ?? item.policyVersionId) === commissionPolicy.id,
);
assert(commission, 'the pinned commission case is required');
assert.equal(Number(commission.eligible_revenue ?? commission.eligibleRevenue), 950000);
assert.equal(Number(commission.margin_amount ?? commission.marginAmount), 229000);
assert.equal(Number(commission.margin_basis_points ?? commission.marginBasisPoints), 2410);
assert.equal(Number(commission.collection_basis_points ?? commission.collectionBasisPoints), 5263);
assert.equal(Number(commission.commission_amount ?? commission.commissionAmount), 28500);
assert.equal(commission.effective_state ?? commission.effectiveState, 'CLAWED_BACK');
const ledgerStates = commission.ledger.map((entry) => entry.state);
assert.deepEqual(ledgerStates, ['ACCRUED', 'FROZEN', 'RELEASED', 'PAID', 'CLAWED_BACK']);
for (const [index, entry] of commission.ledger.entries()) {
  assert.equal(Number(entry.sequence), index + 1, 'commission ledger sequence must be contiguous');
  assert.match(entry.canonical_hash ?? entry.canonicalHash, /^[0-9a-f]{64}$/u);
}
const aggregateResponse = await fetch(`${baseUrl}/api/v1/sales-orders/${order.id}/360`, {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(aggregateResponse.status, 200, 'Order 360 must be readable');
const order360 = await aggregateResponse.json();
assert.equal(order360.order.id, order.id);
assert.equal(order360.quote.id, quote.id);
assert.equal(order360.credit.id, approvedDecision.id);
assert.equal(order360.contract.id, contract.id);
assert.equal(order360.receivables.length, 1);
assert.equal(order360.payments.length, 2);
assert.equal(order360.commissions.length, 1);
assert.equal(order360.risks.length, 1);
assert.equal(order360.anomalies.filter((item) => item.active).length, 0);
const timelineTypes = new Set(order360.timeline.map((item) => item.type));
for (const type of [
  'OPPORTUNITY_CREATED',
  'QUOTE_ISSUED',
  'CREDIT_DECIDED',
  'CONTRACT_SIGNED',
  'ORDER_RELEASED',
  'AR_POSTED',
  'PAYMENT_RECEIVED',
  'COMMISSION_CLAWED_BACK',
])
  assert(timelineTypes.has(type), `Order 360 timeline requires ${type}`);
const risk = risks.find((item) => (item.sales_order_id ?? item.salesOrderId) === order.id);
assert.equal(risk?.severity, 'HIGH');
assert.equal(Number(risk.score), 45);
assert.deepEqual(
  risk.findings.map((item) => item.code),
  ['LOW_MARGIN'],
);
assert.equal(risk.task.effective_state ?? risk.task.effectiveState, 'CLOSED');
assert.deepEqual(
  risk.taskEvents.map((item) => item.state),
  ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'CLOSED'],
);
const dashboardResponse = await fetch(
  `${baseUrl}/api/v1/executive-dashboard?from=2026-01-01T00%3A00%3A00.000Z&to=2027-01-01T00%3A00%3A00.000Z&currency=CNY`,
  { headers: { authorization: `Bearer ${token}` } },
);
assert.equal(dashboardResponse.status, 200, 'executive dashboard must be readable');
const dashboard = await dashboardResponse.json();
assert(Number(dashboard.metrics.bookedRevenue.value) >= Number(order.total));
assert(Number(dashboard.metrics.grossMargin.value) >= 229000);
assert(Number(dashboard.metrics.cashCollected.value) >= 950000);
assert.equal(dashboard.metrics.bookedRevenue.source, 'sales_orders');
assert.equal(dashboard.metrics.grossMargin.source, 'quote_revisions');
assert.equal(dashboard.metrics.openReceivable.source, 'ar_open_item_balances');
assert(dashboard.drilldowns.orders.some((item) => item.id === order.id));
assert(dashboard.drilldowns.risks.some((item) => item.id === risk.id));

process.stdout.write(
  `${JSON.stringify(
    {
      baseUrl,
      creditScenarios: [...statuses].sort(),
      quote: { id: quote.id, number: quote.quoteNumber, snapshotId: quote.issuedSnapshotId },
      contract: {
        id: contract.id,
        number: contract.contractNumber,
        signatureEvidenceId: contract.signatureEvidenceId,
      },
      order: { id: order.id, number: orderNumber, total: order.total },
      receivable: {
        id: openItem.id,
        original: openItem.original_amount ?? openItem.originalAmount,
        remaining: openItem.remaining_amount ?? openItem.remainingAmount,
      },
      payments: [
        { id: payment.id, reference: paymentReference, amount: payment.amount, remaining: 0 },
        {
          id: finalPayment.id,
          reference: 'BANK-KT-P1-DEMO-FINAL',
          amount: finalPayment.amount,
          remaining: 0,
        },
      ],
      reconciliationRuns: runs.length,
      commission: {
        id: commission.id,
        policyVersionId: commissionPolicy.id,
        amount: commission.commission_amount ?? commission.commissionAmount,
        effectiveState: commission.effective_state ?? commission.effectiveState,
        ledgerStates,
      },
      order360: {
        timelineEvents: order360.timeline.length,
        activeAnomalies: order360.anomalies.filter((item) => item.active).length,
        sections: [
          'quote',
          'credit',
          'contract',
          'receivables',
          'payments',
          'commissions',
          'risks',
        ],
      },
      risk: { id: risk.id, severity: risk.severity, score: risk.score, taskState: 'CLOSED' },
      dashboard: {
        bookedRevenue: dashboard.metrics.bookedRevenue.value,
        grossMargin: dashboard.metrics.grossMargin.value,
        cashCollected: dashboard.metrics.cashCollected.value,
        openReceivable: dashboard.metrics.openReceivable.value,
        releasedOrders: dashboard.metrics.releasedOrders.value,
      },
    },
    null,
    2,
  )}\n`,
);
