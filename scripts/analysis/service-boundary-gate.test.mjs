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

for (const name of ['loginRateLimiter', 'unclassifiedLimiter'])
  test(`real CLI: only explicit login limiter infrastructure is excluded (${name})`, () => {
    const output = run({
      'apps/api/src/app.ts':
        base['apps/api/src/app.ts'].replace(
          'b: BRepository',
          `b: BRepository; ${name}?: LoginRateLimiter`,
        ) + "\nimport type { LoginRateLimiter } from './middleware/login-rate-limit.ts';",
      'apps/api/src/middleware/login-rate-limit.ts':
        'export class LoginRateLimiter { async login() { return null; } }',
      'apps/api/src/runtime.ts': route('return defineRoute({ handler: () => a.read() });'),
    });
    if (name !== 'loginRateLimiter') {
      assert.notEqual(output.status, 0);
      assert.match(output.stderr, /Unclassified ApiDependencies port: unclassifiedLimiter/u);
      return;
    }
    assert.equal(output.status, 0, output.stderr);
    assert.deepEqual(output.result.ports, ['a', 'b']);
    assert.deepEqual(output.result.issues, []);
  });

const limiterSource = 'export class LoginRateLimiter { async login() { return null; } }';
for (const [label, specifier, imported, declaration, source] of [
  ['repository renamed', './a-repositories.ts', 'ARepository as Limiter', 'Limiter', limiterSource],
  [
    'same name elsewhere',
    './counterfeit.ts',
    'LoginRateLimiter as Limiter',
    'Limiter',
    limiterSource,
  ],
  [
    'reexport from elsewhere',
    './middleware/login-rate-limit.ts',
    'LoginRateLimiter as Limiter',
    'Limiter',
    "export { LoginRateLimiter } from '../counterfeit.ts';",
  ],
  [
    'wrong class in correct file',
    './middleware/login-rate-limit.ts',
    'OtherLimiter as Limiter',
    'Limiter',
    limiterSource + '\nexport class OtherLimiter {}',
  ],
  [
    'union with repository',
    './middleware/login-rate-limit.ts',
    'LoginRateLimiter as Limiter',
    'Limiter | ARepository',
    limiterSource,
  ],
  [
    'intersection with repository',
    './middleware/login-rate-limit.ts',
    'LoginRateLimiter as Limiter',
    'Limiter & ARepository',
    limiterSource,
  ],
  [
    'legitimate type alias',
    './middleware/login-rate-limit.ts',
    'LoginRateLimiter as Actual',
    'Limiter',
    limiterSource,
  ],
])
  test(`real CLI: limiter classification binds declaration identity (${label})`, () => {
    const output = run({
      'apps/api/src/app.ts':
        base['apps/api/src/app.ts'].replace(
          'b: BRepository',
          `b: BRepository; loginRateLimiter?: ${declaration}`,
        ) +
        `\nimport type { ${imported} } from '${specifier}';` +
        (label === 'legitimate type alias' ? '\ntype Limiter = Actual;' : ''),
      'apps/api/src/middleware/login-rate-limit.ts': source,
      'apps/api/src/counterfeit.ts': limiterSource,
    });
    if (label === 'legitimate type alias') {
      assert.equal(output.status, 0, output.stderr);
      assert.deepEqual(output.result.ports, ['a', 'b']);
      assert.deepEqual(output.result.issues, []);
      return;
    }
    assert.notEqual(output.status, 0);
    assert.match(output.stderr, /Invalid loginRateLimiter infrastructure port/u);
  });

test('real CLI: renaming the only B port to limiter cannot hide cross-repository work', () => {
  const output = run({
    'apps/api/src/app.ts': base['apps/api/src/app.ts'].replace(
      'b: BRepository',
      'loginRateLimiter: BRepository',
    ),
    'apps/api/src/middleware/login-rate-limit.ts': limiterSource,
    'apps/api/src/runtime.ts': `import type { ApiDependencies } from './app.ts';
import { defineRoute } from './routes/types.ts';
export function routes(deps: ApiDependencies) {
  return defineRoute({handler: () => { deps.a.read(); deps.loginRateLimiter.write(); }});
}`,
  });
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /Invalid loginRateLimiter infrastructure port/u);
});

