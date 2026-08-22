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

const riskPolicyCode = 'RISK-KT-P1-2026';
let riskPolicy = (await list('/api/v1/risk-policies')).find(
  (item) => item.code === riskPolicyCode && item.status === 'PUBLISHED',
);
riskPolicy ??= await request('/api/v1/risk-policies', {
  method: 'POST',
  body: {
    code: riskPolicyCode,
    name: 'P1 经营风险基线',
    minimumMarginBasisPoints: 2500,
    overdueGraceDays: 0,
    creditWarningDays: 30,
    effectiveAt: '2026-01-01T00:00:00.000Z',
    rules: [{ code: 'LOW_MARGIN' }, { code: 'OVERDUE_AR' }, { code: 'CREDIT_EXPIRY' }],
    publish: true,
  },
});
let risk = (await list('/api/v1/risk-evaluations')).find(
  (item) => (item.sales_order_id ?? item.salesOrderId) === order.id,
);
risk ??= await request('/api/v1/risk-evaluations', {
  method: 'POST',
  key: 'kt-p1-risk-evaluate-v1',
  body: {
    salesOrderId: order.id,
    policyVersionId: riskPolicy.id,
    assigneeEmployeeId: adminEmployeeId,
    validUntil: '2026-09-16T00:00:00.000Z',
    dueAt: '2026-08-20T00:00:00.000Z',
  },
});
if (risk.taskId)
  risk = (await list('/api/v1/risk-evaluations')).find((item) => item.id === risk.id);
const task = risk.task ?? {};
let riskState = task.effective_state ?? task.effectiveState;
const riskTaskId = task.id ?? risk.taskId;
for (const [from, action, state, key, reason, evidence] of [
  [
    'OPEN',
    'acknowledge',
    'ACKNOWLEDGED',
    'kt-p1-risk-ack-v1',
    '销售负责人已确认毛利例外',
    { ticket: 'RISK-KT-P1-001' },
  ],
  [
    'ACKNOWLEDGED',
    'escalate',
    'ESCALATED',
    'kt-p1-risk-escalate-v1',
    '提交管理层复核',
    { ticket: 'RISK-KT-P1-001', level: 'MANAGEMENT' },
  ],
  [
    'ESCALATED',
    'close',
    'CLOSED',
    'kt-p1-risk-close-v1',
    '例外审批证据已归档',
    { ticket: 'RISK-KT-P1-001', approval: 'APPROVED' },
  ],
])
  if (riskState === from) {
    await request(`/api/v1/risk-tasks/${riskTaskId}/${action}`, {
      method: 'POST',
      key,
      body: { reason, evidence },
    });
    riskState = state;
  }

await ensureCredit('REJECTED', '2099-04-30T23:59:59.000Z', 'kt-p1-seed-credit-rejected-v1');
await ensureCredit('EXPIRED', '2000-01-01T00:00:00.000Z', 'kt-p1-seed-credit-expired-v1');

