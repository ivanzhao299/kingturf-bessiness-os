import { parseResponseRecord } from './response-parser';

export type SavedRegisterView = Readonly<{
  query?: string;
  status?: string;
  attention?: string;
  dateFrom?: string;
  dateTo?: string;
  amountFrom?: string;
  amountTo?: string;
  sortMode?: string;
  compact?: boolean;
  fields?: string;
}>;

export const parseSidebarCollapsed = (value: unknown): boolean => value === 'true';

export function parseStoredRegisterView(stored: string | null): SavedRegisterView | undefined {
  if (!stored) return undefined;
  const value: unknown = JSON.parse(stored);
  const record = parseResponseRecord(value);
  for (const key of [
    'query',
    'status',
    'attention',
    'dateFrom',
    'dateTo',
    'amountFrom',
    'amountTo',
    'sortMode',
    'fields',
  ]) {
    const field = record[key];
    if (field !== undefined && typeof field !== 'string') throw new Error('列表视图缓存格式无效');
  }
  if (record.compact !== undefined && typeof record.compact !== 'boolean')
    throw new Error('列表视图缓存格式无效');
  return record;
}
