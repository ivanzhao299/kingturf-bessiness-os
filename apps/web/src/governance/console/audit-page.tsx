import { signal } from '@preact/signals';
import { DataTable, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { recordOf, textOf, type ConsolePorts } from './ports';

// UI-M2 审计页：查询工作台——筛选区（关键字/结果 + 本批新增 from/to 时间参数，
// 服务端过滤沿用 M3 契约）+ DataTable 全量分页 + CSV 导出（保留 B2 分页循环语义
// 与 10000 条上限；导出即当前筛选结果）。
type Row = Readonly<Record<string, unknown>>;
const EXPORT_ROW_CAP = 10_000;

const csvText = (value: unknown): string => `"${textOf(value, '').replaceAll('"', '""')}"`;

const toCsv = (rows: readonly Row[], truncated: boolean): string => {
  const lines = [
    '时间,结果,操作,人员,对象类型,对象编号,关联编号',
    ...rows.map((item) =>
      [
        item.occurredAt,
        item.outcome,
        item.action,
        item.actorId,
        item.targetType,
        item.targetId,
        item.correlationId,
      ]
        .map(csvText)
        .join(','),
    ),
  ];
  if (truncated) lines.push(`# 导出上限 ${String(EXPORT_ROW_CAP)} 条，已截断`);
  return lines.join('\n');
};

const downloadCsv = (csv: string): void => {
  // 测试 DOM 无 URL/Blob：仅在浏览器环境执行下载副作用。
  if (typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `系统审计日志-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export function AuditConsolePage(ports: ConsolePorts) {
  const page = signal(ports.initialView('/api/v1/audit-events'));
  const query = signal('');
  const outcome = signal('');
  const from = signal('');
  const to = signal('');
  const busy = signal(false);
  const exporting = signal(false);
  const loadError = signal('');

  const filters = (): Readonly<Record<string, string | undefined>> => ({
    ...(query.value.trim() ? { query: query.value.trim() } : {}),
    ...(outcome.value ? { outcome: outcome.value } : {}),
    ...(from.value ? { from: from.value } : {}),
    ...(to.value ? { to: to.value } : {}),
  });

  const reload = (): void => {
    busy.value = true;
    void ports
      .fetchPage('/api/v1/audit-events', filters())
      .then((fetched) => {
        page.value = fetched;
        loadError.value = '';
      })
      .catch((error: unknown) => {
        loadError.value = error instanceof Error ? error.message : '审计查询失败';
      })
      .finally(() => {
        busy.value = false;
      });
  };

  const loadMore = (): void => {
    const cursor = page.value.nextCursor;
    if (cursor === null || busy.value) return;
    busy.value = true;
    void ports
      .fetchPage('/api/v1/audit-events', { ...filters(), cursor })
      .then((fetched) => {
        page.value = {
          items: [...page.value.items, ...fetched.items],
          nextCursor: fetched.nextCursor,
        };
      })
      .finally(() => {
        busy.value = false;
      });
  };

  const exportCsv = (): void => {
    if (exporting.value) return;
    exporting.value = true;
    void (async () => {
      const rows: Row[] = page.value.items.map(recordOf);
      let cursor = page.value.nextCursor;
      let truncated = false;
      while (cursor !== null) {
        const fetched = await ports.fetchPage('/api/v1/audit-events', {
          ...filters(),
          ...(cursor ? { cursor } : {}),
        });
        rows.push(...fetched.items.map(recordOf));
        cursor = fetched.nextCursor;
        if (rows.length >= EXPORT_ROW_CAP) {
          truncated = true;
          break;
        }
      }
      downloadCsv(toCsv(rows.slice(0, EXPORT_ROW_CAP), truncated));
    })()
      .catch(() => {
        /* 失败保留已加载页，可重试导出 */
      })
      .finally(() => {
        exporting.value = false;
      });
  };

  const columns: readonly DataTableColumn<Row>[] = [
    { key: 'occurredAt', header: '时间', sortable: true, field: (row) => textOf(row.occurredAt) },
    {
      key: 'outcome',
      header: '结果',
      field: (row) => textOf(row.outcome),
      render: (row) => (
        <StatusBadge tone={row.outcome === 'SUCCESS' ? 'success' : 'danger'}>
          {textOf(row.outcome)}
        </StatusBadge>
      ),
    },
    { key: 'action', header: '操作', field: (row) => textOf(row.action) },
    { key: 'actorId', header: '人员', field: (row) => textOf(row.actorId) },
    { key: 'targetType', header: '对象类型', field: (row) => textOf(row.targetType) },
    { key: 'targetId', header: '对象编号', field: (row) => textOf(row.targetId) },
  ];

  const Page = () => {
    const rows = page.value.items.map(recordOf);
    return (
      <div class="console-page" data-testid="kt-audit-page">
        <div class="console-filters" data-testid="kt-audit-filters">
          <input
            type="search"
            placeholder="搜索操作、对象类型、人员或关联编号"
            aria-label="搜索系统日志"
            data-testid="kt-audit-query"
            value={query.value}
            onInput={(event: Event) => {
              query.value = (event.target as unknown as { value: string }).value;
            }}
          />
          <select
            aria-label="日志结果"
            data-testid="kt-audit-outcome"
            value={outcome.value}
            onChange={(event: Event) => {
              outcome.value = (event.target as unknown as { value: string }).value;
            }}
          >
            <option value="">全部结果</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILURE">失败</option>
          </select>
          <input
            type="date"
            aria-label="开始日期"
            data-testid="kt-audit-from"
            value={from.value}
            onInput={(event: Event) => {
              from.value = (event.target as unknown as { value: string }).value;
            }}
          />
          <input
            type="date"
            aria-label="结束日期"
            data-testid="kt-audit-to"
            value={to.value}
            onInput={(event: Event) => {
              to.value = (event.target as unknown as { value: string }).value;
            }}
          />
          <button
            type="button"
            class="secondary compact"
            data-testid="kt-audit-apply"
            disabled={busy.value}
            onClick={reload}
          >
            应用筛选
          </button>
          <button
            type="button"
            class="secondary compact"
            data-testid="kt-audit-export"
            disabled={exporting.value}
            onClick={exportCsv}
          >
            {exporting.value ? '导出中…' : '导出当前日志'}
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowId={(row) => textOf(row.id, textOf(row.correlationId, 'row'))}
          caption="审计事件（服务端筛选 + cursor 分页）"
          loading={busy.value}
          pagination={{
            loadedCount: rows.length,
            hasMore: page.value.nextCursor !== null,
            loading: busy.value,
            onLoadMore: loadMore,
          }}
          {...(loadError.value === '' ? {} : { error: loadError.value })}
          emptyTitle="无匹配审计事件"
          emptyDescription="调整筛选条件后重新查询"
        />
      </div>
    );
  };
  return Page;
}
