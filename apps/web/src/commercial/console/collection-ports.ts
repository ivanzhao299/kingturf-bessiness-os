import type { FinChoice } from './ar-ports';
import type { FinPage, FinQuery, FinRow } from './fin-kit';

export const COLLECTION_PATH = '/api/v1/collection-cases';

export type CollectionPorts = Readonly<{
  permissions: ReadonlySet<string>;
  receivables: readonly FinChoice[];
  employees: readonly FinChoice[];
  arRouteVisible: boolean;
  currencyLabel: (currency: unknown) => string;
  fetchPage: (query: FinQuery) => Promise<FinPage>;
  loadDetail: (id: string) => Promise<FinRow | null>;
  submit: (path: string, body: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}>;
