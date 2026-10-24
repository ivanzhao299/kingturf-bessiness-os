import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceEmployeeActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, choices, controller, actions, records, requiredValue } =
    context;
  if (surface.id === 'employees' && permissions.has('employee:create')) {
    const create = el('button', 'secondary', '新建员工');
    create.addEventListener('click', () => {
      openAction(
        '新建员工',
        '员工必须归属当前公司下的有效组织；账号和角色在后续授权步骤配置。',
        [
          {
            name: 'organizationId',
            label: '所属组织',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/organizations',
              (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
            ),
          },
          { name: 'employeeNumber', label: '员工编号', required: true },
          { name: 'displayName', label: '员工姓名', required: true },
          { name: 'email', label: '登录邮箱', type: 'email', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/employees', {
            organizationId: values.organizationId,
            employeeNumber: values.employeeNumber,
            displayName: values.displayName,
            email: values.email,
          }),
      );
    });
    actions.append(create);
  }
  if (surface.id === 'employees' && permissions.has('employee:update')) {
    const update = el('button', 'secondary', '更新员工');
    update.addEventListener('click', () => {
      openAction(
        '更新员工',
        '更新显示名称或有效状态；字段权限和数据范围仍由服务器强制执行。',
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
          { name: 'displayName', label: '显示名称', required: true },
          {
            name: 'active',
            label: '账号状态',
            type: 'select',
            required: true,
            options: [
              { value: 'true', label: '有效' },
              { value: 'false', label: '停用' },
            ],
          },
        ],
        async (values) => {
          const selected = records('/api/v1/employees').find(
            (item) => item.id === values.employeeId,
          );
          await controller.submit(
            `/api/v1/employees/${requiredValue(values.employeeId, '员工')}`,
            {
              displayName: values.displayName,
              active: values.active === 'true',
              version: Number(selected?.version),
            },
            'PATCH',
          );
        },
      );
    });
    actions.append(update);
  }
}
