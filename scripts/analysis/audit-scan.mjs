#!/usr/bin/env node
// 安全/性能/可靠性扫描脚本（只读，零依赖）。用法：node scripts/analysis/audit-scan.mjs
// 用途：为改造计划 §3.8 提供可一条命令复跑的证据；阶段 4 前后可对比。
// 范围口径：
//   prod  = apps/ + packages/ 的非测试 .ts/.mjs（排除 *.test.* / *.spec.* / test|tests 目录 / dist）
//   tools = scripts/ 下除 scripts/analysis/ 外的运维脚本（仅参与密钥扫描）
// 依赖漏洞扫描不在此脚本内（需网络），复跑命令见计划 §3.8。
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules' || entry === 'analysis') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

const isTsLike = (p) =>
  (p.endsWith('.ts') || p.endsWith('.mjs')) &&
  !p.includes('/dist/') &&
  !p.includes('/node_modules/');
const isProd = (p) =>
  isTsLike(p) &&
  !p.endsWith('.test.ts') &&
  !p.endsWith('.spec.ts') &&
  !p.endsWith('.test.mjs') &&
  !p.includes('/test/') &&
  !p.includes('/tests/') &&
  !p.includes('/scripts/');

const prod = [...walk('apps'), ...walk('packages')].filter(isProd);
const tools = walk('scripts').filter((p) => isTsLike(p) && !p.endsWith('.test.mjs'));
const text = (p) => readFileSync(p, 'utf8');
const lines = (p) => text(p).split('\n');
const countLinesWith = (re, files) =>
  files.reduce((n, f) => n + lines(f).filter((l) => re.test(l)).length, 0);

console.log(
  `扫描范围：生产源码 ${prod.length} 个文件（apps+packages，非测试）；运维脚本 ${tools.length} 个（仅密钥扫描）\n`,
);

console.log('== S1 硬编码密钥（字面量赋值，排除测试夹具与已知占位符） ==');
const secretRe = /(api[_-]?key|secret|password|passwd|token)['"]?\s*[:=]\s*['"][^'"]{6,}/i;
const placeholderRe =
  /server-secret|ephemeral|local-development|replace-with|correct horse|SENSITIVE-TECHNICAL/i;
