import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceRuleActions(context: GovernanceActionContext) {
  const {
    surface,
    permissions,
    openAction,
    controller,
    jsonField,
    actions,
    choices,
    requiredValue,
  } = context;
  if (surface.id === 'rules' && permissions.has('rule:create')) {
    const rule = el('button', 'secondary', '新建业务规则');
    rule.addEventListener('click', () => {
      openAction(
        '新建业务规则',
        '规则表达式和必需输入由服务器校验；草稿发布后才能用于业务判断。',
        [
          { name: 'code', label: '规则编码', required: true },
          { name: 'ast', label: '规则表达式（高级配置）', type: 'textarea', required: true },
          { name: 'requiredInputs', label: '必需输入（每行一个）', type: 'textarea' },
        ],
        (values) =>
          controller.submit('/api/v1/rules', {
            code: values.code,
            ast: jsonField(values.ast, '规则表达式'),
            requiredInputs: (values.requiredInputs ?? '')
              .split(/\r?\n/u)
              .map((item) => item.trim())
              .filter(Boolean),
          }),
      );
    });
    actions.append(rule);
  }
  if (surface.id === 'rules' && permissions.has('rule:update')) {
    const publish = el('button', 'secondary', '发布规则版本');
    publish.addEventListener('click', () => {
      openAction(
        '发布业务规则',
        '已发布规则不可修改，试算和业务执行始终引用冻结版本。',
        [
          {
            name: 'ruleId',
            label: '业务规则',
            type: 'select',
            required: true,
            options: choices('/api/v1/rules', (item) => textValue(item.code, '规则')),
          },
          { name: 'version', label: '待发布版本', type: 'number', required: true },
        ],
        (values) =>
          controller.submit(`/api/v1/rules/${requiredValue(values.ruleId, '业务规则')}/publish`, {
            version: Number(values.version),
          }),
      );
    });
    actions.append(publish);
  }
  if (surface.id === 'rules' && permissions.has('rule:evaluate')) {
    const evaluate = el('button', 'secondary', '试算规则');
    evaluate.addEventListener('click', () => {
      openAction(
        '试算业务规则',
        '试算返回决策、输入哈希和逐步计算轨迹。',
        [
          {
            name: 'ruleId',
            label: '业务规则',
            type: 'select',
            required: true,
            options: choices('/api/v1/rules', (item) => textValue(item.code, '规则')),
          },
          { name: 'input', label: '输入数据（高级配置）', type: 'textarea', required: true },
        ],
        (values) =>
          controller.submit(`/api/v1/rules/${requiredValue(values.ruleId, '业务规则')}/evaluate`, {
            input: jsonField(values.input, '输入数据'),
          }),
      );
    });
    actions.append(evaluate);
  }
}
