import { useRef, useState } from 'preact/hooks';

export type ConfirmDialogProps = Readonly<{
  // 标题：对什么做什么（经 aria-labelledby 关联到对话框）。
  title: string;
  // 说明：后果与是否可撤回（经 aria-describedby 关联到对话框）。
  message: string;
  // 确认按钮文字；缺省「确认」。
  confirmLabel?: string;
  // 取消按钮文字；缺省「取消」。
  cancelLabel?: string;
  // 破坏性动作（取消订单、关闭询价…）：初焦落在「取消」上，回车不会直接生效；缺省落在确认按钮上。
  destructive?: boolean;
  // 用户确认。调用方据此执行动作并关闭对话框——本组件不自行关闭。
  onConfirm: () => void;
  // 用户取消：Esc 或「取消」按钮。
  onCancel: () => void;
}>;

// 结构化可聚焦判定与宿主接口：浏览器 HTMLElement 与测试 DOM double 通用（不用 instanceof，同 detail-drawer）。
type Focusable = Readonly<{
  focus: (options?: { preventScroll?: boolean }) => void;
  disabled?: boolean;
}>;
type QueryHost = Readonly<{
  querySelectorAll: (selector: string) => NodeList | readonly unknown[];
}>;
type ActiveDocument = Readonly<{ activeElement: unknown }>;

const isFocusable = (node: unknown): node is Focusable =>
  typeof (node as Focusable | null)?.focus === 'function' && (node as Focusable).disabled !== true;

const buttonsIn = (root: HTMLElement | null): readonly Focusable[] => {
  if (root === null) return [];
  const finder = root as unknown as QueryHost;
  if (typeof finder.querySelectorAll !== 'function') return [];
  // 浏览器返回 NodeList（可迭代、无数组方法），统一经 Array.from 取数组。
  return Array.from(finder.querySelectorAll('button')).filter(isFocusable);
};

let confirmTextSeq = 0;

// 不可逆动作的确认框（TD-WF-014②）：模态 alertdialog——初焦进入、Esc 取消、Tab 留在框内、关闭还焦。
// 焦点管理与关闭还焦都挂在 ref 回调上：ref 回调在提交阶段同步执行、清理函数在卸载时同步执行，
// 不经 useEffect 的「绘制之后」调度，真实浏览器与测试里时序一致。
export const ConfirmDialog = (props: ConfirmDialogProps) => {
  const [titleId] = useState(() => `confirm-title-${String(++confirmTextSeq)}`);
  const [messageId] = useState(() => `confirm-message-${String(++confirmTextSeq)}`);
  const dialogNode = useRef<HTMLDivElement | null>(null);
  // 最新属性放进 ref：下面的 ref 回调只在挂载时创建一次（身份稳定）。回调身份一变，Preact 会先执行
  // 旧回调的清理函数（把焦点还回触发元素）再执行新回调（再拿进来），重渲染一次焦点就跳一次。
  const latest = useRef(props);
  latest.current = props;
  const [attach] = useState(() => {
    const ref = (node: HTMLDivElement | null): (() => void) | undefined => {
      if (node === null) return undefined;
      dialogNode.current = node;
      const doc = globalThis.document as unknown as ActiveDocument;
      const previous = isFocusable(doc.activeElement) ? doc.activeElement : null;
      const buttons = buttonsIn(node);
      const initial = latest.current.destructive === true ? buttons[0] : buttons.at(-1);
      initial?.focus();
      // 关闭还焦：回到打开对话框之前的焦点元素。触发按钮若已被移除，浏览器忽略对它的 focus，焦点留在原处。
      return () => {
        previous?.focus({ preventScroll: true });
      };
    };
    return ref;
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    // 对话框是模态的：按键不再冒泡。外层若还有 DetailDrawer，它的 Esc 关闭与 Tab 环绕都不该被这个框里的按键触发。
    event.stopPropagation();
    const doc = globalThis.document as unknown as ActiveDocument;
    if (event.key === 'Escape') {
      event.preventDefault();
      latest.current.onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = buttonsIn(dialogNode.current);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    // 框内没有可聚焦元素时 Tab 不出去；否则在首尾之间环绕。
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    const active = doc.activeElement;
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  return (
    <div class="confirm-root">
      <div class="confirm-overlay" />
      <div
        ref={attach}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        class="confirm-dialog"
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} class="confirm-title">
          {props.title}
        </h2>
        <p id={messageId} class="confirm-message">
          {props.message}
        </p>
        <div class="confirm-actions">
          <button type="button" class="secondary" onClick={props.onCancel}>
            {props.cancelLabel ?? '取消'}
          </button>
          <button type="button" class="primary" onClick={props.onConfirm}>
            {props.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
};
