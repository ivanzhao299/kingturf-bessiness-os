import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coverageRoots,
  coverageDeficits,
  productionInventory,
  sourceHash,
  summarizeReports,
  validateRunManifest,
} from './coverage-inventory.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Set only from the first real six-package measurement; never auto-update a baseline.
const baselineDigest = '';
const mode = process.argv[2];
assert(['measure', 'check'].includes(mode), 'use coverage-run.mjs measure|check');
const head = () =>
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = (name) =>
  JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8')).version;

async function run(args, cwd) {
  const startedAtMs = Date.now();
  const child = spawn('pnpm', args, {
    cwd,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
  });
  const result = await new Promise((accept, reject) => {
    child.once('error', () => reject(Error('coverage child could not start')));
    child.once('close', (exit, signal) => accept({ exit, signal }));
  });
  return { ...result, startedAtMs, finishedAtMs: Date.now() };
}

async function collect() {
  assert.equal(process.env.NODE_ENV, 'test', 'coverage requires NODE_ENV=test and guarded test DB');
  assert(process.env.DATABASE_URL, 'coverage requires DATABASE_URL for the existing test guard');
  const guard = await run(['ci:database:guard'], root);
  assert.equal(guard.exit, 0, 'coverage test database guard failed');
  const inventory = productionInventory(root);
  const expected = {
    runId: randomUUID(),
    head: head(),
    inventoryHash: sourceHash(JSON.stringify(inventory)),
    startedAtMs: Date.now(),
    versions: { vitest: version('vitest'), provider: version('@vitest/coverage-v8') },
  };
  assert.equal(expected.versions.vitest, '3.2.6');
  assert.equal(expected.versions.provider, '3.2.6');
  const directory = resolve(root, 'coverage', 'run-' + expected.runId);
  mkdirSync(resolve(root, 'coverage'), { recursive: true });
  mkdirSync(directory); // Exclusive new run: never reuse a previous report directory.
  writeFileSync(
    resolve(directory, 'start.json'),
    JSON.stringify({ ...expected, inventory }, null, 2),
  );
  const manifest = { schemaVersion: 1, ...expected, packages: [] };
  const reports = {};
  for (const owner of coverageRoots) {
    const output = resolve(directory, owner.replaceAll('/', '-'));
    assert(!existsSync(output), 'package output must not exist before its real execution');
    const result = await run(
      [
        'exec',
        'vitest',
        'run',
        '--coverage.enabled',
        '--coverage.provider=v8',
        '--coverage.all',
        '--coverage.allowExternal=false',
        '--coverage.include=src/**/*.ts',
        '--coverage.exclude=src/**/*.test.ts',
        '--coverage.exclude=src/**/*.spec.ts',
        '--coverage.exclude=src/**/*.d.ts',
        '--coverage.reporter=json',
        '--coverage.reportsDirectory=' + output,
      ],
      resolve(root, owner),
    );
    assert.equal(result.exit, 0, 'coverage package failed: ' + owner);
    assert.equal(result.signal, null, 'coverage package interrupted: ' + owner);
    const report = resolve(output, 'coverage-final.json');
    const bytes = readFileSync(report);
    manifest.packages.push({
      owner,
      runId: expected.runId,
      ...result,
      report,
      reportHash: sourceHash(bytes),
    });
    reports[owner] = JSON.parse(bytes.toString('utf8'));
  }
  manifest.finishedAtMs = Date.now();
  assert.equal(head(), expected.head, 'HEAD changed during coverage');
  assert.deepEqual(
    productionInventory(root),
    inventory,
    'production sources changed during coverage',
  );
  validateRunManifest(manifest, expected, inventory, directory);
  const summary = summarizeReports(root, inventory, reports);
  const baselinePath = resolve(
    root,
    'docs/evidence/harness-stage5-coverage-baseline-2026-10-17.json',
  );
  let baseline;
  if (mode === 'check') {
    assert.equal(
      baselineDigest.length,
      64,
      'verified first coverage measurement is not registered',
    );
    const baselineBytes = readFileSync(baselinePath);
    assert.equal(
      sourceHash(baselineBytes),
      baselineDigest,
      'baseline changed without a reviewed pin',
    );
    const fixed = JSON.parse(baselineBytes.toString('utf8'));
    assert.equal(fixed.schemaVersion, 1);
    baseline = fixed.summary;
  }
  const deficits = coverageDeficits(summary, baseline);
  const record = { manifest, inventory, summary, deficits };
  writeFileSync(resolve(directory, 'result.json'), JSON.stringify(record, null, 2));
  console.log(
    JSON.stringify({
      event: 'coverage-result',
      mode,
      runId: expected.runId,
      head: expected.head,
      inventory: inventory.length,
      repositories: inventory.filter((file) => file.repository).length,
      overall: summary.overall,
      domain: summary.domain,
      repositoryLines: summary.repositories,
      deficits,
      report: relative(root, resolve(directory, 'result.json')),
    }),
  );
  if (mode === 'check' && deficits.length > 0) {
    console.error(
      'Coverage gate failed. Inspect result.json uncovered files, add real execution tests or restore ' +
        'regressed implementation. Do not shrink the source inventory, lower baseline/targets or add ' +
        'unapproved exclusions. Required: overall 75%, domain 90%, API repositories 70%, no baseline decrease.',
    );
    process.exitCode = 1;
  }
}

try {
  await collect();
} catch (error) {
  console.error('Coverage collection failed: ' + error.message);
  process.exitCode = 1;
}
