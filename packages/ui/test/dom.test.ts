import { describe, expect, it } from 'vitest';
import { h, render } from 'preact';
import { signal } from '@preact/signals';
import { createTestDom, type TestElement, type TestNode } from './dom';

const element = (node: TestNode | null): TestElement => {
  expect(node).not.toBeNull();
  expect(node?.nodeType).toBe(1);
  return node as TestElement;
};

describe('test dom double semantics', () => {
  it('inserts, reparents and removes nodes with sibling bookkeeping', () => {
    const { document } = createTestDom();
    const parent = document.createElement('section');
    const first = document.createElement('p');
    const second = document.createElement('p');
    const child = document.createElement('span');
    parent.append(first, second);
    first.appendChild(child);
    expect(parent.childNodes).toEqual([first, second]);
    expect(child.parentNode).toBe(first);
    expect(child.nextSibling).toBeNull();
    parent.insertBefore(child, second);
    expect(parent.childNodes).toEqual([first, child, second]);
    expect(first.childNodes).toEqual([]);
    expect(child.previousSibling).toBe(first);
    child.remove();
    expect(parent.childNodes).toEqual([first, second]);
    expect(child.parentNode).toBeNull();
  });

  it('clears children on textContent writes and keeps text nodes readable', () => {
    const { document } = createTestDom();
    const host = document.createElement('div');
    const text = document.createTextNode('hello');
    host.appendChild(text);
    expect(host.textContent).toBe('hello');
    host.textContent = 'replacement';
    expect(host.childNodes.length).toBe(1);
    expect(host.textContent).toBe('replacement');
  });

  it('bubbles events with target/currentToken tracking and honors preventDefault', () => {
    const { document } = createTestDom();
    const parent = document.createElement('div');
    const button = document.createElement('button');
    parent.appendChild(button);
    const seen: string[] = [];
    parent.addEventListener('click', (event) => {
      seen.push(`parent:${event.currentTarget === parent ? 'self' : 'other'}`);
    });
    button.addEventListener('click', (event) => {
      seen.push('button');
      event.preventDefault();
    });
    expect(button.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))).toBe(
      false,
    );
    expect(seen).toEqual(['button', 'parent:self']);
  });

  it('keeps attributes, classList tokens and dataset views consistent', () => {
    const { document } = createTestDom();
    const node = document.createElement('article');
    node.setAttribute('data-route-view', 'ui-kit');
    node.className = 'a b';
    node.classList.add('c');
    node.classList.remove('a');
    expect(node.className).toBe('b c');
    expect(node.getAttribute('data-route-view')).toBe('ui-kit');
    expect(node.dataset.routeView).toBe('ui-kit');
    node.removeAttribute('data-route-view');
    expect(node.hasAttribute('data-route-view')).toBe(false);
  });

  it('tracks activeElement through focus/blur and suppresses clicks on disabled buttons', () => {
    const { document } = createTestDom();
    const button = document.createElement('button');
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks++;
    });
    button.disabled = true;
    button.click();
    expect(clicks).toBe(0);
    button.disabled = false;
    button.focus();
    expect(document.activeElement).toBe(button);
    button.blur();
    expect(document.activeElement).toBeNull();
    button.click();
    expect(clicks).toBe(1);
  });

  it('supports the selector subset used by component tests', () => {
    const { document } = createTestDom();
    const root = document.createElement('div');
    const row = document.createElement('tr');
    row.className = 'row selected';
    row.setAttribute('data-row-id', 'r1');
    const cell = document.createElement('td');
    cell.className = 'cell';
    row.appendChild(cell);
    root.appendChild(row);
    expect(root.querySelectorAll('tr')).toEqual([row]);
    expect(root.querySelectorAll('tr.selected')).toEqual([row]);
    expect(root.querySelectorAll('[data-row-id="r1"]')).toEqual([row]);
    expect(root.querySelectorAll('td, tr')).toEqual([row, cell]);
    expect(root.querySelector('.missing')).toBeNull();
  });

  it('renders preact trees into the double and applies prop updates', async () => {
    const { document } = createTestDom();
    const count = signal(0);
    const container = document.createElement('div');
    const App = () => h('p', { class: 'counter' }, String(count.value));
    render(h(App, null), container);
    const counter = element(container.querySelector('.counter'));
    expect(counter.textContent).toBe('0');
    count.value = 7;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(counter.textContent).toBe('7');
  });

  it('wires preact event props through the double listeners', () => {
    const { document } = createTestDom();
    const container = document.createElement('div');
    const clicks: string[] = [];
    render(h('button', { class: 'go', onClick: () => clicks.push('go') }, '执行'), container);
    const button = element(container.querySelector('.go'));
    expect(button.textContent).toBe('执行');
    button.click();
    expect(clicks).toEqual(['go']);
  });
});
