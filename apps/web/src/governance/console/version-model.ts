import { recordOf, textOf, type ConsolePorts, type ConsoleRow } from './ports';

// GOV-UX ④ 版本对比模型（纯函数）：上一版本 vs 当前版本并排差异。
// 数据来源零 API 变更——编号/规则/工作流取列表行内嵌 versions[]（服务端既有投影），
// 主数据条目按生效时点读既有详情端点（GET …/entries/{id}?at=）。结构化值（JSON）
// 按叶子路径展开后逐项比对，四态：same / changed / added / removed。
export type VersionFieldKind = 'scalar' | 'json';
export type VersionField = Readonly<{ key: string; label: string; kind?: VersionFieldKind }>;
export type VersionSnapshot = Readonly<{
  label: string;
  fields: Readonly<Record<string, unknown>>;
}>;
export type VersionPair = Readonly<{ current: VersionSnapshot; previous: VersionSnapshot | null }>;
export type DiffState = 'same' | 'changed' | 'added' | 'removed';
export type DiffRow = Readonly<{
  label: string;
  before: string | undefined;
  after: string | undefined;
  state: DiffState;
}>;
export type VersionSpec = Readonly<{
  fields: readonly VersionField[];
  /** 当前快照取自行字段（主数据生效版本）；缺省取行内嵌 versions[] 末项。 */
  fromRow?: boolean;
  /** 上一版本异步读取（缺省取 versions[] 倒数第二项）。 */
  loadPrevious?: (row: ConsoleRow, ports: ConsolePorts) => Promise<VersionSnapshot | null>;
}>;

const MAX_DEPTH = 6;

const leafText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  // 深度封顶的对象/数组按 JSON 文本呈现，不落到 "[object Object]"。
  if (typeof value === 'object') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'bigint')
    return String(value);
  // 残余 symbol/function 不出现在 API JSON 值中，仅为穷尽 unknown。
  if (typeof value === 'function') return value.name === '' ? '(anonymous)' : value.name;
  return typeof value === 'symbol' ? String(value) : '';
};

const joinPath = (prefix: string, key: string): string =>
  key.startsWith('[') ? `${prefix}${key}` : prefix === '' ? key : `${prefix}.${key}`;

// 叶子路径：对象键以 . 连接、数组以 [i] 标注；空容器/null 保留占位；超过深度封顶按文本呈现。
export const flattenLeaves = (
  value: unknown,
  prefix = '',
  depth = 0,
  out = new Map<string, string>(),
): Map<string, string> => {
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    out.set(prefix, leafText(value));
    return out;
  }
  const entries: readonly (readonly [string, unknown])[] = Array.isArray(value)
    ? value.map((item, index) => [`[${String(index)}]`, item] as const)
    : Object.entries(recordOf(value));
  if (entries.length === 0) {
    out.set(prefix, Array.isArray(value) ? '[]' : '{}');
    return out;
  }
  for (const [key, nested] of entries) flattenLeaves(nested, joinPath(prefix, key), depth + 1, out);
  return out;
};

const stateOf = (before: string | undefined, after: string | undefined): DiffState | null => {
  if (before === undefined && after === undefined) return null;
  if (before === undefined) return 'added';
  if (after === undefined) return 'removed';
  return before === after ? 'same' : 'changed';
};

export const snapshotOf = (
  label: string,
  source: ConsoleRow,
  fields: readonly VersionField[],
): VersionSnapshot => ({
  label,
  fields: Object.fromEntries(fields.map((field) => [field.key, source[field.key]])),
});

const versionsOf = (row: ConsoleRow): readonly ConsoleRow[] =>
  Array.isArray(row.versions)
    ? row.versions
        .map(recordOf)
        .filter((version) => typeof version.version === 'number')
        .sort((left, right) => Number(left.version) - Number(right.version))
    : [];

export const pairFromRow = (
  row: ConsoleRow,
  fields: readonly VersionField[],
): VersionPair | null => {
  const versions = versionsOf(row);
  const current = versions.at(-1);
  if (current === undefined) return null;
  const previous = versions.at(-2);
  return {
    current: snapshotOf(`v${String(current.version)}`, current, fields),
    previous:
      previous === undefined ? null : snapshotOf(`v${String(previous.version)}`, previous, fields),
  };
};

const diffScalar = (field: VersionField, before: unknown, after: unknown): readonly DiffRow[] => {
  const left = before === undefined ? undefined : leafText(before);
  const right = after === undefined ? undefined : leafText(after);
  const state = stateOf(left, right);
  return state === null ? [] : [{ label: field.label, before: left, after: right, state }];
};

// 结构化字段：以字段 key 为根展开叶子，标签去掉 key 前缀（如「规则表达式 · right」
// 「必需输入[1]」）；根即标量时直接用字段标签。
const diffJson = (field: VersionField, before: unknown, after: unknown): readonly DiffRow[] => {
  const left = before === undefined ? new Map<string, string>() : flattenLeaves(before, field.key);
  const right = after === undefined ? new Map<string, string>() : flattenLeaves(after, field.key);
  const paths = [...new Set([...left.keys(), ...right.keys()])];
  return paths.flatMap((path) => {
    const state = stateOf(left.get(path), right.get(path));
    if (state === null) return [];
    const suffix = path.slice(field.key.length);
    const label =
      suffix === ''
        ? field.label
        : suffix.startsWith('[')
          ? `${field.label}${suffix}`
          : `${field.label} · ${suffix.slice(1)}`;
    return [{ label, before: left.get(path), after: right.get(path), state }];
  });
};

export const diffSnapshots = (
  previous: VersionSnapshot | null,
  current: VersionSnapshot,
  fields: readonly VersionField[],
): readonly DiffRow[] =>
  fields.flatMap((field) => {
    const before = previous?.fields[field.key];
    const after = current.fields[field.key];
    return field.kind === 'json'
      ? diffJson(field, before, after)
      : diffScalar(field, before, after);
  });

export const changedCount = (rows: readonly DiffRow[], state: DiffState): number =>
  rows.filter((row) => row.state === state).length;

export const versionHeadline = (pair: VersionPair): string =>
  pair.previous === null
    ? `当前 ${pair.current.label} 为首个版本`
    : `${pair.previous.label} → ${pair.current.label}`;

// 记录 id 规范化用于路径拼接（服务端 id 为 uuid；空 id 不发请求）。
export const recordPath = (base: string, id: unknown): string | null => {
  const key = textOf(id);
  return key === '' ? null : `${base}/${encodeURIComponent(key)}`;
};
