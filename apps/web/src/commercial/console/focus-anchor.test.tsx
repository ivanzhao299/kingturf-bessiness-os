// TD-WF-014④（写流程冒烟 WS-P3-04）：抽屉里的行内表单一打开，触发它的按钮被移除，键盘焦点落回页面主体，
// Esc 到不了抽屉，抽屉关不掉。FocusAnchor 在焦点确实丢了的时候把它带回抽屉。
// 这里用一个带 keydown 处理器的 div 充当抽屉（与 DetailDrawer 的 Esc 处理同一事件路径），不挂真实
// DetailDrawer：它的初焦 effect 在「绘制之后」才跑，会与这里的同步断言交错。
import { describe, expect, it } from 'vitest';
import { h, render } from 'preact';
import type { ComponentChild } from 'preact';
import { signal } from '@preact/signals';
import { FormSection } from '@kingturf/ui';
import { FocusAnchor } from './focus-anchor';
import {
  installGlobalTestDom,
  TestDocument,
  TestEvent,
  type TestElement,
} from '../../../test/fixtures/preact-dom';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const active = (): TestElement | null => TestDocument.current.activeElement as TestElement | null;

/** 页面：抽屉外一个触发按钮；抽屉里是「操作按钮或行内表单」+ 关闭按钮 + 焦点锚点。 */
const mountPage = (options: Readonly<{ anchor: boolean }> = { anchor: true }) => {
  const scope = installGlobalTestDom();
  const host = scope.document.createElement('div');
  const form = signal<'none' | 'revise'>('none');
  const status = signal<'ISSUED' | 'APPROVED'>('ISSUED');
  const escape: string[] = [];
  const trigger = scope.document.createElement('button');
  trigger.textContent = '查看';
  host.appendChild(trigger);
  const App = () => {
    const children: ComponentChild[] = [
      form.value === 'none' ? (
        <div class="console-actions">
          <button
            type="button"
            data-testid="revise"
            onClick={() => {
              form.value = 'revise';
            }}
          >
            创建报价修订
          </button>
          {status.value === 'ISSUED' ? <button type="button">签发报价</button> : null}
        </div>
      ) : (
        <FormSection
          title="创建报价修订"
          fields={[{ name: 'discountPercent', label: '新整单折扣', type: 'number' }]}
          submitLabel="校验并创建修订"
          onSubmit={() => undefined}
        />
      ),
      <button type="button" class="drawer-close" data-testid="close">
        ×
      </button>,
    ];
    if (options.anchor) children.push(<FocusAnchor token={`${form.value}|${status.value}`} />);
    return (
      <div>
        <div
          class="detail-drawer"
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              escape.push('esc');
            }
          }}
        >
          {children}
        </div>
      </div>
    );
  };
  render(h(App, {}), host);
  return { host, form, status, escape, trigger };
};

describe('FocusAnchor（抽屉里的行内表单打开后焦点不掉到页面主体）', () => {
  it('抽屉刚出现时不接管焦点：焦点还在抽屉外的触发按钮上', async () => {
    const page = mountPage();
    page.trigger.focus();
    // 抽屉出现后 token 又变了一次（锚点重新挂载），但焦点在一个仍在树里的元素上：不动它。
    page.status.value = 'APPROVED';
    await flush();
    expect(active()).toBe(page.trigger);
  });

  it('行内表单一打开（触发按钮被移除）：焦点进入表单首个字段，Esc 仍能到达抽屉的键盘处理器', async () => {
    const page = mountPage();
    const revise = element(page.host.querySelector('[data-testid="revise"]'));
    revise.focus();
    revise.click();
    await flush();
    const field = element(page.host.querySelector('form.form-section input'));
    expect(page.host.querySelector('[data-testid="revise"]')).toBeNull();
    expect(active()).toBe(field);
    field.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    expect(page.escape).toEqual(['esc']);
  });

  it('行内表单提交后关闭：焦点回到抽屉的关闭按钮', async () => {
    const page = mountPage();
    element(page.host.querySelector('[data-testid="revise"]')).click();
    await flush();
    const submit = element(page.host.querySelector('form.form-section button[type="submit"]'));
    submit.focus();
    page.form.value = 'none';
    await flush();
    expect(page.host.querySelector('form.form-section')).toBeNull();
    expect(active()).toBe(element(page.host.querySelector('[data-testid="close"]')));
  });

  it('写操作改变了可用操作、原来的按钮被移除：焦点回到抽屉的关闭按钮', async () => {
    const page = mountPage();
    const issue = element(page.host.querySelectorAll('.console-actions button')[1]);
    issue.focus();
    page.status.value = 'APPROVED';
    await flush();
    expect(page.host.querySelectorAll('.console-actions button')).toHaveLength(1);
    expect(active()).toBe(element(page.host.querySelector('[data-testid="close"]')));
  });

  it('焦点仍在抽屉里一个没被移除的元素上时不抢焦点', async () => {
    const page = mountPage();
    element(page.host.querySelector('[data-testid="revise"]')).click();
    await flush();
    const close = element(page.host.querySelector('[data-testid="close"]'));
    close.focus();
    page.status.value = 'APPROVED';
    await flush();
    expect(active()).toBe(close);
  });

  // 表格行里的行级动作同理：发布后该行的「发布版本」按钮消失，焦点回到这一行的「查看」。
  it('表格行里：行级按钮被移除后焦点回到该行的首个按钮', async () => {
    const scope = installGlobalTestDom();
    const host = scope.document.createElement('div');
    const published = signal(false);
    const Row = () => (
      <tr>
        <td>
          <span class="mfg-row-actions">
            <button type="button" data-testid="open">
              查看
            </button>
            {published.value ? null : (
              <button type="button" data-testid="publish">
                发布版本
              </button>
            )}
            <FocusAnchor token={published.value ? 'PUBLISHED' : 'DRAFT'} />
          </span>
        </td>
      </tr>
    );
    render(h(Row, {}), host);
    const publish = element(host.querySelector('[data-testid="publish"]'));
    publish.focus();
    published.value = true;
    await flush();
    expect(host.querySelector('[data-testid="publish"]')).toBeNull();
    expect(active()).toBe(element(host.querySelector('[data-testid="open"]')));
  });
});

// 对照：没有锚点时就是修复前的现象——焦点停在那个已经离开抽屉的按钮上，Esc 到不了抽屉。
describe('没有 FocusAnchor 时（修复前的现象，作为对照）', () => {
  it('行内表单一打开，焦点落在被移除的按钮上，Esc 到不了抽屉', async () => {
    const page = mountPage({ anchor: false });
    const revise = element(page.host.querySelector('[data-testid="revise"]'));
    revise.focus();
    revise.click();
    await flush();
    expect(page.host.querySelector('[data-testid="revise"]')).toBeNull();
    expect(element(page.host.querySelector('.detail-drawer')).contains(revise)).toBe(false);
    expect(active()).toBe(revise);
    revise.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    expect(page.escape).toEqual([]);
  });
});
