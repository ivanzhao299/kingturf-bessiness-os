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
export function createStubRouter() {
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
        session,
        customers: { items: customers },
        cost: { items: [], total: 0, page: 1, pageSize: 20 },
        quotes: { items: [], nextCursor: null },
        organizations: [],
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
