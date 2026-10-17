import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export const coverageRoots = Object.freeze([
  'apps/api',
  'apps/web',
  'packages/config',
  'packages/database',
  'packages/domain',
  'packages/types',
]);

const slash = (value) => value.split(sep).join('/');
export const sourceHash = (value) => createHash('sha256').update(value).digest('hex');
const runtimeSource = (path) =>
  path.endsWith('.ts') && !path.endsWith('.d.ts') && !/\.(?:test|spec)\.ts$/u.test(path);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    assert(
      !entry.isSymbolicLink(),
      'production source symlinks require an explicit inventory review',
    );
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function productionInventory(root) {
  const canonicalRoot = realpathSync(root);
  return coverageRoots.flatMap((owner) => {
    const sources = walk(resolve(canonicalRoot, owner, 'src'));
    assert(
      sources.every((path) => !/\.[cm]?[jt]sx?$/u.test(path) || path.endsWith('.ts')),
      'new runtime extension requires a coverage scope review; it must not be silently omitted',
    );
    return sources
      .filter(runtimeSource)
      .sort()
      .map((absolute) => {
        const path = slash(relative(canonicalRoot, absolute));
        return {
          path,
          owner,
          hash: sourceHash(readFileSync(absolute)),
          repository:
            owner === 'apps/api' &&
            (/(?:^|\/)repositories\.[cm]?[jt]s$/u.test(path) ||
              /-repositories\.[cm]?[jt]s$/u.test(path) ||
              path.startsWith('apps/api/src/repositories/')),
        };
      });
  });
}

export function isPureTypeSource(source) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
    reportDiagnostics: true,
  });
  assert(
    !diagnostics.some((entry) => entry.category === ts.DiagnosticCategory.Error),
    'invalid source cannot be classified as pure type',
  );
  const emitted = ts.createSourceFile('emitted.js', outputText, ts.ScriptTarget.Latest, true);
  return emitted.statements.every(
    (statement) =>
      ts.isEmptyStatement(statement) ||
      (ts.isExportDeclaration(statement) &&
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length === 0),
  );
}

// Istanbul's line semantics: statements starting on the same line share the maximum hit count.
// A multi-line statement is not a hit for every line in its source span.
export function executableLines(data) {
  assert(data && typeof data === 'object' && !Array.isArray(data), 'missing file coverage');
  const statements = data.statementMap;
  const hits = data.s;
  assert(statements && hits && typeof statements === 'object' && typeof hits === 'object');
  assert(!Array.isArray(statements) && !Array.isArray(hits), 'coverage maps must be records');
  assert.deepEqual(Object.keys(statements).sort(), Object.keys(hits).sort());
  const lines = new Map();
  for (const [id, statement] of Object.entries(statements)) {
    const line = statement?.start?.line;
    const count = hits[id];
    assert(Number.isSafeInteger(line) && line > 0, 'invalid executable line');
    assert(Number.isSafeInteger(count) && count >= 0, 'invalid execution count');
    lines.set(line, Math.max(lines.get(line) ?? 0, count));
  }
  return {
    covered: [...lines.values()].filter((count) => count > 0).length,
    total: lines.size,
  };
}

export function validateLocations(data, source) {
  const lines = source.split(/\r?\n/u);
  for (const statement of Object.values(data.statementMap)) {
    for (const position of [statement.start, statement.end]) {
      assert(
        position && Number.isSafeInteger(position.line) && Number.isSafeInteger(position.column),
      );
      assert(position.line > 0 && position.line <= lines.length, 'statement line outside source');
      assert(
        position.column >= 0 && position.column <= lines[position.line - 1].length,
        'statement column outside source',
      );
    }
    assert(
      statement.end.line > statement.start.line ||
        (statement.end.line === statement.start.line &&
          statement.end.column >= statement.start.column),
      'reversed statement range',
    );
  }
}

function ownedPath(root, owner, value) {
  assert(typeof value === 'string' && isAbsolute(value), 'report path must be absolute');
  const path = slash(relative(realpathSync(root), realpathSync(value)));
  assert(path.startsWith(owner + '/src/'), 'foreign or wrong-owner coverage');
  return path;
}

