import { el } from '../../dom';
import type { OperationsViewContext } from '../operations-view-ports';
import { perView } from './console-choices';
import { finReadPage } from './fin-host-kit';
import { BALANCES, LOCATIONS, ORDERS, workOrderChoices } from './inv-data';
import type { InventoryPorts } from './inv-state';

export function appendInventoryConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
  onRefreshed?: () => void,
): void {
  const { controller, permissions } = context;
  const section = el('section', 'commercial-console inventory-ledger-console');
  section.setAttribute('data-testid', 'kt-inv-host');
  section.setAttribute('data-route-view', 'procurement/inventory');
  workspace.append(section);
  void import('./inv-console').then(({ mountInventoryConsole, inventoryStatusFromHash }) => {
    if (!section.isConnected) return;
    const snapshot = () => ({
      balances: controller.views.get(BALANCES) ?? [],
      locations: controller.views.get(LOCATIONS) ?? [],
    });
    const ports: InventoryPorts = {
      permissions,
      initialBalances: snapshot().balances,
      initialLocations: snapshot().locations,
      initialStatus: inventoryStatusFromHash(
        typeof globalThis.location === 'undefined' ? '' : globalThis.location.hash,
      ),
      orders: perView(controller.views, ORDERS, workOrderChoices),
      actors: new Map(
        controller.employees.map((employee) => [
          employee.id,
          employee.displayName ?? employee.employeeNumber ?? employee.id,
        ]),
      ),
      fetchPage: (query) => finReadPage(controller.api.get, BALANCES, query),
      loadDetail: (key) => {
        const [lot = '', location = ''] = key.split(':');
        return (
          controller.api.get?.(
            `${BALANCES}/${encodeURIComponent(lot)}/${encodeURIComponent(location)}`,
          ) ?? Promise.resolve(null)
        );
      },
      refresh: async () => {
        await controller.refreshViews([BALANCES, LOCATIONS]);
        onRefreshed?.();
        return snapshot();
      },
      submit: (path, payload) => controller.submit(path, payload),
      attached: () => section.isConnected,
    };
    mountInventoryConsole(section, ports);
  });
}
