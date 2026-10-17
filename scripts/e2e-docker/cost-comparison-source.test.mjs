import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {
  costComparisonSource,
  safeCostObservation,
  validateCostComparison,
} from './cost-comparison-source.mjs';
const source = readFileSync(
  new URL('../../tests/e2e/cost-matrix-product-quality.spec.ts', import.meta.url),
  'utf8',
);
const patch = readFileSync(
  new URL('../../docs/evidence/playwright-cost-auth-candidate-2026-10-17.patch', import.meta.url),
  'utf8',
);
const expectations = (text) => {
  const root = ts.createSourceFile('observation.ts', text, ts.ScriptTarget.Latest, true),
    values = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'expect'
    ) {
      let chain = node;
      while (chain.parent && !ts.isExpressionStatement(chain)) chain = chain.parent;
      assert(ts.isExpressionStatement(chain));
      values.push(chain.getText(root));
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  assert.equal(root.parseDiagnostics.length, 0);
  return values;
};
test('three fixed diagnostic copies preserve every original handoff expectation', () => {
  const original = source.slice(source.indexOf("test('hands an approved matrix"));
  const expected = expectations(original);
  assert.equal(expected.length, 7);
  assert.notDeepEqual(expectations(original.replace('toBeVisible()', 'toBeHidden()')), expected);
  for (const condition of ['old-cold', 'current-cold', 'current-warm']) {
    const generated = costComparisonSource(source, patch, condition);
    assert.deepEqual(expectations(generated), expected);
    assert.equal(generated.includes('const quoteParent'), condition === 'current-warm');
    assert.equal(generated.includes('installSyntheticLogin'), condition !== 'old-cold');
    assert.equal((generated.match(/test\('/gu) ?? []).length, 1);
  }
});
test('source or authorized patch drift refuses diagnostic generation', () => {
  assert.throws(
    () => costComparisonSource(source + '\n', patch, 'old-cold'),
    /frozen cost source changed/u,
  );
  assert.throws(
    () => costComparisonSource(source, patch + '\n', 'current-cold'),
    /authorized authentication patch changed/u,
  );
  for (const condition of ['all', 'production', undefined])
    assert.throws(() => validateCostComparison(condition, 'fixed'));
  for (const label of ['../raw', '', 'A', 'x'.repeat(65)])
    assert.throws(() => validateCostComparison('current-cold', label));
});
test('comparison output re-encodes only the fixed bounded observations', () => {
  const observation = {
    textNodeSeen: true,
    renderedFrameSeen: false,
    viewportFrameSeen: false,
    warmVisited: false,
    finalRendered: false,
    finalViewport: false,
    quotesRoute: true,
    dialogVisible: true,
    preselected: true,
    frames: 100,
    status: 'failed',
  };
  const safe = safeCostObservation({
    ...observation,
    raw: 'FIXED_NON_SECRET_CANARY',
    cookie: 'FIXED_NON_SECRET_CANARY',
  });
  assert.deepEqual(safe, observation);
  assert(!JSON.stringify(safe).includes('CANARY'));
  for (const invalid of [
    { frames: -1 },
    { frames: 100001 },
    { frames: 1.5 },
    { status: 'unknown' },
    { dialogVisible: 'raw' },
  ])
    assert.throws(() => safeCostObservation({ ...observation, ...invalid }));
});
