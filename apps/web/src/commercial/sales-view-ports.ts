import type { Customer } from '../crm/types';
import type { Opportunity } from './types';

// Structural type only: every view receives the original controller object, not a copy.
export type SalesViewController = {
  opportunities: readonly Opportunity[];
  customers: readonly Customer[];
  views: ReadonlyMap<string, readonly Record<string, unknown>[]>;
  message: string;
  submit(path: string, payload: Record<string, unknown>, method?: 'POST' | 'PATCH'): Promise<void>;
  load(): Promise<void>;
  transitionOpportunity(opportunity: Opportunity, status: string, reason: string): Promise<void>;
  uploadCtrAttachment(versionId: string, file: File): Promise<void>;
};

export type SalesViewPorts = Readonly<{
  recordValue: (value: unknown) => Record<string, unknown>;
  displayRequirement: (value: unknown) => string;
  formValue: (value: unknown) => string;
  textValue: (value: unknown, fallback: string) => string;
  displayMoney: (currency: unknown, value: unknown) => string;
  ctrRequirementFields: readonly (readonly [string, string])[];
  technicalSolutionOpportunityId: (
    ctrs: readonly Record<string, unknown>[],
    ctrVersionId: string,
  ) => string;
  opportunityPipelineSummary: (opportunities: readonly Opportunity[]) => Readonly<{
    active: number;
    overdue: number;
    closingSoon: number;
    customerMissing: number;
  }>;
  replaceRouteView: (current: HTMLElement, replacement: HTMLElement) => void;
  rebuildWorkspace: () => HTMLElement;
}>;
