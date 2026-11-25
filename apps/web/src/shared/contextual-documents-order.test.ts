// TD-UI-010：「业务文件 / 常用模板」面板此前排在业务工作区之前，整块占住各模板路由的首屏（制造概览实测
// 面板 top=274px、高 514px，工作区从 y≈813 起）。外壳建好之后商业与治理工作区是随后追加进内容区的，
// 所以在它们都挂上之后把面板挪到内容区末尾；页内「本页导航」按 DOM 序生成，顺序随之变成
// 「工作区在前、业务文件在后」。
import { describe, expect, it } from 'vitest';
import { el } from '../dom';
import {
  installGlobalTestDom,
  type TestElement,
  type TestNode,
} from '../../test/fixtures/preact-dom';
import { keepDocumentsLast } from './contextual-documents';
import { installRouteSectionNavigation } from './route-sections';

const flush = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** 同 createCrmShell + mountWorkspace 的装配顺序：页头 → 业务文件面板（外壳里就有）→ 工作区（随后追加）。 */
const shell = () => {
  const content = el('section', 'workspace');
  const header = el('header', 'route-context-header');
  header.setAttribute('data-route-context', 'true');
  const documents = el('section', 'panel contextual-documents');
  documents.setAttribute('data-route-view', 'procurement');
  documents.append(el('h2', '', '采购管理常用模板'));
  const work = el('section', 'procurement-workbench');
  work.setAttribute('data-route-view', 'procurement');
  work.append(el('h2', '', '供应商、采购与批次库存'));
  const root = el('div', 'app-shell');
  content.append(header, documents);
  root.append(content);
  // 测试 DOM double 没有 parentElement；本页导航靠它插到页头之后。真实浏览器里页头是内容区的直接子节点。
  Object.defineProperty(header, 'parentElement', { get: () => content });
  return { root, content, documents, work };
};

const asElement = (node: TestNode): TestElement => node as TestElement;

const orderOf = (content: HTMLElement): readonly string[] =>
  (content as unknown as TestElement).children.map((child) => asElement(child).className);

const navLinks = (root: HTMLElement, route: string): readonly string[] =>
  (root as unknown as TestElement)
    .querySelectorAll('.route-section-nav')
    .map(asElement)
    .filter((nav) => nav.getAttribute('data-route-view') === route)
    .flatMap((nav) => nav.querySelectorAll('.route-section-link').map(asElement))
    .map((link) => link.textContent.trim());

describe('业务文件面板排在工作区之后（TD-UI-010）', () => {
  it('把面板挪到内容区末尾：是同一个节点（不重建），class 与 data-route-view 不变', () => {
    installGlobalTestDom();
    const { root, content, documents, work } = shell();
    // 追加工作区之后、还没调整：面板在工作区之前（修复前的顺序）。
    content.append(work);
    expect(orderOf(content)).toEqual([
      'route-context-header',
      'panel contextual-documents',
      'procurement-workbench',
    ]);
    expect(keepDocumentsLast(root)).toBe(root);
    expect(orderOf(content)).toEqual([
      'route-context-header',
      'procurement-workbench',
      'panel contextual-documents',
    ]);
    expect((content as unknown as TestElement).children[2]).toBe(documents);
    expect(documents.className).toBe('panel contextual-documents');
    expect(documents.getAttribute('data-route-view')).toBe('procurement');
  });

  it('治理等工作区也在面板之前：最后挂上的工作区同样排在面板前面', () => {
    installGlobalTestDom();
    const { root, content, work } = shell();
    content.append(work);
    keepDocumentsLast(root);
    const governance = el('section', 'governance-workspace');
    content.append(governance);
    keepDocumentsLast(root);
    expect(orderOf(content)).toEqual([
      'route-context-header',
      'procurement-workbench',
      'governance-workspace',
      'panel contextual-documents',
    ]);
  });

  it('页内「本页导航」按 DOM 序生成：工作区在前、业务文件在后（调整前是反的，作为对照）', async () => {
    installGlobalTestDom();
    const before = shell();
    before.content.append(before.work);
    installRouteSectionNavigation(before.root);
    await flush();
    expect(navLinks(before.root, 'procurement')).toEqual([
      '采购管理常用模板',
      '供应商、采购与批次库存',
    ]);

    installGlobalTestDom();
    const after = shell();
    after.content.append(after.work);
    keepDocumentsLast(after.root);
    installRouteSectionNavigation(after.root);
    await flush();
    expect(navLinks(after.root, 'procurement')).toEqual([
      '供应商、采购与批次库存',
      '采购管理常用模板',
    ]);
  });

  it('内容区不存在或没有面板时什么也不做', () => {
    installGlobalTestDom();
    const bare = el('div', 'app-shell');
    expect(keepDocumentsLast(bare)).toBe(bare);
    const content = el('section', 'workspace');
    const work = el('section', 'procurement-workbench');
    content.append(work);
    bare.append(content);
    keepDocumentsLast(bare);
    expect(orderOf(content)).toEqual(['procurement-workbench']);
  });
});
