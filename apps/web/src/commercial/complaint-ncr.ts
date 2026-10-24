import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function appendComplaintNcrAction(
  context: OperationsViewContext,
  complaint: Record<string, unknown>,
  id: string,
  state: string,
  actionCell: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { requestId } = context.ports;
  if (state === 'INVESTIGATING' && permissions.has('ncr:manage') && controller.employees.length) {
    const openNcr = el('button', 'primary', '开立不合格报告');
    openNcr.addEventListener('click', () => {
      openForm(
        workspace,
        '开立不合格报告',
        '不合格报告将锁定当前投诉版本，并把质量调查、临时遏制和后续整改串成同一证据链。',
        [
          { name: 'ncrNumber', label: '不合格报告编号', required: true },
          { name: 'defectType', label: '缺陷类型', required: true },
          { name: 'affectedScope', label: '影响范围', type: 'textarea', required: true },
          {
            name: 'investigatorId',
            label: '质量调查员',
            type: 'select',
            required: true,
            options: controller.employees.map((employee) => ({
              value: employee.id,
              label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
            })),
          },
          {
            name: 'quarantinedQuantity',
            label: '隔离数量',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'temporaryContainment', label: '临时遏制措施', type: 'textarea' },
          { name: 'evidenceReference', label: '现场证据编号', required: true },
        ],
        '确认开立',
        async (values) => {
          await controller.submit(`/api/v1/complaints/${id}/ncrs`, {
            ncrNumber: values.ncrNumber,
            defectType: values.defectType,
            affectedScope: values.affectedScope,
            investigatorId: values.investigatorId,
            quarantinedQuantity: values.quarantinedQuantity,
            temporaryContainment: values.temporaryContainment ?? '',
            complaintExpectedVersion: complaint.version,
            evidence: { reference: values.evidenceReference },
            idempotencyKey: requestId(),
          });
          await refresh();
        },
      );
    });
    actionCell.append(openNcr);
  }
}
