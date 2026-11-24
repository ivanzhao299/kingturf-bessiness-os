import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ActionBar } from '../src/action-bar';
import { EmptyState } from '../src/empty-state';
import { PageHeader } from '../src/page-header';
import { StatusBadge } from '../src/status-badge';
import { asElement, mount, mountDom } from './render';

// StatusTone 是纯类型（无运行时值）：从源码解析联合成员，保证清单不漂移。
const toneSource = readFileSync(new URL('../src/status-badge.tsx', import.meta.url), 'utf8');
const toneUnion = /export type StatusTone = ([^;]+);/u.exec(toneSource)?.[1];
if (toneUnion === undefined) throw new Error('StatusTone union not found in status-badge.tsx');
const tones = toneUnion.split('|').map((member) => member.trim().replace(/^['"]|['"]$/gu, ''));
const stylesheet = readFileSync(new URL('../src/components.css', import.meta.url), 'utf8');
const styledTones = [...stylesheet.matchAll(/\.status-badge\[data-tone='([a-z]+)'\]/gu)].map(
  (match) => match[1],
);

describe('PageHeader', () => {
  it('renders eyebrow, title, description and action slot', () => {
    const host = mountDom();
    mount(
      <PageHeader
        eyebrow="系统管理"
        title="身份与授权"
        description="用户主列表与授权聚合"
        actions={<button type="button">开通身份</button>}
      />,
      host,
    );
    const header = asElement(host.container.querySelector('.page-header'));
    expect(header.querySelector('p.eyebrow')?.textContent).toBe('系统管理');
    expect(header.querySelector('h1')?.textContent).toBe('身份与授权');
    expect(header.querySelector('.page-header-description')?.textContent).toBe(
      '用户主列表与授权聚合',
    );
    expect(header.querySelector('.page-header-actions button')?.textContent).toBe('开通身份');
  });

  it('omits optional slots when not provided', () => {
    const host = mountDom();
    mount(<PageHeader title="审计中心" />, host);
    const header = asElement(host.container.querySelector('.page-header'));
    expect(header.querySelector('p.eyebrow')).toBeNull();
    expect(header.querySelector('.page-header-actions')).toBeNull();
    expect(header.querySelector('h1')?.textContent).toBe('审计中心');
  });
});

describe('ActionBar', () => {
  it('exposes a labelled toolbar with actions', () => {
    const host = mountDom();
    mount(
      <ActionBar label="批量操作">
        <button type="button">停用</button>
      </ActionBar>,
      host,
    );
    const bar = asElement(host.container.querySelector('[role="toolbar"]'));
    expect(bar.getAttribute('aria-label')).toBe('批量操作');
    expect(bar.querySelector('button')?.textContent).toBe('停用');
  });

  it('announces the bulk selection count when provided', () => {
    const host = mountDom();
    mount(
      <ActionBar label="批量操作" count={3}>
        <button type="button">批量停用</button>
      </ActionBar>,
      host,
    );
    const count = asElement(host.container.querySelector('[data-bulk-count]'));
    expect(count.textContent).toBe('已选 3 项');
  });
});

describe('StatusBadge', () => {
  it('renders tone as data attribute with text content', () => {
    const host = mountDom();
    mount(<StatusBadge tone="success">在职</StatusBadge>, host);
    const badge = asElement(host.container.querySelector('.status-badge'));
    expect(badge.getAttribute('data-tone')).toBe('success');
    expect(badge.textContent).toBe('在职');
  });

  it('defaults to neutral tone', () => {
    const host = mountDom();
    mount(<StatusBadge>草稿</StatusBadge>, host);
    expect(asElement(host.container.querySelector('.status-badge')).getAttribute('data-tone')).toBe(
      'neutral',
    );
  });

  // 回归：类型里的 danger 曾没有 CSS 规则（规则写成了类型中不存在的 error），
  // 全站 danger 徽章落回 neutral 灰。单测用 mini-DOM 不算样式，只能在样式表层面守。
  it('ships a components.css rule for every StatusTone（tone 与样式规则一一对应）', () => {
    expect(tones.length).toBeGreaterThan(0);
    expect([...styledTones].sort()).toEqual([...tones].sort());
  });
});

describe('EmptyState', () => {
  it('renders title, description and optional action', () => {
    const host = mountDom();
    mount(
      <EmptyState
        title="暂无用户"
        description="开通身份后用户会出现在这里"
        action={<button type="button">开通身份</button>}
      />,
      host,
    );
    const empty = asElement(host.container.querySelector('.empty-state'));
    expect(empty.querySelector('h3')?.textContent).toBe('暂无用户');
    expect(empty.querySelector('p')?.textContent).toBe('开通身份后用户会出现在这里');
    expect(empty.querySelector('.empty-state-action button')?.textContent).toBe('开通身份');
  });
});

// 回归（真浏览器验收发现；mini-DOM 不算样式，只能在样式表层面守）：外层容器此前不滚动，
// 宽表把整页撑宽、列被压成一字一行；可排序表头按钮此前保留浏览器默认的立体外观。
describe('DataTable 样式（静态）', () => {
  const rule = (selector: string): string => {
    const start = stylesheet.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`components.css has no rule for ${selector}`);
    return stylesheet.slice(start, stylesheet.indexOf('}', start));
  };

  it('scrolls wide tables inside its wrapper instead of widening the page', () => {
    const wrapper = rule('.data-table');
    expect(wrapper).toContain('overflow-x: auto');
    expect(wrapper).toContain('max-width: 100%');
    expect(stylesheet).toMatch(
      /\.data-table th:not\(\.data-table-select\),\s*\.data-table td:not\(\.data-table-select\)\s*\{\s*min-width:/u,
    );
  });

  it('styles the sortable header as header text, not a push button', () => {
    const sort = rule('.data-table .data-table-sort');
    for (const declaration of [
      'appearance: none',
      'border: none',
      'background: none',
      'font: inherit',
      'color: inherit',
    ])
      expect(sort).toContain(declaration);
  });
});
