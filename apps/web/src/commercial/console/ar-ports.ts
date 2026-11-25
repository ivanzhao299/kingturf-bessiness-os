import type { FinLedgerUpdates } from './fin-host-kit';
// FIN-1：应收控制台端口层——页面不依赖 CommercialController，行为测试注入替身。
import type { FinPage, FinQuery, FinRow } from './fin-kit';

// 宿主（被 bootstrap 静态引用）只从本文件取运行时常量：这里没有任何运行时依赖。
export const AR_LIST_PATH = '/api/v1/ar-open-items';
export const AR_PAGE_SIZE = 50;

export type ArRow = FinRow;
// 一行一个币种（summary=1 时由服务端按币种聚合，币种之间不相加）。
export type ArSummaryRow = FinRow;
export type ArPage = FinPage & Readonly<{ summary?: readonly ArSummaryRow[] }>;
export type FinChoice = Readonly<{ value: string; label: string }>;

export type ArConsolePorts = Readonly<{
  ledgerUpdates?: FinLedgerUpdates;
  permissions: ReadonlySet<string>;
  textValue: (value: unknown, fallback?: string) => string;
  recordText: (record: FinRow, camel: string, snake: string, fallback?: string) => string;
  // 过账表单的销售订单选项：与旧版表单同源同公式，按最新视图计算（TD-WF-007）。
  salesOrderChoices: readonly FinChoice[];
  // 所选订单的当前行——载荷里的客户与币种取自它（同旧版 orders.find）。
  orderOf: (salesOrderId: string) => FinRow | undefined;
  // 桥轨加性分页：GET /api/v1/ar-open-items?summary=1…（行带客户 / 订单号与十进制金额）。
  fetchPage: (query: FinQuery) => Promise<ArPage>;
  // additive GET /api/v1/ar-open-items/:id；读不到返回 null，抽屉回退列表行。
  loadDetail: (arOpenItemId: string) => Promise<FinRow | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 整站重读（controller.load）：与旧版页面写后刷新同式。
  refresh: () => Promise<void>;
  // 跳转目标路由对当前账号可见时才渲染链接（否则会被导航兜底弹回首个可用路由）。
  routeVisible: (route: 'sales-orders' | 'customers') => boolean;
}>;
