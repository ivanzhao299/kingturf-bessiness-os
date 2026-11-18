import { DomainError, type ListPage, type ListPageFilter } from '@kingturf/domain';

// B2（TD-API-003）：治理列表统一 cursor 分页契约（对齐 qtc-operational-reads 既有实现）：
// query `limit`（integer 1-100，默认 50）+ 可选 `cursor`（opaque）；响应 `{items, nextCursor}`。
// cursor 对单列主键端点是行 id；复合主键端点是点连的双 UUID 令牌。
export type PageFilter = ListPageFilter;
export type Page<T> = ListPage<T>;

export const parsePageFilter = (query: Readonly<Record<string, unknown>> = {}): PageFilter => {
  const rawLimit = query.limit;
  if (rawLimit !== undefined) {
    const limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new DomainError('invalid_request', 'limit must be an integer between 1 and 100');
  }
  const cursor = query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.trim() || cursor.length > 256))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  return {
    limit: rawLimit === undefined ? 50 : Number(rawLimit),
    ...(cursor ? { cursor } : {}),
  };
};

export const pageEnvelope = <T>(
  rows: readonly T[],
  filter: PageFilter,
  cursorOf: (row: T) => string,
): Page<T> => ({
  items: rows.slice(0, filter.limit),
  nextCursor: rows.length > filter.limit ? cursorOf(rows[filter.limit - 1] as T) : null,
});

// 复合主键行的 cursor 令牌（role.permission / employee.role）与解析。
export const COMPOSITE_CURSOR = /^[0-9a-f-]{36}\.[0-9a-f-]{36}$/u;
export const compositeCursor = (first: string, second: string): string => `${first}.${second}`;
export const parseCompositeCursor = (cursor: string): readonly [string, string] => {
  if (!COMPOSITE_CURSOR.test(cursor))
    throw new DomainError('invalid_request', 'cursor must be an opaque pagination token');
  const [first, second] = cursor.split('.');
  return [first ?? '', second ?? ''];
};
