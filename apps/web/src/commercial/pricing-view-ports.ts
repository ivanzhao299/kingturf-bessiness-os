import type { FormField } from '../shared/forms';
import type { CostMatrixQuery } from './types';

// Type-only ports: views share the original controller, never a copied state object.
export type PricingViewController = {
  views: ReadonlyMap<string, readonly Record<string, unknown>[]>;
  message: string;
  revisionState: Record<string, unknown> | null;
  preferredQuoteCostDecisionId: string;
  selectedCostMatrixId: string;
  costMatrixQuery: CostMatrixQuery;
  costMatrixTotal: number;
  costMatrixDetails: ReadonlyMap<string, Record<string, unknown>>;
  submit(path: string, payload: Record<string, unknown>, method?: 'POST' | 'PATCH'): Promise<void>;
  load(): Promise<void>;
  loadCostMatrixPage(update?: Partial<CostMatrixQuery>): Promise<boolean>;
  refreshSelectedCostMatrix(): Promise<void>;
  openCostMatrix(id: string): Promise<void>;
  closeCostMatrix(): void;
  refreshViews(paths: readonly string[]): Promise<void>;
  quoteCommand(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<void>;
};
export type PricingViewPorts = Readonly<{
  textValue: (value: unknown, fallback: string) => string;
  recordValue: (value: unknown) => Record<string, unknown>;
  displayTime: (value: string) => string;
  currencyLabel: (value: unknown) => string;
  decimalValue: (value: number) => string;
  printIssuedQuote: (quote: Record<string, unknown>) => void;
  costMatrixAuditLabel: (action: string) => string;
  costMatrixRoleGuidance: (permissions: ReadonlySet<string>) => string;
  replaceRouteView: (current: HTMLElement, replacement: HTMLElement) => void;
  rebuildWorkspace: () => HTMLElement;
}>;
export type PricingViewContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: PricingViewController;
  permissions: ReadonlySet<string>;
  ports: PricingViewPorts;
}>;
type Records = readonly Record<string, unknown>[];
type Options = { value: string; label: string }[];
export type CostFactorOptions = Readonly<{
  itemVersions: Options;
  categoryOptions: Options;
  sourceOptions: Options;
  unitOptions: Options;
}>;
export type CostViewContext = PricingViewContext &
  CostFactorOptions &
  Readonly<{
    costPanel: HTMLElement;
    models: Records;
    publishedModels: Records;
    solutions: Records;
    matrices: Records;
    matrixSection: HTMLElement;
    costDialogHost: () => HTMLElement;
    setCostStatus: (message: string) => void;
    replaceCostMatrixSection: (accepted?: boolean) => void;
    refreshCostWorkspace: (message: string) => Promise<void>;
    openMatrix: (matrix: Record<string, unknown>, trigger: HTMLButtonElement) => void;
    factorFields: (
      matrix: Record<string, unknown>,
      factor?: Record<string, unknown>,
    ) => readonly FormField[];
  }>;
export type CostDetailContext = CostViewContext &
  Readonly<{
    selectedId: string;
    selectedMatrix: Record<string, unknown>;
    latest: Record<string, unknown>;
    factors: unknown[];
    calculations: unknown[];
    auditTrail: unknown[];
  }>;
export type CostDetailPanelsContext = CostDetailContext &
  Readonly<{ tabPanels: Map<string, HTMLElement> }>;
export type PolicyViewContext = PricingViewContext &
  Readonly<{ policies: Records; publishedPolicies: Records; policyPanel: HTMLElement }>;
export type QuoteViewContext = PricingViewContext &
  Readonly<{ costs: Records; policies: Records; solutions: Records; ctrs: Records }>;
export type QuoteCardContext = QuoteViewContext &
  Readonly<{
    latestQuoteVersions: ReadonlyMap<string, number>;
    quote: Record<string, unknown>;
    quoteStatus: string;
    card: HTMLElement;
    actions: HTMLElement;
  }>;
