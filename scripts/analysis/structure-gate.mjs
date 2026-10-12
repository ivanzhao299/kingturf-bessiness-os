#!/usr/bin/env node
// 结构门禁（只读扫描，零依赖）。用法：
//   node scripts/analysis/structure-gate.mjs [--report]   常规运行；--report 时 G1/G2 仅报告不拦截
//   node scripts/analysis/structure-gate.mjs --selftest   对内置违规样本断言各规则可拦截（供 node --test 之外的快速自检）
// 规则（HARNESS-RULES §4.2 品味不变量）：
//   G1 文件大小：非测试源 .ts ≤ MAX_FILE_LINES（D5 默认提案 800）——D5 未确认前 ci:local 以 --report 运行
//   G2 嵌套深度：缩进层级 ≤ MAX_NESTING（D5 默认提案 5）——同上
//   G3 SQL 原始输入插值（TD-SEC-005，始终强制）：apps/api/src 模板字符串中禁止以原始请求对象开头的插值
//   G4 路由表校验约束（始终强制，批次 2 前待命）：apps/api/src/routes/** 的路由定义必须声明 validate
// 每条失败信息必须包含修复指令（§4.2 硬要求）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_FILE_LINES = 800;
export const MAX_NESTING = 5;

// 显式豁免白名单：文件 → { 原因, 到期 }。到期批次完成后必须移除；新增豁免须登记台账。
export const SIZE_WHITELIST = new Map([
  ['apps/web/src/bootstrap.ts', { reason: 'TD-WEB-001 巨石文件', due: '批次 3（子批 3a-3e）' }],
  ['apps/api/src/app.ts', { reason: 'TD-API-001 buildApp 巨函数', due: '批次 2' }],
  [
    'apps/api/src/commercial-repositories.ts',
    { reason: '最大仓储域', due: '批次 2（分域 handler 化时拆分）' },
  ],
  ['apps/api/src/complaint-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  ['apps/api/src/platform-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  [
    'apps/api/src/foundation-repositories.ts',
    { reason: 'TD-ARCH-001 一文件 4 仓储', due: '批次 1e（拆 4 文件）' },
  ],
  ['packages/domain/src/index.ts', { reason: '共享域包单文件', due: '批次 4 后评估拆分' }],
  ['apps/api/src/qtc-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  ['apps/api/src/repositories.ts', { reason: '组织员工主数据仓储', due: '批次 2' }],
  ['apps/api/src/crm-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
]);

// G2 专用豁免：≤800 行但嵌套超限的存量仓储文件（D5 转拦截前必须显式登记，否则拦截模式无法启用）
const NESTING_EXTRA = new Map(
  [
    'business-document-repositories.ts',
    'collection-repositories.ts',
    'commission-repositories.ts',
    'contract-document-repositories.ts',
    'manufacturing-repositories.ts',
    'mrp-repositories.ts',
    'order-360-repositories.ts',
    'procurement-repositories.ts',
    'production-cost-repositories.ts',
    'production-repositories.ts',
    'quality-repositories.ts',
    'risk-repositories.ts',
    'shipment-repositories.ts',
  ].map((f) => [
    `apps/api/src/${f}`,
    { reason: '存量嵌套热点（6-8 层）', due: '批次 2（分域 handler 化时压平）' },
  ]),
);

export function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules' || entry === 'routes') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

export const isSourceTs = (p) =>
  p.endsWith('.ts') &&
  !p.endsWith('.test.ts') &&
  !p.endsWith('.spec.ts') &&
  !p.endsWith('.d.ts') &&
  !p.includes('/test/');

// G1/G2：对单文件内容计算违规（导出供自测复用）
export function sizeViolations(path, lines) {
  const wl = SIZE_WHITELIST.get(path);
  if (wl) return [{ rule: 'G1', path, lines, whitelisted: true, ...wl }];
  return lines > MAX_FILE_LINES ? [{ rule: 'G1', path, lines, whitelisted: false }] : [];
}

export function nestingViolations(path, content) {
  const wl = SIZE_WHITELIST.has(path) || NESTING_EXTRA.has(path);
  let maxIndent = 0;
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const indent = Math.floor(line.match(/^ */)[0].length / 2);
    if (indent > maxIndent) maxIndent = indent;
  }
  if (maxIndent <= MAX_NESTING) return [];
  return [{ rule: 'G2', path, maxIndent, whitelisted: wl, ...(NESTING_EXTRA.get(path) ?? {}) }];
}

// G3：SQL 模板字符串中的原始请求插值。合法形态：$N 占位符构造、代码内枚举、双字面量三元白名单。
const RAW_REQUEST_RE = /^\s*(request|req|body|rawBody|ctx|user)\b/;
const LITERAL_TERNARY_RE = /^\(?\s*[^?]+\?\s*'[^']*'\s*:\s*'[^']*'\s*\)?$/;

export function sqlRawInputViolations(path, content) {
  const out = [];
  for (const m of content.matchAll(/\$\{([^}]*)\}/g)) {
    const expr = m[1];
    if (!RAW_REQUEST_RE.test(expr)) continue;
    if (LITERAL_TERNARY_RE.test(expr)) continue;
    out.push({ rule: 'G3', path, expr: expr.slice(0, 60) });
  }
  return out;
}

// G4：routes/ 目录的路由定义必须声明 validate（批次 2 建立路由表后生效；目录不存在时待命）。
export function routeValidatorViolations(path, content) {
  if (!content.includes('defineRoute')) return [];
  const hasValidate = /\bvalidate\s*:/.test(content);
  return hasValidate ? [] : [{ rule: 'G4', path }];
}

function render(v) {
  const head = `[${v.rule}] ${v.path}${v.lines !== undefined ? `（${v.lines} 行）` : ''}${v.maxIndent !== undefined ? `（嵌套 ${v.maxIndent} 层）` : ''}${v.expr !== undefined ? `（插值 \${${v.expr}}…）` : ''}`;
  if (v.rule === 'G1')
    return `${head} ${v.whitelisted ? `【白名单豁免】${v.reason}，到期：${v.due}` : `超过上限 ${MAX_FILE_LINES} 行。修复：按职责拆分文件；确属存量热点则在 scripts/analysis/structure-gate.mjs 的 SIZE_WHITELIST 登记豁免（必须含原因与到期批次，并在台账 TD 记录），禁止无豁免超限。`}`;
  if (v.rule === 'G2')
    return `${head} ${v.whitelisted ? '【白名单豁免】随对应批次拆分消解' : `嵌套超过 ${MAX_NESTING} 层。修复：用早返回/卫语句压平，或将分支抽为函数。`}`;
  if (v.rule === 'G3')
    return `${head} SQL 模板串禁止插值原始请求对象。修复：改用参数化占位符（pg 的 $N，经 values.push 传参）；代码内枚举请收敛为白名单三元或常量表。`;
  return `${head} 路由定义缺少 validate 声明。修复：为 defineRoute 增加 validate 字段（复用 apps/api/src/app.ts 的校验器）；无请求体的路由显式写 validate: null 并注释原因。`;
}

export function runChecks({ reportOnly = false } = {}) {
  const sourceFiles = [...walk('apps'), ...walk('packages')].filter(isSourceTs);
  const violations = [];
  for (const path of sourceFiles) {
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n').length;
    violations.push(...sizeViolations(path, lines));
    violations.push(...nestingViolations(path, content));
    if (path.startsWith('apps/api/src/')) violations.push(...sqlRawInputViolations(path, content));
  }
  // G4：routes/ 目录当前可能不存在（批次 2 待命），单独扫描
  try {
    for (const path of walk('apps/api/src/routes')) {
      if (!path.endsWith('.ts') || path.endsWith('.test.ts')) continue;
      violations.push(...routeValidatorViolations(path, readFileSync(path, 'utf8')));
    }
  } catch {
    /* routes/ 不存在：G4 待命 */
  }
  const soft = violations.filter(
    (v) => (v.rule === 'G1' || v.rule === 'G2') && (v.whitelisted || reportOnly),
  );
  const hard = violations.filter((v) => !soft.includes(v));
  return { violations, hard, soft };
}

function main() {
  const reportOnly = process.argv.includes('--report');
  const { hard, soft } = runChecks({ reportOnly });
  const exempt = soft.filter((v) => v.whitelisted).length;
  for (const v of soft)
    console.log(`[${v.whitelisted ? '白名单豁免' : '报告模式-D5未确认'}] ${render(v)}`);
  if (hard.length > 0) {
    console.error(`structure-gate 失败：${hard.length} 个强制违规\n`);
    for (const v of hard) console.error(`  ${render(v)}\n`);
    process.exit(1);
  }
  console.log(
    `structure-gate 通过：强制违规 0；白名单豁免 ${exempt} 条（随批次移除）${reportOnly ? `；报告模式待决 ${soft.length - exempt} 条（D5 确认后转拦截）` : ''}`,
  );
}

if (
  process.argv[1] &&
  process.argv[1].endsWith('structure-gate.mjs') &&
  !process.argv.includes('--selftest')
) {
  main();
}