const manufacturingItems = await list('/api/v1/manufacturing-items');
async function ensureItem(sku, name, itemType, baseUnitCode, specification) {
  const existing = manufacturingItems.find(
    (item) => item.sku === sku && item.status === 'PUBLISHED',
  );
  if (existing) return existing;
  return request('/api/v1/manufacturing-items', {
    method: 'POST',
    body: {
      sku,
      name,
      itemType,
      baseUnitCode,
      specification,
      effectiveAt: '2026-01-01T00:00:00.000Z',
      publish: true,
    },
  });
}
const yarn = await ensureItem('RM-KT-YARN-12000', '12000D 直丝草纱', 'RAW_MATERIAL', 'KG', {
  dtex: 12000,
  color: '双色绿',
});
const substituteYarn = await ensureItem(
  'RM-KT-YARN-11000',
  '11000D 替代草纱',
  'RAW_MATERIAL',
  'KG',
  { dtex: 11000, color: '双色绿' },
);
const backing = await ensureItem('RM-KT-BACKING-PP', 'PP 复合底布', 'RAW_MATERIAL', 'M2', {
  layers: 2,
});
const finishedGood = await ensureItem('FG-KT-PRO-50', '金特夫 50mm 景观草', 'FINISHED_GOOD', 'M2', {
  pileHeightMm: 50,
  gauge: '3/8',
});
let bom = (await list('/api/v1/manufacturing-boms')).find(
  (item) => item.code === 'BOM-KT-PRO-50' && item.status === 'PUBLISHED',
);
bom ??= await request('/api/v1/manufacturing-boms', {
  method: 'POST',
  body: {
    code: 'BOM-KT-PRO-50',
    name: '50mm 景观草标准 BOM',
    productItemId: finishedGood.itemId,
    productItemVersionId: finishedGood.id,
    outputQuantity: '1',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    lines: [
      {
        componentItemVersionId: yarn.id,
        quantity: '1.25',
        scrapBasisPoints: 300,
        substitutes: [{ itemVersionId: substituteYarn.id, priority: 1, conversionFactor: '1.05' }],
      },
      { componentItemVersionId: backing.id, quantity: '1', scrapBasisPoints: 100, substitutes: [] },
    ],
    publish: true,
  },
});
let routing = (await list('/api/v1/manufacturing-routings')).find(
  (item) => item.code === 'RT-KT-PRO-50' && item.status === 'PUBLISHED',
);
routing ??= await request('/api/v1/manufacturing-routings', {
  method: 'POST',
  body: {
    code: 'RT-KT-PRO-50',
    name: '50mm 景观草标准工艺',
    productItemId: finishedGood.itemId,
    productItemVersionId: finishedGood.id,
    effectiveAt: '2026-01-01T00:00:00.000Z',
    publish: true,
    operations: [
      {
        operationCode: 'TUFT',
        name: '簇绒',
        workCenterCode: 'WC-TUFT-01',
        sequence: 10,
        setupMinutes: '60',
        runMinutesPerUnit: '0.8',
        instructions: { qualityGate: 'pile-height' },
      },
      {
        operationCode: 'COAT',
        name: '背胶',
        workCenterCode: 'WC-COAT-01',
        sequence: 20,
        setupMinutes: '45',
        runMinutesPerUnit: '0.5',
        instructions: { cureMinutes: 20 },
      },
      {
        operationCode: 'PACK',
        name: '裁切包装',
        workCenterCode: 'WC-PACK-01',
        sequence: 30,
        setupMinutes: '20',
        runMinutesPerUnit: '0.2',
        instructions: { rollWidthM: 4 },
      },
    ],
  },
});

let supplier = (await list('/api/v1/suppliers')).find(
  (item) => (item.supplier_number ?? item.supplierNumber) === 'SUP-KT-YARN-001',
);
supplier ??= await request('/api/v1/suppliers', {
  method: 'POST',
  body: {
    supplierNumber: 'SUP-KT-YARN-001',
    name: '青岛金特夫草纱战略供应商',
    currency: 'CNY',
    paymentTermsDays: 30,
    qualityRatingBasisPoints: 9300,
    contact: { name: '供应链窗口', phone: '0532-88886666' },
  },
});
if (
  !(supplier.qualifications ?? []).some(
    (item) =>
      (item.item_version_id ?? item.itemVersionId) === yarn.id && item.status === 'APPROVED',
  )
)
  await request(`/api/v1/suppliers/${supplier.id}/qualifications`, {
    method: 'POST',
    body: {
      itemVersionId: yarn.id,
      status: 'APPROVED',
      validFrom: '2026-01-01',
      validTo: '2099-12-31',
      minimumOrderQuantity: '1000',
      leadTimeDays: 14,
      evidence: { audit: 'SUP-AUDIT-KT-2026-001', sample: 'PASS' },
    },
  });
