import type { AppRoute } from '../shared/navigation';
import { applyRouteVisibility } from '../shared/navigation';
import type { CommercialRouteState } from './store/route-state';
import { commercialBuiltRoutes, rememberCommercialRoutes } from './workspace-frame';

const routesOf = (node: HTMLElement) =>
  (node.getAttribute('data-route-view') ?? '').split(/\s+/u) as AppRoute[];
const groupKey = (node: HTMLElement) =>
  `${node.getAttribute('data-route-view') ?? ''}|${node.className}`;

export function markCommercialDataVisibility(
  workspace: HTMLElement,
  ready: ReadonlySet<AppRoute>,
): void {
  for (const child of Array.from(workspace.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.matches('.commercial-status, .commercial-route-notice')) continue;
    if (!child.hasAttribute('data-route-view')) continue;
    child.dataset.commercialDataState = routesOf(child).some((route) => ready.has(route))
      ? 'ready'
      : 'unloaded';
  }
}

export function populateCommercialRoute(
  workspace: HTMLElement,
  state: CommercialRouteState,
  route: AppRoute,
  render: (workspace: HTMLElement) => HTMLElement,
): boolean {
  const ready = state.readyRoutes();
  const wanted = route === 'overview' ? ready : new Set([route]);
  const built = commercialBuiltRoutes(workspace);
  const pending = new Set([...wanted].filter((key) => ready.has(key) && !built.has(key)));
  if (pending.size === 0) {
    markCommercialDataVisibility(workspace, ready);
    return false;
  }
  const original = Array.from(workspace.children);
  const originalSet = new Set(original);
  const oldGroups = new Map<string, HTMLElement[]>();
  for (const node of original) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.matches('.commercial-status, .commercial-route-notice')) continue;
    const key = groupKey(node);
    oldGroups.set(key, [...(oldGroups.get(key) ?? []), node]);
  }
  render(workspace);
  const added = Array.from(workspace.children).filter((node) => !originalSet.has(node));
  const pairs = new Map<HTMLElement, HTMLElement | undefined>();
  for (const node of added) {
    if (!(node instanceof HTMLElement)) continue;
    pairs.set(node, oldGroups.get(groupKey(node))?.shift());
  }
  let anchor: HTMLElement | null = null;
  for (const node of [...added].reverse()) {
    if (!(node instanceof HTMLElement)) continue;
    const old = pairs.get(node);
    if (!routesOf(node).some((key) => pending.has(key))) {
      node.remove();
      if (old) anchor = old;
      continue;
    }
    if (old) old.replaceWith(node);
    else workspace.insertBefore(node, anchor);
    anchor = node;
  }
  for (const nodes of oldGroups.values())
    for (const node of nodes) if (routesOf(node).some((key) => pending.has(key))) node.remove();
  rememberCommercialRoutes(workspace, pending);
  markCommercialDataVisibility(workspace, ready);
  applyRouteVisibility(workspace);
  return true;
}

const busyOwners = new WeakMap<HTMLElement, number>();
export function holdCommercialRoute(
  workspace: HTMLElement,
  route: AppRoute,
  visit: number,
): () => void {
  const nodes = Array.from(workspace.children).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      !node.matches('.commercial-status, .commercial-route-notice') &&
      routesOf(node).includes(route),
  );
  for (const node of nodes) {
    busyOwners.set(node, visit);
    node.inert = true;
  }
  return () => {
    for (const node of nodes) {
      if (busyOwners.get(node) !== visit) continue;
      busyOwners.delete(node);
      node.inert = false;
    }
  };
}

export function commercialRouteNotice(
  workspace: HTMLElement,
  route: AppRoute,
  message: string,
  retry?: () => void,
): HTMLElement {
  workspace.querySelector(':scope > .commercial-route-notice')?.remove();
  const notice = document.createElement('section');
  notice.className = 'commercial-route-notice qtc-workbench';
  notice.setAttribute('data-route-view', route);
  notice.setAttribute('role', retry ? 'alert' : 'status');
  notice.append(document.createTextNode(message));
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = '重新加载本页';
    button.addEventListener('click', retry);
    notice.append(button);
  }
  workspace.querySelector('.commercial-status')?.after(notice);
  return notice;
}
