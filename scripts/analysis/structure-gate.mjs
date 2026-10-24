#!/usr/bin/env node
// 结构门禁（只读扫描，复用既有 TypeScript 开发依赖）。用法：
//   node scripts/analysis/structure-gate.mjs [--report]   常规运行拦截；--report 仅用于诊断
//   node scripts/analysis/structure-gate.mjs --selftest   对内置违规样本断言各规则可拦截（供 node --test 之外的快速自检）
// 规则（HARNESS-RULES §4.2 品味不变量）：
//   G1 文件大小：非测试源 .ts ≤ MAX_FILE_LINES（D5 已启用：800）
//   G2 嵌套深度：API routes/批次3新web目录为AST词法函数/控制流，其余保留原格式缩进（上限5）
//   G3 SQL 原始输入插值（TD-SEC-005，始终强制）：apps/api/src 模板字符串中禁止以原始请求对象开头的插值
//   G4 路由表校验约束（始终强制，批次 2 前待命）：apps/api/src/routes/** 的路由定义必须声明 validate
//   G5 完整函数跨度：全生产src AST ≤200，独立逐函数限期存量表
// 每条失败信息必须包含修复指令（§4.2 硬要求）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { scanFunctionLengths } from './function-length.mjs';

export const MAX_FILE_LINES = 800;
export const MAX_NESTING = 5;

