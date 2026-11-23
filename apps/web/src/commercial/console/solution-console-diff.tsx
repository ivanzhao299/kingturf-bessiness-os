import './commercial-ux.css';

// COM-UX 版本差异：技术方案（规格字段 + 工程假设）与技术需求单（需求字段 + 标题）共用的
// 字段级红绿标记。文案契约保持「当前值（上一版：旧值）」，红绿只加在值的两端，
// 并保留「上一版：」文字与非颜色标记（不以颜色为唯一信号）。
export type DiffField = Readonly<{
  key: string;
  label: string;
  current: string;
  /** 基准值；无基准（首个版本或基准缺失）时为 null。 */
  previous: string | null;
  changed: boolean;
}>;

export const diffFields = (
  labels: readonly (readonly [string, string])[],
  current: Readonly<Record<string, unknown>>,
  previous: Readonly<Record<string, unknown>> | null,
  display: (value: unknown) => string,
): readonly DiffField[] =>
  labels.map(([key, label]) => {
    const currentText = display(current[key]);
    const previousText = previous === null ? null : display(previous[key]);
    return {
      key,
      label,
      current: currentText,
      previous: previousText,
      changed: previousText !== null && previousText !== currentText,
    };
  });

export type ListDiff = Readonly<{ added: readonly string[]; removed: readonly string[] }>;

// 无序列表的增删（假设项等）：按成员比对，不比较顺序。
export const diffLists = (previous: readonly string[], current: readonly string[]): ListDiff => ({
  added: current.filter((item) => !previous.includes(item)),
  removed: previous.filter((item) => !current.includes(item)),
});

export const countChanges = (
  fields: readonly DiffField[],
  lists: readonly ListDiff[] = [],
): number =>
  fields.filter((field) => field.changed).length +
  lists.reduce((total, list) => total + list.added.length + list.removed.length, 0);

export const versionNumber = (row: Readonly<Record<string, unknown>>, key: string): number =>
  Number(row[key] ?? 0);

export function sortVersions<T>(rows: readonly T[], number: (row: T) => number): readonly T[] {
  return [...rows].sort((left, right) => number(left) - number(right));
}

// 上一版本（按 id 定位，比较对象身份）：首个版本返回 null。
export function previousVersion<T>(
  versions: readonly T[],
  current: T,
  idOf: (row: T) => string,
): T | null {
  const index = versions.findIndex((row) => idOf(row) === idOf(current));
  return index > 0 ? (versions[index - 1] ?? null) : null;
}

// 字段清单：变更行带红绿标记，未变更行原样呈现。
export const DiffList = ({
  fields,
  testId,
}: Readonly<{ fields: readonly DiffField[]; testId: string }>) => (
  <dl class="com-diff" data-testid={testId}>
    {fields.map((field) => (
      <div
        class="com-diff-row"
        data-changed={field.changed ? 'true' : 'false'}
        data-field={field.key}
        key={field.key}
      >
        <dt>{field.label}</dt>
        <dd>
          {field.changed ? (
            <>
              <span class="com-diff-new">{field.current}</span>
              {'（上一版：'}
              <span class="com-diff-old">{field.previous}</span>
              {'）'}
            </>
          ) : (
            field.current
          )}
        </dd>
      </div>
    ))}
  </dl>
);

// 无序列表的增删呈现：未变项原样，新增项带「+」，移除项带「−」并划除。
export const DiffListItems = ({
  label,
  diff,
  current,
  hasBaseline,
  testId,
}: Readonly<{
  label: string;
  diff: ListDiff;
  current: readonly string[];
  hasBaseline: boolean;
  testId: string;
}>) => (
  <div class="com-diff-items" data-testid={testId}>
    <span class="console-label">{label}</span>
    {current.length === 0 && diff.removed.length === 0 ? (
      '—'
    ) : (
      <ul class="com-diff-lines">
        {current.map((item) => (
          <li
            key={item}
            class={hasBaseline && diff.added.includes(item) ? 'is-added' : ''}
            data-change={hasBaseline && diff.added.includes(item) ? 'added' : 'same'}
          >
            {item}
          </li>
        ))}
        {diff.removed.map((item) => (
          <li key={item} class="is-removed" data-change="removed">
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
);

// 变更摘要：首个版本 / 与基准一致 / 较基准变更 N 项。
export const DiffSummary = ({
  changed,
  baseline,
  hasBaseline,
}: Readonly<{ changed: number; hasBaseline: boolean; baseline: string }>) => (
  <p class="com-diff-summary" data-testid="kt-diff-summary">
    {hasBaseline ? (
      changed === 0 ? (
        <span class="com-tag">{`与${baseline}一致`}</span>
      ) : (
        <span class="com-tag" data-tone="warning">{`较${baseline}变更 ${String(changed)} 项`}</span>
      )
    ) : (
      <span class="com-tag">首个版本 · 无对比基准</span>
    )}
  </p>
);

export type DiffVersion = Readonly<{ id: string; number: number }>;

// 基准版本选择：默认上一版，可改选任一更早版本。
export const BaselineSelect = ({
  versions,
  currentNumber,
  selectedId,
  onSelect,
}: Readonly<{
  versions: readonly DiffVersion[];
  currentNumber: number;
  selectedId: string;
  onSelect: (id: string) => void;
}>) => {
  const earlier = versions.filter((version) => version.number < currentNumber);
  if (earlier.length === 0) return null;
  return (
    <label class="com-diff-baseline">
      <span>对比基准</span>
      <select
        aria-label="选择对比基准版本"
        data-testid="kt-diff-baseline"
        value={selectedId}
        onInput={(event) => {
          onSelect((event.target as unknown as { value: string }).value);
        }}
      >
        {earlier.map((version) => (
          <option key={version.id} value={version.id}>{`第 ${String(version.number)} 版`}</option>
        ))}
      </select>
    </label>
  );
};

// 列表「较上一版」单元格：变更数 / 无变更 / 首个版本。
export const ChangeCell = ({
  count,
  hasBaseline,
}: Readonly<{ count: number; hasBaseline: boolean }>) => {
  if (!hasBaseline) return <span class="com-diff-muted">首个版本</span>;
  if (count === 0) return <span class="com-diff-muted">无变更</span>;
  return <span class="com-tag" data-tone="warning">{`${String(count)} 项变更`}</span>;
};
