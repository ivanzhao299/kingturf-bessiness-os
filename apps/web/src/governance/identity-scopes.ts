import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';

// B4：撤销数据范围下拉标签——优先「员工名 · 能力 · scope」，取不到时回退「scope · 员工ID 前 8 位」。
export const scopeGrantChoiceLabeler =
  (profiles: readonly Record<string, unknown>[], permissions: readonly Record<string, unknown>[]) =>
  (item: Record<string, unknown>): string => {
    const employeeName = profiles.find(
      (profile) => String(profile.employeeId) === String(item.employeeId),
    )?.displayName;
    const capability = permissions.find(
      (permission) => String(permission.id) === String(item.permissionId),
    )?.capability;
    const scope = textValue(item.scope, '');
    if (typeof employeeName === 'string' && typeof capability === 'string')
      return `${employeeName} · ${capability} · ${scope}`;
    return `${scope} · ${String(item.employeeId).slice(0, 8)}`;
  };
export function appendGovernanceIdentityScopes(
  context: GovernanceActionContext,
  mayManageScopes: boolean,
) {
  const { openAction, choices, choiceAvailability, records, controller, requiredValue, actions } =
    context;
  if (mayManageScopes) {
    const scopeGrant = el('button', 'secondary', '配置用户数据范围');
    scopeGrant.addEventListener('click', () => {
      openAction(
        '配置用户直接数据范围',
        '直接数据范围只用于岗位角色之外的必要例外，应遵循最小授权原则。',
        [
          {
            name: 'employeeId',
            label: '员工',
            type: 'select',
            required: true,
            hint: choiceAvailability('/api/v1/employees'),
            options: choices(
              '/api/v1/employees',
              (item) =>
                `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
            ),
          },
          {
            name: 'permissionId',
            label: '能力',
            type: 'select',
            required: true,
            hint: choiceAvailability('/api/v1/permissions'),
            options: choices('/api/v1/permissions', (item) => textValue(item.capability, '能力')),
          },
          {
            name: 'scope',
            label: '数据范围',
            type: 'select',
            required: true,
            options: [
              { value: 'SELF', label: '本人' },
              { value: 'TEAM', label: '团队' },
              { value: 'DEPARTMENT', label: '部门' },
              { value: 'REGION', label: '区域' },
              { value: 'COMPANY', label: '公司' },
            ],
          },
          {
            name: 'organizationId',
            label: '团队/部门/区域',
            type: 'select',
            options: [
              { value: '', label: '不适用' },
              ...choices(
                '/api/v1/organizations',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            ],
          },
        ],
        (values) =>
          controller.submit('/api/v1/scope-grants', {
            employeeId: values.employeeId,
            permissionId: values.permissionId,
            scope: values.scope,
            organizationId: ['TEAM', 'DEPARTMENT', 'REGION'].includes(values.scope ?? '')
              ? requiredValue(values.organizationId, '组织范围')
              : null,
          }),
        '保存数据范围',
      );
    });
    const revokeScope = el('button', 'secondary danger', '撤销用户数据范围');
    revokeScope.addEventListener('click', () => {
      openAction(
        '撤销用户直接数据范围',
        '撤销后用户只保留角色自带的数据范围。',
        [
          {
            name: 'scopeGrantId',
            label: '数据范围记录',
            type: 'select',
            required: true,
            hint: choiceAvailability('/api/v1/scope-grants'),
            options: choices(
              '/api/v1/scope-grants',
              scopeGrantChoiceLabeler(
                records('/api/v1/user-access-profiles'),
                records('/api/v1/permissions'),
              ),
            ),
          },
        ],
        (values) =>
          controller.submit(
            `/api/v1/scope-grants/${requiredValue(values.scopeGrantId, '数据范围记录')}`,
            {},
            'DELETE',
          ),
        '撤销数据范围',
      );
    });
    actions.append(scopeGrant, revokeScope);
  }
}
