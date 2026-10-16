import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceIdentityScopes(
  context: GovernanceActionContext,
  mayManageScopes: boolean,
) {
  const { openAction, choices, controller, requiredValue, actions } = context;
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
            options: choices(
              '/api/v1/scope-grants',
              (item) =>
                `${textValue(item.scope, '')} · ${textValue(item.employeeId, '').slice(0, 8)}`,
            ),
          },
        ],
        (values) =>
          controller.submit(
            `/api/v1/scope-grants/${requiredValue(values.scopeGrantId, '数据范围记录')}`,
            {},
            'DELETE',
          ),
      );
    });
    actions.append(scopeGrant, revokeScope);
  }
}