let location = (await list('/api/v1/inventory-locations')).find((item) => item.code === 'RAW-A01');
location ??= await request('/api/v1/inventory-locations', {
  method: 'POST',
  body: { code: 'RAW-A01', name: '原料仓 A01', locationType: 'STORAGE' },
});
let rfq = (await list('/api/v1/procurement-rfqs')).find(
  (item) => (item.rfq_number ?? item.rfqNumber) === 'RFQ-KT-YARN-2026-001',
);
rfq ??= await request('/api/v1/procurement-rfqs', {
  method: 'POST',
  body: {
    rfqNumber: 'RFQ-KT-YARN-2026-001',
    responseDueAt: '2026-09-01T00:00:00.000Z',
    currency: 'CNY',
    issue: true,
    lines: [{ itemVersionId: yarn.id, quantity: '5000', requiredAt: '2026-10-01' }],
  },
});
rfq = (await list('/api/v1/procurement-rfqs')).find((item) => item.id === rfq.id);
const rfqLine = rfq.lines[0];
let supplierQuote = (await list('/api/v1/supplier-quotes')).find(
  (item) => (item.quote_reference ?? item.quoteReference) === 'SQ-KT-YARN-2026-001',
);
supplierQuote ??= await request('/api/v1/supplier-quotes', {
  method: 'POST',
  body: {
    rfqId: rfq.id,
    supplierId: supplier.id,
    quoteReference: 'SQ-KT-YARN-2026-001',
    receivedAt: '2026-08-25T08:00:00.000Z',
    validUntil: '2026-12-31',
    terms: { incoterm: 'DAP', paymentTermsDays: 30 },
    lines: [
      {
        rfqLineId: rfqLine.id,
        unitPrice: '12.5',
        promisedAt: '2026-10-01',
        minimumOrderQuantity: '1000',
      },
    ],
  },
});
let purchaseOrder = (await list('/api/v1/purchase-orders')).find(
  (item) => (item.po_number ?? item.poNumber) === 'PO-KT-YARN-2026-001',
);
purchaseOrder ??= await request('/api/v1/purchase-orders', {
  method: 'POST',
  body: {
    poNumber: 'PO-KT-YARN-2026-001',
    supplierId: supplier.id,
    supplierQuoteId: supplierQuote.id,
    currency: 'CNY',
    issue: true,
    lines: [
      { itemVersionId: yarn.id, quantity: '5000', unitPrice: '12.5', requiredAt: '2026-10-01' },
    ],
  },
});
purchaseOrder = (await list('/api/v1/purchase-orders')).find(
  (item) => item.id === purchaseOrder.id,
);
let goodsReceipt = (await list('/api/v1/goods-receipts')).find(
  (item) => (item.receipt_number ?? item.receiptNumber) === 'GR-KT-YARN-2026-001',
);
goodsReceipt ??= await request('/api/v1/goods-receipts', {
  method: 'POST',
  body: {
    receiptNumber: 'GR-KT-YARN-2026-001',
    purchaseOrderId: purchaseOrder.id,
    receivedAt: '2026-10-01T08:00:00.000Z',
    sourceReference: 'DN-KT-YARN-001',
    lines: [
      {
        purchaseOrderLineId: purchaseOrder.lines[0].id,
        lotNumber: 'LOT-KT-YARN-20260920-A',
        locationCode: location.code,
        quantity: '5000',
        manufacturedAt: '2026-09-20',
        expiresAt: null,
      },
    ],
  },
});

