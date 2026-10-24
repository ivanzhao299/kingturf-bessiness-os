export type ResponseParser<T> = (value: unknown) => T;

export const isResponseRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseResponseRecord(value: unknown): Record<string, unknown> {
  if (!isResponseRecord(value)) throw new Error('服务器返回的数据格式无效，请刷新重试');
  return value;
}

export function responseErrorMessage(value: unknown, fallback: () => string): string {
  if (!isResponseRecord(value)) return fallback();
  const nested = value.error;
  const message = isResponseRecord(nested) ? nested.message : undefined;
  if (typeof message === 'string') return message;
  const topLevel = value.message;
  return typeof topLevel === 'string' ? topLevel : fallback();
}

export function responseErrorCorrelation(value: unknown): string | undefined {
  if (!isResponseRecord(value)) return undefined;
  const nested = value.error;
  const correlation = isResponseRecord(nested) ? nested.correlationId : undefined;
  return typeof correlation === 'string' ? correlation : undefined;
}
