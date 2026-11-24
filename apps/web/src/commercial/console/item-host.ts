// U3-MFG-1 / MFG-3B：物料控制台宿主——原 vanilla「物料与规格版本」卡片区迁移至 Preact
// （U3-MFG-1）；MFG-3B 自 console-entry 拆出为独立宿主文件（bom-host.ts / routing-host.ts
// 范式），并随制造主数据子路由化成为 #/manufacturing/items 的路由视图：节段自身携带
// data-route-view、直接挂工作区根（与其它商业控制台宿主同口径；挂载与否由
// manufacturing-view 按该路由可见性决定）。默认视图沿用路由加载的全量快照；筛选态经
// controller.api.get 走桥轨分页；详情经 additive GET /api/v1/manufacturing-items/:itemId，
// 失败回退列表行。onRefreshed：refresh 端口在 controller.load 重读完成后调用（概览汇总卡
// 据此重算——路由视图只构建一次，面板不会随控制台的写操作重建）。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { ItemConsolePorts } from './item-ports';

export function appendManufacturingItemConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
  onRefreshed?: () => void,
): void {
  const { controller, permissions } = context;
  const itemPath = '/api/v1/manufacturing-items';
  const read = controller.api.get;
  const pageUrl = (params: Readonly<Record<string, string | number>>): string => {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    return query ? `${itemPath}?${query}` : itemPath;
  };
  const ports: ItemConsolePorts = {
    permissions,
    initialItems: controller.views.get(itemPath) ?? [],
    recordText: (record, camel, snake, fallback) =>
      context.ports.recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    businessStateLabel: (value, fallback) => context.ports.businessStateLabel(value, fallback),
    fetchPage: async (query) => {
      if (!read) return { items: [], nextCursor: null };
      const page = await read(
        pageUrl({
          ...(query.itemType === undefined ? {} : { itemType: query.itemType }),
          ...(query.status === undefined ? {} : { status: query.status }),
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
    loadDetail: async (itemId) => {
      if (!read) return null;
      return await read(`${itemPath}/${encodeURIComponent(itemId)}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      onRefreshed?.();
      return controller.views.get(itemPath) ?? [];
    },
  };
  const section = el('section', 'commercial-console manufacturing-items-console');
  section.setAttribute('data-testid', 'kt-mfg-items');
  section.setAttribute('data-route-view', 'manufacturing/items');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'manufacturing-items', ports });
  });
}
