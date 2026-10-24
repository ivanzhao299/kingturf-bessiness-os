import type { SalesViewController } from './sales-view-ports';
import type { Employee } from '../crm/types';
import type { CommercialPermission } from './permissions';

export type FinanceRiskViewContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: Pick<SalesViewController, 'customers' | 'views' | 'message' | 'submit' | 'load'> & {
    employees: readonly Employee[];
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
    currencyLabel: (value: unknown) => string;
    businessStateLabel: (value: unknown, fallback?: string) => string;
    commissionNextAction: (state: string) => string;
    riskRuleLabel: (value: unknown) => string;
  }>;
}>;
