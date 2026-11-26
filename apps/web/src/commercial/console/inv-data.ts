import type { FormSectionField } from '@kingturf/ui';
import { finRows, finText, type FinRow } from './fin-kit';

export const BALANCES = '/api/v1/inventory-balances';
export const LOCATIONS = '/api/v1/inventory-locations';
export const MOVEMENTS = '/api/v1/inventory-movements';
export const MOVEMENT_SOURCES = '/api/v1/inventory-movement-sources';
export const ORDERS = '/api/v1/production-orders';
export const balanceId = (row: FinRow) => `${finText(row, 'lotId')}:${finText(row, 'locationId')}`;
export const movementOptions = [
  { value: 'ISSUE', label: '生产领用' },
  { value: 'RETURN', label: '退料入库' },
  { value: 'ADJUSTMENT_IN', label: '盘盈' },
  { value: 'ADJUSTMENT_OUT', label: '盘亏' },
];
export const qualityOptions = [
  { value: 'RELEASED', label: '可用' },
  { value: 'QUARANTINE', label: '待检' },
  { value: 'REJECTED', label: '隔离' },
];
export const locationOptions = [
  { value: 'RECEIVING', label: '收货区' },
  { value: 'STORAGE', label: '存储区' },
  { value: 'PRODUCTION', label: '生产区' },
  { value: 'QUARANTINE', label: '隔离区' },
  { value: 'SHIPPING', label: '发货区' },
];
export const sourceTypeOptions = [
  { value: 'WORK-ORDER', label: '生产工单' },
  { value: 'PRODUCTION_ORDER', label: '生产工单（生产台账）' },
  { value: 'GOODS_RECEIPT_LINE', label: '收货明细' },
  { value: 'PRODUCTION_ROLL', label: '生产入库' },
  { value: 'MANUAL', label: '已有手工来源' },
];
export const locationFields: readonly FormSectionField[] = [
  { name: 'code', label: '库位编码', required: true },
  { name: 'name', label: '库位名称', required: true },
  {
    name: 'locationType',
    label: '库位类型',
    type: 'select',
    required: true,
    options: locationOptions,
  },
];
export const locationPayload = (values: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));

export const movementFields: readonly FormSectionField[] = [
  {
    name: 'movementType',
    label: '移动类型',
    type: 'select',
    required: true,
    options: movementOptions,
  },
  { name: 'quantity', label: '数量', type: 'number', required: true },
];
export const optionLabel = (
  options: readonly Readonly<{ value: string; label: string }>[],
  value: string,
) => options.find((item) => item.value === value)?.label ?? (value || '—');

export function inventoryCounts(rows: readonly FinRow[]) {
  return Object.fromEntries(
    qualityOptions.map(({ value }) => [
      value,
      new Set(rows.filter((row) => row.qualityStatus === value).map((row) => finText(row, 'lotId')))
        .size,
    ]),
  );
}

export const movementPayload = (
  balance: FinRow,
  values: Readonly<Record<string, string>>,
  sourceType: string,
  sourceId: string,
  now: Date,
) => ({
  movementType: values.movementType?.trim(),
  itemVersionId: balance.itemVersionId,
  lotId: balance.lotId,
  locationId: balance.locationId,
  quantity: values.quantity?.trim(),
  occurredAt: now.toISOString(),
  sourceType,
  sourceId,
});

export const workOrderChoices = (orders: readonly FinRow[]) =>
  orders
    .filter((order) =>
      ['DRAFT', 'RELEASED', 'IN_PROGRESS'].includes(
        finText(order, 'status', 'effectiveStatus', 'state'),
      ),
    )
    .map((order) => ({
      value: finText(order, 'id'),
      label: finText(order, 'order_number', 'orderNumber'),
    }));

export function movementSourceChoices(balance: FinRow, type: string) {
  const choices = new Map<string, string>();
  for (const movement of finRows(balance.movements)) {
    if (movement.source_type !== type) continue;
    const id = finText(movement, 'source_id');
    if (id) choices.set(id, `${optionLabel(sourceTypeOptions, type)} · ${id}`);
  }
  return [...choices].map(([value, label]) => ({ value, label }));
}
