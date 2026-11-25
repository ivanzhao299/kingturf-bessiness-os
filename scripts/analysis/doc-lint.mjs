#!/usr/bin/env node
// 文档门禁（只读，零依赖）。用法：node scripts/analysis/doc-lint.mjs
// 检查：① AGENTS.md 行数 ≤200；② 索引完备性（docs/ 下每个 .md 都被 docs/index.md 引用，
//       且根入口 AGENTS.md / ARCHITECTURE.md / README.md 也被引用）；
//       ③ 链接可解析（docs/index.md、AGENTS.md、ARCHITECTURE.md 内的相对 .md 链接必须存在）。
// ④ 台账主表结构完整性（见下方）。
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

// ④ 台账主表结构完整性
// 2026-11-24/25 登记脚本五次把换行写进状态单元格：行尾的「|」被挤到下一行，前面多出空行，而空行会
// 结束 Markdown 表格——主表从此断成几截渲染。prettier 与上面的三项检查都不拦。这里按行检查：
// 没有只含「|」的孤行；每个 TD- 行都以「|」结尾；主表是连续的一块且各行列数一致；ID 不重复；
// 状态不是「未修；已上生产」（给光秃秃的「未修」追加了发布标记）。
const trackerPath = 'docs/exec-plans/tech-debt-tracker.md';
if (!existsSync(trackerPath)) {
  fail('tracker-missing', `${trackerPath} 不存在`, '恢复技术债台账');
} else {
  const trackerLines = readFileSync(trackerPath, 'utf8').split('\n');
  const rowId = /^\| (TD-[A-Z]+-\d+) /u;
  trackerLines.forEach((line, index) => {
    if (line.trim() === '|')
      fail(
        'tracker-orphan-pipe',
        `${trackerPath}:${index + 1} 只有一个「|」——上一行的结尾竖线被挤到了这里`,
        '把它接回上一行末尾（上一行须以「 |」结尾），删除这一行',
      );
    if (rowId.test(line) && !line.trimEnd().endsWith('|'))
      fail(
        'tracker-row-unclosed',
        `${trackerPath}:${index + 1} 的台账行没有以「|」结尾`,
        '状态单元格内不能有换行；把该行恢复成一行并以「 |」结尾',
      );
    if (rowId.test(line) && /未修[；，]\s*已上生产/u.test(line))
      fail(
        'tracker-status-contradiction',
        `${trackerPath}:${index + 1} 的状态是「未修；已上生产」`,
        '该行已上线：用完整的处置说明替换「未修」（修复提交、验证方式、发布版本）',
      );
  });
  const anchor = trackerLines.findIndex((line) => line.startsWith('| TD-UI-009 '));
  if (anchor >= 0) {
    let start = anchor;
    while (start > 0 && trackerLines[start - 1].startsWith('|')) start -= 1;
    let end = anchor;
    while (end + 1 < trackerLines.length && trackerLines[end + 1].startsWith('|')) end += 1;
    const block = trackerLines.slice(start, end + 1);
    const widths = new Set(block.map((line) => line.split('|').length));
    if (widths.size > 1)
      fail(
        'tracker-table-width',
        `${trackerPath} 主表各行列数不一致：${[...widths].sort().join(' / ')}`,
        '主表每行须是 7 列（按「|」切分后 9 段）；补齐或删除多出的「|」',
      );
    const ids = block.filter((line) => rowId.test(line)).map((line) => rowId.exec(line)[1]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id))
        fail('tracker-duplicate-id', `${trackerPath} 主表里 ID 重复：${id}`, '合并或重新编号');
      seen.add(id);
    }
  }
}

if (problems.length > 0) {
  console.error(`doc-lint 失败：${problems.length} 个问题\n`);
  for (const p of problems) console.error(`  [${p.rule}] ${p.detail}\n      修复：${p.fix}\n`);
  process.exit(1);
}
console.log(
  `doc-lint 通过：AGENTS 行数/必填节 ✓，索引收录 ${allDocs.length - 1} 个 docs 文件 ✓，${linkFiles.length} 个文件链接全部可解析 ✓，台账主表结构 ✓`,
);