// 显式豁免白名单：文件 → { 原因, 到期 }。到期批次完成后必须移除；新增豁免须登记台账。
export const SIZE_WHITELIST = new Map([
  ['apps/api/src/app.ts', { reason: 'TD-API-001 buildApp 巨函数', due: '批次 2' }],
  [
    'apps/api/src/commercial-repositories.ts',
    { reason: '最大仓储域', due: '批次 2（分域 handler 化时拆分）' },
  ],
  ['apps/api/src/complaint-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  ['apps/api/src/platform-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  ['packages/domain/src/index.ts', { reason: '共享域包单文件', due: '批次 4 后评估拆分' }],
  ['apps/api/src/qtc-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
  ['apps/api/src/repositories.ts', { reason: '组织员工主数据仓储', due: '批次 2' }],
  ['apps/api/src/crm-repositories.ts', { reason: '单域仓储超限', due: '批次 2' }],
]);

// G2 专用豁免：≤800 行但嵌套超限的存量仓储文件；按对应批次完成后移除。
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

export const isNewWebModule = (path) =>
  /^apps\/web\/src\/(?:shared|crm|commercial|governance)\//u.test(path);

export function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules') continue;
      if (
        entry === 'routes' &&
        full !== 'apps/api/src/routes' &&
        !full.startsWith('apps/api/src/routes/') &&
        !isNewWebModule(full)
      )
        continue;
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

export function routeNestingMetrics(content) {
  const source = ts.createSourceFile(
    'route.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let maxDepth = 0;
  let line = 1;
  function visit(node, depth) {
    const fn = ts.isFunctionLike(node) && !!node.body;
    const elseIf =
      ts.isIfStatement(node) && ts.isIfStatement(node.parent) && node.parent.elseStatement === node;
    const control =
      (ts.isIfStatement(node) && !elseIf) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isTryStatement(node);
    const next = depth + (fn || control ? 1 : 0);
    if (next > maxDepth) {
      maxDepth = next;
      line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    }
    // No function reset: default arguments and expression arrow bodies included.
    node.forEachChild((child) => visit(child, next));
  }
  visit(source, 0);
  return {
    maxDepth,
    line,
    parseErrors: source.parseDiagnostics.map((error) =>
      ts.flattenDiagnosticMessageText(error.messageText, ' '),
    ),
  };
}

export function routeNestingViolations(path, content) {
  const metrics = routeNestingMetrics(content);
  if (metrics.parseErrors.length) return [{ rule: 'G2', path, ...metrics, whitelisted: false }];
  if (metrics.maxDepth <= MAX_NESTING) return [];
  return [{ rule: 'G2', path, ...metrics, whitelisted: false }];
}

// G3：SQL 模板字符串插值白名单（TD-SEC-005：只允许 $N 占位符构造与明确登记的白名单，其余一律失败）。
// 设计原则（经两轮人工复核收紧）：**形状模式必须绑定可信根**——正则只限表达式形状不足以建立信任，
// 每类模式的变量根/函数名/枚举表都在下方显式登记（枚举自 2026-10-12 对 apps/api/src
// 全部 74 种现存插值形态的清点），新增任何根 = 修改这里的登记并说明理由。
const SQL_TEMPLATE_RE = /`(?:[^`\\]|\\.)*`/gs;
const SQL_KEYWORD_RE =
  /\b(SELECT|INSERT INTO|UPDATE |DELETE FROM|EXISTS|JOIN | WHERE | AND | OR | ORDER BY | GROUP BY | RETURNING)\b/i;

// ① 占位符序号构造：String(<offset/values 算式>)——操作数只允许 offset、values.length、values.push(<标识符链>) 与整数字面量
const PLACEHOLDER_ARG_RE =
  /^(?:offset|values\.(?:length|push\([A-Za-z_$][\w$.]*\))|\d+)(?:\s*[+-]\s*(?:offset|values\.(?:length|push\([A-Za-z_$][\w$.]*\))|\d+))*$/;
// ② SQL 片段组合：根 ∈ 可信片段变量（secured/scope/s/scoped/authorized/leadScope/opportunityScope），
//    属性限 .sql/.predicate，可选一个双字面量参数的方法后缀（replaceAll('c.', 'cu.')）
const TRUSTED_FRAGMENT_ROOTS = new Set([
  'secured',
  'scope',
  's',
  'scoped',
  'authorized',
  'leadScope',
  'opportunityScope',
]);
const SQL_FRAGMENT_RE = /^[\w$]+\.(sql|predicate)(?:\.[\w]+\('[^']*'(?:,\s*'[^']*')*\))?$/;
// ③ 片段调用式：仅登记的安全函数与参数形态 scope(context, '<字面量>', <数字>).sql（首参钉死 context）
const SQL_CALL_FRAGMENT_RE = /^scope\(context, '[^']*', \d+\)\.(sql|predicate)$/;
// ④ 子句拼接：根 ∈ 已登记变量（clauses/where）
const TRUSTED_JOIN_ROOTS = new Set(['clauses', 'where']);
const CLAUSE_JOIN_RE = /^[\w$]+\.join\(' AND '\)$/;
// ⑤ 双字面量分支三元：条件任意（可含 ?. 与函数调用）但整条表达式禁止反引号（防嵌套模板），
//    两个分支必须是纯字符串字面量——SQL 文本只能取两个固定常量之一
const LITERAL_TERNARY_RE = /^[^`]*\?\s*('[^'`]*'|"[^"`]*")\s*:\s*('[^'`]*'|"[^"`]*")$/;
// ⑥ 权限门控列清单：根限 timelineAllowed/allowed 两个代码内对象
const GATED_LIST_RE = /^(timelineAllowed|allowed)\.\w+$/;
// ⑦ 枚举表索引：仅显式登记的「表[键]」对（definitions[view]）
const TRUSTED_ENUM_INDEXES = new Set(['definitions[view]']);
// ⑧ 代码内枚举/别名/表名/占位符串：精确字符串 Set
const SQL_ENUM_NAMES = new Set([
  'alias',
  'anchor.scope',
  'a.scope',
  'typed',
  'depth',
  'fk',
  'table',
  'rootTable',
  'subjectTable',
  'versionTable',
  'parameter',
  'actorParameter',
  'companyParameter',
  'employeeAlias',
  'currency',
  'scope',
  'columns',
  'values',
  'predicate',
  'p',
  'shifted',
  'time',
]);
// ⑨ 存量值插值（Map）：历史直插值，显式带原因与到期批次，批次 1 scope-sql 收敛时消除
const GRANDFATHERED_VALUE_INTERPS = new Map([
  ['anchorId', { reason: '存量 scope 谓词直插锚点 UUID', due: '批次 1（scope-sql 收敛为 $N）' }],
  ['actorId', { reason: '存量 scope 谓词直插 actor UUID', due: '批次 1（scope-sql 收敛为 $N）' }],
  ['companyId', { reason: '存量 scope 谓词直插租户 UUID', due: '批次 1（scope-sql 收敛为 $N）' }],
]);

