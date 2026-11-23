import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { DetailDrawer } from '../src/detail-drawer';
import { TestEvent, TestNode } from './dom';
import { asElement, flush, mount, mountDom } from './render';

const focusables = (host: ReturnType<typeof mountDom>): readonly string[] =>
  host.container.querySelectorAll('[role="dialog"] button').map((node) => node.textContent);

// 真实浏览器的 querySelectorAll 返回 NodeList：可迭代、有 length/下标，但没有数组方法。
// mini-DOM 返回数组，会把「把 NodeList 当数组用」的缺陷藏在单测背后——这里还原真实语义。
const asNodeList = (nodes: readonly TestNode[]): TestNode[] => {
  const list = {
    length: nodes.length,
    item: (index: number): TestNode | null => nodes[index] ?? null,
    *[Symbol.iterator](): IterableIterator<TestNode> {
      yield* nodes;
    },
  };
  nodes.forEach((node, index) => {
    Object.defineProperty(list, index, { value: node, enumerable: true });
  });
  return list as unknown as TestNode[];
};

describe('DetailDrawer（主从/抽屉）', () => {
  it('stays unmounted while closed and renders a labelled modal dialog when open', async () => {
    const host = mountDom();
    const open = signal(false);
    const App = () =>
      open.value ? (
        <DetailDrawer title="用户详情" onClose={() => undefined}>
          内容
        </DetailDrawer>
      ) : null;
    mount(<App />, host);
    expect(host.container.querySelector('[role="dialog"]')).toBeNull();
    open.value = true;
    await flush();
    const dialog = asElement(host.container.querySelector('[role="dialog"]'));
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
    expect(asElement(host.container.querySelector(`[id="${labelledBy}"]`)).textContent).toBe(
      '用户详情',
    );
  });

  it('requests close on Escape', () => {
    const host = mountDom();
    const closed: string[] = [];
    mount(
      <DetailDrawer title="用户详情" onClose={() => closed.push('esc')}>
        <button type="button">保存</button>
      </DetailDrawer>,
      host,
    );
    asElement(host.container.querySelector('[role="dialog"] button')).dispatchEvent(
      new TestEvent('keydown', { key: 'Escape' }),
    );
    expect(closed).toEqual(['esc']);
  });

  it('moves initial focus into the dialog and restores it on close', async () => {
    const host = mountDom();
    const outside = host.document.createElement('button');
    outside.textContent = '外部触发';
    host.container.appendChild(outside);
    outside.focus();
    expect(host.document.activeElement).toBe(outside);
    const open = signal(false);
    const App = () =>
      open.value ? (
        <DetailDrawer title="用户详情" onClose={() => undefined}>
          <button type="button">首个可聚焦</button>
        </DetailDrawer>
      ) : null;
    mount(<App />, host);
    open.value = true;
    await flush();
    const firstButton = asElement(host.container.querySelector('[role="dialog"] button'));
    expect(host.document.activeElement).toBe(firstButton);
    open.value = false;
    await flush();
    expect(host.document.activeElement).toBe(outside);
    expect(focusables(host)).toEqual([]);
  });

  it('traps Tab focus inside the dialog（正反向环绕）', () => {
    const host = mountDom();
    mount(
      <DetailDrawer title="用户详情" onClose={() => undefined}>
        <button type="button">甲</button>
        <button type="button">乙</button>
        <button type="button">丙</button>
      </DetailDrawer>,
      host,
    );
    const buttons = host.container.querySelectorAll('[role="dialog"] button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    last?.focus();
    last?.dispatchEvent(new TestEvent('keydown', { key: 'Tab' }));
    expect(host.document.activeElement).toBe(first);
    first?.dispatchEvent(new TestEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(host.document.activeElement).toBe(last);
  });

  it('renders footer actions in a designated footer region', () => {
    const host = mountDom();
    mount(
      <DetailDrawer
        title="用户详情"
        onClose={() => undefined}
        footer={<button type="button">保存授权</button>}
      >
        内容
      </DetailDrawer>,
      host,
    );
    const footer = asElement(host.container.querySelector('.drawer-footer'));
    expect(footer.querySelector('button')?.textContent).toBe('保存授权');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps focus management when querySelectorAll returns a NodeList（真浏览器语义回归）', async () => {
    const queryAll = Reflect.get(TestNode.prototype, 'querySelectorAll');
    vi.spyOn(TestNode.prototype, 'querySelectorAll').mockImplementation(function (
      this: TestNode,
      selector: string,
    ) {
      return asNodeList(queryAll.call(this, selector));
    });
    const host = mountDom();
    const outside = host.document.createElement('button');
    host.container.appendChild(outside);
    outside.focus();
    const open = signal(false);
    const App = () =>
      open.value ? (
        <DetailDrawer title="用户详情" onClose={() => undefined}>
          <button type="button">首个可聚焦</button>
          <button type="button">末个可聚焦</button>
        </DetailDrawer>
      ) : null;
    mount(<App />, host);
    open.value = true;
    await flush();
    const closeButton = asElement(host.container.querySelector('[role="dialog"] .drawer-close'));
    // 用例自身的查询同样拿到 NodeList 形状——必须 Array.from，不能当数组用。
    const bodyButtons = Array.from(
      host.container.querySelectorAll('[role="dialog"] .drawer-body button'),
    ).map((node) => asElement(node));
    const first = bodyButtons[0];
    const last = bodyButtons[bodyButtons.length - 1];
    // 初焦进入：落在对话框内首个可聚焦元素（关闭按钮）。
    expect(host.document.activeElement).toBe(closeButton);
    expect(first?.textContent).toBe('首个可聚焦');
    expect(last?.textContent).toBe('末个可聚焦');
    // Tab 环绕：末个正向环绕回首个；首项反向环绕到末个。
    last?.focus();
    last?.dispatchEvent(new TestEvent('keydown', { key: 'Tab' }));
    expect(host.document.activeElement).toBe(closeButton);
    closeButton.dispatchEvent(new TestEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(host.document.activeElement).toBe(last);
    // 关闭还焦。
    open.value = false;
    await flush();
    expect(host.document.activeElement).toBe(outside);
  });
});
