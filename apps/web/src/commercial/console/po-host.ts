// U3-PROC-3：采购单控制台宿主——PO 区迁移至 Preact（同供应商/询价宿主口径：挂
// procurement-workbench 面板内、不带 data-route-view；详情经桥轨 additive
// GET /api/v1/purchase-orders/:id，失败回退列表行；采购合同文档工作流随控制台
// 迁移——PURCHASE 主体文档在 vanilla 仅挂 PO 卡片，PO 卡片退役则文档链唯一
// 挂载点消失，故等价迁移至详情抽屉）。
// PROC-2：自 console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式）；行为不变。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { PurchaseOrderConsolePorts } from './po-ports';

export function appendPurchaseOrderConsole(
  context: OperationsViewContext,
  target: HTMLElement,
): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本/供应商选项与原 vanilla 采购订单表单同源。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const supplierChoices = (controller.views.get('/api/v1/suppliers') ?? []).map((item) => ({
    value: recordText(item, 'id', 'id'),
    label: `${recordText(item, 'supplierNumber', 'supplier_number')} · ${recordText(item, 'name', 'name')}`,
  }));
  const snapshot = () => ({
    orders: controller.views.get('/api/v1/purchase-orders') ?? [],
    documents: controller.views.get('/api/v1/contract-documents') ?? [],
  });
  const ports: PurchaseOrderConsolePorts = {
    permissions,
    initialOrders: snapshot().orders,
    itemVersionChoices,
    supplierChoices,
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
  target.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'purchase-orders', ports });
  });
}
