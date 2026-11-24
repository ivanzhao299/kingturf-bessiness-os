import { el } from '../dom';
// PROC-2：采购域控制台样式并入宿主静态图（裁定15：cssCodeSplit:false 后随主 CSS 包静态加载）。
import './console/procurement-console.css';
import type { OperationsViewContext } from './operations-view-ports';
// PROC-2：四个控制台宿主自 console-entry 拆出为独立宿主文件（TD-PROC-005，同 bom-host.ts 范式）。
import { appendSupplierConsole } from './console/supplier-host';
import { appendRfqConsole } from './console/rfq-host';
import { appendPurchaseOrderConsole } from './console/po-host';
import { appendGoodsReceiptConsole } from './console/gr-host';
import { createSourcingPanel } from './sourcing-register';
import { createInventoryPanel } from './inventory-register';

export function appendProcurementView(context: OperationsViewContext): void {
  const { workspace, status, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'procurement-workbench');
  panel.setAttribute('data-testid', 'procurement-workbench');
  panel.append(
    el('p', 'eyebrow', '采购到入库'),
    el('h2', '', '供应商、采购与批次库存'),
    el('p', 'commercial-help', '供应商、询报价、采购与批次收货'),
  );
  const suppliers = controller.views.get('/api/v1/suppliers') ?? [],
    rfqs = controller.views.get('/api/v1/procurement-rfqs') ?? [],
    supplierQuotes = controller.views.get('/api/v1/supplier-quotes') ?? [],
    purchaseOrders = controller.views.get('/api/v1/purchase-orders') ?? [],
    locations = controller.views.get('/api/v1/inventory-locations') ?? [],
    balances = controller.views.get('/api/v1/inventory-balances') ?? [];
  const refresh = async () => {
    await controller.load();
    status.textContent = controller.message;
  };
  const procurementSummary = el('div', 'production-summary');
  procurementSummary.append(
    el(
      'div',
      'metric-card',
      `待准入供应商\n${String(suppliers.filter((item) => recordText(item, 'status', 'status') !== 'APPROVED').length)} 家`,
    ),
    el(
      'div',
      'metric-card',
      `询价进行中\n${String(rfqs.filter((item) => !['CLOSED', 'CANCELLED'].includes(recordText(item, 'status', 'status'))).length)} 单`,
    ),
    el(
      'div',
      'metric-card',
      `待收采购单\n${String(purchaseOrders.filter((item) => ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(item, 'status', 'status'))).length)} 单`,
    ),
    el(
      'div',
      'metric-card',
      `待检库存\n${String(balances.filter((item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE').length)} 批`,
    ),
  );
  panel.append(procurementSummary);
  // U3-PROC-1..4：供应商/询价/采购单/收货四区全部迁移至 Preact 控制台（挂
  // procurement-workbench 面板内——路由可见性随父面板；原 vanilla supplier 卡片、
  // RFQ 卡片与新建询价表单、PO 卡片与创建签发表单及合同文档工作流、收货卡片与
  // 登记收货表单全部退役，裁定 17 语义；inventory 区保持 vanilla）。
  appendSupplierConsole(context, panel);
  appendRfqConsole(context, panel);
  appendPurchaseOrderConsole(context, panel);
  appendGoodsReceiptConsole(context, panel);
  const grid = el('div', 'procurement-grid');
  const sourcingPanel = createSourcingPanel(context, rfqs, supplierQuotes, suppliers, refresh);
  const inventoryPanel = createInventoryPanel(context, balances, locations, refresh);
  grid.append(sourcingPanel, inventoryPanel);
  panel.append(grid);
  workspace.append(panel);
}