const receivedYarnLot = (await list('/api/v1/inventory-balances')).find(
  (item) => (item.lot_number ?? item.lotNumber) === 'LOT-KT-YARN-20260920-A',
);
assert(receivedYarnLot, 'received yarn lot is required');
if ((receivedYarnLot.quality_status ?? receivedYarnLot.qualityStatus) !== 'RELEASED') {
  let incomingPlan = (await list('/api/v1/quality-plans')).find(
    (item) => (item.code ?? item.plan_code) === 'QP-KT-YARN-INCOMING-V1',
  );
  incomingPlan ??= await request('/api/v1/quality-plans', {
    method: 'POST',
    body: {
      code: 'QP-KT-YARN-INCOMING-V1',
      name: 'KT-RG01 草纱来料放行检验',
      itemVersionId: yarn.id,
      inspectionStage: 'INCOMING',
      samplingMethod: '固定抽样 5kg',
      acceptanceRule: { requiredPassRate: 1, task: 'KT-RG01' },
      effectiveAt: '2026-01-01T00:00:00.000Z',
      characteristics: [
        {
          code: 'YARN-TEX',
          name: '纱线线密度',
          dataType: 'NUMERIC',
          unitCode: 'TEX',
          lowerLimit: '11950',
          upperLimit: '12050',
          required: true,
          instructions: '按来料检验规程测量线密度',
        },
      ],
      publish: true,
    },
  });
  const planCharacteristics = incomingPlan.characteristics ?? [];
  assert(planCharacteristics[0], 'incoming yarn plan characteristic is required');
  let inspection = (await list('/api/v1/quality-inspections')).find(
    (item) => (item.inspection_number ?? item.inspectionNumber) === 'QI-KT-YARN-2026-001',
  );
  inspection ??= await request('/api/v1/quality-inspections', {
    method: 'POST',
    body: {
      inspectionNumber: 'QI-KT-YARN-2026-001',
      planVersionId: incomingPlan.id,
      lotId: receivedYarnLot.lot_id ?? receivedYarnLot.lotId,
      sourceType: 'GOODS-RECEIPT',
      sourceId: goodsReceipt.id,
      sampleSize: '5',
    },
  });
  const inspectionState = () => inspection.effective_state ?? inspection.effectiveState;
  if (inspectionState() === 'OPEN')
    inspection = await request(`/api/v1/quality-inspections/${inspection.id}/sample`, {
      method: 'POST',
      body: {
        reason: 'KT-RG01 来料抽样',
        evidence: { sampleReference: 'SAMPLE-KT-YARN-2026-001' },
        idempotencyKey: 'QI-KT-YARN-2026-001-SAMPLE',
      },
    });
  const recordedResults = inspection.results ?? [];
  if (recordedResults.length === 0)
    await request(`/api/v1/quality-inspections/${inspection.id}/results`, {
      method: 'POST',
      body: {
        characteristicId: planCharacteristics[0].id,
        measuredNumeric: '12000',
        passed: true,
        notes: 'KT-RG01 标准来料验收结果',
        occurredAt: '2026-10-01T09:00:00.000Z',
        idempotencyKey: 'QI-KT-YARN-2026-001-YARN-TEX',
      },
    });
  inspection = (await list('/api/v1/quality-inspections')).find(
    (item) => item.id === inspection.id,
  );
  if (inspectionState() === 'SAMPLED')
    inspection = await request(`/api/v1/quality-inspections/${inspection.id}/complete`, {
      method: 'POST',
      body: {
        reason: '必检特性全部合格',
        evidence: { reportReference: 'IR-KT-YARN-2026-001' },
        idempotencyKey: 'QI-KT-YARN-2026-001-COMPLETE',
      },
    });
  if (inspectionState() === 'COMPLETED')
    await request(`/api/v1/quality-inspections/${inspection.id}/release`, {
      method: 'POST',
      body: {
        reason: '来料检验合格，批准生产领用',
        evidence: { dispositionReference: 'QD-KT-YARN-2026-001' },
        idempotencyKey: 'QI-KT-YARN-2026-001-RELEASE',
      },
    });
}

