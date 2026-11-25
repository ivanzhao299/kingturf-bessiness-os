// U3-PROC-3 / PROC-2：采购单控制台宿主——PO 区迁移至 Preact（U3-PROC-3）；PROC-2 自
// console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式），并随采购域子路由化成为
// #/procurement/purchase-orders 的路由视图：节段自身携带 data-route-view、直接挂工作区根
// （与其它商业控制台宿主同口径；挂载与否由 procurement-view 按该路由可见性决定）。详情经
// 桥轨 additive GET /api/v1/purchase-orders/:id，失败回退列表行；采购合同文档工作流随控制台
// 迁移——PURCHASE 主体文档在 vanilla 仅挂 PO 卡片，PO 卡片退役则文档链唯一挂载点消失，
// 故等价迁移至详情抽屉。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import {
  itemVersionChoicesOf,
  ITEM_VERSIONS_PATH,
  perView,
  type Choice,
  type ItemVersionChoice,
} from './console-choices';
import type { PurchaseOrderConsolePorts } from './po-ports';

export function appendPurchaseOrderConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本/供应商选项与原 vanilla 采购订单表单同源。TD-WF-007：按最新视图计算，不再是挂载时的快照——
  // 在「供应商与准入」页新建的供应商，回到这里打开表单就能选到。
  const readItemVersionChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, recordText),
  );
  const readSupplierChoices = perView(controller.views, '/api/v1/suppliers', (rows) =>
    rows.map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'supplierNumber', 'supplier_number')} · ${recordText(item, 'name', 'name')}`,
    })),
  );
  const snapshot = () => ({
    orders: controller.views.get('/api/v1/purchase-orders') ?? [],
    documents: controller.views.get('/api/v1/contract-documents') ?? [],
  });
  const ports: PurchaseOrderConsolePorts = {
    permissions,
    initialOrders: snapshot().orders,
    get itemVersionChoices(): readonly ItemVersionChoice[] {
      return readItemVersionChoices();
    },
    get supplierChoices(): readonly Choice[] {
      return readSupplierChoices();
    },
    initialDocuments: snapshot().documents,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    decimalValue: (value) => context.ports.decimalValue(value),
    businessStateLabel: (value, fallback) => context.ports.businessStateLabel(value, fallback),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    uploadContractDocument: async (businessType, subjectType, subjectId, file) => {
      const uploaded = await controller.api.uploadContractDocument?.(
        businessType,
        subjectType,
        subjectId,
        file,
      );
      return uploaded ?? {};
    },
    loadDetail: async (orderId) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/purchase-orders/${orderId}`);
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  const section = el('section', 'commercial-console purchase-orders-console');
  section.setAttribute('data-testid', 'kt-proc-purchase-orders');
  section.setAttribute('data-route-view', 'procurement/purchase-orders');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'purchase-orders', ports });
  });
}
