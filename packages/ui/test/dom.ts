// 零依赖测试 DOM（ADR-0014/U1）：覆盖 preact 11 渲染所需的最小 DOM 面 + 行为测试所需的
// focus/activeElement、冒泡事件与键序事件。仅为组件行为测试服务，不模拟样式计算。
// 语义基线对齐 apps/web/test/fixtures/behavior-dom.ts 先例（显式 DOM double 边界）。

export class TestEvent extends Event {
  public readonly key: string;
  public readonly shiftKey: boolean;
  constructor(type: string, init: Readonly<{ key?: string; shiftKey?: boolean }> = {}) {
    super(type, { bubbles: true, cancelable: true });
    this.key = init.key ?? '';
    this.shiftKey = init.shiftKey ?? false;
  }
}

type Listener = (event: Event) => void;

const FOCUSABLE_TAGS = new Set(['button', 'input', 'select', 'textarea', 'a']);

const classTokens = (element: TestElement): readonly string[] =>
  element.className.split(/\s+/u).filter(Boolean);

const splitSelector = (selector: string): readonly string[] =>
  selector
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

export class TestNode {
  public readonly nodeType: number;
  public nodeName = '';
  public data = '';
  public parentNode: TestNode | null = null;
  public readonly childNodes: TestNode[] = [];
  protected readonly listeners = new Map<string, Set<Listener>>();

  constructor(nodeType: number) {
    this.nodeType = nodeType;
  }

  public get firstChild(): TestNode | null {
    return this.childNodes[0] ?? null;
  }

  public get lastChild(): TestNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  public get children(): TestNode[] {
    return this.childNodes.filter((child) => child.nodeType === 1);
  }

  public get textContent(): string {
    if (this.nodeType === 3 || this.nodeType === 8) return this.data;
    return this.childNodes.map((child) => child.textContent).join('');
  }

  public set textContent(value: string) {
    for (const child of [...this.childNodes]) this.removeChild(child);
    if (value !== '') this.appendReplacementText(value);
  }

  public get nextSibling(): TestNode | null {
    return this.sibling(1);
  }

  public get previousSibling(): TestNode | null {
    return this.sibling(-1);
  }

  private sibling(offset: number): TestNode | null {
    const parent = this.parentNode;
    if (!parent) return null;
    const index = parent.childNodes.indexOf(this);
    return parent.childNodes[index + offset] ?? null;
  }

  public appendChild(child: TestNode): TestNode {
    return this.insertBefore(child, null);
  }

