import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function createGovernanceGrantButton(context: GovernanceActionContext) {
  const { openAction, choices, controller } = context;
  const grant = el('button', 'secondary', '授予能力');
  grant.addEventListener('click', () => {
    openAction(
      '为角色授予能力',
      '默认使用公司范围；字段白名单可在后续精细授权中继续收窄。',
      [
        {
          name: 'roleId',
          label: '角色',
          type: 'select',
          required: true,
          options: choices('/api/v1/roles', (item) => textValue(item.code, '角色')),
        },
        {
          name: 'permissionId',
          label: '能力',
          type: 'select',
          required: true,
          options: choices('/api/v1/permissions', (item) => textValue(item.capability, '能力')),
        },
      ],
      (values) =>
        controller.submit('/api/v1/grants', {
          roleId: values.roleId,
          permissionId: values.permissionId,
          scopes: ['COMPANY'],
          fields: null,
        }),
    );
  });
  return { grant };
}
