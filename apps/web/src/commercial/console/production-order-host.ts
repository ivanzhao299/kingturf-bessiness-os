// U3-MFG-4：工单控制台宿主——原 vanilla「生产工单与车间执行」卡片迁移至 Preact（挂
// production-workbench 面板内；面板与其 data-testid=production-workbench、路由标记保持
// 不变）。默认视图沿用路由加载的全量快照；筛选态经 controller.api.get 走桥轨分页；详情经
// additive GET /api/v1/production-orders/:id，失败回退列表行。
// U3-MFG-5：车间执行表单（工序报工 / 领退料 / 成品卷入库）迁入控制台抽屉，legacy 三张
// openForm 表单（production-actions.ts）退役。库存批次与库位选项取 controller.views 的当前
// 视图（与 legacy 表单同源：账号没有库存读权限时为空，不另发请求）；幂等键由前端生成。
import { el } from '../../dom';
import type { FulfillmentViewContext } from '../fulfillment-view-ports';
import type { CommercialApi } from '../types';
import { executionIdempotencyKey } from './production-order-keys';
import type {
  ProductionOrderConsolePorts,
  ProductionOrderPageQuery,
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
const BALANCES_PATH = '/api/v1/inventory-balances';
const LOCATIONS_PATH = '/api/v1/inventory-locations';

const pageUrl = (params: Readonly<Record<string, string | number>>): string => {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return query ? `${ORDERS_PATH}?${query}` : ORDERS_PATH;
};

export function appendProductionOrderConsole(
  context: ProductionOrderHostContext,
  panel: HTMLElement,
): void {
  const { controller, permissions, status } = context;
  const { recordText, businessStateLabel, operationsNextAction, inventoryLocationOption } =
    context.ports;
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
    // 车间执行幂等键由前端生成（时间与随机属 IO，经端口注入便于测试）。
    nextIdempotencyKey: (orderNumber, kind) => executionIdempotencyKey(orderNumber, kind),
    // 库存批次的当前视图：每次取值都读 controller.views，整站刷新后即是最新数据。
    inventoryBalances: () => controller.views.get(BALANCES_PATH) ?? [],
    inventoryLocationChoices: () =>
      (controller.views.get(LOCATIONS_PATH) ?? []).map((item) => inventoryLocationOption(item)),
  };
  const section = el('section', 'commercial-console production-orders-console');
  section.setAttribute('data-testid', 'kt-production-orders');
  panel.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'production-orders', ports });
  });
}
