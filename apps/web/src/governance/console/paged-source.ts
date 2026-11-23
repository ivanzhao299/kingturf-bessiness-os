import { recordOf, type ConsolePageData, type ConsoleRow } from './ports';

// GOV-UX：把 cursor 分页端点读尽的组织图人数/矩阵角色授权等派生统计需要完整清单；
// 这里复用既有 limit+cursor 契约（limit 1-100）续拉，不发明新分页模型。首屏已拉过的
// 第一页直接复用（不重复请求）；封顶或失败一律如实返回 complete=false，由调用方提示。
export type PagedSource = Readonly<{
  rows: readonly ConsoleRow[];
  complete: boolean;
  error: string;
}>;

export type PageFetcher = (
  path: string,
  params?: Readonly<Record<string, string | undefined>>,
) => Promise<ConsolePageData>;

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

const readPages = async (
  fetchPage: PageFetcher,
  path: string,
  params: Readonly<Record<string, string>>,
  first: ConsolePageData,
): Promise<PagedSource> => {
  const rows: ConsoleRow[] = first.items.map(recordOf);
  let cursor = first.nextCursor;
  for (let page = 1; page < MAX_PAGES && cursor !== null; page += 1) {
    const fetched = await fetchPage(path, { ...params, limit: String(PAGE_LIMIT), cursor });
    rows.push(...fetched.items.map(recordOf));
    cursor = fetched.nextCursor;
  }
  return { rows, complete: cursor === null, error: '' };
};

export const loadPagedSource = async (
  fetchPage: PageFetcher,
  path: string,
  first: ConsolePageData,
  params: Readonly<Record<string, string>> = {},
): Promise<PagedSource> => {
  try {
    return await readPages(fetchPage, path, params, first);
  } catch (error) {
    return {
      rows: first.items.map(recordOf),
      complete: false,
      error: error instanceof Error ? error.message : '数据源加载失败',
    };
  }
};
