// MFG-6：物料需求计划控制台端口层——视图数据 / 提交 / 详情经最小面（页面不依赖
// CommercialController，行为测试注入 double）。
export type MrpRow = Readonly<Record<string, unknown>>;
export type MrpPage = Readonly<{ items: readonly MrpRow[]; nextCursor: string | null }>;
// 建议列表的服务端筛选（GET /api/v1/mrp-proposals 查询串同构）。
export type MrpProposalQuery = Readonly<{
  runId?: string;
  state?: string;
  freezeOverride?: boolean;
  query?: string;
  limit?: number;
  cursor?: string;
}>;
// 路由加载时读进来的三个列表（controller.views 同源）。账号没有对应读权限时为 null：
// 页面上显示「—」并说明原因，不编一个 0。
export type MrpSnapshot = Readonly<{
  policies: readonly MrpRow[] | null;
  demands: readonly MrpRow[] | null;
  runs: readonly MrpRow[] | null;
}>;
export type MrpChoice = Readonly<{ value: string; label: string }>;

export type MrpConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initial: MrpSnapshot;
  // 已发布物料版本选项（legacy 表单同源：label = `SKU · 名称`，value = 版本行 id）。宿主把它挂成
  // 按最新视图计算的 getter：写操作之后重读视图，刚发布的物料就能选到（TD-WF-007 同款）。
  itemVersionChoices: readonly MrpChoice[];
  recordText: (record: MrpRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  // 下一步提示（legacy 卡片「下一步：…」同源）。
  operationsNextAction: (state: unknown) => string;
  fetchProposals: (query: MrpProposalQuery) => Promise<MrpPage>;
  // 批次详情（additive GET /api/v1/mrp-runs/:id：两个聚合 + 解释行项）；读不到返回 null。
  loadRunDetail: (runId: string) => Promise<MrpRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 刷新 MRP 相关数据源后取三个列表的最新快照。有来源失败时抛出，建议与详情仍可独立刷新。
  refresh: () => Promise<MrpSnapshot>;
}>;
