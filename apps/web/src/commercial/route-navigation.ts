import { appRouteFromHash, type AppRoute } from '../shared/navigation';
import type { CommercialRouteState } from './store/route-state';
import { commercialDataRoutes } from './store/route-dependencies';
import {
  markCommercialDataVisibility,
  populateCommercialRoute,
  holdCommercialRoute,
  commercialRouteNotice,
} from './route-dom';

export function initialCommercialRoute(allowed: ReadonlySet<AppRoute>, hash: string): AppRoute {
  const requested = appRouteFromHash(hash);
  if (allowed.has(requested)) return requested;
  if (allowed.has('overview')) return 'overview';
  return allowed.values().next().value ?? 'overview';
}

const disposers = new WeakMap<HTMLElement, () => void>();
export function disposeCommercialRouteNavigation(shell: HTMLElement): void {
  disposers.get(shell)?.();
}

function activeRoute(shell: HTMLElement): AppRoute | undefined {
  return shell.querySelector<HTMLElement>('[data-app-route][aria-current="page"]')?.dataset
    .appRoute as AppRoute | undefined;
}

export function installCommercialRouteNavigation(
  shell: HTMLElement,
  state: CommercialRouteState,
  render: (workspace: HTMLElement) => HTMLElement,
  afterRender: () => void,
): void {
  disposeCommercialRouteNavigation(shell);
  const events = new AbortController();
  let disposed = false;
  let visit = 0;
  let releasePrevious: (() => void) | undefined;
  const currentWorkspace = () => shell.querySelector<HTMLElement>('.commercial-workspace');
  let observedWorkspace = currentWorkspace();
  const run = async (route: AppRoute, retry = false) => {
    releasePrevious?.();
    const ticket = ++visit;
    const workspace = currentWorkspace();
    if (!workspace) return;
    const current = () =>
      !disposed &&
      state.owner.isAlive() &&
      shell.isConnected &&
      visit === ticket &&
      activeRoute(shell) === route &&
      currentWorkspace() === workspace;
    workspace.querySelector(':scope > .commercial-route-notice')?.remove();
    const loading = retry || !state.readyRoutes().has(route);
    const release = loading
      ? holdCommercialRoute(workspace, route, ticket)
      : () => {
          return;
        };
    releasePrevious = release;
    const notice = loading
      ? commercialRouteNotice(workspace, route, '正在加载本页业务数据…')
      : undefined;
    try {
      const result = await state.load(route, current, retry);
      if (!current()) {
        if (
          !disposed &&
          visit === ticket &&
          state.owner.isAlive() &&
          shell.isConnected &&
          activeRoute(shell) === route &&
          currentWorkspace() !== workspace
        )
          void run(route, retry);
        return;
      }
      const populated = populateCommercialRoute(workspace, state, route, render);
      notice?.remove();
      if (result.state === 'error')
        commercialRouteNotice(
          workspace,
          route,
          '本页部分业务数据暂不可用；已读取的数据仍保留，请重试。',
          () => {
            void run(route, true);
          },
        );
      if (result.state === 'cancelled')
        commercialRouteNotice(workspace, route, '当前查询已更新，请在查询完成后重试。', () => {
          void run(route, true);
        });
      if (populated) afterRender();
    } catch {
      if (current())
        commercialRouteNotice(workspace, route, '本页业务数据暂不可用，请重试。', () => {
          void run(route, true);
        });
    } finally {
      release();
    }
  };
  const apply = () => {
    const route = activeRoute(shell);
    if (route && (route === 'overview' || commercialDataRoutes.includes(route))) void run(route);
    else {
      releasePrevious?.();
      visit += 1;
      currentWorkspace()?.querySelector(':scope > .commercial-route-notice')?.remove();
    }
  };
  const observer = new MutationObserver(() => {
    const workspace = currentWorkspace();
    if (!workspace || workspace === observedWorkspace || disposed) return;
    observedWorkspace = workspace;
    markCommercialDataVisibility(workspace, state.readyRoutes());
    apply();
  });
  observer.observe(shell, { childList: true, subtree: true });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    releasePrevious?.();
    visit += 1;
    events.abort();
    observer.disconnect();
    state.owner.dispose();
    disposers.delete(shell);
  };
  disposers.set(shell, dispose);
  globalThis.addEventListener('hashchange', apply, { signal: events.signal });
  apply();
}
