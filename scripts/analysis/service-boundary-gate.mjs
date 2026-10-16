// Separate from structure-gate: this does not repair TD-GATE-003.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const slash = (value) => value.replaceAll('\\', '/');
const repository = (file) =>
  /^apps\/api\/src\/(?:[^/]*-repositories|repositories|website-lead-ingest)\.ts$/u.test(file);
const service = (file) => file.startsWith('apps/api/src/services/');
const key = (node) => `${node.getSourceFile().fileName}:${node.pos}`;
const children = (node, visit) => {
  visit(node);
  node.forEachChild((child) => children(child, visit));
};
const functionNode = (node) => ts.isFunctionLike(node) && !!node.body;
const access = (node) => ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);
const member = (node) =>
  ts.isPropertyAccessExpression(node)
    ? node.name.text
    : ts.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression.text
      : null;

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : /\.ts$/u.test(path) ? [path] : [];
  });
}

export function checkServiceBoundaries(root = process.cwd()) {
  root = resolve(root);
  const sourceRoot = resolve(root, 'apps/api/src');
  const files = filesUnder(sourceRoot);
  const config = ts.readConfigFile(resolve(root, 'apps/api/tsconfig.json'), ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, 'apps/api'));
  const program = ts.createProgram(files, parsed.options);
  const checker = program.getTypeChecker();
  const sources = files.map((file) => program.getSourceFile(file));
  const name = (file) => slash(relative(root, file));
  const issues = [];
  const imports = new Map();
  const report = (rule, node, message) => {
    const source = node.getSourceFile();
    issues.push({
      rule,
      file: name(source.fileName),
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      message,
    });
  };
  const resolvedModule = (specifier, source) =>
    ts.resolveModuleName(specifier, source.fileName, parsed.options, ts.sys).resolvedModule
      ?.resolvedFileName;
  const context = { sources, name, report, resolvedModule, imports, checker, program, sourceRoot };
  const dependencySources = program.getSourceFiles().filter((source) => {
    const file = name(source.fileName);
    return file.startsWith('apps/api/src/') || file.startsWith('packages/');
  });
  const provenance = repositoryOrigins(context);
  checkDependencyEdges({
    ...context,
    sources: dependencySources,
    allowedRepositories: provenance.modules,
  });
  return {
    ...inspectRuntime(context, provenance),
    issues,
    ports: provenance.ports.sort(),
    files: files.length,
  };
}

function checkDependencyEdges({
  sources,
  name,
  report,
  resolvedModule,
  imports,
  allowedRepositories,
}) {
  // Inspect every dependency syntax, including type-only imports/reexports and import types.
  for (const source of sources) {
    const from = name(source.fileName);
    children(source, (node) => {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        specifier = node.argument.literal;
      if (ts.isExternalModuleReference(node)) specifier = node.expression;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText(source) === 'require')
      )
        specifier = node.arguments[0];
      if (!specifier) return;
      if (!ts.isStringLiteralLike(specifier)) {
        if (service(from) || repository(from))
          report(
            'S1',
            node,
            'Non-literal dependency cannot be checked; use a static module specifier.',
          );
        return;
      }
      const target = resolvedModule(specifier.text, source);
      const to = target ? name(target) : null;
      if (!to && specifier.text.startsWith('.'))
        report(
          'S2',
          node,
          'Unresolved local dependency; restore static module resolution before checking reverse service edges.',
        );
      if (to) {
        if (!imports.has(from)) imports.set(from, []);
        imports.get(from).push({ to, node });
      }
      if (service(from) && !(to && (allowedRepositories.has(to) || to.startsWith('packages/')))) {
        report(
          'S1',
          node,
          `Service dependency ${specifier.text} is not a repository or packages module. Move HTTP/runtime dependencies out of services.`,
        );
      }
    });
  }
  function reachesService(from, seen = new Set()) {
    if (service(from)) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (imports.get(from) ?? []).some(({ to }) => reachesService(to, seen));
  }
  for (const [from, edges] of imports)
    if (repository(from)) {
      for (const { to, node } of edges)
        if (reachesService(to))
          report(
            'S2',
            node,
            'Repository must not depend on services, even transitively or through type-only edges.',
          );
    }
}

