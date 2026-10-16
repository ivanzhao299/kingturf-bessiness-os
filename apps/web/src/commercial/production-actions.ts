import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import type { CommercialPermission } from './permissions';

export function appendProductionTransition(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  state: string,
  actions: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText } = context.ports;
  const transitions: Record<string, readonly [string, string, CommercialPermission]> = {
    DRAFT: ['release', '下达工单', 'production:plan'],
    RELEASED: ['start', '开始生产', 'production:report'],
    IN_PROGRESS: ['complete', '完工确认', 'production:close'],
    COMPLETED: ['close', '关闭工单', 'production:close'],
  };
  const transition = transitions[state];
  if (transition && permissions.has(transition[2])) {
    const button = el('button', 'primary', transition[1]);
    button.addEventListener('click', () => {
      openForm(
        workspace,
        transition[1],
        '状态决定会追加到不可变工单事件台账，并执行完整性门禁。',
        [
          { name: 'reason', label: '操作理由', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '证据编号', required: true },
        ],
        '确认执行',
        async (values) => {
          await controller.submit(
            `/api/v1/production-orders/${String(order.id)}/${transition[0]}`,
            {
              reason: values.reason,
              evidence: { reference: values.evidenceReference },
              idempotencyKey: `${recordText(order, 'orderNumber', 'order_number')}-${transition[0].toUpperCase()}-${String(values.evidenceReference)}`,
            },
          );
          await refresh();
        },
      );
    });
    actions.append(button);
  }
}

export function appendProductionReport(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  state: string,
  operations: readonly Record<string, unknown>[],
  actions: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText } = context.ports;
  if (permissions.has('production:report') && state === 'IN_PROGRESS') {
    const report = el('button', 'secondary', '＋ 工序报工');
    report.addEventListener('click', () => {
      openForm(
        workspace,
        '登记工序报工',
        '每次报工使用唯一幂等键；累计良品不能超过工单计划数量。',
        [
          {
            name: 'operationId',
            label: '工序',
            type: 'select',
            required: true,
            options: operations.map((item) => ({
              value: String(item.id),
              label: `${recordText(item, 'sequence', 'sequence')} · ${recordText(item, 'name', 'name')}`,
            })),
          },
          { name: 'goodQuantity', label: '良品数量', type: 'number', required: true },
          {
            name: 'scrapQuantity',
            label: '废品数量',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'laborMinutes', label: '人工分钟', type: 'number', required: true },
          { name: 'machineMinutes', label: '设备分钟', type: 'number', required: true },
          { name: 'startedAt', label: '开始时间', type: 'datetime-local', required: true },
          { name: 'completedAt', label: '完成时间', type: 'datetime-local', required: true },
          { name: 'notes', label: '班组记录', type: 'textarea' },
          { name: 'idempotencyKey', label: '报工唯一键', required: true },
        ],
        '提交报工',
        async (values) => {
          await controller.submit(
            `/api/v1/production-orders/${String(order.id)}/operation-reports`,
            {
              ...values,
              startedAt: new Date(values.startedAt ?? '').toISOString(),
              completedAt: new Date(values.completedAt ?? '').toISOString(),
            },
          );
          await refresh();
        },
      );
    });
    actions.append(report);
  }
}

export function appendProductionMaterial(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  state: string,
  actions: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText } = context.ports;
  if (permissions.has('production:material') && (state === 'RELEASED' || state === 'IN_PROGRESS')) {
    const balances = controller.views.get('/api/v1/inventory-balances') ?? [];
    const material = el('button', 'secondary', '＋ 领料/退料');
    material.addEventListener('click', () => {
      openForm(
        workspace,
        '登记生产物料',
        '领料同步写入不可变库存移动；只能领用已放行且属于工单 BOM 的批次物料。',
        [
          {
            name: 'transactionType',
            label: '业务类型',
            type: 'select',
            required: true,
            options: [
              { value: 'ISSUE', label: '领料' },
              { value: 'RETURN', label: '退料' },
            ],
          },
          {
            name: 'balance',
            label: '批次库位',
            type: 'select',
            required: true,
            options: balances.map((item, index) => ({
              value: String(index),
              label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'lotNumber', 'lotNumber')} · ${recordText(item, 'locationCode', 'locationCode')} · 可用 ${recordText(item, 'quantity', 'quantity')}`,
            })),
          },
          { name: 'quantity', label: '数量', type: 'number', required: true },
          { name: 'reason', label: '领退料原因', type: 'textarea', required: true },
          { name: 'occurredAt', label: '发生时间', type: 'datetime-local', required: true },
          { name: 'idempotencyKey', label: '业务唯一键', required: true },
        ],
        '确认过账',
        async (values) => {
          const balance = balances[Number(values.balance)];
          if (!balance) throw new Error('请选择有效批次库位');
          await controller.submit(`/api/v1/production-orders/${String(order.id)}/materials`, {
            transactionType: values.transactionType,
            itemVersionId: balance.itemVersionId,
            lotId: balance.lotId,
            locationId: balance.locationId,
            quantity: values.quantity,
            reason: values.reason,
            occurredAt: new Date(values.occurredAt ?? '').toISOString(),
            idempotencyKey: values.idempotencyKey,
          });
          await refresh();
        },
      );
    });
    actions.append(material);
  }
}

export function appendProductionOutput(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  state: string,
  reports: readonly Record<string, unknown>[],
  actions: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText, inventoryLocationOption } = context.ports;
  if (permissions.has('production:report') && state === 'IN_PROGRESS' && reports.length) {
    const locations = controller.views.get('/api/v1/inventory-locations') ?? [];
    const output = el('button', 'secondary', '＋ 成品卷入库');
    output.addEventListener('click', () => {
      openForm(
        workspace,
        '登记成品卷与待检批次',
        '卷号、成品批次和正向库存收货在同一事务内生成，初始质量状态为待检。',
        [
          {
            name: 'operationReportId',
            label: '末工序报工',
            type: 'select',
            required: true,
            options: reports.map((item) => ({
              value: String(item.id),
              label: `${recordText(item, 'completedAt', 'completed_at')} · 良品 ${recordText(item, 'goodQuantity', 'good_quantity')}`,
            })),
          },
          { name: 'rollNumber', label: '成品卷号', required: true },
          { name: 'lotNumber', label: '成品批次号', required: true },
          {
            name: 'locationId',
            label: '入库库位',
            type: 'select',
            required: true,
            options: locations.map(inventoryLocationOption),
          },
          { name: 'quantity', label: '卷数量', type: 'number', required: true },
          { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
        ],
        '生成卷号并入库',
        async (values) => {
          await controller.submit(`/api/v1/production-orders/${String(order.id)}/finished-rolls`, {
            ...values,
            itemVersionId: recordText(order, 'itemVersionId', 'item_version_id'),
          });
          await refresh();
        },
      );
    });
    actions.append(output);
  }
}
