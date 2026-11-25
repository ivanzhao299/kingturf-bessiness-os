// U3-MFG-2（ADR-0014 分域重写）：BOM 详情抽屉——版本历史（草稿行内发布）、组件层级
// 树（可折叠展开、替代料醒目标记）与版本对比视图（选两个版本并排，新增/删除/变化
// 三类差异高亮）。详情数据来自 additive findBom（versions 行项 + tree 层级）；对比
// 由前端基于 versions 行项计算（bom-state diffVersions 纯函数），不新增写路径。
import { DetailDrawer } from '@kingturf/ui';
import { askPublishVersion } from './console-confirm';
import { FocusAnchor } from './focus-anchor';
import { ConsoleNotice } from './console-notice';
import type { BomRow } from './bom-ports';
import {
  bomVersions,
  defaultCompare,
  diffVersions,
  STATUS_LABELS,
  substituteSummary,
  versionHead,
  type BomViewState,
  type DiffKind,
} from './bom-state';

type DetailProps = Readonly<{ state: BomViewState }>;

const recordOf = (value: unknown): BomRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as BomRow) : {};
const recordsOf = (value: unknown): readonly BomRow[] =>
  Array.isArray(value) ? value.map(recordOf) : [];

export const versionLabel = (state: BomViewState, status: unknown): string =>
  STATUS_LABELS[String(status)] ?? state.ports.businessStateLabel(status);

// 发布不可逆：行内与详情里的发布按钮都先确认（TD-WF-014②）。详情里的版本行不带编码时取抽屉当前行的。
export const confirmPublish = (state: BomViewState, row: BomRow): void => {
  askPublishVersion(
    state.confirm,
    `${state.ports.textValue(row.code, '') || state.ports.textValue(state.selected?.code, '—')} 第 ${state.ports.textValue(row.version, '?')} 版`,
    '组件与替代料',
    () => state.runPublish(row),
  );
};

