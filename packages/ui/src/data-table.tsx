import { useState } from 'preact/hooks';
import type { ComponentChild } from 'preact';
import { ActionBar } from './action-bar';
import { EmptyState } from './empty-state';

export type DataTableColumn<T> = Readonly<{
  key: string;
  header: string;
  sortable?: boolean;
  field?: (row: T) => string | number;
  render?: (row: T) => ComponentChild;
  align?: 'left' | 'right';
}>;

export type DataTableSelection = Readonly<{
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
}>;

export type DataTablePagination = Readonly<{
  loadedCount: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}>;

export type DataTableProps<T> = Readonly<{
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowId: (row: T) => string;
  caption?: string;
  selection?: DataTableSelection;
  bulkActions?: ComponentChild;
  pagination?: DataTablePagination;
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}>;

type SortState = Readonly<{ key: string; direction: 'asc' | 'desc' }>;

const compareCells = (left: string | number, right: string | number): number => {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
};

const sortRows = <T,>(
  rowsParam: readonly T[],
  sort: SortState | null,
  columns: readonly DataTableColumn<T>[],
  rowId: (row: T) => string,
): readonly T[] => {
  if (sort === null) return rowsParam;
  const column = columns.find((entry) => entry.key === sort.key);
  if (column?.field === undefined) return rowsParam;
  const factor = sort.direction === 'asc' ? 1 : -1;
  // 展示排序保持稳定：以行 id 作并列 tiebreak，避免同值行随机跳动。
  return [...rowsParam].sort((left, right) => {
    const primary = compareCells(column.field?.(left) ?? '', column.field?.(right) ?? '') * factor;
    if (primary !== 0) return primary;
    return compareCells(rowId(left), rowId(right));
  });
};

// 主列表（列表页解剖模板）：列定义/排序/行选择/批量操作栏 + cursor 分页继续加载 + 空错载三态。
export const DataTable = <T,>(props: DataTableProps<T>) => {
  const [sort, setSort] = useState<SortState | null>(null);
  const visibleRows = sortRows(props.rows, sort, props.columns, props.rowId);
  const selectable = props.selection !== undefined;
  const selection = props.selection;
  const selectedIds = selection?.selected ?? new Set<string>();
  const visibleIds = visibleRows.map(props.rowId);
  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id));
  const allSelected =
    selectable && visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleRow = (id: string): void => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const toggleAll = (): void => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    selection.onChange(next);
  };

  const headerSortState = (key: string): 'none' | 'ascending' | 'descending' => {
    if (sort?.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };

  const onSortClick = (key: string): void => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const headerCheckState = (): 'true' | 'false' | 'mixed' => {
    if (selectedVisible.length === 0) return 'false';
    if (allSelected) return 'true';
    return 'mixed';
  };

  return (
    <div class="data-table">
      {selectable &&
      props.bulkActions !== undefined &&
      props.bulkActions !== null &&
      selectedIds.size > 0 ? (
        <div class="data-table-bulk" data-bulk-bar="true">
          <ActionBar label="批量操作" count={selectedIds.size}>
            {props.bulkActions}
          </ActionBar>
        </div>
      ) : null}
      <table aria-busy={props.loading === true ? 'true' : 'false'}>
        {props.caption !== undefined ? <caption>{props.caption}</caption> : null}
        <thead>
          <tr>
            {selectable ? (
              <th class="data-table-select" data-select-all="true">
                <input
                  type="checkbox"
                  aria-checked={headerCheckState()}
                  aria-label="全选本页"
                  checked={allSelected}
                  onClick={() => {
                    toggleAll();
                  }}
                />
              </th>
            ) : null}
            {props.columns.map((column) => (
              <th
                key={column.key}
                data-sort-key={column.key}
                aria-sort={column.sortable === true ? headerSortState(column.key) : undefined}
              >
                {column.sortable === true ? (
                  <button
                    type="button"
                    class="data-table-sort"
                    onClick={() => {
                      onSortClick(column.key);
                    }}
                  >
                    {column.header}
                    <span class="sort-glyph" aria-hidden="true">
                      ⇅
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.error === undefined
            ? visibleRows.map((row) => {
                const id = props.rowId(row);
                const rowSelected = selectedIds.has(id);
                return (
                  <tr key={id} data-row-id={id} class={rowSelected ? 'selected' : undefined}>
                    {selectable ? (
                      <td class="data-table-select" data-select-cell="true">
                        <input
                          type="checkbox"
                          checked={rowSelected}
                          aria-label="选中该行"
                          onClick={() => {
                            toggleRow(id);
                          }}
                        />
                      </td>
                    ) : null}
                    {props.columns.map((column) => (
                      <td key={column.key} data-column={column.key}>
                        {column.render !== undefined
                          ? column.render(row)
                          : String(column.field?.(row) ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
      {props.error !== undefined ? (
        <p class="data-table-error" role="alert">
          {props.error}
        </p>
      ) : null}
      {props.error === undefined && props.loading === true ? (
        <p class="data-table-loading" role="status">
          正在加载…
        </p>
      ) : null}
      {props.error === undefined &&
      props.loading !== true &&
      props.rows.length === 0 &&
      props.emptyTitle !== undefined ? (
        <EmptyState
          title={props.emptyTitle}
          {...(props.emptyDescription !== undefined ? { description: props.emptyDescription } : {})}
        />
      ) : null}
      {props.pagination !== undefined ? (
        <div class="data-table-footer">
          <span class="table-footnote">已加载 {String(props.pagination.loadedCount)} 条记录</span>
          {props.pagination.hasMore ? (
            <button
              type="button"
              class="secondary compact"
              disabled={props.pagination.loading}
              onClick={() => {
                props.pagination?.onLoadMore();
              }}
            >
              {props.pagination.loading ? '加载中…' : '继续加载'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
