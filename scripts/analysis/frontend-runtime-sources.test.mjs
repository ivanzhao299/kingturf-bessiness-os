import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { collectFrontendRuntimeSources } from './frontend-runtime-sources.mjs';

async function fixture(files, check) {
  const directory = await mkdtemp(join(tmpdir(), 'kingturf-frontend-sources-'));
  const root = join(directory, 'src');
  try {
    await mkdir(root);
    for (const [path, content] of Object.entries(files)) {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    return await check(root, directory);
  } finally {
    // Exact directory freshly created by this test, never a repository fixture.
    await rm(directory, { recursive: true, force: true });
  }
}

test('runtime graph follows static imports, re-exports, dynamic literals, js-to-ts and index; cycles deduplicate and sort', async () => {
  await fixture(
    {
      'src/bootstrap.ts':
        "import './z.js'; export * from './folder'; void import('./a'); void import(`./b.ts`);",
      'src/z.ts': "import './bootstrap'; export const z = 1;",
      'src/folder/index.ts': 'export const folder = 1;',
      'src/a.ts': 'export const a = 1;',
      'src/b.ts': 'export const b = 1;',
    },
    async (root) => {
      const graph = await collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root);
      assert.deepEqual(
        graph.sources.map(({ path }) => relative(root, path).replaceAll('\\', '/')),
        ['a.ts', 'b.ts', 'bootstrap.ts', 'folder/index.ts', 'z.ts'],
      );
      assert.equal(graph.nonLiteralDynamicImports, 0);
    },
  );
});

test('pure type-only and named type-only imports/exports do not read missing files, mixed/default/namespace value edges do', async () => {
  await fixture(
    {
      'src/bootstrap.ts':
        "import type { A } from './missing-a'; import { type B } from './missing-b'; export type { C } from './missing-c'; export { type D } from './missing-d'; import { type T, value } from './mixed'; import fallback, { type U } from './default'; import * as ns from './namespace'; export { type V, value } from './exported';",
      'src/mixed.ts': 'export const value = 1;',
      'src/default.ts': 'export default 1;',
      'src/namespace.ts': 'export const value = 1;',
      'src/exported.ts': 'export const value = 1;',
    },
    async (root) => {
      const graph = await collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root);
      assert.equal(graph.sources.length, 5);
    },
  );
});

test('external modules, explicit assets with queries, declarations, tests, fixtures and generated inputs cannot fill a missing literal', async () => {
  await fixture(
    {
      'src/bootstrap.ts':
        "import 'external-package'; import './brand.webp?inline'; import './style.css'; import './fixture.d.ts'; import './hidden.test'; import './hidden.spec.ts'; import './fixtures/extra'; import './generated/extra'; export const live = 1;",
      'src/hidden.test.ts': "export const hidden = 'business-document:audit';",
      'src/hidden.spec.ts': "export const hidden = 'business-document:audit';",
      'src/unreferenced.ts': "export const hidden = 'business-document:audit';",
      'src/fixtures/extra.ts': "export const hidden = 'business-document:audit';",
      'src/generated/extra.ts': "export const hidden = 'business-document:audit';",
      'src/fixture.d.ts': "declare const hidden: 'business-document:audit';",
    },
    async (root) => {
      const graph = await collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root);
      assert.equal(graph.sources.length, 1);
      assert.equal(
        graph.sources.some(({ source }) => source.includes("'business-document:audit'")),
        false,
      );
    },
  );
});

test('non-literal dynamic imports are counted as an explicit static-graph limitation', async () => {
  await fixture(
    { 'src/bootstrap.ts': 'void import(variable); void import(`./${name}`);' },
    async (root) => {
      const graph = await collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root);
      assert.equal(graph.nonLiteralDynamicImports, 2);
      assert.equal(graph.sources.length, 1);
    },
  );
});

