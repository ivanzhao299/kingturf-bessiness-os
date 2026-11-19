import { render, type ComponentChild, type VNode } from 'preact';
import { createTestDom, type TestDocument, type TestElement, type TestNode } from './dom';

export const flush = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

export type Mounted = Readonly<{
  document: TestDocument;
  container: TestElement;
}>;

export const mountDom = (): Mounted => {
  const { document } = createTestDom();
  return { document, container: document.createElement('div') };
};

export const mount = (vnode: ComponentChild | VNode, host: Mounted): void => {
  render(vnode as ComponentChild, host.container);
};

export const asElement = (node: TestNode | null): TestElement => {
  if (node?.nodeType !== 1) throw new Error('expected an element node');
  return node as TestElement;
};
