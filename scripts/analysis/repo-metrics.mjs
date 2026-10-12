#!/usr/bin/env node
// 仓库度量脚本（只读，零依赖）。用法：node scripts/analysis/repo-metrics.mjs
// 用途：为 docs/exec-plans/tech-debt-tracker.md 提供可复算的证据数字；
//       阶段 4 重构前后各跑一次，用于「重复代码度量下降 / 复杂度下降」验收。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const isSourceTs = (p) =>
  p.endsWith('.ts') &&
  !p.endsWith('.test.ts') &&
  !p.endsWith('.spec.ts') &&
  !p.endsWith('.d.ts') &&
  !p.includes('/dist/') &&
  !p.includes('/node_modules/');
const isTestFile = (p) =>
  (p.endsWith('.test.ts') || p.endsWith('.spec.ts') || p.endsWith('.spec.mjs')) &&
  !p.includes('/dist/') &&
  !p.includes('/node_modules/');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules' || entry === '.git') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

const allFiles = [...walk('apps'), ...walk('packages'), ...walk('tests')];
const sourceFiles = allFiles.filter(isSourceTs);
const testFiles = allFiles.filter(isTestFile);
const text = (p) => readFileSync(p, 'utf8');
const lineCount = (p) => text(p).split('\n').length;

const withLines = sourceFiles.map((p) => ({ file: p, lines: lineCount(p) }));
const totalSourceLines = withLines.reduce((sum, f) => sum + f.lines, 0);

console.log('== 1. 非测试源文件规模 ==');
console.log(`非测试 .ts 文件数: ${sourceFiles.length}，总行数: ${totalSourceLines}`);
console.log(
  `测试文件数(.test.ts/.spec.*): ${testFiles.length}，总行数: ${testFiles.reduce((s, f) => s + lineCount(f), 0)}`,
);
for (const f of withLines.sort((a, b) => b.lines - a.lines).slice(0, 10)) {
  console.log(
    `  ${String(f.lines).padStart(6)}  ${f.file}  (${((f.lines / totalSourceLines) * 100).toFixed(1)}%)`,
  );
}

console.log('\n== 2. 巨型函数跨度 ==');
function functionSpan(file, signature) {
  const lines = text(file).split('\n');
  const start = lines.findIndex((l) => l.includes(signature));
  if (start === -1) return null;
  let depth = 0,
    seenOpen = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        seenOpen = true;
      }
      if (ch === '}') depth--;
    }
    if (seenOpen && depth === 0) return { start: start + 1, end: i + 1, span: i - start + 1 };
  }
  return null;
}
for (const [file, sig] of [
  ['apps/web/src/bootstrap.ts', 'function commercialWorkspaceStructure'],
  ['apps/api/src/app.ts', 'export function buildApp'],
]) {
  const s = functionSpan(file, sig);
  console.log(
    s
      ? `  ${file}: ${sig} → 行 ${s.start}-${s.end}，跨度 ≈${s.span} 行`
      : `  ${file}: ${sig} → 未找到（可能已拆分）`,
  );
}

console.log('\n== 3. 缩进嵌套直方图（前导空格/2 估层） ==');
for (const file of ['apps/web/src/bootstrap.ts', 'apps/api/src/app.ts']) {
  const levels = { ge4: 0, ge7: 0, max: 0 };
  for (const line of text(file).split('\n')) {
    if (!line.trim()) continue;
    const indent = Math.floor(line.match(/^ */)[0].length / 2);
    if (indent >= 4) levels.ge4++;
    if (indent >= 7) levels.ge7++;
    if (indent > levels.max) levels.max = indent;
  }
  console.log(`  ${file}: ≥4层 ${levels.ge4} 行，≥7层 ${levels.ge7} 行，最深 ${levels.max} 层`);
}

console.log('\n== 4. 重复模式计数 ==');
const apiSrc = readdirSync('apps/api/src')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => `apps/api/src/${f}`);
const countMatches = (re, files) =>
  files.reduce((sum, f) => sum + (text(f).match(re) || []).length, 0);
const filesWith = (needle, files) => files.filter((f) => text(f).includes(needle));

const scopeFiles = filesWith('organization_scope_relationships', apiSrc);
console.log(
  `  数据范围(scope) SQL 谓词: ${scopeFiles.length} 个文件各自实现（${scopeFiles.map((f) => f.split('/').pop()).join(', ')}）`,
);
const auditFiles = filesWith('INSERT INTO audit_events', apiSrc);
console.log(
  `  INSERT INTO audit_events: ${countMatches(/INSERT INTO audit_events/g, auditFiles)} 处 / ${auditFiles.length} 个文件`,
);
console.log(
  `  INSERT INTO domain_event_outbox: ${countMatches(/INSERT INTO domain_event_outbox/g, apiSrc)} 处`,
);
console.log(
  `  幂等键查询行(含 idempotency_key 与 SELECT 的行): ${apiSrc.reduce(
    (sum, f) =>
      sum +
      text(f)
        .split('\n')
        .filter((l) => l.includes('idempotency_key') && l.includes('SELECT')).length,
    0,
  )} 行命中`,
);
console.log(
  `  前端日期格式化内联(toLocale*String zh-CN, bootstrap.ts): ${(text('apps/web/src/bootstrap.ts').match(/toLocale(Date)?String\('zh-CN'\)/g) || []).length} 处`,
);

console.log('\n== 5. 路由分发与类型逃逸 ==');
console.log(
  `  app.ts 顺序路由分支(request.method ===): ${(text('apps/api/src/app.ts').match(/request\.method ===/g) || []).length} 个`,
);
for (const f of apiSrc) {
  const hits = (text(f).match(/: any\b|query<any>/g) || []).length;
  if (hits > 0) console.log(`  显式 any: ${f.split('/').pop()} → ${hits} 处`);
}
console.log('  (未列出的 api/src 文件显式 any: 0)');
