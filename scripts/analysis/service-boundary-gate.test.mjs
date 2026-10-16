import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = resolve('scripts/analysis/service-boundary-gate.mjs');
const base = {
  'apps/api/src/routes/types.ts': 'export function defineRoute<T>(route: T): T { return route; }',
  'apps/api/tsconfig.json':
    '{"compilerOptions":{"target":"ES2023","module":"NodeNext","moduleResolution":"NodeNext","allowImportingTsExtensions":true,"strict":true}}',
  'apps/api/src/a-repositories.ts':
    'export class ARepository { read() { return 1; } other() { return 2; } }',
  'apps/api/src/b-repositories.ts': 'export class BRepository { write() { return 3; } }',
  'apps/api/src/app.ts': `import type { ARepository } from './a-repositories.ts';
import type { BRepository } from './b-repositories.ts';
export type ApiDependencies = Readonly<{ a: ARepository; b: BRepository }>;
`,
};
function run(extra) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-service-gate-'));
  try {
    for (const [path, content] of Object.entries({ ...base, ...extra })) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    const result = spawnSync(process.execPath, [gate, '--root', root, '--inventory'], {
      encoding: 'utf8',
    });
    assert.equal(result.signal, null, result.stderr);
    return {
      status: result.status,
      result: result.stdout ? JSON.parse(result.stdout) : null,
      stderr: result.stderr,
    };
  } finally {
    // Only the exact fresh disposable fixture directory is removed.
    rmSync(root, { recursive: true, force: true });
  }
}
const route = (body) => `import type { ApiDependencies } from './app.ts';
import { defineRoute } from './routes/types.ts';
type A = Pick<NonNullable<ApiDependencies['a']>, 'read' | 'other'>;
type B = NonNullable<ApiDependencies['b']>;
export function routes(a: A, b: B) { ${body} }
`;

test('real CLI: independent routes, same-repository calls, unused container ports pass', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'return [defineRoute({ handler: () => { a.read(); a.other(); } }), defineRoute({ handler: () => b.write() })];',
    ),
  });
  assert.equal(output.status, 0, output.stderr);
  assert.equal(output.result.routes, 2);
  assert.equal(output.result.issues.length, 0);
});

for (const [label, body] of [
  ['direct calls', 'return defineRoute({ handler: () => { a.read(); b.write(); } });'],
  [
    'destructured alias and call',
    'const { read } = a; const write = b.write; return defineRoute({ handler: () => { read.call(a); write.call(b); } });',
  ],
  [
    'apply and bind',
    'const read = a.read.bind(a); return defineRoute({ handler: () => { read(); b.write.apply(b, []); } });',
  ],
  [
    'late receiver and literal key',
    'const root = () => a; return defineRoute({ handler: () => { root()["read"](); b.write(); } });',
  ],
  [
    'local cross-closure helper',
    'function first() { a.read(); } function second() { first(); b.write(); } return defineRoute({ handler: () => second() });',
  ],
  [
    'validate plus handler',
    'return defineRoute({ validate: () => a.read(), handler: () => b.write() });',
  ],
])
  test(`real CLI: S3 rejects ${label}`, () => {
    const output = run({ 'apps/api/src/runtime.ts': route(body) });
    assert.equal(output.status, 1, JSON.stringify(output));
    assert.ok(
      output.result.issues.some((issue) => issue.rule === 'S3' && issue.message.includes('a, b')),
      JSON.stringify(output),
    );
  });

test('real CLI: transitive helper in another module is attributed to caller', () => {
  const output = run({
    'apps/api/src/helper.ts':
      "import type { ApiDependencies } from './app.ts'; export function first(a: ApiDependencies['a']) { a.read(); }",
    'apps/api/src/runtime.ts':
      "import { first } from './helper.ts';\n" +
      route('return defineRoute({ handler: () => { first(a); b.write(); } });'),
  });
  assert.equal(output.status, 1);
  assert.ok(
    output.result.issues.some((issue) => issue.rule === 'S3' && issue.file.endsWith('runtime.ts')),
  );
});

for (const dependency of [
  "import type { ApiDependencies } from '../app.ts';",
  "export type { ApiDependencies } from '../app.ts';",
  "type D = import('../app.ts').ApiDependencies;",
  "const runtime = import('../app.ts');",
  "const runtime = require('../app.ts');",
  "import runtime = require('../app.ts');",
  'const runtime = import(process.env.RUNTIME);',
  "import type { IncomingMessage } from 'node:http';",
])
  test(`real CLI: S1 rejects ${dependency}`, () => {
    const output = run({ 'apps/api/src/services/invalid.ts': dependency });
    assert.equal(output.status, 1);
    assert.ok(output.result.issues.some((issue) => issue.rule === 'S1'));
  });

