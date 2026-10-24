import type { CommercialPermission } from './permissions';
import type { SalesViewController } from './sales-view-ports';
import type { PricingViewController } from './pricing-view-ports';
import type { CreditContractViewContext } from './credit-contract-view-ports';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import type { OperationsViewContext } from './operations-view-ports';
export type WorkspaceAssemblyContext<C> = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: C | undefined;
  permissions: ReadonlySet<CommercialPermission>;
}>;
export type WorkspaceReadinessController = Pick<SalesViewController, 'views'>;
type Records = readonly Record<string, unknown>[];
type ReadinessSteps = readonly Readonly<{ state: string; label: string; count: number }>[];
export type WorkspaceReadinessPorts = Readonly<{
  recordValue: (value: unknown) => Record<string, unknown>;
  contractOrderReadiness: (
    quotes: Records,
    decisions: Records,
    contracts: Records,
    orders: Records,
  ) => ReadinessSteps;
  quoteWorkflowReadiness: (
    ctrs: Records,
    solutions: Records,
    costs: Records,
    policies: Records,
    quotes: Records,
  ) => ReadinessSteps;
  cashRiskSummary: (
    receivables: Records,
    payments: Records,
    collectionCases: Records,
  ) => Readonly<{
    overdueReceivables: number;
    unappliedPayments: number;
    brokenPromises: number;
    legalPending: number;
  }>;
}>;
export type WorkspaceDashboardPorts = Readonly<{
  recordValue: WorkspaceReadinessPorts['recordValue'];
  recordText: OperationsViewContext['ports']['recordText'];
  currencyLabel: (value: unknown) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
}>;
export type SalesAssemblyController = SalesViewController &
  PricingViewController &
  CreditContractViewContext['controller'] &
  FulfillmentViewContext['controller'];
export type LegacyAssemblyController = Pick<
  PricingViewController,
  'views' | 'message' | 'submit' | 'revisionState' | 'quoteCommand'
>;
export type CommercialRevisionPath = (section: string, rootId: string) => string | null;
