/** A deliberately small DOM test double, not a browser or native validation engine. */
export class BehaviorElement {
  public className = '';
  public readonly attributes = new Map<string, string>();
  public readonly dataset: Record<string, string> = {};
  public children: BehaviorElement[] = [];
  public parentElement: BehaviorElement | null = null;
  public disabled = false;
  public hidden = false;
  public value = '';
  public type = '';
  public checked = false;
  public required = false;
  public placeholder = '';
  public href = '';
  public download = '';
  public accept = '';
  public tabIndex = 0;
  public files: readonly File[] | null = null;
  public open = false;
  public focusCalls = 0;
  public reportValidityCalls = 0;
  public validity = true;
  public clickCalls = 0;
  private text = '';
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();
  public readonly classList = {
    add: (...tokens: string[]): void => {
      this.checkTokens(tokens);
      this.className = [...new Set([...this.tokens(), ...tokens])].join(' ');
    },
    remove: (...tokens: string[]): void => {
      this.checkTokens(tokens);
      this.className = this.tokens()
        .filter((token) => !tokens.includes(token))
        .join(' ');
    },
    contains: (token: string): boolean => this.tokens().includes(token),
  };
  public constructor(public readonly tagName: string) {}
  private tokens(): string[] {
    return this.className.split(/\s+/u).filter(Boolean);
  }
  private checkTokens(tokens: readonly string[]): void {
    if (tokens.some((token) => !token || /\s/u.test(token)))
      throw new DOMException('Invalid class token', 'SyntaxError');
  }
  public set textContent(value: string) {
    this.detachChildren();
    this.text = value;
  }
  public get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join('');
  }
  public get childElementCount(): number {
    return this.children.length;
  }
  private detachChildren(): void {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
  }
  public append(...children: BehaviorElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
      if (this.tagName === 'SELECT' && this.children.length === 1) this.value = child.value;
    }
  }
  public replaceChildren(...children: BehaviorElement[]): void {
    this.detachChildren();
    this.text = '';
    this.append(...children);
  }
  public remove(): void {
    if (this.parentElement)
      this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
  }
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'required') this.required = true;
    if (name === 'disabled') this.disabled = true;
    if (name === 'class') this.className = value;
  }
  public getAttribute(name: string): string | null {
    return name === 'class' ? this.className : (this.attributes.get(name) ?? null);
  }
  public removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'required') this.required = false;
    if (name === 'disabled') this.disabled = false;
  }
  public addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  public dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return !event.defaultPrevented;
  }
  public click(): void {
    if (this.disabled) return;
    this.clickCalls++;
    this.dispatchEvent(new Event('click', { cancelable: true }));
  }
  public focus(): void {
    this.focusCalls++;
  }
  public get elements(): readonly BehaviorElement[] {
    return this.descendants().filter((item) =>
      ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(item.tagName),
    );
  }
  public checkValidity(): boolean {
    // Tests control native validity as an external input, never infer it from our own constraints.
    return (
      this.validity &&
      (this.tagName !== 'FORM' || this.elements.every((item) => item.checkValidity()))
    );
  }
  public reportValidity(): boolean {
    this.reportValidityCalls++;
    return this.checkValidity();
  }
  public showModal(): void {
    this.open = true;
  }
  public close(): void {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  }
  public descendants(): BehaviorElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  public querySelectorAll(selector: string): BehaviorElement[] {
    if (!/^(?:[a-z]+|\.[a-z-]+)$/iu.test(selector)) throw new Error('Unsupported test selector');
    return this.descendants().filter((item) =>
      selector.startsWith('.')
        ? item.classList.contains(selector.slice(1))
        : item.tagName === selector.toUpperCase(),
    );
  }
  public querySelector(selector: string): BehaviorElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export class BehaviorInput extends BehaviorElement {}
export class BehaviorSelect extends BehaviorElement {}
export class BehaviorTextarea extends BehaviorElement {}

export function createBehaviorElement(tag: string): BehaviorElement {
  const name = tag.toUpperCase();
  if (name === 'INPUT') return new BehaviorInput(name);
  if (name === 'SELECT') return new BehaviorSelect(name);
  if (name === 'TEXTAREA') return new BehaviorTextarea(name);
  return new BehaviorElement(name);
}

/** The sole bridge from the explicit partial test double to DOM-facing component signatures. */
export const htmlElement = (element: BehaviorElement): HTMLElement =>
  element as unknown as HTMLElement;
export const findElement = (
  root: BehaviorElement,
  predicate: (element: BehaviorElement) => boolean,
): BehaviorElement => {
  const found = root.descendants().find(predicate);
  if (!found) throw new Error('Expected rendered element missing');
  return found;
};
export const flushBehaviorPromises = async (): Promise<void> => {
  for (let count = 0; count < 5; count++) await Promise.resolve();
};
