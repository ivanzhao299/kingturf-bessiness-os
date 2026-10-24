import type { Viewport } from '../shared/shell-types';
import type { AppRoute } from '../shared/navigation';
import type { CommercialController } from './store/controller';
import { commercialRouteStateOf } from './store/route-state';

const builtRoutes = new WeakMap<HTMLElement, ReadonlySet<AppRoute>>();

export function createCommercialWorkspaceFrame(
  viewport: Viewport,
  immutable: boolean,
  existing?: HTMLElement,
) {
  if (existing) {
    const status = existing.querySelector<HTMLElement>('.commercial-status');
    if (!status) throw new Error('业务工作区状态节点不可用');
    return { workspace: existing, status };
  }
  const workspace = document.createElement('section');
  workspace.className = `commercial-workspace ${viewport}${immutable ? ' immutable' : ''}`;
  workspace.setAttribute('aria-label', '业务工作区');
  const status = document.createElement('p');
  status.className = 'commercial-status';
  status.setAttribute('role', 'status');
  status.setAttribute(
    'data-route-view',
    'opportunities technical-requirements technical-solutions costing sales-policies quotes credit-review contracts sales-orders order-360 receivables collections payments commissions business-risks manufacturing-master procurement material-planning production-orders quality-inspection shipments',
  );
  return { workspace, status };
}

export function rememberCommercialWorkspace(
  workspace: HTMLElement,
  controller: CommercialController | undefined,
): void {
  const state = controller && commercialRouteStateOf(controller);
  if (state) builtRoutes.set(workspace, new Set(state.readyRoutes()));
}

export function commercialBuiltRoutes(workspace: HTMLElement): ReadonlySet<AppRoute> {
  return builtRoutes.get(workspace) ?? new Set();
}

export function rememberCommercialRoutes(
  workspace: HTMLElement,
  routes: ReadonlySet<AppRoute>,
): void {
  builtRoutes.set(workspace, new Set([...commercialBuiltRoutes(workspace), ...routes]));
}
