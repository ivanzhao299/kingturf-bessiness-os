import type { FormSectionField } from '@kingturf/ui';
import { finDay, finRecord, finRows, finText, type FinRow } from './fin-kit';
import { SUPPLIER_STATUS_LABELS } from './supplier-status';

export const SQ_PATH = '/api/v1/supplier-quotes';
export const quoteId = (row: FinRow) => finText(row, 'id');
export const quoteReference = (row: FinRow) => finText(row, 'quote_reference', 'quoteReference');
export const rfqNumber = (row: FinRow) => finText(row, 'rfqNumber', 'rfq_number');
export const lineId = (row: FinRow) => finText(row, 'rfq_line_id', 'rfqLineId');
export const quoteLines = (row: FinRow) => finRows(row.lines);
export const quoteValue = (row: FinRow, column: string) =>
  quoteLines(row)
    .map((line) => finText(line, column))
    .filter(Boolean)
    .join(' · ') || '—';
export const expiryDay = (row: FinRow) => finDay(row, 'valid_until', 'validUntil');
export const supplierName = (row: FinRow) => finText(row, 'supplierName') || '—';

export function findQuoteLine(row: FinRow, rfqs: readonly FinRow[], id: string) {
  const rfq = rfqs.find((item) => quoteId(item) === finText(row, 'rfq_id', 'rfqId'));
  return (
    finRows(finRecord(row.rfq).lines).find((line) => quoteId(line) === id) ??
    finRows(rfq?.lines).find((line) => quoteId(line) === id)
  );
}

export const quoteStatus = (row: FinRow, today: string) => {
  const expiry = expiryDay(row);
  return expiry === '—' ? null : expiry >= today ? 'VALID' : 'EXPIRED';
};

export function quoteCounts(rows: readonly FinRow[], now: Date) {
  const today = quoteBusinessDay(now);
  const end = quoteBusinessDay(new Date(now.getTime() + 7 * 86400000));
  const counts = { valid: 0, expiring: 0, expired: 0 };
  for (const row of rows) {
    const state = quoteStatus(row, today);
    if (state === 'VALID') {
      counts.valid += 1;
      if (expiryDay(row) <= end) counts.expiring += 1;
    }
    if (state === 'EXPIRED') counts.expired += 1;
  }
  return counts;
}

const businessDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' });
export const quoteBusinessDay = (now: Date) => businessDay.format(now);

// TD-PROC-021：登记报价的供应商候选——沿用旧候选清单（账号可读的全部供应商），带上供应商状态
//（ACTIVE / ON_HOLD / INACTIVE）。供应商不再作为「报价内容」表单里的下拉字段，改由候选控件
//（sq-supplier-picker.tsx）选择；提交时与表单值合并成同一份载荷，载荷形状不变。
export type SupplierChoice = Readonly<{ value: string; label: string; status: string }>;

export const supplierQuoteFields = (): readonly FormSectionField[] => [
  { name: 'quoteReference', label: '供应商报价编号', required: true },
  { name: 'unitPrice', label: '单价', type: 'number', required: true },
  { name: 'minimumOrderQuantity', label: '最小订购量', type: 'number', required: true, value: '0' },
  { name: 'promisedAt', label: '承诺到货日', type: 'date', required: true },
  { name: 'validUntil', label: '报价有效期', type: 'date', required: true },
];

// TD-PROC-021：提交前的供应商把关。没选（或所选已不在候选里）→ 请选择；处于暂停 / 已停用
//（或其它非启用状态）→ 写明当前状态。返回 null 表示可以提交。服务端的资格守卫不变，这里只是把
// 注定会被拒的提交在表单里提前拦下并说明原因。
export const quoteSupplierBlock = (
  suppliers: readonly SupplierChoice[],
  supplierId: string,
): string | null => {
  const supplier = suppliers.find((choice) => choice.value === supplierId);
  if (!supplier) return '请选择供应商';
  if (supplier.status === 'ACTIVE') return null;
  return `供应商「${supplier.label}」当前为「${SUPPLIER_STATUS_LABELS[supplier.status] ?? supplier.status}」，不能登记报价`;
};

export const supplierQuotePayload = (
  values: Readonly<Record<string, string>>,
  rfqId: string,
  rfqLineId: string,
  now: Date,
) => ({
  rfqId,
  supplierId: values.supplierId?.trim(),
  quoteReference: values.quoteReference?.trim(),
  receivedAt: now.toISOString(),
  validUntil: values.validUntil?.trim(),
  terms: { currency: 'CNY' },
  lines: [
    {
      rfqLineId,
      unitPrice: values.unitPrice?.trim(),
      promisedAt: values.promisedAt?.trim(),
      minimumOrderQuantity: values.minimumOrderQuantity?.trim(),
    },
  ],
});
