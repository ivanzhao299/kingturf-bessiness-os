import { AR_LIST_PATH } from './ar-ports';
import { COLLECTION_PATH } from './collection-ports';
import {
  finDetailUrl,
  finHostSection,
  finLedgerUpdates,
  finMount,
  finReadPage,
  type FinHostContext,
} from './fin-host-kit';

export function appendCollectionConsole({
  workspace,
  controller,
  permissions,
  ports,
  appRoutes,
}: FinHostContext): void {
  const read = controller.api.get;
  const section = finHostSection('collection-console', 'kt-collection-console', 'collections');
  workspace.append(section);
  finMount(section, {
    kind: 'collections',
    ports: {
      ledgerUpdates: finLedgerUpdates(workspace, section),
      permissions,
      get receivables() {
        return (controller.views.get(AR_LIST_PATH) ?? [])
          .filter(
            (row) =>
              Number(ports.recordText(row, 'remainingAmount', 'remaining_amount', '0')) > 0 &&
              Date.parse(ports.recordText(row, 'dueAt', 'due_at')) < Date.now(),
          )
          .map((row) => ({
            value: ports.textValue(row.id, ''),
            label: `${ports.recordText(row, 'documentNumber', 'document_number')} · ${ports.recordText(row, 'currency', 'currency')} ${ports.recordText(row, 'remainingAmount', 'remaining_amount')}`,
          }));
      },
      get employees() {
        return controller.employees.map((item) => ({
          value: item.id,
          label: item.displayName ?? item.employeeNumber ?? item.id,
        }));
      },
      arRouteVisible: appRoutes.has('receivables'),
      currencyLabel: ports.currencyLabel,
      fetchPage: (query) => finReadPage(read, COLLECTION_PATH, query),
      loadDetail: async (id) => (read ? await read(finDetailUrl(COLLECTION_PATH, id)) : null),
      submit: async (path, body) => {
        await controller.submit(path, body);
      },
      refresh: () => controller.load(),
    },
  });
}
