// U3-MFG-3 / MFG-3B：工艺路线控制台宿主——原 vanilla「工艺路线与工序」卡片迁移至 Preact
// （U3-MFG-3）；独立成文件（bom-host.ts 范式，不再往 console-entry.ts 追加：G1 ≤800 行，
// TD-PROC-005），并随制造主数据子路由化（MFG-3B）成为 #/manufacturing/routings 的路由
// 视图：节段自身携带 data-route-view、直接挂工作区根（与其它商业控制台宿主同口径；挂载
// 与否由 manufacturing-view 按该路由可见性决定）。默认视图沿用路由加载的全量快照；筛选态
// 经 controller.api.get 走桥轨分页；详情经 additive
// GET /api/v1/manufacturing-routings/:routingId，失败回退列表行。产品类型计数经 items
// 视图 itemId→itemType 预聚（productTypeOf）。onRefreshed：refresh 端口在 controller.load
// 重读完成后调用（概览汇总卡据此重算——路由视图只构建一次，面板不会随控制台的写操作重建）。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { RoutingConsolePorts } from './routing-ports';

export function appendManufacturingRoutingConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
  onRefreshed?: () => void,
): void {
  const { controller, permissions } = context;
  const routingPath = '/api/v1/manufacturing-routings';
  const read = controller.api.get;
  const recordText = context.ports.recordText;
  // 已发布物料版本选项与 legacy 工艺路线表单同源同公式（label = `SKU · 名称`）。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
      itemId: recordText(item, 'itemId', 'itemId'),
    }));
  const productTypeByItemId = new Map(
    (controller.views.get('/api/v1/manufacturing-items') ?? []).map((item) => [
      recordText(item, 'itemId', 'itemId'),
      recordText(item, 'itemType', 'itemType'),
    ]),
  );
  const pageUrl = (params: Readonly<Record<string, string | number>>): string => {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    return query ? `${routingPath}?${query}` : routingPath;
  };
  const ports: RoutingConsolePorts = {
    permissions,
    initialRoutings: controller.views.get(routingPath) ?? [],
    itemVersionChoices,
    productTypeOf: (productItemId) => productTypeByItemId.get(productItemId) ?? '',
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    businessStateLabel: (value, fallback) => context.ports.businessStateLabel(value, fallback),
    fetchPage: async (query) => {
      if (!read) return { items: [], nextCursor: null };
      const page = await read(
        pageUrl({
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.query === undefined ? {} : { query: query.query }),
          ...(query.productType === undefined ? {} : { productType: query.productType }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        }),
      );
      return {
        items: Array.isArray(page.items) ? page.items : [],
        nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
      };
    },
    loadDetail: async (routingId) => {
      if (!read) return null;
      return await read(`${routingPath}/${encodeURIComponent(routingId)}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      onRefreshed?.();
      return controller.views.get(routingPath) ?? [];
    },
  };
  const section = el('section', 'commercial-console manufacturing-routings-console');
  section.setAttribute('data-testid', 'kt-mfg-routings');
  section.setAttribute('data-route-view', 'manufacturing/routings');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'manufacturing-routings', ports });
  });
}
