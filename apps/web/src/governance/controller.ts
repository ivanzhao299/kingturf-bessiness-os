import type { SessionContext } from '../session';
import { json, requestId } from '../http';
import { governancePage } from './presentation';
import { visibleGovernanceSurfaces, type GovernanceSurface } from './surfaces';
export type GovernanceView = Readonly<{
  path: string;
  value: unknown;
  error?: string;
}>;

export class GovernanceController {
  public views: readonly GovernanceView[] = [];
  public message = '';
  public constructor(
    public readonly permissions: ReadonlySet<string>,
    private readonly context: SessionContext,
  ) {}
  // B1：默认并行加载全部可见 surface（概览兼容）；子路由传入所需 surface 子集，
  // 结果按 path 合并，已加载的其它面保持原值。
  public async load(
    surfaces: readonly GovernanceSurface[] = visibleGovernanceSurfaces(this.permissions),
  ): Promise<void> {
    const paths = [...new Set(surfaces.flatMap((surface) => surface.paths))];
    const fresh = await Promise.all(
      paths.map(async (path): Promise<GovernanceView> => {
        try {
          return { path, value: await json<unknown>(path, this.context) };
        } catch (error) {
          return {
            path,
            value: null,
            error: error instanceof Error ? error.message : '数据源加载失败',
          };
        }
      }),
    );
    const byPath = new Map(this.views.map((view) => [view.path, view]));
    for (const view of fresh) byPath.set(view.path, view);
    this.views = [...byPath.values()];
  }
  // B2：按 cursor 续拉一页并合并进该 path 的视图（items 追加、nextCursor 前移）。
  public async loadMore(path: string): Promise<void> {
    const view = this.views.find((item) => item.path === path);
    if (!view) return;
    const current = governancePage(view.value);
    const previousItems = current.items;
    const nextCursor = current.nextCursor;
    if (nextCursor === null) return;
    try {
      const fetched = await json<{ items: readonly unknown[]; nextCursor: string | null }>(
        `${path}?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
        this.context,
      );
      const merged = {
        items: [...previousItems, ...fetched.items],
        nextCursor: fetched.nextCursor,
      };
      this.views = this.views.map((item) =>
        item.path === path ? { ...item, value: merged } : item,
      );
    } catch (error) {
      this.message = error instanceof Error ? error.message : '数据源加载失败';
    }
  }
  // B2：带查询参数拉取一页（审计工作台服务端过滤/导出循环使用）。
  public async fetchPage<Page>(
    path: string,
    params: Readonly<Record<string, string | undefined>> = {},
  ): Promise<Page> {
    const search = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ).toString();
    return json<Page>(search ? `${path}?${search}` : path, this.context);
  }
  public async submit(
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  ): Promise<void> {
    await json<unknown>(path, this.context, {
      method,
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    });
    this.message = '操作已完成并重新读取服务器状态';
    await this.load();
  }
}
