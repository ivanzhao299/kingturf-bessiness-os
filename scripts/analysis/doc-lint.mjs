#!/usr/bin/env node
// 文档门禁（只读，零依赖）。用法：node scripts/analysis/doc-lint.mjs
// 检查：① AGENTS.md 行数 ≤200；② 索引完备性（docs/ 下每个 .md 都被 docs/index.md 引用，
//       且根入口 AGENTS.md / ARCHITECTURE.md / README.md 也被引用）；
//       ③ 链接可解析（docs/index.md、AGENTS.md、ARCHITECTURE.md 内的相对 .md 链接必须存在）。
// 失败信息附修复指令（HARNESS-RULES §4.2）。阶段 3 接入 ci:local。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const problems = [];
const fail = (rule, detail, fix) => problems.push({ rule, detail, fix });

// ① AGENTS.md 行数上限
const agentsPath = 'AGENTS.md';
if (!existsSync(agentsPath)) {
  fail('agents-missing', 'AGENTS.md 不存在', '按 docs/HARNESS-RULES.md 附录 E 重建（≤100 行地图）');
} else {
  const n = readFileSync(agentsPath, 'utf8').split('\n').length;
  if (n > 200)
    fail(
      'agents-too-long',
      `AGENTS.md ${n} 行 > 200`,
      '把细节下推到 docs/ 对应文档，入口只留地图（规则 §2.2）',
    );
  for (const section of ['## 这是什么项目', '## 硬性约束', '## 常用命令']) {
    if (!readFileSync(agentsPath, 'utf8').includes(section))
      fail('agents-section', `AGENTS.md 缺少必填节「${section}」`, '按附录 E 骨架补齐五节');
  }
}

// ② 索引完备性
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}
const allDocs = walk('docs');
const indexPath = 'docs/index.md';
if (!existsSync(indexPath)) {
  fail(
    'index-missing',
    'docs/index.md 不存在',
    '新建索引：每个 docs/**/*.md 一行，标注状态与新鲜度',
  );
} else {
  const indexText = readFileSync(indexPath, 'utf8');
  for (const doc of allDocs) {
    if (doc === 'docs/index.md') continue;
    if (!indexText.includes(`(${doc})`) && !indexText.includes(`(${doc.replace(/^docs\//, '')})`))
      fail(
        'index-incomplete',
        `${doc} 未被 docs/index.md 收录`,
        `在 docs/index.md 对应目录表补一行：| [文件名](${doc.replace(/^docs\//, '')}) | 状态 |`,
      );
  }
  for (const root of ['AGENTS.md', 'ARCHITECTURE.md', 'README.md']) {
    if (!indexText.includes(`(../${root})`))
      fail(
        'index-root',
        `docs/index.md 未收录根入口 ${root}`,
        '在「常驻入口」表补一行指向 ../' + root,
      );
  }
}

// ③ 链接可解析
const linkFiles = ['docs/index.md', 'AGENTS.md', 'ARCHITECTURE.md'];
const linkRe = /\]\(([^)#\s]+\.md)(#[^)\s]*)?\)/g;
for (const file of linkFiles) {
  if (!existsSync(file)) continue;
  const base = dirname(file);
  for (const m of readFileSync(file, 'utf8').matchAll(linkRe)) {
    const target = normalize(join(base, m[1]));
    if (!existsSync(target))
      fail(
        'link-dead',
        `${file} 内死链 → ${m[1]}（解析为 ${target}）`,
        `修正路径，或创建目标文件；若文件已移动，更新为现路径`,
      );
  }
}

if (problems.length > 0) {
  console.error(`doc-lint 失败：${problems.length} 个问题\n`);
  for (const p of problems) console.error(`  [${p.rule}] ${p.detail}\n      修复：${p.fix}\n`);
  process.exit(1);
}
console.log(
  `doc-lint 通过：AGENTS 行数/必填节 ✓，索引收录 ${allDocs.length - 1} 个 docs 文件 ✓，${linkFiles.length} 个文件链接全部可解析 ✓`,
);
