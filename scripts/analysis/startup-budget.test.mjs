import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

const script =
  process.env.STARTUP_BUDGET_SCRIPT ??
  fileURLToPath(new URL('../../apps/web/scripts/check-startup-budget.mjs', import.meta.url));
const fixtureParent = process.env.STARTUP_BUDGET_FIXTURES ?? tmpdir();
const baseManifest = () => ({
  'index.html': {
    isEntry: true,
    file: 'assets/login.js',
    src: 'index.html',
    dynamicImports: ['src/bootstrap.ts'],
  },
  'src/bootstrap.ts': { isDynamicEntry: true, file: 'assets/workspace.js' },
  'style.css': { file: 'assets/style.css', src: 'style.css' },
});
const gz = (value) => gzipSync(value).byteLength;
function run({
  html = '<link rel="stylesheet" href="/assets/style.css">',
  manifest = baseManifest(),
  assets = {},
} = {}) {
  mkdirSync(fixtureParent, { recursive: true });
  const fixture = mkdtempSync(join(fixtureParent, 'startup-budget-'));
  try {
    const entry = join(fixture, 'scripts/check-startup-budget.mjs');
    mkdirSync(dirname(entry), { recursive: true });
    copyFileSync(script, entry);
    const files = {
      '.vite/manifest.json': JSON.stringify(manifest),
      'index.html': html,
      'assets/login.js': 'console.log("login");',
      'assets/workspace.js': 'console.log("deferred workspace");',
      'assets/style.css': '.login-card{display:grid;color:#145d45}',
      ...assets,
    };
    for (const [path, value] of Object.entries(files)) {
      if (value === null) continue;
      const target = join(fixture, 'dist', path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, value);
    }
    return { ...spawnSync(process.execPath, [entry], { encoding: 'utf8' }), files };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
function bytes(result) {
  const match = /JS (\d+) bytes \+ CSS (\d+) bytes/u.exec(result.stdout);
  assert.ok(match, `Missing separate JS/CSS measurements: ${result.stdout}\n${result.stderr}`);
  return { js: Number(match[1]), css: Number(match[2]) };
}

test('counts HTML-linked merged CSS when manifest entry has no css field', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(bytes(result).css, gz(result.files['assets/style.css']));
});
test('deduplicates the same stylesheet from HTML and repeated reachable imports', () => {
  const manifest = baseManifest();
  manifest['index.html'].css = ['assets/style.css'];
  manifest['index.html'].imports = ['_shared.js'];
  manifest['_shared.js'] = { file: 'assets/shared.js', css: ['assets/style.css'] };
  const result = run({
    manifest,
    html: '<link href="/assets/style.css" rel="stylesheet"><link rel="stylesheet" href="./assets/style.css">',
    assets: { 'assets/shared.js': 'export const ready = true;' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(bytes(result).css, gz(result.files['assets/style.css']));
});
test('counts the union when HTML and reachable manifest CSS are different', () => {
  const manifest = baseManifest();
  manifest['index.html'].css = ['assets/chunk.css'];
  const result = run({ manifest, assets: { 'assets/chunk.css': '.chunk{padding:12px}' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    bytes(result).css,
    gz(result.files['assets/style.css']) + gz(result.files['assets/chunk.css']),
  );
});
test('recognizes single-quoted/unquoted attributes and case-insensitive rel tokens', () => {
  const result = run({
    html: "<LINK HREF='/assets/style.css?build=1#fragment' crossorigin REL='alternate STYLESHEET'>",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(bytes(result).css, gz(result.files['assets/style.css']));
});
test('ignores commented links and preload-only links', () => {
  const result = run({
    html: '<!-- <link rel="stylesheet" href="/missing.css"> --><link rel="preload" as="style" href="/missing-preload.css">',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(bytes(result).css, 0);
});
test('fails for an HTML stylesheet file missing from dist', () => {
  const result = run({ html: '<link rel="stylesheet" href="/assets/missing.css">' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing\.css/u);
});
test('fails for a reachable manifest CSS file missing from dist', () => {
  const manifest = baseManifest();
  manifest['index.html'].css = ['assets/missing.css'];
  const result = run({ manifest });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing\.css/u);
});
test('does not count deferred workspace CSS unless linked by HTML', () => {
  const manifest = baseManifest();
  manifest['src/bootstrap.ts'].css = ['assets/deferred.css'];
  const result = run({ manifest, assets: { 'assets/deferred.css': randomBytes(40000) } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(bytes(result).css, gz(result.files['assets/style.css']));
});
test('preserves JS static-import reachability and counts shared chunks once', () => {
  const manifest = baseManifest();
  manifest['index.html'].imports = ['_left.js', '_right.js'];
  manifest['_left.js'] = { file: 'assets/left.js', imports: ['_shared.js'] };
  manifest['_right.js'] = { file: 'assets/right.js', imports: ['_shared.js'] };
  manifest['_shared.js'] = { file: 'assets/shared.js' };
  const result = run({
    manifest,
    assets: {
      'assets/left.js': 'export const left = 1;',
      'assets/right.js': 'export const right = 2;',
      'assets/shared.js': 'export const shared = 3;',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    bytes(result).js,
    ['login', 'left', 'right', 'shared'].reduce(
      (sum, f) => sum + gz(result.files[`assets/${f}.js`]),
      0,
    ),
  );
});
test('prints both totals and fails the unchanged JS budget', () => {
  const result = run({
    assets: { 'assets/login.js': `/*${randomBytes(20000).toString('hex')}*/` },
  });
  assert.notEqual(result.status, 0);
  assert.ok(bytes(result).js > 12000);
  assert.match(result.stderr, /JavaScript.*budget exceeded/u);
});
test('prints actual CSS and rejects HTML-only CSS exceeding 27,000 bytes', () => {
  const result = run({
    assets: { 'assets/style.css': `.x{--payload:"${randomBytes(40000).toString('base64')}"}` },
  });
  assert.notEqual(result.status, 0);
  assert.ok(bytes(result).css > 27000);
  assert.match(result.stderr, /CSS gzip budget exceeded: \d+ > 27000 bytes/u);
});
test('continues to reject a workspace chunk included in the login static graph', () => {
  const manifest = baseManifest();
  manifest['index.html'].imports = ['src/bootstrap.ts'];
  const result = run({ manifest });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workspace leaked into the login entry/u);
});
test('rejects external stylesheets whose bytes cannot be measured locally', () => {
  const result = run({ html: '<link rel="stylesheet" href="https://example.org/site.css">' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /external startup asset/u);
});
