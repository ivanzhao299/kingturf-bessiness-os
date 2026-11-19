import { describe, expect, it } from 'vitest';
import { PAGE_LIMIT, normalizePage } from '../src/pagination';

describe('cursor 分页契约（TD-API-003/B2 前端共享面）', () => {
  it('mirrors the repository limit contract: 1-100 with default 50', () => {
    expect(PAGE_LIMIT.min).toBe(1);
    expect(PAGE_LIMIT.max).toBe(100);
    expect(PAGE_LIMIT.default).toBe(50);
  });

  it('normalizes {items,nextCursor} envelopes', () => {
    expect(normalizePage({ items: [{ id: 1 }, { id: 2 }], nextCursor: 'abc' })).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: 'abc',
    });
    expect(normalizePage({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('accepts bare arrays as terminal pages（测试夹具兼容）', () => {
    expect(normalizePage([1, 2, 3])).toEqual({ items: [1, 2, 3], nextCursor: null });
  });

  it('fails closed to an empty page for malformed values', () => {
    expect(normalizePage(undefined)).toEqual({ items: [], nextCursor: null });
    expect(normalizePage(null)).toEqual({ items: [], nextCursor: null });
    expect(normalizePage({ items: 'nope', nextCursor: 7 })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
