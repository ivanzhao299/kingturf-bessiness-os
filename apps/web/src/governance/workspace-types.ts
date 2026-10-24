import type { GovernanceController, GovernanceView } from './controller';
import type { GovernanceSurface } from './surfaces';
import type { FormField } from '../shared/forms';
export type GovernanceWorkspacePorts = Readonly<{
  replaceRouteView: (current: HTMLElement, replacement: HTMLElement) => void;
}>;
export type GovernanceActionContext = Readonly<{
  controller: GovernanceController;
  permissions: ReadonlySet<string>;
  views: readonly GovernanceView[];
  workspace: HTMLElement;
  visible: readonly GovernanceSurface[];
  surface: GovernanceSurface;
  panel: HTMLElement;
  actions: HTMLDivElement;
  records: (path: string) => Record<string, unknown>[];
  choices: (
    path: string,
    label: (item: Record<string, unknown>) => string,
  ) => { value: string; label: string }[];
  openAction: (
    title: string,
    description: string,
    fields: readonly FormField[],
    submit: (values: Record<string, string>) => Promise<void>,
  ) => void;
  jsonField: (value: string | undefined, label: string) => Record<string, unknown>;
  requiredValue: (value: string | undefined, label: string) => string;
}>;
