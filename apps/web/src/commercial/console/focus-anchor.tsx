// TD-WF-014④（写流程冒烟 WS-P3-04）：抽屉里的行内表单一打开，触发它的按钮就被移除，键盘焦点落回页面主体；
// Esc 只在焦点位于抽屉内时才到达 DetailDrawer 的键盘处理器，于是抽屉关不掉。行内表单提交后关闭、
// 或一次写操作改变了可用操作（认领后「认领」按钮消失、取消订单后「取消订单」按钮消失），也是同样的事。
//
// 用法：把 FocusAnchor 放在抽屉（或表格行的操作列）里。token 写明「现在有哪些操作和表单」
// （如 `${activeForm}|${status}`），它一变锚点就重新挂载，ref 回调在提交阶段同步执行——不经 useEffect
// 的「绘制之后」调度，真实浏览器与测试里时序一致。
//
// 只在焦点确实丢了的时候才动：当前焦点元素是 body 或已被移出文档。抽屉刚打开时焦点还在行内的
// 「查看」按钮上，这时不动它——把焦点带进抽屉、关闭时还回触发按钮是 DetailDrawer 自己的事。
import { useRef, useState } from 'preact/hooks';

type FocusHost = Readonly<{ focus: (options?: { preventScroll?: boolean }) => void }>;
type ActiveDocument = Readonly<{ activeElement: unknown; body?: unknown }>;
type ParentLink = Readonly<{ parentNode?: HTMLElement | null }>;

const asElement = (value: unknown): HTMLElement | null =>
  typeof value === 'object' && value !== null && (value as { nodeType?: number }).nodeType === 1
    ? (value as HTMLElement)
    : null;

// 元素是否还在当前这棵树里。浏览器直接看 isConnected。测试 DOM double 没有 isConnected，渲染根也不连在
// 文档上（是个游离的 div）：改看它与参照元素（一直在树里的锚点）是否同根——被移除的子树整棵脱开，
// 其中的节点连同它们的上层祖先一起离开了渲染根。
const topmost = (node: HTMLElement): HTMLElement => {
  let current: HTMLElement = node;
  // 按结构取 parentNode：测试 DOM double 的节点类型不是 lib.dom 的 HTMLElement。
  for (;;) {
    const parent = (current as unknown as ParentLink).parentNode;
    if (parent === null || parent === undefined) return current;
    current = parent;
  }
};
const isAttached = (node: HTMLElement, anchor: HTMLElement): boolean =>
  typeof node.isConnected === 'boolean' ? node.isConnected : topmost(node) === topmost(anchor);

// 向上找第一个带某个 class 的祖先（不用 closest：测试 DOM double 没有它）。
const ancestorWithClass = (node: HTMLElement, token: string): HTMLElement | null => {
  for (
    let current: HTMLElement | null = node;
    current;
    current = (current as unknown as ParentLink).parentNode ?? null
  )
    if (current.classList.contains(token)) return current;
  return null;
};

const firstFocusableIn = (scope: HTMLElement, selector: string): FocusHost | null => {
  const found = asElement(scope.querySelector(selector));
  return found !== null && typeof found.focus === 'function' ? found : null;
};

// 行内表单的首个字段。
const INLINE_FORM_FIELD =
  'form.form-section input, form.form-section select, form.form-section textarea';

/** 把焦点带回锚点所在的位置：抽屉里有行内表单就进表单的首个字段，否则回到抽屉的关闭按钮；
 *  不在抽屉里（表格行的操作列）就回到所在容器的第一个按钮（「查看」）。返回是否移动了焦点。 */
export const refocusInto = (anchor: HTMLElement): boolean => {
  const doc = globalThis.document as unknown as ActiveDocument;
  const active = asElement(doc.activeElement);
  if (active !== null && active !== doc.body && isAttached(active, anchor)) return false;
  const drawer = ancestorWithClass(anchor, 'detail-drawer');
  const scope = drawer ?? (anchor as unknown as ParentLink).parentNode ?? null;
  if (scope === null) return false;
  const target =
    (drawer === null ? null : firstFocusableIn(drawer, INLINE_FORM_FIELD)) ??
    firstFocusableIn(scope, '.drawer-close') ??
    firstFocusableIn(scope, 'button');
  if (target === null) return false;
  target.focus();
  return true;
};

export const FocusAnchor = ({ token }: Readonly<{ token: string }>) => {
  // 锚点所在的位置第一次挂载（抽屉 / 行刚出现）时不接管焦点；之后 token 每变一次重新挂载一次。
  const firstMount = useRef(true);
  // ref 回调只创建一次：回调身份一变，Preact 会先卸载旧的再挂载新的。
  const [attach] = useState(() => (node: HTMLElement | null): void => {
    if (node === null) return;
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    refocusInto(node);
  });
  // 锚点自身不显示、不可聚焦：它只是一个在提交阶段拿到时机的落点。
  return <span hidden data-focus-anchor="" key={token} ref={attach} />;
};
