import assert from 'node:assert/strict';

const baseUrl = (process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:14331').replace(/\/$/u, '');
const adminPassword = process.env.KINGTURF_ADMIN_PASSWORD;
const approverPassword = process.env.KINGTURF_CREDIT_APPROVER_PASSWORD;
if (!adminPassword || !approverPassword)
  throw new Error('KINGTURF_ADMIN_PASSWORD and KINGTURF_CREDIT_APPROVER_PASSWORD are required');

async function login(loginName, password) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: loginName, password }),
  });
  assert.equal(response.status, 200, `login failed for ${loginName}`);
  return (await response.json()).token;
}

const admin = await login(process.env.KINGTURF_ADMIN_LOGIN ?? 'admin', adminPassword);
const approver = await login(
  process.env.KINGTURF_CREDIT_APPROVER_LOGIN ?? 'credit.approver',
  approverPassword,
);
async function request(path, { token = admin, method = 'GET', body, key } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok)
    throw new Error(
      `${method} ${path} failed (${response.status}): ${JSON.stringify(payload?.error ?? payload)}`,
    );
  return payload;
}
const list = async (path) => (await request(path)).items;
const statusOf = (item) => item.effective_status ?? item.effectiveStatus ?? item.status;
const session = await request('/api/v1/auth/session');
const adminEmployeeId = session.employeeId;

const customerNumber = 'KT-P1-DEMO-001';
let customer = (await list('/api/v1/customers')).find(
  (item) => item.customerNumber === customerNumber || item.customer_number === customerNumber,
);
customer ??= await request('/api/v1/customers', {
  method: 'POST',
  body: { name: '金特夫 P1 全链路演示客户', customerNumber, tags: ['P1-DEMO', 'E2E'] },
});

const opportunityName = 'KingTurf P1 全链路演示项目';
let opportunity = (await list('/api/v1/opportunities')).find(
  (item) => item.name === opportunityName,
);
opportunity ??= await request('/api/v1/opportunities', {
  method: 'POST',
  body: {
    customerId: customer.id,
    leadId: null,
    name: opportunityName,
    value: '950000',
    currency: 'CNY',
    probabilityBasisPoints: 6000,
    expectedCloseDate: '2099-06-30',
  },
});

const ctrCode = 'CTR-KT-P1-DEMO';
let ctr = (await list('/api/v1/ctrs')).find(
  (item) => item.code === ctrCode && item.status === 'APPROVED',
);
if (!ctr) {
  ctr = (await list('/api/v1/ctrs')).find((item) => item.code === ctrCode);
  ctr ??= await request('/api/v1/ctrs', {
    method: 'POST',
    body: {
      opportunityId: opportunity.id,
      code: ctrCode,
      title: '标准足球场人造草坪技术需求',
      requirements: {
        application: '国际学校标准足球场',
        pileHeightMm: 50,
        quantitySquareMeters: 8000,
        color: '双色直曲混织',
        delivery: '合同生效后 45 日内',
      },
    },
  });
  if (ctr.status === 'DRAFT')
    ctr = await request(`/api/v1/ctr-versions/${ctr.id}/submit`, {
      method: 'POST',
      key: 'kt-p1-seed-ctr-submit-v1',
      body: { expectedVersion: ctr.version ?? 1 },
    });
  if (ctr.status !== 'APPROVED')
    ctr = await request(`/api/v1/ctr-versions/${ctr.id}/decision`, {
      method: 'POST',
      key: 'kt-p1-seed-ctr-approve-v1',
      body: { decision: 'APPROVED', reason: 'P1 演示技术需求基线批准' },
    });
}

const solutionCode = 'TS-KT-P1-DEMO';
let solution = (await list('/api/v1/technical-solutions')).find(
  (item) => item.code === solutionCode && item.status === 'FINAL',
);
solution ??= await request('/api/v1/technical-solutions', {
  method: 'POST',
  body: {
    opportunityId: opportunity.id,
    code: solutionCode,
    ctrVersionId: ctr.id,
    specification: {
      productFamily: 'KingTurf Pro 50',
      pileHeightMm: 50,
      dtex: 12000,
      stitchDensity: 10500,
      backing: '双层 PP + 网格布',
      warrantyYears: 8,
    },
    assumptions: ['场地基础达到铺装验收标准', '工程量按 8000㎡结算'],
    final: true,
  },
});