const mrpPolicies = await list('/api/v1/mrp-policies');
async function ensureMrpPolicy(
  itemVersionId,
  makeOrBuy,
  safetyStock,
  minimumOrderQuantity,
  orderMultiple,
  leadTimeDays,
) {
  const existing = mrpPolicies.find(
    (item) =>
      (item.item_version_id ?? item.itemVersionId) === itemVersionId &&
      (item.effective_at ?? item.effectiveAt)?.startsWith('2026-01-01'),
  );
  if (existing) return existing;
  return request('/api/v1/mrp-policies', {
    method: 'POST',
    body: {
      itemVersionId,
      safetyStock,
      minimumOrderQuantity,
      orderMultiple,
      leadTimeDays,
      freezeWindowDays: 7,
      makeOrBuy,
      effectiveAt: '2026-01-01T00:00:00.000Z',
    },
  });
}
await ensureMrpPolicy(finishedGood.id, 'MAKE', '0', '1000', '500', 7);
await ensureMrpPolicy(yarn.id, 'BUY', '500', '1000', '500', 14);
await ensureMrpPolicy(backing.id, 'BUY', '1000', '1000', '1000', 10);
const mrpDemands = await list('/api/v1/mrp-demands');
async function ensureDemand(sourceType, sourceId, requiredAt, quantity, priority) {
  const existing = mrpDemands.find(
    (item) =>
      (item.source_type ?? item.sourceType) === sourceType &&
      (item.source_id ?? item.sourceId) === sourceId &&
      (item.required_at ?? item.requiredAt) === requiredAt,
  );
  if (existing) return existing;
  return request('/api/v1/mrp-demands', {
    method: 'POST',
    body: { itemVersionId: finishedGood.id, sourceType, sourceId, requiredAt, quantity, priority },
  });
}
await ensureDemand('FROZEN-DEMO', customer.id, '2026-08-20', '100', 1);
await ensureDemand('SALES-ORDER', order.id, '2026-11-15', '8000', 10);
let mrpRun = (await list('/api/v1/mrp-runs')).find(
  (item) => (item.run_number ?? item.runNumber) === 'MRP-KT-2026-001',
);
mrpRun ??= await request('/api/v1/mrp-runs', {
  method: 'POST',
  body: {
    runNumber: 'MRP-KT-2026-001',
    asOf: '2026-08-16T00:00:00.000Z',
    horizonEnd: '2026-12-31',
  },
});
mrpRun = (await list('/api/v1/mrp-runs')).find((item) => item.id === mrpRun.id);
for (const proposal of mrpRun.proposals) {
  let state = proposal.effectiveState;
  if (state === 'PROPOSED') {
    await request(`/api/v1/mrp-proposals/${proposal.id}/approve`, {
      method: 'POST',
      body: {
        reason: proposal.frozen ? '冻结窗口内由计划经理批准' : '计划员审核计算解释后批准',
        evidence: {
          approval: `MRP-APPROVAL-${proposal.id}`,
          ...(proposal.frozen ? { freezeOverrideApproval: 'FREEZE-OVERRIDE-KT-2026-001' } : {}),
        },
      },
    });
    state = 'APPROVED';
  }
  if (state === 'APPROVED')
    await request(`/api/v1/mrp-proposals/${proposal.id}/release`, {
      method: 'POST',
      body: { reason: '释放到执行队列', evidence: { releaseBatch: 'MRP-KT-2026-001' } },
    });
}

const productionProposal = mrpRun.proposals.find(
  (proposal) => proposal.proposal_type === 'PRODUCTION' && Number(proposal.quantity) === 1000,
);
assert(productionProposal, 'released 1,000m² production proposal is required');
const yarnLot = (await list('/api/v1/inventory-balances')).find(
  (item) => (item.lot_number ?? item.lotNumber) === 'LOT-KT-YARN-20260920-A',
);
assert(yarnLot, 'received yarn lot is required');
assert.equal(
  yarnLot.quality_status ?? yarnLot.qualityStatus,
  'RELEASED',
  'production demo requires the yarn lot to be quality released',
);
let productionOrder = (await list('/api/v1/production-orders')).find(
  (item) => (item.order_number ?? item.orderNumber) === 'WO-KT-2026-001',
);
productionOrder ??= await request('/api/v1/production-orders', {
  method: 'POST',
  body: {
    orderNumber: 'WO-KT-2026-001',
    itemVersionId: finishedGood.id,
    routingVersionId: routing.id,
    mrpProposalId: productionProposal.id,
    plannedQuantity: '1000',
    plannedStartAt: '2026-08-13',
    plannedDueAt: '2026-08-20',
    sourceReference: 'MRP-KT-2026-001-PRODUCTION-1000',
  },
});
const reloadProductionOrder = async () =>
  (await list('/api/v1/production-orders')).find((item) => item.id === productionOrder.id);