function repositoryOrigins({ program, sourceRoot, checker, name }) {
  // Map method signature declaration identity to the injected repository port.
  // Pick/NonNullable/indexed access retain these signatures; names/import counts do not.
  const origins = new Map();
  const app = program.getSourceFile(resolve(sourceRoot, 'app.ts'));
  const dependencies = app?.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'ApiDependencies',
  );
  if (!dependencies)
    throw new Error(
      'ApiDependencies type alias is required; do not silently disable repository provenance.',
    );
  const dependencyType = checker.getTypeAtLocation(dependencies);
  const ports = [];
  // Concrete implementation of domain organization/employee/authorization ports.
  const modules = new Set(['apps/api/src/repositories.ts']);
  for (const property of dependencyType.getProperties()) {
    if (['auth', 'readiness', 'release', 'telemetry', 'logger'].includes(property.name)) continue;
    const type = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(property, dependencies),
    );
    // Authentication/readiness/logging are infrastructure, not business repository ports.
    const declarations = type.symbol?.declarations ?? [];
    if (declarations.some((node) => service(name(node.getSourceFile().fileName)))) continue;
    if (
      !declarations.some((node) => repository(name(node.getSourceFile().fileName))) &&
      !/Repository$/u.test(type.aliasSymbol?.name ?? type.symbol?.name ?? '')
    )
      throw new Error(
        `Unclassified ApiDependencies port: ${property.name}. Resolve its repository/service type explicitly.`,
      );
    ports.push(property.name);
    for (const declaration of declarations) {
      const file = name(declaration.getSourceFile().fileName);
      if (repository(file)) modules.add(file);
    }
    for (const method of type.getProperties()) {
      const methodType = checker.getTypeOfSymbolAtLocation(method, dependencies);
      for (const signature of methodType.getCallSignatures()) {
        if (signature.declaration) {
          const id = key(signature.declaration);
          if (!origins.has(id)) origins.set(id, new Set());
          origins.get(id).add(property.name);
        }
      }
    }
  }
  if (!ports.length)
    throw new Error('No repository ports resolved; check TypeScript module resolution.');
  return { origins, dependencies, ports, modules };
}

function boundReceivers(checker, expression, seen = new Set()) {
  if (seen.has(expression)) return [];
  seen.add(expression);
  if (access(expression) && ['call', 'apply'].includes(member(expression)))
    return boundReceivers(checker, expression.expression, seen);
  if (
    ts.isCallExpression(expression) &&
    access(expression.expression) &&
    member(expression.expression) === 'bind'
  )
    return expression.arguments[0] ? [expression.arguments[0]] : [];
  if (ts.isIdentifier(expression))
    return (checker.getSymbolAtLocation(expression)?.declarations ?? []).flatMap((node) =>
      ts.isVariableDeclaration(node) && node.initializer
        ? boundReceivers(checker, node.initializer, seen)
        : [],
    );
  return [];
}

function signatures(checker, expression, seen = new Set()) {
  if (seen.has(expression)) return [];
  seen.add(expression);
  if (access(expression) && ['call', 'apply', 'bind'].includes(member(expression)))
    return signatures(checker, expression.expression, seen);
  if (
    ts.isCallExpression(expression) &&
    access(expression.expression) &&
    member(expression.expression) === 'bind'
  )
    return signatures(checker, expression.expression.expression, seen);
  const result = [...checker.getTypeAtLocation(expression).getCallSignatures()];
  if (ts.isIdentifier(expression)) {
    for (const declaration of checker.getSymbolAtLocation(expression)?.declarations ?? [])
      if (ts.isVariableDeclaration(declaration) && declaration.initializer)
        result.push(...signatures(checker, declaration.initializer, seen));
  }
  return result;
}

