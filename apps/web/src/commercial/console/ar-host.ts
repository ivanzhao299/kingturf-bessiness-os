// FIN-1：应收控制台宿主——原 vanilla「应收与账龄」卡片迁移至 Preact；节段自带 data-route-view
// （receivables）与 data-testid=kt-ar-console，直接挂工作区根（bom-host 范式，不向 console-entry
// 追加）。行与汇总经 controller.api.get 走桥轨加性分页（带 summary=1），详情经 additive
// GET /api/v1/ar-open-items/:id（失败回退列表行）；过账经 controller.submit 走既有端点。
// 本文件被 bootstrap 静态引用：页面模块只做 type import，运行时常量取自零依赖的 ar-ports.ts。
import { perView } from './console-choices';
import {
  finDetailUrl,
  finHostSection,
  finMount,
  finReadPage,
  finRecord,
  finTextOf,
  type FinHostContext,
} from './fin-host-kit';
import { AR_LIST_PATH, type ArConsolePorts, type ArPage } from './ar-ports';

const SALES_ORDERS_PATH = '/api/v1/sales-orders';

export function appendArConsole(context: FinHostContext): void {
  const { workspace, controller, permissions, appRoutes, ports: viewPorts } = context;
  const read = controller.api.get;
  // 选项与旧版「过账应收发票」表单同源同公式（label = `订单号 · 币种 订单总额`；订单视图里的
  // 全部订单，不做收紧）。TD-WF-007：按最新视图计算，不再是挂载时的快照。
  const readOrderChoices = perView(controller.views, SALES_ORDERS_PATH, (rows) =>
    rows.map((item) => ({
      value: finTextOf(item.id, ''),
      label: `${viewPorts.recordText(item, 'orderNumber', 'order_number')} · ${viewPorts.recordText(item, 'currency', 'currency')} ${viewPorts.recordText(item, 'total', 'total')}`,
    })),
  );
  const ports: ArConsolePorts = {
    permissions,
    textValue: (value, fallback = '') => finTextOf(value, fallback),
    recordText: (record, camel, snake, fallback) =>
      viewPorts.recordText(record, camel, snake, fallback),
    get salesOrderChoices() {
      return readOrderChoices();
    },
    // 所选订单的当前行：取最新视图（同旧版 orders.find）。
    orderOf: (salesOrderId) =>
      (controller.views.get(SALES_ORDERS_PATH) ?? []).find((item) => item.id === salesOrderId),
    fetchPage: async (query) => {
      const page = await finReadPage(read, AR_LIST_PATH, query);
      const summary = page.summary;
      const arPage: ArPage = {
        items: page.items,
        nextCursor: page.nextCursor,
        ...(summary === undefined
          ? {}
          : { summary: Array.isArray(summary) ? summary.map(finRecord) : [] }),
      };
      return arPage;
    },
    loadDetail: async (arOpenItemId) =>
      read ? await read(finDetailUrl(AR_LIST_PATH, arOpenItemId)) : null,
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
    },
    routeVisible: (route) => appRoutes.has(route),
  };
  const section = finHostSection('ar-console', 'kt-ar-console', 'receivables');
  workspace.append(section);
  finMount(section, { kind: 'receivables', ports });
}
