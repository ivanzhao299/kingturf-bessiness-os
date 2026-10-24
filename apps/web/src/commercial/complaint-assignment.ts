import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function appendComplaintSlaAction(
  context: OperationsViewContext,
  complaintHead: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  if (permissions.has('complaint-sla:manage')) {
    const publishPolicy = el('button', 'secondary', '发布处理时限');
    publishPolicy.addEventListener('click', () => {
      openForm(
        workspace,
        '发布投诉处理时限',
        '时限按投诉等级独立发布；新版不会修改历史投诉使用的策略。',
        [
          { name: 'policyCode', label: '策略编码', required: true },
          { name: 'version', label: '版本', type: 'number', required: true, value: '1' },
          {
            name: 'severity',
            label: '投诉等级',
            type: 'select',
            required: true,
            options: [
              { value: 'LOW', label: '一般' },
              { value: 'MEDIUM', label: '较重' },
              { value: 'MAJOR', label: '重大' },
              { value: 'CRITICAL', label: '紧急' },
            ],
          },
          { name: 'responseHours', label: '首次响应（小时）', type: 'number', required: true },
          {
            name: 'containmentHours',
            label: '遏制措施（小时）',
            type: 'number',
            required: true,
          },
          { name: 'rootCauseHours', label: '根因确认（小时）', type: 'number', required: true },
          { name: 'closureHours', label: '闭环期限（小时）', type: 'number', required: true },
          { name: 'effectiveAt', label: '生效时间', type: 'datetime-local', required: true },
        ],
        '确认发布',
        async (values) => {
          await controller.submit('/api/v1/complaint-sla-policies', {
            policyCode: values.policyCode,
            version: Number(values.version),
            severity: values.severity,
            responseHours: Number(values.responseHours),
            containmentHours: Number(values.containmentHours),
            rootCauseHours: Number(values.rootCauseHours),
            closureHours: Number(values.closureHours),
            effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
          });
          await refresh();
        },
      );
    });
    complaintHead.append(publishPolicy);
  }
}

export function appendComplaintBatchAction(
  context: OperationsViewContext,
  complaintHead: HTMLElement,
  complaintPanel: HTMLElement,
  selected: Map<string, Record<string, unknown>>,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { requestId } = context.ports;
  if (
    permissions.has('complaint:triage') &&
    permissions.has('complaint:assign') &&
    controller.employees.length
  ) {
    const batch = el('button', 'primary', '批量分派');
    batch.disabled = true;
    batch.addEventListener('click', () => {
      openForm(
        workspace,
        '批量分派投诉',
        `已选择 ${String(selected.size)} 条待分诊投诉。系统会逐条校验权限和版本，失败项不会影响其他记录。`,
        [
          {
            name: 'assignedTo',
            label: '调查负责人',
            type: 'select',
            required: true,
            options: controller.employees.map((employee) => ({
              value: employee.id,
              label: `${employee.displayName ?? '未命名员工'} · ${employee.employeeNumber ?? '无工号'}`,
            })),
          },
          { name: 'reason', label: '分派说明', type: 'textarea', required: true },
        ],
        '确认分派',
        async (values) => {
          await controller.submit('/api/v1/complaints/batch-triage', {
            batchKey: requestId(),
            items: [...selected.values()].map((item) => ({
              id: item.id,
              expectedVersion: item.version,
              assignedTo: values.assignedTo,
              reason: values.reason,
            })),
          });
          await refresh();
        },
      );
    });
    complaintHead.append(batch);
    complaintPanel.addEventListener('change', () => {
      batch.disabled = selected.size === 0;
      batch.textContent = selected.size ? `批量分派（${String(selected.size)}）` : '批量分派';
    });
  }
  complaintPanel.append(complaintHead);
}
