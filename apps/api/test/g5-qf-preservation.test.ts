import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { foundationRoutes, type FoundationRouteContext } from '../src/routes/foundation.js';

// Frozen before the authorized mechanical move; approved future behavior changes require a new baseline.
const baseline = JSON.parse(
  readFileSync(new URL('./fixtures/g5-qf-preservation.json', import.meta.url), 'utf8'),
) as {
  quoteMethod: string;
  quoteValidation: string;
  validators: Record<string, string>;
  routes: string[];
};
function source(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}
function nodes(root: ts.Node, predicate: (node: ts.Node) => boolean) {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}
function digest(text: string) {
  const file = ts.createSourceFile(
    'fragment.ts',
    text.startsWith('public async createQuote') ? 'class Frozen {' + text + '}' : text,
    ts.ScriptTarget.Latest,
    true,
  );
  const tokens: string[] = [];
  const visit = (node: ts.Node) => {
    const children = node.getChildren(file);
    if (children.length) children.forEach(visit);
    else if (node.kind !== ts.SyntaxKind.EndOfFileToken && node.getText(file))
      tokens.push(node.getText(file));
  };
  visit(file);
  return createHash('sha256')
    .update(
      JSON.stringify(
        tokens.filter((token, index) => !(token === ',' && tokens[index + 1] === ')')),
      ),
    )
    .digest('hex');
}

describe('G5 Q/F behavior-preserving extraction against 0751594', () => {
  it('moves only the two original quote policy guards with the original evaluation order', () => {
    const method = nodes(
      source('../src/commercial-repositories.ts'),
      (n) => ts.isMethodDeclaration(n) && n.name.getText() === 'createQuote',
    )[0];
    expect(method).toBeDefined();
    expect(digest(method?.getText() ?? '')).toBe(baseline.quoteMethod);
    const helper = nodes(
      source('../src/quote-policy-validation.ts'),
      (n) => ts.isFunctionDeclaration(n) && n.name?.getText() === 'assertQuotePolicyEvaluation',
    )[0];
    if (!helper || !ts.isFunctionDeclaration(helper)) throw new Error('Quote helper missing');
    expect(digest(helper.body?.statements.map((n) => n.getText()).join('\n') ?? '')).toBe(
      baseline.quoteValidation,
    );
  });
  it('preserves all ten validator bodies and all twenty-one ordered route definitions', () => {
    const file = source('../src/routes/foundation.ts');
    const validators = nodes(
      file,
      (n) =>
        ts.isVariableDeclaration(n) &&
        n.name.getText().startsWith('validate') &&
        !!n.initializer &&
        ts.isArrowFunction(n.initializer),
    );
    expect(
      Object.fromEntries(
        validators.map((n) => {
          if (!ts.isVariableDeclaration(n) || !n.initializer) throw new Error('Validator missing');
          return [n.name.getText(), digest(n.initializer.getText())];
        }),
      ),
    ).toEqual(baseline.validators);
    const calls = nodes(
      file,
      (n) => ts.isCallExpression(n) && n.expression.getText() === 'defineRoute',
    );
    expect(calls.map((n) => digest(n.getText()))).toEqual(baseline.routes);
  });
  it('reads the parsers object once without eagerly reading any parser method', () => {
    let reads = 0;
    const context = {
      get parsers() {
        reads++;
        return new Proxy(
          {},
          {
            get: () => {
              throw new Error('Parser must remain lazy');
            },
          },
        );
      },
    } as unknown as FoundationRouteContext;
    expect(foundationRoutes(context)).toHaveLength(21);
    expect(reads).toBe(1);
  });
  it('returns the original twenty-one routes in canonical method/path order', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const paths = [
      ['GET', '/api/v1/notifications'],
      ['GET', '/api/v1/notifications/unread-count'],
      ['GET', `/api/v1/notifications/${id}`],
      ['PUT', `/api/v1/notifications/${id}/read`],
      ['GET', '/api/v1/notification-preferences'],
      ['PUT', '/api/v1/notification-preferences'],
      ['POST', '/api/v1/internal/notifications'],
      ['POST', '/api/v1/attachments'],
      ['PUT', `/api/v1/attachments/${id}/content`],
      ['POST', `/api/v1/attachments/${id}/bindings`],
      ['DELETE', `/api/v1/attachments/${id}/bindings`],
      ['GET', `/api/v1/attachments/${id}`],
      ['DELETE', `/api/v1/attachments/${id}`],
      ['GET', '/api/v1/business-objects'],
      ['POST', '/api/v1/business-objects'],
      ['POST', `/api/v1/business-objects/${id}/versions`],
      ['POST', `/api/v1/business-objects/${id}/versions/1/publish`],
      ['GET', `/api/v1/business-objects/${id}`],
      ['GET', '/api/v1/operations/events'],
      ['POST', '/api/v1/operations/events/claims'],
      ['POST', `/api/v1/operations/events/${id}/complete`],
    ];
    const routes = foundationRoutes({ parsers: {} } as FoundationRouteContext);
    expect(routes).toHaveLength(paths.length);
    paths.forEach(([method, path], index) => {
      if (!path) throw new Error('Canonical path missing');
      expect(routes[index]?.method).toBe(method);
      expect(routes[index]?.match(path)).not.toBeNull();
    });
  });
});