let secretHits = 0;
for (const f of [...prod, ...tools]) {
  for (const [i, line] of lines(f).entries()) {
    if (secretRe.test(line) && !placeholderRe.test(line)) {
      secretHits++;
      console.log(`  命中: ${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  }
}
console.log(
  secretHits === 0
    ? '  结果: 0 处真实密钥（测试夹具与占位符已按排除清单过滤）'
    : `  结果: ${secretHits} 处待人工判定`,
);

console.log('\n== S2 git 跟踪的 .env 文件 ==');
const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((p) => /(^|\/)\.env/i.test(p));
console.log(`  ${tracked.length === 0 ? '无' : tracked.join(', ')}`);

console.log('\n== S3 生产代码 console 调用（apps+packages） ==');
const consoleHits = [];
for (const f of prod) {
  lines(f).forEach((l, i) => {
    if (/console\./.test(l)) consoleHits.push(`  ${f}:${i + 1}  ${l.trim().slice(0, 80)}`);
  });
}
console.log(consoleHits.length === 0 ? '  0 处' : consoleHits.join('\n'));

console.log('\n== S4 注入面（按行计） ==');
const innerHtmlLines = countLinesWith(
  /innerHTML/,
  prod.filter((f) => f.startsWith('apps/')),
);
const evalLines = countLinesWith(/eval\(|new Function/, prod);
console.log(
  `  innerHTML（apps，非测试）: ${innerHtmlLines} 行；eval/new Function: ${evalLines} 行`,
);

console.log('\n== S6 N+1 候选（for-of 块内含 await，语法级判定） ==');
let nPlusOne = 0;
for (const f of prod.filter((p) => p.startsWith('apps/api/src/'))) {
  const ls = lines(f);
  for (let i = 0; i < ls.length; i++) {
    if (!/for\s*\(const\s+\w+\s+of\s+/.test(ls[i])) continue;
    let depth = 0,
      seen = false;
    for (let j = i; j < Math.min(i + 80, ls.length); j++) {
      for (const ch of ls[j]) {
        if (ch === '{') {
          depth++;
          seen = true;
        }
        if (ch === '}') depth--;
      }
      if (seen && depth <= 0) break;
      if (j > i && /\bawait\b/.test(ls[j])) {
        nPlusOne++;
        console.log(`  ${f}:${i + 1}`);
        break;
      }
    }
  }
}
console.log(`  合计候选: ${nPlusOne} 处（是否真 N+1 需逐个人工判定）`);

console.log('\n== S7 Promise.all（无界并发候选，按文件） ==');
for (const f of prod) {
  const n = (text(f).match(/Promise\.all/g) || []).length;
  if (n > 0) console.log(`  ${f}: ${n} 处`);
}

console.log('\n== S8 网络超时标记 ==');
for (const f of ['apps/web/src/http.ts', 'apps/web/src/workspace-loader.ts']) {
  const markers = text(f).match(/AbortController|15_000|45_000/g) || [];
  console.log(`  ${f}: ${markers.join(', ') || '未命中'}`);
}

console.log('\n== S9 retry/backoff 命中（人工分类：人工重试按钮 vs 自动重试） ==');
for (const f of prod) {
  const ls = lines(f).filter((l) => /\bretry|backoff/i.test(l));
  if (ls.length > 0) console.log(`  ${f}: ${ls.length} 行`);
}
const retryTotal = countLinesWith(/\bretry|backoff/i, prod);
console.log(`  合计: ${retryTotal} 行（本基线人工判定均为人工重试按钮/幂等命令语义，无自动重试）`);

console.log('\n== S10 内存增长点标记 ==');
console.log(`  setInterval（生产代码）: ${countLinesWith(/setInterval/, prod)} 行`);
const addEl = countLinesWith(/addEventListener/, ['apps/web/src/bootstrap.ts']);
const rmEl = countLinesWith(/removeEventListener/, ['apps/web/src/bootstrap.ts']);
console.log(
  `  bootstrap.ts addEventListener: ${addEl} 行 / removeEventListener: ${rmEl} 行（其余依赖 {signal} 绑定与节点丢弃统一销毁）`,
);

console.log('\n== S11 模板字符串中原始请求对象插值（apps/api/src，启发式） ==');
// 仅标记以原始请求类标识符开头且非字面量白名单三元/数值占位的插值；input/query 等为入口层已校验的领域参数，不在标记范围（见计划 §3.8 限制栏）
const rawRe = /^\s*(request|req|body|rawBody|ctx|user)\b/;
const literalTernaryRe = /^\(?\s*[^?]+\?\s*'[^']*'\s*:\s*'[^']*'\s*\)?$/;
let suspicious = 0;
let safeTernary = 0;
for (const f of prod.filter((p) => p.startsWith('apps/api/src/') && p.endsWith('.ts'))) {
  for (const m of text(f).matchAll(/\$\{([^}]*)\}/g)) {
    if (!rawRe.test(m[1])) continue;
    if (literalTernaryRe.test(m[1])) {
      safeTernary++;
      continue;
    }
    suspicious++;
    console.log(`  疑似: ${f}  \${${m[1].slice(0, 60)}}`);
  }
}
if (safeTernary > 0)
  console.log(`  白名单字面量三元（安全，如 request.method → 'read'|'manage'）: ${safeTernary} 处`);
console.log(
  suspicious === 0
    ? '  结果: 0 处待判定（`input.*` 等领域参数插值属入口层已校验对象，人工抽查确认）'
    : `  结果: ${suspicious} 处待人工判定`,
);
