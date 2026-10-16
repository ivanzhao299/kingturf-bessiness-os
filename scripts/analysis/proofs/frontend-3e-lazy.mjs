import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { routeNestingMetrics } from '../structure-gate.mjs';
const root = process.cwd() + '/';
const old = (p) =>
  execFileSync('git', ['show', 'b210c77:' + p], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
const read = (p) =>
  execFileSync('git', ['show', '580cc72:' + p], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
const parse = (s) => {
  const f = ts.createSourceFile('proof.ts', s, 99, true);
  assert.equal(f.parseDiagnostics.length, 0);
  return f;
};
const encode = (n) => {
  if (ts.isParenthesizedExpression(n)) return encode(n.expression);
  if (
    ts.isBlock(n) &&
    n.parent &&
    ts.isIfStatement(n.parent) &&
    n.parent.thenStatement === n &&
    n.statements.length === 1 &&
    ts.isExpressionStatement(n.statements[0])
  )
    return encode(n.statements[0]);
  const children = [];
  ts.forEachChild(n, (c) => {
    children.push(encode(c));
  });
  return [n.kind, !ts.isSourceFile(n) && typeof n.text === 'string' ? n.text : null, children];
};
for (const [a, b] of [
  ['const a=1;const b=2;', 'const a=1;const b=3;'],
  ['function f(){a();b();}', 'function f(){a();c();}'],
  ['expect(x).toEqual(1);', 'expect(x).toEqual(999);'],
])
  assert.notDeepEqual(encode(parse(a)), encode(parse(b)));
const name = (n) =>
  ts.isVariableStatement(n) ? n.declarationList.declarations[0].name.getText() : n.name?.getText();
const get = (f, key) => f.statements.find((n) => name(n) === key);
const cp = 'apps/web/src/commercial/store/controller.ts';
let text = read(cp)
  .replace('const finish = beginCommercialRead(this);', 'this.loading = true;')
  .replace('const finish = beginCommercialRead(this, false);', 'this.loading = true;')
  .replaceAll('endCommercialRead(this, finish);', 'this.loading = false;')
  .replaceAll(/\n\s*noteCommercialSourceRead\([^;]+;/gu, '')
  .replaceAll(' || acceptsWave?.() === false', '')
  .replace('    acceptsWave?: () => boolean,\n', '');
const dq = get(
  parse(read('apps/web/src/commercial/store/dashboard-query.ts')),
  'commercialDashboardQuery',
);
const year = dq.body.statements[0].getText(),
  query = dq.body.statements[1].expression.getText();
text = text.replace(
  'const query = commercialDashboardQuery();',
  year + '\nconst query = ' + query + ';',
);
const candidate = parse(text),
  klass = get(candidate, 'CommercialController');
const cost = klass.members.find((n) => n.name?.getText() === 'loadCostMatrixPage');
assert.equal(cost.body.statements.length, 2);
assert.ok(ts.isTryStatement(cost.body.statements[1]));
const printer = ts.createPrinter();
const body = cost.body.statements[1].tryBlock;
const start = cost.body.getStart(candidate),
  end = cost.body.getEnd();
text =
  text.slice(0, start) +
  printer.printNode(ts.EmitHint.Unspecified, body, candidate) +
  text.slice(end);
assert.deepEqual(
  encode(get(parse(text), 'CommercialController')),
  encode(get(parse(old(cp)), 'CommercialController')),
  'all controller fields/methods/awaits/default behavior inverse AST',
);
for (const file of ['load-opportunities', 'load-views']) {
  const p = `apps/web/src/commercial/store/${file}.ts`;
  const transformed = read(p).replaceAll(/\n\s*noteCommercialSourceRead\([^;]+;/gu, '');
  const declarations = (f) => f.statements.filter((n) => !ts.isImportDeclaration(n)).map(encode);
  assert.deepEqual(
    declarations(parse(transformed)),
    declarations(parse(old(p))),
    p + ' default inverse',
  );
}
function exportsOf(f) {
  const out = [];
  for (const n of f.statements) {
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause))
      for (const e of n.exportClause.elements)
        out.push([e.name.text, n.isTypeOnly || e.isTypeOnly ? 'type' : 'value']);
    else if (n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      out.push([
        name(n),
        ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n) ? 'type' : 'value',
      ]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
const rp = 'apps/web/src/bootstrap.ts';
assert.deepEqual(exportsOf(parse(read(rp))), exportsOf(parse(old(rp))));
assert.equal(exportsOf(parse(read(rp))).length, 70);
const frame = get(
  parse(read('apps/web/src/commercial/workspace-frame.ts')),
  'createCommercialWorkspaceFrame',
);
const prefix = frame.body.statements
  .slice(1, -1)
  .map((n) => n.getText())
  .join('\n');
let workspace = get(parse(read(rp)), 'commercialWorkspaceStructure')
  .getText()
  .replace('  existingWorkspace?: HTMLElement,\n', '')
  .replace(
    / {2}const existingChildren =[^;]+;\n {2}const \{ workspace, status \} = createCommercialWorkspaceFrame\([\s\S]*?\n {2}\);/u,
    prefix,
  )
  .replace('if (!existingWorkspace) workspace.append(status);', 'workspace.append(status);')
  .replaceAll('(workspace, existingChildren)', '(workspace)')
  .replace('  if (!existingWorkspace) rememberCommercialWorkspace(workspace, controller);\n', '');
assert.deepEqual(
  encode(parse(workspace).statements[0]),
  encode(get(parse(old(rp)), 'commercialWorkspaceStructure')),
  'whole original default workspace function inverse AST',
);
const wr = 'apps/web/src/commercial/workspace-routes.ts';
const routeDefault = read(wr)
  .replaceAll('  existingChildren?: ReadonlySet<Element>,\n', '')
  .replaceAll('    if (existingChildren?.has(child)) continue;\n', '');
assert.deepEqual(
  encode(parse(routeDefault)),
  encode(parse(old(wr))),
  'route assign default inverse AST',
);
const lt = 'apps/web/src/shared/workspace-list-tools.ts';
const listFunction = get(parse(read(lt)), 'installWorkspaceListTools')
  .getText()
  .replace('  options?: { reuseDrawer: boolean },\n', '')
  .replace(
    / {2}const drawer =[\s\S]*?installedDrawers.set\(shell, drawer\);/u,
    'const drawer = createRegisterDrawer(shell);',
  );
assert.deepEqual(
  encode(parse(listFunction).statements[0]),
  encode(get(parse(old(lt)), 'installWorkspaceListTools')),
  'default list installer inverse AST',
);
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
for (const p of execFileSync('git', ['ls-tree', '-r', '--name-only', 'b210c77', 'apps/web/src'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((p) => p.endsWith('.test.ts') && !p.endsWith('/bootstrap.test.ts')))
  assert.equal(read(p), old(p), p + ' prior test bytes');
const files = [
  'commercial/store/dashboard-query.ts',
  'commercial/store/read-owner.ts',
  'commercial/store/route-dependencies.ts',
  'commercial/store/route-read.ts',
  'commercial/store/route-state.ts',
  'commercial/workspace-frame.ts',
  'commercial/route-dom.ts',
  'commercial/route-navigation.ts',
];
for (const file of ['bootstrap.ts', ...files]) {
  const source = read('apps/web/src/' + file),
    f = parse(source);
  let longest = 0;
  const walk = (n) => {
    if (ts.isFunctionLike(n) && n.body)
      longest = Math.max(
        longest,
        f.getLineAndCharacterOfPosition(n.getEnd()).line -
          f.getLineAndCharacterOfPosition(n.getStart(f)).line +
          1,
      );
    ts.forEachChild(n, walk);
  };
  walk(f);
  const split = source.split('\n').length,
    ast = routeNestingMetrics(source).maxDepth;
  assert.ok(split <= 800 && longest <= 200 && ast <= 5, file);
  console.log(JSON.stringify({ file, split, longest, ast }));
}
console.log(
  'DEFAULT_CONTROLLER_AND_LOAD_HELPERS_INVERSE_AST_EQUAL PUBLIC_70 EXPECT_CHAINS_457 ALL_PRIOR_OTHER_TEST_BYTES_EQUAL NEW_RUNTIME_8_CAPS_PASS',
);