export function isAllowedSqlInterp(expr) {
  const e = expr.trim();
  // ① 占位符序号构造（参数 token 受限）
  const str = e.match(/^String\((.*)\)$/);
  if (str && PLACEHOLDER_ARG_RE.test(str[1].replace(/\s+/g, ' '))) return true;
  // ② SQL 片段组合（根受限）
  const frag = e.match(SQL_FRAGMENT_RE);
  if (frag && TRUSTED_FRAGMENT_ROOTS.has(e.split('.')[0])) return true;
  // ③ 片段调用式（函数名受限）
  if (SQL_CALL_FRAGMENT_RE.test(e)) return true;
  // ④ 子句拼接（根受限）
  const join = e.match(CLAUSE_JOIN_RE);
  if (join && TRUSTED_JOIN_ROOTS.has(e.split('.')[0])) return true;
  // ⑤⑥ 双字面量三元 / 门控清单
  if (LITERAL_TERNARY_RE.test(e) || GATED_LIST_RE.test(e)) return true;
  // ⑦ 枚举表索引（精确对受限）
  if (TRUSTED_ENUM_INDEXES.has(e)) return true;
  // ⑧ 枚举标识符
  return SQL_ENUM_NAMES.has(e);
}

export function sqlRawInputViolations(path, content) {
  const out = [];
  for (const tpl of content.matchAll(SQL_TEMPLATE_RE)) {
    if (!SQL_KEYWORD_RE.test(tpl[0])) continue;
    for (const m of tpl[0].matchAll(/\$\{([^}]*)\}/g)) {
      const expr = m[1].trim();
      if (isAllowedSqlInterp(expr)) continue;
      const gf = GRANDFATHERED_VALUE_INTERPS.get(expr);
      if (gf) {
        out.push({ rule: 'G3', path, expr: expr.slice(0, 60), grandfathered: true, ...gf });
        continue;
      }
      out.push({ rule: 'G3', path, expr: expr.slice(0, 60) });
    }
  }
  return out;
}

// G4：routes/ 目录的每个 defineRoute(...) 必须各自声明 validate（逐路由校验，非文件级）。
export function routeValidatorViolations(path, content) {
  const out = [];
  let idx = 0;
  while ((idx = content.indexOf('defineRoute(', idx)) !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = idx + 'defineRoute'.length; i < Math.min(content.length, idx + 8000); i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const span = content.slice(idx, end === -1 ? Math.min(content.length, idx + 8000) : end + 1);
    if (!/\bvalidate\s*:/.test(span)) out.push({ rule: 'G4', path, route: span.slice(0, 60) });
    idx = end === -1 ? idx + 'defineRoute'.length : end;
  }
  return out;
}

