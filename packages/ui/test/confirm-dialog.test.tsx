import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { ConfirmDialog } from '../src/confirm-dialog';
import { TestEvent, type TestNode } from './dom';
import { asElement, flush, mount, type Mounted, mountDom } from './render';

const dialogIn = (host: Mounted) => asElement(host.container.querySelector('[role="alertdialog"]'));
const buttonsOf = (host: Mounted): readonly TestNode[] => dialogIn(host).querySelectorAll('button');
const confirmButton = (host: Mounted) => asElement(buttonsOf(host).at(-1) ?? null);
const cancelButton = (host: Mounted) => asElement(buttonsOf(host)[0] ?? null);
const textOf = (node: TestNode): string => node.textContent.trim();
const noop = (): void => undefined;

describe('ConfirmDialog（不可逆动作确认框）', () => {
  it('renders a labelled modal alert dialog with the caller text and default button labels', () => {
    const host = mountDom();
    mount(
      <ConfirmDialog
        title="取消采购订单"
        message="取消后不可恢复。"
        onConfirm={noop}
        onCancel={noop}
      />,
      host,
    );
    const dialog = dialogIn(host);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
    expect(asElement(host.container.querySelector(`[id="${labelledBy}"]`)).textContent).toBe(
      '取消采购订单',
    );
    const describedBy = dialog.getAttribute('aria-describedby') ?? '';
    expect(asElement(host.container.querySelector(`[id="${describedBy}"]`)).textContent).toBe(
      '取消后不可恢复。',
    );
    expect(buttonsOf(host).map(textOf)).toEqual(['取消', '确认']);
    // 确认按钮沿用全站主按钮类，取消是次按钮。
    expect(confirmButton(host).getAttribute('class')).toBe('primary');
    expect(cancelButton(host).getAttribute('class')).toBe('secondary');
    expect(host.container.querySelector('.confirm-overlay')).not.toBeNull();
  });

  it('takes custom button labels', () => {
    const host = mountDom();
    mount(
      <ConfirmDialog
        title="发布版本"
        message="发布后该版本冻结。"
        confirmLabel="确认发布"
        cancelLabel="再想想"
        onConfirm={noop}
        onCancel={noop}
      />,
      host,
    );
    expect(buttonsOf(host).map(textOf)).toEqual(['再想想', '确认发布']);
  });

  // 初焦进入：缺省落在确认按钮上；破坏性动作落在「取消」上，回车不会直接生效。
  it('moves focus into the dialog when it opens', () => {
    const normal = mountDom();
    mount(
      <ConfirmDialog title="发布版本" message="发布后冻结。" onConfirm={noop} onCancel={noop} />,
      normal,
    );
    expect(normal.document.activeElement).toBe(confirmButton(normal));

    const destructive = mountDom();
    mount(
      <ConfirmDialog
        title="取消采购订单"
        message="取消后不可恢复。"
        destructive
        onConfirm={noop}
        onCancel={noop}
      />,
      destructive,
    );
    expect(destructive.document.activeElement).toBe(cancelButton(destructive));
  });

  it('Escape cancels: the cancel handler runs once and the confirm handler never', () => {
    const host = mountDom();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    mount(
      <ConfirmDialog
        title="关闭询价"
        message="关闭后不再接收报价。"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
      host,
    );
    confirmButton(host).dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('traps Tab focus inside the dialog（正反向环绕）', () => {
    const host = mountDom();
    mount(
      <ConfirmDialog title="发布版本" message="发布后冻结。" onConfirm={noop} onCancel={noop} />,
      host,
    );
    const confirm = confirmButton(host);
    const cancel = cancelButton(host);
    confirm.dispatchEvent(new TestEvent('keydown', { key: 'Tab' }));
    expect(host.document.activeElement).toBe(cancel);
    cancel.dispatchEvent(new TestEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(host.document.activeElement).toBe(confirm);
  });

  it('reports the decision from the buttons: confirm runs onConfirm only, cancel runs onCancel only', () => {
    const confirmed = mountDom();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    mount(
      <ConfirmDialog
        title="发布版本"
        message="发布后冻结。"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
      confirmed,
    );
    confirmButton(confirmed).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    const cancelled = mountDom();
    const onConfirmLater = vi.fn();
    const onCancelLater = vi.fn();
    mount(
      <ConfirmDialog
        title="发布版本"
        message="发布后冻结。"
        onConfirm={onConfirmLater}
        onCancel={onCancelLater}
      />,
      cancelled,
    );
    cancelButton(cancelled).click();
    expect(onCancelLater).toHaveBeenCalledTimes(1);
    expect(onConfirmLater).not.toHaveBeenCalled();
  });

  // 关闭还焦：确认、取消、Esc 三条路径都回到打开对话框之前的焦点元素。
  it.each(['confirm', 'cancel', 'escape'] as const)(
    'restores focus to the element that had it before the dialog opened (%s)',
    async (decision) => {
      const host = mountDom();
      const trigger = host.document.createElement('button');
      trigger.textContent = '取消订单';
      host.container.appendChild(trigger);
      trigger.focus();
      expect(host.document.activeElement).toBe(trigger);
      const open = signal(true);
      const close = (): void => {
        open.value = false;
      };
      const App = () =>
        open.value ? (
          <ConfirmDialog
            title="取消采购订单"
            message="取消后不可恢复。"
            destructive
            onConfirm={close}
            onCancel={close}
          />
        ) : null;
      mount(<App />, host);
      expect(host.document.activeElement).toBe(cancelButton(host));
      if (decision === 'confirm') confirmButton(host).click();
      else if (decision === 'cancel') cancelButton(host).click();
      else cancelButton(host).dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
      await flush();
      expect(host.container.querySelector('[role="alertdialog"]')).toBeNull();
      expect(host.document.activeElement).toBe(trigger);
    },
  );

  // 重渲染不改变焦点：焦点管理挂在挂载时创建的那一个 ref 回调上，属性更新不会把焦点还回去再拿进来。
  it('keeps focus in place across a re-render with new text', async () => {
    const host = mountDom();
    const message = signal('第一条说明');
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const App = () => (
      <ConfirmDialog
        title="发布版本"
        message={message.value}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    mount(<App />, host);
    expect(host.document.activeElement).toBe(confirmButton(host));
    cancelButton(host).focus();
    message.value = '第二条说明';
    await flush();
    expect(asElement(host.container.querySelector('.confirm-message')).textContent).toBe(
      '第二条说明',
    );
    expect(host.document.activeElement).toBe(cancelButton(host));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  // mini-DOM 不算样式，只能在样式表层面守：确认框必须盖在抽屉之上，否则开着抽屉时它会被抽屉遮住。
  it('styles: the dialog layer covers the viewport and sits above the detail drawer', () => {
    const stylesheet = readFileSync(new URL('../src/components.css', import.meta.url), 'utf8');
    const rule = (selector: string): string => {
      const start = stylesheet.indexOf(`${selector} {`);
      if (start < 0) throw new Error(`components.css has no rule for ${selector}`);
      return stylesheet.slice(start, stylesheet.indexOf('}', start));
    };
    const zIndex = (selector: string): number =>
      Number(/z-index:\s*(\d+)/u.exec(rule(selector))?.[1]);
    expect(rule('.confirm-root')).toContain('position: fixed');
    expect(rule('.confirm-root')).toContain('inset: 0');
    expect(zIndex('.confirm-root')).toBeGreaterThan(zIndex('.detail-drawer'));
    // 窄屏（390）下对话框不超出视口。
    expect(rule('.confirm-dialog')).toContain('calc(100vw - 32px)');
  });
});
