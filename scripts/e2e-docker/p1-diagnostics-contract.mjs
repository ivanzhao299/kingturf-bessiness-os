import assert from 'node:assert/strict';

export const diagnosticFields = Object.freeze({
  credit: {
    cards: 'count',
    approvedCards: 'count',
    rejectedCards: 'count',
    expiredCards: 'count',
    approvedExposure0: 'boolean',
    rejectedExposure450000: 'boolean',
    rejectedExposure0: 'boolean',
    expiredExposure450000: 'boolean',
    expiredExposure0: 'boolean',
    limits5000000: 'count',
  },
  production: {
    workbenches: 'count',
    visibleWorkbenches: 'count',
    exactTestIds: 'count',
    visibleTestIds: 'count',
  },
  order360: {
    cardsBeforeOpen: 'count',
    rawReleased: 'count',
    localizedReleased: 'count',
    openButtons: 'count',
    detailsAfterOpen: 'count',
    originalCountPhrase: 'boolean',
    timelineEntries: 'count',
    requiredEventCodes: 'count',
  },
  commission: { originalPolicyPins: 'count', localizedPolicyPins: 'count', amount28500: 'count' },
  risk: {
    rawSeverity45: 'count',
    localizedSeverity45: 'count',
    rawClosed: 'count',
    localizedClosed: 'count',
    rawMarginRule: 'boolean',
    localizedMarginRule: 'boolean',
  },
  dashboard: {
    oldBookedText: 'boolean',
    originalBookedNumber: 'boolean',
    bookedUnitCny: 'boolean',
    originalGrossMargin: 'boolean',
    originalCash: 'boolean',
    originalReceivable: 'boolean',
  },
  manufacturing: { oldPublishedV1: 'count', localizedPublishedV1: 'count', versions: 'count' },
  mrp: {
    proposalCards: 'count',
    frozenCards: 'count',
    releasedLabels: 'count',
    longRangeYarnCards: 'count',
    quantity10000Matches: 'boolean',
    grossDemand10300Matches: 'boolean',
    safetyStock500Matches: 'boolean',
    rounded10000Matches: 'boolean',
    frozenExplanationNotes: 'count',
  },
});

export function safeDiagnostic(id, values) {
  assert.equal(typeof id, 'string', 'fixed diagnostic id must be a string');
  assert(Object.hasOwn(diagnosticFields, id), 'unknown fixed diagnostic');
  assert(values && typeof values === 'object' && !Array.isArray(values));
  const fields = diagnosticFields[id];
  assert.deepEqual(
    Object.keys(values).sort(),
    Object.keys(fields).sort(),
    'diagnostic keys must be exact',
  );
  return Object.fromEntries(
    Object.entries(fields).map(([key, type]) => {
      const value = values[key];
      if (type === 'boolean') assert.equal(typeof value, 'boolean');
      else
        assert(
          Number.isSafeInteger(value) && value >= 0 && value <= 1000,
          'bounded diagnostic count required',
        );
      return [key, value];
    }),
  );
}

export function diagnosticRequestAllowed(address, method) {
  try {
    const url = new URL(address);
    return (
      url.origin === 'http://127.0.0.1:4173' &&
      !url.username &&
      !url.password &&
      (['GET', 'HEAD', 'OPTIONS'].includes(method) ||
        (method === 'POST' && url.pathname === '/api/v1/auth/login' && !url.search))
    );
  } catch {
    return false;
  }
}

export function safeDiagnosticResult(value, observed) {
  assert.equal(value.exit, 0);
  assert.equal(value.complete, true);
  assert.equal(value.browserClosed, true);
  assert(Number.isSafeInteger(value.elapsedMs) && value.elapsedMs >= 0);
  assert.deepEqual([...value.observed].sort(), Object.keys(diagnosticFields).sort());
  assert.deepEqual(
    [...observed].sort(),
    Object.keys(diagnosticFields).sort(),
    'completion requires every independently observed diagnostic',
  );
  return {
    exit: 0,
    complete: true,
    browserClosed: true,
    elapsedMs: value.elapsedMs,
    observed: Object.keys(diagnosticFields),
  };
}
