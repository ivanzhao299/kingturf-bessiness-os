// 既有 cursor 分页契约（TD-API-003/B2）的前端共享面：DataTable 与后续迁移域统一复用，
// 不发明新分页模型。语义与 apps/api/src/pagination.ts 及 governance/presentation.ts 对齐。

export type CursorPage = Readonly<{ items: readonly unknown[]; nextCursor: string | null }>;

export const PAGE_LIMIT = Object.freeze({
  min: 1,
  max: 100,
  default: 50,
} as const);

// 裸数组（测试夹具兼容）与 {items,nextCursor} 信封统一归一。
export const normalizePage = (value: unknown): CursorPage => {
  if (Array.isArray(value)) return { items: value, nextCursor: null };
  if (typeof value === 'object' && value !== null) {
    const record = value as { items?: readonly unknown[]; nextCursor?: string | null };
    return {
      items: Array.isArray(record.items) ? record.items : [],
      nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
    };
  }
  return { items: [], nextCursor: null };
};
