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
  for (const [index, row] of baseline.results.entries())
    it(row.name, () => {
      const currentRow = current.results[index];
      if (currentRow === undefined) throw new Error('Current scenario result missing');
      expect(preserve(currentRow)).toEqual(preserve(row));
    });
});
