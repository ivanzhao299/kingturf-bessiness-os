import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  completeFunctions,
  FUNCTION_POLICY,
  functionLengthViolations,
  productionSources,
  scanFunctionLengths,
  validateFunctionPolicy,
} from './function-length.mjs';

const samplePath = 'apps/api/src/sample.ts';
const now = Date.parse('2026-10-20T04:00:00Z');
const functionSource = (lines, name = 'sample') =>
  [`function ${name}() {`, ...Array(lines - 2).fill('  // fixed fixture'), '}'].join('\n');
const fn = (lines = 201) => completeFunctions(samplePath, functionSource(lines))[0];
const entry = (changes = {}) => ({
  path: samplePath,
  symbol: 'FunctionDeclaration:sample',
  baselineStart: 1,
  baselineEnd: 201,
  maxLines: 201,
  reason: 'Fixed existing synthetic long function',
  owner: 'Test executor',
  dueBatch: 'Fixed finite synthetic batch',
  until: '2026-11-17',
  ...changes,
});
const policy = (entries = [entry()]) => ({
  version: 1,
  measuredOn: '2026-10-20',
  exemptions: entries,
});
const hard = (result) => result.violations.filter((item) => !item.whitelisted);
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-g5-'));
  const put = (relative, content) => {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  try {
    return run({ root, put });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('G5 complete inclusive span permits 200 and blocks 201, including multiline signatures', () => {
  assert.equal(fn(200).lines, 200);
  assert.deepEqual(functionLengthViolations([fn(200)], []), []);
  assert.equal(functionLengthViolations([fn(201)], [])[0].whitelisted, false);
  const metric = completeFunctions(
    samplePath,
    '// excluded comment\nfunction example(\n value: number,\n) {\n return value;\n}',
  )[0];
  assert.equal(metric.first, 2);
  assert.equal(metric.last, 6);
  assert.equal(metric.lines, 5);
});

test('G5 recurses every body kind, anonymous callbacks, default arguments and expression arrows', () => {
  const metrics = completeFunctions(
    samplePath,
    `
function outer(value = () => 1) {
  [1].map(function named() { return () => 2; });
  return (x => x)(value());
}
class Sample {
  constructor() {}
  method() {}
  get value() { return 1; }
  set value(next: number) {}
}
interface Signatures { method(): void }
declare function declarationOnly(): void;
`,
  );
  const kinds = metrics.map((metric) => metric.kind);
  assert.equal(metrics.length, 9);
  for (const kind of [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunction',
    'Constructor',
    'MethodDeclaration',
    'GetAccessor',
    'SetAccessor',
  ])
    assert(kinds.includes(kind), kind);
  assert.equal(kinds.filter((kind) => kind === 'ArrowFunction').length, 3);
  assert.equal(metrics[0].lines, 4);
  assert.throws(() => completeFunctions(samplePath, 'function broken( {'), /AST parse failed/u);
});

test('G5 source discovery covers nested routes in every workspace and excludes only documented TS tests', () => {
  fixture(({ root, put }) => {
    for (const path of [
      samplePath,
      'apps/web/src/other/routes/visible.ts',
      'packages/example/src/routes/deep/item.ts',
    ])
      put(path, 'export const example = () => 1;');
    for (const path of [
      'apps/api/test/fixture.ts',
      'apps/api/src/test/fixture.ts',
      'apps/api/src/fixture.test.ts',
      'apps/api/src/fixture.spec.ts',
      'apps/api/src/fixture.d.ts',
      'scripts/fixture.ts',
    ])
      put(path, 'function excluded() {}');
    assert.equal(productionSources(root).length, 4);
    assert(productionSources(root).includes('apps/api/src/test/fixture.ts'));
    put('apps/api/src/new-runtime.js', 'export const example = () => 1;');
    assert.throws(() => productionSources(root), /explicit parser contract/u);
  });
  fixture(({ root, put }) => {
    put(samplePath, '');
    symlinkSync(join(root, samplePath), join(root, 'apps/api/src/linked.ts'));
    assert.throws(() => productionSources(root), /symbolic link/u);
  });
});

test('G5 exact finite exemption allows original/shifted body, rejects stale exemption, growth and new long function', () => {
  const entries = validateFunctionPolicy(policy(), now);
  assert.equal(functionLengthViolations([fn()], entries)[0].whitelisted, true);
  const shifted = completeFunctions(samplePath, '\n\n' + functionSource(201))[0];
  assert.equal(functionLengthViolations([shifted], entries)[0].whitelisted, true);
  assert.equal(functionLengthViolations([fn(200)], entries)[0].whitelisted, false);
  assert.match(functionLengthViolations([fn(200)], entries)[0].problem, /stale exemption/u);
  assert.equal(functionLengthViolations([fn(202)], entries)[0].whitelisted, false);
  const newLong = completeFunctions(samplePath, functionSource(201, 'newLong'))[0];
  assert.equal(
    functionLengthViolations([fn(), newLong], entries).filter((item) => !item.whitelisted).length,
    1,
  );
});

test('G5 missing, renamed, moved or ambiguous function cannot inherit an exemption', () => {
  const entries = validateFunctionPolicy(policy(), now);
  for (const functions of [
    [],
    [{ ...fn(), symbol: 'FunctionDeclaration:renamed' }],
    [{ ...fn(), path: 'apps/api/src/moved.ts' }],
    [fn(), fn()],
  ]) {
    const failures = functionLengthViolations(functions, entries).filter(
      (item) => !item.whitelisted,
    );
    assert(failures.some((item) => /resolve once/u.test(item.problem)));
  }
  const duplicates = completeFunctions(
    samplePath,
    `${functionSource(201)}\n${functionSource(201)}`,
  );
  assert.equal(duplicates[0].symbol, duplicates[1].symbol);
  assert(
    functionLengthViolations(duplicates, entries).some((item) => /found 2/u.test(item.problem)),
  );
});

test('G5 expiry includes Singapore until day and fails at next midnight, including entries now below 200', () => {
  const expires = Date.parse('2026-11-17T16:00:00Z');
  assert.equal(validateFunctionPolicy(policy(), expires - 1).length, 1);
  assert.throws(() => validateFunctionPolicy(policy(), expires), /expired/u);
  assert.throws(() => validateFunctionPolicy(policy(), expires + 86400000), /expired/u);
  fixture(({ root, put }) => {
    put(samplePath, functionSource(200));
    put(FUNCTION_POLICY, JSON.stringify(policy()));
    assert.equal(hard(scanFunctionLengths(root, expires)).length, 1);
  });
});

test('G5 rejects malformed metadata, duplicate identities, non-calendar and indefinite dates', () => {
  for (const changes of [
    { path: '../sample.ts' },
    { path: 'apps/api/src/*.ts' },
    { path: 'apps/api/src/sample.test.ts' },
    { symbol: '*' },
    { symbol: '' },
    { owner: '' },
    { reason: '' },
    { dueBatch: '' },
    { maxLines: 202 },
    { baselineStart: 0 },
    { until: '2026-02-30' },
    { until: '9999-01-01' },
    { until: '2026-10-19' },
    { raw: 'unexpected' },
  ])
    assert.throws(() => validateFunctionPolicy(policy([entry(changes)]), now));
  assert.throws(() => validateFunctionPolicy(policy([entry(), entry()]), now), /duplicate/u);
  assert.throws(() => validateFunctionPolicy({ ...policy(), version: 2 }, now));
  assert.throws(() => validateFunctionPolicy({ ...policy(), measuredOn: '2026-02-30' }, now));
  assert.throws(() => validateFunctionPolicy(policy(), Date.parse('2026-10-19T00:00Z')), /clock/u);
});

test('G5 isolated root with absent policy has zero exemptions; corrupt/duplicate JSON never downgrades to empty', () => {
  fixture(({ root, put }) => {
    put(samplePath, functionSource(201));
    assert.equal(hard(scanFunctionLengths(root, now)).length, 1);
    put(FUNCTION_POLICY, JSON.stringify(policy()));
    assert.equal(hard(scanFunctionLengths(root, now)).length, 0);
    for (const content of [
      '{broken',
      JSON.stringify(policy()).replace('"version":1', '"version":1,"version":1'),
    ]) {
      put(FUNCTION_POLICY, content);
      const result = hard(scanFunctionLengths(root, now));
      assert.equal(result.length, 1);
      assert.match(result[0].problem, /JSON/u);
    }
  });
});

test('G5 real CLI --report still rejects 201 lines and accepts 200 in an unexempt workspace', () => {
  const gate = join(process.cwd(), 'scripts/analysis/structure-gate.mjs');
  fixture(({ root, put }) => {
    mkdirSync(join(root, 'packages'));
    put(samplePath, functionSource(201));
    const red = spawnSync(process.execPath, [gate, '--report'], { cwd: root, encoding: 'utf8' });
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.match(red.stderr, /\[G5\].*sample.ts/u);
    put(samplePath, functionSource(200));
    const green = spawnSync(process.execPath, [gate, '--report'], { cwd: root, encoding: 'utf8' });
    assert.equal(green.status, 0, green.stdout + green.stderr);
    put('apps/api/src/test/production.ts', functionSource(201));
    const testDirectory = spawnSync(process.execPath, [gate, '--report'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(testDirectory.status, 1, testDirectory.stdout + testDirectory.stderr);
    assert.match(testDirectory.stderr, /\[G5\].*src\/test\/production.ts/u);
  });
});
