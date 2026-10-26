import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes, createRequire } from 'node:module';

const appUrl = new URL('../../apps/api/src/app.ts', import.meta.url);
const metadata = JSON.parse(
  readFileSync(
    new URL('../../apps/api/test/fixtures/app-batch4-baseline.json', import.meta.url),
    'utf8',
  ),
);
const frozen = readFileSync(
  new URL('../../apps/api/test/fixtures/app-batch4-f3.ts.fixture', import.meta.url),
);
assert.equal(frozen.length, metadata.bytes);
assert.equal(createHash('sha256').update(frozen).digest('hex'), metadata.sha256);
const original = frozen.toString('utf8');
export async function baselineBuildApp() {
  const require = createRequire(appUrl);
  const js = stripTypeScriptTypes(original, { mode: 'transform', sourceUrl: appUrl.href }).replace(
    /from\s+(['"])([^'"]+)\1/gu,
    (_all, _quote, specifier) =>
      `from ${JSON.stringify(specifier.startsWith('node:') ? specifier : specifier.startsWith('.') ? new URL(specifier, appUrl).href : new URL('file://' + require.resolve(specifier)).href)}`,
  );
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`))
    .buildApp;
}
// Freeze only the differential child process clock; production timing code stays untouched.
const NativeDate = Date;
const fixedNow = NativeDate.parse('2026-10-26T00:00:00Z');
globalThis.Date = class FixedDate extends NativeDate {
  constructor(value) {
    if (arguments.length === 0) super(fixedNow);
    else super(value);
  }
  static now() {
    return fixedNow;
  }
};
const capabilities = ['COMPANY'];
const actor = {
  employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};
const canonical = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      item instanceof Map ? [...item] : typeof item === 'function' ? '[function]' : item,
    ),
  );
const success = {
  id: actor.employeeId,
  version: 1,
  items: [],
  sections: [],
  permissions: [],
  content: {},
  details: {},
  evaluations: [],
  receipts: [],
  status: 'APPROVED',
};
const repos = [
  'manufacturing',
  'procurement',
  'mrp',
  'production',
  'productionCosts',
  'shipments',
  'complaints',
  'collections',
  'quality',
  'dashboard',
  'risks',
  'order360',
  'contractDocuments',
  'quoteToCash',
  'commissions',
  'commercial',
  'crm',
  'organizations',
  'employees',
  'authorization',
  'audit',
  'masterData',
  'numbers',
  'rules',
  'workflows',
  'businessDocuments',
];
const paths = [
  ...new Set([...original.matchAll(/request\.pathname\s*===\s*'([^']+)'/gu)].map((m) => m[1])),
];
export const scenarios = [
  ...['GET', 'POST', 'PUT', 'DELETE'].flatMap((method) =>
    paths.map((path) => ({ name: `${method} ${path}`, method, path, body: {} })),
  ),
  ...['GET', 'POST', 'PUT'].flatMap((method) =>
    [undefined, {}, { zeta: 'unknown' }, null, []].map((body, index) => ({
      name: `unknown ${method} body${index}`,
      method,
      path: '/api/v1/not-an-endpoint',
      body,
    })),
  ),
  ...repos.map((missing) => ({
    name: `missing ${missing}`,
    method: 'GET',
    path: '/api/v1/not-an-endpoint',
    body: {},
    missing,
  })),
  {
    name: 'unrelated invalid POST QTC absent',
    method: 'POST',
    path: '/api/v1/not-an-endpoint',
    body: null,
    missing: 'quoteToCash',
  },
];
async function execute(build, scenario) {
  const trace = [];
  const grant = { scopes: capabilities, fields: null };
  const permissions = new Map();
  permissions.get = (key) => {
    trace.push(['grant', key]);
    return grant;
  };
  permissions.has = () => true;
  const authorization = { actor, permissions, scopeAnchors: new Map() };
  const repositories = new Map();
  for (const name of repos)
    repositories.set(
      name,
      new Proxy(
        {},
        {
          get(_target, method) {
            trace.push(['method', name, String(method)]);
            return (...args) => {
              trace.push(['call', name, String(method), canonical(args)]);
              // Realistic one-hop work at promise settlement must precede dependent projections.
              queueMicrotask(() => trace.push(['settlement-microtask', name, String(method)]));
              if (
                [
                  'list',
                  'listPolicies',
                  'listEvaluations',
                  'listVersions',
                  'listRevisions',
                ].includes(method)
              )
                return Promise.resolve([]);
              if (method === 'unread') return Promise.resolve(0);
              if (method === 'canReadResult') return Promise.resolve(true);
              return Promise.resolve(success);
            };
          },
        },
      ),
    );
  const dependencies = new Proxy(
    {
      auth: {
        authenticate: () => {
          trace.push(['authenticate']);
          return Promise.resolve(authorization);
        },
        logout: () => Promise.resolve(),
      },
      telemetry: {
        count: (...args) => trace.push(['count', args[0], args[1], args[2]]),
        timing: (metric, _duration, labels) => trace.push(['timing', metric, labels]),
      },
      logger: { write: (entry) => trace.push(['log', entry.level, entry.event, entry.statusCode]) },
    },
    {
      get(target, key) {
        if (key in target) return target[key];
        trace.push(['root', String(key)]);
        if (key === scenario.missing) return undefined;
        return repositories.get(key);
      },
    },
  );
  try {
    const response = await build(dependencies).dispatch({
      method: scenario.method,
      pathname: scenario.path,
      body: scenario.body,
      headers: {
        authorization: 'Bearer differential-mock-only',
        'idempotency-key': 'fixed-key',
        'x-correlation-id': actor.employeeId,
      },
    });
    return { name: scenario.name, response: canonical(response), trace };
  } catch (error) {
    return { name: scenario.name, rejection: error.constructor.name, trace };
  }
}
if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) {
  const which = process.argv[2];
  assert(['baseline', 'current'].includes(which));
  const build =
    which === 'baseline' ? await baselineBuildApp() : (await import(appUrl.href)).buildApp;
  const results = [];
  for (const scenario of scenarios) results.push(await execute(build, scenario));
  console.log(JSON.stringify({ baseline: metadata.commit, results }));
}