  public append(...nodes: readonly TestNode[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  public insertBefore(child: TestNode, reference: TestNode | null): TestNode {
    if (child === this) throw new Error('cannot insert a node into itself');
    child.parentNode?.removeChild(child);
    const index = reference ? this.childNodes.indexOf(reference) : -1;
    if (index === -1) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }

  public removeChild(child: TestNode): TestNode {
    const index = this.childNodes.indexOf(child);
    if (index === -1) throw new Error('node is not a child');
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  public remove(): void {
    this.parentNode?.removeChild(this);
  }

  public contains(node: TestNode | null): boolean {
    for (let current: TestNode | null = node; current; current = current.parentNode)
      if (current === this) return true;
    return false;
  }

  public addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  public removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  // 自底向上的事件路径：目标在前、祖先随后（冒泡序；递归构造避免 this 别名）。
  private static readonly pathFrom = (node: TestNode): readonly TestNode[] => {
    const parent = node.parentNode;
    return parent === null ? [node] : [node, ...TestNode.pathFrom(parent)];
  };

  public dispatchEvent(event: Event): boolean {
    if (event.target === null)
      Object.defineProperty(event, 'target', { value: this, configurable: true });
    for (const node of TestNode.pathFrom(this)) {
      Object.defineProperty(event, 'currentTarget', { value: node, configurable: true });
      for (const listener of [...(node.listeners.get(event.type) ?? [])])
        listener.call(node, event);
    }
    return !event.defaultPrevented;
  }

  public querySelector(selector: string): TestNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  public querySelectorAll(selector: string): TestNode[] {
    const matched = new Set<TestNode>();
    for (const simple of splitSelector(selector)) collectMatches(this, simple, matched);
    // 逗号选择器按文档序返回（与真实 querySelectorAll 一致）。
    const ordered: TestNode[] = [];
    const visit = (node: TestNode): void => {
      if (matched.has(node)) ordered.push(node);
      for (const child of node.childNodes) visit(child);
    };
    visit(this);
    return ordered;
  }

  // 文本节点忽略焦点/点击；元素子类实现真实语义（activeElement/禁用守卫）。
  public focus(): void {
    void 0;
  }

  public blur(): void {
    void 0;
  }

  public click(): void {
    this.dispatchEvent(new TestEvent('click'));
  }

  protected appendReplacementText(value: string): void {
    this.appendChild(TestDocument.current.createTextNode(value));
  }
}

const collectMatches = (root: TestNode, simple: string, out: Set<TestNode>): void => {
  for (const child of root.childNodes) {
    if (isTestElement(child) && matchesSelector(child, simple)) out.add(child);
    collectMatches(child, simple, out);
  }
};

const matchesCompound = (node: TestElement, compound: string): boolean => {
  const tokens = compound.split(/(?=[.[])/u);
  let tag = '';
  const classes: string[] = [];
  const attrs: { name: string; value?: string }[] = [];
  for (const token of tokens) {
    if (token.startsWith('.')) classes.push(token.slice(1));
    else if (token.startsWith('[')) {
      const match = /^\[([^\]=~|^$*]+)(?:="([^"]*)")?\]$/u.exec(token);
      if (!match) throw new Error(`unsupported selector: ${compound}`);
      attrs.push(
        match[2] === undefined
          ? { name: match[1] ?? '' }
          : { name: match[1] ?? '', value: match[2] },
      );
    } else tag = token.toLowerCase();
  }
  if (tag !== '' && node.tagName !== tag) return false;
  for (const cls of classes) if (!node.classList.contains(cls)) return false;
  for (const attr of attrs) {
    const value = node.getAttribute(attr.name);
    if (value === null) return false;
    if (attr.value !== undefined && value !== attr.value) return false;
  }
  return true;
};

// 后代组合器（空格）右到左匹配：node 命中最后一个复合项，前缀由祖先链按序命中。
const ancestorsMatchCompounds = (node: TestNode, compounds: readonly string[]): boolean => {
  if (compounds.length === 0) return true;
  const rest = compounds.slice(0, -1);
  const last = compounds[compounds.length - 1] ?? '';
  for (let ancestor: TestNode | null = node.parentNode; ancestor; ancestor = ancestor.parentNode) {
    if (
      isTestElement(ancestor) &&
      matchesCompound(ancestor, last) &&
      ancestorsMatchCompounds(ancestor, rest)
    )
      return true;
  }
  return false;
};

const matchesSelector = (node: TestElement, simple: string): boolean => {
  const compounds = simple.split(/\s+/u).filter((part) => part !== '');
  if (compounds.length === 0) return false;
  const last = compounds[compounds.length - 1] ?? '';
  if (!matchesCompound(node, last)) return false;
  return ancestorsMatchCompounds(node, compounds.slice(0, -1));
};

export class TestElement extends TestNode {
  public tagName: string;
  public readonly attributes: { name: string; value: string }[] = [];
  public readonly expando = new Map<string, unknown>();
  public readonly classList = {
    add: (...tokens: string[]): void => {
      const set = new Set(classTokens(this));
      for (const token of tokens) set.add(token);
      this.className = [...set].join(' ');
    },
    remove: (...tokens: string[]): void => {
      const set = new Set(classTokens(this));
      for (const token of tokens) set.delete(token);
      this.className = [...set].join(' ');
    },
    contains: (token: string): boolean => classTokens(this).includes(token),
    toggle: (token: string): void => {
      if (this.classList.contains(token)) this.classList.remove(token);
      else this.classList.add(token);
    },
  };
  public readonly style: { cssText: string; setProperty: () => void } = {
    cssText: '',
    setProperty: () => undefined,
  };

  constructor(tag: string) {
    super(1);
    this.tagName = tag.toLowerCase();
    this.nodeName = this.tagName.toUpperCase();
  }

  public get className(): string {
    return this.getAttribute('class') ?? '';
  }

  public set className(value: string) {
    this.setAttribute('class', value);
  }

  public setAttribute(name: string, value: string | number | boolean): void {
    const coerced = String(value);
    const existing = this.attributes.find((attr) => attr.name === name);
    if (existing) {
      existing.value = coerced;
      return;
    }
    this.attributes.push({ name, value: coerced });
  }

  public getAttribute(name: string): string | null {
    return this.attributes.find((attr) => attr.name === name)?.value ?? null;
  }

  public removeAttribute(name: string): void {
    const index = this.attributes.findIndex((attr) => attr.name === name);
    if (index !== -1) this.attributes.splice(index, 1);
  }

  public hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  public get htmlFor(): string {
    return this.getAttribute('for') ?? '';
  }

  public set htmlFor(value: string) {
    this.setAttribute('for', value);
  }

  public get id(): string {
    return this.getAttribute('id') ?? '';
  }

  public set id(value: string) {
    this.setAttribute('id', value);
  }

  public get disabled(): boolean {
    return this.expando.get('disabled') === true;
  }

  public set disabled(value: boolean) {
    this.expando.set('disabled', value);
    this.reflect('disabled', value);
  }

  public get hidden(): boolean {
    return this.expando.get('hidden') === true;
  }

  public set hidden(value: boolean) {
    this.expando.set('hidden', value);
    this.reflect('hidden', value);
  }

  // 反射 IDL 属性 → 内容属性（真实浏览器对 disabled/hidden/type 反射；preact 属性赋值后选择器仍可命中）。
  private reflect(name: string, value: boolean | string): void {
    if (value === false || value === '') this.removeAttribute(name);
    else this.setAttribute(name, String(value));
  }

  private text(key: string): string {
    const raw = this.expando.get(key);
    return typeof raw === 'string' ? raw : '';
  }

  public get value(): string {
    return this.text('value');
  }

  public set value(value: string) {
    this.expando.set('value', value);
  }

  public get type(): string {
    return this.text('type');
  }

  public set type(value: string) {
    this.expando.set('type', value);
    this.reflect('type', value);
  }

  public get checked(): boolean {
    return this.expando.get('checked') === true;
  }

  public set checked(value: boolean) {
    this.expando.set('checked', value);
  }

  // 约束类属性（真实 DOM 为 IDL 属性，preact 走属性赋值而非 attribute）。
  public get minLength(): number {
    return this.numberExpando('minLength');
  }

  public set minLength(value: number) {
    this.expando.set('minLength', value);
  }

  public get maxLength(): number {
    return this.numberExpando('maxLength');
  }

  public set maxLength(value: number) {
    this.expando.set('maxLength', value);
  }

  public get min(): string {
    return this.text('min');
  }

  public set min(value: string) {
    this.expando.set('min', value);
  }

  public get max(): string {
    return this.text('max');
  }

  public set max(value: string) {
    this.expando.set('max', value);
  }

  public get step(): string {
    return this.text('step');
  }

  // 同真实 DOM：step 是 DOMString，赋数字即转成字符串（Preact 对 number 类型的 step 传数字）。
  public set step(value: string | number) {
    this.expando.set('step', String(value));
  }

  private numberExpando(key: string): number {
    const raw = this.expando.get(key);
    return typeof raw === 'number' ? raw : 0;
  }

  public get selected(): boolean {
    return this.expando.get('selected') === true;
  }

  public set selected(value: boolean) {
    this.expando.set('selected', value);
  }

  public get tabIndex(): number {
    const raw = this.expando.get('tabIndex');
    return typeof raw === 'number' ? raw : FOCUSABLE_TAGS.has(this.tagName) ? 0 : -1;
  }

  public set tabIndex(value: number) {
    this.expando.set('tabIndex', value);
  }

  public get dataset(): Readonly<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const attr of this.attributes) {
      if (!attr.name.startsWith('data-')) continue;
      const key = attr.name
        .slice(5)
        .replace(/-([a-z])/gu, (_match: string, letter: string) => letter.toUpperCase());
      out[key] = attr.value;
    }
    return out;
  }

  public override focus(): void {
    TestDocument.current.setActiveElement(this);
  }

  public override blur(): void {
    TestDocument.current.clearActiveElement(this);
  }

  public override click(): void {
    if (this.disabled) return;
    this.dispatchEvent(new TestEvent('click'));
    // 真实浏览器：submit 按钮点击会触发表单 submit 事件（preact onSubmit 依赖此语义）。
    if (this.tagName === 'button' && this.type === 'submit') {
      for (let node: TestNode | null = this.parentNode; node; node = node.parentNode) {
        if (isTestElement(node) && node.tagName === 'form') {
          node.dispatchEvent(new TestEvent('submit'));
          break;
        }
      }
    }
  }
}

export const isTestElement = (node: TestNode): node is TestElement => node.nodeType === 1;

// 文本节点需要所属 document 的工厂；测试串行执行，current 即最近安装的实例。
export class TestDocument {
  public static current: TestDocument;
  public readonly nodeType = 9 as const;
  public readonly documentElement: TestElement;
  public activeElement: TestNode | null = null;

