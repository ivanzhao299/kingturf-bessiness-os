import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import type { CollectionAction } from './collection-payload';
import type { CollectionPorts } from './collection-ports';
import { finText, type FinRow } from './fin-kit';

type Values = Readonly<Record<string, string>>;
type FormInfo = Readonly<{
  title: string;
  description: string;
  submit: string;
  success: string;
  confirm?: string;
}>;

export const collectionForms: Record<CollectionAction, FormInfo> = {
  create: {
    title: '建立逾期催收案件',
    description: '同一应收单仅可建案一次，余额、币种和到期日由服务器核对。',
    submit: '确认建案',
    success: '已建立催收案件',
  },
  followup: {
    title: '记录催收跟进',
    description: '联系结果和下一动作将形成不可变证据。',
    submit: '保存跟进',
    success: '已保存催收跟进',
  },
  promise: {
    title: '登记付款承诺',
    description: '承诺金额不得超过实时应收余额。履约以真实核销条目为凭证。',
    submit: '保存承诺',
    success: '已登记付款承诺',
  },
  break: {
    title: '确认付款承诺违约',
    description: '确认前应核对承诺期限和最新核销记录。',
    submit: '确认违约',
    success: '已确认承诺违约',
    confirm: '违约将记录在案件时间线中并保留复核证据。',
  },
  handoff: {
    title: '申请法务移交',
    description: '申请人不能受理自己的移交。索赔金额以实时应收余额为准。',
    submit: '提交法务',
    success: '已提交法务移交',
    confirm: '提交后将冻结本次移交的索赔金额，并进入独立受理。',
  },
  accept: {
    title: '独立受理法务移交',
    description: '服务器和数据库会拒绝申请人自受理。',
    submit: '确认受理',
    success: '已受理法务移交',
    confirm: '受理后案件进入法务阶段，并记录受理意见。',
  },
  package: {
    title: '生成不可变债权证据包',
    description: '系统会标明缺失项。不完整的证据包无法用于法务结案。',
    submit: '冻结证据包',
    success: '已生成债权证据包',
    confirm: '生成后本版证据包将冻结，保留证据内容与哈希。',
  },
};

const required = (
  name: string,
  label: string,
  type?: FormSectionField['type'],
): FormSectionField => ({
  name,
  label,
  required: true,
  ...(type === undefined ? {} : { type }),
});
const options = (entries: readonly (readonly [string, string])[]) =>
  entries.map(([value, label]) => ({ value, label }));
const priorities = options([
  ['CRITICAL', '紧急'],
  ['HIGH', '高'],
  ['MEDIUM', '中'],
  ['LOW', '低'],
]);
const channels = options([
  ['PHONE', '电话'],
  ['EMAIL', '邮件'],
  ['LETTER', '函件'],
  ['MEETING', '会议'],
  ['VISIT', '上门'],
  ['OTHER', '其他'],
]);

function fieldsFor(
  action: CollectionAction,
  ports: CollectionPorts,
  row: FinRow | null,
): readonly FormSectionField[] {
  switch (action) {
    case 'create':
      return [
        required('caseNumber', '案件编号'),
        { ...required('arOpenItemId', '逾期应收', 'select'), options: ports.receivables },
        { ...required('assignedTo', '催收责任人', 'select'), options: ports.employees },
        { ...required('priority', '优先级', 'select'), options: priorities },
        required('reason', '建案原因', 'textarea'),
      ];
    case 'followup':
      return [
        { ...required('channel', '联系渠道', 'select'), options: channels },
        required('occurredAt', '联系时间', 'datetime-local'),
        required('contactPerson', '对方联系人'),
        required('outcome', '联系结果', 'textarea'),
        { name: 'nextActionAt', label: '下一动作时间', type: 'datetime-local' },
        required('evidenceReference', '证据引用'),
      ];
    case 'promise': {
      const currency = finText(row ?? {}, 'currency') || 'CNY';
      return [
        required('promisedAmount', '承诺金额', 'number'),
        {
          ...required('currency', '币种', 'select'),
          options: options([[currency, ports.currencyLabel(currency)]]),
        },
        required('promisedAt', '承诺时间', 'datetime-local'),
        required('dueAt', '承诺付款期限', 'datetime-local'),
        required('debtorContact', '承诺人'),
        required('evidenceReference', '承诺证据引用'),
      ];
    }
    case 'break':
      return [
        required('reason', '违约说明', 'textarea'),
        required('evidenceReference', '复核证据引用'),
      ];
    case 'handoff':
      return [required('handoffNumber', '移交编号'), required('reason', '移交原因', 'textarea')];
    case 'accept':
      return [
        required('reason', '受理意见', 'textarea'),
        required('reviewReference', '审查记录引用'),
      ];
    case 'package':
      return [required('packageNumber', '证据包编号')];
  }
}

export type CollectionFormProps = Readonly<{
  action: CollectionAction;
  row: FinRow | null;
  ports: CollectionPorts;
  error: string;
  onSubmit: (values: Values) => Promise<void> | void;
}>;
export const CollectionActionFields = (props: CollectionFormProps) => {
  const info = collectionForms[props.action];
  return (
    <FormSection
      title={info.title}
      description={info.description}
      fields={fieldsFor(props.action, props.ports, props.row)}
      submitLabel={info.submit}
      error={props.error}
      onSubmit={props.onSubmit}
    />
  );
};
export const CollectionCreateDrawer = (
  props: CollectionFormProps & Readonly<{ onClose: () => void }>,
) => (
  <DetailDrawer title={collectionForms.create.title} onClose={props.onClose}>
    <CollectionActionFields {...props} />
  </DetailDrawer>
);
