import type { DataTableColumn, FormSectionField } from '@kingturf/ui';
import { StatusBadge } from '@kingturf/ui';
import { ConfigConsolePage, type ConfigActionSpec, type ConfigPageSpec } from './config-console';
import { TenantSettingsAppendix } from './tenant-settings-appendix';
import {
  NUMBERING_VERSION_FIELDS,
  RULE_VERSION_FIELDS,
  WORKFLOW_VERSION_FIELDS,
  MASTER_ENTRY_VERSION_SPEC,
} from './config-versions';
import { textOf } from './ports';

// UI-M2b：六配置页 spec——动作端点/字段/权限/敏感词自 *-actions.ts 逐项守恒迁移
//（提交文案保持原文，FormSection 按 shared/forms 同一敏感词正则判定二次确认）。
type Row = Readonly<Record<string, unknown>>;

// 选择字段构建（闭包 ctx 取数；C4 hint 与 choices 同源语义）。
const chooser =
  (name: string, label: string) =>
  (path: string, labeler: (row: Row) => string) =>
  (ctx: Parameters<ConfigActionSpec['fields']>[0]): FormSectionField => {
    const hint = ctx.hintFor(path);
    return {
      name,
      label,
      type: 'select',
      required: true,
      ...(hint ? { hint } : {}),
      options: ctx.rowsOf(path).map((row) => ({ value: String(row.id), label: labeler(row) })),
    };
  };

const stateBadge = (
  key: string,
  header: string,
  positive: readonly string[],
): DataTableColumn<Row> => ({
  key,
  header,
  field: (row) => textOf(row[key]),
  render: (row) => (
    <StatusBadge tone={positive.includes(textOf(row[key])) ? 'success' : 'neutral'}>
      {textOf(row[key], '—')}
    </StatusBadge>
  ),
});

const codeNameColumns = (nameKey = 'name'): readonly DataTableColumn<Row>[] => [
  { key: 'code', header: '编码', sortable: true, field: (row) => textOf(row.code) },
  { key: nameKey, header: '名称', field: (row) => textOf(row[nameKey]) },
];

const idOf = (row: Row): string => textOf(row.id, 'row');

