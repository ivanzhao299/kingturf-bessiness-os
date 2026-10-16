// Synthetic, local-only CDP data. Never log these records or mix with real API traffic.
import {
  operationsPermissions,
  operationsRoutes,
  operationsValues,
} from './operations-fixtures.mjs';
const customers = [
  {
    id: 'cdp-customer-a',
    name: 'CDP客户甲',
    customerNumber: 'CDP-A',
    status: 'ACTIVE',
    ownerId: null,
    version: 1,
  },
  {
    id: 'cdp-customer-b',
    name: 'CDP客户乙',
    customerNumber: 'CDP-B',
    status: 'ACTIVE',
    ownerId: null,
    version: 1,
  },
];
const session = {
  employeeId: 'cdp-employee',
  companyId: 'cdp-company',
  displayName: 'CDP合成操作员',
  employeeNumber: null,
  permissions: [
    'customer:read',
    'customer:create',
    'customer-360:read',
    'cost-matrix:read',
    'cost-matrix:manage',
    'quote:read',
    'organization:read',
  ],
};
export function createStubRouter({
  salesViews = false,
  pricingViews = false,
  creditContractViews = false,
  fulfillmentViews = false,
  financeRiskViews = false,
  operationsViews = false,
  dashboardView = false,
} = {}) {
  const dashboardYear = new Date().getUTCFullYear();
  const dashboardQuery = new URLSearchParams({
    from: `${String(dashboardYear)}-01-01T00:00:00.000Z`,
    to: `${String(dashboardYear + 1)}-01-01T00:00:00.000Z`,
    currency: 'CNY',
  });
  const holds = new Map();
  const completions = new Map();
  const counts = new Map();
  let customerError = false;
  let lazyQuoteError = false;
  const keyFor = (pathname) =>
    new Map([
      ['/api/v1/auth/session', 'session'],
      ['/api/v1/customers', 'customers'],
      ['/api/v1/cost-matrix-summaries', 'cost'],
      ['/api/v1/quotes', 'quotes'],
      ['/api/v1/organizations', 'organizations'],
      ['/api/v1/customers/cdp-customer-a/360', 'detail'],
      ...(operationsViews ? operationsRoutes : []),
      ...(dashboardView ? [['/api/v1/executive-dashboard', 'dashboard']] : []),
      ...(financeRiskViews
        ? [
            ['/api/v1/ar-open-items', 'receivables'],
            ['/api/v1/collection-cases', 'collections'],
            ['/api/v1/bank-payments', 'bankPayments'],
            ['/api/v1/reconciliation-runs', 'reconciliationRuns'],
            ['/api/v1/commission-policies', 'commissionPolicies'],
            ['/api/v1/commissions', 'commissions'],
            ['/api/v1/risk-policies', 'riskPolicies'],
            ['/api/v1/risk-evaluations', 'riskEvaluations'],
          ]
        : []),
      ...(fulfillmentViews
        ? [
            ['/api/v1/sales-orders', 'salesOrders'],
            ['/api/v1/sales-orders/cdp-order-a/360', 'orderEvidence'],
            ['/api/v1/production-orders', 'productionOrders'],
            ['/api/v1/production-cost-policies', 'productionCostPolicies'],
            ['/api/v1/production-cost-runs', 'productionCostRuns'],
            ['/api/v1/shipment-releases', 'shipmentReleases'],
          ]
        : []),
      ...(creditContractViews
        ? [
            ['/api/v1/credit-limits', 'creditLimits'],
            ['/api/v1/credit-decisions', 'creditDecisions'],
            ['/api/v1/contracts', 'contracts'],
          ]
        : []),
      ...(pricingViews
        ? [
            ['/api/v1/sales-policies', 'policies'],
            ['/api/v1/sales-policy-evaluations', 'policyEvaluations'],
          ]
        : []),
      ...(salesViews
        ? [
            ['/api/v1/opportunities', 'opportunities'],
            ['/api/v1/ctrs', 'ctrs'],
            ['/api/v1/technical-solutions', 'solutions'],
          ]
        : []),
    ]).get(pathname);
  return {
    hold(key, query) {
      if (
        ![
          'cost',
          'detail',
          ...(process.argv.includes('--lazy-routes') ? ['solutions'] : []),
        ].includes(key) ||
        holds.has(key)
      )
        throw new Error('invalid synthetic hold');
      if (key === 'cost' && typeof query !== 'string') throw new Error('cost hold must bind query');
      let release;
      let requested;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const started = new Promise((resolve) => {
        requested = resolve;
      });
      const fulfilled = new Promise((resolve) => {
        completions.set(key, resolve);
      });
      holds.set(key, { gate, requested, release, query });
      return {
        started,
        fulfilled,
        release: () => {
          release();
          holds.delete(key);
        },
      };
    },
    releaseAll() {
      for (const hold of holds.values()) hold.release();
      holds.clear();
      for (const complete of completions.values()) complete();
      completions.clear();
    },
    didFulfill(key) {
      completions.get(key)?.();
      completions.delete(key);
    },
    detailFailure(value) {
      customerError = value;
    },
    lazyQuoteFailure(value) {
      if (!process.argv.includes('--lazy-routes')) throw new Error('lazy fixture is not enabled');
      lazyQuoteError = value;
    },
    counts() {
      return Object.fromEntries(counts);
    },
    async respond(pathname, method, parameters = new URLSearchParams()) {
      const key = keyFor(pathname);
      if (method !== 'GET' || !key) throw new Error('unmapped synthetic API request');
      if (key === 'dashboard' && parameters.toString() !== dashboardQuery.toString())
        throw new Error('unmapped synthetic API request query');
      if (key.startsWith('operations:')) {
        const expected = key === 'operations:complaints' ? 'limit=100' : '';
        if (parameters.toString() !== expected)
          throw new Error('unmapped synthetic API request query');
      }
      if (
        financeRiskViews &&
        [
          'receivables',
          'collections',
          'bankPayments',
          'reconciliationRuns',
          'commissionPolicies',
          'commissions',
          'riskPolicies',
          'riskEvaluations',
        ].includes(key)
      ) {
        const expected = ['receivables', 'bankPayments'].includes(key) ? 'limit=100' : '';
        if (parameters.toString() !== expected)
          throw new Error('unmapped synthetic API request query');
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const candidate = holds.get(key);
      const hold =
        candidate && (key !== 'cost' || parameters.get('q') === candidate.query)
          ? candidate
          : undefined;
      if (hold) {
        if (key === 'solutions') holds.delete(key);
        hold.requested();
        await hold.gate;
      }
      if ((key === 'detail' && customerError) || (key === 'quotes' && lazyQuoteError))
        return {
          completion: hold ? key : null,
          status: 503,
          value: { error: { message: 'CDP合成服务暂不可用，请重试' } },
        };
      const value = {
        ...operationsValues,
        dashboard: {
          metrics: {
            bookedRevenue: {
              unit: 'CNY',
              value: '25000',
              basis: 'CDP合成订单口径',
              source: 'CDP合成台账',
            },
            activeRisks: {
              unit: '项',
              value: '1',
              basis: 'CDP合成风险口径',
              source: 'CDP合成台账',
            },
          },
          filters: Object.fromEntries(dashboardQuery),
          refreshedAt: '2026-10-01T12:00:00.000Z',
          drilldowns: {
            orders: [{ orderNumber: 'CDP-DASH-SO-A', total: '25000', margin: '5000' }],
            risks: [
              { severity: 'HIGH', score: 45, state: 'OPEN', salesOrderId: 'cdp-dash-order-a' },
            ],
          },
        },
        session:
          salesViews ||
          pricingViews ||
          creditContractViews ||
          fulfillmentViews ||
          financeRiskViews ||
          operationsViews ||
          dashboardView
            ? {
                ...session,
                permissions: [
                  ...session.permissions,
                  ...(operationsViews ? operationsPermissions : []),
                  ...(dashboardView ? ['executive-dashboard:read'] : []),
                  ...(salesViews
                    ? ['opportunity:read', 'ctr:read', 'technical-solution:read']
                    : []),
                  ...(pricingViews ? ['sales-policy:read'] : []),
                  ...(creditContractViews ? ['credit:read', 'contract:read'] : []),
                  ...(financeRiskViews
                    ? [
                        'ar:read',
                        'collection:read',
                        'bank-payment:read',
                        'reconciliation:read',
                        'commission-policy:read',
                        'commission:read',
                        'risk-policy:read',
                        'risk:read',
                      ]
                    : []),
                  ...(fulfillmentViews
                    ? [
                        'sales-order:read',
                        'order-360:read',
                        'production:read',
                        'manufacturing-cost:read',
                        'shipment:read',
                      ]
                    : []),
                ],
              }
            : session,
        customers: { items: customers },
        receivables: {
          items: [
            {
              id: 'cdp-ar-a',
              documentNumber: 'CDP-AR-A',
              currency: 'CNY',
              originalAmount: '1000',
              remainingAmount: '500',
              dueAt: '2020-01-01T23:59:59.000Z',
            },
          ],
          nextCursor: null,
        },
        collections: {
          items: [
            {
              id: 'cdp-collection-a',
              caseNumber: 'CDP-COL-A',
              state: 'OPEN',
              customerName: 'CDP客户甲',
              currency: 'CNY',
              remainingAmount: '500',
              overdueDays: 10,
              documentNumber: 'CDP-AR-A',
              promises: [],
              legalHandoffs: [],
            },
          ],
          nextCursor: null,
        },
        bankPayments: {
          items: [
            {
              id: 'cdp-payment-a',
              bankReference: 'CDP-BANK-A',
              currency: 'CNY',
              amount: '500',
              remainingAmount: '500',
              receivedAt: '2026-10-16T12:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
        reconciliationRuns: {
          items: [{ id: 'cdp-reconcile-a', resultHash: 'CDP-RECON-A-HASH' }],
          nextCursor: null,
        },
        commissionPolicies: {
          items: [
            {
              id: 'cdp-commission-policy-a',
              code: 'CDP-COM-POLICY-A',
              version: 1,
              status: 'PUBLISHED',
              baseRateBasisPoints: 100,
              minimumMarginBasisPoints: 2500,
              releaseCollectionBasisPoints: 10000,
            },
          ],
          nextCursor: null,
        },
        commissions: {
          items: [
            {
              id: 'cdp-commission-a',
              orderNumber: 'CDP-SO-A',
              accountingPeriod: '2026-10',
              effectiveState: 'RELEASED',
              currency: 'CNY',
              commissionAmount: '100',
              eligibleRevenue: '10000',
              marginBasisPoints: 3000,
              collectionBasisPoints: 10000,
              beneficiaryName: 'CDP合成受益人',
              policyCode: 'CDP-COM-POLICY-A',
              policyVersion: 1,
              ledger: [
                {
                  sequence: 1,
                  state: 'ACCRUED',
                  reason: 'CDP计提证据',
                  externalReference: 'CDP-REF-A',
                },
              ],
            },
          ],
          nextCursor: null,
        },
        riskPolicies: {
          items: [
            {
              id: 'cdp-risk-policy-a',
              code: 'CDP-RISK-POLICY-A',
              version: 1,
              status: 'PUBLISHED',
              minimumMarginBasisPoints: 2500,
              overdueGraceDays: 0,
              creditWarningDays: 30,
            },
          ],
          nextCursor: null,
        },
        riskEvaluations: {
          items: [
            {
              id: 'cdp-risk-a',
              orderNumber: 'CDP-SO-A',
              severity: 'HIGH',
              score: 55,
              task: { id: 'cdp-risk-task-a', effective_state: 'OPEN' },
              findings: [{ code: 'LOW_MARGIN', actual: '10', threshold: '25' }],
              taskEvents: [{ sequence: 1, state: 'OPEN', reason: 'CDP风险证据' }],
            },
          ],
          nextCursor: null,
        },
        salesOrders: {
          items: [
            {
              id: 'cdp-order-a',
              orderNumber: 'CDP-SO-A',
              status: 'RELEASED',
              currency: 'CNY',
              total: '25000',
            },
          ],
          nextCursor: null,
        },
        orderEvidence: {
          order: {
            id: 'cdp-order-a',
            orderNumber: 'CDP-SO-A',
            status: 'RELEASED',
            currency: 'CNY',
            total: '25000',
          },
          quote: {},
          credit: {},
          contract: {},
          receivables: [],
          payments: [],
          commissions: [],
          risks: [],
          collections: [],
          anomalies: [],
          timeline: [
            {
              occurredAt: '2026-10-16T08:00:00.000Z',
              type: 'ORDER_RELEASED',
              label: 'CDP合成订单证据',
            },
          ],
        },
        productionOrders: {
          items: [
            {
              id: 'cdp-production-a',
              orderNumber: 'CDP-PROD-A',
              state: 'DRAFT',
              sku: 'CDP-SKU-A',
              plannedQuantity: '100',
              plannedStartAt: '2026-10-16',
              plannedDueAt: '2026-10-20',
              operations: [],
              materials: [],
              reports: [],
              rolls: [],
              events: [],
            },
          ],
          nextCursor: null,
        },
        productionCostPolicies: { items: [], nextCursor: null },
        productionCostRuns: {
          items: [
            {
              id: 'cdp-cost-run-a',
              run_number: 'CDP-COST-A',
              state: 'APPROVED',
              orderNumber: 'CDP-PROD-A',
              currency: 'CNY',
              planned_total: '100',
              actual_total: '105',
              variance_total: '5',
            },
          ],
          nextCursor: null,
        },
        shipmentReleases: {
          items: [
            {
              id: 'cdp-release-a',
              request_number: 'CDP-SHIP-A',
              state: 'READY',
              orderNumber: 'CDP-SO-A',
              productionOrderNumber: 'CDP-PROD-A',
              lotNumber: 'CDP-LOT-A',
              requested_quantity: '100',
              gate_snapshot: { failures: [] },
              shipments: [],
            },
          ],
          nextCursor: null,
        },
        creditLimits: { items: [], nextCursor: null },
        creditDecisions: {
          items: [
            {
              id: 'cdp-credit-a',
              effectiveStatus: 'APPROVED',
              currency: 'CNY',
              requestedAmount: '25000',
              exposureAmount: '5000',
              creditLimit: '50000',
              quoteRevisionId: 'cdp-quote-version-a',
              exposureSnapshotId: 'cdp-exposure-a',
            },
          ],
          nextCursor: null,
        },
        contracts: {
          items: [
            {
              id: 'cdp-contract-a',
              contractNumber: 'CDP-C-A',
              revision: 1,
              effectiveStatus: 'DRAFT',
              content: { paymentTerms: 'CDP合成预付款条款', deliveryTerms: 'CDP合成交付条款' },
              contentHash: 'cdp-contract-hash',
            },
          ],
          nextCursor: null,
        },
        cost: {
          items: pricingViews
            ? [
                {
                  id: 'cdp-matrix-a',
                  code: 'CDP-CM-A',
                  name: 'CDP规格模型甲',
                  productSku: 'CDP-SKU-A',
                  factorCount: 2,
                  missingPriceCount: 0,
                  missingSourceCount: 0,
                  needsRecalculation: false,
                  latestCalculation: {},
                },
              ]
            : [],
          total: pricingViews ? 1 : 0,
          page: 1,
          pageSize: 20,
        },
        quotes: {
          items: pricingViews
            ? [
                {
                  id: 'cdp-quote-version-a',
                  quoteId: 'cdp-quote-a',
                  quoteNumber: 'CDP-Q-A',
                  revision: 1,
                  status: 'DRAFT',
                  currency: 'CNY',
                  total: '25000',
                  discount: '0',
                  costTotal: '20000',
                  margin: '5000',
                  marginBasisPoints: 2000,
                  lines: [
                    {
                      description: 'CDP草坪甲',
                      quantity: '100',
                      unit_code: 'M2',
                      unit_price: '250',
                      total: '25000',
                    },
                  ],
                },
              ]
            : [],
          nextCursor: null,
        },
        policies: {
          items: [
            {
              id: 'cdp-policy-version-a',
              definitionId: 'cdp-policy-a',
              code: 'CDP-SP-A',
              name: 'CDP销售政策甲',
              version: 1,
              status: 'PUBLISHED',
              rules: [],
            },
          ],
          nextCursor: null,
        },
        policyEvaluations: { items: [], nextCursor: null },
        organizations: [],
        opportunities: {
          items: [
            {
              id: 'cdp-opportunity-a',
              name: 'CDP商机甲',
              customerId: 'cdp-customer-a',
              status: 'OPEN',
              value: { currency: 'CNY', amount: '25000' },
              probabilityBasisPoints: 3000,
              expectedCloseDate: '2099-12-31',
              version: 1,
            },
          ],
          nextCursor: null,
        },
        ctrs: {
          items: [
            {
              id: 'cdp-ctr-version-a',
              ctrId: 'cdp-ctr-a',
              code: 'CDP-CTR-A',
              title: 'CDP技术需求甲',
              opportunityId: 'cdp-opportunity-a',
              status: 'APPROVED',
              version: 1,
              requirements: { application: '足球场', pileHeightMm: 50 },
              attachments: [],
            },
          ],
          nextCursor: null,
        },
        solutions: {
          items: [
            {
              id: 'cdp-solution-version-a',
              technicalSolutionId: 'cdp-solution-a',
              code: 'CDP-TS-A',
              ctrVersionId: 'cdp-ctr-version-a',
              revision: 1,
              status: 'FINAL',
              specification: { productFamily: 'CDP足球草', pileHeightMm: 50, dtex: 12000 },
              assumptions: ['CDP合成基础条件'],
            },
          ],
          nextCursor: null,
        },
        detail: {
          customer: customers[0],
          contacts: [],
          ownership: [],
          activities: [],
          leads: [],
          opportunities: [],
        },
      }[key];
      const response =
        hold && key === 'solutions'
          ? { ...value, items: value.items.map((item) => ({ ...item, code: 'CDP-TS-OLD-LAZY' })) }
          : value;
      return { completion: hold ? key : null, status: 200, value: response };
    },
  };
}

export const syntheticSessionInit = `if(location.origin==='http://127.0.0.1:4173')sessionStorage.setItem('kingturf.session','cdp-isolated-synthetic-session');`;
