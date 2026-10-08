/** Seed a valid commercial→QTC→legal graph through the application's real HTTP API.
 * Receipts are synthetic local evidence; no provider or production endpoint is called. */
export async function releasedOrderFixture(
  request: (
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
  builder: string,
  approver: string,
): Promise<{
  orderId: string;
  customerId: string;
  opportunityId: string;
  collectionId: string;
  handoffId: string;
}> {
  const id = (item: Record<string, unknown>, key = 'id'): string => {
    const value = item[key];
    if (typeof value !== 'string') throw new Error(`Fixture missing ${key}`);
    return value;
  };
  const customer = await request('/customers', builder, {
    name: 'Synthetic authorization customer',
    customerNumber: 'AUTH-CUSTOMER',
    tags: [],
  });
  const opportunity = await request('/opportunities', builder, {
    customerId: id(customer),
    leadId: null,
    name: 'SENSITIVE-OPPORTUNITY',
    value: '950000',
    currency: 'CNY',
    probabilityBasisPoints: 6000,
    expectedCloseDate: '2099-06-30',
  });
  const ctr = await request('/ctrs', builder, {
    opportunityId: id(opportunity),
    code: 'AUTH-CTR',
    title: 'Synthetic turf requirements',
    requirements: { pileHeightMm: 50 },
  });
  await request(`/ctr-versions/${id(ctr)}/submit`, builder, { expectedVersion: 1 });
  await request(`/ctr-versions/${id(ctr)}/decision`, builder, {
    decision: 'APPROVED',
    reason: 'Synthetic approved requirements',
  });
  const solution = await request('/technical-solutions', builder, {
    opportunityId: id(opportunity),
    code: 'AUTH-TS',
    ctrVersionId: id(ctr),
    specification: { secret: 'SENSITIVE-TECHNICAL', pileHeightMm: 50 },
    assumptions: [],
    final: true,
  });
  const model = await request('/cost-models', builder, {
    code: 'AUTH-COST',
    name: 'Synthetic cost',
    currency: 'CNY',
    publish: true,
    rules: [],
  });
  const cost = await request('/cost-evaluations', builder, {
    modelVersionId: id(model),
    technicalSolutionRevisionId: id(solution),
    currency: 'CNY',
    lines: [
      {
        key: 'turf',
        description: 'Synthetic turf',
        quantity: '1',
        unit: 'EA',
        unitCost: '700000',
        currency: 'CNY',
      },
    ],
    context: {},
  });
  const policy = await request('/sales-policies', builder, {
    code: 'AUTH-POLICY',
    name: 'Synthetic policy',
    publish: true,
    rules: [],
  });
  const evaluation = await request('/sales-policy-evaluations', builder, {
    policyVersionId: id(policy),
    costDecisionId: id(cost),
    context: { marginBasisPoints: 2631, discountBasisPoints: 500 },
  });
  const quote = await request('/quotes', builder, {
    quoteNumber: 'AUTH-QUOTE',
    opportunityId: id(opportunity),
    ctrVersionId: id(ctr),
    technicalSolutionRevisionId: id(solution),
    costDecisionId: id(cost),
    policyVersionId: id(policy),
    policyEvaluationId: id(evaluation),
    currency: 'CNY',
    subtotal: '1000000',
    discount: '50000',
    total: '950000',
    costTotal: '700000',
    margin: '250000',
    marginBasisPoints: 2631,
    validUntil: '2099-06-30T23:59:59Z',
    lines: [
      {
        description: 'Turf',
        quantity: '1',
        unitCode: 'EA',
        unitPrice: '1000000',
        total: '1000000',
      },
    ],
  });
  await request(`/quote-revisions/${id(quote)}/approve`, builder, {
    decision: 'APPROVED',
    reason: 'Synthetic quote review',
  });
  await request(`/quote-revisions/${id(quote)}/issue`, builder, {});
  const quoteList = await request('/quotes', builder);
  const issued = (quoteList.items as Record<string, unknown>[]).find(
    (item) => item.id === quote.id,
  );
  if (!issued) throw new Error('Issued quote unavailable');
  const limit = await request('/credit-limits', builder, {
    customerId: id(customer),
    currency: 'CNY',
    amount: '5000000',
    effectiveAt: '2026-01-01T00:00:00Z',
    expiresAt: '2099-12-31T23:59:59Z',
  });
  const credit = await request('/credit-decisions', builder, {
    customerId: id(customer),
    quoteRevisionId: id(quote),
    quoteSnapshotId: id(issued, 'issuedSnapshotId'),
    creditLimitId: id(limit),
    validUntil: '2099-03-31T23:59:59Z',
  });
  await request(`/credit-decisions/${id(credit)}/approve`, approver, {
    decision: 'APPROVED',
    reason: 'Independent synthetic credit approval',
  });
  const contract = await request('/contracts', builder, {
    customerId: id(customer),
    opportunityId: id(opportunity),
    contractNumber: 'AUTH-CONTRACT',
    quoteRevisionId: id(quote),
    quoteSnapshotId: id(issued, 'issuedSnapshotId'),
    content: { paymentTerms: 'Synthetic payment terms' },
  });
  const signed = await request(`/contracts/${id(contract)}/sign`, builder, {
    provider: 'LOCAL_TEST_EVIDENCE',
    providerReceiptId: 'SYNTHETIC-RECEIPT',
    payload: { acknowledged: true },
    signedAt: '2026-08-16T12:00:00Z',
  });
  const order = await request('/sales-orders', builder, {
    customerId: id(customer),
    opportunityId: id(opportunity),
    orderNumber: 'AUTH-ORDER',
    quoteRevisionId: id(quote),
    quoteSnapshotId: id(issued, 'issuedSnapshotId'),
    creditDecisionId: id(credit),
    contractRevisionId: id(contract),
    signatureEvidenceId: id(signed),
    currency: 'CNY',
    total: '950000',
    lines: [
      { description: 'Synthetic order', quantity: '1', unitPrice: '950000', total: '950000' },
    ],
  });
  const receivable = await request('/ar-open-items', builder, {
    customerId: id(customer),
    salesOrderId: id(order),
    documentNumber: 'SENSITIVE-AR',
    documentType: 'INVOICE',
    currency: 'CNY',
    amount: '950000',
    dueAt: '2026-01-01T00:00:00Z',
  });
  const session = await request('/auth/session', builder);
  const payment = await request('/bank-payments', builder, {
    customerId: id(customer),
    currency: 'CNY',
    amount: '100000',
    receivedAt: '2026-08-16T12:00:00Z',
    bankReference: 'SENSITIVE-PAYMENT',
    rawPayload: { source: 'LOCAL_TEST' },
  });
  await request('/reconciliation-runs', builder, { paymentId: id(payment) });
  const commissionPolicy = await request('/commission-policies', builder, {
    code: 'AUTH-COM',
    name: 'Synthetic commission',
    applicability: { currency: 'CNY', channel: 'DIRECT' },
    baseRateBasisPoints: 300,
    minimumMarginBasisPoints: 2000,
    releaseCollectionBasisPoints: 10000,
    effectiveAt: '2026-01-01T00:00:00Z',
    rules: [],
    publish: true,
  });
  await request('/commissions/accrue', builder, {
    salesOrderId: id(order),
    beneficiaryEmployeeId: id(session, 'employeeId'),
    policyVersionId: id(commissionPolicy),
    accountingPeriod: '2026-08',
  });
  const riskPolicy = await request('/risk-policies', builder, {
    code: 'AUTH-RISK',
    name: 'Synthetic risk',
    minimumMarginBasisPoints: 2500,
    overdueGraceDays: 0,
    creditWarningDays: 30,
    effectiveAt: '2026-01-01T00:00:00Z',
    rules: [],
    publish: true,
  });
  await request('/risk-evaluations', builder, {
    salesOrderId: id(order),
    policyVersionId: id(riskPolicy),
    assigneeEmployeeId: id(session, 'employeeId'),
    validUntil: '2099-01-01T00:00:00Z',
    dueAt: '2099-01-01T00:00:00Z',
  });
  const collection = await request('/collection-cases', builder, {
    caseNumber: 'AUTH-COLLECTION',
    arOpenItemId: id(receivable),
    assignedTo: id(session, 'employeeId'),
    priority: 'HIGH',
    reason: 'Synthetic overdue receivable',
    idempotencyKey: 'AUTH-COLLECTION',
  });
  await request(`/collection-cases/${id(collection)}/followups`, builder, {
    channel: 'PHONE',
    occurredAt: '2026-08-01T08:00:00Z',
    contactPerson: 'Synthetic debtor',
    outcome: 'Synthetic unpaid',
    evidence: {},
    idempotencyKey: 'AUTH-FOLLOWUP',
  });
  const handoff = await request(`/collection-cases/${id(collection)}/legal-handoffs`, builder, {
    handoffNumber: 'SENSITIVE-LEGAL-HANDOFF',
    reason: 'Synthetic handoff',
    idempotencyKey: 'AUTH-HANDOFF',
  });
  await request(`/legal-handoffs/${id(handoff)}/accept`, approver, {
    reason: 'SENSITIVE-LEGAL-REASON',
    evidence: { reference: 'SENSITIVE-LEGAL-EVIDENCE' },
    idempotencyKey: 'AUTH-LEGAL-ACCEPT',
  });
  await request(`/legal-handoffs/${id(handoff)}/evidence-packages`, approver, {
    packageNumber: 'SENSITIVE-PACKAGE',
    idempotencyKey: 'AUTH-PACKAGE',
  });
  return {
    orderId: id(order),
    customerId: id(customer),
    opportunityId: id(opportunity),
    collectionId: id(collection),
    handoffId: id(handoff),
  };
}
