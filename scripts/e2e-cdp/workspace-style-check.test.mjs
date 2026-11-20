import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_STYLE_ROUTES,
  assertWorkspaceStyleEvidence,
  consoleStyleEvidenceExpression,
  consoleSurfaceReadyExpression,
  styleGuardEnvironment,
} from './workspace-style-check.mjs';

const healthyEvidence = (overrides = {}) => ({
  hash: '#/governance/identity',
  consolePage: true,
  sheetCount: 3,
  consoleSheet: {
    href: 'http://127.0.0.1:4173/assets/bootstrap-test.css',
    rule: '.console-page, .console-page .console-toolbar',
  },
  bodyFontFamily: 'Inter, "Noto Sans SC", system-ui, sans-serif',
  headerSample: '登录名',
  headerFontFamily: 'Inter, "Noto Sans SC", system-ui, sans-serif',
  ...overrides,
});

test('workspace style routes pin the three governance surfaces', () => {
  assert.deepEqual(WORKSPACE_STYLE_ROUTES, [
    'governance/identity',
    'governance/organization',
    'governance/audit',
  ]);
});

test('healthy browser evidence passes on every governance route', () => {
  for (const route of WORKSPACE_STYLE_ROUTES)
    assert.doesNotThrow(() => assertWorkspaceStyleEvidence(route, healthyEvidence()));
});

test('a stylesheet without .console-page rules fails every route', () => {
  for (const route of WORKSPACE_STYLE_ROUTES)
    assert.throws(
      () => assertWorkspaceStyleEvidence(route, healthyEvidence({ consoleSheet: null })),
      /\.console-page/u,
    );
});

test('an unrendered console surface fails before style assertions', () => {
  assert.throws(
    () => assertWorkspaceStyleEvidence('governance/audit', healthyEvidence({ consolePage: false })),
    /console surface did not render/u,
  );
});

test('body font family outside Inter/Noto fails', () => {
  for (const fontFamily of ['Times New Roman, serif', 'serif', 'Arial, sans-serif'])
    assert.throws(
      () =>
        assertWorkspaceStyleEvidence(
          'governance/identity',
          healthyEvidence({ bodyFontFamily: fontFamily }),
        ),
      /body font family must lead with Inter\/Noto/u,
    );
});

test('a serif-default data table header fails', () => {
  assert.throws(
    () =>
      assertWorkspaceStyleEvidence(
        'governance/organization',
        healthyEvidence({ headerFontFamily: 'Times New Roman, serif' }),
      ),
    /serif default/u,
  );
  assert.throws(
    () =>
      assertWorkspaceStyleEvidence(
        'governance/organization',
        healthyEvidence({ headerFontFamily: null }),
      ),
    /no computed font-family/u,
  );
});

test('probe expressions pin the real-browser evidence contract', () => {
  const evidence = consoleStyleEvidenceExpression();
  assert.match(evidence, /document\.styleSheets/u);
  assert.match(evidence, /\.console-page/u);
  assert.match(evidence, /getComputedStyle\(document\.body\)\.fontFamily/u);
  assert.match(evidence, /\.data-table thead th/u);
  assert.match(evidence, /sheet\.cssRules/u);
  const ready = consoleSurfaceReadyExpression();
  assert.match(ready, /\.console-page/u);
  assert.match(ready, /\.data-table thead th/u);
  assert.match(ready, /getClientRects\(\)\.length>0/u);
});

test('environment gate requires explicit acceptance, loopback origin and a synthetic identity', () => {
  const accepted = { KINGTURF_STYLE_GUARD_ACCEPTANCE: '1' };
  assert.throws(() => styleGuardEnvironment({}), /KINGTURF_STYLE_GUARD_ACCEPTANCE=1/u);
  assert.throws(() => styleGuardEnvironment(accepted), /Synthetic local identity/u);
  assert.throws(
    () =>
      styleGuardEnvironment({
        ...accepted,
        KINGTURF_STYLE_GUARD_LOGIN: 'w1.styleguard',
        KINGTURF_STYLE_GUARD_PASSWORD: 'local-only',
        KINGTURF_STYLE_GUARD_ORIGIN: 'https://erp.kingturf.cn',
      }),
    /loopback HTTP web origin/u,
  );
  const config = styleGuardEnvironment({
    ...accepted,
    KINGTURF_STYLE_GUARD_LOGIN: 'w1.styleguard',
    KINGTURF_STYLE_GUARD_PASSWORD: 'local-only',
  });
  assert.equal(config.origin, 'http://127.0.0.1:4173');
  assert.equal(config.login, 'w1.styleguard');
  assert.equal(Object.isFrozen(config), true);
});
