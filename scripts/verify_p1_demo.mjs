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
]);
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
        sections: ['quote', 'credit', 'contract', 'receivables', 'payments', 'commissions'],
      },
      risk: { id: risk.id, severity: risk.severity, score: risk.score, taskState: 'CLOSED' },
    },
    null,
    2,
  )}\n`,
);
