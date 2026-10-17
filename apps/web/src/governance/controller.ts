import type { SessionContext } from '../session';
import { json, requestId } from '../http';
import { visibleGovernanceSurfaces } from './surfaces';
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
  public async load(): Promise<void> {
    const paths = [
      ...new Set(visibleGovernanceSurfaces(this.permissions).flatMap((surface) => surface.paths)),
    ];
    this.views = await Promise.all(
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
