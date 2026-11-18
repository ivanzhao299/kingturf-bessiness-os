import { appRouteFromHash, type AppRoute } from '../shared/navigation';
import type { GovernanceController } from './controller';
import {
  GOVERNANCE_ROUTE_ORDER,
  governanceSurfacesForRoute,
  visibleGovernanceSurfaces,
  type GovernanceSurface,
} from './surfaces';

type RouteLoadingPorts = Readonly<{
  replaceRouteView: (current: HTMLElement, replacement: HTMLElement) => void;
  governanceWorkspace: (controller: GovernanceController) => HTMLElement;
  governanceSubpage: (controller: GovernanceController, route: AppRoute) => HTMLElement;
}>;

export const isGovernanceRoute = (route: AppRoute): boolean =>
  route === 'governance' || (GOVERNANCE_ROUTE_ORDER as readonly string[]).includes(route);

const surfacesForGovernanceRoute = (
  permissions: ReadonlySet<string>,
  route: AppRoute,
): readonly GovernanceSurface[] =>
  route === 'governance'
    ? visibleGovernanceSurfaces(permissions)
    : governanceSurfacesForRoute(visibleGovernanceSurfaces(permissions), route);

// B1 初始加载范围：深链子路由只拉所需面；概览/其它路由保持全量并行（兼容策略）。
export const governanceInitialSurfaces = (
  permissions: ReadonlySet<string>,
  hash: string,
): readonly GovernanceSurface[] => {
  const route = appRouteFromHash(hash);
  return isGovernanceRoute(route)
    ? surfacesForGovernanceRoute(permissions, route)
    : visibleGovernanceSurfaces(permissions);
};

// 进入治理路由时按需补拉未加载的 surface，并原位重建该路由的视图元素。
export function installGovernanceRouteLoading(
  controller: GovernanceController,
  ports: RouteLoadingPorts,
) {
  const loaded = (surface: GovernanceSurface): boolean =>
    surface.paths.every((path) => controller.views.some((view) => view.path === path));
  const rebuild = (route: AppRoute): HTMLElement =>
    route === 'governance'
      ? ports.governanceWorkspace(controller)
      : ports.governanceSubpage(controller, route);
  const ensure = async (route: AppRoute): Promise<void> => {
    const missing = surfacesForGovernanceRoute(controller.permissions, route).filter(
      (surface) => !loaded(surface),
    );
    if (missing.length === 0) return;
    await controller.load(missing);
    const host = globalThis.document.querySelector<HTMLElement>(`[data-route-view="${route}"]`);
    if (host) ports.replaceRouteView(host, rebuild(route));
  };
  const onHashChange = (): void => {
    const route = appRouteFromHash(globalThis.location.hash);
    if (isGovernanceRoute(route)) void ensure(route);
  };
  globalThis.addEventListener('hashchange', onHashChange);
  return {
    ensure,
    dispose: (): void => {
      globalThis.removeEventListener('hashchange', onHashChange);
    },
  };
}

// B1 挂载：概览 + 全部子路由元素一次入壳，并安装按需加载监听（随会话销毁）。
export function mountGovernanceViews(
  shell: HTMLElement,
  controller: GovernanceController | null,
  ports: RouteLoadingPorts & Readonly<{ onDispose: (dispose: () => void) => void }>,
): void {
  if (!controller) return;
  shell
    .querySelector<HTMLElement>('.workspace')
    ?.append(
      ports.governanceWorkspace(controller),
      ...GOVERNANCE_ROUTE_ORDER.map((route) => ports.governanceSubpage(controller, route)),
    );
  ports.onDispose(installGovernanceRouteLoading(controller, ports).dispose);
}
