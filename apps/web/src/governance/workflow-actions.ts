import { el } from '../dom';
import { textValue } from '../shared/business-format';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceWorkflowActions(context: GovernanceActionContext) {
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
  if (surface.id === 'workflow' && permissions.has('workflow:create')) {
    const workflow = el('button', 'secondary', '新建工作流');
    workflow.addEventListener('click', () => {
      openAction(
        '新建工作流',
        '流程定义采用受校验的结构化规范；发布和启动由独立能力控制。',
        [
          { name: 'code', label: '工作流编码', required: true },
          { name: 'spec', label: '流程规范（高级配置）', type: 'textarea', required: true },
        ],
        (values) =>
          controller.submit('/api/v1/workflows', {
            code: values.code,
            spec: jsonField(values.spec, '流程规范'),
          }),
      );
    });
    actions.append(workflow);
  }
  if (surface.id === 'workflow' && permissions.has('workflow:update')) {
    const publish = el('button', 'secondary', '发布工作流');
    publish.addEventListener('click', () => {
      openAction(
        '发布工作流',
        '发布后启动的实例固定引用该流程版本。',
        [
          {
            name: 'workflowId',
            label: '工作流',
            type: 'select',
            required: true,
            options: choices('/api/v1/workflows', (item) => textValue(item.code, '工作流')),
          },
          { name: 'version', label: '待发布版本', type: 'number', required: true },
        ],
        (values) =>
          controller.submit(
            `/api/v1/workflows/${requiredValue(values.workflowId, '工作流')}/publish`,
            {
              version: Number(values.version),
            },
          ),
      );
    });
    actions.append(publish);
  }
  if (surface.id === 'workflow' && permissions.has('workflow:start')) {
    const start = el('button', 'secondary', '启动工作流');
    start.addEventListener('click', () => {
      openAction(
        '启动工作流实例',
        '流程实例绑定业务对象类型和对象编号，并使用防重键避免重复启动。',
        [
          {
            name: 'workflowId',
            label: '工作流',
            type: 'select',
            required: true,
            options: choices('/api/v1/workflows', (item) => textValue(item.code, '工作流')),
          },
          { name: 'subjectType', label: '业务对象类型', required: true },
          { name: 'subjectId', label: '业务对象编号', required: true },
        ],
        (values) =>
          controller.submit(
            `/api/v1/workflows/${requiredValue(values.workflowId, '工作流')}/instances`,
            {
              subjectType: values.subjectType,
              subjectId: values.subjectId,
            },
          ),
      );
    });
    actions.append(start);
  }
}
