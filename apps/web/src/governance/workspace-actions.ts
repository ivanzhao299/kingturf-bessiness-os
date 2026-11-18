import { openForm, type FormField } from '../shared/forms';
import type { GovernanceActionContext, GovernanceWorkspacePorts } from './workspace-types';
import type { GovernanceController } from './controller';
import { governanceItems } from './presentation';
import { GOVERNANCE_SURFACES } from './surfaces';
import { recordValue } from '../shared/business-format';

// C4：下拉数据源对应的业务主体，供缺失读取权限时给出可行动提示。
const CHOICE_SUBJECTS: Readonly<Record<string, string>> = {
  '/api/v1/employees': '员工',
  '/api/v1/organizations': '组织',
  '/api/v1/roles': '角色',
  '/api/v1/permissions': '能力',
  '/api/v1/user-access-profiles': '登录账号',
  '/api/v1/master-data/categories': '主数据分类',
  '/api/v1/master-data/entries': '主数据条目',
  '/api/v1/number-definitions': '编号规则',
  '/api/v1/rules': '业务规则',
  '/api/v1/workflows': '工作流',
  '/api/v1/scope-grants': '数据范围记录',
};
export function createGovernanceFormActions(
  context: Pick<GovernanceActionContext, 'controller' | 'views' | 'workspace'>,
  ports: GovernanceWorkspacePorts &
    Readonly<{ rebuild: (controller: GovernanceController, host: HTMLElement) => HTMLElement }>,
) {
  const { controller, views, workspace } = context;
  const { replaceRouteView, rebuild } = ports;
  const records = (path: string) => {
    const view = views.find((item) => item.path === path);
    return governanceItems(view?.value).map((item) => recordValue(item));
  };
  const choices = (path: string, label: (item: Record<string, unknown>) => string) =>
    records(path)
      .filter((item) => typeof item.id === 'string')
      .map((item) => ({ value: String(item.id), label: label(item) }));
  // C4：按钮依赖的数据面不可见（视图未加载，通常是缺少对应 read 权限）时，
  // 用提示文案替代静默空下拉。
  const choiceAvailability = (path: string): string | undefined => {
    if (views.some((item) => item.path === path)) return undefined;
    const surface = GOVERNANCE_SURFACES.find((item) => item.paths.includes(path));
    const subject = CHOICE_SUBJECTS[path];
    return surface && subject ? `需要 ${surface.readPermission} 权限才能选择${subject}` : undefined;
  };
  const openAction = (
    title: string,
    description: string,
    fields: readonly FormField[],
    submit: (values: Record<string, string>) => Promise<void>,
    // B3：动词化提交文案；命中 shared/forms 敏感词正则即自动获得二次确认勾选。
    submitLabel = '确认提交',
  ) => {
    openForm(workspace, title, description, fields, submitLabel, async (values) => {
      await submit(values);
      replaceRouteView(workspace, rebuild(controller, workspace));
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
  // B4：乐观并发版本守卫——记录未命中/缺 version 时不发请求（原实现发送 NaN）。
  const requiredVersion = (selected: Record<string, unknown> | undefined): number => {
    const version = Number(selected?.version);
    if (!Number.isFinite(version)) throw new Error('记录版本未知，请刷新后重试');
    return version;
  };
  return {
    records,
    choices,
    choiceAvailability,
    openAction,
    jsonField,
    requiredValue,
    requiredVersion,
  };
}
