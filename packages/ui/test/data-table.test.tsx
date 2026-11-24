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

  // 回归（真浏览器量测）：自动表格布局把「生效日期」列压到最小列宽，2026-01-01 在连字符处断成两行。
  it('keeps short unbroken plain tokens such as dates and codes on one line', () => {
    type Doc = Readonly<{
      id: string;
      date: string;
      code: string;
      amount: string;
      name: string;
      status: string;
      blank: string;
    }>;
    const docs: readonly Doc[] = [
      {
        id: 'd1',
        date: '2026-01-01',
        code: 'PO-KT-YARN-2026-001',
        amount: '62,500.00',
        name: '青岛金特夫草纱战略供应商有限公司',
        status: '已发布 · 第 1 版',
        blank: '',
      },
    ];
    const columns: readonly DataTableColumn<Doc>[] = [
      { key: 'date', header: '生效日期', field: (row) => row.date },
      {
        key: 'renderedDate',
        header: '生效日期（render 输出字符串）',
        field: (row) => row.date,
        // 控制台里常见的写法：render 截取日期前 10 位后返回字符串。
        render: (row) => row.date.slice(0, 10),
      },
      { key: 'code', header: '编码', field: (row) => row.code },
      { key: 'amount', header: '金额', field: (row) => row.amount },
      { key: 'name', header: '名称', field: (row) => row.name },
      { key: 'status', header: '状态', field: (row) => row.status },
      { key: 'blank', header: '空', field: (row) => row.blank },
    ];
    const host = mountDom();
    mount(<DataTable columns={columns} rows={docs} rowId={(row) => row.id} />, host);
    const nowrap = (column: string): boolean =>
      (
        asElement(host.container.querySelector(`tbody td[data-column="${column}"]`)).getAttribute(
          'class',
        ) ?? ''
      )
        .split(/\s+/u)
        .includes('data-table-nowrap');
    expect(nowrap('date')).toBe(true);
    expect(nowrap('renderedDate')).toBe(true);
    expect(nowrap('code')).toBe(true);
    expect(nowrap('amount')).toBe(true);
    // 中文文案、含空白的文案仍可折行；空单元格不加类。
    expect(nowrap('name')).toBe(false);
    expect(nowrap('status')).toBe(false);
    expect(nowrap('blank')).toBe(false);
    // 文本内容不受影响。
    expect(
      asElement(host.container.querySelector('tbody td[data-column="date"]')).textContent,
    ).toBe('2026-01-01');
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
