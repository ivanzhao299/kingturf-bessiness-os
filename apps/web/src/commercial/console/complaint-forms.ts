import type { OperationsViewContext } from '../operations-view-ports';
import { type FinRow } from './fin-kit';
import { opsForm } from './ops-form';

type ComplaintContext = Pick<OperationsViewContext, 'controller' | 'ports' | 'permissions'>;

// Complaint command validators require a stable code; the random UUID remains opaque.
export const complaintCommandKey = (requestId: () => string): string =>
  `CMP-${requestId().toUpperCase()}`;

export function complaintCreate(context: ComplaintContext, slaPolicies: readonly FinRow[]) {
  const { controller } = context;
  const { recordText, COMPLAINT_SEVERITY_LABELS, requestId } = context.ports;
  return opsForm(
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
      {
        name: 'description',
        label: '问题描述',
        type: 'textarea',
        required: true,
        // TD-OPS-007（2026-11-26 项目所有者裁定，沿用现值）：与迁移 0054 的
        // CHECK(length(trim(description))>=10) 同值；服务端同样前置校验并按码点计数。
        minLength: 10,
        hint: '至少 10 个字符，不计首尾空白。',
      },
      { name: 'customerRequest', label: '客户诉求', type: 'textarea', required: true },
      { name: 'customerReference', label: '客户凭证编号', required: true },
    ],
    '确认登记',
    (values) => {
      const policy = slaPolicies.find((item) => String(item.id) === values.slaPolicyVersionId);
      if (!policy) throw new Error('所选投诉处理时限策略不可用');
      return [
        '/api/v1/complaints',
        {
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
          idempotencyKey: complaintCommandKey(requestId),
        },
      ];
    },
  );
}

export function complaintSla() {
  return opsForm(
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
    (values) => [
      '/api/v1/complaint-sla-policies',
      {
        policyCode: values.policyCode,
        version: Number(values.version),
        severity: values.severity,
        responseHours: Number(values.responseHours),
        containmentHours: Number(values.containmentHours),
        rootCauseHours: Number(values.rootCauseHours),
        closureHours: Number(values.closureHours),
        effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
      },
    ],
    '发布后的策略用于新投诉，现有投诉的处理时限保持原值。',
  );
}

export function complaintBatch(context: ComplaintContext, selected: ReadonlyMap<string, FinRow>) {
  const { controller } = context;
  const { requestId } = context.ports;
  return opsForm(
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
    (values) => [
      '/api/v1/complaints/batch-triage',
      {
        batchKey: complaintCommandKey(requestId),
        items: [...selected.values()].map((item) => ({
          id: item.id,
          expectedVersion: item.version,
          assignedTo: values.assignedTo,
          reason: values.reason,
        })),
      },
    ],
  );
}

export function complaintTransition(
  context: ComplaintContext,
  complaint: FinRow,
  id: string,
  action: 'investigate' | 'close',
  label: string,
  description: string,
) {
  const { requestId } = context.ports;
  return opsForm(
    label,
    description,
    [
      { name: 'reason', label: '处理说明', type: 'textarea', required: true },
      { name: 'evidenceReference', label: '证据编号', required: true },
    ],
    `确认${label}`,
    (values) => [
      `/api/v1/complaints/${id}/${action}`,
      {
        expectedVersion: complaint.version,
        reason: values.reason,
        evidence: { reference: values.evidenceReference },
        idempotencyKey: complaintCommandKey(requestId),
      },
    ],
    action === 'close' ? '确认后将归档投诉及其质量闭环记录。' : undefined,
  );
}

export function complaintNcr(context: ComplaintContext, complaint: FinRow, id: string) {
  const { controller } = context;
  const { requestId } = context.ports;
  return opsForm(
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
    (values) => [
      `/api/v1/complaints/${id}/ncrs`,
      {
        ncrNumber: values.ncrNumber,
        defectType: values.defectType,
        affectedScope: values.affectedScope,
        investigatorId: values.investigatorId,
        quarantinedQuantity: values.quarantinedQuantity,
        // TD-OPS-006（2026-11-26 裁定）：临时遏制说明留空时发空串，端点原样入库（列是 NOT NULL）。
        temporaryContainment: values.temporaryContainment ?? '',
        complaintExpectedVersion: complaint.version,
        evidence: { reference: values.evidenceReference },
        idempotencyKey: complaintCommandKey(requestId),
      },
    ],
  );
}
