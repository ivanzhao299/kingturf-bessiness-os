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
  const serialize = (node: ts.Node): unknown => {
    if (ts.isParenthesizedTypeNode(node)) return serialize(node.type);
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node))
      return [node.kind, node.types.map(serialize)];
    if (
      node.kind === ts.SyntaxKind.CommaToken &&
      file.text.slice(node.end).trimStart().startsWith(')')
    )
      return undefined;
    const children = node.getChildren(file);
    return children.length
      ? [node.kind, children.map(serialize).filter((value) => value !== undefined)]
      : [node.kind, node.getText(file)];
  };
  return serialize(file);
}
function firstDifference(a: unknown, b: unknown, path = ''): unknown {
  if (Object.is(a, b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    const left = a as unknown[],
      right = b as unknown[];
    if (left.length !== right.length)
      return { path, actualLength: left.length, expectedLength: right.length };
    for (let i = 0; i < left.length; i++) {
      const difference = firstDifference(left[i], right[i], path + '/' + String(i));
      if (difference) return difference;
    }
    return null;
  }
  return { path, actual: a, expected: b };
}
function expand(file: ts.SourceFile, symbol: string, bindings: string[]): string {
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
  let body = statements
    .map((n) => n.getText(file))
    .join('\n')
    .replace(/dependencyPresent\(scope, ['"]([A-Za-z]+)['"]\)/gu, 'dependencies.$1');
  const edits: { start: number; end: number; text: string }[] = [];
  let cursor = 0;
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
      if (yielded.asteriskToken) {
        const child = functions.get(call.expression.getText(file));
        if (!child) throw new Error('Delegated attempt missing');
        expect(call.arguments.map((n) => n.getText(file))).toEqual(
          child.parameters.map((n) => n.name.getText(file)),
        );
        restored = expand(file, call.expression.getText(file), bindings);
      } else if (call.expression.getText(file) === 'projectedReply') {
        const pending = call.arguments[0],
          projector = call.arguments[1];
        if (
          !pending ||
          !projector ||
          !ts.isArrowFunction(projector) ||
          !ts.isBlock(projector.body) ||
          projector.parameters.length !== 1
        )
          throw new Error('Projection shape changed');
        const parameter = projector.parameters[0];
        if (!parameter) throw new Error('Projection parameter missing');
        const name = parameter.name.getText(file);
        const tail = projector.body.statements.map((n) => n.getText(file)).join('\n');
        if (name === 'resolvedBody') {
          // Only the two reviewed literal-status/body await returns use this exact form.
          expect(projector.body.statements).toHaveLength(1);
          expect(
            findAll(projector.body, (n) => ts.isIdentifier(n) && n.text === name),
          ).toHaveLength(1);
          restored = tail.replace(/\bresolvedBody\b/u, 'await ' + pending.getText(file));
        } else {
          expect(bindings.shift()).toBe(name);
          restored = 'const ' + name + '=await ' + pending.getText(file) + ';' + tail;
        }
      } else if (call.expression.getText(file) === 'directReply') {
        const value = call.arguments[0];
        if (!value) throw new Error('Immediate response missing');
        restored = 'return ' + value.getText(file) + ';';
      } else {
        expect(call.expression.getText(file)).toBe('routeReply');
        const pending = call.arguments[0];
        if (!pending) throw new Error('Pending expression missing');
        const mode = call.arguments[1]?.getText(file);
        const binding = bindings.shift();
        if (!binding) throw new Error('Original binding missing');
        restored = `const ${binding}=await ${pending.getText(file)};if(${mode === "'truthy'" ? binding : binding + '!==null'})return ${binding};`;
      }
      // Operate on statement text positions through a unique marker, preserving nested block structure.
      const immediateBlock =
        ts.isCallExpression(call) &&
        call.expression.getText(file) === 'directReply' &&
        ts.isBlock(n.parent) &&
        n.parent.statements.length === 2 &&
        !!n.parent.statements[1] &&
        ts.isReturnStatement(n.parent.statements[1]) &&
        !n.parent.statements[1].expression
          ? n.parent
          : undefined;
      const text = (immediateBlock ?? n).getText(file);
      const start = body.indexOf(text, cursor);
      cursor = start + text.length;
      if (start < 0) throw new Error('Yield not in factory body');
      edits.push({ start, end: start + text.length, text: restored });
    }
  for (const edit of edits.sort((a, b) => b.start - a.start))
    body = body.slice(0, edit.start) + edit.text + body.slice(edit.end);
  return body;
}
const groups = JSON.parse(
  readFileSync(new URL('./fixtures/app-dispatch-groups.json', import.meta.url), 'utf8'),
) as {
  name: string;
  symbol: string;
  file: string;
  property?: string;
  baselineSpan?: [number, number];
}[];
describe('dispatch group inverse source preservation against fixed f3', () => {
  for (const group of groups)
    it(
      group.name + ' keeps every original predicate, parser, call, continuation and return',
      () => {
        const oldBlock = findAll(old, ts.isTryStatement).sort(
          (a, b) => b.end - b.pos - (a.end - a.pos),
        )[0];
        if (!oldBlock || !ts.isTryStatement(oldBlock)) throw new Error('Frozen dispatch missing');
        const originalRows = group.baselineSpan
          ? [...oldBlock.tryBlock.statements].slice(...group.baselineSpan)
          : undefined;
        const original = originalRows
          ? undefined
          : findAll(
              old,
              (n) =>
                ts.isIfStatement(n) &&
                n.expression.getText(old) === 'dependencies.' + String(group.property),
            )[0];
        if (!originalRows && !original) throw new Error('Frozen group missing');
        const nodes = originalRows ?? (original ? [original] : []);
        const originalText = nodes.map((n) => n.getText(old)).join('\n');
        const bindings = nodes
          .flatMap((node) =>
            findAll(
              node,
              (n) =>
                ts.isVariableDeclaration(n) &&
                !!n.initializer &&
                ts.isAwaitExpression(n.initializer),
            ),
          )
          .map((n) => {
            if (!ts.isVariableDeclaration(n)) throw new Error('Binding missing');
            return n.name.getText(old);
          });
        expect(
          firstDifference(
            tokens(expand(parse('../src/routes/dispatch/' + group.file), group.symbol, bindings)),
            tokens(originalText),
          ),
        ).toBeNull();
        expect(bindings).toHaveLength(0);
      },
    );
});

it('proof normalization preserves value grouping, type hierarchy and array holes', () => {
  expect(tokens('type X=(string);')).toEqual(tokens('type X=string;'));
  expect(tokens("type X=('a'|'b')[];")).not.toEqual(tokens("type X='a'|'b'[];"));
  expect(tokens('const x=a*(b+c);')).not.toEqual(tokens('const x=a*b+c;'));
  expect(tokens("const x=['a',,];")).not.toEqual(tokens("const x=['a',];"));
});

function declaration(file: ts.SourceFile, name: string) {
  const fn = file.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!fn || !ts.isFunctionDeclaration(fn) || !fn.body)
    throw new Error('Function missing: ' + name);
  return fn;
}
it('composition covers every frozen business statement exactly once in original order', () => {
  const frozenTry = findAll(old, ts.isTryStatement).sort(
    (a, b) => b.end - b.pos - (a.end - a.pos),
  )[0];
  if (!frozenTry || !ts.isTryStatement(frozenTry)) throw new Error('Frozen root missing');
  const rows = [...frozenTry.tryBlock.statements];
  const ordered = groups
    .map((g) => {
      const at = rows.findIndex(
        (n) =>
          ts.isIfStatement(n) && n.expression.getText(old) === 'dependencies.' + String(g.property),
      );
      const span: [number, number] = g.baselineSpan ?? [at, at + 1];
      return { ...g, span };
    })
    .sort((a, b) => a.span[0] - b.span[0]);
  expect(
    ordered.flatMap((g) => Array.from({ length: g.span[1] - g.span[0] }, (_x, i) => g.span[0] + i)),
  ).toEqual(Array.from({ length: 114 }, (_x, i) => 20 + i));
  const composition = parse('../src/routes/dispatch/business.ts'),
    fn = declaration(composition, 'businessAttempts');
  expect(fn.asteriskToken).toBeDefined();
  expect(fn.body?.statements.map((n) => n.getText(composition).replaceAll(/\s/gu, ''))).toEqual(
    ordered.map((g) => 'yield*' + g.symbol + '(scope);'),
  );
  for (const g of ordered) {
    const imp = composition.statements.find(
      (n) =>
        ts.isImportDeclaration(n) &&
        ts.isStringLiteral(n.moduleSpecifier) &&
        n.moduleSpecifier.text === './' + g.file,
    );
    if (!imp || !ts.isImportDeclaration(imp)) throw new Error('Group import missing');
    expect(imp.importClause?.namedBindings?.getText(composition).replaceAll(/\s/gu, '')).toBe(
      '{' + g.symbol + '}',
    );
  }
});
it('root authentication, errors, lifecycle, completion and acceptance modes inverse-expand to fixed f3', () => {
  const current = parse('../src/app.ts'),
    fn = declaration(current, 'buildApp'),
    original = declaration(old, 'buildApp');
  const loops = findAll(fn, ts.isForOfStatement);
  expect(loops).toHaveLength(1);
  const loop = loops[0];
  if (!loop) throw new Error('Root loop missing');
  const scaffold = `for (const pending of businessAttempts({request,dependencies,context,correlationId,securedAuthContext,})) {
 if(pending.kind==='immediate')return pending.value;
 if(pending.accept==='always')return pending.project(await pending.pending);
 const response=pending.project(await pending.pending);
 if(pending.accept==='truthy'){if(response)return response;}else if(response!==null)return response;
 }`;
  expect(firstDifference(tokens(loop.getText(current)), tokens(scaffold))).toBeNull();
  const oldTry = findAll(original, ts.isTryStatement)[0];
  if (!oldTry || !ts.isTryStatement(oldTry)) throw new Error('Original try missing');
  const middle = [...oldTry.tryBlock.statements]
    .slice(20, 134)
    .map((n) => n.getText(old))
    .join('\n');
  const tail = fn.body?.statements.at(-1);
  if (!tail) throw new Error('Completion invocation missing');
  expect(
    firstDifference(
      tokens(tail.getText(current)),
      tokens(
        'return completeApplication(application,dependencies,security,telemetry,browserSession);',
      ),
    ),
  ).toBeNull();
  const completion = parse('../src/application-completion.ts'),
    complete = declaration(completion, 'completeApplication');
  expect(complete.parameters.map((p) => p.name.getText(completion))).toEqual([
    'application',
    'dependencies',
    'security',
    'telemetry',
    'browserSession',
  ]);
  const completionBody = complete.body?.statements.map((n) => n.getText(completion)).join('\n');
  if (!completionBody) throw new Error('Completion missing');
  const expanded = fn.body
    ?.getText(current)
    .replace(loop.getText(current), middle)
    .replace(tail.getText(current), completionBody);
  expect(
    firstDifference(tokens(expanded ?? ''), tokens(original.body?.getText(old) ?? '')),
  ).toBeNull();
  expect(fn.parameters.map((p) => tokens(p.getText(current)))).toEqual(
    original.parameters.map((p) => tokens(p.getText(old))),
  );
});
