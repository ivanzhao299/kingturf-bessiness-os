import { el } from '../dom';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceRegistryActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, controller, jsonField, actions } = context;
  if (surface.id === 'registry' && permissions.has('business-object:manage')) {
    const object = el('button', 'secondary', '新建业务对象');
    object.addEventListener('click', () => {
      openAction(
        '新建业务对象',
        '对象定义用于统一字段、关系和附件绑定语义。',
        [
          { name: 'code', label: '对象编码', required: true },
          { name: 'name', label: '对象名称', required: true },
          { name: 'schema', label: '对象结构（高级配置）', type: 'textarea', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/business-objects', {
            code: values.code,
            name: values.name,
            schema: jsonField(values.schema, '对象结构'),
          }),
      );
    });
    actions.append(object);
  }
}
