import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function createGovernanceRoleButtons(context: GovernanceActionContext) {
  const { openAction, controller, choices } = context;
  const role = el('button', 'secondary', '新建角色');
  role.addEventListener('click', () => {
    openAction(
      '新建原子角色',
      '角色只承载一组职责；权限和数据范围通过独立授权配置。',
      [
        { name: 'code', label: '角色编码', required: true },
        { name: 'name', label: '角色名称', required: true },
      ],
      (values) => controller.submit('/api/v1/roles', { code: values.code, name: values.name }),
    );
  });
  const assignment = el('button', 'secondary', '分配角色');
  assignment.addEventListener('click', () => {
    openAction(
      '为员工分配角色',
      '分配前应确认职责分离规则；服务器会拒绝冲突组合。',
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
        controller.submit('/api/v1/assignments', {
          employeeId: values.employeeId,
          roleId: values.roleId,
        }),
    );
  });
  return { role, assignment };
}
