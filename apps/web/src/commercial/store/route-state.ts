import type { AppRoute } from '../../shared/navigation';
import type { CommercialController } from './controller';
import { attachCommercialReadOwner, type CommercialReadOwner } from './read-owner';
import { commercialRoutePlan, commercialDataRoutes } from './route-dependencies';
import { readCommercialRoute, type CommercialRouteReadResult } from './route-read';

const states = new WeakMap<CommercialController, CommercialRouteState>();

export function commercialRouteStateOf(controller: CommercialController) {
  return states.get(controller);
}

export function createCommercialRouteState(
  controller: CommercialController,
  token: string,
  storage: Pick<Storage, 'getItem'>,
): CommercialRouteState {
  return new CommercialRouteState(
    controller,
    attachCommercialReadOwner(controller, () => storage.getItem('kingturf.session') === token),
  );
}

export class CommercialRouteState {
  private readonly loaded = new Set<string>();
  private readonly failures = new Map<AppRoute, readonly string[]>();
  private sourceRevision = 0;

  public constructor(
    private readonly controller: CommercialController,
    public readonly owner: CommercialReadOwner,
  ) {
    states.set(controller, this);
    for (const path of controller.views.keys()) this.loaded.add(path);
  }

  public readyRoutes(): ReadonlySet<AppRoute> {
    this.synchronizePublicReads();
    return new Set(
      [...commercialDataRoutes, 'overview' as const].filter((route) =>
        commercialRoutePlan(this.controller, route).paths.every((path) => this.loaded.has(path)),
      ),
    );
  }

  public async load(
    route: AppRoute,
    isCurrent: () => boolean,
    retry = false,
  ): Promise<CommercialRouteReadResult> {
    while (this.owner.isAlive() && isCurrent()) {
      await this.owner.waitUntilIdle();
      if (!this.owner.isAlive() || !isCurrent()) break;
      this.synchronizePublicReads();
      const plan = commercialRoutePlan(this.controller, route);
      const missing = plan.paths.filter((path) => !this.loaded.has(path));
      const failedPaths = this.failures.get(route) ?? [];
      if (missing.length === 0 && (!retry || failedPaths.length === 0)) {
        this.failures.delete(route);
        return { state: 'ready', paths: [], failedPaths: [] };
      }
      if (!retry && failedPaths.length > 0) return { state: 'error', paths: [], failedPaths };
      const wanted = new Set([...missing, ...(retry ? failedPaths : [])]);
      const result = await readCommercialRoute(
        this.controller,
        this.owner,
        route,
        isCurrent,
        wanted,
      );
      if (result.state === 'stale') continue;
      if (result.state === 'cancelled') return result;
      for (const path of result.paths) {
        if (!result.failedPaths.includes(path)) this.loaded.add(path);
      }
      if (result.state === 'error') this.failures.set(route, result.failedPaths);
      else this.failures.delete(route);
      return result;
    }
    return { state: 'cancelled', paths: [], failedPaths: [] };
  }

  private synchronizePublicReads(): void {
    if (!this.owner.isIdle() || this.sourceRevision === this.owner.sourceRevision) return;
    for (const path of this.owner.sourcePaths()) this.loaded.add(path);
    this.sourceRevision = this.owner.sourceRevision;
  }
}
