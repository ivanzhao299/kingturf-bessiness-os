import { el } from '../dom';
import { textValue } from '../shared/business-format';
import { governanceChannelLabel } from './presentation';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceNotificationActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, records, controller, actions } = context;
  if (surface.id === 'notifications' && permissions.has('notification:manage')) {
    const preference = el('button', 'secondary', '通知偏好');
    preference.addEventListener('click', () => {
      openAction(
        '更新通知偏好',
        '仅调整当前账号的通知通道，使用版本号防止并发覆盖。',
        [
          {
            name: 'channel',
            label: '通知通道',
            type: 'select',
            required: true,
            options: records('/api/v1/notification-preferences').map((item) => ({
              value: textValue(item.channel, ''),
              label: `${governanceChannelLabel(item.channel)} · ${item.enabled === false ? '关闭' : '开启'}`,
            })),
          },
          {
            name: 'enabled',
            label: '状态',
            type: 'select',
            required: true,
            options: [
              { value: 'true', label: '开启' },
              { value: 'false', label: '关闭' },
            ],
          },
        ],
        async (values) => {
          const selected = records('/api/v1/notification-preferences').find(
            (item) => item.channel === values.channel,
          );
          await controller.submit(
            '/api/v1/notification-preferences',
            {
              channel: values.channel,
              enabled: values.enabled === 'true',
              expectedVersion: Number(selected?.version ?? 0),
            },
            'PUT',
          );
        },
      );
    });
    actions.append(preference);
  }
}
