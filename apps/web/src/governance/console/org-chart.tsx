import type { OrgCount, OrgCounts, OrgNode } from './org-chart-model';

// GOV-UX ② 可视化组织架构图（替代下拉式 TreeSelect）：常显树形 + 展开/收起 + 人数统计
// 徽章（直属 / 含下级）。tree/treeitem/group ARIA 语义；节点与开关均为原生按钮（Tab/Enter
// 可达），方向键 ←/→ 在聚焦节点上收起/展开。选中语义与原 TreeSelect 一致（服务端过滤）。
type NodeActions = Readonly<{
  counts: OrgCounts;
  selected: string | undefined;
  collapsed: ReadonlySet<string>;
  onCollapse: (id: string, collapsed: boolean) => void;
  onSelect: (id: string) => void;
}>;

const CountBadges = ({ count }: Readonly<{ count: OrgCount | undefined }>) => {
  if (count === undefined)
    return (
      <span class="org-chart-badge is-empty" data-testid="kt-org-count">
        …
      </span>
    );
  const direct = `${String(count.direct)} 人`;
  return (
    <>
      <span
        class={`org-chart-badge${count.direct === 0 ? ' is-empty' : ''}`}
        data-testid="kt-org-count"
        title={`直属 ${direct}`}
      >
        {direct}
      </span>
      {count.subtree > count.direct ? (
        <span
          class="org-chart-badge is-total"
          data-testid="kt-org-count-total"
          title={`含下级合计 ${String(count.subtree)} 人`}
        >
          含下级 {String(count.subtree)}
        </span>
      ) : null}
    </>
  );
};

const OrgChartNode = (props: NodeActions & Readonly<{ node: OrgNode; depth: number }>) => {
  const { node } = props;
  const branch = node.children.length > 0;
  const open = branch && !props.collapsed.has(node.id);
  return (
    <li
      role="treeitem"
      aria-level={props.depth}
      {...(branch ? { 'aria-expanded': open ? 'true' : 'false' } : {})}
      aria-selected={props.selected === node.id ? 'true' : 'false'}
      class="org-chart-node"
      data-id={node.id}
      data-testid="kt-org-node"
    >
      <div class="org-chart-row" data-selected={props.selected === node.id ? 'true' : 'false'}>
        {branch ? (
          <button
            type="button"
            class="org-chart-toggle"
            aria-label={`${open ? '收起' : '展开'}${node.name}`}
            data-testid="kt-org-toggle"
            onClick={() => {
              props.onCollapse(node.id, open);
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span class="org-chart-toggle is-leaf" aria-hidden="true">
            ·
          </span>
        )}
        <button
          type="button"
          class="org-chart-label"
          data-testid="kt-org-select"
          title={`${node.code} · ${node.name}`}
          onClick={() => {
            props.onSelect(node.id);
          }}
        >
          <span class="org-chart-code">{node.code}</span>
          <span class="org-chart-name">{node.name}</span>
        </button>
        <CountBadges count={props.counts[node.id]} />
      </div>
      {open ? (
        <ul role="group" class="org-chart-group">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} {...props} node={child} depth={props.depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

// 方向键：→ 展开、← 收起 聚焦的 treeitem（事件目标取最近的 treeitem；测试 DOM 无 closest 时忽略）。
const focusedNodeId = (target: EventTarget | null): string | null => {
  const seeker = target as unknown as {
    closest?: (selector: string) => { getAttribute: (name: string) => string | null } | null;
  } | null;
  if (typeof seeker?.closest !== 'function') return null;
  const id = seeker.closest('[role="treeitem"]')?.getAttribute('data-id');
  return id ?? null;
};

export type OrgChartProps = Readonly<{
  tree: readonly OrgNode[];
  counts: OrgCounts;
  total: number;
  selected: string | undefined;
  collapsed: ReadonlySet<string>;
  onCollapse: (id: string, collapsed: boolean) => void;
  onSelect: (id: string | undefined) => void;
}>;

export const OrgChart = (props: OrgChartProps) => {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const id = focusedNodeId(event.target);
    if (id === null) return;
    event.preventDefault();
    props.onCollapse(id, event.key === 'ArrowLeft');
  };
  return (
    <div class="org-chart-root" data-testid="kt-org-chart">
      <button
        type="button"
        class="org-chart-all"
        aria-pressed={props.selected === undefined ? 'true' : 'false'}
        data-testid="kt-org-all"
        onClick={() => {
          props.onSelect(undefined);
        }}
      >
        全部组织
        <span class="org-chart-badge" data-testid="kt-org-count-all">
          {props.total > 0 ? `${String(props.total)} 人` : '…'}
        </span>
      </button>
      <ul role="tree" aria-label="组织架构" class="org-chart" onKeyDown={onKeyDown}>
        {props.tree.map((node) => (
          <OrgChartNode
            key={node.id}
            node={node}
            depth={1}
            counts={props.counts}
            selected={props.selected}
            collapsed={props.collapsed}
            onCollapse={props.onCollapse}
            onSelect={(id) => {
              props.onSelect(id);
            }}
          />
        ))}
      </ul>
    </div>
  );
};
