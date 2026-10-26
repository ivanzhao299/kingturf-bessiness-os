import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const parse = (path: string) =>
  ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
const old = parse('./fixtures/app-batch4-f3.ts.fixture');
function findAll(root: ts.Node, predicate: (node: ts.Node) => boolean) {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}
function tokens(fragment: string) {
  const file = ts.createSourceFile(
    'proof.ts',
    'async function proof(){' + fragment + '}',
    ts.ScriptTarget.Latest,
    true,
  );
  const result: string[] = [];
  const visit = (node: ts.Node) => {
    const children = node.getChildren(file);
    if (children.length) children.forEach(visit);
    else if (node.getText(file)) result.push(node.getText(file));
  };
  visit(file);
  return result.filter((value, index) => !(value === ',' && result[index + 1] === ')'));
}
function expand(file: ts.SourceFile, symbol: string): string {
  const functions = new Map(
    file.statements.filter(ts.isFunctionDeclaration).map((n) => [n.name?.text, n]),
  );
  const fn = functions.get(symbol);
  if (!fn?.body) throw new Error('Attempt factory missing');
  expect(fn.asteriskToken).toBeDefined();
  expect(findAll(fn, ts.isAwaitExpression)).toHaveLength(0);
  expect(findAll(fn, (n) => ts.isTryStatement(n) && !!n.finallyBlock)).toHaveLength(0);
  const statements = fn.body.statements.filter(
    (n) =>
      !(
        ts.isVariableStatement(n) &&
        n.declarationList.declarations.some(
          (d) => ts.isObjectBindingPattern(d.name) && d.initializer?.getText(file) === 'scope',
        )
      ),
  );
  let body = statements.map((n) => n.getText(file)).join('\n');
  const edits: { start: number; end: number; text: string }[] = [];
  for (const statement of statements)
    for (const n of findAll(
      statement,
      (n) => ts.isExpressionStatement(n) && ts.isYieldExpression(n.expression),
    )) {
      if (!ts.isExpressionStatement(n) || !ts.isYieldExpression(n.expression))
        throw new Error('Invalid yield');
      const yielded = n.expression;
      if (!yielded.expression || !ts.isCallExpression(yielded.expression))
        throw new Error('Attempt must call a typed factory');
      const call = yielded.expression;
      let restored: string;
      if (yielded.asteriskToken) restored = expand(file, call.expression.getText(file));
      else {
        expect(call.expression.getText(file)).toBe('routeReply');
        const pending = call.arguments[0];
        if (!pending) throw new Error('Pending expression missing');
        const mode = call.arguments[1]?.getText(file);
        restored = `const response=await ${pending.getText(file)};if(${mode === "'truthy'" ? 'response' : 'response!==null'})return response;`;
      }
      // Operate on statement text positions through a unique marker, preserving nested block structure.
      const text = n.getText(file);
      const start = body.indexOf(text);
      if (start < 0) throw new Error('Yield not in factory body');
      edits.push({ start, end: start + text.length, text: restored });
    }
  for (const edit of edits.sort((a, b) => b.start - a.start))
    body = body.slice(0, edit.start) + edit.text + body.slice(edit.end);
  return body;
}
describe('dispatch group inverse source preservation against fixed f3', () => {
  it('manufacturing keeps every original predicate, parser, call, continuation and return', () => {
    const original = findAll(
      old,
      (n) => ts.isIfStatement(n) && n.expression.getText(old) === 'dependencies.manufacturing',
    )[0];
    if (!original) throw new Error('Frozen manufacturing block missing');
    expect(
      tokens(expand(parse('../src/routes/dispatch/manufacturing.ts'), 'manufacturingAttempts')),
    ).toEqual(tokens(original.getText(old)));
  });
});
