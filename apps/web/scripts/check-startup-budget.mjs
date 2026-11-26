import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const VIRTUAL_ORIGIN = 'https://startup-budget.invalid/';

function assetPath(reference, html = 'index.html') {
  const url = new URL(reference, new URL(html, VIRTUAL_ORIGIN));
  assert.equal(
    url.origin,
    new URL(VIRTUAL_ORIGIN).origin,
    `Cannot measure external startup asset: ${reference}`,
  );
  const path = decodeURIComponent(url.pathname).slice(1);
  assert.ok(
    path && !path.split('/').some((part) => part === '..' || part === '.'),
    `Invalid startup asset path: ${reference}`,
  );
  return path;
}

function htmlStylesheets(html, entry) {
  const files = new Set();
  // Vite emits static links. Handle quote/order/whitespace variants and rel token lists;
  // commented markup and preload-only links do not load a stylesheet.
  const source = html.replace(/<!--[\s\S]*?-->/gu, '');
  for (const [tag] of source.matchAll(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/giu)) {
    const attributes = new Map();
    for (const match of tag
      .replace(/^<link\b|\/?\s*>$/giu, '')
      .matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu))
      attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
    if (!(attributes.get('rel') ?? '').toLowerCase().split(/\s+/u).includes('stylesheet')) continue;
    const href = attributes.get('href');
    assert.ok(href, 'Static stylesheet link is missing href');
    files.add(assetPath(href, entry));
  }
  return files;
}

export function measureStartupBudget(dist) {
  const directory = resolve(fileURLToPath(dist));
  const readAsset = (file) => {
    const path = resolve(directory, file);
    assert.ok(path.startsWith(directory + sep), `Startup asset escapes dist: ${file}`);
    return readFileSync(path);
  };
  const manifest = JSON.parse(readAsset('.vite/manifest.json').toString('utf8'));
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  assert.equal(entries.length, 1, 'Expected exactly one HTML entry');
  // UI-M2: Vite can name the lazy workspace chunk _bootstrap-*.js.
  const bootstrapKey = Object.keys(manifest).find(
    (key) =>
      manifest[key].isDynamicEntry &&
      (key === 'src/bootstrap.ts' || /^_bootstrap-[^/]*\.js$/u.test(key)),
  );
  assert.ok(bootstrapKey, 'Business workspace chunk missing from manifest');
  const visited = new Set();
  const js = new Set();
  const manifestCss = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    assert.ok(chunk, `Missing manifest entry: ${key}`);
    js.add(chunk.file);
    for (const file of chunk.css ?? []) manifestCss.add(assetPath(file));
    for (const dependency of chunk.imports ?? []) visit(dependency);
  }
  visit(entries[0]);
  assert.ok(manifest[bootstrapKey]?.isDynamicEntry, 'Business workspace must be lazy loaded');
  assert.ok(!visited.has(bootstrapKey), 'Business workspace leaked into the login entry');
  const entry = manifest[entries[0]].src ?? entries[0];
  assert.ok(entry.endsWith('.html'), `Expected an HTML entry source: ${entry}`);
  const htmlCss = htmlStylesheets(readAsset(entry).toString('utf8'), entry);
  // TD-GATE-005: cssCodeSplit:false lists the merged asset separately in manifest,
  // with no entry.css. Count the actual HTML links as well as reachable chunk CSS.
  // These sets need not match; their normalized union is counted exactly once.
  const css = new Set([...htmlCss, ...manifestCss]);
  const total = (files) =>
    [...files].reduce((sum, file) => sum + gzipSync(readAsset(file)).byteLength, 0);
  return {
    jsBytes: total(js),
    cssBytes: total(css),
    jsFiles: [...js],
    cssFiles: [...css],
    htmlCss: [...htmlCss],
    manifestCss: [...manifestCss],
  };
}

export function checkStartupBudget(dist) {
  const result = measureStartupBudget(dist);
  const { jsBytes, cssBytes } = result;
  // Print both measurements even when a budget assertion fails.
  console.log(
    `Login critical path: JS ${jsBytes} bytes + CSS ${cssBytes} bytes (gzip); workspace deferred.`,
  );
  assert.ok(
    jsBytes <= 12_000,
    `Login JavaScript including inline brand gzip budget exceeded: ${jsBytes} > 12000 bytes`,
  );
  // 裁定15：cssCodeSplit:false 后全站 CSS 合并（原约19KB gzip）随登录页加载。
  // 主协调技术裁定 2faef99（2026-11-26）：CSS 27000 B，JS 12000 B 不变。
  assert.ok(cssBytes <= 27_000, `Login CSS gzip budget exceeded: ${cssBytes} > 27000 bytes`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dist = process.argv[2]
    ? pathToFileURL(resolve(process.argv[2]) + sep)
    : new URL('../dist/', import.meta.url);
  checkStartupBudget(dist);
}
