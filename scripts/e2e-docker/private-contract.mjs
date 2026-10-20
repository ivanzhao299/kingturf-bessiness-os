import assert from 'node:assert/strict';

export const p1DomPhases = Object.freeze([
  'none',
  'overview-board-hidden',
  'overview-board-unmounted',
  'login-ui',
  'workspace-other',
  'unclassified',
  'unavailable',
]);

export const localCases = Object.freeze({
  document: [
    'draft sends give immediate, actionable feedback without requests; approval updates in place',
    'missing customer is explained, with mobile feedback fitting the viewport',
    'connector read failure can retry and cancelling a pending read never reopens a dialog',
    'queue submission retains idempotency on retry, blocks double submit and never claims delivery',
    'send controls remain hidden without sending permission',
    'admin goes directly to configuration, saves without reloading, and returns with unsaved document intact',
    'approved document navigates to settings from unconfigured feedback and settings read errors can retry on mobile',
  ],
  login: [
    'shows deterministic progress, prevents repeated login and enters the workspace',
    'keeps one actionable error and safely resets the password after rejection',
  ],
  order: ['opens order evidence on demand with keyboard, retry and full-width mobile detail'],
  workspace: [
    'CRM filtering preserves complete role navigation, workspace identity and route handlers',
    'late cost results never appear on the quote page, even for a single paint',
    'late customer detail response cannot replace the cost page or shrink its navigation',
    'customer detail failures remain actionable without losing the role menu',
  ],
  revocation: [
    'a running workspace handles 401 without confusing expiry and permission denial',
    'a running workspace handles 403 without confusing expiry and permission denial',
  ],
  startup: [
    'cold login does not download business JS or CSS, including on a slow connection',
    'shows download progress and waits for business assets only after validating the session',
    'a failed business js retains the session and can recover through explicit page refresh',
    'a failed business css retains the session and can recover through explicit page refresh',
    'a transient session failure is retryable, while only an explicit 401 returns to login',
  ],
  cost: [
    'presents a paginated matrix ledger and a full-width on-demand model workspace',
    'hands an approved matrix cost directly into a preselected sales quote',
  ],
  p1: [
    'shows approved, rejected, and expired credit evidence',
    'shows the released order, partial AR, payment, and reconciliation evidence',
    'keeps the P1 evidence usable on a mobile viewport',
    'shows the permission-bounded Order 360 summary and evidence timeline',
    'shows commission economics and the immutable control ledger',
    'shows explainable risk findings and the closed responsibility trail',
    'shows server-calculated executive KPIs with source and responsibility drilldowns',
    'shows published manufacturing versions, BOM substitute evidence, and ordered operations',
    'shows supplier qualification, received purchase order, receipt, and derived lot balance',
    'shows recursive MRP explanations, frozen overrides, and released proposal ledgers',
    'shows closed production execution with routing, material, reports, and serialized output',
  ],
  runtime: [
    'real browser proxy login creates a customer with persistence, audit and denied access',
  ],
});

export function privateSpecFile(kind) {
  assert(Object.hasOwn(localCases, kind), 'only inventoried local browser targets allowed');
  return {
    document: 'document-send-product-quality.spec.ts',
    login: 'login-product-quality.spec.ts',
    order: 'order-evidence-product-quality.spec.ts',
    workspace: 'workspace-route-isolation.spec.ts',
    revocation: 'session-revocation.spec.ts',
    startup: 'startup-delivery.spec.ts',
    p1: 'p1-demo.spec.ts',
    cost: 'cost-matrix-product-quality.spec.ts',
    runtime: 'runtime-local.spec.mjs',
  }[kind];
}

export function validateLocalCommand(kind, label, fault) {
  assert(Object.hasOwn(localCases, kind), 'only inventoried local browser targets allowed');
  assert.match(label, /^[a-z0-9][a-z0-9-]{0,63}$/u);
  assert(
    [undefined, 'privacy', 'interrupt', 'interrupt-stop', 'diagnostics'].includes(fault),
    'unknown local fault',
  );
  if (fault === 'diagnostics') assert.equal(kind, 'p1', 'diagnostics is only authorized for P1');
}

export function safeLocalCases(kind, values) {
  assert(Object.hasOwn(localCases, kind));
  assert(Array.isArray(values));
  const indices = new Set();
  return values.map((value) => {
    assert(Number.isInteger(value.index) && value.index >= 0);
    assert(value.index < localCases[kind].length && !indices.has(value.index));
    indices.add(value.index);
    assert(['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(value.status));
    assert(Number.isInteger(value.durationMs) && value.durationMs >= 0);
    assert(Number.isInteger(value.line) && value.line > 0);
    const failureLine = value.failureLine ?? 0;
    assert(Number.isInteger(failureLine) && failureLine >= 0 && failureLine <= 10_000);
    const phase = value.phase ?? 'none';
    assert(p1DomPhases.includes(phase));
    // Re-encode known scalars; never forward a reporter/test/error/attachment object.
    return {
      index: value.index,
      status: value.status,
      durationMs: value.durationMs,
      line: value.line,
      failureLine,
      phase,
    };
  });
}

export function safeLocalResult(kind, value) {
  assert(Number.isInteger(value.exit) && value.exit >= 0);
  assert(Number.isInteger(value.elapsedMs) && value.elapsedMs >= 0);
  assert(Number.isInteger(value.discovered) && value.discovered >= 0);
  assert.equal(typeof value.complete, 'boolean');
  assert.equal(typeof value.probe, 'boolean');
  const cases = safeLocalCases(kind, value.cases);
  if (value.probe)
    assert(value.exit === 0 && value.discovered === 0 && !value.complete && cases.length === 0);
  else if (value.exit === 0)
    assert(
      value.complete &&
        value.discovered === localCases[kind].length &&
        cases.length === value.discovered &&
        cases.every((item) => item.status === 'passed'),
      'successful browser requires complete inventoried cases',
    );
  return {
    exit: value.exit,
    elapsedMs: value.elapsedMs,
    discovered: value.discovered,
    complete: value.complete,
    probe: value.probe,
    cases,
  };
}
