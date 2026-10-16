import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createSupplierPanel } from './supplier-register';
import { createSourcingPanel } from './sourcing-register';
import { createOrderPanel } from './purchase-register';
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
    receipts = controller.views.get('/api/v1/goods-receipts') ?? [],
    locations = controller.views.get('/api/v1/inventory-locations') ?? [],
    balances = controller.views.get('/api/v1/inventory-balances') ?? [],
    manufacturingItems = controller.views.get('/api/v1/manufacturing-items') ?? [];
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
  const grid = el('div', 'procurement-grid');
  const supplierPanel = createSupplierPanel(context, suppliers, manufacturingItems, refresh);
  const sourcingPanel = createSourcingPanel(
    context,
    rfqs,
    supplierQuotes,
    suppliers,
    manufacturingItems,
    refresh,
  );
  const orderPanel = createOrderPanel(
    context,
    purchaseOrders,
    receipts,
    suppliers,
    manufacturingItems,
    locations,
    refresh,
  );
  const inventoryPanel = createInventoryPanel(context, balances, locations, refresh);
  grid.append(supplierPanel, sourcingPanel, orderPanel, inventoryPanel);
  panel.append(grid);
  workspace.append(panel);
}
