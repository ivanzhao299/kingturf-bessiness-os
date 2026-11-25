import {
  finDetailUrl,
  finHostSection,
  finMount,
  finReadPage,
  type FinHostContext,
} from './fin-host-kit';
import { PAYMENT_PATH, RECONCILIATION_PATH, type PaymentTab } from './payment-ports';

const pathOf = (tab: PaymentTab): string =>
  tab === 'payments' ? PAYMENT_PATH : RECONCILIATION_PATH;

export function appendPaymentConsole({ workspace, controller, permissions }: FinHostContext): void {
  const read = controller.api.get;
  const section = finHostSection('payment-console', 'kt-payment-console', 'payments');
  workspace.append(section);
  finMount(section, {
    kind: 'payments',
    ports: {
      permissions,
      get customers() {
        return controller.customers.map((customer) => ({
          value: customer.id,
          label: customer.name ?? customer.id,
        }));
      },
      fetchPage: (tab, query) => finReadPage(read, pathOf(tab), query),
      loadDetail: async (tab, id) => (read ? await read(finDetailUrl(pathOf(tab), id)) : null),
      submit: async (path, body) => {
        await controller.submit(path, body);
      },
      refresh: () => controller.load(),
    },
  });
}