const masterDataActions: readonly ConfigActionSpec[] = [
  {
    id: 'category',
    label: '新建分类',
    permission: 'master-data:create',
    title: '新建主数据分类',
    description: '分类编码保持稳定；名称和生效区间可以通过新版本调整。',
    submitLabel: '创建分类',
    fields: () => [
      { name: 'code', label: '分类编码', required: true },
      { name: 'name', label: '分类名称', required: true },
      { name: 'description', label: '说明', type: 'textarea' },
      { name: 'effectiveFrom', label: '生效时间', required: true },
    ],
    resolve: (values) => ({
      path: '/api/v1/master-data/categories',
      payload: {
        code: values.code,
        name: values.name,
        description: values.description ?? null,
        effectiveFrom: values.effectiveFrom,
        effectiveTo: null,
      },
      method: 'POST',
    }),
  },
  {
    id: 'entry',
    label: '新建条目',
    permission: 'master-data:create',
    title: '新建主数据条目',
    description: '条目值使用结构化配置保存，并继承分类的公司隔离。',
    submitLabel: '创建条目',
    fields: (ctx) => [
      chooser('categoryId', '分类')(
        '/api/v1/master-data/categories',
        (row) => `${textOf(row.code)} · ${textOf(row.name)}`,
      )(ctx),
      { name: 'code', label: '条目编码', required: true },
      { name: 'label', label: '显示名称', required: true },
      { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
      { name: 'effectiveFrom', label: '生效时间', required: true },
    ],
    resolve: (values, ctx) => ({
      path: '/api/v1/master-data/entries',
      payload: {
        categoryId: values.categoryId,
        code: values.code,
        label: values.label,
        value: ctx.jsonField(values.value, '结构化值'),
        effectiveFrom: values.effectiveFrom,
        effectiveTo: null,
      },
      method: 'POST',
    }),
  },
  {
    id: 'entry-update',
    label: '更新主数据条目',
    permission: 'master-data:update',
    title: '更新主数据条目',
    description: '生成新的有效版本；服务器使用当前记录版本防止并发覆盖。',
    submitLabel: '保存条目变更',
    fields: (ctx) => [
      chooser('entryId', '条目')(
        '/api/v1/master-data/entries',
        (row) => `${textOf(row.code)} · ${textOf(row.label)}`,
      )(ctx),
      { name: 'label', label: '显示名称', required: true },
      { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
      { name: 'effectiveFrom', label: '生效时间', required: true },
    ],
    resolve: (values, ctx) => {
      const entryId = values.entryId ?? '';
      const version = ctx.versionOf('/api/v1/master-data/entries', entryId);
      if (version === undefined) throw new Error('记录版本未知，请刷新后重试');
      return {
        path: `/api/v1/master-data/entries/${entryId}`,
        payload: {
          label: values.label,
          value: ctx.jsonField(values.value, '结构化值'),
          effectiveFrom: values.effectiveFrom,
          effectiveTo: null,
          version,
        },
        method: 'PATCH',
      };
    },
  },
  {
    id: 'entry-remove',
    label: '停用主数据条目',
    permission: 'master-data:delete',
    title: '停用主数据条目',
    description: '停用属于受控逻辑删除，历史版本和审计记录继续保留。',
    submitLabel: '停用条目',
    confirmation: 'destructive',
    fields: (ctx) => [
      chooser('entryId', '条目')(
        '/api/v1/master-data/entries',
        (row) => `${textOf(row.code)} · ${textOf(row.label)}`,
      )(ctx),
    ],
    resolve: (values, ctx) => {
      const entryId = values.entryId ?? '';
      const version = ctx.versionOf('/api/v1/master-data/entries', entryId);
      if (version === undefined) throw new Error('记录版本未知，请刷新后重试');
      return {
        path: `/api/v1/master-data/entries/${entryId}?version=${String(version)}`,
        payload: {},
        method: 'DELETE',
      };
    },
  },
];

const numberingActions: readonly ConfigActionSpec[] = [
  {
    id: 'create',
    label: '新建编号规则',
    permission: 'number:create',
    title: '新建编号规则',
    description: '规则发布后才能分配正式编号。',
    submitLabel: '创建编号规则',
    fields: () => [
      { name: 'code', label: '规则编码', required: true },
      { name: 'prefix', label: '前缀' },
      { name: 'padding', label: '数字位数', type: 'number', required: true },
      { name: 'startingValue', label: '起始值', type: 'number', required: true },
      { name: 'increment', label: '步长', type: 'number', required: true },
    ],
    resolve: (values) => ({
      path: '/api/v1/number-definitions',
      payload: {
        code: values.code,
        prefix: values.prefix ?? '',
        suffix: '',
        padding: Number(values.padding),
        startingValue: Number(values.startingValue),
        increment: Number(values.increment),
        resetPeriod: 'NEVER',
      },
      method: 'POST',
    }),
  },
  {
    id: 'publish',
    label: '发布编号版本',
    permission: 'number:update',
    title: '发布编号版本',
    description: '发布后的编号格式不可修改；后续调整必须创建新版本。',
    submitLabel: '发布编号版本',
    confirmation: true,
    fields: (ctx) => [
      chooser('definitionId', '编号规则')(
        '/api/v1/number-definitions',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
      { name: 'version', label: '待发布版本', type: 'number', required: true },
    ],
    resolve: (values) => ({
      path: `/api/v1/number-definitions/${values.definitionId ?? ''}/publish`,
      payload: { version: Number(values.version) },
      method: 'POST',
    }),
  },
  {
    id: 'allocate',
    label: '分配测试编号',
    permission: 'number:allocate',
    title: '分配受控编号',
    description: '每次提交使用独立幂等键，返回值由服务器序列化生成。',
    submitLabel: '分配编号',
    fields: (ctx) => [
      chooser('definitionId', '编号规则')(
        '/api/v1/number-definitions',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
    ],
    resolve: (values) => ({
      path: `/api/v1/number-definitions/${values.definitionId ?? ''}/allocate`,
      payload: {},
      method: 'POST',
    }),
  },
];

const ruleActions: readonly ConfigActionSpec[] = [
  {
    id: 'create',
    label: '新建业务规则',
    permission: 'rule:create',
    title: '新建业务规则',
    description: '规则表达式和必需输入由服务器校验；草稿发布后才能用于业务判断。',
    submitLabel: '创建业务规则',
    fields: () => [
      { name: 'code', label: '规则编码', required: true },
      { name: 'ast', label: '规则表达式（高级配置）', type: 'textarea', required: true },
      { name: 'requiredInputs', label: '必需输入（每行一个）', type: 'textarea' },
    ],
    resolve: (values, ctx) => ({
      path: '/api/v1/rules',
      payload: {
        code: values.code,
        ast: ctx.jsonField(values.ast, '规则表达式'),
        requiredInputs: (values.requiredInputs ?? '')
          .split(/\r?\n/u)
          .map((item) => item.trim())
          .filter(Boolean),
      },
      method: 'POST',
    }),
  },
  {
    id: 'publish',
    label: '发布业务规则',
    permission: 'rule:update',
    title: '发布业务规则',
    description: '已发布规则不可修改，试算和业务执行始终引用冻结版本。',
    submitLabel: '发布业务规则',
    confirmation: true,
    fields: (ctx) => [
      chooser('ruleId', '业务规则')(
        '/api/v1/rules',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
      { name: 'version', label: '待发布版本', type: 'number', required: true },
    ],
    resolve: (values) => ({
      path: `/api/v1/rules/${values.ruleId ?? ''}/publish`,
      payload: { version: Number(values.version) },
      method: 'POST',
    }),
  },
  {
    id: 'evaluate',
    label: '试算业务规则',
    permission: 'rule:evaluate',
    title: '试算业务规则',
    description: '试算返回决策、输入哈希和逐步计算轨迹。',
    submitLabel: '试算业务规则',
    fields: (ctx) => [
      chooser('ruleId', '业务规则')(
        '/api/v1/rules',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
      { name: 'input', label: '输入数据（高级配置）', type: 'textarea', required: true },
    ],
    resolve: (values, ctx) => ({
      path: `/api/v1/rules/${values.ruleId ?? ''}/evaluate`,
      payload: { input: ctx.jsonField(values.input, '输入数据') },
      method: 'POST',
    }),
  },
];

const workflowActions: readonly ConfigActionSpec[] = [
  {
    id: 'create',
    label: '新建工作流',
    permission: 'workflow:create',
    title: '新建工作流',
    description: '流程定义采用受校验的结构化规范；发布和启动由独立能力控制。',
    submitLabel: '创建工作流',
    fields: () => [
      { name: 'code', label: '工作流编码', required: true },
      { name: 'spec', label: '流程规范（高级配置）', type: 'textarea', required: true },
    ],
    resolve: (values, ctx) => ({
      path: '/api/v1/workflows',
      payload: { code: values.code, spec: ctx.jsonField(values.spec, '流程规范') },
      method: 'POST',
    }),
  },
  {
    id: 'publish',
    label: '发布工作流',
    permission: 'workflow:update',
    title: '发布工作流',
    description: '发布后启动的实例固定引用该流程版本。',
    submitLabel: '发布工作流',
    confirmation: true,
    fields: (ctx) => [
      chooser('workflowId', '工作流')(
        '/api/v1/workflows',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
      { name: 'version', label: '待发布版本', type: 'number', required: true },
    ],
    resolve: (values) => ({
      path: `/api/v1/workflows/${values.workflowId ?? ''}/publish`,
      payload: { version: Number(values.version) },
      method: 'POST',
    }),
  },
  {
    id: 'start',
    label: '启动工作流实例',
    permission: 'workflow:start',
    title: '启动工作流实例',
    description: '流程实例绑定业务对象类型和对象编号，并使用防重键避免重复启动。',
    submitLabel: '启动工作流实例',
    fields: (ctx) => [
      chooser('workflowId', '工作流')(
        '/api/v1/workflows',
        (row) => `${textOf(row.code)} · v${textOf(row.version, '0')}`,
      )(ctx),
      { name: 'subjectType', label: '业务对象类型', required: true },
      { name: 'subjectId', label: '业务对象编号', required: true },
    ],
    resolve: (values) => ({
      path: `/api/v1/workflows/${values.workflowId ?? ''}/instances`,
      payload: { subjectType: values.subjectType, subjectId: values.subjectId },
      method: 'POST',
    }),
  },
  {
    id: 'decide',
    label: '处理工作流待办',
    permission: 'workflow:decide',
    title: '处理工作流待办',
    description: '审批人、法定人数和申请人隔离由服务器校验。',
    submitLabel: '提交审批决定',
    confirmation: 'destructive',
    fields: (ctx) => [
      chooser('taskId', '待办任务')(
        '/api/v1/workflow-tasks',
        (row) => `${textOf(row.stepKey, '待办')} · ${textOf(row.state, '待处理')}`,
      )(ctx),
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
    resolve: (values, ctx) => {
      const task = ctx
        .rowsOf('/api/v1/workflow-tasks')
        .find((row) => String(row.id) === values.taskId);
      return {
        path: `/api/v1/workflow-tasks/${values.taskId ?? ''}/decisions`,
        payload: {
          decision: values.decision,
          comment: values.comment ?? '',
          expectedVersion: typeof task?.version === 'number' ? task.version : 0,
        },
        method: 'POST',
      };
    },
  },
];

const notificationActions: readonly ConfigActionSpec[] = [
  {
    id: 'preference',
    label: '更新通知偏好',
    permission: 'notification:manage',
    title: '更新通知偏好',
    description: '仅调整当前账号的通知通道，使用版本号防止并发覆盖。',
    submitLabel: '保存通知偏好',
    fields: (ctx) => [
      {
        name: 'channel',
        label: '通知通道',
        type: 'select',
        required: true,
        options: ctx
          .rowsOf('/api/v1/notification-preferences')
          .map((row) => ({ value: textOf(row.channel), label: textOf(row.channel) })),
      },
      {
        name: 'enabled',
        label: '开关',
        type: 'select',
        required: true,
        options: [
          { value: 'true', label: '开启' },
          { value: 'false', label: '关闭' },
        ],
      },
    ],
    resolve: (values, ctx) => {
      const selected = ctx
        .rowsOf('/api/v1/notification-preferences')
        .find((row) => textOf(row.channel) === values.channel);
      return {
        path: '/api/v1/notification-preferences',
        payload: {
          channel: values.channel,
          enabled: values.enabled === 'true',
          expectedVersion: typeof selected?.version === 'number' ? selected.version : 0,
        },
        method: 'PUT',
      };
    },
  },
];

const registryActions: readonly ConfigActionSpec[] = [
  {
    id: 'create',
    label: '新建业务对象',
    permission: 'business-object:manage',
    title: '新建业务对象',
    description: '对象定义用于统一字段、关系和附件绑定语义。',
    submitLabel: '创建业务对象',
    fields: () => [
      { name: 'code', label: '对象编码', required: true },
      { name: 'name', label: '对象名称', required: true },
      { name: 'schema', label: '对象结构（高级配置）', type: 'textarea', required: true },
    ],
    resolve: (values, ctx) => ({
      path: '/api/v1/business-objects',
      payload: {
        code: values.code,
        name: values.name,
        schema: ctx.jsonField(values.schema, '对象结构'),
      },
      method: 'POST',
    }),
  },
];

export const MASTER_DATA_PAGE: ConfigPageSpec = {
  route: 'governance/master-data',
  pageTestId: 'kt-cfg-master-data',
  title: '主数据条目',
  entity: {
    path: '/api/v1/master-data/entries',
    caption: '主数据条目（结构化值 + 生效版本）',
    columns: [
      { key: 'code', header: '条目编码', sortable: true, field: (row) => textOf(row.code) },
      { key: 'label', header: '显示名称', field: (row) => textOf(row.label) },
      { key: 'effectiveFrom', header: '生效时间', field: (row) => textOf(row.effectiveFrom) },
      stateBadge('status', '状态', ['ACTIVE', 'PUBLISHED']),
    ],
    rowId: idOf,
    summaryKeys: ['code', 'label', 'effectiveFrom'],
  },
  extraEntities: [
    {
      path: '/api/v1/master-data/categories',
      caption: '主数据分类',
      columns: codeNameColumns(),
      rowId: idOf,
      summaryKeys: ['code', 'name'],
    },
  ],
  actions: masterDataActions,
  // GOV-UX ④：主数据条目按生效时点读上一版本。
  versions: MASTER_ENTRY_VERSION_SPEC,
};

export const NUMBERING_PAGE: ConfigPageSpec = {
  route: 'governance/numbering',
  pageTestId: 'kt-cfg-numbering',
  title: '编号规则',
  entity: {
    path: '/api/v1/number-definitions',
    caption: '编号规则（版本 + 序列参数）',
    columns: [
      { key: 'code', header: '规则编码', sortable: true, field: (row) => textOf(row.code) },
      { key: 'prefix', header: '前缀', field: (row) => textOf(row.prefix) },
      { key: 'padding', header: '位数', field: (row) => textOf(row.padding) },
      { key: 'currentValue', header: '当前值', field: (row) => textOf(row.currentValue) },
    ],
    rowId: idOf,
    summaryKeys: ['code', 'prefix'],
  },
  actions: numberingActions,
  versions: { fields: NUMBERING_VERSION_FIELDS },
};

export const RULES_PAGE: ConfigPageSpec = {
  route: 'governance/rules',
  pageTestId: 'kt-cfg-rules',
  title: '业务规则',
  entity: {
    path: '/api/v1/rules',
    caption: '业务规则（草稿 / 已发布版本）',
    columns: [
      { key: 'code', header: '规则编码', sortable: true, field: (row) => textOf(row.code) },
      stateBadge('status', '状态', ['PUBLISHED']),
      { key: 'version', header: '版本', field: (row) => textOf(row.version) },
    ],
    rowId: idOf,
    summaryKeys: ['code', 'status'],
  },
  actions: ruleActions,
  versions: { fields: RULE_VERSION_FIELDS },
};

export const WORKFLOW_PAGE: ConfigPageSpec = {
  route: 'governance/workflow',
  pageTestId: 'kt-cfg-workflow',
  title: '工作流',
  entity: {
    path: '/api/v1/workflows',
    caption: '流程定义（结构化规范 + 版本）',
    columns: [
      { key: 'code', header: '工作流编码', sortable: true, field: (row) => textOf(row.code) },
      stateBadge('status', '状态', ['PUBLISHED']),
      { key: 'version', header: '版本', field: (row) => textOf(row.version) },
    ],
    rowId: idOf,
    summaryKeys: ['code', 'status'],
  },
  extraEntities: [
    {
      path: '/api/v1/workflow-tasks',
      caption: '审批待办',
      columns: [
        { key: 'stepKey', header: '步骤', field: (row) => textOf(row.stepKey) },
        stateBadge('state', '状态', ['COMPLETED']),
        { key: 'subjectId', header: '对象', field: (row) => textOf(row.subjectId) },
      ],
      rowId: idOf,
      summaryKeys: ['stepKey', 'state'],
    },
  ],
  actions: workflowActions,
  versions: { fields: WORKFLOW_VERSION_FIELDS },
};

export const NOTIFICATIONS_PAGE: ConfigPageSpec = {
  route: 'governance/notifications',
  pageTestId: 'kt-cfg-notifications',
  title: '通知中心',
  entity: {
    path: '/api/v1/notifications',
    caption: '通知记录',
    columns: [
      { key: 'channel', header: '通道', field: (row) => textOf(row.channel) },
      { key: 'subject', header: '主题', field: (row) => textOf(row.subject) },
      { key: 'createdAt', header: '时间', field: (row) => textOf(row.createdAt) },
    ],
    rowId: idOf,
    summaryKeys: ['channel', 'subject'],
  },
  extraEntities: [
    {
      path: '/api/v1/notification-preferences',
      caption: '通知偏好（当前账号）',
      columns: [
        { key: 'channel', header: '通道', field: (row) => textOf(row.channel) },
        stateBadge('enabled', '开关', []),
      ],
      rowId: (row) => textOf(row.channel, 'row'),
      summaryKeys: ['channel'],
    },
  ],
  actions: notificationActions,
};

export const SYSTEM_PAGE: ConfigPageSpec = {
  route: 'governance/system',
  pageTestId: 'kt-cfg-system',
  title: '业务对象',
  entity: {
    path: '/api/v1/business-objects',
    caption: '业务对象定义（字段 / 关系 / 附件语义）',
    columns: [
      { key: 'code', header: '对象编码', sortable: true, field: (row) => textOf(row.code) },
      { key: 'name', header: '对象名称', field: (row) => textOf(row.name) },
    ],
    rowId: idOf,
    summaryKeys: ['code', 'name'],
  },
  actions: registryActions,
  appendix: (ports) => TenantSettingsAppendix(ports),
};

export const CONFIG_PAGE_BY_ROUTE: Readonly<Record<string, ConfigPageSpec>> = {
  [MASTER_DATA_PAGE.route]: MASTER_DATA_PAGE,
  [NUMBERING_PAGE.route]: NUMBERING_PAGE,
  [RULES_PAGE.route]: RULES_PAGE,
  [WORKFLOW_PAGE.route]: WORKFLOW_PAGE,
  [NOTIFICATIONS_PAGE.route]: NOTIFICATIONS_PAGE,
  [SYSTEM_PAGE.route]: SYSTEM_PAGE,
};

export const configConsoleFor = (
  route: string,
): ((ports: import('./ports').ConsolePorts) => preact.ComponentType) | undefined => {
  const spec = CONFIG_PAGE_BY_ROUTE[route];
  return spec ? ConfigConsolePage(spec) : undefined;
};