const costCode = 'CM-KT-P1-DEMO';
let costModel = (await list('/api/v1/cost-models')).find(
  (item) => item.code === costCode && item.status === 'PUBLISHED',
);
costModel ??= await request('/api/v1/cost-models', {
  method: 'POST',
  body: {
    code: costCode,
    name: 'P1 演示标准成本模型',
    currency: 'CNY',
    publish: true,
    rules: [
      {
        when: { op: 'literal', value: true },
        adjustment: { kind: 'MULTIPLY', value: '1.030000' },
        reason: '项目管理费率 3%',
      },
    ],
  },
});

let cost = (await list('/api/v1/cost-evaluations')).find(
  (item) =>
    item.modelVersionId === costModel.id && item.technicalSolutionRevisionId === solution.id,
);
cost ??= await request('/api/v1/cost-evaluations', {
  method: 'POST',
  key: 'kt-p1-seed-cost-v1',
  body: {
    modelVersionId: costModel.id,
    technicalSolutionRevisionId: solution.id,
    currency: 'CNY',
    lines: [
      {
        key: 'turf',
        description: '人造草坪材料',
        quantity: '8000',
        unit: 'M2',
        unitCost: '62.5',
        currency: 'CNY',
      },
      {
        key: 'installation',
        description: '铺装施工',
        quantity: '8000',
        unit: 'M2',
        unitCost: '18.75',
        currency: 'CNY',
      },
      {
        key: 'logistics',
        description: '运输与装卸',
        quantity: '1',
        unit: 'EA',
        unitCost: '50000',
        currency: 'CNY',
      },
    ],
    context: { region: 'CN' },
  },
});

const policyCode = 'SP-KT-P1-DEMO';
let policy = (await list('/api/v1/sales-policies')).find(
  (item) => item.code === policyCode && item.status === 'PUBLISHED',
);
policy ??= await request('/api/v1/sales-policies', {
  method: 'POST',
  body: {
    code: policyCode,
    name: 'P1 演示利润与折扣政策',
    publish: true,
    rules: [
      {
        when: {
          op: 'lt',
          left: { op: 'input', path: 'marginBasisPoints' },
          right: { op: 'literal', value: 2200 },
        },
        effect: { passed: false, approvalRequired: true, minimumMarginBasisPoints: 2200 },
        reason: '毛利率低于 22% 红线',
      },
      {
        when: {
          op: 'gt',
          left: { op: 'input', path: 'discountBasisPoints' },
          right: { op: 'literal', value: 800 },
        },
        effect: { approvalRequired: true, maximumDiscountBasisPoints: 800 },
        reason: '折扣超过 8% 上限',
      },
    ],
  },
});

const economics = {
  subtotal: '1000000',
  discount: '50000',
  total: '950000',
  costTotal: String(cost.total),
  margin: String(950000 - Number(cost.total)),
};
const marginBasisPoints = Math.trunc((Number(economics.margin) / 950000) * 10000);
let policyEvaluation = (await list('/api/v1/sales-policy-evaluations')).find(
  (item) =>
    item.policyVersionId === policy.id &&
    item.costDecisionId === cost.id &&
    item.canonicalInput?.marginBasisPoints === marginBasisPoints &&
    item.canonicalInput?.discountBasisPoints === 500,
);
policyEvaluation ??= await request('/api/v1/sales-policy-evaluations', {
  method: 'POST',
  key: 'kt-p1-seed-policy-pass-v1',
  body: {
    policyVersionId: policy.id,
    costDecisionId: cost.id,
    context: { region: 'CN', marginBasisPoints, discountBasisPoints: 500 },
  },
});
assert.equal(policyEvaluation.passed, true, 'seed quote policy must pass');

