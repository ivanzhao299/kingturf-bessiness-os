import type { AppRoute } from '../../shared/navigation';
import type { CommercialController } from './controller';
import type { CommercialReadOwner } from './read-owner';
import { commercialDashboardQuery } from './dashboard-query';
import { commercialRoutePlan } from './route-dependencies';
import { startCommercialOpportunityLoad } from './load-opportunities';
import { startCommercialViewLoad } from './load-views';

export type CommercialRouteReadResult = Readonly<{
  state: 'ready' | 'error' | 'stale' | 'cancelled';
  paths: readonly string[];
  failedPaths: readonly string[];
}>;

export async function readCommercialRoute(
  controller: CommercialController,
  owner: CommercialReadOwner,
  route: AppRoute,
  isCurrent: () => boolean,
  onlyPaths?: ReadonlySet<string>,
): Promise<CommercialRouteReadResult> {
  await owner.waitUntilIdle();
  const complete = commercialRoutePlan(controller, route);
  const wanted = (path: string) => !onlyPaths || onlyPaths.has(path);
  const plan = {
    readable: complete.readable.filter(([, path]) => wanted(path)),
    opportunity: complete.opportunity && wanted('/api/v1/opportunities'),
    dashboard: complete.dashboard && wanted('/api/v1/executive-dashboard'),
    paths: complete.paths.filter(wanted),
  };
  const result = (
    state: CommercialRouteReadResult['state'],
    failedPaths: readonly string[] = [],
  ) => ({ state, paths: plan.paths, failedPaths });
  if (!owner.isAlive() || !isCurrent()) return result('cancelled');
  if (!owner.isIdle()) return result('stale');
  const wave = owner.claim(plan.paths);
  const accepts = () => owner.accepts(wave) && isCurrent();
  const staging = {
    api: controller.api,
    permissions: controller.permissions,
    views: new Map(controller.views),
    opportunities: controller.opportunities,
    loadCostMatrixPage: controller.loadCostMatrixPage.bind(controller),
  };
  const failures: string[] = [];
  const opportunity = plan.opportunity
    ? startCommercialOpportunityLoad(staging, failures)
    : Promise.resolve();
  const views = startCommercialViewLoad(
    staging,
    plan.readable.filter(([, path]) => path !== '/api/v1/cost-matrices'),
    failures,
  );
  const cost = plan.readable.some(([, path]) => path === '/api/v1/cost-matrices')
    ? readRouteCost(controller, accepts, failures)
    : Promise.resolve(true);
  const [, , costAccepted] = await Promise.all([opportunity, views, cost]);
  if (!owner.isAlive() || !isCurrent()) return result('cancelled');
  if (!accepts()) return result('stale');
  if (!costAccepted) return result('cancelled');
  let dashboard = controller.dashboard;
  let dashboardRead = false;
  if (plan.dashboard && controller.api.get) {
    const query = commercialDashboardQuery();
    try {
      dashboard = await controller.api.get(`/api/v1/executive-dashboard?${query.toString()}`);
      dashboardRead = true;
    } catch {
      failures.push('经营看板');
    }
  }
  if (!owner.isAlive() || !isCurrent()) return result('cancelled');
  if (!accepts()) return result('stale');
  for (const [, path] of plan.readable) {
    if (path !== '/api/v1/cost-matrices' && !failures.includes(path))
      controller.views.set(path, staging.views.get(path) ?? []);
  }
  if (plan.opportunity) controller.opportunities = staging.opportunities;
  if (dashboardRead) controller.dashboard = dashboard;
  controller.message =
    failures.length === 0
      ? `已加载 ${String(controller.opportunities.length)} 个商机`
      : `核心工作台已加载；${String(failures.length)} 个数据源暂不可用`;
  const failedPaths = failures.map((failure) => {
    if (failure === '商机') return '/api/v1/opportunities';
    if (failure === '经营看板') return '/api/v1/executive-dashboard';
    return failure;
  });
  return result(failedPaths.length === 0 ? 'ready' : 'error', failedPaths);
}

async function readRouteCost(
  controller: CommercialController,
  accepts: () => boolean,
  failures: string[],
): Promise<boolean> {
  if (!accepts()) return false;
  try {
    return await controller.loadCostMatrixPage({}, accepts);
  } catch {
    failures.push('/api/v1/cost-matrices');
    return true;
  }
}
