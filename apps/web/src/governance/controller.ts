import type { SessionContext } from '../session';
import { json, requestId } from '../http';
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