const quoteNumber = 'Q-KT-P1-DEMO';
let quote = (await list('/api/v1/quotes')).find(
  (item) => item.quoteNumber === quoteNumber && item.status === 'ISSUED',
);
if (!quote) {
  quote = (await list('/api/v1/quotes')).find((item) => item.quoteNumber === quoteNumber);
  quote ??= await request('/api/v1/quotes', {
    method: 'POST',
    body: {
      quoteNumber,
      opportunityId: opportunity.id,
      ctrVersionId: ctr.id,
      technicalSolutionRevisionId: solution.id,
      costDecisionId: cost.id,
      policyVersionId: policy.id,
      policyEvaluationId: policyEvaluation.id,
      currency: 'CNY',
      ...economics,
      marginBasisPoints,
      validUntil: '2099-06-30T23:59:59.000Z',
      lines: [
        {
          description: '人造草坪系统',
          quantity: '8000',
          unitCode: 'M2',
          unitPrice: '100',
          total: '800000',
        },
        {
          description: '铺装与项目服务',
          quantity: '1',
          unitCode: 'EA',
          unitPrice: '200000',
          total: '200000',
        },
      ],
    },
  });
  if (quote.status === 'DRAFT')
    quote = await request(`/api/v1/quote-revisions/${quote.id}/approve`, {
      method: 'POST',
      key: 'kt-p1-seed-quote-approve-v1',
      body: { decision: 'APPROVED', reason: 'P1 演示报价批准' },
    });
  if (quote.status !== 'ISSUED')
    await request(`/api/v1/quote-revisions/${quote.id}/issue`, {
      method: 'POST',
      key: 'kt-p1-seed-quote-issue-v1',
      body: {},
    });
  quote = (await list('/api/v1/quotes')).find(
    (item) => item.quoteNumber === quoteNumber && item.status === 'ISSUED',
  );
}
assert(quote?.issuedSnapshotId, 'issued quote snapshot is required');

let limit = (await list('/api/v1/credit-limits')).find(
  (item) => (item.customer_id ?? item.customerId) === customer.id && item.currency === 'CNY',
);
limit ??= await request('/api/v1/credit-limits', {
  method: 'POST',
  key: 'kt-p1-seed-credit-limit-v1',
  body: {
    customerId: customer.id,
    currency: 'CNY',
    amount: '5000000',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2099-12-31T23:59:59.000Z',
  },
});

async function ensureCredit(outcome, validUntil, key) {
  let decision = (await list('/api/v1/credit-decisions')).find(
    (item) =>
      (item.quote_revision_id ?? item.quoteRevisionId) === quote.id && statusOf(item) === outcome,
  );
  if (decision) return decision;
  decision = await request('/api/v1/credit-decisions', {
    method: 'POST',
    key: `${key}-evaluate`,
    body: {
      customerId: customer.id,
      quoteRevisionId: quote.id,
      quoteSnapshotId: quote.issuedSnapshotId,
      creditLimitId: limit.id,
      validUntil,
    },
  });
  if (outcome !== 'EXPIRED')
    await request(`/api/v1/credit-decisions/${decision.id}/approve`, {
      token: approver,
      method: 'POST',
      key: `${key}-decision`,
      body: { decision: outcome, reason: `P1 演示${outcome === 'APPROVED' ? '批准' : '拒绝'}场景` },
    });
  return (await list('/api/v1/credit-decisions')).find((item) => item.id === decision.id);
}
const approved = await ensureCredit(
  'APPROVED',
  '2099-03-31T23:59:59.000Z',
  'kt-p1-seed-credit-approved-v1',
);

