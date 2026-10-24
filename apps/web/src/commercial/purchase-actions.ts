import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function appendPurchaseActions(
  context: OperationsViewContext,
  orderPanel: HTMLElement,
  purchaseOrders: readonly Record<string, unknown>[],
  suppliers: readonly Record<string, unknown>[],
  manufacturingItems: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, decimalValue, inventoryLocationOption } = context.ports;
  if (permissions.has('procurement:manage')) {
    const supplierOptions = suppliers.map((item) => ({
      value: String(item.id),
      label: `${recordText(item, 'supplierNumber', 'supplier_number')} · ${recordText(item, 'name', 'name')}`,
    }));
    const itemOptions = manufacturingItems
      .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
      .map((item) => ({
        value: String(item.id),
        label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
      }));
    const createOrder = el('button', 'primary', '＋ 创建并签发采购订单');
    createOrder.addEventListener('click', () => {
      openForm(
        workspace,
        '创建采购订单',
        '订单只允许选择已准入供应商和已发布物料版本。',
        [
          { name: 'poNumber', label: '采购订单号', required: true },
          {
            name: 'supplierId',
            label: '供应商',
            type: 'select',
            required: true,
            options: supplierOptions,
          },
          {
            name: 'itemVersionId',
            label: '物料',
            type: 'select',
            required: true,
            options: itemOptions,
          },
          { name: 'quantity', label: '数量', type: 'number', required: true },
          { name: 'unitPrice', label: '含税单价', type: 'number', required: true },
          { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
        ],
        '签发采购订单',
        async (values) => {
          await controller.submit('/api/v1/purchase-orders', {
            poNumber: values.poNumber,
            supplierId: values.supplierId,
            supplierQuoteId: null,
            currency: 'CNY',
            issue: true,
            lines: [
              {
                itemVersionId: values.itemVersionId,
                quantity: values.quantity,
                unitPrice: values.unitPrice,
                requiredAt: values.requiredAt,
              },
            ],
          });
          await refresh();
        },
      );
    });
    orderPanel.append(createOrder);
    const openOrderLineOptions = purchaseOrders.flatMap((order) =>
      ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(order, 'status', 'status'))
        ? (Array.isArray(order.lines) ? order.lines.map(recordValue) : []).map((line) => ({
            value: `${String(order.id)}|${String(line.id)}`,
            label: `${recordText(order, 'poNumber', 'po_number')} · ${recordText(line, 'sku', 'sku')} · 未收 ${decimalValue(Number(line.quantity ?? 0) - Number(line.receivedQuantity ?? 0))}`,
          }))
        : [],
    );
    if (openOrderLineOptions.length && locations.length) {
      const receiveGoods = el('button', 'secondary', '＋ 登记批次收货');
      receiveGoods.addEventListener('click', () => {
        openForm(
          workspace,
          '登记采购收货',
          '收货将同时建立批次、收货证据和不可变 RECEIPT 库存移动。',
          [
            {
              name: 'orderLine',
              label: '采购订单行',
              type: 'select',
              required: true,
              options: openOrderLineOptions,
            },
            { name: 'receiptNumber', label: '收货单号', required: true },
            { name: 'sourceReference', label: '送货单号', required: true },
            { name: 'lotNumber', label: '供应批次号', required: true },
            {
              name: 'locationCode',
              label: '入库库位',
              type: 'select',
              required: true,
              options: locations.map((item) => ({
                ...inventoryLocationOption(item),
                value: recordText(item, 'code', 'code'),
              })),
            },
            { name: 'quantity', label: '实收数量', type: 'number', required: true },
            { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
          ],
          '过账收货',
          async (values) => {
            const [purchaseOrderId, purchaseOrderLineId] = (values.orderLine ?? '').split('|');
            await controller.submit('/api/v1/goods-receipts', {
              receiptNumber: values.receiptNumber,
              purchaseOrderId,
              receivedAt: new Date().toISOString(),
              sourceReference: values.sourceReference,
              lines: [
                {
                  purchaseOrderLineId,
                  lotNumber: values.lotNumber,
                  locationCode: values.locationCode,
                  quantity: values.quantity,
                  manufacturedAt: values.manufacturedAt,
                  expiresAt: null,
                },
              ],
            });
            await refresh();
          },
        );
      });
      orderPanel.append(receiveGoods);
    }
  }
}
