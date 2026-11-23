import { recordPath, snapshotOf, type VersionField, type VersionSnapshot } from './version-model';
import type { ConsolePorts, ConsoleRow } from './ports';

// GOV-UX ④ 四配置页版本对比来源：字段清单逐页声明（只呈现业务字段，不把 id/租户/
// 创建人等逐版必变的审计列当差异）；编号/规则/工作流用行内嵌 versions[]，主数据条目
// 经既有详情端点按生效时点读上一版本。键名沿用 API 返回原形（版本行 to_jsonb 投影）。
export const NUMBERING_VERSION_FIELDS: readonly VersionField[] = [
  { key: 'prefix', label: '前缀' },
  { key: 'suffix', label: '后缀' },
  { key: 'padding', label: '数字位数' },
  { key: 'starting_value', label: '起始值' },
  { key: 'increment_by', label: '步长' },
  { key: 'reset', label: '重置周期' },
  { key: 'status', label: '状态' },
  { key: 'published_at', label: '发布时间' },
];

export const RULE_VERSION_FIELDS: readonly VersionField[] = [
  { key: 'ast', label: '规则表达式', kind: 'json' },
  { key: 'required_inputs', label: '必需输入', kind: 'json' },
  { key: 'status', label: '状态' },
  { key: 'published_at', label: '发布时间' },
];

export const WORKFLOW_VERSION_FIELDS: readonly VersionField[] = [
  { key: 'spec', label: '流程规范', kind: 'json' },
  { key: 'status', label: '状态' },
  { key: 'published_at', label: '发布时间' },
];

export const MASTER_ENTRY_VERSION_FIELDS: readonly VersionField[] = [
  { key: 'label', label: '显示名称' },
  { key: 'value', label: '结构化值', kind: 'json' },
  { key: 'effective_from', label: '生效时间' },
  { key: 'effective_to', label: '失效时间' },
];

export const MASTER_ENTRY_VERSION_SPEC = {
  fields: MASTER_ENTRY_VERSION_FIELDS,
  fromRow: true,
  loadPrevious: loadMasterEntryPrevious,
} as const;

const MASTER_ENTRY_PATH = '/api/v1/master-data/entries';
const NOT_FOUND = 404;

const effectiveStartOf = (row: ConsoleRow): number | null => {
  const raw = row.effective_from ?? row.effectiveFrom;
  const time = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
  return Number.isNaN(time) ? null : time;
};

// 主数据条目是生效期版本：上一版本 = 当前版本生效起点前一刻有效的版本
//（GET /master-data/entries/{id}?at=，M3 既有端点）。条目版本计数为 1 即首版，不发请求；
// 404 视为无上一版本，其它错误原样抛出由界面如实提示。
async function loadMasterEntryPrevious(
  row: ConsoleRow,
  ports: ConsolePorts,
): Promise<VersionSnapshot | null> {
  const start = effectiveStartOf(row);
  const path = recordPath(MASTER_ENTRY_PATH, row.id);
  if (!(Number(row.version) > 1) || start === null || path === null) return null;
  try {
    const record = await ports.fetchRecord(path, { at: new Date(start - 1).toISOString() });
    return snapshotOf('上一生效版本', record, MASTER_ENTRY_VERSION_FIELDS);
  } catch (error) {
    if ((error as { status?: unknown }).status === NOT_FOUND) return null;
    throw error;
  }
}
