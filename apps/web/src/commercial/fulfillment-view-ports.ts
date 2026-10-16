import type { SalesViewController } from './sales-view-ports';
import type { Employee } from '../crm/types';
import type { CommercialPermission } from './permissions';

export type FulfillmentViewContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: Pick<
    SalesViewController,
    'opportunities' | 'views' | 'message' | 'submit' | 'load'
  > & {
    employees: readonly Employee[];
    loadOrder360(orderId: string): Promise<Record<string, unknown>>;
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
    displayMoney: (currency: unknown, value: unknown) => string;
    decimalValue: (value: number) => string;
    inventoryLocationOption: (item: Record<string, unknown>) => { value: string; label: string };
    businessStateLabel: (value: unknown, fallback?: string) => string;
    operationsNextAction: (
      kind: 'production' | 'quality' | 'shipment' | 'cost',
      state: string,
    ) => string;
    shipmentGateLabel: (value: unknown) => string;
    businessEventLabel: (value: string) => string;
    businessEventDetailLabel: (type: string, detail: string) => string;
  }>;
}>;