const attemptModule = {
  'apps/api/src/routes/dispatch/context.ts':
    'export function projectedReply<T>(pending:T,project:(value:T)=>unknown){return {pending,project};}',
};
const attempts = (body) => `import type { ApiDependencies } from './app.ts';
import { projectedReply } from './routes/dispatch/context.ts';
type A=ApiDependencies['a'];type B=ApiDependencies['b'];
${body}`;
test('lazy projected units: independent routes and same-port projection pass', () => {
  const out = run({
    ...attemptModule,
    'apps/api/src/runtime.ts': attempts(`
 function* first(a:A){yield projectedReply(a.read(),()=>a.other());}
 function* second(b:B){yield projectedReply(b.write(),value=>value);}
 export function* routes(a:A,b:B){yield* first(a);yield* second(b);}`),
  });
  assert.equal(out.status, 0, JSON.stringify(out));
  assert.equal(out.result.routes, 2);
});
for (const [label, body] of [
  [
    'pending plus projector',
    'export function* routes(a:A,b:B){yield projectedReply(a.read(),()=>b.write());}',
  ],
  [
    'shared prework',
    'export function* routes(a:A,b:B){a.read();yield projectedReply(b.write(),value=>value);}',
  ],
  [
    'bound methods',
    'export function* routes(a:A,b:B){const read=a.read.bind(a);const write=b.write;yield projectedReply(read(),()=>write.call(b));}',
  ],
  [
    'delegated shared work',
    'function* second(b:B){yield projectedReply(b.write(),value=>value);} export function* routes(a:A,b:B){a.read();yield* second(b);}',
  ],
  [
    'delegated shared work plus local branch',
    'function* second(b:B){yield projectedReply(b.write(),value=>value);} export function* routes(a:A,b:B){a.read();if(false)yield projectedReply(a.other(),value=>value);yield* second(b);}',
  ],
  [
    'manual consumer plus shared work',
    'function* second(b:B){yield projectedReply(b.write(),value=>value);} export function routes(a:A,b:B){for(const attempt of second(b)){attempt.project(attempt.pending);}a.read();}',
  ],
])
  test(`lazy projected units: S3 rejects ${label}`, () => {
    const out = run({ ...attemptModule, 'apps/api/src/runtime.ts': attempts(body) });
    assert.equal(out.status, 1, JSON.stringify(out));
    assert.ok(
      out.result.issues.some((i) => i.rule === 'S3' && i.message.includes('a, b')),
      JSON.stringify(out),
    );
  });
test('lazy projected units: transitive projector helpers retain provenance', () => {
  const out = run({
    ...attemptModule,
    'apps/api/src/helper.ts':
      "import type {ApiDependencies} from './app.ts';export function second(b:ApiDependencies['b']){return b.write();}",
    'apps/api/src/runtime.ts':
      "import {second} from './helper.ts';" +
      attempts('export function* routes(a:A,b:B){yield projectedReply(a.read(),()=>second(b));}'),
  });
  assert.equal(out.status, 1, JSON.stringify(out));
  assert.ok(
    out.result.issues.some((i) => i.rule === 'S3'),
    JSON.stringify(out),
  );
});
for (const [label, body] of [
  [
    'async generator',
    'export async function* routes(a:A){yield projectedReply(a.read(),value=>value);}',
  ],
  [
    'async projector',
    'export function* routes(a:A){yield projectedReply(a.read(),async value=>value);}',
  ],
  [
    'eager array',
    'export function* routes(a:A){const attempts=[projectedReply(a.read(),value=>value)];yield* attempts;}',
  ],
  [
    'variable intermediate',
    'export function* routes(a:A){const attempt=projectedReply(a.read(),value=>value);yield attempt;}',
  ],
])
  test(`lazy projected units: S5 rejects ${label}`, () => {
    const out = run({ ...attemptModule, 'apps/api/src/runtime.ts': attempts(body) });
    assert.equal(out.status, 1, JSON.stringify(out));
    assert.ok(
      out.result.issues.some((i) => i.rule === 'S5'),
      JSON.stringify(out),
    );
  });
test('lazy projected units: same-named local builder cannot hide cross-port work', () => {
  const out = run({
    'apps/api/src/runtime.ts': `import type {ApiDependencies} from './app.ts';function projectedReply<T>(pending:T,project:(x:T)=>unknown){return {pending,project};}export function* routes(a:ApiDependencies['a'],b:ApiDependencies['b']){yield projectedReply((a.read(),b.write()),value=>value);}`,
  });
  assert.equal(out.status, 1, JSON.stringify(out));
  assert.ok(
    out.result.issues.some((i) => i.rule === 'S3'),
    JSON.stringify(out),
  );
});

test('lazy projected units: S5 rejects generator projector', () => {
  const out = run({
    ...attemptModule,
    'apps/api/src/runtime.ts': attempts(
      'export function* routes(a:A){yield projectedReply(a.read(),function*(value){yield value;});}',
    ),
  });
  assert.equal(out.status, 1, JSON.stringify(out));
  assert.ok(
    out.result.issues.some((i) => i.rule === 'S5'),
    JSON.stringify(out),
  );
});
