import type { CostMatrixPage } from '../commercial/types';
import type { Customer360 } from '../crm/types';
import { isResponseRecord, parseResponseRecord } from './response-parser';

// Capability projections can legally omit business fields, including IDs.
export function parseResponseArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isResponseRecord))
    throw new Error('服务器返回的列表格式无效，请刷新重试');
  return value;
}

export function parseResponseItems(value: unknown): { items: Record<string, unknown>[] } {
  const record = parseResponseRecord(value);
  parseResponseArray(record.items);
  return record as { items: Record<string, unknown>[] };
}

export function parseCursorPage(value: unknown): {
  items: readonly Record<string, unknown>[];
  nextCursor: string | null;
} {
  const record = parseResponseRecord(value);
  parseResponseArray(record.items);
  if (record.nextCursor !== null && typeof record.nextCursor !== 'string')
    throw new Error('服务器返回的分页游标格式无效');
  return record as { items: readonly Record<string, unknown>[]; nextCursor: string | null };
}

export function parseCostMatrixPage(value: unknown): CostMatrixPage {
  const record = parseResponseRecord(value);
  parseResponseArray(record.items);
  for (const [key, minimum] of [
    ['total', 0],
    ['page', 1],
    ['pageSize', 1],
  ] as const) {
    const field = record[key];
    if (typeof field !== 'number' || !Number.isInteger(field) || field < minimum)
      throw new Error('服务器返回的成本分页格式无效');
  }
  return record as CostMatrixPage;
}

export function parseCustomer360Response(value: unknown): Customer360 {
  const record = parseResponseRecord(value);
  parseResponseRecord(record.customer);
  for (const key of ['contacts', 'ownership', 'leads', 'opportunities', 'activities'])
    parseResponseArray(record[key]);
  const unavailable = record.unavailableSections;
  if (
    !Array.isArray(unavailable) ||
    !unavailable.every((field: unknown) => typeof field === 'string')
  )
    throw new Error('服务器返回的客户分区格式无效');
  return record as Customer360;
}