productionOrder = await reloadProductionOrder();
if (productionOrder.state === 'DRAFT') {
  await request(`/api/v1/production-orders/${productionOrder.id}/release`, {
    method: 'POST',
    body: {
      reason: '已核对下达的 MRP 建议与发布工艺',
      evidence: { mrpProposalId: productionProposal.id, routingVersionId: routing.id },
      idempotencyKey: 'WO-KT-2026-001-RELEASE',
    },
  });
  productionOrder = await reloadProductionOrder();
}
if (productionOrder.state === 'RELEASED') {
  await request(`/api/v1/production-orders/${productionOrder.id}/start`, {
    method: 'POST',
    body: {
      reason: 'A 班开工，原料已备齐',
      evidence: { shift: 'A', supervisor: adminEmployeeId },
      idempotencyKey: 'WO-KT-2026-001-START',
    },
  });
  productionOrder = await reloadProductionOrder();
}
if (productionOrder.materials.length === 0) {
  await request(`/api/v1/production-orders/${productionOrder.id}/materials`, {
    method: 'POST',
    body: {
      transactionType: 'ISSUE',
      itemVersionId: yarn.id,
      lotId: yarnLot.lotId ?? yarnLot.lot_id,
      locationId: location.id,
      quantity: '1287.5',
      reason: '按 1,000m² BOM 含 3% 损耗领用草纱',
      occurredAt: '2026-08-17T08:00:00.000Z',
      idempotencyKey: 'WO-KT-2026-001-YARN-ISSUE',
    },
  });
  productionOrder = await reloadProductionOrder();
}
for (const operation of productionOrder.operations) {
  if (
    !productionOrder.reports.some(
      (report) =>
        (report.production_order_operation_id ?? report.productionOrderOperationId) ===
        operation.id,
    )
  )
    await request(`/api/v1/production-orders/${productionOrder.id}/operation-reports`, {
      method: 'POST',
      body: {
        operationId: operation.id,
        goodQuantity: '1000',
        scrapQuantity: operation.operation_code === 'TUFT' ? '12.5' : '0',
        laborMinutes: operation.operation_code === 'TUFT' ? '860' : '540',
        machineMinutes: operation.operation_code === 'PACK' ? '220' : '800',
        startedAt: `2026-08-${operation.sequence === 10 ? '17' : operation.sequence === 20 ? '18' : '19'}T08:00:00.000Z`,
        completedAt: `2026-08-${operation.sequence === 10 ? '17' : operation.sequence === 20 ? '18' : '19'}T20:00:00.000Z`,
        notes: `${operation.name} 完成并由班组长确认`,
        idempotencyKey: `WO-KT-2026-001-${operation.operation_code}-REPORT`,
      },
    });
}
productionOrder = await reloadProductionOrder();
const finalReport = productionOrder.reports.find((report) => {
  const operation = productionOrder.operations.find(
    (item) =>
      item.id === (report.production_order_operation_id ?? report.productionOrderOperationId),
  );
  return operation?.operation_code === 'PACK';
});
assert(finalReport, 'final packaging operation report is required');
if (productionOrder.rolls.length === 0) {
  await request(`/api/v1/production-orders/${productionOrder.id}/finished-rolls`, {
    method: 'POST',
    body: {
      operationReportId: finalReport.id,
      itemVersionId: finishedGood.id,
      rollNumber: 'ROLL-KT-2026-001',
      lotNumber: 'LOT-KT-FG-20260819-A',
      locationId: location.id,
      quantity: '1000',
      manufacturedAt: '2026-08-19',
    },
  });
  productionOrder = await reloadProductionOrder();
}
if (productionOrder.state === 'IN_PROGRESS') {
  await request(`/api/v1/production-orders/${productionOrder.id}/complete`, {
    method: 'POST',
    body: {
      reason: '全部工序已完成且成品卷已入库待检',
      evidence: { finalReportId: finalReport.id, rollNumber: 'ROLL-KT-2026-001' },
      idempotencyKey: 'WO-KT-2026-001-COMPLETE',
    },
  });
  productionOrder = await reloadProductionOrder();
}
if (productionOrder.state === 'COMPLETED') {
  await request(`/api/v1/production-orders/${productionOrder.id}/close`, {
    method: 'POST',
    body: {
      reason: '计划数量、序列卷和库存收货已核对',
      evidence: { outputQuantity: '1000', inventoryState: 'QUARANTINE' },
      idempotencyKey: 'WO-KT-2026-001-CLOSE',
    },
  });
  productionOrder = await reloadProductionOrder();
}

