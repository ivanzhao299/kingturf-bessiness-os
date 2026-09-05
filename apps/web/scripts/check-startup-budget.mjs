import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
assert.equal(entries.length, 1, 'Expected exactly one HTML entry');
const visited = new Set();
const js = new Set();
const css = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  assert.ok(chunk, `Missing manifest entry: ${key}`);
  js.add(chunk.file);
  for (const file of chunk.css ?? []) css.add(file);
  for (const dependency of chunk.imports ?? []) visit(dependency);
}
visit(entries[0]);
assert.ok(manifest['src/bootstrap.ts']?.isDynamicEntry, 'Business workspace must be lazy loaded');
assert.ok(!visited.has('src/bootstrap.ts'), 'Business workspace leaked into the login entry');
const total = (files) =>
  [...files].reduce((sum, file) => sum + gzipSync(readFileSync(new URL(file, dist))).byteLength, 0);
const jsBytes = total(js);
const cssBytes = total(css);
assert.ok(jsBytes <= 8_000, `Login JavaScript gzip budget exceeded: ${jsBytes} > 8000 bytes`);
assert.ok(cssBytes <= 4_000, `Login CSS gzip budget exceeded: ${cssBytes} > 4000 bytes`);
// This guard runs in local CI, GitHub CI and the production Docker build.
console.log(
  `Login critical path: JS ${jsBytes} bytes + CSS ${cssBytes} bytes (gzip); workspace deferred.`,
);
