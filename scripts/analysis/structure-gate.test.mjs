// structure-gate 自测（node --test）：断言 G1/G2/G3/G4 对违规样本必须拦截、对合法样本必须放行。
// 由根 package.json 的 test:release-guardrails 调用（pnpm test 的第一段），防止门禁本身形同虚设。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FILE_LINES,
  MAX_NESTING,
  nestingViolations,
  routeValidatorViolations,
  sizeViolations,
  sqlRawInputViolations,
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

test('G3 放行 $N 占位符构造与白名单字面量三元', () => {
  const ok = [
    'const sql = `SELECT * FROM t WHERE id = $${String(values.push(id) - 1)}`;',
    "const sql = `SELECT * FROM t WHERE op = ${request.method === 'GET' ? 'read' : 'manage'}`;",
    'const sql = `SELECT * FROM t WHERE scope = ${anchor.scope}`;',
  ].join('\n');
  assert.equal(sqlRawInputViolations('apps/api/src/x-repositories.ts', ok).length, 0);
});

test('G4 拦截无 validate 的路由定义', () => {
  const bad = 'export const route = defineRoute({ method: "POST", path: "/x" });';
  assert.equal(routeValidatorViolations('apps/api/src/routes/x.ts', bad).length, 1);
});

test('G4 放行带 validate 的路由定义', () => {
  const ok =
    'export const route = defineRoute({ method: "POST", path: "/x", validate: objectBody });';
  assert.equal(routeValidatorViolations('apps/api/src/routes/x.ts', ok).length, 0);
});

test('嵌套阈值与文件阈值等于 D5 默认提案', () => {
  assert.equal(MAX_FILE_LINES, 800);
  assert.equal(MAX_NESTING, 5);
});
