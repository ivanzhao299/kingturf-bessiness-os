import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';

function declarations(path: string, exportedOnly: boolean) {
  const text = readFileSync(new URL(path, import.meta.url), 'utf8');
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found = new Map<string, string[]>();
  const tokens = (node: ts.Node) => {
    const result: string[] = [];
    const visit = (current: ts.Node) => {
      const children = current.getChildren(file);
      if (children.length) children.forEach(visit);
      else if (current.getText(file)) result.push(current.getText(file));
    };
    visit(node);
    return result.filter((token, index) => !(token === ',' && result[index + 1] === ')'));
  };
  for (const node of file.statements) {
    if (
      exportedOnly &&
      (!ts.canHaveModifiers(node) ||
        !ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    )
      continue;
    if (ts.isVariableStatement(node)) {
      expect(node.declarationList.flags & ts.NodeFlags.Const).toBeTruthy();
      for (const declaration of node.declarationList.declarations)
        found.set(declaration.name.getText(file), tokens(declaration));
    } else if (ts.isTypeAliasDeclaration(node) && node.name.text.startsWith('Risk'))
      found.set(node.name.text, tokens(node.type));
  }
  return found;
}
it('moves every original pure parser/projection declaration without body, type, literal or order changes', () => {
  const old = declarations('./fixtures/app-batch4-f3.ts.fixture', false);
  const current = declarations('../src/app-values.ts', true);
  expect([...current]).toEqual([...old]);
});

it('retains all public HTTP types and the canonical injected repository contract', () => {
  const types = (paths: readonly string[]) => {
    const entries: [string, string][] = [];
    for (const path of paths) {
      const file = ts.createSourceFile(
        path,
        readFileSync(new URL(path, import.meta.url), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const node of file.statements)
        if (
          ts.isTypeAliasDeclaration(node) &&
          (node.name.text === 'Json' || node.name.text.startsWith('Api'))
        )
          entries.push([
            node.name.text,
            ts
              .createPrinter({ removeComments: true })
              .printNode(ts.EmitHint.Unspecified, node.type, file),
          ]);
    }
    return Object.fromEntries(entries);
  };
  expect(types(['../src/app.ts', '../src/api-types.ts'])).toEqual(
    types(['./fixtures/app-batch4-f3.ts.fixture']),
  );
});
