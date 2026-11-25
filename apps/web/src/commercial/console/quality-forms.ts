import type { FormSectionField } from '@kingturf/ui';
import type { Choice } from './console-choices';
import { finText, type FinRow } from './fin-kit';
import { opsForm, type OpsForm } from './ops-form';
import type { CommercialPermission } from '../permissions';

export const qualityPaths = {
  plans: '/api/v1/quality-plans',
  inspections: '/api/v1/quality-inspections',
  complaints: '/api/v1/complaints',
  lots: '/api/v1/lot-traceability',
  sla: '/api/v1/complaint-sla-policies',
} as const;

export const qualityChoiceField = (
  name: string,
  label: string,
  options: readonly Choice[],
): FormSectionField =>
  options.length
    ? { name, label, type: 'select', required: true, options }
    : { name, label, required: true };

export const newQualityPlan = (items: readonly Choice[]) =>
  opsForm(
    '创建检验计划',
    '每个特性需要明确的数据类型和验收边界。',
    [
      { name: 'code', label: '计划编码', required: true },
      { name: 'name', label: '计划名称', required: true },
      qualityChoiceField('itemVersionId', '物料版本编号', items),
      {
        name: 'inspectionStage',
        label: '检验阶段',
        type: 'select',
        required: true,
        options: [
          { value: 'INCOMING', label: '来料' },
          { value: 'IN_PROCESS', label: '过程' },
          { value: 'FINAL', label: '终检' },
        ],
      },
      { name: 'samplingMethod', label: '抽样方式', required: true, value: '全检' },
      { name: 'acceptanceRule', label: '验收规则', required: true, value: '全部必检项通过' },
      { name: 'effectiveAt', label: '生效时间', type: 'datetime-local', required: true },
      { name: 'characteristicCode', label: '特性编码', required: true },
      { name: 'characteristicName', label: '特性名称', required: true },
      { name: 'lowerLimit', label: '下限（可选）', type: 'number' },
      { name: 'upperLimit', label: '上限（可选）', type: 'number' },
    ],
    '保存并发布计划',
    (values) => [
      qualityPaths.plans,
      {
        code: values.code,
        name: values.name,
        itemVersionId: values.itemVersionId,
        inspectionStage: values.inspectionStage,
        samplingMethod: values.samplingMethod,
        acceptanceRule: { description: values.acceptanceRule },
        effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
        characteristics: [
          {
            code: values.characteristicCode,
            name: values.characteristicName,
            dataType: 'NUMERIC',
            lowerLimit: values.lowerLimit ?? undefined,
            upperLimit: values.upperLimit ?? undefined,
            required: true,
            instructions: '',
          },
        ],
        publish: true,
      },
    ],
    '保存即发布，发布后的计划版本不可修改。',
  );

export const publishQualityPlan = (id: string) =>
  opsForm(
    '发布检验计划',
    '请核对检验阶段、特性和验收边界。',
    [{ name: 'confirmation', label: '发布确认说明', type: 'textarea', required: true }],
    '确认发布',
    () => [`${qualityPaths.plans}/${id}/publish`, {}],
    '发布后计划版本不可修改。',
  );

export const newQualityInspection = (plans: readonly Choice[], lots: readonly Choice[]) =>
  opsForm(
    '开立批次检验',
    '批次质量状态将记录在库存台账。',
    [
      {
        name: 'planVersionId',
        label: '已发布计划',
        type: 'select',
        required: true,
        options: plans,
      },
      { name: 'lotId', label: '待检批次', type: 'select', required: true, options: lots },
      { name: 'inspectionNumber', label: '检验单号', required: true },
      { name: 'sourceId', label: '来源业务编号', required: true },
      { name: 'sampleSize', label: '抽样数量', type: 'number', required: true, value: '1' },
    ],
    '开立检验',
    (values) => [
      qualityPaths.inspections,
      {
        inspectionNumber: values.inspectionNumber,
        planVersionId: values.planVersionId,
        lotId: values.lotId,
        sourceType: 'PRODUCTION_ROLL',
        sourceId: values.sourceId,
        sampleSize: values.sampleSize,
      },
    ],
  );

const inspectionTitles = {
  sample: '开始抽样',
  complete: '完成检验',
  cancel: '取消检验',
  release: '放行批次',
  reject: '拒收批次',
} as const;
type Command = keyof typeof inspectionTitles;

export const qualityInspectionCommand = (id: string, action: Command) => {
  const title = inspectionTitles[action];
  const disposition = action === 'release' || action === 'reject';
  return opsForm(
    title,
    '请填写操作理由和证据编号。',
    [
      {
        name: 'reason',
        label: disposition ? '处置理由' : '操作理由',
        type: 'textarea',
        required: true,
      },
      { name: 'evidence', label: '证据编号', required: true },
      { name: 'idempotencyKey', label: '幂等键', required: true },
    ],
    `确认${title}`,
    (values) => [
      `${qualityPaths.inspections}/${id}/${action}`,
      {
        reason: values.reason,
        evidence: { reference: values.evidence },
        idempotencyKey: values.idempotencyKey,
      },
    ],
    disposition || action === 'cancel' ? '确认后将追加不可撤回的质量状态记录。' : undefined,
  );
};

export const qualityResult = (
  id: string,
  characteristics: readonly Choice[],
  now = () => new Date(),
) =>
  opsForm(
    '记录检验结果',
    '按计划特性逐项登记。',
    [
      qualityChoiceField('characteristicId', '特性编号', characteristics),
      { name: 'measuredNumeric', label: '实测数值', type: 'number' },
      { name: 'passed', label: '通过（true/false）', required: true, value: 'true' },
      { name: 'notes', label: '备注', type: 'textarea' },
      { name: 'idempotencyKey', label: '幂等键', required: true },
    ],
    '保存结果',
    (values) => [
      `${qualityPaths.inspections}/${id}/results`,
      {
        characteristicId: values.characteristicId,
        measuredNumeric: values.measuredNumeric ?? undefined,
        passed: values.passed === 'true',
        notes: values.notes ?? '',
        occurredAt: now().toISOString(),
        idempotencyKey: values.idempotencyKey,
      },
    ],
  );

export function inspectionForms(
  row: FinRow,
  permissions: ReadonlySet<CommercialPermission>,
  choices: readonly Choice[],
): OpsForm[] {
  const id = finText(row, 'id');
  if (!id) return [];
  const entries: OpsForm[] = [];
  const state = finText(row, 'state') || 'OPEN';
  const canInspect = permissions.has('quality:inspect');
  const sampled = state === 'SAMPLED';
  const canDispose = sampled || state === 'COMPLETED';
  if (canInspect && state === 'OPEN') entries.push(qualityInspectionCommand(id, 'sample'));
  if (canInspect && sampled) entries.push(qualityInspectionCommand(id, 'complete'));
  if (canInspect && (state === 'OPEN' || sampled))
    entries.push(qualityInspectionCommand(id, 'cancel'));
  if (canInspect && canDispose) entries.push(qualityResult(id, choices));
  if (canDispose && permissions.has('quality:disposition')) {
    entries.push(qualityInspectionCommand(id, 'release'), qualityInspectionCommand(id, 'reject'));
  }
  return entries;
}
