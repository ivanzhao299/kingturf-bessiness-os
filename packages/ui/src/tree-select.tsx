import { useState } from 'preact/hooks';

export type TreeSelectNode = Readonly<{
  id: string;
  label: string;
  children?: readonly TreeSelectNode[];
}>;

export type TreeSelectProps = Readonly<{
  label: string;
  tree: readonly TreeSelectNode[];
  value?: string;
  onSelect?: (id: string) => void;
}>;

type FlatNode = Readonly<{ node: TreeSelectNode; depth: number }>;

const flattenTree = (tree: readonly TreeSelectNode[], depth = 1): readonly FlatNode[] =>
  tree.flatMap((node) => [
    { node, depth },
    ...(node.children ? flattenTree(node.children, depth + 1) : []),
  ]);

const labelOf = (tree: readonly TreeSelectNode[], id: string | undefined): string | null => {
  for (const node of tree) {
    if (node.id === id) return node.label;
    const nested = node.children ? labelOf(node.children, id) : null;
    if (nested !== null) return nested;
  }
  return null;
};

const optionId = (id: string): string => `tree-option-${id}`;

// 组织树选择器：触发按钮 + listbox 弹层，保留层级 aria-level；Esc 关闭不改值，方向键移动、Enter 提交。
export const TreeSelect = (props: TreeSelectProps) => {
  const flat = flattenTree(props.tree);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedLabel = labelOf(props.tree, props.value);
  const active = flat[activeIndex];

  const commit = (index: number): void => {
    const target = flat[index];
    if (!target) return;
    props.onSelect?.(target.node.id);
    setOpen(false);
  };

  const onTriggerClick = (): void => {
    const current =
      props.value !== undefined ? flat.findIndex((f) => f.node.id === props.value) : -1;
    setActiveIndex(current === -1 ? 0 : current);
    setOpen(!open);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (flat.length === 0) return;
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((activeIndex + 1) % flat.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((activeIndex - 1 + flat.length) % flat.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  return (
    <div class="tree-select">
      <button
        type="button"
        class="tree-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        onClick={onTriggerClick}
        onKeyDown={onKeyDown}
      >
        {selectedLabel ?? `选择${props.label}`}
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={props.label}
          class="tree-select-list"
          aria-activedescendant={active ? optionId(active.node.id) : undefined}
          onKeyDown={onKeyDown}
        >
          {flat.map(({ node, depth }) => (
            <li
              key={node.id}
              id={optionId(node.id)}
              role="option"
              data-id={node.id}
              data-depth={String(depth)}
              aria-level={depth}
              aria-selected={node.id === props.value ? 'true' : 'false'}
              class={`tree-select-option depth-${String(depth)}`}
              onClick={() => {
                const index = flat.findIndex((f) => f.node.id === node.id);
                commit(index);
              }}
            >
              {node.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
