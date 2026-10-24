import { describe, expect, it } from 'vitest';
import { createBehaviorElement } from '../test/fixtures/behavior-dom';

describe('explicit behavior DOM double boundaries', () => {
  it('reparents nodes, clears children on textContent and keeps removed subtrees intact', () => {
    const first = createBehaviorElement('section'),
      second = createBehaviorElement('section');
    const child = createBehaviorElement('p'),
      nested = createBehaviorElement('span');
    child.append(nested);
    first.append(child);
    second.append(child);
    expect(first.children).toEqual([]);
    expect(child.parentElement).toBe(second);
    second.textContent = 'replacement';
    expect(second.children).toEqual([]);
    expect(child.parentElement).toBeNull();
    expect(child.children).toEqual([nested]);
    expect(second.textContent).toBe('replacement');
    second.replaceChildren(child);
    expect(second.textContent).toBe('');
    expect(second.children).toEqual([child]);
  });

  it('models disabled native click but permits explicit dispatch and cancelable events', () => {
    const button = createBehaviorElement('button');
    let calls = 0;
    button.addEventListener('click', (event) => {
      calls++;
      event.preventDefault();
    });
    button.disabled = true;
    button.click();
    expect(calls).toBe(0);
    expect(button.dispatchEvent(new Event('click', { cancelable: true }))).toBe(false);
    expect(calls).toBe(1);
    button.disabled = false;
    button.click();
    expect(calls).toBe(2);
  });

  it('queries descendants only, maintains class tokens and rejects unsupported selectors', () => {
    const root = createBehaviorElement('article'),
      child = createBehaviorElement('article');
    root.append(child);
    child.className = 'selected';
    child.classList.add('selected', 'card');
    child.classList.remove('selected');
    expect(child.className).toBe('card');
    expect(root.querySelectorAll('article')).toEqual([child]);
    expect(root.querySelector('.card')).toBe(child);
    expect(() => root.querySelectorAll('[role=button]')).toThrow('Unsupported test selector');
    expect(() => {
      child.classList.add('two classes');
    }).toThrow();
  });

  it('treats validity as injected native input, not an invented HTML constraint evaluator', () => {
    const form = createBehaviorElement('form'),
      input = createBehaviorElement('input');
    input.setAttribute('required', '');
    form.append(input);
    expect(form.checkValidity()).toBe(true);
    input.validity = false;
    expect(form.reportValidity()).toBe(false);
    expect(form.reportValidityCalls).toBe(1);
    input.removeAttribute('required');
    expect(input.required).toBe(false);
  });
});
