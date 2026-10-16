import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { routeNestingMetrics } from '../structure-gate.mjs';
const root = process.cwd() + '/';
const old = (p) =>
  execFileSync('git', ['show', '382d7f0:' + p], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
const read = (p) =>
  execFileSync('git', ['show', 'c0a549f:' + p], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
const parse = (s) => {
  const f = ts.createSourceFile('proof.ts', s, 99, true);
  assert.equal(f.parseDiagnostics.length, 0);
  return f;
};
const encode = (n) => {
  if (ts.isParenthesizedExpression(n)) return encode(n.expression);
  const c = [];
  ts.forEachChild(n, (x) => {
    c.push(encode(x));
  });
  return [n.kind, !ts.isSourceFile(n) && typeof n.text === 'string' ? n.text : null, c];
};
for (const [a, b] of [
  ['const a=1;const b=2;', 'const a=1;const b=3;'],
  ['function f(){a();b();}', 'function f(){a();c();}'],
  ['expect(x).toEqual(1);', 'expect(x).toEqual(999);'],
])
  assert.notDeepEqual(encode(parse(a)), encode(parse(b)));
const helperPath = 'apps/web/src/shared/business-date.ts';
const helper = parse(read(helperPath));
const bodies = new Map(
  helper.statements.map((n) => {
    const d = n.declarationList.declarations[0];
    return [d.name.text, d.initializer.body];
  }),
);
const expansions = {
  formatBusinessDate: 0,
  formatBusinessDateTime: 0,
  businessHeadingDateFormatter: 0,
};
const files = execFileSync(
  'git',
  ['diff', '--name-only', '382d7f0', 'c0a549f', '--', 'apps/web/src'],
  { cwd: root, encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter((p) => p.endsWith('.ts') && !p.endsWith('.test.ts'));
const consumers = files.filter((p) => p !== helperPath);
assert.equal(consumers.length, 10);
for (const p of consumers) {
  const source = read(p),
    f = parse(source);
  const restored = ts.transform(f, [
    (ctx) => (n) => {
      const walk = (node) => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith('/business-date'))
          return undefined;
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          bodies.has(node.expression.text)
        ) {
          const key = node.expression.text;
          expansions[key]++;
          if (key === 'businessHeadingDateFormatter') {
            assert.equal(node.arguments.length, 0);
            return bodies.get(key);
          }
          assert.equal(node.arguments.length, 1);
          const method = key === 'formatBusinessDate' ? 'toLocaleDateString' : 'toLocaleString';
          return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(node.arguments[0], method),
            undefined,
            [ts.factory.createStringLiteral('zh-CN')],
          );
        }
        return ts.visitEachChild(node, walk, ctx);
      };
      return ts.visitNode(n, walk);
    },
  ]).transformed[0];
  assert.deepEqual(
    encode(restored),
    encode(parse(old(p))),
    p + ' whole file/import/order inverse AST',
  );
  console.log('WHOLE_FILE_INVERSE_AST_EQUAL ' + p);
}
assert.deepEqual(expansions, {
  formatBusinessDate: 5,
  formatBusinessDateTime: 7,
  businessHeadingDateFormatter: 1,
});
function expects(f) {
  const out = [];
  const walk = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'expect') {
      let p = n;
      while (
        p.parent &&
        ((ts.isPropertyAccessExpression(p.parent) && p.parent.expression === p) ||
          (ts.isCallExpression(p.parent) && p.parent.expression === p))
      )
        p = p.parent;
      out.push(encode(p));
    }
    ts.forEachChild(n, walk);
  };
  walk(f);
  return out;
}
const tp = 'apps/web/src/bootstrap.test.ts';
assert.deepEqual(expects(parse(read(tp))), expects(parse(old(tp))));
assert.equal(expects(parse(read(tp))).length, 457);
for (const p of execFileSync('git', ['ls-tree', '-r', '--name-only', '382d7f0', 'apps/web/src'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((p) => p.endsWith('.test.ts') && !p.endsWith('/bootstrap.test.ts')))
  assert.equal(read(p), old(p), p + ' prior tests');
let longest = 0;
const walk = (n) => {
  if (ts.isFunctionLike(n) && n.body)
    longest = Math.max(
      longest,
      helper.getLineAndCharacterOfPosition(n.getEnd()).line -
        helper.getLineAndCharacterOfPosition(n.getStart(helper)).line +
        1,
    );
  ts.forEachChild(n, walk);
};
walk(helper);
console.log(
  JSON.stringify({
    expansions,
    split: read(helperPath).split('\n').length,
    longest,
    ast: routeNestingMetrics(read(helperPath)).maxDepth,
  }),
);
assert.equal(
  read('apps/web/src/bootstrap.ts'),
  old('apps/web/src/bootstrap.ts'),
  'root/public surface unchanged',
);
console.log(
  '13_CALLS_10_WHOLE_FILES_INVERSE_EQUAL ROOT_BYTES_EQUAL_70_PUBLIC_EXPECT_457_PRIOR_11_OTHER_TEST_BYTES_EQUAL',
);
