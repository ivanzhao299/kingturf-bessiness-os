import { el } from '../dom';
import { recordValue, textValue } from '../shared/business-format';
import { ENTERPRISE_STATUS_LABELS } from '../shared/locale';
export const governanceItems = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  return [value];
};

export const GOVERNANCE_SOURCE_LABELS: Readonly<Record<string, string>> = {
  '/api/v1/user-access-profiles': '用户访问档案',
  '/api/v1/organizations': '组织清单',
  '/api/v1/employees': '员工清单',
  '/api/v1/roles': '角色清单',
  '/api/v1/permissions': '权限清单',
  '/api/v1/grants': '角色授权',
  '/api/v1/assignments': '人员角色',
  '/api/v1/scope-grants': '数据范围',
  '/api/v1/audit-events': '审计事件',
  '/api/v1/master-data/categories': '主数据分类',
  '/api/v1/master-data/entries': '主数据条目',
  '/api/v1/number-definitions': '编号规则',
  '/api/v1/rules': '业务规则',
  '/api/v1/workflows': '工作流定义',
  '/api/v1/workflow-tasks': '审批待办',
  '/api/v1/notifications': '通知消息',
  '/api/v1/notifications/unread-count': '未读数量',
  '/api/v1/notification-preferences': '通知偏好',
  '/api/v1/business-objects': '业务对象',
  '/api/v1/operations/events': '事件运行记录',
};

export const GOVERNANCE_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  IN_APP: '系统内通知',
  EMAIL: '电子邮件',
  FEISHU: '飞书私聊',
  SMS: '短信',
};

export const governanceNextAction = (
  surfaceId: string,
  recordCount: number,
  failureCount: number,
): string => {
  if (failureCount > 0) return '先处理数据读取异常并核对权限或服务状态';
  const actions: Readonly<Record<string, string>> = {
    organizations: '核对组织层级和停用组织',
    employees: '核对员工归属、账号状态和离职停用',
    'identity-access': '优先处理人员角色、授权和数据范围',
    audit: '按人员、动作和关联编号复核异常操作',
    'master-data': '核对生效期、停用项和重复编码',
    numbering: '检查草稿版本并发布合规编号规则',
    rules: '检查草稿规则并完成试算后发布',
    workflow: '优先处理当前账号的审批待办',
    notifications: '处理未读通知并核对本人通知通道',
    registry: '核对业务对象定义和版本状态',
    'event-operations': '优先排查失败、重试和积压事件',
  };
  if (recordCount === 0) return '当前范围暂无记录，按职责创建或等待业务产生';
  return actions[surfaceId] ?? '核对当前记录和待处理事项';
};

export const governanceChannelLabel = (value: unknown): string => {
  const code = textValue(value, '通知通道');
  return GOVERNANCE_CHANNEL_LABELS[code] ?? code;
};

export const GOVERNANCE_FIELD_LABELS: Readonly<Record<string, string>> = {
  code: '编码',
  name: '名称',
  displayName: '姓名',
  loginName: '登录名',
  employeeActive: '员工状态',
  identityActive: '账号状态',
  activeSessionCount: '活动会话',
  passwordChangedAt: '密码更新时间',
  roles: '原子角色',
  capabilities: '有效能力',
  directScopes: '直接数据范围',
  employeeNumber: '员工编号',
  title: '标题',
  description: '说明',
  status: '状态',
  state: '状态',
  active: '启用状态',
  version: '版本',
  email: '邮箱',
  phone: '电话',
  action: '操作',
  outcome: '结果',
  channel: '通知通道',
  enabled: '启用状态',
  stepKey: '审批环节',
  subjectType: '业务对象',
  eventType: '事件类型',
  attemptCount: '尝试次数',
  lastErrorCode: '最近错误',
  unreadCount: '未读数量',
  count: '数量',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

export const governanceFieldPriority = [
  'displayName',
  'loginName',
  'employeeActive',
  'identityActive',
  'activeSessionCount',
  'roles',
  'capabilities',
  'name',
  'title',
  'employeeNumber',
  'code',
  'status',
  'state',
  'active',
  'version',
  'email',
  'phone',
  'action',
  'outcome',
  'channel',
  'enabled',
  'stepKey',
  'subjectType',
  'eventType',
  'attemptCount',
  'lastErrorCode',
  'unreadCount',
  'count',
  'createdAt',
  'updatedAt',
] as const;

export const governanceHiddenField = (key: string): boolean =>
  /(^id$|Id$|password|token|secret|hash|schema|payload|permissions)/iu.test(key);

export const governanceCellText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '已启用' : '已停用';
  if (Array.isArray(value)) return `${String(value.length)} 项`;
  if (typeof value === 'object') return '已配置';
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint')
    return '—';
  const text = String(value);
  return GOVERNANCE_CHANNEL_LABELS[text] ?? ENTERPRISE_STATUS_LABELS[text] ?? text;
};

export const governanceTable = (items: readonly unknown[]): HTMLElement => {
  const records = items.slice(0, 8).map(recordValue);
  const availableFields = new Set(records.flatMap((record) => Object.keys(record)));
  const fields = [
    ...governanceFieldPriority.filter((field) => availableFields.has(field)),
    ...Array.from(availableFields).filter(
      (field) =>
        !governanceFieldPriority.includes(field as (typeof governanceFieldPriority)[number]),
    ),
  ]
    .filter((field) => !governanceHiddenField(field))
    .slice(0, 5);
  const wrap = el('div', 'governance-table-wrap');
  if (fields.length === 0) {
    wrap.append(el('p', 'empty', '记录已存在，详细配置受权限保护'));
    return wrap;
  }
  const table = el('table', 'governance-table');
  const head = el('thead');
  const headRow = el('tr');
  for (const field of fields) headRow.append(el('th', '', GOVERNANCE_FIELD_LABELS[field] ?? field));
  head.append(headRow);
  const body = el('tbody');
  for (const record of records) {
    const row = el('tr');
    for (const field of fields) row.append(el('td', '', governanceCellText(record[field])));
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  if (items.length > records.length)
    wrap.append(el('p', 'table-footnote', `当前预览前 ${String(records.length)} 条记录`));
  return wrap;
};
