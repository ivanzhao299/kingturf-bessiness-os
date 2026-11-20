import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// 裁定15（2026-11-20）：cssCodeSplit: false 后全部 CSS 合并为单一 style-*.css，
// 经 index.html 静态 <link> 加载——不再依赖任何运行时注入。
// 本守卫断言：唯一 CSS 文件存在、被 index.html 静态引用、且包含 console 样式与 kt tokens。
const dist = new URL('../dist/', import.meta.url);
const cssFiles = readdirSync(new URL('assets/', dist)).filter((f) => f.endsWith('.css'));
assert.strictEqual(
  cssFiles.length,
  1,
  `cssCodeSplit:false expects exactly one css file, found ${cssFiles.length}: ${cssFiles.join(', ')}`,
);
const cssFile = cssFiles[0];
const bundle = readFileSync(new URL(`assets/${cssFile}`, dist), 'utf8');
assert.ok(
  bundle.includes('.console-page{'),
  'Governance console styles missing from the merged css bundle',
);
assert.ok(bundle.includes('--kt-'), 'UI foundation tokens missing from the merged css bundle');
// Verify static link in index.html (no runtime injection dependency)
const html = readFileSync(new URL('index.html', dist), 'utf8');
assert.ok(
  html.includes(`href="/assets/${cssFile}"`),
  `index.html must statically link the merged css (${cssFile}) — cssCodeSplit:false guard`,
);
console.log(
  `Console css guard: ${cssFile} statically linked, console styles + kt tokens verified.`,
);
