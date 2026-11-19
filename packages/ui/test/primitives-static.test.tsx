import { describe, expect, it } from 'vitest';
import { ActionBar } from '../src/action-bar';
import { EmptyState } from '../src/empty-state';
import { PageHeader } from '../src/page-header';
import { StatusBadge } from '../src/status-badge';
import { asElement, mount, mountDom } from './render';

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
    mount(<StatusBadge tone="success">在職</StatusBadge>, host);
    const badge = asElement(host.container.querySelector('.status-badge'));
    expect(badge.getAttribute('data-tone')).toBe('success');
    expect(badge.textContent).toBe('在職');
  });

  it('defaults to neutral tone', () => {
    const host = mountDom();
    mount(<StatusBadge>草稿</StatusBadge>, host);
    expect(asElement(host.container.querySelector('.status-badge')).getAttribute('data-tone')).toBe(
      'neutral',
    );
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
