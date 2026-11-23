// CRM-UX：客户域控制台共用呈现件（头像/来源图标/分区卡）。
// 两页控制台共同引用；样式表 crm-ux.css 在此单点引入（裁定15：cssCodeSplit:false 合并进主包）。
import type { ComponentChildren } from 'preact';
import { initialOf, type LeadSourceIcon } from './crm-ux';
import { SourceGlyph, UserGlyph } from './crm-ux-icons';
import './crm-ux.css';

/** 字头像：名字首字（拉丁名转大写）；无名字时回落为轮廓人形。装饰性，名称由相邻文本承载。 */
export const Avatar = ({ name, large }: Readonly<{ name: unknown; large?: boolean }>) => {
  const initial = initialOf(name);
  return (
    <span
      class={large === true ? 'crm-avatar crm-avatar-lg' : 'crm-avatar'}
      {...(initial === '' ? { 'data-tone': 'empty' } : {})}
      aria-hidden="true"
    >
      {initial === '' ? <UserGlyph /> : initial}
    </span>
  );
};

/** 线索来源图标块（悬停提示来源文案；来源未命中图标表时仍显示原文）。 */
export const SourceGlyphTile = ({
  kind,
  label,
}: Readonly<{ kind: LeadSourceIcon; label: string }>) => (
  <span
    class="crm-entity-icon"
    {...(label === '' ? {} : { title: `来源：${label}` })}
    aria-hidden="true"
  >
    <SourceGlyph kind={kind} />
  </span>
);

/** 360 分区卡：标题 + 计数 + 右侧动作（筛选/开关），正文由调用方给出。 */
export const SectionCard = ({
  title,
  count,
  actions,
  testId,
  children,
}: Readonly<{
  title: string;
  count?: number;
  actions?: ComponentChildren;
  testId?: string;
  children?: ComponentChildren;
}>) => (
  <section class="crm-section" data-testid={testId}>
    <header class="crm-section-head">
      <h3 class="crm-section-title">
        {title}
        {count === undefined ? null : <span class="crm-count">{String(count)}</span>}
      </h3>
      {actions}
    </header>
    {children}
  </section>
);