const contractNumber = 'CT-KT-P1-DEMO';
let contract = (await list('/api/v1/contracts')).find(
  (item) => item.contractNumber === contractNumber && statusOf(item) === 'SIGNED',
);
if (!contract) {
  contract = (await list('/api/v1/contracts')).find(
    (item) => item.contractNumber === contractNumber,
  );
  contract ??= await request('/api/v1/contracts', {
    method: 'POST',
    key: 'kt-p1-seed-contract-v1',
    body: {
      customerId: customer.id,
      opportunityId: opportunity.id,
      contractNumber,
      quoteRevisionId: quote.id,
      quoteSnapshotId: quote.issuedSnapshotId,
      content: {
        paymentTerms: '合同签署后 7 日内支付首款，验收后付清',
        deliveryTerms: '合同生效后 45 日内交付',
        warranty: '8 年有限质保',
        acceptance: '按双方确认技术规格验收',
      },
    },
  });
  if (statusOf(contract) !== 'SIGNED')
    await request(`/api/v1/contracts/${contract.id}/sign`, {
      method: 'POST',
      key: 'kt-p1-seed-contract-sign-v1',
      body: {
        provider: 'DEMO_E_SIGNATURE',
        providerReceiptId: 'SIG-KT-P1-DEMO',
        payload: { signer: '金特夫演示签署人', acknowledged: true },
        signedAt: '2026-08-16T12:00:00.000Z',
      },
    });
  contract = (await list('/api/v1/contracts')).find(
    (item) => item.contractNumber === contractNumber && statusOf(item) === 'SIGNED',
  );
}

const orderNumber = 'SO-KT-P1-DEMO';
let order = (await list('/api/v1/sales-orders')).find(
  (item) => (item.order_number ?? item.orderNumber) === orderNumber,
);
order ??= await request('/api/v1/sales-orders', {
  method: 'POST',
  key: 'kt-p1-seed-order-v1',
  body: {
    customerId: customer.id,
    opportunityId: opportunity.id,
    orderNumber,
    quoteRevisionId: quote.id,
    quoteSnapshotId: quote.issuedSnapshotId,
    creditDecisionId: approved.id,
    contractRevisionId: contract.id,
    signatureEvidenceId: contract.signatureEvidenceId,
    currency: 'CNY',
    total: '950000',
    lines: [
      { description: 'P1 演示人造草坪项目', quantity: '1', unitPrice: '950000', total: '950000' },
    ],
  },
});

const invoiceNumber = 'INV-KT-P1-DEMO';
let receivable = (await list('/api/v1/ar-open-items')).find(
  (item) => item.documentNumber === invoiceNumber,
);
receivable ??= await request('/api/v1/ar-open-items', {
  method: 'POST',
  key: 'kt-p1-seed-ar-v1',
  body: {
    customerId: customer.id,
    salesOrderId: order.id,
    documentNumber: invoiceNumber,
    documentType: 'INVOICE',
    currency: 'CNY',
    amount: '950000',
    dueAt: '2099-07-31T23:59:59.000Z',
  },
});

const bankReference = 'BANK-KT-P1-DEMO';
let payment = (await list('/api/v1/bank-payments')).find(
  (item) => (item.bank_reference ?? item.bankReference) === bankReference,
);
payment ??= await request('/api/v1/bank-payments', {
  method: 'POST',
  key: 'kt-p1-seed-payment-v1',
  body: {
    customerId: customer.id,
    currency: 'CNY',
    amount: '500000',
    receivedAt: '2026-08-16T12:00:00.000Z',
    bankReference,
    rawPayload: { payer: '金特夫 P1 全链路演示客户', source: 'DEMO_BANK_STATEMENT' },
  },
});
if (Number(payment.remaining_amount ?? payment.remainingAmount ?? payment.amount) > 0)
  await request('/api/v1/reconciliation-runs', {
    method: 'POST',
    key: 'kt-p1-seed-reconciliation-v1',
    body: { paymentId: payment.id },
  });

const commissionPolicyCode = 'COM-KT-P1-2026';
let commissionPolicy = (await list('/api/v1/commission-policies')).find(
  (item) =>
    item.code === commissionPolicyCode && item.status === 'PUBLISHED' && Number(item.version) === 1,
);
commissionPolicy ??= await request('/api/v1/commission-policies', {
  method: 'POST',
  body: {
    code: commissionPolicyCode,
    name: 'P1 演示标准佣金政策',
    applicability: { currency: 'CNY', channel: 'DIRECT' },
    baseRateBasisPoints: 300,
    minimumMarginBasisPoints: 2000,
    releaseCollectionBasisPoints: 10000,
    effectiveAt: '2026-01-01T00:00:00.000Z',
    rules: [{ rule: 'full-collection-before-release', enabled: true }],
    publish: true,
  },
});

