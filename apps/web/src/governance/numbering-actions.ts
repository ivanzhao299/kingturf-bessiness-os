import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceNumberingActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, controller, actions, choices, requiredValue } = context;
  if (surface.id === 'numbering' && permissions.has('number:create')) {
    const number = el('button', 'secondary', '新建编号规则');
    number.addEventListener('click', () => {
      openAction(
        '新建编号规则',
        '规则发布后才能分配正式编号。',
        [
          { name: 'code', label: '规则编码', required: true },
          { name: 'prefix', label: '前缀' },
          { name: 'padding', label: '数字位数', type: 'number', required: true },
          { name: 'startingValue', label: '起始值', type: 'number', required: true },
          { name: 'increment', label: '步长', type: 'number', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/number-definitions', {
            code: values.code,
            prefix: values.prefix ?? '',
            suffix: '',
            padding: Number(values.padding),
            startingValue: Number(values.startingValue),
            increment: Number(values.increment),
            resetPeriod: 'NEVER',
          }),
      );
    });
    actions.append(number);
  }
  if (surface.id === 'numbering' && permissions.has('number:update')) {
    const publish = el('button', 'secondary', '发布编号版本');
    publish.addEventListener('click', () => {
      openAction(
        '发布编号版本',
        '发布后的编号格式不可修改；后续调整必须创建新版本。',
        [
          {
            name: 'definitionId',
            label: '编号规则',
            type: 'select',
            required: true,
            options: choices('/api/v1/number-definitions', (item) =>
              textValue(item.code, '编号规则'),
            ),
          },
          { name: 'version', label: '待发布版本', type: 'number', required: true },
        ],
        (values) =>
          controller.submit(
            `/api/v1/number-definitions/${requiredValue(values.definitionId, '编号规则')}/publish`,
            {
              version: Number(values.version),
            },
          ),
      );
    });
    actions.append(publish);
  }
  if (surface.id === 'numbering' && permissions.has('number:allocate')) {
    const allocate = el('button', 'secondary', '分配测试编号');
    allocate.addEventListener('click', () => {
      openAction(
        '分配受控编号',
        '每次提交使用独立幂等键，返回值由服务器序列化生成。',
        [
          {
            name: 'definitionId',
            label: '编号规则',
            type: 'select',
            required: true,
            options: choices('/api/v1/number-definitions', (item) =>
              textValue(item.code, '编号规则'),
            ),
          },
        ],
        (values) =>
          controller.submit(
            `/api/v1/number-definitions/${requiredValue(values.definitionId, '编号规则')}/allocate`,
            {},
          ),
      );
    });
    actions.append(allocate);
  }
}
