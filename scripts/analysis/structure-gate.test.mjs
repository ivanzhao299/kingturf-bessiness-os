// structure-gate 自测（node --test）：断言 G1/G2/G3/G4 对违规样本必须拦截、对合法样本必须放行。
// 由根 package.json 的 test:release-guardrails 调用（pnpm test 的第一段），防止门禁本身形同虚设。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  MAX_FILE_LINES,
  MAX_NESTING,
  nestingViolations,
  routeValidatorViolations,
  sizeViolations,
  sqlRawInputViolations,
  routeNestingMetrics,
  routeNestingViolations,
} from './structure-gate.mjs';

test('G1 拦截超限文件并附修复指令', () => {
  const v = sizeViolations('apps/api/src/new-hot.ts', MAX_FILE_LINES + 100);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, 'G1');
  assert.equal(v[0].whitelisted, false);
});

test('G1 白名单豁免必须携带原因与到期', () => {
  const v = sizeViolations('apps/api/src/app.ts', 99999);
  assert.equal(v.length, 1);
  assert.equal(v[0].whitelisted, true);
  assert.ok(v[0].reason && v[0].due, '豁免缺 reason/due');
});

test('G2 拦截 15 层嵌套', () => {
  const deep = ' '.repeat(2 * 15) + 'const x = 1;\n';
  const v = nestingViolations('apps/web/src/deep.ts', deep);
  assert.equal(v.length, 1);
  assert.equal(v[0].maxIndent, 15);
});

test('G2 放行 ≤5 层嵌套', () => {
  const flat = ' '.repeat(2 * 5) + 'const x = 1;\n';
  assert.equal(nestingViolations('apps/web/src/flat.ts', flat).length, 0);
});

test('G3 拦截 SQL 模板串中的原始请求插值', () => {
  const bad = 'const sql = `SELECT * FROM t WHERE name = ${request.body.name}`;';
  const v = sqlRawInputViolations('apps/api/src/x-repositories.ts', bad);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, 'G3');
});

test('G3 拦截任意白名单外插值（防 input.* 与裸变量绕过）', () => {
  const requestBypass = 'const sql = `SELECT * FROM t WHERE name = ${request.body.name}`;';
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', requestBypass).length, 1);
  const inputBypass = 'const sql = `SELECT * FROM t WHERE name = ${input.name}`;';
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', inputBypass).length, 1);
  const bareBypass = 'const sql = `SELECT * FROM t WHERE name = ${foo}`;';
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', bareBypass).length, 1);
});

test('G3 拦截不可信根的形状匹配（第二轮评审绕过样本）', () => {
  const untrustedRootBypasses = [
    'const q = `SELECT * FROM t WHERE x = ${input.sql}`;',
    'const q = `SELECT * FROM t WHERE x = ${input.predicate}`;',
    "const q = `SELECT * FROM t WHERE x = ${input.join(' AND ')}`;",
    'const q = `SELECT * FROM t WHERE x = ${String(input)}`;',
    'const q = `SELECT * FROM t WHERE x = ${input[view]}`;',
    'const q = `SELECT * FROM t WHERE x = ${foo[bar]}`;',
    "const q = `SELECT * FROM t WHERE x = ${scope(input, 'cu', 3).sql}`;",
    "const q = `SELECT * FROM t WHERE x = ${barclauses.join(' AND ')}`;",
    "const q = `SELECT * FROM t WHERE x = ${evil.replaceAll('c.', 'cu.')}`;",
  ];
  for (const sample of untrustedRootBypasses) {
    assert.equal(
      sqlRawInputViolations('apps/api/src/x-repositories.ts', sample).length,
      1,
      `应拦截：${sample}`,
    );
  }
});

