import type { CrmController, visibleCrmSections } from './controller';
import type { Customer360 } from './types';

export type CrmSections = ReturnType<typeof visibleCrmSections>;
export type EmployeeChoices = readonly Readonly<{ value: string; label: string }>[];
export type Pagination = (
  total: number,
  page: number,
  change: (page: number) => void,
) => HTMLElement;
export type SelectedCrmController = CrmController & { selected: Customer360 };
export type CrmRecordPorts = Readonly<{
  bootstrapView: (current: HTMLElement, controller: CrmController) => void;
  customer360Content: (view: Customer360) => HTMLElement;
  customerStateLabel: (state: string | undefined) => string;
}>;
