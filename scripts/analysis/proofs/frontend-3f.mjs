import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { routeNestingMetrics } from '../structure-gate.mjs';
const root = process.cwd() + '/';
const old = (p) =>
  execFileSync('git', ['show', '2f9d316:' + p], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
const read = (p) =>
  process.env.FRONTEND_PROOF_REF
    ? execFileSync('git', ['show', process.env.FRONTEND_PROOF_REF + ':' + p], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 4e6,
      })
    : readFileSync(root + p, 'utf8');
const parse = (s) => {
  const f = ts.createSourceFile('proof.ts', s, 99, true);
  assert.equal(f.parseDiagnostics.length, 0);
  return f;
};
const encode = (n) => {
  if (!n) return null;
  if (ts.isParenthesizedExpression(n)) return encode(n.expression);
  const c = [];
  ts.forEachChild(n, (x) => {
    c.push(encode(x));
  });
  return [n.kind, !ts.isSourceFile(n) && typeof n.text === 'string' ? n.text : null, c];
};
for (const [left, right] of [
  ['const a=1; const b=2;', 'const a=1; const b=3;'],
  ['function f(){a();dangerous();}', 'function f(){a();safe();}'],
  ['expect(x).toEqual(1);', 'expect(x).toEqual(999);'],
])
  assert.notDeepEqual(
    encode(parse(left)),
    encode(parse(right)),
    'encoder must visit later siblings and assertion arguments',
  );
const get = (f, key) => f.statements.find((n) => n.name?.getText() === key);
const parserPath =
  /\/(?:response-parser|session-parser|api-response-parser|register-view-parser|document-response-parser)$/u;
const consumerPaths = [
  'entry.ts',
  'crm/shell-frame.ts',
  'shared/commercial-http.ts',
  'shared/crm-http.ts',
  'shared/document-read-service.ts',
  'shared/register-saved-view.ts',
];
let callbackCalls = 0,
  storageCalls = 0;
for (const relative of consumerPaths) {
  const path = 'apps/web/src/' + relative,
    current = parse(read(path)),
    baseline = parse(old(path));
  let oldView;
  const findView = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'view') oldView = n.initializer;
    ts.forEachChild(n, findView);
  };
  if (relative === 'shared/register-saved-view.ts') findView(baseline);
  const restored = ts.transform(current, [
    (ctx) => (node) => {
      const walk = (n) => {
        if (ts.isImportDeclaration(n) && parserPath.test(n.moduleSpecifier.text)) return undefined;
        let next = ts.visitEachChild(n, walk, ctx);
        if (ts.isCallExpression(next) && ts.isIdentifier(next.expression)) {
          const key = next.expression.text;
          if ((key === 'json' || key === 'post') && next.arguments.length === 4) {
            const args = next.arguments.slice(0, 3);
            if (ts.isIdentifier(args[2]) && args[2].text === 'undefined') args.pop();
            callbackCalls++;
            return ts.factory.updateCallExpression(next, next.expression, next.typeArguments, args);
          }
          if (key === 'parseStoredSessionToken') {
            storageCalls++;
            assert.equal(next.arguments.length, 1);
            return next.arguments[0];
          }
          if (key === 'parseSessionExpired' || key === 'parseSidebarCollapsed') {
            storageCalls++;
            return ts.factory.createBinaryExpression(
              next.arguments[0],
              ts.SyntaxKind.EqualsEqualsEqualsToken,
              ts.factory.createStringLiteral(key === 'parseSessionExpired' ? '1' : 'true'),
            );
          }
        }
        if (
          ts.isVariableDeclaration(next) &&
          ts.isIdentifier(next.name) &&
          next.name.text === 'view' &&
          oldView
        )
          next = ts.factory.updateVariableDeclaration(
            next,
            next.name,
            next.exclamationToken,
            next.type,
            oldView,
          );
        if (ts.isArrowFunction(next) && next.parameters.some((p) => p.name.getText() === 'decode'))
          next = ts.factory.updateArrowFunction(
            next,
            next.modifiers,
            next.typeParameters,
            next.parameters.filter((p) => p.name.getText() !== 'decode'),
            next.type,
            next.equalsGreaterThanToken,
            next.body,
          );
        return next;
      };
      return ts.visitNode(node, walk);
    },
  ]).transformed[0];
  assert.deepEqual(
    encode(restored),
    encode(baseline),
    relative + ' all original code/import/order inverse AST',
  );
  console.log('WHOLE_CONSUMER_INVERSE_AST_EQUAL ' + relative);
}
const hp = 'apps/web/src/http.ts',
  before = parse(old(hp)),
  after = parse(read(hp));
