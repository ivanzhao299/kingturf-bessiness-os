// CRM-UX：客户域控制台线性图标（24 网格描边）。设计规范：图标一律 SVG，
// 不用 emoji 或字符充当图标/头像；路径为自绘简化几何，随 currentColor 取色。
// 图形以工厂函数提供：每次渲染产出新 vnode，不跨位置复用同一节点。
import type { ComponentChildren } from 'preact';
import type { ActivityIcon, LeadSourceIcon } from './crm-ux';

// exactOptionalPropertyTypes：显式允许传入 undefined（调用方常以 `class?: string` 透传）。
type GlyphProps = Readonly<{ class?: string | undefined; children?: ComponentChildren }>;

const Glyph = ({ class: className, children }: GlyphProps) => (
  <svg
    {...(className === undefined ? {} : { class: className })}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const expo = (): ComponentChildren => (
  <>
    <path d="M3 20h18" />
    <path d="M5 20V10h14v10" />
    <path d="M12 10V3" />
    <path d="M12 3h5l-1.6 2L17 7h-5" />
  </>
);

const user = (): ComponentChildren => (
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M4.5 20c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
  </>
);

const SOURCE_GLYPHS: Readonly<Record<LeadSourceIcon, () => ComponentChildren>> = {
  expo,
  website: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  referral: () => (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.5 14.8c1.8.7 3 2.4 3 4.4" />
    </>
  ),
  outreach: () => (
    <>
      <path d="M21 3 3 10.5l7.5 3L14 21z" />
      <path d="M21 3 10.5 13.5" />
    </>
  ),
  other: () => (
    <>
      <path d="M10 13.5a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.5-5.5l-1.5 1.5" />
      <path d="M14 10.5a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.5 5.5l1.5-1.5" />
    </>
  ),
};

const ACTIVITY_GLYPHS: Readonly<Record<ActivityIcon, () => ComponentChildren>> = {
  visit: () => (
    <>
      <path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  call: () => (
    <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />
  ),
  mail: () => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  expo,
  note: () => (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7" />
      <path d="M8.5 17h5" />
    </>
  ),
  other: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
};

/** 线索来源图标（展会/网站/转介绍/主动开发/其它）。 */
export const SourceGlyph = ({
  kind,
  class: className,
}: Readonly<{ kind: LeadSourceIcon; class?: string }>) => (
  <Glyph class={className}>{SOURCE_GLYPHS[kind]()}</Glyph>
);

/** 活动类型图标（拜访/电话/邮件/展会/记录/其它）。 */
export const ActivityGlyph = ({
  kind,
  class: className,
}: Readonly<{ kind: ActivityIcon; class?: string }>) => (
  <Glyph class={className}>{ACTIVITY_GLYPHS[kind]()}</Glyph>
);

/** 无负责人/占位头像的轮廓人形。 */
export const UserGlyph = ({ class: className }: Pick<GlyphProps, 'class'>) => (
  <Glyph class={className}>{user()}</Glyph>
);

/** 关联对象图标：商机=靶心，线索=人形。 */
export const TargetGlyph = ({ class: className }: Pick<GlyphProps, 'class'>) => (
  <Glyph class={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
  </Glyph>
);

/** 联系方式遮蔽开关：off=true 叠加斜线（当前可见，点击后隐藏）。 */
export const EyeGlyph = ({
  class: className,
  off,
}: Pick<GlyphProps, 'class'> & Readonly<{ off: boolean }>) => (
  <Glyph class={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {off ? <path d="M4 4l16 16" /> : null}
  </Glyph>
);
