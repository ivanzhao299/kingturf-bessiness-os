import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Run = { baseline: string; results: { name: string; [key: string]: unknown }[] };
const root = fileURLToPath(new URL('../../../', import.meta.url));
const probe = fileURLToPath(
  new URL('../../../scripts/analysis/app-preservation-probe.mjs', import.meta.url),
);
const run = (mode: string) =>
  JSON.parse(
    execFileSync(process.execPath, ['--experimental-transform-types', probe, mode], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as Run;
const baseline = run('baseline');
const current = run('current');
// B2（TD-API-003，行为变更已批）：治理列表 list 调用新增 parsePageFilter(request.query)
// 默认实参 { limit: 50 }（冻结 f3 基线不含该实参）。比对前仅从 trace 的 call 行参数
// 末尾移除该已批实参；其余 trace/响应字段仍与冻结基线逐字段相等。
const isPageFilterArg = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  (value as { limit?: unknown }).limit === 50;
// UI-M2（加性契约已批）：employees.list 新增可选 organization 过滤实参；无过滤时
// 恒为末尾 undefined，比对前同样移除（仅该一处，其余 trace 逐字段相等）。
// JSON 往返后 undefined 呈现为 null：尾参为 null/undefined 且其前恰为 pageFilter
// 默认实参时成对剥离（employees.list 的 UI-M2 organization 过滤；其余 list 不受影响）。
const stripApprovedOrganizationArg = (row: unknown): unknown => {
  if (
    !Array.isArray(row) ||
    row[0] !== 'call' ||
    row[2] !== 'list' ||
    !Array.isArray(row[3]) ||
    (row[3].at(-1) !== null && row[3].at(-1) !== undefined) ||
    !isPageFilterArg(row[3].at(-2))
  )
    return row;
  return ['call', row[1], row[2], row[3].slice(0, -1)];
};
const stripApprovedListArgs = (row: unknown): unknown => {
  // 先剥 UI-M2 组织过滤尾参（undefined），再剥 B2 pageFilter 默认实参。
  const withoutOrganization = stripApprovedOrganizationArg(row);
  if (
    !Array.isArray(withoutOrganization) ||
    withoutOrganization[0] !== 'call' ||
    !Array.isArray(withoutOrganization[3])
  )
    return withoutOrganization;
  const args = withoutOrganization[3] as unknown[];
  return isPageFilterArg(args.at(-1))
    ? ['call', withoutOrganization[1], withoutOrganization[2], args.slice(0, -1)]
    : withoutOrganization;
};
// A-F2a（A2-F8，行为变更已批）：登录路由上下文新增 audit 依赖访问；比对前从 trace
// 移除该已批 ["root","audit"] 行（仅该一处新增访问，其余 trace 逐字段相等）。
const stripApprovedAuditAccess = (row: unknown): boolean =>
  Array.isArray(row) && row.length === 2 && row[0] === 'root' && row[1] === 'audit';
// U3-COM-2/7（ADR-0015 接线，主协调已批）：dispatch 前段新增 dependencies.commercial
// 访问（Fastify 路由组认领门）；仅对 current 侧比对前移除该一处新增访问（首个
// ["root","commercial"] 行）——基线侧不做此剥离（其同键行属冻结基线自身）。
// credit 认领路径（U3-COM-7）复用既有 quoteToCash 依赖引用，未新增根访问行，
// 故无需额外剥离。
const stripApprovedBridgeAccess = (rows: unknown[]): unknown[] => {
  const index = rows.findIndex(
    (row) => Array.isArray(row) && row.length === 2 && row[0] === 'root' && row[1] === 'commercial',
  );
  return index === -1 ? rows : rows.filter((_, at) => at !== index);
};
const preserve = (result: { name: string; [key: string]: unknown }) => ({
  ...result,
  ...(Array.isArray(result.trace)
    ? {
        trace: result.trace
          .filter((row) => !stripApprovedAuditAccess(row))
          .map((row) => stripApprovedListArgs(row)),
      }
    : {}),
});
describe('Batch4 app extraction against fixed f3 complete request traces', () => {
  it('retains the frozen baseline and every scenario', () => {
    expect(current.baseline).toBe('f3f0c42aa8493f594076c03d3270f0c21de7ba78');
    expect(current.results.map((r) => r.name)).toEqual(baseline.results.map((r) => r.name));
    expect(current.results).toHaveLength(310);
  });
  // U3-COM-7（ADR-0015 接线，主协调已批）：credit 路径四场景（credit-limits/
  // credit-decisions GET/POST）现经生产桥处理——dispatch 组访问顺序发生授权内
  // 根本变化（遗留组探测被桥压缩，仓储调用与响应逐字段守恒）。按 A1-P3/A-F2a
  // 已批 re-pin 先例，四场景比对降级为响应+终止仓储调用（不含中间授权顺序）。
  const CREDIT_REPIN_SCENARIOS = new Set([
    'GET /api/v1/credit-limits',
    'POST /api/v1/credit-limits',
    'GET /api/v1/credit-decisions',
    'POST /api/v1/credit-decisions',
  ]);
  const preserveWithStrip = (result: {
    name: string;
    [key: string]: unknown;
  }): { name: string; [key: string]: unknown } => {
    const normalized = preserve(result);
    return Array.isArray(normalized.trace)
      ? { ...normalized, trace: stripApprovedBridgeAccess(normalized.trace) }
      : normalized;
  };
  for (const [index, row] of baseline.results.entries())
    it(row.name, () => {
      const currentRow = current.results[index];
      if (currentRow === undefined) throw new Error('Current scenario result missing');
      if (CREDIT_REPIN_SCENARIOS.has(row.name)) {
        // re-pin 降级：响应 + 终止 call 行（仓储方法与实参）逐字段相等；
        // 中间授权顺序因桥接流程发生根本变化，不在 re-pin 比对内。
        const terminalCalls = (run: unknown): unknown[] => {
          const trace = (run as { trace?: unknown }).trace;
          return Array.isArray(trace)
            ? trace.filter((candidate) => Array.isArray(candidate) && candidate[0] === 'call')
            : [];
        };
        const pinnedCurrent = preserveWithStrip(currentRow) as unknown as {
          response: unknown;
          trace?: unknown[];
          [key: string]: unknown;
        };
        const pinnedBaseline = preserve(row) as unknown as {
          response: unknown;
          trace?: unknown[];
          [key: string]: unknown;
        };
        expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
        expect(terminalCalls(pinnedCurrent)).toEqual(terminalCalls(pinnedBaseline));
        return;
      }
      expect(preserveWithStrip(currentRow)).toEqual(preserve(row));
    });
});
