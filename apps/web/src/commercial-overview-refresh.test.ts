import { afterEach, expect, it, vi } from 'vitest';
import { installGlobalTestDom, TestElement } from '../test/fixtures/preact-dom';
import { CommercialController, commercialWorkspaceStructure } from './bootstrap';
import { mountCommercialConsole } from './commercial/console/mount';
import { mountInventoryConsole } from './commercial/console/inv-console';
import type { CommercialPermission } from './commercial/permissions';
import { populateCommercialRoute } from './commercial/route-dom';
import { attachCommercialReadOwner } from './commercial/store/read-owner';
import { CommercialRouteState } from './commercial/store/route-state';
import type { CommercialApi } from './commercial/types';
import type { AppRoute } from './shared/navigation';

// Exercise the real workspace and hosts, observing the refresh ports at the console mount boundary.
vi.mock('./commercial/console/mount', () => ({ mountCommercialConsole: vi.fn() }));
vi.mock('./commercial/console/inv-console', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./commercial/console/inv-console')>()),
  mountInventoryConsole: vi.fn(),
}));

class RouteElement extends TestElement {
  public constructor(
    tag: string,
    private readonly root: TestElement,
  ) {
    super(tag);
  }

  public get isConnected(): boolean {
    return this.root.contains(this);
  }

  public matches(selector: string): boolean {
    return selector.split(', ').some((part) => this.classList.contains(part.slice(1)));
  }

  public replaceWith(node: RouteElement): void {
    this.parentNode?.insertBefore(node, this);
    this.remove();
  }
}

const itemsPath = '/api/v1/manufacturing-items';
const balancesPath = '/api/v1/inventory-balances';

async function setup(permissions: readonly CommercialPermission[], initialRoute: AppRoute) {
  const { document } = installGlobalTestDom();
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag) => new RouteElement(tag, document.documentElement),
  );
  vi.stubGlobal('HTMLElement', RouteElement);
  vi.stubGlobal('location', { hash: `#/${initialRoute}` });
  const rows = new Map<string, readonly Record<string, unknown>[]>();
  const api: CommercialApi = {
    listOpportunities: vi.fn().mockResolvedValue([]),
    list: vi.fn<CommercialApi['list']>((path) => Promise.resolve(rows.get(path) ?? [])),
    submit: vi.fn().mockResolvedValue({}),
    uploadCtrAttachment: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue({}),
  };
  const controller = new CommercialController(api, new Set(permissions));
  const state = new CommercialRouteState(
    controller,
    attachCommercialReadOwner(controller, () => true),
  );
  expect((await state.load(initialRoute, () => true)).state).toBe('ready');
  const assemble = (existing?: HTMLElement) =>
    commercialWorkspaceStructure('desktop', false, controller, existing);
  const workspace = assemble();
  const root = workspace as unknown as RouteElement;
  document.documentElement.append(root);
  return {
    rows,
    find: (id: string) => root.querySelector(`[data-testid="${id}"]`),
    visit: async (route: AppRoute) => {
      globalThis.location.hash = `#/${route}`;
      expect((await state.load(route, () => true)).state).toBe('ready');
      return populateCommercialRoute(workspace, state, route, assemble);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('refreshes the retained procurement cards after inventory hydrates separately (TD-WEB-018)', async () => {
  const { find, visit, rows } = await setup(
    ['inventory:read', 'inventory:move', 'production:read'],
    'procurement',
  );
  const inventory = find('procurement-summary-inventory');
  const value = inventory?.querySelector('.stat-card-value');
  expect(value?.textContent).toBe('0');
  const originalHost = find('kt-inv-host');
  expect(await visit('procurement/inventory')).toBe(true);
  const host = find('kt-inv-host');
  expect(host).not.toBe(originalHost);
  const mounted = () =>
    vi
      .mocked(mountInventoryConsole)
      .mock.calls.find(([node]) => node === (host as unknown as HTMLElement))?.[1];
  await vi.waitFor(() => {
    expect(mounted()?.refresh).toBeTypeOf('function');
  });
  const ports = mounted();
  if (!ports) throw new Error('inventory host did not mount');

  rows.set(balancesPath, [{ qualityStatus: 'QUARANTINE' }]);
  expect((await ports.refresh()).balances).toHaveLength(1);
  expect(await visit('procurement')).toBe(false);
  expect(find('procurement-summary-inventory')).toBe(inventory);
  await vi.waitFor(() => {
    expect(value?.textContent).toBe('1');
  });
});

it('refreshes manufacturing cards hydrated after the original item host (TD-WEB-018)', async () => {
  const { find, visit, rows } = await setup(
    ['manufacturing-item:read', 'bom:read'],
    'manufacturing/items',
  );
  const host = find('kt-mfg-items');
  const placeholder = find('manufacturing-summary-items');
  expect(await visit('manufacturing-master')).toBe(true);
  expect(find('kt-mfg-items')).toBe(host);
  const items = find('manufacturing-summary-items');
  expect(items).not.toBe(placeholder);
  const hint = items?.querySelector('.stat-card-hint');
  expect(hint?.textContent).toBe('草稿 0');
  const mounted = () =>
    vi
      .mocked(mountCommercialConsole)
      .mock.calls.find(([node]) => node === (host as unknown as HTMLElement))?.[1];
  await vi.waitFor(() => {
    expect(mounted()?.kind).toBe('manufacturing-items');
  });
  const mount = mounted();
  if (mount?.kind !== 'manufacturing-items') throw new Error('item host did not mount');

  expect(await visit('manufacturing/items')).toBe(false);
  rows.set(itemsPath, [{ status: 'DRAFT' }]);
  expect(await mount.ports.refresh()).toHaveLength(1);
  expect(await visit('manufacturing-master')).toBe(false);
  expect(find('manufacturing-summary-items')).toBe(items);
  await vi.waitFor(() => {
    expect(hint?.textContent).toBe('草稿 1');
  });
});
