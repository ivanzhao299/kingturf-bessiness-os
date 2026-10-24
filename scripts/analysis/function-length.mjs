import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const MAX_FUNCTION_LINES = 200;
export const FUNCTION_POLICY = 'scripts/analysis/function-length-exemptions.json';

const sourceTs = (path) => path.endsWith('.ts') && !/\.(?:d|test|spec)\.ts$/u.test(path);

export function productionSources(root) {
  const files = [];
  const visit = (relative) => {
    const full = join(root, relative);
    const stat = lstatSync(full);
    assert(!stat.isSymbolicLink(), `G5 rejects symbolic link: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(full).sort()) visit(`${relative}/${entry}`);
    } else if (sourceTs(relative)) files.push(relative);
    else
      assert(
        !/\.(?:js|jsx|mjs|cjs|tsx|mts|cts)$/u.test(relative),
        `G5 requires an explicit parser contract for runtime source: ${relative}`,
      );
  };
  for (const base of ['apps', 'packages']) {
    const full = join(root, base);
    if (!existsSync(full)) continue;
    assert(!lstatSync(full).isSymbolicLink(), `G5 rejects symbolic link: ${base}`);
    for (const name of readdirSync(full).sort()) {
      const workspace = join(full, name);
      assert(!lstatSync(workspace).isSymbolicLink(), `G5 rejects symbolic link: ${base}/${name}`);
      if (lstatSync(workspace).isDirectory() && existsSync(join(workspace, 'src')))
        visit(`${base}/${name}/src`);
    }
  }
  return files;
}

function structuralSymbol(node, source) {
  const parts = [];
  for (let current = node; current && !ts.isSourceFile(current); current = current.parent) {
    if (current.name)
      parts.unshift(`${ts.SyntaxKind[current.kind]}:${current.name.getText(source)}`);
    else if (ts.isFunctionLike(current) && current.body)
      parts.unshift(`${ts.SyntaxKind[current.kind]}:<anonymous>`);
  }
  return parts.join('/');
}

export function completeFunctions(path, content) {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length, 0, `G5 AST parse failed: ${path}`);
  const functions = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const first = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const last = source.getLineAndCharacterOfPosition(node.getEnd() - 1).line + 1;
      functions.push({
        path,
        kind: ts.SyntaxKind[node.kind],
        symbol: structuralSymbol(node, source),
        first,
        last,
        lines: last - first + 1,
      });
    }
    node.forEachChild(visit);
  };
  visit(source);
  return functions;
}

function exactKeys(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'G5 object required');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'G5 exact policy fields required');
}

function dateUtc(value) {
  assert.equal(typeof value, 'string', 'G5 date must be a string');
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/u, 'G5 date requires YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  assert(
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value,
    'G5 invalid calendar date',
  );
  return time;
}

export function validateFunctionPolicy(policy, now = Date.now()) {
  exactKeys(policy, ['version', 'measuredOn', 'exemptions']);
  assert.equal(policy.version, 1, 'G5 policy version must be 1');
  const measured = dateUtc(policy.measuredOn);
  assert(Number.isFinite(now) && now >= measured - 8 * 3600000, 'G5 clock precedes measurement');
  assert(Array.isArray(policy.exemptions), 'G5 exemptions must be an array');
  const identities = new Set();
  for (const entry of policy.exemptions) {
    exactKeys(entry, [
      'path',
      'symbol',
      'baselineStart',
      'baselineEnd',
      'maxLines',
      'reason',
      'owner',
      'dueBatch',
      'until',
    ]);
    assert.equal(typeof entry.path, 'string');
    assert.match(
      entry.path,
      /^(?:apps|packages)\/[\w-]+\/src\/(?:[\w-]+\/)*[\w.-]+\.ts$/u,
      'G5 exact relative source path required',
    );
    assert(
      sourceTs(entry.path) && !entry.path.split('/').includes('..'),
      'G5 production source path required',
    );
    for (const field of ['symbol', 'reason', 'owner', 'dueBatch'])
      assert(
        typeof entry[field] === 'string' && entry[field].trim().length > 0,
        `G5 ${field} required`,
      );
    assert(!entry.symbol.includes('*'), 'G5 wildcard symbols forbidden');
    for (const field of ['baselineStart', 'baselineEnd', 'maxLines'])
      assert(
        Number.isSafeInteger(entry[field]) && entry[field] > 0,
        `G5 positive integer ${field} required`,
      );
    assert.equal(
      entry.baselineEnd - entry.baselineStart + 1,
      entry.maxLines,
      'G5 baseline span must equal cap',
    );
    assert(
      entry.maxLines > MAX_FUNCTION_LINES,
      'G5 exemption must document an existing long function',
    );
    const until = dateUtc(entry.until);
    assert(
      until >= measured && until - measured <= 90 * 86400000,
      'G5 finite expiry must be within 90 days of measurement',
    );
    assert(
      now < until + 16 * 3600000,
      `G5 exemption expired at next-day 00:00 Asia/Singapore: ${entry.path} ${entry.symbol}`,
    );
    const identity = `${entry.path}\n${entry.symbol}`;
    assert(!identities.has(identity), 'G5 duplicate function exemption');
    identities.add(identity);
  }
  return policy.exemptions;
}

function loadPolicy(root, now) {
  let content;
  try {
    assert(!lstatSync(join(root, FUNCTION_POLICY)).isSymbolicLink(), 'G5 policy symlink forbidden');
    content = readFileSync(join(root, FUNCTION_POLICY), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const json = ts.parseJsonText(FUNCTION_POLICY, content);
  assert.equal(json.parseDiagnostics.length, 0, 'G5 policy JSON parse failed');
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.map((property) => property.name?.text);
      assert.equal(new Set(keys).size, keys.length, 'G5 duplicate JSON fields forbidden');
    }
    node.forEachChild(visit);
  };
  visit(json);
  return validateFunctionPolicy(JSON.parse(content), now);
}

export function functionLengthViolations(functions, exemptions) {
  const out = [];
  const claimed = new Set();
  for (const entry of exemptions) {
    const matches = functions.filter((fn) => fn.path === entry.path && fn.symbol === entry.symbol);
    if (matches.length !== 1) {
      out.push({
        rule: 'G5',
        path: entry.path,
        symbol: entry.symbol,
        problem: `exemption must resolve once, found ${matches.length}`,
        whitelisted: false,
      });
      continue;
    }
    const fn = matches[0];
    claimed.add(fn);
    const problem =
      fn.lines <= MAX_FUNCTION_LINES
        ? 'function is now within 200 lines; remove the stale exemption before future growth'
        : fn.lines > entry.maxLines
          ? 'function grew beyond exact baseline cap'
          : undefined;
    out.push({
      ...fn,
      rule: 'G5',
      whitelisted: problem === undefined,
      maxLines: entry.maxLines,
      reason: entry.reason,
      due: `${entry.dueBatch}; ${entry.until} inclusive Asia/Singapore`,
      problem,
    });
  }
  for (const fn of functions)
    if (fn.lines > MAX_FUNCTION_LINES && !claimed.has(fn))
      out.push({
        ...fn,
        rule: 'G5',
        whitelisted: false,
        problem: 'complete function exceeds 200 lines without an exact exemption',
      });
  return out;
}

export function scanFunctionLengths(root = process.cwd(), now = Date.now()) {
  try {
    const files = productionSources(root);
    const functions = files.flatMap((path) =>
      completeFunctions(path, readFileSync(join(root, path), 'utf8')),
    );
    const exemptions = loadPolicy(root, now);
    return { files, functions, violations: functionLengthViolations(functions, exemptions) };
  } catch (error) {
    return {
      files: [],
      functions: [],
      violations: [
        { rule: 'G5', path: FUNCTION_POLICY, whitelisted: false, problem: error.message },
      ],
    };
  }
}
