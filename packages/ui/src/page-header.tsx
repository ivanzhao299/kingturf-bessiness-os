import type { ComponentChild } from 'preact';

export type PageHeaderProps = Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ComponentChild;
}>;

// 列表/详情/配置/仪表盘页面的统一页头（ADR-0014 解剖模板四类共用）。
export const PageHeader = (props: PageHeaderProps) => (
  <header class="page-header">
    {props.eyebrow !== undefined && props.eyebrow !== '' ? (
      <p class="eyebrow">{props.eyebrow}</p>
    ) : null}
    <h1>{props.title}</h1>
    {props.description !== undefined && props.description !== '' ? (
      <p class="page-header-description">{props.description}</p>
    ) : null}
    {props.actions !== undefined && props.actions !== null ? (
      <div class="page-header-actions">{props.actions}</div>
    ) : null}
  </header>
);
