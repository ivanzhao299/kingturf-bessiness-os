import { useState } from 'preact/hooks';
import { changedCount, versionHeadline, type DiffRow } from './version-model';
import type { CompareView } from './version-compare-state';

// GOV-UX ④ 版本对比组件：上一版本 vs 当前版本并排；差异单元格按 改/增/删 三色高亮，
// 默认「仅显示差异」，可切换查看全部字段。结构化值多行时按原样换行呈现。
const DiffValue = ({
  value,
  removed,
}: Readonly<{ value: string | undefined; removed: boolean }>) => {
  if (value === undefined) return <span class="gov-version-missing">—</span>;
  const body = value.includes('\n') ? (
    <pre>{value}</pre>
  ) : (
    <span>{value === 'null' ? '—' : value}</span>
  );
  return removed ? <del>{body}</del> : body;
};

const DiffRowView = ({ row }: Readonly<{ row: DiffRow }>) => {
  const removed = row.state === 'removed';
  return (
    <tr data-state={row.state} data-testid="kt-cfg-version-row">
      <th scope="row">{row.label}</th>
      <td data-diff={row.state === 'added' ? undefined : row.state}>
        <DiffValue value={row.before} removed={removed} />
      </td>
      <td data-diff={removed ? undefined : row.state}>
        <DiffValue value={row.after} removed={false} />
      </td>
    </tr>
  );
};

const VersionTable = ({ view }: Readonly<{ view: CompareView }>) => {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? view.rows : view.rows.filter((row) => row.state !== 'same');
  const summary = `变更 ${String(changedCount(view.rows, 'changed'))} · 新增 ${String(changedCount(view.rows, 'added'))} · 移除 ${String(changedCount(view.rows, 'removed'))}`;
  const previous = view.pair.previous?.label ?? '';
  return (
    <>
      <div class="gov-version-bar">
        <span>{summary}</span>
        <label>
          <input
            type="checkbox"
            checked={showAll}
            data-testid="kt-cfg-version-all"
            onClick={() => {
              setShowAll(!showAll);
            }}
          />
          显示全部字段
        </label>
      </div>
      <table class="gov-version-table" data-testid="kt-cfg-version-table">
        <colgroup>
          <col class="gov-version-field" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">字段</th>
            <th scope="col">上一版本 {previous}</th>
            <th scope="col">当前版本 {view.pair.current.label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <DiffRowView key={row.label} row={row} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p class="gov-version-empty">两个版本的业务字段完全一致。</p> : null}
    </>
  );
};

export const VersionCompare = ({ view }: Readonly<{ view: CompareView }>) => {
  const first = view.pair.previous === null && !view.loading && view.error === '';
  return (
    <section
      class="gov-version-compare"
      data-testid="kt-cfg-version-compare"
      data-headline={versionHeadline(view.pair)}
    >
      <h3>版本对比</h3>
      <p class="console-hint" data-testid="kt-cfg-version-headline">
        {versionHeadline(view.pair)}
      </p>
      {view.error !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-cfg-version-error">
          {view.error}
        </p>
      ) : null}
      {view.loading ? (
        <p class="console-hint" role="status">
          正在读取上一版本…
        </p>
      ) : null}
      {first ? (
        <p class="gov-version-empty" data-testid="kt-cfg-version-empty">
          当前为首个版本，暂无可对比的上一版本。
        </p>
      ) : null}
      {view.pair.previous !== null ? <VersionTable view={view} /> : null}
    </section>
  );
};
