import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  atLeastRatio,
  coverageDeficits,
  coverageRoots,
  executableLines,
  isPureTypeSource,
  productionInventory,
  sourceHash,
  summarizeReports,
  validateLocations,
  validateRunManifest,
} from './coverage-inventory.mjs';

function fileCoverage(path, hits = [1]) {
  return {
    path,
    statementMap: Object.fromEntries(
      hits.map((_, index) => [
        String(index),
        { start: { line: index + 1, column: 0 }, end: { line: index + 1, column: 10 } },
      ]),
    ),
    s: Object.fromEntries(hits.map((hit, index) => [String(index), hit])),
  };
}

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'kingturf-coverage-contract-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true }); // Exact exclusively-created test directory.
  });
  const reports = {};
  for (const owner of coverageRoots) {
    mkdirSync(resolve(root, owner, 'src'), { recursive: true });
    const name = owner === 'apps/api' ? 'crm-repositories.ts' : 'index.ts';
    const path = resolve(root, owner, 'src', name);
    writeFileSync(path, 'export const sample = 1;\n');
    reports[owner] = { [path]: fileCoverage(path) };
  }
  return { root, inventory: productionInventory(root), reports };
}

test('inventory includes never imported production files and top-level repository files', (t) => {
  const { root, reports } = fixture(t);
  writeFileSync(resolve(root, 'apps/web/src/never-imported.ts'), 'export const missing = 1;\n');
  writeFileSync(resolve(root, 'apps/web/src/placeholder.d.ts'), 'export type Missing = string;\n');
  writeFileSync(resolve(root, 'apps/web/src/extra.test.ts'), 'export const testOnly = 1;\n');
  const inventory = productionInventory(root);
  assert.equal(inventory.length, 7);
  assert.equal(inventory.filter((entry) => entry.repository).length, 1);
  assert.throws(() => summarizeReports(root, inventory, reports), /missing unimported/u);
  const path = resolve(root, 'apps/web/src/never-imported.ts');
  reports['apps/web'][path] = fileCoverage(path, [0]);
  const summary = summarizeReports(root, inventory, reports);
  assert.deepEqual(summary.overall, { covered: 6, total: 7 });
  assert.deepEqual(summary.packages['apps/web'], { covered: 1, total: 2 });
});

test('line semantics merge same-line hits and do not count a statement span as extra lines', () => {
  const data = {
    statementMap: {
      0: { start: { line: 2 }, end: { line: 5 } },
      1: { start: { line: 2 }, end: { line: 2 } },
      2: { start: { line: 8 }, end: { line: 8 } },
    },
    s: { 0: 0, 1: 1, 2: 0 },
  };
  assert.deepEqual(executableLines(data), { covered: 1, total: 2 });
  assert.deepEqual(executableLines({ statementMap: {}, s: {} }), { covered: 0, total: 0 });
  assert.throws(() => executableLines({ ...data, s: { 0: 1 } }));
  assert.throws(() =>
    executableLines({ statementMap: { 0: { start: { line: 0 } } }, s: { 0: 1 } }),
  );
  assert.throws(() =>
    executableLines({ statementMap: { 0: { start: { line: 1 } } }, s: { 0: -1 } }),
  );
});

test('overall weights executable lines rather than averaging percentages', (t) => {
  const { root, reports } = fixture(t);
  const path = resolve(root, 'apps/web/src/index.ts');
  writeFileSync(
    path,
    Array.from({ length: 5 }, (_, index) => `export const sample${String(index)} = 1;\n`).join(''),
  );
  const inventory = productionInventory(root);
  reports['apps/web'][path] = fileCoverage(path, [1, 0, 0, 0, 0]);
  const summary = summarizeReports(root, inventory, reports);
  assert.deepEqual(summary.overall, { covered: 6, total: 10 });
  assert.deepEqual(summary.repositories, { covered: 1, total: 1 });
  assert.deepEqual(summary.domain, { covered: 1, total: 1 });
});

test('missing packages, empty reports, foreign ownership, stale source and aliases fail closed', (t) => {
  const { root, inventory, reports } = fixture(t);
  const missing = { ...reports };
  delete missing['packages/types'];
  assert.throws(() => summarizeReports(root, inventory, missing), /missing package/u);
  assert.throws(
    () => summarizeReports(root, inventory, { ...reports, 'apps/web': {} }),
    /missing unimported/u,
  );
  const domain = resolve(root, 'packages/domain/src/index.ts');
  const foreign = { ...reports, 'apps/api': { [domain]: fileCoverage(domain) } };
  assert.throws(() => summarizeReports(root, inventory, foreign), /wrong-owner/u);
  const original = resolve(root, 'apps/web/src/index.ts');
  const alias = resolve(root, 'apps/web/src') + '/./index.ts';
  reports['apps/web'][alias] = fileCoverage(original);
  assert.throws(() => summarizeReports(root, inventory, reports), /duplicate reported/u);
  Reflect.deleteProperty(reports['apps/web'], alias);
  writeFileSync(original, 'export const changed = 2;\n');
  assert.throws(() => summarizeReports(root, inventory, reports));
});

