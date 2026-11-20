import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
assert.equal(entries.length, 1, 'Expected exactly one HTML entry');
// UI-M2：bootstrap chunk 图内新增动态子入口（governance console / ui-kit 同型），
// vite 将其 manifest 键规范化为 `_bootstrap-*.js`（chunk 不再与源模块 1:1）。
// 懒加载与预算语义不变：仍要求该动态 chunk 存在且不入登录入口可达集。
const bootstrapKey = Object.keys(manifest).find(
  (key) =>
    manifest[key].isDynamicEntry &&
    (key === 'src/bootstrap.ts' || /^_bootstrap-[^/]*\.js$/u.test(key)),
);
assert.ok(bootstrapKey, 'Business workspace chunk missing from manifest');
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
assert.ok(manifest[bootstrapKey]?.isDynamicEntry, 'Business workspace must be lazy loaded');
assert.ok(!visited.has(bootstrapKey), 'Business workspace leaked into the login entry');
const total = (files) =>
  [...files].reduce((sum, file) => sum + gzipSync(readFileSync(new URL(file, dist))).byteLength, 0);
const jsBytes = total(js);
const cssBytes = total(css);
assert.ok(
  jsBytes <= 12_000,
  `Login JavaScript including inline brand gzip budget exceeded: ${jsBytes} > 12000 bytes`,
);
// 裁定15：cssCodeSplit:false 后全站 CSS 合并（~19KB gzip）随登录页加载。
// 旧 4KB 预算已不适用；新预算 25KB 容纳合并样式（消除运行时 CSS 注入不可靠性
// 的结构性代价）。练手项目可接受。
assert.ok(cssBytes <= 25_000, `Login CSS gzip budget exceeded: ${cssBytes} > 25000 bytes`);
// This guard runs in local CI, GitHub CI and the production Docker build.
console.log(
  `Login critical path: JS ${jsBytes} bytes + CSS ${cssBytes} bytes (gzip); workspace deferred.`,
);
