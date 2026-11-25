import type { FinChoice } from './ar-ports';
import type { FinPage, FinQuery, FinRow } from './fin-kit';

export const PAYMENT_PATH = '/api/v1/bank-payments';
export const RECONCILIATION_PATH = '/api/v1/reconciliation-runs';
export type PaymentTab = 'payments' | 'reconciliations';

export type PaymentPorts = Readonly<{
  permissions: ReadonlySet<string>;
  customers: readonly FinChoice[];
  fetchPage: (tab: PaymentTab, query: FinQuery) => Promise<FinPage>;
  loadDetail: (tab: PaymentTab, id: string) => Promise<FinRow | null>;
  submit: (path: string, payload: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}>;
