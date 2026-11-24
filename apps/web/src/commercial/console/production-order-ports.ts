// U3-MFG-4：工单控制台端口层——视图数据/提交经最小面（页面不依赖
// CommercialController，行为测试注入 double）。
export type ProductionOrderRow = Readonly<Record<string, unknown>>;

export type ProductionOrderPage = Readonly<{
  items: readonly ProductionOrderRow[];
  nextCursor: string | null;
}>;

// 服务端筛选分页参数（GET /api/v1/production-orders 查询串同构）。
export type ProductionOrderPageQuery = Readonly<{
  state?: string;
  query?: string;
  limit?: number;
  cursor?: string;
}>;

// 下拉选项（新建工单的成品版本 / 工艺版本选择）。
export type ProductionOrderChoice = Readonly<{ value: string; label: string }>;

export type ProductionOrderConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  // 路由加载的工单行全量快照（controller.views 同源；行含工序/物料/报工/成品卷/事件）。
  initialOrders: readonly ProductionOrderRow[];
  // 已发布物料版本选项（legacy 表单同源同公式：label = `SKU · 名称`，value = 版本行 id）。
  itemVersionChoices: readonly ProductionOrderChoice[];
  // 工艺版本选项（legacy 表单同源：全部路线，label = `编码 · 名称`，value = 版本行 id）。
  routingChoices: readonly ProductionOrderChoice[];
  recordText: (
    record: ProductionOrderRow,
    camel: string,
    snake: string,
    fallback?: string,
  ) => string;
  textValue: (value: unknown, fallback?: string) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  // 下一步提示（legacy 卡片「下一步：…」同源）。
  operationsNextAction: (state: unknown) => string;
  // 筛选态服务端分页（state/query + 工单 id keyset cursor）。
  fetchPage: (query: ProductionOrderPageQuery) => Promise<ProductionOrderPage>;
  // 详情读取（additive findProductionOrder：根行 + 工序进度 + 报工时间线 + 物料需求）。
  loadDetail: (orderId: string) => Promise<ProductionOrderRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<readonly ProductionOrderRow[]>;
  // 车间执行入口（工序报工 / 领退料 / 成品卷入库）：表单仍为 vanilla（MFG-5 报工入库
  // 范围），宿主把既有按钮挂进容器并返回卸载函数；载荷与端点逐字节不变。committed 在
  // 表单提交成功后被调用（legacy 卡片此处的 refresh），由控制台同步最新快照。
  mountExecution: (
    container: HTMLElement,
    row: ProductionOrderRow,
    committed: () => Promise<void>,
  ) => () => void;
}>;
