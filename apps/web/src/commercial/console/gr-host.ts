// U3-PROC-4：收货控制台宿主——收货区迁移至 Preact（同前三宿主口径：挂
// procurement-workbench 面板内、不带 data-route-view；详情经桥轨 additive
// GET /api/v1/goods-receipts/:id，失败回退列表行；可续收订单行/库位选项与原
// vanilla 登记收货表单同源同公式）。PROC-UX：批次追踪事实面经既有质检查询/
// 追溯/库存视图端点并行读取（403/失败 → null → 该面不可见），客户端组合时间线。
// PROC-2：自 console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式）；行为不变。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { GoodsReceiptConsolePorts } from './gr-ports';

export function appendGoodsReceiptConsole(
  context: OperationsViewContext,
  target: HTMLElement,
): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 可续收订单行选项：ISSUED/PARTIALLY_RECEIVED 行（未收数量标签，vanilla 同公式）。
  const openOrderLineChoices = (controller.views.get('/api/v1/purchase-orders') ?? []).flatMap(
    (order) =>
      ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(order, 'status', 'status'))
        ? (Array.isArray(order.lines) ? order.lines : []).map((line) => {
            const recordLine = context.ports.recordValue(line);
            return {
              value: `${recordText(order, 'id', 'id')}|${recordText(recordLine, 'id', 'id')}`,
              label: `${recordText(order, 'poNumber', 'po_number')} · ${recordText(recordLine, 'sku', 'sku')} · 未收 ${context.ports.decimalValue(Number(recordLine.quantity ?? 0) - Number(recordLine.receivedQuantity ?? 0))}`,
            };
          })
        : [],
  );
  // 活动库位选项：label 同 inventoryLocationOption、value=code（vanilla 同源）。
  const locationChoices = (controller.views.get('/api/v1/inventory-locations') ?? []).map(
    (item) => ({
      ...context.ports.inventoryLocationOption(item),
      value: recordText(item, 'code', 'code'),
    }),
  );
  const ports: GoodsReceiptConsolePorts = {
    permissions,
    initialReceipts: controller.views.get('/api/v1/goods-receipts') ?? [],
    openOrderLineChoices,
    locationChoices,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    decimalValue: (value) => context.ports.decimalValue(value),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    loadDetail: async (receiptId) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/goods-receipts/${receiptId}`);
    },
    // PROC-UX：批次追踪事实面（quality-inspections/lot-traceability/inventory-balances
    // 三端点并行；端点权限门控即可见性分层——无权限 403 或读取失败 → null，不拖垮详情）。
    loadTraceSources: async () => {
      const read = controller.api.get;
      const one = async (path: string) => {
        if (!read) return null;
        try {
          const body = (await read(path)) as { items?: unknown };
          return Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : null;
        } catch {
          return null;
        }
      };
      const [inspections, lots, balances] = await Promise.all([
        one('/api/v1/quality-inspections'),
        one('/api/v1/lot-traceability'),
        one('/api/v1/inventory-balances'),
      ]);
      return { inspections, lots, balances };
    },
    refresh: async () => {
      await controller.load();
      return controller.views.get('/api/v1/goods-receipts') ?? [];
    },
  };
  const section = el('section', 'commercial-console goods-receipts-console');
  section.setAttribute('data-testid', 'kt-proc-goods-receipts');
  target.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'goods-receipts', ports });
  });
}
