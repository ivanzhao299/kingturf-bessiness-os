import { el } from '../dom';
// PROC-2：采购域控制台样式并入宿主静态图（裁定15：cssCodeSplit:false 后随主 CSS 包静态加载）。
import './console/procurement-console.css';
import type { OperationsViewContext } from './operations-view-ports';
import {
  procurementSubRoutes,
  visibleProcurementSurfaces,
  type ProcurementConsoleId,
} from './procurement-surfaces';
import { appendProcurementSummary } from './procurement-summary';
import { appendSupplierConsole } from './console/supplier-host';
import { appendRfqConsole } from './console/rfq-host';
import { appendPurchaseOrderConsole } from './console/po-host';
import { appendGoodsReceiptConsole } from './console/gr-host';
import { createSourcingPanel } from './sourcing-register';
import { createInventoryPanel } from './inventory-register';

// PROC-2（TD-PROC-010）：采购域子路由化。子路由 → 控制台宿主；宿主节段自身即路由视图
// （携带 data-route-view，直接挂工作区根，与其它商业控制台同口径）。第三个参数：宿主的 refresh 端口在
// controller.load 重读完成后调用它（概览汇总卡据此重算，见下）。
const CONSOLE_HOSTS: Readonly<
  Record<
    ProcurementConsoleId,
    (context: OperationsViewContext, workspace: HTMLElement, onRefreshed?: () => void) => void
  >
> = {
  suppliers: appendSupplierConsole,
  rfqs: appendRfqConsole,
  'purchase-orders': appendPurchaseOrderConsole,
  'goods-receipts': appendGoodsReceiptConsole,
};

export function appendProcurementView(context: OperationsViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText } = context.ports;
  // PROC-2：概览页（#/procurement）——顶部四张汇总卡（口径与文案沿用）可点入对应子路由；
  // 下方保留 vanilla「供应商报价」「批次库存台账」两块台账（supplier-quotes 域与库存区
  // 未迁移，内容不改——原 U3-PROC-1..4 四控制台自此各迁一条子路由，见下方装配）。
  const panel = el('section', 'procurement-workbench');
  panel.setAttribute('data-testid', 'procurement-workbench');
  panel.append(
    el('p', 'eyebrow', '采购到入库'),
    el('h2', '', '供应商、采购与批次库存'),
    el('p', 'commercial-help', '采购待办汇总；下方为供应商报价与批次库存台账'),
  );
  const suppliers = controller.views.get('/api/v1/suppliers') ?? [],
    rfqs = controller.views.get('/api/v1/procurement-rfqs') ?? [],
    supplierQuotes = controller.views.get('/api/v1/supplier-quotes') ?? [],
    locations = controller.views.get('/api/v1/inventory-locations') ?? [],
    balances = controller.views.get('/api/v1/inventory-balances') ?? [];
  const refresh = async () => {
    await controller.load();
    status.textContent = controller.message;
  };
  // TD-PROC-013：汇总卡经取数回调读当前视图，并返回重算函数。路由视图只构建一次：在子路由新建供应商、
  // 发出询价、签发订单之后回到概览，面板不会重建，卡片靠重算函数更新文字。
  const refreshSummary = appendProcurementSummary(
    panel,
    () => ({
      suppliers: controller.views.get('/api/v1/suppliers') ?? [],
      rfqs: controller.views.get('/api/v1/procurement-rfqs') ?? [],
      purchaseOrders: controller.views.get('/api/v1/purchase-orders') ?? [],
      balances: controller.views.get('/api/v1/inventory-balances') ?? [],
    }),
    recordText,
    new Set<string>(procurementSubRoutes(permissions)),
  );
  const grid = el('div', 'procurement-grid');
  const sourcingPanel = createSourcingPanel(context, rfqs, supplierQuotes, suppliers, refresh);
  const inventoryPanel = createInventoryPanel(context, balances, locations, refresh);
  grid.append(sourcingPanel, inventoryPanel);
  panel.append(grid);
  workspace.append(panel);
  // 子路由页：每个控制台独占一条路由，只在该路由对当前账号可见时挂载（可见性与菜单同源）。
  for (const surface of visibleProcurementSurfaces(permissions))
    CONSOLE_HOSTS[surface.id](context, workspace, refreshSummary);
}
