export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type StatusBadgeProps = Readonly<{
  tone?: StatusTone;
  children: string;
}>;

// 状态徽章：tone 经 data-tone 消费 tokens.css 的语义色，不写死颜色。
export const StatusBadge = (props: StatusBadgeProps) => (
  <span class="status-badge" data-tone={props.tone ?? 'neutral'}>
    {props.children}
  </span>
);
