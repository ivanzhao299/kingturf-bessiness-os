import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals';
import { DataTable, type DataTableColumn } from '../src/data-table';
import { asElement, flush, mount, mountDom } from './render';

type Row = Readonly<{ id: string; name: string; quota: number; state: string }>;

const rows: readonly Row[] = [
  { id: 'u2', name: '王二', quota: 30, state: 'active' },
  { id: 'u1', name: '张一', quota: 20, state: 'active' },
  { id: 'u3', name: '李三', quota: 10, state: 'disabled' },
];

const columns: readonly DataTableColumn<Row>[] = [
  { key: 'name', header: '姓名', sortable: true, field: (row) => row.name },
  { key: 'quota', header: '配额', sortable: true, field: (row) => row.quota },
  {
    key: 'state',
    header: '状态',
    field: (row) => row.state,
    render: (row) => <span class="status-badge">{row.state === 'active' ? '在职' : '停用'}</span>,
  },
];

const cellTexts = (host: ReturnType<typeof mountDom>, column: string): readonly string[] =>
  host.container
    .querySelectorAll(`tbody tr td[data-column="${column}"]`)
    .map((cell) => cell.textContent);

describe('DataTable', () => {
  it('renders headers and rows through field/render accessors', () => {
    const host = mountDom();
    mount(<DataTable columns={columns} rows={rows} rowId={(row) => row.id} />, host);
    const headers = host.container
      .querySelectorAll('thead th')
      .map((th) => th.textContent.replace('⇅', ''));
    expect(headers).toEqual(['姓名', '配额', '状态']);
    expect(cellTexts(host, 'name')).toEqual(['王二', '张一', '李三']);
    expect(
      host.container.querySelectorAll('tbody .status-badge').map((b) => b.textContent),
    ).toEqual(['在职', '在职', '停用']);
  });

  it('sorts asc/desc through sortable headers with aria-sort', async () => {
    const host = mountDom();
    mount(<DataTable columns={columns} rows={rows} rowId={(row) => row.id} />, host);
    const nameHeader = asElement(host.container.querySelector('th[data-sort-key="name"]'));
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
    asElement(nameHeader.querySelector('button')).click();
    await flush();
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(cellTexts(host, 'name')).toEqual(['张一', '李三', '王二']);
    asElement(nameHeader.querySelector('button')).click();
    await flush();
    expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
    expect(cellTexts(host, 'name')).toEqual(['王二', '李三', '张一']);
  });

  it('supports row selection with header toggle and mixed state', async () => {
    const host = mountDom();
    const selected = signal(new Set<string>());
    const App = () => (
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        selection={{
          selected: selected.value,
          onChange: (next) => {
            selected.value = new Set(next);
          },
        }}
      />
    );
    mount(<App />, host);
    expect(host.container.querySelectorAll('tbody [data-select-cell]').length).toBe(3);
    const secondRowCheck = asElement(
      host.container.querySelector('tr[data-row-id="u1"] [data-select-cell] input'),
    );
    secondRowCheck.click();
    await flush();
    expect([...selected.value]).toEqual(['u1']);
    const headerCheck = asElement(host.container.querySelector('thead [data-select-all] input'));
    expect(headerCheck.getAttribute('aria-checked')).toBe('mixed');
    headerCheck.click();
    await flush();
    expect([...selected.value].sort()).toEqual(['u1', 'u2', 'u3']);
    expect(headerCheck.getAttribute('aria-checked')).toBe('true');
    headerCheck.click();
    await flush();
    expect([...selected.value]).toEqual([]);
    expect(headerCheck.getAttribute('aria-checked')).toBe('false');
  });

  it('shows the bulk action bar only while rows are selected', async () => {
    const host = mountDom();
    const selected = signal(new Set<string>());
    const App = () => (
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        selection={{
          selected: selected.value,
          onChange: (next) => {
            selected.value = new Set(next);
          },
        }}
        bulkActions={<button type="button">批量停用</button>}
      />
    );
    mount(<App />, host);
    expect(host.container.querySelector('[data-bulk-count]')).toBeNull();
    asElement(
      host.container.querySelector('tr[data-row-id="u3"] [data-select-cell] input'),
    ).click();
    await flush();
    expect(asElement(host.container.querySelector('[data-bulk-count]')).textContent).toBe(
      '已选 1 项',
    );
    expect(asElement(host.container.querySelector('[data-bulk-bar] button')).textContent).toBe(
      '批量停用',
    );
  });

  it('renders the cursor pagination footer with continue-loading wiring', () => {
    const host = mountDom();
    const loaded: string[] = [];
    mount(
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        pagination={{
          loadedCount: 3,
          hasMore: true,
          loading: false,
          onLoadMore: () => loaded.push('next'),
        }}
      />,
      host,
    );
    const footer = asElement(host.container.querySelector('.data-table-footer'));
    expect(footer.textContent).toContain('已加载 3 条记录');
    const more = asElement(footer.querySelector('button'));
    more.click();
    expect(loaded).toEqual(['next']);
  });

  it('disables continue-loading and announces progress while loading', () => {
    const host = mountDom();
    mount(
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        pagination={{ loadedCount: 3, hasMore: true, loading: true, onLoadMore: () => undefined }}
      />,
      host,
    );
    const more = asElement(host.container.querySelector('.data-table-footer button'));
    expect(more.disabled).toBe(true);
    expect(more.textContent).toContain('加载中');
  });

  it('shows the empty state when there are no rows and no error', () => {
    const host = mountDom();
    mount(
      <DataTable
        columns={columns}
        rows={[]}
        rowId={(row) => row.id}
        emptyTitle="暂无用户"
        emptyDescription="开通身份后用户会出现在这里"
      />,
      host,
    );
    const empty = asElement(host.container.querySelector('.empty-state'));
    expect(empty.querySelector('h3')?.textContent).toBe('暂无用户');
  });

  it('surfaces the error state with role=alert and hides rows', () => {
    const host = mountDom();
    mount(
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        error="治理面数据加载失败"
      />,
      host,
    );
    const alert = asElement(host.container.querySelector('[role="alert"]'));
    expect(alert.textContent).toContain('治理面数据加载失败');
    expect(host.container.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('announces the loading state with aria-busy', () => {
    const host = mountDom();
    mount(
      <DataTable columns={columns} rows={[]} rowId={(row) => row.id} loading emptyTitle="暂无" />,
      host,
    );
    const table = asElement(host.container.querySelector('table'));
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(host.container.querySelector('.empty-state')).toBeNull();
  });
});
