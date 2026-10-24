// D1 S3 only. S1's b02ad55 -> 59f9dfa proof remains unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
assert.ok(
  process.argv.includes('--baseline') && process.argv.includes('--target'),
  'Specify --baseline SHA --target SHA|working-tree',
);
const baseline = option('--baseline');
const target = option('--target');
assert.ok(
  !process.argv.includes('--patch'),
  'Patch text output is forbidden; use --apply for in-process mechanical edits',
);
const applying = process.argv.includes('--apply');
assert.match(baseline, /^[a-f0-9]{7,40}$/u);
assert.ok(target === 'working-tree' || /^[a-f0-9]{7,40}$/u.test(target));
assert.ok(!applying || target === 'working-tree', 'Mechanical edits require working-tree');
const header = 'content-security-policy-report-only';
// Independent reviewed oracle, never computed by production policy/helper.
const policy =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const inherited = new Map([
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'SAMEORIGIN'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
]);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4e6 });
const parse = (text) => {
  const source = ts.createSourceFile('oracle.ts', text, ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0);
  return source;
};
const name = (node) => node.name?.text;
function objects(source) {
  const found = [];
  const visit = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      [...inherited].every(([key, value]) =>
        node.properties.some(
          (p) =>
            name(p) === key &&
            ts.isPropertyAssignment(p) &&
            ts.isStringLiteral(p.initializer) &&
            p.initializer.text === value,
        ),
      )
    )
      found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
function encode(node) {
  const children = [];
  ts.forEachChild(node, (child) => {
    children.push(encode(child));
  });
  return [
    node.kind,
    !ts.isSourceFile(node) && typeof node.text === 'string' ? node.text : null,
    children,
  ];
}
for (const [left, right] of [
  ['const a=1;const b=2;', 'const a=1;const b=3;'],
  ['function f(){a();b();}', 'function f(){a();c();}'],
  ['expect(x).toEqual(1);', 'expect(x).toEqual(9);'],
])
  assert.ok(
    JSON.stringify(encode(parse(left))) !== JSON.stringify(encode(parse(right))),
    'AST encoder must traverse later siblings',
  );
const rows = [];
const edits = [];
const files = git('ls-tree', '-r', '--name-only', baseline, '--', 'apps/api/test/')
  .trim()
  .split('\n')
  .filter((path) => path.endsWith('.test.ts'))
  .sort();
for (const path of files) {
  const before = git('show', baseline + ':' + path);
  const source = parse(before);
  const oldObjects = objects(source);
  if (oldObjects.length)
    rows.push({
      path,
      targets: oldObjects.map((node) => ({
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        old: 'S1 three fixed headers',
        new: header,
        authority: 'D1 S3 default Report-Only',
      })),
    });
  const currentText =
    target === 'working-tree' ? readFileSync(path, 'utf8') : git('show', target + ':' + path);
  if (applying) {
    assert.ok(currentText === before, path + ' must equal baseline before patch generation');
    if (!oldObjects.length) continue;
    let after = before;
    for (const node of [...oldObjects].reverse()) {
      assert.ok(
        !node.properties.some((p) => name(p) === header),
        path + ' baseline must not contain CSP',
      );
      const insertion =
        (node.properties.hasTrailingComma ? '' : ',') +
        '\n' +
        JSON.stringify(header) +
        ': ' +
        JSON.stringify(policy) +
        ',\n';
      after = after.slice(0, node.end - 1) + insertion + after.slice(node.end - 1);
    }
    edits.push({ path, after });
    continue;
  }
  const current = parse(currentText);
  const newObjects = objects(current);
  assert.equal(newObjects.length, oldObjects.length, path + ' target count');
  const accepted = new Set(newObjects);
  const restored = ts.transform(current, [
    (context) => {
      const visit = (node) => {
        if (accepted.has(node)) {
          const added = node.properties.filter((p) => name(p) === header);
          assert.equal(added.length, 1, path + ' exactly one CSP field');
          assert.ok(ts.isPropertyAssignment(added[0]) && ts.isStringLiteral(added[0].initializer));
          assert.equal(added[0].initializer.text, policy, path + ' fixed independent policy');
          return ts.factory.updateObjectLiteralExpression(
            node,
            node.properties.filter((p) => name(p) !== header),
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]).transformed[0];
  assert.ok(
    JSON.stringify(encode(restored)) === JSON.stringify(encode(source)),
    path + ' all other AST nodes must remain identical',
  );
}
assert.ok(rows.length > 0);
// Root-only bulk mechanical rewrite; all baseline preconditions checked before any write.
for (const { path, after } of edits) writeFileSync(path, after);
console.log(
  JSON.stringify({
    baseline,
    target,
    checkedFiles: files.length,
    changedFiles: rows.length,
    nodes: rows.reduce((sum, row) => sum + row.targets.length, 0),
    rows,
    applied: applying,
  }),
);
