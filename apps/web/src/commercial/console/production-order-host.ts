// U3-MFG-4：工单控制台宿主——原 vanilla「生产工单与车间执行」卡片迁移至 Preact（挂
// production-workbench 面板内；面板与其 data-testid=production-workbench、路由标记保持
// 不变）。默认视图沿用路由加载的全量快照；筛选态经 controller.api.get 走桥轨分页；详情经
// additive GET /api/v1/production-orders/:id，失败回退列表行。
// 车间执行入口（工序报工 / 领退料 / 成品卷入库）的表单仍为 vanilla（MFG-5 报工入库
// 范围）：既有 appendProductionReport/Material/Output 原样挂进控制台详情抽屉，按钮、表单、
// 载荷与端点逐字节不变；提交成功后沿用 legacy 卡片的整站重载，再通知控制台重新同步。
import { el } from '../../dom';
import type { FulfillmentViewContext } from '../fulfillment-view-ports';
import {
  appendProductionMaterial,
  appendProductionOutput,
  appendProductionReport,
} from '../production-actions';
import type { CommercialApi } from '../types';
import type {
  ProductionOrderConsolePorts,
  ProductionOrderPageQuery,
  ProductionOrderRow,
} from './production-order-ports';

// 桥轨分页与详情读取需要 controller.api.get——FulfillmentViewContext 的 controller 最小面
// 不含 api（其余 vanilla 视图无需），仅本宿主加宽这一项。
export type ProductionOrderHostContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: FulfillmentViewContext['controller'] & {
    api: Readonly<Pick<CommercialApi, 'get'>>;
  };
  permissions: FulfillmentViewContext['permissions'];
  ports: FulfillmentViewContext['ports'];
}>;

const ORDERS_PATH = '/api/v1/production-orders';

const pageUrl = (params: Readonly<Record<string, string | number>>): string => {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return query ? `${ORDERS_PATH}?${query}` : ORDERS_PATH;
};

// 既有 vanilla 执行按钮挂进容器；返回卸载函数。门控（权限 × 状态）仍由 vanilla 函数判定。
const mountExecution = (
  context: ProductionOrderHostContext,
  container: HTMLElement,
  row: ProductionOrderRow,
  committed: () => Promise<void>,
): (() => void) => {
  const { recordValue } = context.ports;
  const state = context.ports.recordText(row, 'state', 'state');
  const operations = Array.isArray(row.operations) ? row.operations.map(recordValue) : [];
  const reports = Array.isArray(row.reports) ? row.reports.map(recordValue) : [];
  // 提交成功后的 refresh 交给控制台（committed → sync → ports.refresh：整站重载 + 状态行，
  // 与 legacy 卡片同式，且只重载一次）。
  const actions = el('div', 'production-actions');
  appendProductionReport(context, row, state, operations, actions, committed);
  appendProductionMaterial(context, row, state, actions, committed);
  appendProductionOutput(context, row, state, reports, actions, committed);
  container.append(actions);
  return () => {
    actions.remove();
  };
};

export function appendProductionOrderConsole(
  context: ProductionOrderHostContext,
  panel: HTMLElement,
): void {
  const { controller, permissions, status } = context;
  const { recordText, businessStateLabel, operationsNextAction } = context.ports;
  const read = controller.api.get;
  const items = controller.views.get('/api/v1/manufacturing-items') ?? [];
  const routings = controller.views.get('/api/v1/manufacturing-routings') ?? [];
  const ports: ProductionOrderConsolePorts = {
    permissions,
    initialOrders: controller.views.get(ORDERS_PATH) ?? [],
    // 选项与 legacy「建立生产工单」表单同源同公式（成品限已发布；工艺版本沿用全部路线）。
    itemVersionChoices: items
      .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
      .map((item) => ({
        value: recordText(item, 'id', 'id'),
        label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
      })),
    routingChoices: routings.map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
    })),
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    businessStateLabel: (value, fallback) => businessStateLabel(value, fallback),
    operationsNextAction: (state) =>
      typeof state === 'string' ? operationsNextAction('production', state) : '',
    fetchPage: async (query: ProductionOrderPageQuery) => {
      if (!read) return { items: [], nextCursor: null };
      const page = await read(
        pageUrl({
          ...(query.state === undefined ? {} : { state: query.state }),
          ...(query.query === undefined ? {} : { query: query.query }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        }),
      );
      return {
        items: Array.isArray(page.items) ? page.items : [],
        nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
      };
    },
    loadDetail: async (orderId) => {
      if (!read) return null;
      return await read(`${ORDERS_PATH}/${encodeURIComponent(orderId)}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    // 与 legacy 卡片的 refresh 同式：整站重载后把状态行换成 controller.message。
    refresh: async () => {
      await controller.load();
      status.textContent = controller.message;
      return controller.views.get(ORDERS_PATH) ?? [];
    },
    mountExecution: (container, row, committed) =>
      mountExecution(context, container, row, committed),
  };
  const section = el('section', 'commercial-console production-orders-console');
  section.setAttribute('data-testid', 'kt-production-orders');
  panel.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'production-orders', ports });
  });
}
