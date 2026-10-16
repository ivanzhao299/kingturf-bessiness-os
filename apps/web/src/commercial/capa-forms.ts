import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function openCapaCreate(
  context: OperationsViewContext,
  complaint: Record<string, unknown>,
  ncrId: string,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller } = context;
  const { recordText, requestId } = context.ports;
  openForm(
    workspace,
    '建立纠正预防措施',
    '指定整改责任人、目标日期和根因快照。',
    [
      { name: 'capaNumber', label: '整改单号', required: true },
      {
        name: 'ownerId',
        label: '整改责任人',
        type: 'select',
        required: true,
        options: controller.employees.map((employee) => ({
          value: employee.id,
          label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
        })),
      },
      {
        name: 'targetAt',
        label: '目标完成时间',
        type: 'datetime-local',
        required: true,
      },
      { name: 'rootCause', label: '根因摘要', type: 'textarea', required: true },
      { name: 'evidenceReference', label: '处置证据编号', required: true },
    ],
    '确认建立',
    async (values) => {
      await controller.submit(`/api/v1/ncrs/${ncrId}/capas`, {
        capaNumber: values.capaNumber,
        ownerId: values.ownerId,
        targetAt: values.targetAt,
        riskLevel: recordText(complaint, 'severity', 'severity'),
        rootCauseSnapshot: { conclusion: values.rootCause },
        complaintExpectedVersion: complaint.version,
        evidence: { reference: values.evidenceReference },
        idempotencyKey: requestId(),
      });
      await refresh();
    },
  );
}

export function openCapaAction(
  context: OperationsViewContext,
  capaId: string,
  capaVersion: number,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller } = context;
  const { requestId } = context.ports;
  openForm(
    workspace,
    '新增整改措施',
    '措施必须有明确责任人和完成期限。',
    [
      {
        name: 'actionType',
        label: '措施类型',
        type: 'select',
        required: true,
        options: [
          { value: 'CORRECTIVE', label: '纠正措施' },
          { value: 'PREVENTIVE', label: '预防措施' },
        ],
      },
      { name: 'description', label: '措施内容', type: 'textarea', required: true },
      {
        name: 'ownerId',
        label: '责任人',
        type: 'select',
        required: true,
        options: controller.employees.map((employee) => ({
          value: employee.id,
          label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
        })),
      },
      { name: 'dueAt', label: '完成期限', type: 'datetime-local', required: true },
    ],
    '确认新增',
    async (values) => {
      await controller.submit(`/api/v1/capas/${capaId}/actions`, {
        ...values,
        expectedVersion: capaVersion,
        idempotencyKey: requestId(),
      });
      await refresh();
    },
  );
}

export function openCapaComplete(
  context: OperationsViewContext,
  incomplete: Record<string, unknown>,
  capaVersion: number,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller } = context;
  const { recordText, requestId } = context.ports;
  openForm(
    workspace,
    '完成整改措施',
    recordText(incomplete, 'description', 'description'),
    [{ name: 'evidenceReference', label: '完成证据编号', required: true }],
    '确认完成',
    async (values) => {
      await controller.submit(
        `/api/v1/capa-actions/${recordText(incomplete, 'id', 'id')}/complete`,
        {
          completedAt: new Date().toISOString(),
          evidence: { reference: values.evidenceReference },
          expectedCapaVersion: capaVersion,
          idempotencyKey: requestId(),
        },
      );
      await refresh();
    },
  );
}

export function openCapaVerify(
  context: OperationsViewContext,
  complaint: Record<string, unknown>,
  capaId: string,
  capaVersion: number,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller } = context;
  const { requestId } = context.ports;
  openForm(
    workspace,
    '验证整改效果',
    '验证人必须独立于整改责任人。',
    [
      { name: 'standard', label: '验证标准', required: true },
      { name: 'sampleScope', label: '抽样范围', required: true },
      {
        name: 'observationUntil',
        label: '观察期截止',
        type: 'datetime-local',
        required: true,
      },
      {
        name: 'result',
        label: '验证结论',
        type: 'select',
        required: true,
        options: [
          { value: 'PASSED', label: '通过' },
          { value: 'FAILED', label: '未通过' },
        ],
      },
      { name: 'evidenceReference', label: '验证报告编号', required: true },
    ],
    '提交验证',
    async (values) => {
      await controller.submit(`/api/v1/capas/${capaId}/verify`, {
        verifiedAt: new Date().toISOString(),
        standard: values.standard,
        sampleScope: values.sampleScope,
        observationUntil: values.observationUntil,
        result: values.result,
        evidence: { reference: values.evidenceReference },
        expectedVersion: capaVersion,
        complaintExpectedVersion: complaint.version,
        idempotencyKey: requestId(),
      });
      await refresh();
    },
  );
}

export function openCapaClose(
  context: OperationsViewContext,
  capaId: string,
  capaVersion: number,
  evidenceFields: Parameters<typeof openForm>[3],
  refresh: () => Promise<void>,
): void {
  const { workspace, controller } = context;
  const { requestId } = context.ports;
  openForm(
    workspace,
    '关闭整改单',
    '整改验证通过后归档整改单。',
    evidenceFields,
    '确认关闭',
    async (values) => {
      await controller.submit(`/api/v1/capas/${capaId}/close`, {
        expectedVersion: capaVersion,
        reason: values.reason,
        evidence: { reference: values.evidenceReference },
        idempotencyKey: requestId(),
      });
      await refresh();
    },
  );
}