test('G3 放行可信根的同类形状（与绕过样本一一对照）', () => {
  const ok = [
    'const q = `SELECT * FROM t WHERE x = ${secured.sql}`;',
    "const q = `SELECT * FROM t WHERE x = ${secured.sql.replaceAll('c.', 'cu.')}`;",
    "const q = `SELECT * FROM t WHERE x = ${scope(context, 'cu', 3).sql}`;",
    "const q = `SELECT * FROM t WHERE x = ${clauses.join(' AND ')}`;",
    'const q = `SELECT * FROM t WHERE x = ${String(offset + values.length - 1)}`;',
    'const q = `SELECT * FROM t WHERE x = ${definitions[view]}`;',
  ].join('\n');
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', ok).length, 0);
});

test('G3 放行白名单形态：占位符构造/片段组合/枚举/字面量三元/门控清单', () => {
  const ok = [
    'const sql = `SELECT * FROM t WHERE id = $${String(values.push(id) - 1)}`;',
    "const sql = `SELECT * FROM t WHERE op = ${request.method === 'GET' ? 'read' : 'manage'}`;",
    'const sql = `SELECT * FROM t WHERE scope = ${anchor.scope}`;',
    "const q = `SELECT * FROM t WHERE x = ${secured.sql} AND y = ${clauses.join(' AND ')}`;",
    "const q = `SELECT * FROM t WHERE op = ${commercial ? 'opportunities' : 'customers'}`;",
    'const q = `SELECT ${timelineAllowed.quote} FROM t`;',
    'const q = `SELECT * FROM t WHERE id = $${String(offset + values.length - 1)}`;',
    "const q = `SELECT * FROM t ${scope(context, 'cu', 3).sql}`;",
    "const q = `SELECT * FROM t ${secured.sql.replaceAll('c.', 'cu.')}`;",
    'const q = `SELECT * FROM ${definitions[view]} WHERE x = ${time}`;',
    "const q = `UPDATE t SET ${poolAssignment ? \",status='CLAIMED'\" : ''} WHERE id = $1`;",
    "const q = `SELECT * FROM t WHERE m = ${fieldReadable(context.sources?.quote, 'margin_basis_points', 'marginBasisPoints') ? 'TRUE' : 'FALSE'}`;",
  ].join('\n');
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', ok).length, 0);
});

test('G3 存量值插值标记为豁免而非放行（带原因与到期批次）', () => {
  const legacy = 'const sql = `SELECT * FROM t WHERE anchor = ${anchorId}`;';
  const v = sqlRawInputViolations('apps/api/src/x-repositories.ts', legacy);
  assert.equal(v.length, 1);
  assert.equal(v[0].grandfathered, true);
  assert.ok(v[0].reason && v[0].due);
});

test('G4 拦截无 validate 的路由定义', () => {
  const bad = 'export const route = defineRoute({ method: "POST", path: "/x" });';
  assert.equal(routeValidatorViolations('apps/api/src/routes/x.ts', bad).length, 1);
});

test('G4 逐路由校验：混合文件只报缺 validate 的路由', () => {
  const mixed = [
    'export const a = defineRoute({ method: "GET", path: "/a", validate: objectBody });',
    'export const b = defineRoute({ method: "POST", path: "/b" });',
    'export const c = defineRoute({ method: "PUT", path: "/c", validate: null });',
  ].join('\n');
  const v = routeValidatorViolations('apps/api/src/routes/mixed.ts', mixed);
  assert.equal(v.length, 1);
  assert.ok(v[0].route.includes('/b'));
});

test('G4 放行全部带 validate 的多路由文件', () => {
  const ok = [
    'export const a = defineRoute({ method: "GET", path: "/a", validate: objectBody });',
    'export const b = defineRoute({ method: "POST", path: "/b", validate: stringBody });',
  ].join('\n');
  assert.equal(routeValidatorViolations('apps/api/src/routes/all.ts', ok).length, 0);
});

test('嵌套阈值与文件阈值等于 D5 默认提案', () => {
  assert.equal(MAX_FILE_LINES, 800);
  assert.equal(MAX_NESTING, 5);
});

