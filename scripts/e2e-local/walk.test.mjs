import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { pickTriggers } from './walk-audit.mjs';
import { evaluateReport } from './walk-verdict.mjs';

const fixture = () => ({
  tabs: 4,
  firstPaint: { errors: [], net: [], notice: [] },
  routes: [
    {
      route: 'payments',
      reached: true,
      errors: [],
      net: [],
      audit: { roots: 1, issues: [] },
      triggerPlan: [{ key: 'kt-payment-open', kind: 'drawer' }],
      filters: [],
      drawers: [
        {
          key: 'kt-payment-open',
          tag: 'payments--payment',
          geo: {
            position: 'fixed',
            top: 0,
            rightGap: 0,
            width: 480,
            height: 900,
            viewportWidth: 1440,
            viewportHeight: 900,
          },
          overlay: true,
          modal: true,
          focusInitial: true,
          tabs: [true, true, true, true],
          wrapForward: true,
          wrapBackward: true,
          closed: true,
          focusRestoredMs: 12,
          roots: 1,
          issues: [],
        },
      ],
    },
  ],
});

const withFilter = () => {
  const report = fixture();
  const row = report.routes[0];
  row.triggerPlan.push({ key: 'kt-payment-filter-open', kind: 'status-filter' });
  row.filters.push({
    key: 'kt-payment-filter-open',
    tag: 'payments--payment-filter',
    kind: 'status-filter',
    selected: true,
    restored: true,
    listReady: true,
    issues: [],
    response: { method: 'GET', state: 'OPEN', status: 200 },
    resetResponse: { method: 'GET', state: '', status: 200 },
  });
  return report;
};

test('all original drawer criteria and status-filter evidence pass', () => {
  const result = evaluateReport(withFilter());
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.summary, {
    requested: 1,
    reached: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    drawers: 1,
    drawerErrors: 0,
    filters: 1,
    filterErrors: 0,
  });
});

for (const [name, mutate] of [
  [
    'recorded drawer.error',
    (d) => {
      d.error = 'TimeoutError: missing drawer';
    },
  ],
  [
    'wrong overlay geometry',
    (d) => {
      d.geo.position = 'absolute';
    },
  ],
  [
    'drawer displaced from top',
    (d) => {
      d.geo.top = 8;
    },
  ],
  [
    'drawer displaced from right',
    (d) => {
      d.geo.rightGap = 8;
    },
  ],
  [
    'drawer wider than viewport',
    (d) => {
      d.geo.width = 1600;
    },
  ],
  [
    'drawer height mismatch',
    (d) => {
      d.geo.height = 800;
    },
  ],
  [
    'overlay absent',
    (d) => {
      d.overlay = false;
    },
  ],
  [
    'modal semantics absent',
    (d) => {
      d.modal = false;
    },
  ],
  [
    'initial focus outside',
    (d) => {
      d.focusInitial = false;
    },
  ],
  [
    'Tab escaped',
    (d) => {
      d.tabs[2] = false;
    },
  ],
  [
    'missing Tab observations',
    (d) => {
      d.tabs = [];
    },
  ],
  [
    'forward boundary escaped',
    (d) => {
      d.wrapForward = false;
    },
  ],
  [
    'backward boundary escaped',
    (d) => {
      d.wrapBackward = false;
    },
  ],
  [
    'Escape did not close',
    (d) => {
      d.closed = false;
    },
  ],
  [
    'focus not restored',
    (d) => {
      d.focusRestoredMs = null;
    },
  ],
  [
    'focus result missing',
    (d) => {
      delete d.focusRestoredMs;
    },
  ],
  [
    'drawer layout issue',
    (d) => {
      d.issues = [{ kind: 'drawer-table-clipped' }];
    },
  ],
  [
    'drawer audit root missing',
    (d) => {
      d.roots = 0;
    },
  ],
]) {
  test(`route fails for ${name} even when navigation reached it`, () => {
    const report = fixture();
    mutate(report.routes[0].drawers[0]);
    const result = evaluateReport(report);
    assert.equal(result.exitCode, 1);
    assert.equal(result.routes[0].ok, false);
    assert.equal(result.summary.reached, 1);
    assert.equal(result.summary.failed, 1);
  });
}

