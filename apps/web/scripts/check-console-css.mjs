import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));
// 与 check-startup-budget.mjs 同型：bootstrap 动态入口的 manifest 键被 vite 规范化为
// `_bootstrap-*.js`（chunk 不再与源模块 1:1）。
const bootstrapKey = Object.keys(manifest).find(
  (key) =>
    manifest[key].isDynamicEntry &&
    (key === 'src/bootstrap.ts' || /^_bootstrap-[^/]*\.js$/u.test(key)),
);
assert.ok(bootstrapKey, 'Business workspace chunk missing from manifest');
// 裁定10守卫：console 样式与 UI 基座 tokens 必须随 bootstrap 主 CSS 包分发（由 index
// 入口的完整 preload 助手注入）。多入口构建关闭 polyfill 后，动态 chunk 的 preload
// 助手没有 stylesheet 注入分支——CSS 只产出在懒载 chunk（mount-*.css 先例）则运行时
// 永不注入，生产页面退化为纯文本列表。静态宿主（console-entry.ts / ui-kit/view.ts）
// 的 CSS import 并入 bootstrap 主包后本守卫才通过。
const cssFiles = manifest[bootstrapKey].css ?? [];
assert.ok(cssFiles.length > 0, 'Bootstrap chunk ships no css bundle');
const bundle = cssFiles.map((file) => readFileSync(new URL(file, dist), 'utf8')).join('\n');
assert.ok(
  bundle.includes('.console-page{'),
  'Governance console styles missing from the bootstrap css bundle (lazy chunk css is never injected at runtime)',
);
assert.ok(
  bundle.includes('--kt-'),
  'UI foundation tokens missing from the bootstrap css bundle (lazy chunk css is never injected at runtime)',
);
console.log(`Console css guard: ${cssFiles.join(', ')} carries console styles and kt tokens.`);
