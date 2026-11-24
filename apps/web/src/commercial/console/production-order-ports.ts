// U3-MFG-4：工单控制台端口层——视图数据/提交经最小面（页面不依赖
// CommercialController，行为测试注入 double）。U3-MFG-5：车间执行的幂等键生成也经端口
// 注入（时间与随机属 IO）。
import type { ExecutionKeyKind } from './production-order-keys';

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
  // 车间执行幂等键——前端生成，不再让用户手填（形状见 production-order-keys.ts）。
  nextIdempotencyKey: (orderNumber: string, kind: ExecutionKeyKind) => string;
  // 尚未迁入控制台的执行入口（领退料 / 成品卷入库）：宿主把既有 vanilla 按钮挂进容器并
  // 返回卸载函数；载荷与端点逐字节不变。committed 在表单提交成功后被调用（legacy 卡片此处
  // 的 refresh），由控制台同步最新快照。
  mountExecution: (
    container: HTMLElement,
    row: ProductionOrderRow,
    committed: () => Promise<void>,
  ) => () => void;
}>;
