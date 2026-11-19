import type { ComponentChild } from 'preact';

export type EmptyStateProps = Readonly<{
  title: string;
  description?: string;
  action?: ComponentChild;
}>;

// 空态：DataTable/列表页/查询工作台的统一空结果呈现。
export const EmptyState = (props: EmptyStateProps) => (
  <div class="empty-state" role="status">
    <h3>{props.title}</h3>
    {props.description !== undefined && props.description !== '' ? (
      <p>{props.description}</p>
    ) : null}
    {props.action !== undefined && props.action !== null ? (
      <div class="empty-state-action">{props.action}</div>
    ) : null}
  </div>
);