for (const [name, mutate] of [
  [
    'page layout',
    (r) => {
      r.audit.issues.push({ kind: 'page-h-scroll' });
    },
  ],
  [
    'page error',
    (r) => {
      r.errors.push('pageerror: failed');
    },
  ],
  [
    'HTTP failure',
    (r) => {
      r.net.push('GET /api/v1/test 500');
    },
  ],
  [
    'not reached',
    (r) => {
      r.reached = false;
    },
  ],
  [
    'skipped route',
    (r) => {
      r.skipped = 'not-in-nav';
    },
  ],
  [
    'unperformed trigger',
    (r) => {
      r.drawers = [];
    },
  ],
  [
    'duplicate result',
    (r) => {
      r.drawers.push(r.drawers[0]);
    },
  ],
  [
    'unexpected result',
    (r) => {
      r.drawers[0].key = 'another-open';
    },
  ],
  [
    'missing results',
    (r) => {
      delete r.filters;
    },
  ],
])
  test(`route rejects ${name}`, () => {
    const report = fixture();
    mutate(report.routes[0]);
    assert.equal(evaluateReport(report).exitCode, 1);
  });

for (const field of ['selected', 'restored', 'listReady'])
  test(`filter ${field}=false fails route`, () => {
    const report = withFilter();
    report.routes[0].filters[0][field] = false;
    assert.equal(evaluateReport(report).routes[0].ok, false);
  });
for (const [name, mutate] of [
  [
    'probe error',
    (f) => {
      f.error = 'filter did not change';
    },
  ],
  [
    'non-GET',
    (f) => {
      f.response.method = 'POST';
    },
  ],
  [
    'HTTP error',
    (f) => {
      f.response.status = 500;
    },
  ],
  [
    'wrong state',
    (f) => {
      f.response.state = '';
    },
  ],
  [
    'restore failed',
    (f) => {
      f.resetResponse.state = 'OPEN';
    },
  ],
  [
    'missing response',
    (f) => {
      delete f.response;
    },
  ],
  [
    'layout issue',
    (f) => {
      f.issues.push({ kind: 'clipped-text' });
    },
  ],
])
  test(`filter rejects ${name}`, () => {
    const report = withFilter();
    mutate(report.routes[0].filters[0]);
    assert.equal(evaluateReport(report).exitCode, 1);
  });

test('first-paint errors fail even if every route passes', () => {
  for (const field of ['errors', 'net', 'notice']) {
    const report = fixture();
    report.firstPaint[field].push('failure');
    assert.equal(evaluateReport(report).exitCode, 1);
  }
});

test('real report CLI exits 1 for a reached route with an erroneous drawer; clean report exits 0', () => {
  const directory = mkdtempSync(join(tmpdir(), 'walk-gate-test-'));
  try {
    const file = join(directory, 'report.json');
    for (const bad of [false, true]) {
      const report = fixture();
      if (bad) report.routes[0].drawers[0].error = 'TimeoutError: no matching drawer';
      writeFileSync(file, JSON.stringify(report));
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./walk-verdict.mjs', import.meta.url)), file],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, bad ? 1 : 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).routes[0].ok, !bad);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('OPEN state chips remain covered as filters and real 查看 keeps stable row identity', () => {
  const saved = globalThis.document;
  const buttons = [];
  const group = { querySelectorAll: () => buttons };
  const make = (id, label, pressed, rowId) => ({
    tagName: 'BUTTON',
    textContent: label,
    getBoundingClientRect: () => ({ width: 100, height: 20 }),
    getAttribute: (key) => (key === 'data-testid' ? id : key === 'aria-pressed' ? pressed : null),
    hasAttribute: (key) => key === 'aria-pressed' && pressed !== null,
    closest: (key) =>
      key === '.fin-filters' ? group : rowId ? { getAttribute: () => rowId } : null,
  });
  buttons.push(
    make('kt-payment-filter-all', '全部', 'true', null),
    make('kt-payment-filter-open', '待核销', 'false', null),
    make('kt-payment-open', '查看', null, 'stable-payment-id'),
  );
  const root = {
    getBoundingClientRect: () => ({ width: 100, height: 100 }),
    querySelectorAll: () => buttons,
    contains: () => false,
  };
  globalThis.document = { querySelectorAll: () => [root] };
  try {
    const plan = pickTriggers('payments');
    assert.equal(plan.length, 2);
    assert.equal(plan[0].kind, 'status-filter');
    assert.equal(plan[0].reset.testId, 'kt-payment-filter-all');
    assert.equal(plan[1].kind, 'drawer');
    assert.equal(plan[1].rowId, 'stable-payment-id');
  } finally {
    globalThis.document = saved;
  }
});
