// U3-MFG-3：工艺路线控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type RoutingRow = Readonly<Record<string, unknown>>;

export type RoutingPage = Readonly<{ items: readonly RoutingRow[]; nextCursor: string | null }>;

// 服务端筛选分页参数（GET /api/v1/manufacturing-routings 查询串同构）。
export type RoutingPageQuery = Readonly<{
  status?: string;
  query?: string;
  productType?: string;
  limit?: number;
  cursor?: string;
}>;

// 已发布物料版本选项（新建路线的产品选择；legacy 工艺路线表单同源——
// label = `SKU · 名称`，value = 版本行 id；itemId 供载荷 productItemId 使用）。
export type ItemVersionChoice = Readonly<{
  value: string;
  label: string;
  itemId: string;
}>;

export type RoutingConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  // 路由加载的工艺路线版本行全量快照（controller.views 同源）。
  initialRoutings: readonly RoutingRow[];
  itemVersionChoices: readonly ItemVersionChoice[];
  // 产品物料类型解析（宿主经 items 视图 itemId→itemType 预聚；未知返回空串——
  // 左树计数经此解析，不对路线快照做类型推断）。
  productTypeOf: (productItemId: string) => string;
  // 产品根 id → 「SKU · 名称」（列表「产品」列；解析不到返回空串，列里退回显示 id）。
  productLabelOf: (productItemId: string) => string;
  recordText: (record: RoutingRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  // 筛选态服务端分页（status/query/productType + (code,version) keyset cursor）。
  fetchPage: (query: RoutingPageQuery) => Promise<RoutingPage>;
  // 详情读取（additive findRouting：根行 + 产品 + 全部版本（工序 sequence 升序））。
  loadDetail: (routingId: string) => Promise<RoutingRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<readonly RoutingRow[]>;
}>;
