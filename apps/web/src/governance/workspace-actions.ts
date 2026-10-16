import { openForm, type FormField } from '../shared/forms';
import type { GovernanceActionContext, GovernanceWorkspacePorts } from './workspace-types';
import type { GovernanceController } from './controller';
import { governanceItems } from './presentation';
import { recordValue } from '../shared/business-format';
export function createGovernanceFormActions(
  context: Pick<GovernanceActionContext, 'controller' | 'views' | 'workspace'>,
  ports: GovernanceWorkspacePorts &
    Readonly<{ governanceWorkspace: (controller: GovernanceController) => HTMLElement }>,
) {
  const { controller, views, workspace } = context;
  const { replaceRouteView, governanceWorkspace } = ports;
  const records = (path: string) => {
    const view = views.find((item) => item.path === path);
    return governanceItems(view?.value).map((item) => recordValue(item));
  };
  const choices = (path: string, label: (item: Record<string, unknown>) => string) =>
    records(path)
      .filter((item) => typeof item.id === 'string')
      .map((item) => ({ value: String(item.id), label: label(item) }));
  const openAction = (
    title: string,
    description: string,
    fields: readonly FormField[],
    submit: (values: Record<string, string>) => Promise<void>,
  ) => {
    openForm(workspace, title, description, fields, '确认提交', async (values) => {
      await submit(values);
      replaceRouteView(workspace, governanceWorkspace(controller));
    });
  };
  const jsonField = (value: string | undefined, label: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(value ?? '{}') as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error(`${label}必须是键值对象格式`);
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `${label}格式无效`);
    }
  };
  const requiredValue = (value: string | undefined, label: string): string => {
    const normalized = value?.trim();
    if (!normalized) throw new Error(`${label}不能为空`);
    return normalized;
  };
  return { records, choices, openAction, jsonField, requiredValue };
}
