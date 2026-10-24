import { formatBusinessDateTime } from './business-date';

export const recordValue = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

export const displayRequirement = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '—';

export const formValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const textValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

export const recordText = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
  fallback = '',
): string => textValue(record[camel] ?? record[snake], fallback);

export const inventoryLocationOption = (item: Record<string, unknown>) => ({
  value: textValue(item.id, ''),
  label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
});

export const decimalValue = (value: number): string =>
  String(Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000);

export const currencyLabel = (value: unknown): string => {
  const code = textValue(value, 'CNY');
  return (
    {
      CNY: '人民币',
      USD: '美元',
      EUR: '欧元',
      GBP: '英镑',
      HKD: '港币',
    }[code] ?? code
  );
};

export const displayMoney = (currency: unknown, value: unknown): string => {
  const code = textValue(currency, 'CNY');
  if (!/^[A-Z]{3}$/u.test(code)) return '金额不可见';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${code} —`;
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const displayTime = (timestamp: string | undefined) =>
  timestamp ? formatBusinessDateTime(new Date(timestamp)) : '时间未知';
