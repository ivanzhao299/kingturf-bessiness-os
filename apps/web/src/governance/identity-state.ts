import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceIdentityState(
  context: GovernanceActionContext,
  mayManageIdentity: boolean,
) {
  const { records, openAction, controller, requiredValue, actions } = context;
  if (mayManageIdentity) {
    const identityState = el('button', 'secondary', '账号启停与下线');
    identityState.addEventListener('click', () => {
      const profiles = records('/api/v1/user-access-profiles').filter(
        (item) => typeof item.identityId === 'string',
      );
      openAction(
        '账号启停与会话管理',
        '停用账号会立即撤销全部活动会话；启用账号不会恢复旧会话。',
        [
          {
            name: 'identityId',
            label: '登录账号',
            type: 'select',
            required: true,
            options: profiles.map((item) => ({
              value: String(item.identityId),
              label: `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')} · ${textValue(item.loginName, '')}`,
            })),
          },
          {
            name: 'active',
            label: '账号状态',
            type: 'select',
            required: true,
            options: [
              { value: 'true', label: '启用' },
              { value: 'false', label: '停用并强制下线' },
            ],
          },
          {
            name: 'revokeSessions',
            label: '强制撤销活动会话',
            type: 'select',
            required: true,
            options: [
              { value: 'true', label: '是' },
              { value: 'false', label: '否' },
            ],
          },
        ],
        (values) =>
          controller.submit(
            `/api/v1/identities/${requiredValue(values.identityId, '登录账号')}/state`,
            {
              active: values.active === 'true',
              revokeSessions: values.revokeSessions === 'true',
            },
            'PATCH',
          ),
      );
    });
    actions.append(identityState);
  }
}
