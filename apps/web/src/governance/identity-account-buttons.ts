import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function createGovernanceAccountButtons(context: GovernanceActionContext) {
  const { openAction, choices, controller, requiredValue } = context;
  const identity = el('button', 'secondary', '配置登录账号');
  identity.addEventListener('click', () => {
    openAction(
      '配置员工登录账号',
      '登录名必须唯一；密码只在本次提交中发送，不会在管理页面回显。',
      [
        {
          name: 'employeeId',
          label: '员工',
          type: 'select',
          required: true,
          options: choices(
            '/api/v1/employees',
            (item) => `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
          ),
        },
        { name: 'login', label: '登录名', required: true, minLength: 3, maxLength: 120 },
        {
          name: 'password',
          label: '临时密码',
          type: 'password',
          required: true,
          minLength: 12,
          hint: '至少 12 位；测试账号完成验收后必须停用。',
        },
      ],
      (values) =>
        controller.submit(
          `/api/v1/employees/${requiredValue(values.employeeId, '员工')}/identity`,
          { login: values.login, password: values.password },
          'PUT',
        ),
    );
  });
  const unassignment = el('button', 'secondary', '撤销角色');
  unassignment.addEventListener('click', () => {
    openAction(
      '撤销员工角色',
      '撤销后员工会立即失去该角色能力；当前会话仍由服务器逐次校验有效状态。',
      [
        {
          name: 'employeeId',
          label: '员工',
          type: 'select',
          required: true,
          options: choices(
            '/api/v1/employees',
            (item) => `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
          ),
        },
        {
          name: 'roleId',
          label: '角色',
          type: 'select',
          required: true,
          options: choices(
            '/api/v1/roles',
            (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
          ),
        },
      ],
      (values) =>
        controller.submit(
          '/api/v1/assignments',
          { employeeId: values.employeeId, roleId: values.roleId },
          'DELETE',
        ),
    );
  });
  return { identity, unassignment };
}