  constructor() {
    this.documentElement = this.createElement('html');
  }

  public createElement(tag: string): TestElement {
    return new TestElement(tag);
  }

  public createElementNS(_namespace: string, tag: string): TestElement {
    return this.createElement(tag);
  }

  public createTextNode(data: string): TestNode {
    const node = new TestNode(3);
    node.nodeName = '#text';
    node.data = data;
    return node;
  }

  public createComment(data: string): TestNode {
    const node = new TestNode(8);
    node.nodeName = '#comment';
    node.data = data;
    return node;
  }

  public createDocumentFragment(): TestNode {
    const node = new TestNode(11);
    node.nodeName = '#document-fragment';
    return node;
  }

  public setActiveElement(node: TestNode): void {
    this.activeElement = node;
  }

  public clearActiveElement(node: TestNode): void {
    if (this.activeElement === node) this.activeElement = null;
  }
}

export type TestDom = Readonly<{
  document: TestDocument;
  pressKey: (node: TestNode, key: string, init?: Readonly<{ shiftKey?: boolean }>) => boolean;
}>;

export const createTestDom = (): TestDom => {
  const document = new TestDocument();
  TestDocument.current = document;
  // 每个测试的全新 DOM 必须同步接管全局（preact/组件经 globalThis.document 读取焦点与工厂），
  // 否则焦点状态会滞留在上一份文档实例上。
  const scope = globalThis as { document?: unknown; window?: { document?: unknown } };
  scope.document = document;
  if (scope.window === undefined) scope.window = { document };
  else scope.window.document = document;
  return {
    document,
    pressKey: (node, key, init) => node.dispatchEvent(new TestEvent('keydown', { key, ...init })),
  };
};

// 将测试 DOM 安装为全局（preact 经 ownerDocument||document 回落取得工厂；setup 每文件调用，
// 后续各测试经 createTestDom() 取得并接管全局的新实例）。
export const installGlobalTestDom = (): TestDom => createTestDom();
