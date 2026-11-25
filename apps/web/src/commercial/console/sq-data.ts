import type { FormSectionField } from '@kingturf/ui';
import { finDay, finRecord, finRows, finText, type FinRow } from './fin-kit';

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

export const supplierQuoteFields = (
  suppliers: readonly Readonly<{ value: string; label: string }>[],
): readonly FormSectionField[] => [
  { name: 'supplierId', label: '供应商', type: 'select', required: true, options: suppliers },
  { name: 'quoteReference', label: '供应商报价编号', required: true },
  { name: 'unitPrice', label: '单价', type: 'number', required: true },
  { name: 'minimumOrderQuantity', label: '最小订购量', type: 'number', required: true, value: '0' },
  { name: 'promisedAt', label: '承诺到货日', type: 'date', required: true },
  { name: 'validUntil', label: '报价有效期', type: 'date', required: true },
];

export const supplierQuotePayload = (
  values: Readonly<Record<string, string>>,
  rfqId: string,
  rfqLineId: string,
  now: Date,
) => ({
  rfqId,
  supplierId: values.supplierId,
  quoteReference: values.quoteReference,
  receivedAt: now.toISOString(),
  validUntil: values.validUntil,
  terms: { currency: 'CNY' },
  lines: [
    {
      rfqLineId,
      unitPrice: values.unitPrice,
      promisedAt: values.promisedAt,
      minimumOrderQuantity: values.minimumOrderQuantity,
    },
  ],
});
