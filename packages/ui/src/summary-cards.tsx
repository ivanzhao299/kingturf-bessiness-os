import type { StatusTone } from './status-badge';

export type SummaryCardItem = Readonly<{
  // 稳定键，也是卡片 testid 的后缀。
  id: string;
  // 卡上写明的口径。
  label: string;
  // 主数字。类型是字符串：金额、比例由调用方按各自口径格式化，组件不做算术；读不到数据时传「—」。
  value: string;
  // 口径补充或单位，如「家」「已发布 4 / 草稿 0」。
  hint?: string | undefined;
  // 语义色，只作用于主数字。
  tone?: StatusTone | undefined;
  // 给了就是筛选：按下的卡片是选中态。
  active?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  // 给了就是链接（概览卡跳子路由）；与 onSelect 同时给时链接优先。
  // 可选属性都显式允许 undefined（仓库开着 exactOptionalPropertyTypes），调用方可以直接写「条件 ? 值 : undefined」。
  href?: string | undefined;
}>;

export type SummaryCardsProps = Readonly<{
  // 读屏用的组名，如「工单状态汇总」。
  label: string;
  items: readonly SummaryCardItem[];
  testId?: string | undefined;
  // 卡片的 testid；缺省为 `${testId}-${id}`。
  itemTestId?: ((id: string) => string) | undefined;
}>;

// 汇总卡：标签 + 主数字 + 口径说明。全站的概览与控制台共用这一种，不再各写一套——
// 卡上必须写明数字的口径，读不到数据时显示「—」而不是 0。
export const SummaryCards = (props: SummaryCardsProps) => {
  const testIdOf = (id: string): string | undefined =>
    props.itemTestId
      ? props.itemTestId(id)
      : props.testId === undefined
        ? undefined
        : `${props.testId}-${id}`;
  return (
    <div class="stat-cards" role="group" aria-label={props.label} data-testid={props.testId}>
      {props.items.map((item) => {
        const testid = testIdOf(item.id);
        const tone = item.tone ?? 'neutral';
        const body = (
          <>
            <span class="stat-card-label">{item.label}</span>
            <strong class="stat-card-value">{item.value}</strong>
            {item.hint === undefined ? null : <small class="stat-card-hint">{item.hint}</small>}
          </>
        );
        if (item.href !== undefined)
          return (
            <a
              key={item.id}
              class="stat-card"
              data-tone={tone}
              href={item.href}
              data-testid={testid}
            >
              {body}
            </a>
          );
        if (item.onSelect !== undefined)
          return (
            <button
              key={item.id}
              type="button"
              class="stat-card"
              data-tone={tone}
              aria-pressed={item.active === true}
              data-testid={testid}
              onClick={item.onSelect}
            >
              {body}
            </button>
          );
        return (
          <div key={item.id} class="stat-card" data-tone={tone} data-testid={testid}>
            {body}
          </div>
        );
      })}
    </div>
  );
};