test('exact fractions reject rounded-up thresholds and enforce all targets plus baseline', () => {
  assert.equal(
    atLeastRatio({ covered: 749999, total: 1000000 }, { covered: 75, total: 100 }),
    false,
  );
  assert.equal(atLeastRatio({ covered: 3, total: 4 }, { covered: 75, total: 100 }), true);
  assert.throws(() => atLeastRatio({ covered: 0, total: 0 }, { covered: 75, total: 100 }));
  const summary = {
    overall: { covered: 3, total: 4 },
    domain: { covered: 9, total: 10 },
    repositories: { covered: 7, total: 10 },
  };
  assert.deepEqual(coverageDeficits(summary), []);
  assert.deepEqual(coverageDeficits(summary, { ...summary, overall: { covered: 4, total: 5 } }), [
    'overall: baseline decreased',
  ]);
  assert.deepEqual(coverageDeficits({ ...summary, domain: { covered: 8, total: 10 } }), [
    'domain: target not met',
  ]);
});

test('only proven pure type files may report N/A and new runtime extensions require scope review', (t) => {
  assert(isPureTypeSource('export type Value = string; export interface Item { id: Value }'));
  assert(!isPureTypeSource('export const DATA_SCOPES = ["SELF"] as const;'));
  assert(!isPureTypeSource('export { value } from "./runtime.js";'));
  const { root, inventory, reports } = fixture(t);
  const path = resolve(root, 'packages/types/src/index.ts');
  reports['packages/types'][path] = fileCoverage(path, []);
  assert.throws(() => summarizeReports(root, inventory, reports), /empty coverage map/u);
  writeFileSync(path, 'export type Value = string;\n');
  const summary = summarizeReports(root, productionInventory(root), reports);
  assert.deepEqual(summary.packages['packages/types'], { covered: 0, total: 0 });
  assert.deepEqual(summary.overall, { covered: 5, total: 5 });
  writeFileSync(resolve(root, 'apps/web/src/new.js'), 'export const extra = 1;\n');
  assert.throws(() => productionInventory(root), /scope review/u);
});

test('statement line/column ranges must refer to real source positions', () => {
  const source = 'const value = 1;\n';
  validateLocations(fileCoverage('/fixed/path.ts'), source);
  const outsideLine = fileCoverage('/fixed/path.ts', [1, 0, 0]);
  assert.throws(() => validateLocations(outsideLine, source), /outside source/u);
  const outsideColumn = fileCoverage('/fixed/path.ts');
  outsideColumn.statementMap['0'].end.column = 100;
  assert.throws(() => validateLocations(outsideColumn, source), /outside source/u);
  const reversed = fileCoverage('/fixed/path.ts');
  reversed.statementMap['0'].start.column = 12;
  assert.throws(() => validateLocations(reversed, source), /reversed/u);
});

test('fresh run provenance rejects unchanged-source old reports and incomplete executions', (t) => {
  const { root, inventory, reports } = fixture(t);
  const directory = resolve(root, 'run-current');
  mkdirSync(directory);
  const startedAtMs = Date.now() - 1000;
  const expected = {
    runId: 'fixed-current-run',
    head: 'a'.repeat(40),
    inventoryHash: sourceHash(JSON.stringify(inventory)),
    startedAtMs,
    versions: { vitest: '3.2.6', provider: '3.2.6' },
  };
  const packages = coverageRoots.map((owner) => {
    const output = resolve(directory, owner.replaceAll('/', '-'));
    mkdirSync(output);
    const report = resolve(output, 'coverage-final.json');
    const bytes = JSON.stringify(reports[owner]);
    writeFileSync(report, bytes);
    return {
      owner,
      runId: expected.runId,
      exit: 0,
      signal: null,
      startedAtMs: startedAtMs + 1,
      finishedAtMs: Date.now(),
      report,
      reportHash: sourceHash(bytes),
    };
  });
  const manifest = { schemaVersion: 1, ...expected, packages, finishedAtMs: Date.now() };
  validateRunManifest(manifest, expected, inventory, directory);
  assert.throws(
    () => validateRunManifest({ ...manifest, runId: 'old-run' }, expected, inventory, directory),
    /provenance mismatch/u,
  );
  const oldPackage = { ...packages[0], runId: 'old-run' };
  assert.throws(
    () =>
      validateRunManifest(
        { ...manifest, packages: [oldPackage, ...packages.slice(1)] },
        expected,
        inventory,
        directory,
      ),
    /old package/u,
  );
  assert.throws(() =>
    validateRunManifest(
      { ...manifest, packages: packages.slice(1) },
      expected,
      inventory,
      directory,
    ),
  );
  assert.throws(() =>
    validateRunManifest(
      { ...manifest, packages: [{ ...packages[0], exit: null }, ...packages.slice(1)] },
      expected,
      inventory,
      directory,
    ),
  );
  utimesSync(packages[0].report, new Date(0), new Date(0));
  assert.throws(
    () => validateRunManifest(manifest, expected, inventory, directory),
    /old report timestamp/u,
  );
});
