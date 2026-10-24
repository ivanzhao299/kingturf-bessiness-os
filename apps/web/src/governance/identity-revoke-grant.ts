import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceRevokeGrant(
  context: GovernanceActionContext,
  mayManageRoles: boolean,
) {
  const { openAction, choices, controller, actions } = context;
  if (mayManageRoles) {
    const revokeGrant = el('button', 'secondary danger', '撤销角色能力');
    revokeGrant.addEventListener('click', () => {
      openAction(
        '撤销角色能力',
        '撤销后持有该角色的用户将立即失去对应操作能力。',
        [
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
          {
            name: 'permissionId',
            label: '能力',
            type: 'select',
            required: true,
            options: choices('/api/v1/permissions', (item) => textValue(item.capability, '能力')),
          },
        ],
        (values) =>
          controller.submit(
            '/api/v1/grants',
            { roleId: values.roleId, permissionId: values.permissionId },
            'DELETE',
          ),
      );
    });
    actions.append(revokeGrant);
  }
}
