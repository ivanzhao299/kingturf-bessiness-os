import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals';
import { TreeSelect, type TreeSelectNode } from '../src/tree-select';
import { TestEvent, type TestElement } from './dom';
import { asElement, flush, mount, mountDom } from './render';

const tree: readonly TreeSelectNode[] = [
  {
    id: 'hq',
    label: '金特夫总部',
    children: [
      { id: 'sales', label: '销售部', children: [{ id: 'sales-1', label: '国际销售组' }] },
      { id: 'ops', label: '运营部', children: [] },
    ],
  },
];

const trigger = (host: ReturnType<typeof mountDom>) =>
  asElement(host.container.querySelector('.tree-select-trigger'));

const listbox = (host: ReturnType<typeof mountDom>) =>
  host.container.querySelector('[role="listbox"]');

const option = (host: ReturnType<typeof mountDom>, id: string): TestElement | null =>
  host.container.querySelector(`[role="option"][data-id="${id}"]`) as TestElement | null;

describe('TreeSelect（组织树）', () => {
  it('starts collapsed with the trigger announcing the combobox semantics', () => {
    const host = mountDom();
    mount(<TreeSelect label="所属组织" tree={tree} />, host);
    const button = trigger(host);
    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(listbox(host)).toBeNull();
  });

  it('opens on click exposing nested options with level and selected state', async () => {
    const host = mountDom();
    mount(<TreeSelect label="所属组织" tree={tree} value="sales" />, host);
    trigger(host).click();
    await Promise.resolve();
    expect(trigger(host).getAttribute('aria-expanded')).toBe('true');
    const root = option(host, 'hq');
    const child = option(host, 'sales');
    const leaf = option(host, 'sales-1');
    expect(root?.getAttribute('aria-level')).toBe('1');
    expect(child?.getAttribute('aria-level')).toBe('2');
    expect(leaf?.getAttribute('aria-level')).toBe('3');
    expect(child?.getAttribute('aria-selected')).toBe('true');
    expect(root?.getAttribute('aria-selected')).toBe('false');
  });

  it('selects an option, closes the list and reports the new value', async () => {
    const host = mountDom();
    const picked: string[] = [];
    const value = signal<string | undefined>(undefined);
    const App = () => (
      <TreeSelect
        label="所属组织"
        tree={tree}
        {...(value.value !== undefined ? { value: value.value } : {})}
        onSelect={(id) => {
          picked.push(id);
          value.value = id;
        }}
      />
    );
    mount(<App />, host);
    trigger(host).click();
    await flush();
    asElement(option(host, 'ops')).click();
    await flush();
    expect(picked).toEqual(['ops']);
    expect(trigger(host).getAttribute('aria-expanded')).toBe('false');
    expect(trigger(host).textContent).toContain('运营部');
  });

  it('closes on Escape without changing the selection', async () => {
    const host = mountDom();
    const picked: string[] = [];
    mount(
      <TreeSelect label="所属组织" tree={tree} value="hq" onSelect={(id) => picked.push(id)} />,
      host,
    );
    trigger(host).click();
    await Promise.resolve();
    trigger(host).dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    expect(picked).toEqual([]);
    expect(trigger(host).getAttribute('aria-expanded')).toBe('false');
    expect(trigger(host).textContent).toContain('金特夫总部');
  });

  it('moves the active option with arrow keys and commits it with Enter', async () => {
    const host = mountDom();
    const picked: string[] = [];
    mount(<TreeSelect label="所属组织" tree={tree} onSelect={(id) => picked.push(id)} />, host);
    trigger(host).click();
    await flush();
    const list = asElement(listbox(host));
    list.dispatchEvent(new TestEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    const activeId = (list.getAttribute('aria-activedescendant') ?? '').replace('tree-option-', '');
    expect(['hq', 'sales', 'sales-1', 'ops']).toContain(activeId);
    list.dispatchEvent(new TestEvent('keydown', { key: 'Enter' }));
    await flush();
    expect(picked).toEqual([activeId]);
    expect(trigger(host).getAttribute('aria-expanded')).toBe('false');
  });
});