for (const [label, files, message] of [
  ['missing code', { 'src/bootstrap.ts': "import './missing';" }, /Missing frontend code/u],
  [
    'empty implementation',
    { 'src/bootstrap.ts': "import './empty';", 'src/empty.ts': ' \n' },
    /Empty frontend implementation/u,
  ],
  [
    'parse error',
    { 'src/bootstrap.ts': 'export const broken = ;' },
    /Cannot parse frontend source/u,
  ],
  [
    'escape',
    { 'src/bootstrap.ts': "import '../outside';", 'outside.ts': 'export const value = 1;' },
    /escapes boundary/u,
  ],
  [
    'unsupported code extension',
    { 'src/bootstrap.ts': "import './not-an-asset.json';" },
    /Unsupported frontend code dependency/u,
  ],
  [
    'code query',
    { 'src/bootstrap.ts': "import './code.ts?raw';" },
    /Unsupported frontend code query/u,
  ],
  ['missing entry', {}, /Missing frontend code/u],
])
  test(`fails closed: ${label}`, async () => {
    await fixture(files, async (root) => {
      await assert.rejects(
        collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root),
        message,
      );
    });
  });

test(
  'symlink to an outside implementation fails the realpath boundary',
  { skip: process.platform === 'win32' },
  async () => {
    await fixture(
      { 'src/bootstrap.ts': "import './linked';", 'outside.ts': 'export const value = 1;' },
      async (root, directory) => {
        await symlink(join(directory, 'outside.ts'), join(root, 'linked.ts'));
        await assert.rejects(
          collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root),
          /escapes boundary/u,
        );
      },
    );
  },
);

test('a detached implementation is not scanned and an excluded entry is rejected', async () => {
  await fixture(
    {
      'src/bootstrap.ts': 'export const live = 1;',
      'src/detached.ts': "export const permission = 'business-document:audit';",
      'src/entry.test.ts': 'export const test = 1;',
    },
    async (root) => {
      const graph = await collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root);
      assert.equal(graph.sources.length, 1);
      await assert.rejects(
        collectFrontendRuntimeSources(join(root, 'entry.test.ts'), root),
        /entry is excluded/u,
      );
    },
  );
});

for (const [label, specifier, javascript, typescript] of [
  ['explicit js', './dep.js', 'dep.js', 'dep.ts'],
  ['extensionless file', './dep', 'dep.js', 'dep.ts'],
  ['extensionless index', './folder', 'folder/index.js', 'folder/index.ts'],
  ['extensionless mjs', './dep', 'dep.mjs', 'dep.ts'],
  ['extensionless mts', './dep', 'dep.mts', 'dep.ts'],
  ['extensionless exact file', './dep', 'dep', 'dep.ts'],
  ['extensionless index mjs', './folder', 'folder/index.mjs', 'folder/index.ts'],
  ['directory package entry', './folder', 'folder/package.json', 'folder/index.ts'],
])
  test(`${label}: competing implementation is not silently replaced with ts`, async () => {
    await fixture(
      {
        'src/bootstrap.ts': `import '${specifier}';`,
        [`src/${javascript}`]: javascript.endsWith('package.json')
          ? '{"main":"runtime.js"}'
          : 'export const runtime = 1;',
        'src/folder/runtime.js': 'export const runtime = 1;',
        [`src/${typescript}`]: "export const notTheRuntime = 'business-document:audit';",
      },
      async (root) => {
        await assert.rejects(
          collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root),
          /Ambiguous non-TS frontend resolution/u,
        );
      },
    );
  });

test(
  'an in-boundary symlink cannot disguise non-ts text as a ts implementation',
  { skip: process.platform === 'win32' },
  async () => {
    await fixture(
      {
        'src/bootstrap.ts': "import './linked';",
        'src/payload.txt': "export const hidden = 'business-document:audit';",
      },
      async (root) => {
        await symlink(join(root, 'payload.txt'), join(root, 'linked.ts'));
        await assert.rejects(
          collectFrontendRuntimeSources(join(root, 'bootstrap.ts'), root),
          /Non-TS frontend implementation/u,
        );
      },
    );
  },
);
