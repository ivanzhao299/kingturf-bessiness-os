// D1 S1: only expand reviewed response-header expectations, never request fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const baseline = 'b02ad55';
const directory = 'apps/api/test/';
const policy = new Map([
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'SAMEORIGIN'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
]);
const parse = (text) => {
  const source = ts.createSourceFile('oracle.ts', text, ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0);
  return source;
};
const key = (node) => node.name?.text;
function expectedHeaders(source) {
  const found = [];
  const visit = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some((p) => key(p) === 'x-correlation-id')
    ) {
      const parent = node.parent;
      const envelope =
        ts.isPropertyAssignment(parent) &&
        key(parent) === 'headers' &&
        ts.isObjectLiteralExpression(parent.parent) &&
        ['statusCode', 'body'].every((name) =>
          parent.parent.properties.some((p) => key(p) === name),
        );
      const direct =
        ts.isCallExpression(parent) &&
        parent.arguments[0] === node &&
        ts.isPropertyAccessExpression(parent.expression) &&
        parent.expression.name.text === 'toEqual' &&
        ts.isCallExpression(parent.expression.expression) &&
        parent.expression.expression.expression.getText(source) === 'expect' &&
        parent.expression.expression.arguments.length === 1 &&
        ts.isPropertyAccessExpression(parent.expression.expression.arguments[0]) &&
        parent.expression.expression.arguments[0].name.text === 'headers';
      if (envelope || direct)
        found.push({ node, kind: envelope ? 'response envelope' : 'direct headers' });
    }
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
  ['expect(x).toEqual(1);', 'expect(x).toEqual(999);'],
])
  assert.notDeepEqual(encode(parse(left)), encode(parse(right)));

const rows = [];
const patches = [];
let count = 0;
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', directory], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((path) => path.endsWith('.test.ts'))
  .sort();
for (const path of files) {
  const file = path.slice(directory.length);
  const oldText = execFileSync('git', ['show', baseline + ':' + path], {
    encoding: 'utf8',
    maxBuffer: 4e6,
  });
  const oldSource = parse(oldText);
  const targets = expectedHeaders(oldSource);
  if (!targets.length) continue;
  for (const { node } of targets) assert.equal(node.properties.length, 1);
  rows.push({
    file,
    targets: targets.map(({ node, kind }) => ({
      line: oldSource.getLineAndCharacterOfPosition(node.getStart(oldSource)).line + 1,
      kind,
    })),
  });
  count += targets.length;
  if (process.argv.includes('--patch')) {
    assert.ok(
      readFileSync(path, 'utf8') === oldText,
      path + ' must still match baseline before editing',
    );
    let text = oldText;
    for (const { node } of [...targets].reverse()) {
      const replacement =
        '{ ' +
        node.properties[0].getText(oldSource) +
        ', ' +
        [...policy]
          .map(([name, value]) => JSON.stringify(name) + ': ' + JSON.stringify(value))
          .join(', ') +
        ' }';
      assert.equal(node.getText(oldSource).includes('\n'), false);
      text = text.slice(0, node.getStart(oldSource)) + replacement + text.slice(node.end);
    }
    const before = oldText.split('\n'),
      after = text.split('\n');
    const changed = before.flatMap((line, index) => (line === after[index] ? [] : [index]));
    const groups = [];
    for (const line of changed) {
      const start = Math.max(0, line - 2),
        end = Math.min(before.length, line + 3);
      const previous = groups.at(-1);
      if (previous && start <= previous.end) previous.end = end;
      else groups.push({ start, end });
    }
    let patch = '*** Begin Patch\n*** Update File: ' + path + '\n';
    for (const { start, end } of groups) {
      patch += '@@\n';
      for (let index = start; index < end; index++)
        patch +=
          before[index] === after[index]
            ? ' ' + before[index] + '\n'
            : '-' + before[index] + '\n+' + after[index] + '\n';
    }
    patches.push(patch + '*** End Patch');
    continue;
  }
  const current = parse(readFileSync(path, 'utf8'));
  const currentTargets = expectedHeaders(current);
  assert.equal(currentTargets.length, targets.length, path + ' expected-node count');
  const accepted = new Set(currentTargets.map(({ node }) => node));
  const restored = ts.transform(current, [
    (context) => {
      const visit = (node) => {
        if (accepted.has(node)) {
          assert.equal(node.properties.length, 4, path + ' exactly three additional header fields');
          for (const [name, value] of policy) {
            const property = node.properties.find((p) => key(p) === name);
            assert.ok(
              property &&
                ts.isPropertyAssignment(property) &&
                ts.isStringLiteral(property.initializer),
            );
            assert.equal(property.initializer.text, value);
          }
          return ts.factory.updateObjectLiteralExpression(
            node,
            node.properties.filter((p) => !policy.has(key(p))),
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]).transformed[0];
  assert.ok(
    JSON.stringify(encode(restored)) === JSON.stringify(encode(oldSource)),
    path + ' every other AST node remains identical',
  );
}
assert.equal(rows.length, 65);
assert.equal(count, 76);
console.log(JSON.stringify({ baseline, files: rows.length, nodes: count, rows, patches }));