test('拦截模式：白名单信息放行，临时超限样本失败，清理后干净树通过', () => {
  const gate = join(process.cwd(), 'scripts/analysis/structure-gate.mjs');
  const clean = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /白名单豁免/);

  const tempRoot = mkdtempSync(join(process.cwd(), 'apps/.structure-gate-selftest-'));
  try {
    const sourceRoot = join(tempRoot, 'src');
    mkdirSync(sourceRoot);
    writeFileSync(
      join(sourceRoot, 'too-large.ts'),
      `${'const x = 1;\n'.repeat(MAX_FILE_LINES + 100)}`,
    );
    writeFileSync(
      join(sourceRoot, 'too-deep.ts'),
      `${' '.repeat(2 * (MAX_NESTING + 10))}const x = 1;\n`,
    );
    const blocked = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
    assert.equal(blocked.status, 1, `${blocked.stdout}\n${blocked.stderr}`);
    assert.match(`${blocked.stdout}\n${blocked.stderr}`, /超过上限 800 行/);
    assert.match(`${blocked.stdout}\n${blocked.stderr}`, /嵌套超过 5 层/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  const restored = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  assert.equal(restored.status, 0, restored.stderr);
});

const nestedIf = (depth) => 'if (ok) {'.repeat(depth) + 'work();' + '}'.repeat(depth);
const routePath = 'apps/api/src/routes/fixture.ts';

test('routes AST边界5放行/6拦截；非routes仍旧格式算法', () => {
  const valid = `function outer() { ${nestedIf(4)} }`;
  const invalid = `function outer() { ${nestedIf(5)} }`;
  assert.equal(routeNestingMetrics(valid).maxDepth, 5);
  assert.equal(routeNestingViolations(routePath, valid).length, 0);
  assert.equal(routeNestingMetrics(invalid).maxDepth, 6);
  assert.equal(routeNestingViolations(routePath, invalid)[0].whitelisted, false);
  assert.equal(nestingViolations('apps/other.ts', ' '.repeat(30) + 'work();')[0].maxIndent, 15);
});

for (const [label, wrapper] of [
  ['function declaration', (body) => `function f() {${body}}`],
  ['function expression', (body) => `(function () {${body}});`],
  ['arrow callback', (body) => `items.map(() => {${body}});`],
  ['method', (body) => `const obj = { method() {${body}} };`],
  ['constructor', (body) => `class C { constructor() {${body}} }`],
  ['getter', (body) => `class C { get value() {${body}} }`],
  ['setter', (body) => `class C { set value(v) {${body}} }`],
  ['for', (body) => `for (;;) {${body}}`],
  ['for of', (body) => `for (const v of items) {${body}}`],
  ['for in', (body) => `for (const v in items) {${body}}`],
  ['while', (body) => `while (ok) {${body}}`],
  ['do while', (body) => `do {${body}} while (ok);`],
  ['switch', (body) => `switch (key) {case 1: ${body} break; default: break;}`],
  ['try catch finally', (body) => `try {${body}} catch (e) {work();} finally {work();}`],
])
  test(`routes AST ${label}不reset祖先深度`, () => {
    const five = wrapper(nestedIf(4));
    const six = wrapper(nestedIf(5));
    assert.equal(routeNestingMetrics(five).maxDepth, 5);
    assert.equal(routeNestingViolations(routePath, five).length, 0);
    assert.equal(routeNestingMetrics(six).maxDepth, 6);
    assert.equal(routeNestingViolations(routePath, six)[0].whitelisted, false);
  });

test('routes AST else-if同级，else块新if加层；三元逐层计数', () => {
  assert.equal(routeNestingMetrics('if(a){} else if(b){} else if(c){} else {}').maxDepth, 1);
  assert.equal(routeNestingMetrics('if(a){} else { if(b){} }').maxDepth, 2);
  assert.equal(
    routeNestingMetrics('const x = a ? b : c ? d : e ? f : g ? h : i ? j : k;').maxDepth,
    5,
  );
  assert.equal(
    routeNestingViolations(
      routePath,
      'const x = a ? b : c ? d : e ? f : g ? h : i ? j : k ? l : m;',
    )[0].maxDepth,
    6,
  );
});

test('routes AST switch case/try各分支同级，不顺序叠加', () => {
  assert.equal(
    routeNestingMetrics('switch(x){case 1: work(); break; case 2: work(); break; default: work();}')
      .maxDepth,
    1,
  );
  assert.equal(
    routeNestingMetrics('try {if(a){}} catch(e) {if(b){}} finally {if(c){}}').maxDepth,
    2,
  );
});

test('routes AST不漏默认参数/表达式箭头，不因对象包装或短路重置', () => {
  assert.equal(routeNestingMetrics('function f(v = a ? b : c) {}').maxDepth, 2);
  assert.equal(routeNestingMetrics('const f = () => a ? b : c;').maxDepth, 2);
  assert.equal(
    routeNestingMetrics('function f(){if(a){ items.map(() => b ? c : d); }}').maxDepth,
    4,
  );
  assert.equal(
    routeNestingMetrics('const f = () => ok && {wrap: () => ok || (() => ok ?? (() => 1))};')
      .maxDepth,
    4,
  );
  assert.equal(routeNestingMetrics('const x = {a: {b: [1, 2]}};').maxDepth, 0);
});

test('routes AST语法残缺强制失败，不用部分AST放行', () => {
  assert.ok(routeNestingViolations(routePath, 'function broken( {')[0].parseErrors.length);
});

test('E1已撤：authorization深度5无豁免，同路径任意合法6/7层强制失败', () => {
  const path = 'apps/api/src/routes/authorization.ts';
  const content = readFileSync(path, 'utf8');
  assert.equal(routeNestingMetrics(content).parseErrors.length, 0);
  assert.equal(routeNestingMetrics(content).maxDepth, 5);
  assert.deepEqual(routeNestingViolations(path, content), []);
  for (const depth of [6, 7]) {
    const deeper = `function outer() {${nestedIf(depth - 1)}}`;
    assert.equal(routeNestingMetrics(deeper).parseErrors.length, 0);
    assert.equal(routeNestingMetrics(deeper).maxDepth, depth);
    assert.equal(routeNestingViolations(path, deeper)[0].whitelisted, false);
  }
});

test('真实CLI routes覆盖G1/G2/G3/G4，合法深格式通过，清理后全仓绿', () => {
  const gate = join(process.cwd(), 'scripts/analysis/structure-gate.mjs');
  const root = mkdtempSync(join(process.cwd(), 'apps/api/src/routes/.structure-selftest-'));
  const file = join(root, 'fixture.ts');
  const run = () => spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  try {
    for (const [label, content, marker] of [
      ['G1', '// filler\n'.repeat(801), /超过上限 800 行/u],
      ['G2', `function outer(){${nestedIf(5)}}`, /AST嵌套 6 层/u],
      ['G3', 'const q = `SELECT * FROM t WHERE x = ${input.value}`;', /SQL 模板串出现白名单之外/u],
      ['G4', 'defineRoute({ method: "POST", handler: () => 1 });', /缺少 validate/u],
    ]) {
      writeFileSync(file, content);
      const result = run();
      assert.equal(result.status, 1, `${label}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, marker);
      assert.ok(result.stderr.includes('.structure-selftest-'));
    }
    writeFileSync(
      file,
      ' '.repeat(40) +
        'const route = defineRoute({validate: null, handler: () => ({nested: {value: 1}})});',
    );
    const allowed = run();
    assert.equal(allowed.status, 0, allowed.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const clean = run();
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /白名单豁免 31 条/u);
});