const a = get(before, 'json'),
  b = get(after, 'json');
assert.deepEqual(a.parameters.map(encode), b.parameters.slice(0, 3).map(encode));
assert.equal(b.parameters.length, 4);
const at = a.body.statements.find(ts.isTryStatement),
  bt = b.body.statements.find(ts.isTryStatement);
assert.deepEqual(
  a.body.statements.filter((n) => n !== at).map(encode),
  b.body.statements.filter((n) => n !== bt).map(encode),
  'all headers/timer/external abort setup',
);
assert.deepEqual(encode(at.catchClause), encode(bt.catchClause));
assert.deepEqual(encode(at.finallyBlock), encode(bt.finallyBlock));
for (const index of [0, 1, 3])
  assert.deepEqual(
    encode(at.tryBlock.statements[index]),
    encode(bt.tryBlock.statements[index]),
    'fetch/401/credential204 original statement ' + index,
  );
let oldReturn = at.tryBlock.statements[4].expression;
while (ts.isParenthesizedExpression(oldReturn) || ts.isAsExpression(oldReturn))
  oldReturn = oldReturn.expression;
const oldReadExpression = oldReturn.whenFalse;
assert.deepEqual(
  encode(oldReadExpression),
  encode(bt.tryBlock.statements[5].declarationList.declarations[0].initializer),
  'one original success response.json await',
);
const ae = at.tryBlock.statements[2].thenStatement.statements,
  be = bt.tryBlock.statements[2].thenStatement.statements;
assert.deepEqual(encode(ae[1]), encode(be[1]), 'error-body abort check remains in same slot');
const rest = (f) =>
  f.statements
    .filter((n) => !ts.isImportDeclaration(n) && n.name?.getText() !== 'json')
    .map(encode);
assert.deepEqual(rest(before), rest(after), 'all other HTTP declarations unchanged');
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
for (const p of execFileSync('git', ['ls-tree', '-r', '--name-only', '2f9d316', 'apps/web/src'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((p) => p.endsWith('.test.ts') && !p.endsWith('/bootstrap.test.ts')))
  assert.equal(read(p), old(p), p + ' prior test bytes');
assert.equal(
  read('apps/web/src/bootstrap.ts'),
  old('apps/web/src/bootstrap.ts'),
  'root facade bytes unchanged, public70 unchanged',
);
for (const file of [
  'response-parser.ts',
  'session-parser.ts',
  'api-response-parser.ts',
  'register-view-parser.ts',
  'document-response-parser.ts',
]) {
  const p = 'apps/web/src/shared/' + file,
    s = read(p),
    f = parse(s);
  let longest = 0;
  const walk = (n) => {
    if (ts.isFunctionLike(n) && n.body)
      longest = Math.max(
        longest,
        f.getLineAndCharacterOfPosition(n.end).line -
          f.getLineAndCharacterOfPosition(n.getStart(f)).line +
          1,
      );
    ts.forEachChild(n, walk);
  };
  walk(f);
  const metrics = {
    file,
    split: s.split('\n').length,
    longest,
    ast: routeNestingMetrics(s).maxDepth,
  };
  assert.ok(metrics.split <= 800 && longest <= 200 && metrics.ast <= 5, file);
  console.log(JSON.stringify(metrics));
}
console.log(JSON.stringify({ callbackCalls, storageCalls }));
console.log(
  '6_WHOLE_CONSUMER_FILES_INVERSE_EQUAL_HTTP_UNCHANGED_SETUP_FETCH_NOTIFICATIONS_CATCH_FINALLY_EQUAL_ROOT_BYTES_70_PUBLIC_EXPECT457_ALL_PRIOR_OTHER11_TEST_BYTES_EQUAL',
);
