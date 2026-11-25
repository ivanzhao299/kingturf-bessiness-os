import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SummaryCards } from '../src/summary-cards';
import type { TestNode } from './dom';
import { asElement, mount, type Mounted, mountDom } from './render';

const group = (host: Mounted) => asElement(host.container.querySelector('.stat-cards'));
const cards = (host: Mounted): readonly TestNode[] => group(host).querySelectorAll('.stat-card');
// 仓库开着 noUncheckedIndexedAccess：按下标取值可能为 undefined，统一经这里转成元素。
const card = (host: Mounted, index: number) => asElement(cards(host)[index] ?? null);
const textOf = (node: TestNode): string => node.textContent.trim();
const noop = (): void => undefined;

describe('SummaryCards（汇总卡）', () => {
  it('renders a labelled group; every card shows its label, value and hint', () => {
    const host = mountDom();
    mount(
      <SummaryCards
        label="工单状态汇总"
        items={[
          { id: 'open', label: '待开工', value: '3', hint: '今日到期 1' },
          { id: 'done', label: '已完工', value: '12' },
        ]}
      />,
      host,
    );
    expect(group(host).getAttribute('role')).toBe('group');
    expect(group(host).getAttribute('aria-label')).toBe('工单状态汇总');
    expect(cards(host)).toHaveLength(2);
    const open = card(host, 0);
    const done = card(host, 1);
    expect(textOf(asElement(open.querySelector('.stat-card-label') ?? null))).toBe('待开工');
    expect(textOf(asElement(open.querySelector('.stat-card-value') ?? null))).toBe('3');
    expect(textOf(asElement(open.querySelector('.stat-card-hint') ?? null))).toBe('今日到期 1');
    // 没有说明就不渲染说明节点，不留空行。
    expect(done.querySelector('.stat-card-hint')).toBeNull();
  });

  it('a card without an action is a plain block, not a button or a link', () => {
    const host = mountDom();
    mount(<SummaryCards label="概览" items={[{ id: 'a', label: '物料', value: '4' }]} />, host);
    expect(card(host, 0).nodeName.toLowerCase()).toBe('div');
  });

  it('a filter card is a button that reports its pressed state and calls onSelect', () => {
    const host = mountDom();
    const onSelect = vi.fn();
    mount(
      <SummaryCards
        label="状态筛选"
        items={[
          { id: 'open', label: '待开工', value: '3', active: true, onSelect },
          { id: 'done', label: '已完工', value: '12', onSelect: noop },
        ]}
      />,
      host,
    );
    const open = card(host, 0);
    const done = card(host, 1);
    expect(open.nodeName.toLowerCase()).toBe('button');
    expect(open.getAttribute('type')).toBe('button');
    expect(open.getAttribute('aria-pressed')).toBe('true');
    expect(done.getAttribute('aria-pressed')).toBe('false');
    open.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('a link card is an anchor; a link wins over a filter action', () => {
    const host = mountDom();
    const onSelect = vi.fn();
    mount(
      <SummaryCards
        label="制造概览"
        items={[
          { id: 'items', label: '物料', value: '4', href: '#/manufacturing/items', onSelect },
          { id: 'boms', label: 'BOM', value: '1', href: '#/manufacturing/boms' },
        ]}
      />,
      host,
    );
    const items = card(host, 0);
    const boms = card(host, 1);
    expect(items.nodeName.toLowerCase()).toBe('a');
    expect(items.getAttribute('href')).toBe('#/manufacturing/items');
    expect(boms.nodeName.toLowerCase()).toBe('a');
    items.click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('carries the tone on the card, neutral by default', () => {
    const host = mountDom();
    mount(
      <SummaryCards
        label="应收"
        items={[
          { id: 'due', label: '应收余额', value: '12,000.00' },
          { id: 'late', label: '已逾期', value: '3,400.00', tone: 'danger' },
        ]}
      />,
      host,
    );
    expect(cards(host).map((card) => asElement(card).getAttribute('data-tone'))).toEqual([
      'neutral',
      'danger',
    ]);
  });

  it('derives a test id per card from the group id, or takes one from the caller', () => {
    const host = mountDom();
    mount(
      <SummaryCards
        label="概览"
        testId="manufacturing-summary"
        items={[{ id: 'items', label: '物料', value: '4' }]}
      />,
      host,
    );
    expect(group(host).getAttribute('data-testid')).toBe('manufacturing-summary');
    expect(card(host, 0).getAttribute('data-testid')).toBe('manufacturing-summary-items');
    // 渲染进同一个容器会替换前一棵树，所以第二种写法用自己的容器。
    const other = mountDom();
    mount(
      <SummaryCards
        label="概览"
        itemTestId={(id) => `kt-wo-summary-${id}`}
        items={[{ id: 'total', label: '全部', value: '9' }]}
      />,
      other,
    );
    expect(card(other, 0).getAttribute('data-testid')).toBe('kt-wo-summary-total');
  });

  it('styles the three card kinds alike and colours only the value by tone', () => {
    const sheet = readFileSync(new URL('../src/components.css', import.meta.url), 'utf8');
    // 同一规则的选择器可能合写成一组（后面跟逗号），所以每个选择器后面是「{」或「,」都算数。
    for (const selector of [
      '.stat-cards',
      '.stat-card',
      '.stat-card-label',
      '.stat-card-value',
      '.stat-card-hint',
      ".stat-card[aria-pressed='true']",
      '.stat-card[href]:focus-visible',
      ".stat-card[data-tone='danger'] .stat-card-value",
    ])
      expect(sheet, selector).toMatch(
        new RegExp(`${selector.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*[{,]`),
      );
    // 字号只用令牌，不写死像素。
    const block = sheet.slice(sheet.indexOf('/* ===== SummaryCards ====='));
    expect(block).not.toMatch(/font-size:\s*\d+px/u);
    for (const tone of ['info', 'success', 'warning', 'danger'])
      expect(sheet).toMatch(new RegExp(`\\.stat-card\\[data-tone='${tone}'\\] \\.stat-card-value`));
  });
});