function inspectRuntime({ checker, sources, name, report }, { origins, dependencies }) {
  function repositoryPorts(type) {
    if (type.isUnionOrIntersection())
      return new Set(type.types.flatMap((part) => [...repositoryPorts(part)]));
    const methods = [
      type,
      ...type
        .getProperties()
        .map((symbol) => checker.getTypeOfSymbolAtLocation(symbol, dependencies)),
    ];
    return new Set(
      methods.flatMap((method) =>
        method
          .getCallSignatures()
          .flatMap((signature) =>
            signature.declaration ? [...(origins.get(key(signature.declaration)) ?? [])] : [],
          ),
      ),
    );
  }
  const repositoryType = (type) => repositoryPorts(type).size > 0;
  const literalKeys = (type) =>
    type.isUnion() ? type.types.every(literalKeys) : !!(type.flags & ts.TypeFlags.StringLiteral);

  const runtime = sources.filter(
    (source) =>
      !repository(name(source.fileName)) &&
      !service(name(source.fileName)) &&
      name(source.fileName) !== 'apps/api/src/server.ts',
  );
  const groups = new Map();
  const functionGroups = new Map();
  const routeObjects = new Set();
  const legacyBranches = new Set();
  for (const source of runtime)
    children(source, (node) => {
      if (
        ts.isCallExpression(node) &&
        checker.getResolvedSignature(node)?.declaration?.name?.getText() === 'defineRoute' &&
        name(checker.getResolvedSignature(node).declaration.getSourceFile().fileName) ===
          'apps/api/src/routes/types.ts' &&
        ts.isObjectLiteralExpression(node.arguments[0])
      )
        routeObjects.add(node.arguments[0]);
      // Legacy app dispatch only: nearest request.method/pathname branch is one entry.
      if (name(source.fileName) === 'apps/api/src/app.ts' && ts.isIfStatement(node)) {
        let selector = false;
        children(node.expression, (part) => {
          if (
            ts.isPropertyAccessExpression(part) &&
            part.expression.getText(source) === 'request' &&
            ['method', 'pathname'].includes(part.name.text)
          )
            selector = true;
        });
        if (selector) legacyBranches.add(node);
      }
    });
  function owner(node) {
    let nearest;
    for (let current = node; current; current = current.parent) {
      if (routeObjects.has(current) || legacyBranches.has(current)) return current;
      if (!nearest && functionNode(current)) nearest = current;
    }
    return nearest ?? node.getSourceFile();
  }
  function group(node) {
    const id = key(node);
    if (!groups.has(id)) groups.set(id, { node, repos: new Set(), edges: new Set(), calls: [] });
    return groups.get(id);
  }
  for (const source of runtime)
    children(source, (node) => {
      if (functionNode(node)) functionGroups.set(key(node), group(owner(node)));
    });
  for (const route of routeObjects) {
    for (let enclosing = route.parent; enclosing; enclosing = enclosing.parent) {
      if (routeObjects.has(enclosing)) break;
      if (functionNode(enclosing)) group(route).edges.add(group(owner(enclosing)));
    }
  }
  // Shared pre-branch work also executes for nested legacy entries.
  for (const branch of legacyBranches) group(branch).edges.add(group(owner(branch.parent)));
  const dispatch = [...groups.values()].find(
    ({ node }) =>
      name(node.getSourceFile().fileName) === 'apps/api/src/app.ts' &&
      ts.isMethodDeclaration(node) &&
      node.name.getText() === 'dispatch',
  );
  if (dispatch) for (const route of routeObjects) group(route).edges.add(dispatch);
  for (const source of runtime)
    children(source, (node) => {
      if (
        (ts.isAsExpression(node) ||
          ts.isTypeAssertionExpression(node) ||
          (ts.isVariableDeclaration(node) && node.type && node.initializer)) &&
        repositoryType(checker.getTypeAtLocation(node.expression ?? node.initializer)) &&
        !repositoryType(checker.getTypeAtLocation(node))
      )
        report(
          'S4',
          node,
          'Do not erase repository provenance with structural re-annotation or any/unknown; retain the repository port type.',
        );
      if (
        ts.isElementAccessExpression(node) &&
        !literalKeys(checker.getTypeAtLocation(node.argumentExpression)) &&
        repositoryType(checker.getTypeAtLocation(node.expression))
      )
        report('S4', node, 'Use a statically named repository method, not a dynamic key.');
      if (!ts.isCallExpression(node)) return;
      // bind captures a method; only a later invocation is business execution.
      if (access(node.expression) && member(node.expression) === 'bind') return;
      const current = group(owner(node));
      const receivers = boundReceivers(checker, node.expression);
      if (
        access(node.expression) &&
        ['call', 'apply'].includes(member(node.expression)) &&
        node.arguments[0]
      )
        receivers.push(node.arguments[0]);
      for (const receiver of receivers)
        for (const port of repositoryPorts(checker.getTypeAtLocation(receiver)))
          current.repos.add(port);
      for (const signature of signatures(checker, node.expression)) {
        const declaration = signature.declaration;
        if (!declaration) continue;
        const repositories = origins.get(key(declaration));
        if (repositories) {
          for (const port of repositories) current.repos.add(port);
          current.calls.push({
            line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            ports: [...repositories],
            expression: node.expression.getText(source),
          });
        }
        const callee = functionGroups.get(key(declaration));
        // A route factory constructs callbacks; it does not execute every route.
        let factory = false;
        if (callee)
          children(declaration, (child) => {
            if (routeObjects.has(child)) factory = true;
          });
        if (callee && callee !== current && !factory) current.edges.add(callee);
      }
    });
  function reachable(current, seen = new Set()) {
    if (seen.has(current)) return new Set();
    seen.add(current);
    return new Set([
      ...current.repos,
      ...[...current.edges].flatMap((edge) => [...reachable(edge, seen)]),
    ]);
  }
  const inventory = [];
  for (const current of groups.values()) {
    const repos = [...reachable(current)].sort();
    if (repos.length)
      inventory.push({
        file: name(current.node.getSourceFile().fileName),
        line:
          current.node.getSourceFile().getLineAndCharacterOfPosition(current.node.getStart()).line +
          1,
        repositories: repos,
        calls: current.calls,
      });
    if (repos.length > 1)
      report(
        'S3',
        current.node,
        `Runtime entry/helper orchestrates ${repos.join(', ')}. Move genuine cross-repository business orchestration into an explicit service.`,
      );
  }
  return {
    inventory,
    runtimeFiles: runtime.length,
    routes: routeObjects.size,
    legacyBranches: legacyBranches.size,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rootIndex = process.argv.indexOf('--root');
  const result = checkServiceBoundaries(
    rootIndex < 0 ? process.cwd() : process.argv[rootIndex + 1],
  );
  if (process.argv.includes('--inventory')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const issue of result.issues)
      console.error(`${issue.rule} ${issue.file}:${issue.line} ${issue.message}`);
    console.log(
      `service-boundary: ${result.files} files, ${result.ports.length} repository ports, ${result.routes} route templates, ${result.issues.length} violations`,
    );
  }
  process.exitCode = result.issues.length ? 1 : 0;
}
