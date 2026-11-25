import { el } from '../../dom';
import type { ProductionOrderHostContext } from './production-order-host';

export function appendShipmentConsole(context: ProductionOrderHostContext): void {
  const section = el('section', 'commercial-console shipment-workbench');
  section.setAttribute('data-testid', 'kt-shipment-console');
  section.setAttribute('data-route-view', 'shipments');
  context.workspace.append(section);
  void import('./shipment-console').then(({ mountShipmentConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountShipmentConsole(section, context);
  });
}
