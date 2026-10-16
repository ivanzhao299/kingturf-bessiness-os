// Synthetic, local-only CDP data. Never log these records or mix with real API traffic.
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
} = {}) {
  const holds = new Map();
  const completions = new Map();
  const counts = new Map();
  let customerError = false;
  const keyFor = (pathname) =>
    new Map([
      ['/api/v1/auth/session', 'session'],
      ['/api/v1/customers', 'customers'],
      ['/api/v1/cost-matrix-summaries', 'cost'],
      ['/api/v1/quotes', 'quotes'],
      ['/api/v1/organizations', 'organizations'],
      ['/api/v1/customers/cdp-customer-a/360', 'detail'],
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
      if (!['cost', 'detail'].includes(key) || holds.has(key))
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
    counts() {
      return Object.fromEntries(counts);
    },
    async respond(pathname, method, parameters = new URLSearchParams()) {
      const key = keyFor(pathname);
      if (method !== 'GET' || !key) throw new Error('unmapped synthetic API request');
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const candidate = holds.get(key);
      const hold =
        candidate && (key !== 'cost' || parameters.get('q') === candidate.query)
          ? candidate
          : undefined;
      if (hold) {
        hold.requested();
        await hold.gate;
      }
      if (key === 'detail' && customerError)
        return {
          completion: hold ? key : null,
          status: 503,
          value: { error: { message: 'CDP合成服务暂不可用，请重试' } },
        };
      const value = {
        session:
          salesViews || pricingViews || creditContractViews
            ? {
                ...session,
                permissions: [
                  ...session.permissions,
                  ...(salesViews
                    ? ['opportunity:read', 'ctr:read', 'technical-solution:read']
                    : []),
                  ...(pricingViews ? ['sales-policy:read'] : []),
                  ...(creditContractViews ? ['credit:read', 'contract:read'] : []),
                ],
              }
            : session,
        customers: { items: customers },
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
      return { completion: hold ? key : null, status: 200, value };
    },
  };
}

export const syntheticSessionInit = `if(location.origin==='http://127.0.0.1:4173')sessionStorage.setItem('kingturf.session','cdp-isolated-synthetic-session');`;
