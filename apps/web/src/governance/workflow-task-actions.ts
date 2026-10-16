import { el } from '../dom';
import { textValue } from '../shared/business-format';
import { businessStateLabel } from '../shared/business-labels';
import type { GovernanceActionContext } from './workspace-types';
export function appendGovernanceTaskActions(context: GovernanceActionContext) {
  const { surface, permissions, openAction, choices, records, controller, requiredValue, actions } =
    context;
  if (surface.id === 'workflow' && permissions.has('workflow:decide')) {
    const decide = el('button', 'secondary', '处理审批待办');
    decide.addEventListener('click', () => {
      openAction(
        '处理工作流待办',
        '审批人、法定人数和申请人隔离由服务器校验。',
        [
          {
            name: 'taskId',
            label: '待办任务',
            type: 'select',
            required: true,
            options: choices(
              '/api/v1/workflow-tasks',
              (item) =>
                `${textValue(item.stepKey, '待办')} · ${businessStateLabel(item.state, '待处理')}`,
            ),
          },
          {
            name: 'decision',
            label: '决定',
            type: 'select',
            required: true,
            options: [
              { value: 'approve', label: '批准' },
              { value: 'reject', label: '拒绝' },
            ],
          },
          { name: 'comment', label: '审批意见', type: 'textarea' },
        ],
        async (values) => {
          const selected = records('/api/v1/workflow-tasks').find(
            (item) => item.id === values.taskId,
          );
          await controller.submit(
            `/api/v1/workflow-tasks/${requiredValue(values.taskId, '审批任务')}/decisions`,
            {
              decision: values.decision,
              comment: values.comment ?? null,
              version: Number(selected?.version),
            },
          );
        },
      );
    });
    actions.append(decide);
  }
}
