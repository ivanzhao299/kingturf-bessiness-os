import { el } from '../../dom';
import type { OperationsViewContext } from '../operations-view-ports';
import { perView } from './console-choices';
import { finReadPage } from './fin-host-kit';
import type { SupplierQuotePorts } from './sq-console';

const QUOTES = '/api/v1/supplier-quotes';
const RFQS = '/api/v1/procurement-rfqs';
const SUPPLIERS = '/api/v1/suppliers';

export function appendSupplierQuoteConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
  onRefreshed?: () => void,
): void {
  const { controller, permissions } = context;
  const ports: SupplierQuotePorts = {
    permissions,
    initialQuotes: controller.views.get(QUOTES) ?? [],
    rfqs: perView(controller.views, RFQS, (rows) => rows),
    // Legacy options include every readable supplier. Existing write guards enforce eligibility.
    suppliers: perView(controller.views, SUPPLIERS, (rows) =>
      rows.map((row) => ({
        value: context.ports.recordText(row, 'id', 'id'),
        label: context.ports.recordText(row, 'name', 'name'),
      })),
    ),
    fetchPage: (query) => finReadPage(controller.api.get, QUOTES, query),
    loadDetail: (id) =>
      controller.api.get?.(`${QUOTES}/${encodeURIComponent(id)}`) ?? Promise.resolve(null),
    refresh: async () => {
      await controller.refreshViews([QUOTES]);
      onRefreshed?.();
      return controller.views.get(QUOTES) ?? [];
    },
    submit: (path, payload) => controller.submit(path, payload),
  };
  const section = el('section', 'commercial-console supplier-quote-console');
  section.setAttribute('data-testid', 'kt-sq-host');
  section.setAttribute('data-route-view', 'procurement/supplier-quotes');
  workspace.append(section);
  void import('./sq-console').then(({ mountSupplierQuoteConsole }) => {
    if (section.isConnected) mountSupplierQuoteConsole(section, ports);
  });
}
