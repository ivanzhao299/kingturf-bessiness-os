import type { CommercialApi } from './types';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';

export type CreditContractViewContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: Pick<
    SalesViewController,
    'customers' | 'opportunities' | 'views' | 'message' | 'submit' | 'load'
  > &
    Readonly<{ api: Pick<CommercialApi, 'uploadContractDocument'> }>;
  permissions: ReadonlySet<string>;
  ports: Pick<SalesViewPorts, 'textValue' | 'recordValue' | 'displayMoney'> &
    Readonly<{
      currencyLabel: (value: unknown) => string;
      recordText: (
        record: Record<string, unknown>,
        camel: string,
        snake: string,
        fallback?: string,
      ) => string;
      businessStateLabel: (value: unknown, fallback?: string) => string;
    }>;
}>;
