import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const appUrl = new URL('../../apps/api/src/app.ts', import.meta.url);
const requireAtApp = createRequire(appUrl);
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
export const baseline = 'c7833e7';
export const regressionStart = '7251b08';
const read = (name, capability, view, operational = false) => ({
  name,
  method: 'GET',
  path: '/api/v1/' + name,
  capability,
  view,
  operation: operational ? 'listOperationalPage' : 'list',
  operational,
  argc: operational ? 3 : 2,
});
const post = (name, capability, operation, body, argc = 4) => ({
  name,
  method: 'POST',
  path: '/api/v1/' + name,
  capability,
  operation,
  body,
  argc,
});
const specs = [
  read('credit-limits', 'credit:read', 'limits'),
  read('credit-decisions', 'credit:read', 'credit'),
  read('contracts', 'contract:read', 'contracts'),
  read('sales-orders', 'sales-order:read', 'orders'),
  read('reconciliation-runs', 'reconciliation:read', 'reconciliation'),
  read('ar-open-items', 'ar:read', 'ar', true),
  read('bank-payments', 'bank-payment:read', 'payments', true),
  post('credit-limits', 'credit:approve', 'setCreditLimit', {
    customerId: id,
    currency: 'USD',
    amount: '1',
    effectiveAt: '2026-01-01',
    expiresAt: '2027-01-01',
  }),
  post('credit-decisions', 'credit:evaluate', 'evaluateCredit', {
    customerId: id,
    quoteRevisionId: id,
    quoteSnapshotId: id,
    creditLimitId: id,
    validUntil: '2027-01-01',
  }),
  post(
    'credit-decisions/' + id + '/approve',
    'credit:approve',
    'approveCredit',
    {
      decision: 'APPROVED',
      reason: 'fixture',
    },
    6,
  ),
  post('contracts', 'contract:revise', 'createContract', {
    customerId: id,
    opportunityId: id,
    contractNumber: 'fixture',
    quoteRevisionId: id,
    quoteSnapshotId: id,
    content: { nested: true },
  }),
  post(
    'contracts/' + id + '/sign',
    'contract:sign',
    'signContract',
    {
      provider: 'fixture',
      providerReceiptId: 'receipt',
      payload: { nested: true },
      signedAt: '2026-01-01',
    },
    5,
  ),
];
const modesFor = (spec) => [
  'plain',
  'guard_throw',
  'root_throw',
  'method_swap',
  'actor_swap',
  'deny',
  ...(spec.method === 'GET'
    ? [
        'auth_swap',
        'scopes_swap',
        'anchors_swap',
        'fields_swap',
        'late_fields_swap',
        'deny_root_throw',
      ]
    : [
        'allow_swap',
        'unknown',
        'unknown_root_throw',
        'input_swap',
        'input_invalid',
        'input_invalid_root_throw',
      ]),
  ...(spec.operational
    ? [
        'state_swap',
        'min_swap',
        'max_swap',
        'filter_swap',
        'invalid_state_root_throw',
        'invalid_min_root_throw',
        'invalid_max_root_throw',
        'invalid_compare_root_throw',
        'invalid_filter',
      ]
    : []),
  ...(spec.operation === 'approveCredit'
    ? ['decision_swap', 'decision_invalid_root_throw', 'raw_id_invalid']
    : []),
  ...(spec.operation === 'signContract' ? ['raw_id_invalid'] : []),
];
export const cases = specs.flatMap((spec) => modesFor(spec).map((mode) => ({ spec, mode })));
export async function loadOldBuildApp() {
  const source = execFileSync('git', ['show', baseline + ':apps/api/src/app.ts'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  let js = stripTypeScriptTypes(source, { mode: 'transform', sourceUrl: appUrl.href });
  js = js.replace(/from\s+(['"])([^'"]+)\1/g, (_all, _quote, specifier) => {
    const resolved = specifier.startsWith('node:')
      ? specifier
      : specifier.startsWith('.')
        ? new URL(specifier, appUrl).href
        : pathToFileURL(requireAtApp.resolve(specifier)).href;
    return 'from ' + JSON.stringify(resolved);
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64')))
    .buildApp;
}
export async function runCase(buildApp, { spec, mode }) {
  const events = [],
    calls = [];
  const actor = { companyId: 'root-capture-direct-mock', employeeId: id };
  const scopes = ['COMPANY'],
    anchors = [];
  const nested = { directMock: true },
    output = { id, nested, status: 'FIXTURE' };
  const first = {},
    second = {};
  let selected = first,
    roots = 0,
    fields = 0,
    permissionReads = 0;
  const swap = () => {
    selected = second;
  };
  for (const [label, repo] of [
    ['first', first],
    ['second', second],
  ]) {
    Object.defineProperty(repo, spec.operation, {
      get() {
        events.push('method:' + label);
        if (mode === 'method_swap') swap();
        return async function (...args) {
          events.push('call:' + label);
          const scope = args[spec.method === 'GET' ? args.length - 1 : args.length - 2];
          calls.push({
            callee: label,
            receiver: this === repo ? label : 'wrong',
            argc: args.length,
            expectedArgc: args.length === spec.argc,
            actorRef: scope.actor === actor,
            scopesRef: scope.scopes === scopes,
            anchorsRef: scope.anchors === anchors,
            first: spec.method === 'GET' ? args[0] : Object.keys(args[spec.argc === 5 ? 1 : 0]),
          });
          return spec.method === 'POST'
            ? output
            : spec.operational
              ? { items: [output], nextCursor: null }
              : [output];
        };
      },
    });
  }
  const grant = {};
  Object.defineProperty(grant, 'scopes', {
    get() {
      events.push('scopes');
      if (mode === 'scopes_swap') swap();
      return scopes;
    },
  });
  Object.defineProperty(grant, 'fields', {
    get() {
      events.push('fields');
      fields++;
      if (mode === 'fields_swap' || (mode === 'late_fields_swap' && fields > 1)) swap();
      return null;
    },
  });
  const permissions = new Map([[spec.capability, grant]]);
  for (const cap of ['credit:read', 'contract:read']) permissions.set(cap, grant);
  if (mode === 'deny' || mode === 'deny_root_throw') permissions.delete(spec.capability);
  const nativeGet = permissions.get.bind(permissions);
  permissions.get = (cap) => {
    events.push('permission:' + cap);
    permissionReads++;
    if (mode === 'auth_swap' && permissionReads === 1) swap();
    return nativeGet(cap);
  };
  const scopeAnchors = new Map();
  scopeAnchors.get = () => {
    events.push('anchors');
    if (mode === 'anchors_swap') swap();
    return anchors;
  };
  const context = { permissions, scopeAnchors };
  Object.defineProperty(context, 'actor', {
    get() {
      events.push('actor');
      if (mode === 'actor_swap') swap();
      return actor;
    },
  });
  const dependencies = {
    organizations: {},
    employees: {},
    auth: {
      authenticate: async () => {
        events.push('auth');
        return context;
      },
    },
  };
  Object.defineProperty(dependencies, 'quoteToCash', {
    get() {
      roots++;
      events.push('root:' + String(roots));
      if (mode === 'guard_throw' || (roots === 2 && mode.includes('root_throw')))
        throw new Error('fixture root getter');
      return selected;
    },
  });
  const body = { ...spec.body };
  const field =
    spec.operation === 'approveCredit'
      ? 'reason'
      : spec.operation === 'signContract'
        ? 'provider'
        : 'customerId';
  if (mode === 'input_swap' || mode.startsWith('input_invalid')) {
    const value = body[field];
    Object.defineProperty(body, field, {
      enumerable: true,
      get() {
        events.push('input:' + field);
        if (mode === 'input_swap') swap();
        return mode === 'input_swap' ? value : '';
      },
    });
  }
  if (mode === 'decision_swap' || mode === 'decision_invalid_root_throw')
    Object.defineProperty(body, 'decision', {
      enumerable: true,
      get() {
        events.push('decision');
        swap();
        return mode === 'decision_swap' ? 'APPROVED' : 'OTHER';
      },
    });
  if (mode.startsWith('unknown')) body.unknown = true;
  const bodyProxy = new Proxy(body, {
    ownKeys(target) {
      events.push('bodykeys');
      if (mode === 'allow_swap') swap();
      return Reflect.ownKeys(target);
    },
  });
  const query = { state: 'OPEN', minAmount: '1', maxAmount: '2', limit: '10' };
  const queryField = {
    state_swap: 'state',
    min_swap: 'minAmount',
    max_swap: 'maxAmount',
    filter_swap: 'limit',
  }[mode];
  if (queryField) {
    const value = query[queryField];
    Object.defineProperty(query, queryField, {
      get() {
        events.push('query:' + queryField);
        swap();
        return value;
      },
    });
  }
  if (mode === 'invalid_state_root_throw') query.state = 'INVALID';
  if (mode === 'invalid_min_root_throw') query.minAmount = 'invalid';
  if (mode === 'invalid_max_root_throw') query.maxAmount = 'invalid';
  if (mode === 'invalid_compare_root_throw') {
    query.minAmount = '2';
    query.maxAmount = '1';
  }
  if (mode === 'invalid_filter') query.limit = '0';
  const headers = { authorization: 'Bearer fixture', 'x-correlation-id': correlationId };
  Object.defineProperty(headers, 'idempotency-key', {
    enumerable: true,
    get() {
      events.push('header');
      return 'fixture';
    },
  });
  const pathname = mode === 'raw_id_invalid' ? spec.path.replace(id, 'abc') : spec.path;
  const result = await buildApp(dependencies).dispatch({
    method: spec.method,
    pathname,
    headers,
    body: bodyProxy,
    query,
  });
  return {
    name: spec.method + ' ' + spec.name + ' / ' + mode,
    status: result.statusCode,
    body: result.body,
    roots,
    calls,
    events,
    outputRef:
      spec.method === 'POST'
        ? result.body === output
        : result.statusCode === 200
          ? result.body.items[0] === output
          : false,
  };
}
async function main() {
  const target = process.argv[2];
  if (!['old', 'current'].includes(target)) throw new Error('Usage: old | current');
  const build = target === 'old' ? await loadOldBuildApp() : (await import(appUrl.href)).buildApp;
  const reports = [];
  for (const scenario of cases) reports.push(await runCase(build, scenario));
  process.stdout.write(JSON.stringify({ baseline, regressionStart, reports }));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