let commission = (await list('/api/v1/commissions')).find(
  (item) =>
    (item.sales_order_id ?? item.salesOrderId) === order.id &&
    (item.beneficiary_employee_id ?? item.beneficiaryEmployeeId) === adminEmployeeId &&
    Number(item.policyVersion ?? item.policy_version ?? 1) === 1,
);
commission ??= await request('/api/v1/commissions/accrue', {
  method: 'POST',
  key: 'kt-p1-seed-commission-accrue-v1',
  body: {
    salesOrderId: order.id,
    beneficiaryEmployeeId: adminEmployeeId,
    policyVersionId: commissionPolicy.id,
    accountingPeriod: '2026-08',
  },
});

const finalBankReference = 'BANK-KT-P1-DEMO-FINAL';
receivable = (await list('/api/v1/ar-open-items')).find(
  (item) => (item.salesOrderId ?? item.sales_order_id) === order.id,
);
let finalPayment = (await list('/api/v1/bank-payments')).find(
  (item) => (item.bank_reference ?? item.bankReference) === finalBankReference,
);
if (!finalPayment && Number(receivable.remaining_amount ?? receivable.remainingAmount) > 0)
  finalPayment = await request('/api/v1/bank-payments', {
    method: 'POST',
    key: 'kt-p1-seed-payment-final-v1',
    body: {
      customerId: customer.id,
      currency: 'CNY',
      amount: String(receivable.remaining_amount ?? receivable.remainingAmount),
      receivedAt: '2026-08-17T12:00:00.000Z',
      bankReference: finalBankReference,
      rawPayload: { payer: '金特夫 P1 全链路演示客户', source: 'DEMO_BANK_STATEMENT' },
    },
  });
if (finalPayment && Number(finalPayment.remaining_amount ?? finalPayment.remainingAmount) > 0)
  await request('/api/v1/reconciliation-runs', {
    method: 'POST',
    key: 'kt-p1-seed-reconciliation-final-v1',
    body: { paymentId: finalPayment.id },
  });

commission = (await list('/api/v1/commissions')).find((item) => item.id === commission.id);
let commissionState = statusOf(commission);
if (commissionState === 'FROZEN') {
  await request(`/api/v1/commissions/${commission.id}/release`, {
    method: 'POST',
    key: 'kt-p1-seed-commission-release-v1',
    body: { reason: 'P1 演示订单已全额回款，释放佣金', externalReference: null },
  });
  commissionState = 'RELEASED';
}
if (commissionState === 'RELEASED') {
  await request(`/api/v1/commissions/${commission.id}/pay`, {
    method: 'POST',
    key: 'kt-p1-seed-commission-pay-v1',
    body: { reason: 'P1 演示佣金进入工资支付', externalReference: 'PAYROLL-COM-2026-08-001' },
  });
  commissionState = 'PAID';
}
if (commissionState === 'PAID')
  await request(`/api/v1/commissions/${commission.id}/clawback`, {
    method: 'POST',
    key: 'kt-p1-seed-commission-clawback-v1',
    body: { reason: 'P1 演示退款追回场景', externalReference: 'CLAWBACK-COM-2026-08-001' },
  });

await ensureCredit('REJECTED', '2099-04-30T23:59:59.000Z', 'kt-p1-seed-credit-rejected-v1');
await ensureCredit('EXPIRED', '2000-01-01T00:00:00.000Z', 'kt-p1-seed-credit-expired-v1');

process.stdout.write(
  `${JSON.stringify({ baseUrl, customerId: customer.id, opportunityId: opportunity.id, quoteRevisionId: quote.id, contractRevisionId: contract.id, orderId: order.id, commissionId: commission.id, outcomes: ['APPROVED', 'REJECTED', 'EXPIRED'] }, null, 2)}\n`,
);
