import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { productionInventory } from './coverage-inventory.mjs';

function comments(source) {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  assert.equal(file.parseDiagnostics.length, 0, 'invalid source cannot establish exemptions');
  const ranges = new Map();
  const visit = (node) => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(source, node.end) ?? []),
    ])
      ranges.set(range.pos, range);
    for (const child of node.getChildren(file)) visit(child);
  };
  visit(file);
  return [...ranges.values()].map((range) => ({
    text: source.slice(range.pos, range.end),
    line: file.getLineAndCharacterOfPosition(range.pos).line + 1,
    kind: range.kind,
  }));
}

function validDate(value) {
  assert.equal(typeof value, 'string', 'exemption date must be a string');
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(value), 'invalid exemption date');
  const date = new Date(value + 'T00:00:00.000Z');
  assert(
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value,
    'invalid exemption date',
  );
  return value;
}

export function singaporeDate(now) {
  assert(Number.isFinite(now.getTime()), 'invalid exemption clock');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Metadata audit only: never removes executable lines or weakens global targets. */
export function validateCoverageExemptions(sources, ledger, now = new Date()) {
  const annotations = new Map();
  const today = singaporeDate(now);
  for (const { path, source } of sources) {
    for (const comment of comments(source)) {
      if (!/^\/\/\s*coverage-exempt\b/u.test(comment.text)) continue;
      assert.equal(comment.kind, ts.SyntaxKind.SingleLineCommentTrivia);
      const match = /^\/\/\s*coverage-exempt\((.+), until-(\d{4}-\d{2}-\d{2})\)\s*$/u.exec(
        comment.text,
      );
      assert(match, 'malformed coverage exemption at ' + path + ':' + String(comment.line));
      const reason = match[1].trim(),
        until = validDate(match[2]);
      assert(reason.length > 0, 'exemption reason is required');
      assert(today <= until, 'expired coverage exemption at ' + path + ':' + String(comment.line));
      const key = path + ':' + String(comment.line);
      assert(!annotations.has(key), 'duplicate source exemption');
      annotations.set(key, { path, line: comment.line, reason, until });
    }
  }
  const statuses = new Map();
  for (const line of ledger.split('\n')) {
    if (!/^\|\s*TD-[A-Z0-9-]+\s*\|/u.test(line)) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    assert(!statuses.has(cells[0]), 'duplicate debt table identity');
    statuses.set(cells[0], cells.at(-1));
  }
  const matched = new Set(),
    debts = new Set();
  for (const match of ledger.matchAll(/<!-- coverage-exempt ([^\n]*?) -->/gu)) {
    const record = JSON.parse(match[1]);
    assert.deepEqual(Object.keys(record).sort(), [
      'approval',
      'debt',
      'line',
      'path',
      'reason',
      'until',
    ]);
    assert.equal(typeof record.debt, 'string');
    assert.equal(
      statuses.get(record.debt),
      '已豁免',
      'coverage exemption needs a debt row with status 已豁免',
    );
    assert.equal(typeof record.path, 'string');
    assert(Number.isSafeInteger(record.line) && record.line > 0);
    assert.equal(typeof record.reason, 'string');
    assert.equal(typeof record.approval, 'string');
    assert(record.approval.trim().length > 0, 'explicit human approval reference required');
    validDate(record.until);
    const key = record.path + ':' + String(record.line);
    assert(!matched.has(key), 'duplicate ledger exemption');
    assert.deepEqual(
      annotations.get(key),
      {
        path: record.path,
        line: record.line,
        reason: record.reason,
        until: record.until,
      },
      'ledger/source exemption mismatch',
    );
    matched.add(key);
    debts.add(record.debt);
  }
  // Annotation-like malformed ledger records may not disappear from the audit.
  assert.equal(
    (ledger.match(/<!-- coverage-exempt\b/gu) ?? []).length,
    matched.size,
    'malformed ledger exemption',
  );
  assert.equal(matched.size, annotations.size, 'source exemption missing its ledger record');
  for (const [debt, status] of statuses)
    if (status === '已豁免')
      assert(debts.has(debt), 'exempt debt missing source/ledger coverage record');
  return { active: matched.size, date: today };
}

export function checkCoverageExemptions(
  root,
  inventory = productionInventory(root),
  now = new Date(),
) {
  return validateCoverageExemptions(
    inventory.map(({ path }) => ({ path, source: readFileSync(resolve(root, path), 'utf8') })),
    readFileSync(resolve(root, 'docs/exec-plans/tech-debt-tracker.md'), 'utf8'),
    now,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    console.log(JSON.stringify({ event: 'coverage-exemptions', ...checkCoverageExemptions(root) }));
  } catch (error) {
    console.error(
      'Coverage exemption audit failed: ' +
        error.message +
        '. Match source reason/date/path/line with an 已豁免 debt record and explicit human approval; renew only after human confirmation. Do not remove sources or lower targets.',
    );
    process.exitCode = 1;
  }
}