test('real CLI: S2 rejects reverse type edge through a barrel', () => {
  const output = run({
    'apps/api/src/a-repositories.ts':
      base['apps/api/src/a-repositories.ts'] + "\nimport type { Service } from './barrel.ts';",
    'apps/api/src/barrel.ts': "export type { Service } from './services/valid.ts';",
    'apps/api/src/services/valid.ts': 'export type Service = { run(): void };',
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S2'));
});

test('real CLI: valid service repository/packages dependencies pass', () => {
  const output = run({
    'packages/types/src/index.ts': 'export type Id = string;',
    'apps/api/src/services/valid.ts':
      "import type { ARepository } from '../a-repositories.ts'; import type { Id } from '../../../../packages/types/src/index.ts'; export function work(a: ARepository, id: Id) { return [a.read(), id]; }",
  });
  assert.equal(output.status, 0, JSON.stringify(output));
});

for (const body of [
  'return defineRoute({ handler: () => (a as unknown as { read(): number }).read() });',
  'return defineRoute({ handler: () => { const key: string = String(1); a[key](); } });',
])
  test('real CLI: S4 rejects erased/dynamic repository provenance', () => {
    const output = run({ 'apps/api/src/runtime.ts': route(body) });
    assert.equal(output.status, 1);
    assert.ok(output.result.issues.some((issue) => issue.rule === 'S4'));
  });

test('real CLI: S2 rejects reverse dependency through packages', () => {
  const output = run({
    'apps/api/src/a-repositories.ts':
      base['apps/api/src/a-repositories.ts'] +
      "\nimport type { Service } from '../../../packages/types/barrel.ts';",
    'packages/types/barrel.ts':
      "export type { Service } from '../../apps/api/src/services/valid.ts';",
    'apps/api/src/services/valid.ts': 'export type Service = { run(): void };',
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S2'));
});

test('real CLI: alias defineRoute keeps validate/handler together', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'const make = defineRoute; return make({ validate: () => a.read(), handler: () => b.write() });',
    ),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
});

test('real CLI: legacy nested branch includes shared parent work', () => {
  const output = run({
    'apps/api/src/app.ts':
      base['apps/api/src/app.ts'] +
      `
export function run(deps: ApiDependencies, request: {method: string; pathname: string}) {
  if (request.method === 'POST') {
    deps.a.read();
    if (request.pathname === '/work') deps.b.write();
  }
}`,
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
});

test('real CLI: S4 rejects explicitly erased variable type', () => {
  const output = run({
    'apps/api/src/runtime.ts': route('const erased: unknown = a; return erased;'),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S4'));
});

test('real CLI: structural repository provenance erasure fails', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'const hidden: { read(): number } = a; return defineRoute({ handler: () => { hidden.read(); b.write(); } });',
    ),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S4'));
});

test('real CLI: separate bound methods are not executed by factory', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'const read = a.read.bind(a); const write = b.write.bind(b); return [defineRoute({ handler: () => read() }), defineRoute({ handler: () => write() })];',
    ),
  });
  assert.equal(output.status, 0, JSON.stringify(output));
});

for (const expression of ['a.read.call(b)', 'a.read.apply(b, [])', 'a.read.bind(b)()'])
  test(`real CLI: receiver provenance ${expression}`, () => {
    const output = run({
      'apps/api/src/runtime.ts': route(`return defineRoute({ handler: () => ${expression} });`),
    });
    assert.equal(output.status, 1, JSON.stringify(output));
    assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
  });

test('real CLI: repository-looking filename outside repository layer is denied', () => {
  const output = run({
    'apps/api/src/routes/fake-repositories.ts': 'export type Fake = string;',
    'apps/api/src/services/invalid.ts':
      "import type { Fake } from '../routes/fake-repositories.ts';",
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S1'));
});

test('real CLI: unresolved relative repository edge fails', () => {
  const output = run({
    'apps/api/src/a-repositories.ts':
      base['apps/api/src/a-repositories.ts'] + "\nimport type { Missing } from './missing.ts';",
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S2'));
});

test('real CLI: unregistered root repository-looking module is denied', () => {
  const output = run({
    'apps/api/src/fake-repositories.ts': 'export type Fake = string;',
    'apps/api/src/services/invalid.ts': "import type { Fake } from '../fake-repositories.ts';",
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S1'));
});

test('real CLI: route includes shared factory execution, not only handler', () => {
  const output = run({
    'apps/api/src/runtime.ts': route('a.read(); return defineRoute({ handler: () => b.write() });'),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
});

test('real CLI: bound receiver provenance survives subsequent call', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'const read = a.read.bind(b); return defineRoute({ handler: () => read.call(a) });',
    ),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
});

test('real CLI: unrelated same-named function is not a route declaration', () => {
  const output = run({
    'apps/api/src/runtime.ts': `import type { ApiDependencies } from './app.ts';
function defineRoute<T>(value: T): T { return value; }
export function unrelated(a: ApiDependencies['a'], b: ApiDependencies['b']) {
  return defineRoute({ validate: () => a.read(), handler: () => b.write() });
}`,
  });
  assert.equal(output.status, 0, JSON.stringify(output));
  assert.equal(output.result.routes, 0);
});

test('real CLI: nested map route inherits outer factory shared execution', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'a.read(); return [1].map(() => [1].map(() => defineRoute({ handler: () => b.write() })));',
    ),
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S3'));
});

test('real CLI: nested independent routes with bound captures pass', () => {
  const output = run({
    'apps/api/src/runtime.ts': route(
      'const read = a.read.bind(a); const write = b.write.bind(b); return [1].map(() => [defineRoute({ handler: () => read() }), defineRoute({ handler: () => write() })]);',
    ),
  });
  assert.equal(output.status, 0, JSON.stringify(output));
});

test('real CLI: unresolved local edge in a package barrel fails', () => {
  const output = run({
    'apps/api/src/a-repositories.ts':
      base['apps/api/src/a-repositories.ts'] +
      "\nimport type { Missing } from '../../../packages/types/barrel.ts';",
    'packages/types/barrel.ts': "export type { Missing } from './missing.ts';",
  });
  assert.equal(output.status, 1);
  assert.ok(output.result.issues.some((issue) => issue.rule === 'S2'));
});

test('real CLI: unresolved repository dependency fails closed', () => {
  const output = run({
    'apps/api/src/app.ts':
      'type Missing = import("./missing.ts").Repository; export type ApiDependencies = { lost: Missing };',
  });
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /Unclassified ApiDependencies port/u);
});