export function summarizeReports(root, inventory, reports) {
  assert.deepEqual(
    Object.keys(reports).sort(),
    [...coverageRoots].sort(),
    'missing package report',
  );
  const expected = new Map(inventory.map((file) => [file.path, file]));
  assert.equal(expected.size, inventory.length, 'duplicate production inventory');
  const files = new Map();
  for (const owner of coverageRoots) {
    const report = reports[owner];
    assert(
      report && typeof report === 'object' && !Array.isArray(report),
      'invalid package report',
    );
    for (const [key, value] of Object.entries(report)) {
      const path = ownedPath(root, owner, key);
      assert.equal(ownedPath(root, owner, value.path), path, 'coverage key/path mismatch');
      assert(expected.has(path), 'coverage outside the production inventory');
      assert.equal(expected.get(path).owner, owner);
      assert(!files.has(path), 'duplicate reported production file');
      const source = readFileSync(resolve(root, path), 'utf8');
      assert.equal(sourceHash(source), expected.get(path).hash);
      const counts = executableLines(value);
      validateLocations(value, source);
      if (counts.total === 0)
        assert(
          isPureTypeSource(source),
          'executable production source cannot disappear as an empty coverage map',
        );
      files.set(path, counts);
    }
  }
  assert.equal(files.size, expected.size, 'missing unimported production source coverage');
  for (const path of expected.keys()) assert(files.has(path), 'missing production file');
  const sum = (select) => {
    let covered = 0;
    let total = 0;
    for (const file of inventory) {
      if (!select(file)) continue;
      const counts = files.get(file.path);
      covered += counts.covered;
      total += counts.total;
    }
    assert(Number.isSafeInteger(covered) && Number.isSafeInteger(total));
    return { covered, total };
  };
  return {
    overall: sum(() => true),
    domain: sum((file) => file.owner === 'packages/domain'),
    repositories: sum((file) => file.repository),
    packages: Object.fromEntries(
      coverageRoots.map((owner) => [owner, sum((file) => file.owner === owner)]),
    ),
    files: Object.fromEntries(files),
  };
}

export function atLeastRatio(actual, required) {
  for (const value of [actual, required]) {
    assert(Number.isSafeInteger(value.covered) && Number.isSafeInteger(value.total));
    assert(value.total > 0 && value.covered >= 0 && value.covered <= value.total);
  }
  return (
    BigInt(actual.covered) * BigInt(required.total) >=
    BigInt(required.covered) * BigInt(actual.total)
  );
}

export const coverageTargets = Object.freeze({
  overall: { covered: 75, total: 100 },
  domain: { covered: 90, total: 100 },
  repositories: { covered: 70, total: 100 },
});

export function coverageDeficits(summary, baseline) {
  const failures = [];
  for (const [group, target] of Object.entries(coverageTargets)) {
    if (!atLeastRatio(summary[group], target)) failures.push(group + ': target not met');
    if (baseline && !atLeastRatio(summary[group], baseline[group]))
      failures.push(group + ': baseline decreased');
  }
  return failures;
}

// expected is minted in memory before this invocation launches Vitest, not reconstructed
// from a report found on disk. Each package owns a previously absent output directory.
export function validateRunManifest(manifest, expected, inventory, reportsDirectory) {
  assert.equal(manifest.schemaVersion, 1);
  for (const key of ['runId', 'head', 'inventoryHash', 'startedAtMs'])
    assert.equal(manifest[key], expected[key], 'coverage provenance mismatch: ' + key);
  assert.deepEqual(manifest.versions, expected.versions);
  assert.equal(manifest.versions.vitest, '3.2.6');
  assert.equal(manifest.versions.provider, '3.2.6');
  assert.equal(manifest.inventoryHash, sourceHash(JSON.stringify(inventory)));
  assert(Number.isSafeInteger(manifest.finishedAtMs));
  assert(manifest.finishedAtMs >= manifest.startedAtMs);
  assert.deepEqual(
    manifest.packages.map((entry) => entry.owner).sort(),
    [...coverageRoots].sort(),
    'missing or duplicate package execution',
  );
  for (const entry of manifest.packages) {
    assert.equal(entry.runId, expected.runId, 'old package report');
    assert.equal(entry.exit, 0, 'coverage requires actual successful package completion');
    assert.equal(entry.signal, null, 'interrupted coverage is not a result');
    assert.equal(entry.groupDrained, true, 'owned process group drain was not verified');
    assert.equal(entry.forcedCleanup, false, 'successful leader left live descendants');
    assert.equal(entry.aborted, false, 'cancelled coverage is not a result');
    assert(Number.isSafeInteger(entry.startedAtMs) && Number.isSafeInteger(entry.finishedAtMs));
    assert(entry.startedAtMs >= expected.startedAtMs);
    assert(entry.finishedAtMs >= entry.startedAtMs && entry.finishedAtMs <= manifest.finishedAtMs);
    const wanted = resolve(
      reportsDirectory,
      entry.owner.replaceAll('/', '-'),
      'coverage-final.json',
    );
    assert.equal(realpathSync(entry.report), realpathSync(wanted), 'wrong run or package report');
    const stat = statSync(wanted);
    assert(stat.size > 0 && stat.mtimeMs >= entry.startedAtMs, 'empty or old report timestamp');
    assert.equal(sourceHash(readFileSync(wanted)), entry.reportHash, 'coverage report changed');
  }
}
