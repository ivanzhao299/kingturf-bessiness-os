import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';
import { appendComplaintSlaAction, appendComplaintBatchAction } from './complaint-assignment';

export function appendComplaintActions(
  context: OperationsViewContext,
  complaintHead: HTMLElement,
  complaintPanel: HTMLElement,
  selected: Map<string, Record<string, unknown>>,
  slaPolicies: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText, COMPLAINT_SEVERITY_LABELS, requestId } = context.ports;
  if (permissions.has('complaint:create') && slaPolicies.length && controller.customers.length) {
    const createComplaint = el('button', 'primary', '＋ 登记投诉');
    createComplaint.addEventListener('click', () => {
      openForm(
        workspace,
        '登记客户投诉',
        '选择已发布的服务时限策略后，系统自动计算响应、遏制、根因和关闭期限。',
        [
          { name: 'complaintNumber', label: '投诉单号', required: true },
          {
            name: 'customerId',
            label: '客户',
            type: 'select',
            required: true,
            options: controller.customers.map((customer) => ({
              value: customer.id,
              label: customer.name ?? customer.customerNumber ?? '未命名客户',
            })),
          },
          {
            name: 'slaPolicyVersionId',
            label: '投诉等级与处理时限',
            type: 'select',
            required: true,
            options: slaPolicies.map((policy) => ({
              value: String(policy.id),
              label: `${COMPLAINT_SEVERITY_LABELS[recordText(policy, 'severity', 'severity')] ?? '未分级'} · ${recordText(policy, 'policyCode', 'policy_code')} 第 ${recordText(policy, 'version', 'version')} 版`,
            })),
          },
          {
            name: 'channel',
            label: '受理渠道',
            type: 'select',
            required: true,
            options: [
              { value: 'CUSTOMER_SERVICE', label: '客户服务' },
              { value: 'SALES', label: '销售反馈' },
              { value: 'EMAIL', label: '电子邮件' },
              { value: 'PHONE', label: '电话' },
              { value: 'ONSITE', label: '现场' },
              { value: 'OTHER', label: '其他' },
            ],
          },
          { name: 'defectCategory', label: '问题分类', required: true, value: 'OTHER' },
          { name: 'occurredAt', label: '问题发生时间', type: 'datetime-local', required: true },
          { name: 'reportedAt', label: '客户反馈时间', type: 'datetime-local', required: true },
          { name: 'description', label: '问题描述', type: 'textarea', required: true },
          { name: 'customerRequest', label: '客户诉求', type: 'textarea', required: true },
          { name: 'customerReference', label: '客户凭证编号', required: true },
        ],
        '确认登记',
        async (values) => {
          const policy = slaPolicies.find((item) => String(item.id) === values.slaPolicyVersionId);
          if (!policy) throw new Error('所选投诉处理时限策略不可用');
          await controller.submit('/api/v1/complaints', {
            complaintNumber: values.complaintNumber,
            customerId: values.customerId,
            slaPolicyVersionId: values.slaPolicyVersionId,
            channel: values.channel,
            defectCategory: values.defectCategory,
            severity: recordText(policy, 'severity', 'severity'),
            occurredAt: new Date(values.occurredAt ?? '').toISOString(),
            reportedAt: new Date(values.reportedAt ?? '').toISOString(),
            description: values.description,
            customerRequest: values.customerRequest,
            initialSnapshot: { customerReference: values.customerReference },
            idempotencyKey: requestId(),
          });
          await refresh();
        },
      );
    });
    complaintHead.append(createComplaint);
  }
  appendComplaintSlaAction(context, complaintHead, refresh);
  appendComplaintBatchAction(context, complaintHead, complaintPanel, selected, refresh);
}
