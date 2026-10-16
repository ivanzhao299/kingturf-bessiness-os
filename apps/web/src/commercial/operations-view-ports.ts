import type { SalesViewController } from './sales-view-ports';
import type { Employee } from '../crm/types';
import type { CommercialApi } from './types';
import type { CommercialPermission } from './permissions';
export type ManufacturingDefinition = Readonly<{
  title: string;
  path: string;
  manage: CommercialPermission;
  publish: string;
}>;
export type OperationsViewContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: Pick<SalesViewController, 'customers' | 'views' | 'message' | 'submit' | 'load'> & {
    employees: readonly Employee[];
    api: Pick<CommercialApi, 'get' | 'uploadContractDocument'>;
  };
  permissions: ReadonlySet<CommercialPermission>;
  ports: Readonly<{
    recordValue: (value: unknown) => Record<string, unknown>;
    recordText: (
      record: Record<string, unknown>,
      camel: string,
      snake: string,
      fallback?: string,
    ) => string;
    textValue: (value: unknown, fallback: string) => string;
    decimalValue: (value: number) => string;
    inventoryLocationOption: (item: Record<string, unknown>) => { value: string; label: string };
    businessStateLabel: (value: unknown, fallback?: string) => string;
    supplyModeLabel: (value: unknown) => string;
    qualityStageLabel: (value: unknown) => string;
    operationsNextAction: (kind: 'mrp' | 'quality', state: string) => string;
    COMPLAINT_SEVERITY_LABELS: Readonly<Record<string, string>>;
    COMPLAINT_STATE_LABELS: Readonly<Record<string, string>>;
    requestId: () => string;
  }>;
}>;
