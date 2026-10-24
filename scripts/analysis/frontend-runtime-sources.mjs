import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const excluded = (path) =>
  /(?:^|[/\\])(?:__tests__|tests?|specs?|__fixtures__|fixtures?|dist|build|coverage|__generated__|generated|node_modules)(?:[/\\]|$)/u.test(
    path,
  ) || /(?:\.d|\.test|\.spec|\.generated)(?:\.(?:ts|js))?$/u.test(path);
const assetExtensions = new Set([
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.avif',
]);

function runtimeSpecifiers(source, path) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length) throw new Error(`Cannot parse frontend source: ${path}`);
  const specifiers = new Set();
  let nonLiteralDynamicImports = 0;
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyNamedTypes =
        !clause?.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((item) => item.isTypeOnly);
      if (!clause?.isTypeOnly && !onlyNamedTypes) specifiers.add(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) {
      const bindings = node.exportClause;
      const onlyNamedTypes =
        bindings &&
        ts.isNamedExports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((item) => item.isTypeOnly);
      if (!onlyNamedTypes) specifiers.add(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const target = node.arguments[0];
      if (target && (ts.isStringLiteral(target) || ts.isNoSubstitutionTemplateLiteral(target)))
        specifiers.add(target.text);
      else nonLiteralDynamicImports += 1;
    }
    node.forEachChild(visit);
  };
  visit(tree);
  return { specifiers: [...specifiers].sort(), nonLiteralDynamicImports };
}

// This is a static syntax dependency graph, not proof of runtime call reachability.
export async function collectFrontendRuntimeSources(entry, root) {
  const boundary = await realpath(root);
  const sources = new Map();
  let nonLiteralDynamicImports = 0;
  const inside = (path) => {
    const offset = relative(boundary, path);
    if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset))
      throw new Error(`Frontend source escapes boundary: ${path}`);
  };
  const resolveCode = async (target) => {
    inside(target);
    const extension = extname(target);
    // Deliberately fail on competing code/package candidates, rather than emulate Vite.
    const nonTsExtensions = ['.mjs', '.js', '.mts', '.jsx', '.tsx', '.json', '.cjs'];
    const ambiguousCandidates =
      extension === '.js'
        ? [target]
        : extension === ''
          ? [
              target,
              ...nonTsExtensions.map((suffix) => target + suffix),
              ...nonTsExtensions.map((suffix) => resolve(target, 'index' + suffix)),
              resolve(target, 'package.json'),
            ]
          : [];
    for (const candidate of ambiguousCandidates) {
      try {
        if ((await stat(candidate)).isFile())
          throw new Error(`Ambiguous non-TS frontend resolution: ${candidate}`);
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
    }
    const candidates =
      extension === '.js'
        ? [target.slice(0, -3) + '.ts']
        : extension === '.ts'
          ? [target]
          : extension === ''
            ? [target + '.ts', resolve(target, 'index.ts')]
            : [];
    if (!candidates.length) throw new Error(`Unsupported frontend code dependency: ${target}`);
    for (const candidate of candidates) {
      try {
        if (!(await stat(candidate)).isFile()) continue;
        const actual = await realpath(candidate);
        inside(actual);
        if (extname(actual) !== '.ts') throw new Error(`Non-TS frontend implementation: ${actual}`);
        return actual;
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
    }
    throw new Error(`Missing frontend code dependency: ${target}`);
  };
  const visit = async (path) => {
    inside(path);
    if (excluded(relative(boundary, path)) || sources.has(path)) return;
    const source = await readFile(path, 'utf8');
    if (!source.trim()) throw new Error(`Empty frontend implementation: ${path}`);
    const dependencies = runtimeSpecifiers(source, path);
    sources.set(path, source);
    nonLiteralDynamicImports += dependencies.nonLiteralDynamicImports;
    for (const specifier of dependencies.specifiers) {
      if (!specifier.startsWith('.') && !isAbsolute(specifier)) continue;
      const clean = specifier.split(/[?#]/u)[0];
      const target = resolve(dirname(path), clean);
      inside(target);
      if (excluded(relative(boundary, target))) continue;
      if (assetExtensions.has(extname(clean))) continue;
      if (clean !== specifier) throw new Error(`Unsupported frontend code query: ${specifier}`);
      const actual = await resolveCode(target);
      await visit(actual);
    }
  };
  const actualEntry = await resolveCode(resolve(entry));
  if (excluded(relative(boundary, actualEntry))) throw new Error('Frontend entry is excluded');
  await visit(actualEntry);
  return {
    sources: [...sources]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([path, source]) => ({ path, source })),
    nonLiteralDynamicImports,
  };
}
