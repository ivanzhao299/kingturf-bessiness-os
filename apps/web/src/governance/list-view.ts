import { el } from '../dom';
import type { GovernanceController } from './controller';
import { governancePage, governanceTable } from './presentation';

// B2（TD-WEB-013）：治理列表视图——表头 + 「已加载 N 条」+ 继续加载（cursor 分页）。
// 数据值兼容裸数组（测试夹具）与 {items,nextCursor} 分页对象。
export function createGovernanceListView(
  controller: GovernanceController,
  path: string,
  value: unknown,
): HTMLElement {
  const container = el('div', 'governance-list-view');
  const loadMoreButton = (): HTMLElement => {
    const more = el('button', 'secondary compact', '继续加载');
    more.type = 'button';
    more.addEventListener('click', () => {
      more.disabled = true;
      more.textContent = '加载中…';
      void controller.loadMore(path).then(() => {
        const view = controller.views.find((item) => item.path === path);
        value = view?.value ?? value;
        render();
      });
    });
    return more;
  };
  const render = () => {
    const page = governancePage(value);
    container.replaceChildren(governanceTable(page.items, { preview: false }));
    const footer = el('div', 'governance-list-footer');
    footer.append(el('span', 'table-footnote', `已加载 ${String(page.items.length)} 条记录`));
    if (page.nextCursor !== null) footer.append(loadMoreButton());
    container.append(footer);
  };
  render();
  return container;
}