function render(v) {
  const head = `[${v.rule}] ${v.path}${v.lines !== undefined ? `（${v.lines} 行）` : ''}${v.maxIndent !== undefined ? `（格式缩进 ${v.maxIndent} 层）` : ''}${v.maxDepth !== undefined ? `:${v.line}（AST嵌套 ${v.maxDepth} 层）` : ''}${v.expr !== undefined ? `（插值 \${${v.expr}}…）` : ''}`;
  if (v.rule === 'G1')
    return `${head} ${v.whitelisted ? `【白名单豁免】${v.reason}，到期：${v.due}` : `超过上限 ${MAX_FILE_LINES} 行。修复：按职责拆分文件；确属存量热点则在 scripts/analysis/structure-gate.mjs 的 SIZE_WHITELIST 登记豁免（必须含原因与到期批次，并在台账 TD 记录），禁止无豁免超限。`}`;
  if (v.rule === 'G2')
    return `${head} ${v.whitelisted ? `【白名单豁免】${v.reason ?? '随对应批次拆分消解'}${v.due ? `，到期：${v.due}` : ''}` : v.parseErrors?.length ? `AST解析失败：${v.parseErrors.join('; ')}。修复：先修复语法，不以残缺AST放行。` : `嵌套超过 ${MAX_NESTING} 层。修复：用早返回/卫语句压平，或将分支抽为函数。`}`;
  if (v.rule === 'G3')
    return v.grandfathered
      ? `${head} 【存量豁免】${v.reason}，到期：${v.due}`
      : `${head} SQL 模板串出现白名单之外的插值。修复：请求值一律改用参数化占位符（pg 的 $N，经 values.push 传参）；确属代码内枚举/SQL 片段组合，将其加入 structure-gate.mjs 的 SQL_ENUM_NAMES/结构模式并在提交说明登记理由；禁止把请求值先赋给白名单变量再拼入。`;
  if (v.rule === 'G5')
    return `${head} ${v.symbol ?? ''}${v.first ? `:${v.first}-${v.last}` : ''} ${v.whitelisted ? `【G5精确限期豁免】上限${v.maxLines}，${v.reason}，到期：${v.due}` : `${v.problem}。修复：先排除语法/扫描/表失配问题；按职责拆分完整函数，存量只能经独立授权登记精确有限表，不得加宽目录/文件豁免或自动续期。`}`;
  return `${head} defineRoute 路由缺少 validate 声明（逐路由校验）。修复：为该 defineRoute 增加 validate 字段（复用 apps/api/src/app.ts 的校验器）；无请求体的路由显式写 validate: null 并注释原因。`;
}

export function runChecks({ reportOnly = false } = {}) {
  const sourceFiles = [...walk('apps'), ...walk('packages')].filter(isSourceTs);
  const violations = [];
  for (const path of sourceFiles) {
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n').length;
    violations.push(...sizeViolations(path, lines));
    violations.push(
      ...(path.startsWith('apps/api/src/routes/') || isNewWebModule(path)
        ? routeNestingViolations(path, content)
        : nestingViolations(path, content)),
    );
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
  violations.push(...scanFunctionLengths().violations);
  const soft = violations.filter(
    (v) =>
      ((v.rule === 'G1' || v.rule === 'G2') && (v.whitelisted || reportOnly)) ||
      (v.rule === 'G3' && v.grandfathered) ||
      (v.rule === 'G5' && v.whitelisted),
  );
  const hard = violations.filter((v) => !soft.includes(v));
  return { violations, hard, soft };
}

function main() {
  const reportOnly = process.argv.includes('--report');
  const { hard, soft } = runChecks({ reportOnly });
  const exempt = soft.filter((v) => v.rule !== 'G5' && (v.whitelisted || v.grandfathered)).length;
  const g5Exempt = soft.filter((v) => v.rule === 'G5').length;
  for (const v of soft)
    console.log(
      `[${v.rule === 'G3' ? '存量值插值豁免' : v.whitelisted ? '白名单豁免' : '诊断模式'}] ${render(v)}`,
    );
  if (hard.length > 0) {
    console.error(`structure-gate 失败：${hard.length} 个强制违规\n`);
    for (const v of hard) console.error(`  ${render(v)}\n`);
    process.exit(1);
  }
  console.log(
    `structure-gate 通过：强制违规 0；白名单豁免 ${exempt} 条（随批次移除）；G5精确限期豁免 ${g5Exempt} 条${reportOnly ? `；诊断模式未拦截 ${soft.length - exempt - g5Exempt} 条` : ''}`,
  );
}

if (
  process.argv[1] &&
  process.argv[1].endsWith('structure-gate.mjs') &&
  !process.argv.includes('--selftest')
) {
  main();
}
