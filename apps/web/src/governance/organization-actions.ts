import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceOrganizationActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, choices, controller, actions, records, requiredValue } =
    context;
  if (surface.id === 'organizations' && permissions.has('organization:create')) {
    const create = el('button', 'secondary', '新建组织');
    create.addEventListener('click', () => {
      openAction(
        '新建组织',
        '组织将自动绑定当前公司，父组织必须处于同一公司。',
        [
          { name: 'code', label: '组织编码', required: true },
          { name: 'name', label: '组织名称', required: true },
          {
            name: 'parentId',
            label: '父组织',
            type: 'select',
            options: [
              { value: '', label: '无父组织' },
              ...choices(
                '/api/v1/organizations',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            ],
          },
        ],
        (values) =>
          controller.submit('/api/v1/organizations', {
            parentId: values.parentId?.trim() ? values.parentId : null,
            code: values.code,
            name: values.name,
            locale: 'zh-CN',
            currency: 'CNY',
          }),
      );
    });
    actions.append(create);
  }
  if (surface.id === 'organizations' && permissions.has('organization:update')) {
    const update = el('button', 'secondary', '更新组织');
    update.addEventListener('click', () => {
      openAction(
        '更新组织',
        '使用服务器当前版本执行乐观并发更新，避免覆盖其他管理员的修改。',
        [
          {
            name: 'organizationId',
            label: '组织',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/organizations',
              (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
            ),
          },
          { name: 'name', label: '新名称', required: true },
        ],
        async (values) => {
          const selected = records('/api/v1/organizations').find(
            (item) => item.id === values.organizationId,
          );
          await controller.submit(
            `/api/v1/organizations/${requiredValue(values.organizationId, '组织')}`,
            { name: values.name, version: Number(selected?.version) },
            'PATCH',
          );
        },
      );
    });
    actions.append(update);
  }
}