let returnDemoOrder = (await list('/api/v1/production-orders')).find(
  (item) => (item.order_number ?? item.orderNumber) === 'WO-KT-2026-RETURN-DEMO',
);
returnDemoOrder ??= await request('/api/v1/production-orders', {
  method: 'POST',
  body: {
    orderNumber: 'WO-KT-2026-RETURN-DEMO',
    itemVersionId: finishedGood.id,
    routingVersionId: routing.id,
    plannedQuantity: '10',
    plannedStartAt: '2026-08-20',
    plannedDueAt: '2026-08-21',
    sourceReference: 'PRODUCTION-RETURN-CONTROL-DEMO',
  },
});
const reloadReturnDemo = async () =>
  (await list('/api/v1/production-orders')).find((item) => item.id === returnDemoOrder.id);
returnDemoOrder = await reloadReturnDemo();
if (returnDemoOrder.state === 'DRAFT') {
  await request(`/api/v1/production-orders/${returnDemoOrder.id}/release`, {
    method: 'POST',
    body: {
      reason: '退料控制场景下达',
      evidence: { purpose: 'RETURN-CONTROL' },
      idempotencyKey: 'WO-KT-2026-RETURN-DEMO-RELEASE',
    },
  });
  await request(`/api/v1/production-orders/${returnDemoOrder.id}/start`, {
    method: 'POST',
    body: {
      reason: '退料控制场景开工',
      evidence: { purpose: 'RETURN-CONTROL' },
      idempotencyKey: 'WO-KT-2026-RETURN-DEMO-START',
    },
  });
  returnDemoOrder = await reloadReturnDemo();
}
if (returnDemoOrder.materials.length === 0) {
  await request(`/api/v1/production-orders/${returnDemoOrder.id}/materials`, {
    method: 'POST',
    body: {
      transactionType: 'ISSUE',
      itemVersionId: yarn.id,
      lotId: yarnLot.lotId ?? yarnLot.lot_id,
      locationId: location.id,
      quantity: '10',
      reason: '退料演示初始领料',
      occurredAt: '2026-08-20T08:00:00.000Z',
      idempotencyKey: 'WO-KT-2026-RETURN-DEMO-ISSUE',
    },
  });
  await request(`/api/v1/production-orders/${returnDemoOrder.id}/materials`, {
    method: 'POST',
    body: {
      transactionType: 'RETURN',
      itemVersionId: yarn.id,
      lotId: yarnLot.lotId ?? yarnLot.lot_id,
      locationId: location.id,
      quantity: '2',
      reason: '班次结束退回未使用草纱',
      occurredAt: '2026-08-20T18:00:00.000Z',
      idempotencyKey: 'WO-KT-2026-RETURN-DEMO-RETURN',
    },
  });
  returnDemoOrder = await reloadReturnDemo();
}

process.stdout.write(
  `${JSON.stringify({ baseUrl, customerId: customer.id, opportunityId: opportunity.id, quoteRevisionId: quote.id, contractRevisionId: contract.id, orderId: order.id, commissionId: commission.id, riskEvaluationId: risk.id, manufacturing: { finishedGoodVersionId: finishedGood.id, bomVersionId: bom.id, routingVersionId: routing.id }, procurement: { supplierId: supplier.id, rfqId: rfq.id, supplierQuoteId: supplierQuote.id, purchaseOrderId: purchaseOrder.id, goodsReceiptId: goodsReceipt.id, locationId: location.id }, mrp: { runId: mrpRun.id, calculationCount: mrpRun.calculations.length, proposalCount: mrpRun.proposals.length }, production: { orderId: productionOrder.id, state: productionOrder.state, operationCount: productionOrder.operations.length, materialTransactionCount: productionOrder.materials.length, reportCount: productionOrder.reports.length, rollCount: productionOrder.rolls.length, returnControlOrderId: returnDemoOrder.id, returnControlTransactions: returnDemoOrder.materials.length }, outcomes: ['APPROVED', 'REJECTED', 'EXPIRED'] }, null, 2)}\n`,
);
