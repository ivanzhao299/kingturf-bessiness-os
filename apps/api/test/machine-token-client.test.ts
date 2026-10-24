import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

it('the existing nonbrowser CLI binds its initial token request to exact JSON token-login', () => {
  const source = readFileSync(
    new URL('../../../scripts/verify_p1_demo.mjs', import.meta.url),
    'utf8',
  );
  const file = ts.createSourceFile(
    'machine-client.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const statements = file.statements.filter(ts.isVariableStatement);
  const declaration = statements
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((node) => node.name.getText(file) === 'response');
  const init = declaration?.initializer;
  const call =
    init && ts.isAwaitExpression(init) && ts.isCallExpression(init.expression)
      ? init.expression
      : undefined;
  expect(call?.expression.getText(file)).toBe('fetch');
  const target = call?.arguments[0];
  expect(
    target !== undefined &&
      ts.isTemplateExpression(target) &&
      target.templateSpans.at(-1)?.literal.text === '/api/v1/auth/token-login',
  ).toBe(true);
  const options = call?.arguments[1];
  const properties =
    options && ts.isObjectLiteralExpression(options)
      ? options.properties.filter(ts.isPropertyAssignment)
      : [];
  const method = properties.find((node) => node.name.getText(file) === 'method')?.initializer;
  expect(method !== undefined && ts.isStringLiteral(method) && method.text === 'POST').toBe(true);
  const headers = properties.find((node) => node.name.getText(file) === 'headers')?.initializer;
  const json =
    headers &&
    ts.isObjectLiteralExpression(headers) &&
    headers.properties.some(
      (node) =>
        ts.isPropertyAssignment(node) &&
        ts.isStringLiteral(node.name) &&
        node.name.text === 'content-type' &&
        ts.isStringLiteral(node.initializer) &&
        node.initializer.text === 'application/json',
    );
  expect(json).toBe(true);
});
