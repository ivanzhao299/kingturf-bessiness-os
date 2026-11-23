// U3-MFG-2：BOM 控制台宿主——原 vanilla「BOM 与替代料」卡片迁移至 Preact（同 MFG-1
// 宿主口径：挂 manufacturing-workbench 面板内、不带 data-route-view——自 console-entry
// 拆出以守住其 G1 ≤800 行（TD-PROC-005 增长点）。默认视图沿用路由加载的全量快照；
// 筛选态经 controller.api.get 走桥轨分页；详情经 additive
// GET /api/v1/manufacturing-boms/:bomId，失败回退列表行。产品类型计数经 items 视图
// itemId→itemType 预聚（productTypeOf），不对 BOM 快照做类型推断。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { BomConsolePorts } from './bom-ports';

export function appendManufacturingBomConsole(
  context: OperationsViewContext,
  target: HTMLElement,
): void {
  const { controller, permissions } = context;
  const bomPath = '/api/v1/manufacturing-boms';
  const read = controller.api.get;
  const recordText = context.ports.recordText;
  // 已发布物料版本选项与 legacy 物料卡片 BOM 表单同源同公式（label = `SKU · 名称`）。
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
    return query ? `${bomPath}?${query}` : bomPath;
  };
  const ports: BomConsolePorts = {
    permissions,
    initialBoms: controller.views.get(bomPath) ?? [],
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
    loadDetail: async (bomId) => {
      if (!read) return null;
      return await read(`${bomPath}/${encodeURIComponent(bomId)}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      return controller.views.get(bomPath) ?? [];
    },
  };
  const section = el('section', 'commercial-console manufacturing-boms-console');
  section.setAttribute('data-testid', 'kt-mfg-boms');
  target.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'manufacturing-boms', ports });
  });
}
