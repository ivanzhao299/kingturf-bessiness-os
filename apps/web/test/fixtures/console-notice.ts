// 测试夹具：写操作成功后的状态行（TD-WF-014①）。页面上同一时刻最多一条：详情抽屉开着时在抽屉底部的
// footer 里，否则在页头下方。这里取它的文字与位置。
import type { TestElement } from './preact-dom';

export type ShownNotice = Readonly<{ text: string; inDrawer: boolean }>;

const NONE: ShownNotice = { text: '', inDrawer: false };

export const noticeOf = (host: TestElement): ShownNotice => {
  const nodes = host.querySelectorAll('[data-testid="console-notice"]');
  if (nodes.length === 0) return NONE;
  if (nodes.length > 1)
    throw new Error(`expected at most one notice, found ${String(nodes.length)}`);
  const node = nodes[0] as TestElement;
  const drawer = host.querySelector('.detail-drawer') as TestElement | null;
  return {
    text: node.textContent.trim(),
    inDrawer: drawer?.contains(node) === true,
  };
};
