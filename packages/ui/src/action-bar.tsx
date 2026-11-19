import type { ComponentChild } from 'preact';

export type ActionBarProps = Readonly<{
  label: string;
  count?: number;
  children?: ComponentChild;
}>;

// 行级/批量操作栏：工具条语义 + 可选的已选计数播报（列表页解剖模板的批量操作栏）。
export const ActionBar = (props: ActionBarProps) => (
  <div class="action-bar" role="toolbar" aria-label={props.label}>
    {props.count !== undefined ? (
      <span class="action-bar-count" data-bulk-count="true" aria-live="polite">
        已选 {String(props.count)} 项
      </span>
    ) : null}
    <div class="action-bar-actions">{props.children}</div>
  </div>
);
