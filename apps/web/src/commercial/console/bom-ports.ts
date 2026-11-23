// U3-MFG-2：BOM 控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type BomRow = Readonly<Record<string, unknown>>;

export type BomPage = Readonly<{ items: readonly BomRow[]; nextCursor: string | null }>;

// 服务端筛选分页参数（GET /api/v1/manufacturing-boms 查询串同构）。
export type BomPageQuery = Readonly<{
  status?: string;
  query?: string;
  productType?: string;
  limit?: number;
  cursor?: string;
}>;

// 已发布物料版本选项（新建 BOM 的产品/组件选择；legacy 物料卡片表单同源——
// label = `SKU · 名称`，value = 版本行 id；itemId 供载荷 productItemId 使用）。
export type ItemVersionChoice = Readonly<{
  value: string;
  label: string;
  itemId: string;
}>;

export type BomConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  // 路由加载的 BOM 版本行全量快照（controller.views 同源；默认视图与计数据此呈现）。
  initialBoms: readonly BomRow[];
  // 已发布物料版本选项（新建 BOM 产品/组件；legacy 表单同源同公式）。
  itemVersionChoices: readonly ItemVersionChoice[];
  // 产品物料类型解析（宿主经 items 视图 itemId→itemType 预聚；未知返回空串——
  // BOM 版本行不带产品类型，左树计数经此解析、不对快照做类型推断）。
  productTypeOf: (productItemId: string) => string;
  recordText: (record: BomRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  // 筛选态服务端分页（status/query/productType + (code,version) keyset cursor）。
  fetchPage: (query: BomPageQuery) => Promise<BomPage>;
  // 详情读取（additive findBom：根行 + 产品 + 版本行项 + 组件层级树）。
  loadDetail: (bomId: string) => Promise<BomRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 全量刷新（controller.load：同步物料控制台依赖的已发布物料视图等）。
  refresh: () => Promise<readonly BomRow[]>;
}>;
