// U3-MFG-1：物料控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type ItemRow = Readonly<Record<string, unknown>>;

export type ItemPage = Readonly<{ items: readonly ItemRow[]; nextCursor: string | null }>;

// 服务端筛选分页参数（GET /api/v1/manufacturing-items 查询串同构）。
export type ItemPageQuery = Readonly<{
  itemType?: string;
  status?: string;
  query?: string;
  limit?: number;
  cursor?: string;
}>;

export type ItemConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  // 路由加载的物料版本行全量快照（controller.views 同源；默认视图与分类计数据此呈现）。
  initialItems: readonly ItemRow[];
  recordText: (record: ItemRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  // 筛选态服务端分页（itemType/status/query + (sku,version) keyset cursor）。
  fetchPage: (query: ItemPageQuery) => Promise<ItemPage>;
  // 详情读取（additive findItem：根行 + 版本历史 + 关联 BOM/工艺路线/最近工单）。
  loadDetail: (itemId: string) => Promise<ItemRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 全量刷新（controller.load：同步 vanilla BOM/路线表单依赖的已发布物料视图）。
  refresh: () => Promise<readonly ItemRow[]>;
}>;
