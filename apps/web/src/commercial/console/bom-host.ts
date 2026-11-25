// U3-MFG-2 / MFG-3B：BOM 控制台宿主——原 vanilla「BOM 与替代料」卡片迁移至 Preact
// （U3-MFG-2）；独立成文件（自 console-entry 拆出以守住其 G1 ≤800 行，TD-PROC-005 增长点），
// 并随制造主数据子路由化（MFG-3B）成为 #/manufacturing/boms 的路由视图：节段自身携带
// data-route-view、直接挂工作区根（与其它商业控制台宿主同口径；挂载与否由
// manufacturing-view 按该路由可见性决定）。默认视图沿用路由加载的全量快照；筛选态经
// controller.api.get 走桥轨分页；详情经 additive GET /api/v1/manufacturing-boms/:bomId，
// 失败回退列表行。产品类型计数经 items 视图 itemId→itemType 预聚（productTypeOf），
// 不对 BOM 快照做类型推断。onRefreshed：refresh 端口在 controller.load 重读完成后调用
// （概览汇总卡据此重算——路由视图只构建一次，面板不会随控制台的写操作重建）。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import {
  itemLabelByIdOf,
  itemVersionChoicesOf,
  ITEM_VERSIONS_PATH,
  perView,
  type ItemVersionChoice,
} from './console-choices';
import type { BomConsolePorts } from './bom-ports';

export function appendManufacturingBomConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
  onRefreshed?: () => void,
): void {
  const { controller, permissions } = context;
  const bomPath = '/api/v1/manufacturing-boms';
  const read = controller.api.get;
  const recordText = context.ports.recordText;
  // 已发布物料版本选项与 legacy 物料卡片 BOM 表单同源同公式（label = `SKU · 名称`）。
  // TD-WF-007：选项与产品类型索引都按最新视图计算（视图数组身份一变才重算），不再是挂载时的快照——
  // 在「物料管理」刚发布的物料，这里打开「新建 BOM」就能选到；左树的产品类型也认得它。
  const readItemVersionChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, recordText),
  );
  const readProductTypeByItemId = perView(
    controller.views,
    ITEM_VERSIONS_PATH,
    (rows) =>
      new Map(
        rows.map((item) => [
          recordText(item, 'itemId', 'itemId'),
          recordText(item, 'itemType', 'itemType'),
        ]),
      ),
  );
  const readProductLabels = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemLabelByIdOf(rows, recordText),
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
    get itemVersionChoices(): readonly ItemVersionChoice[] {
      return readItemVersionChoices();
    },
    productTypeOf: (productItemId) => readProductTypeByItemId().get(productItemId) ?? '',
    // TD-WF-010：列表「产品」列把 productItemId 解析成「SKU · 名称」（同样按最新视图计算）。
    productLabelOf: (productItemId) => readProductLabels().get(productItemId) ?? '',
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
      if (controller.submitReturningRecord)
        return controller.submitReturningRecord(path, payload, method);
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      onRefreshed?.();
      return controller.views.get(bomPath) ?? [];
    },
  };
  const section = el('section', 'commercial-console manufacturing-boms-console');
  section.setAttribute('data-testid', 'kt-mfg-boms');
  section.setAttribute('data-route-view', 'manufacturing/boms');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'manufacturing-boms', ports });
  });
}
