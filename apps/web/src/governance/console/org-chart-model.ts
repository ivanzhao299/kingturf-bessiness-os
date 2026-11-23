import { textOf, type ConsoleRow } from './ports';
import type { PagedSource } from './paged-source';

// GOV-UX ② 组织架构图模型（纯函数）：组织树 + 人数统计。人数口径=当前账号可见员工
//（employees 列表受 DataScope 过滤）按 organizationId 归集，直属/含下级两级合计；
// 分页未读尽或读取失败一律如实回传提示，不把下限冒充全量。
export type OrgNode = Readonly<{
  id: string;
  code: string;
  name: string;
  children: readonly OrgNode[];
}>;
export type OrgCount = Readonly<{ direct: number; subtree: number }>;
export type OrgCounts = Readonly<Record<string, OrgCount>>;
export type OrgHeadcount = Readonly<{
  byOrg: OrgCounts;
  unassigned: number;
  total: number;
  hint: string;
}>;

const parentOf = (row: ConsoleRow): string | null => {
  const parent = row.parentId;
  return typeof parent === 'string' && parent !== '' ? parent : null;
};

export const buildOrgTree = (rows: readonly ConsoleRow[]): readonly OrgNode[] => {
  const seen = new Set<string>();
  const walk = (parentId: string | null): readonly OrgNode[] =>
    rows
      .filter((row) => parentOf(row) === parentId)
      .flatMap((row) => {
        const id = String(row.id);
        // 父子环/重复 id 守卫：同一组织只挂载一次，避免无限递归。
        if (seen.has(id)) return [];
        seen.add(id);
        return [
          {
            id,
            code: textOf(row.code),
            name: textOf(row.name, textOf(row.code, '未命名组织')),
            children: walk(id),
          },
        ];
      });
  return walk(null);
};

const HINT_LOADING = '正在统计各部门人数…';

const collectIds = (nodes: readonly OrgNode[], out: Set<string>): void => {
  for (const node of nodes) {
    out.add(node.id);
    collectIds(node.children, out);
  }
};

const directCounts = (
  tree: readonly OrgNode[],
  employees: readonly ConsoleRow[],
): Readonly<{ direct: Map<string, number>; unassigned: number }> => {
  const ids = new Set<string>();
  collectIds(tree, ids);
  const direct = new Map<string, number>();
  let unassigned = 0;
  for (const employee of employees) {
    const organization = employee.organizationId;
    if (typeof organization === 'string' && ids.has(organization))
      direct.set(organization, (direct.get(organization) ?? 0) + 1);
    else unassigned += 1;
  }
  return { direct, unassigned };
};

export const headcountOf = (tree: readonly OrgNode[], source: PagedSource): OrgHeadcount => {
  if (source.error !== '')
    return { byOrg: {}, unassigned: 0, total: 0, hint: `人数统计暂不可用：${source.error}` };
  const { direct, unassigned } = directCounts(tree, source.rows);
  const byOrg: Record<string, OrgCount> = {};
  const rollup = (nodes: readonly OrgNode[]): number =>
    nodes.reduce((sum, node) => {
      const own = direct.get(node.id) ?? 0;
      const below = rollup(node.children);
      byOrg[node.id] = { direct: own, subtree: own + below };
      return sum + own + below;
    }, 0);
  rollup(tree);
  const total = String(source.rows.length);
  const hint = source.complete
    ? `徽章为直属 / 含下级的可见员工数（共 ${total} 名）${unassigned > 0 ? `；另有 ${String(unassigned)} 名员工归属未展示的组织` : ''}`
    : `人数统计基于已加载的前 ${total} 名可见员工（未读尽，徽章为下限）`;
  return { byOrg, unassigned, total: source.rows.length, hint };
};

export const orgHeadcountLoading = (): OrgHeadcount => ({
  byOrg: {},
  unassigned: 0,
  total: 0,
  hint: HINT_LOADING,
});
