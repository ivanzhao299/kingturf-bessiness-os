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

const [quotes, decisions, contracts, orders, receivables, payments, runs] = await Promise.all([
  get('/api/v1/quotes'),
  get('/api/v1/credit-decisions'),
  get('/api/v1/contracts'),
  get('/api/v1/sales-orders'),
  get('/api/v1/ar-open-items'),
  get('/api/v1/bank-payments'),
  get('/api/v1/reconciliation-runs'),
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
assert(Number(openItem.remaining_amount ?? openItem.remainingAmount) > 0);
assert(runs.some((item) => (item.input?.paymentId ?? item.input?.payment_id) === payment.id));

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
      payment: { id: payment.id, reference: paymentReference, remaining: 0 },
      reconciliationRuns: runs.length,
    },
    null,
    2,
  )}\n`,
);