// 组件层级树：单节点渲染，子 BOM 经 line.bom 递归（折叠集合按子 BOM 版本行 id）。
const TreeLines = ({
  state,
  lines,
  depth,
}: DetailProps & Readonly<{ lines: readonly BomRow[]; depth: number }>) => {
  const { collapsed, toggleNode } = state;
  return (
    <ul class="bom-tree" data-depth={String(depth)}>
      {lines.map((line, index) => {
        const component = recordOf(line.component);
        const child = recordOf(line.bom);
        const hasChild = Object.keys(child).length > 0;
        const childId = state.ports.textValue(child.bomVersionId ?? child.id, '');
        const isCollapsed = hasChild && collapsed.has(childId);
        const rowKey = state.ports.textValue(line.lineNumber ?? line.line_number, String(index));
        return (
          <li key={`${String(depth)}-${rowKey}`} class="bom-tree-line">
            <span class="bom-tree-main">
              {hasChild ? (
                <button
                  type="button"
                  class="bom-tree-toggle"
                  aria-expanded={isCollapsed ? 'false' : 'true'}
                  aria-label={isCollapsed ? '展开子 BOM' : '折叠子 BOM'}
                  data-testid="kt-bom-tree-toggle"
                  onClick={() => {
                    toggleNode(childId);
                  }}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
              ) : (
                <span class="bom-tree-leaf" aria-hidden="true">
                  ·
                </span>
              )}
              <strong data-testid={depth === 0 ? 'kt-bom-component' : undefined}>
                {state.ports.textValue(component.sku, '—')}
              </strong>
              <span class="bom-muted">{state.ports.textValue(component.name, '')}</span>
              <span class="bom-qty">
                {`× ${state.ports.textValue(line.quantity ?? line.quantity, '—')}`}
              </span>
              <span class="bom-muted">{`损耗 ${state.ports.textValue(line.scrapBasisPoints, '0')}bp`}</span>
              <span class="bom-muted">
                {`单位 ${state.ports.textValue(component.baseUnitCode, '—')}`}
              </span>
              {recordsOf(line.substitutes).length > 0 ? (
                <span class="console-chip bom-substitute" data-testid="kt-bom-substitute">
                  {`替代料 ${substituteSummary(line)}`}
                </span>
              ) : null}
            </span>
            {hasChild && !isCollapsed ? (
              <div class="bom-tree-child">
                <p class="bom-muted bom-child-head">
                  {`↳ 子 BOM ${state.ports.textValue(child.code, '')} · ${versionHead(child)}`}
                </p>
                <TreeLines state={state} lines={recordsOf(child.lines)} depth={depth + 1} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

// 版本对比视图：两个版本行项并排，新增/删除/变化三类差异高亮。
const DIFF_LABELS: Readonly<Record<DiffKind, string>> = {
  ADDED: '新增',
  REMOVED: '删除',
  CHANGED: '变化',
};
const DIFF_CLASS: Readonly<Record<DiffKind, string>> = {
  ADDED: 'bom-diff-added',
  REMOVED: 'bom-diff-removed',
  CHANGED: 'bom-diff-changed',
};

const VersionSelect = ({
  state,
  versions,
  slot,
}: DetailProps & Readonly<{ versions: readonly BomRow[]; slot: 0 | 1 }>) => {
  const pair = state.compareVersions ?? defaultCompare(versions);
  const value = pair?.[slot] ?? '';
  return (
    <select
      data-testid={`kt-bom-compare-${slot === 0 ? 'a' : 'b'}`}
      value={value}
      onInput={(event) => {
        const next = (event.target as { value?: string }).value ?? '';
        const base = state.compareVersions ?? defaultCompare(versions);
        if (!base) return;
        const pair: readonly [string, string] = slot === 0 ? [next, base[1]] : [base[0], next];
        if (pair[0] !== '' && pair[1] !== '' && pair[0] !== pair[1]) state.setCompareVersions(pair);
      }}
    >
      {versions.map((version, index) => (
        <option
          key={state.ports.textValue(version.id, String(index))}
          value={state.ports.textValue(version.id, String(index))}
        >
          {versionHead(version)}
        </option>
      ))}
    </select>
  );
};

const CompareView = ({ state }: DetailProps) => {
  const versions = bomVersions(state.detail);
  if (versions.length < 2) return null;
  const pair = state.compareVersions ?? defaultCompare(versions);
  if (!pair) return null;
  const newer = versions.find((version) => state.ports.textValue(version.id, '') === pair[0]);
  const older = versions.find((version) => state.ports.textValue(version.id, '') === pair[1]);
  if (!newer || !older) return null;
  const diffs = diffVersions(newer, older);
  return (
    <section data-testid="kt-bom-compare">
      <p class="console-label">版本对比</p>
      <div class="bom-compare-picker">
        <VersionSelect state={state} versions={versions} slot={0} />
        <span class="bom-muted">对比</span>
        <VersionSelect state={state} versions={versions} slot={1} />
        {diffs.length === 0 ? (
          <span class="bom-muted" data-testid="kt-bom-compare-same">
            两版本行项一致
          </span>
        ) : (
          <span class="bom-muted" data-testid="kt-bom-compare-count">
            {`差异 ${String(diffs.length)} 处`}
          </span>
        )}
      </div>
      <ul class="bom-diff-list">
        {diffs.map((diff, index) => (
          <li
            key={`${diff.kind}-${String(index)}`}
            class={`bom-diff-line ${DIFF_CLASS[diff.kind]}`}
            data-testid={`kt-bom-diff-${diff.kind.toLowerCase()}`}
          >
            <span class={`bom-diff-kind ${DIFF_CLASS[diff.kind]}`}>{DIFF_LABELS[diff.kind]}</span>
            <strong>{state.ports.textValue(diff.component.sku, '—')}</strong>
            {diff.kind === 'CHANGED' ? (
              <span class="bom-diff-fields">
                {diff.changes.map((change) => (
                  <span key={change.label} class="bom-diff-field">
                    {`${change.label}：${change.from} → ${change.to}`}
                  </span>
                ))}
              </span>
            ) : diff.kind === 'ADDED' ? (
              <span class="bom-muted">
                {`× ${state.ports.textValue(diff.next?.quantity, '—')}（仅 ${versionHead(newer)}）`}
              </span>
            ) : (
              <span class="bom-muted">
                {`× ${state.ports.textValue(diff.prev?.quantity, '—')}（仅 ${versionHead(older)}）`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export const BomDetailDrawer = ({ state }: DetailProps) => {
  const row = state.selected;
  if (!row) return null;
  const detail = state.detail ?? row;
  const versions = bomVersions(state.detail);
  // TD-WF-014④：草稿版本带「发布」按钮；发布后它消失，焦点锚点据此把键盘焦点带回抽屉。
  const focusToken = (versions.length > 0 ? versions : [row])
    .map((version) => state.ports.textValue(version.status, ''))
    .join(',');
  const tree = recordsOf(detail.tree);
  const lines = tree.length > 0 ? recordsOf(recordOf(tree[0]).lines) : recordsOf(detail.lines);
  return (
    <DetailDrawer
      title={`BOM 详情 · ${state.ports.recordText(row, 'code', 'code')}`}
      onClose={() => {
        state.open(null);
      }}
      // TD-WF-014①：写成功的提示放在抽屉底部，不随抽屉体滚走。
      footer={state.notice === '' ? undefined : <ConsoleNotice message={state.notice} />}
    >
      <div class="console-summary" data-testid="kt-bom-detail-summary">
        <p>
          <span class="console-label">BOM 编码</span>
          {state.ports.recordText(row, 'code', 'code')}
          <span class="console-label">名称</span>
          {state.ports.recordText(detail, 'name', 'name', '—')}
        </p>
        <p>
          <span class="console-label">产品</span>
          {`${state.ports.textValue(recordOf(detail.product).sku, '—')} · ${state.ports.textValue(recordOf(detail.product).name, '')}`}
          <span class="console-label">版本数</span>
          {String(versions.length)}
        </p>
      </div>
      {state.detailLoading ? (
        <p class="console-label" data-testid="kt-bom-detail-loading">
          详情加载中…
        </p>
      ) : null}
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-bom-submit-error">
          {state.submitError}
        </p>
      ) : null}
      <p class="console-label">版本历史</p>
      <div class="console-chips" data-testid="kt-bom-versions">
        {(versions.length > 0 ? versions : [row]).map((version, index) => {
          const status = state.ports.textValue(version.status, '');
          return (
            <span
              key={state.ports.textValue(version.id, String(index))}
              class="console-chip"
              data-testid="kt-bom-version"
            >
              {`v${state.ports.textValue(version.version, '?')} ${versionLabel(state, status)}`}
              {state.mayManage && status === 'DRAFT' ? (
                <button
                  type="button"
                  class="mfg-chip-remove"
                  data-testid="kt-bom-publish-version"
                  onClick={() => {
                    confirmPublish(state, version);
                  }}
                >
                  发布
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
      <p class="console-label">组件层级</p>
      <div data-testid="kt-bom-tree">
        <TreeLines state={state} lines={lines} depth={0} />
      </div>
      <CompareView state={state} />
      <FocusAnchor token={focusToken} />
    </DetailDrawer>
  );
};
