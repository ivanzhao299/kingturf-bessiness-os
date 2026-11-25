// FIN（财务域迁移）：应收 / 收款与核销 / 催收三个控制台共用的页面基座——页头与筛选条、
// 键集分页列表的装载闭包、一次写的收口、金额呈现、抽屉里的分区与字段清单。各域的列、
// 抽屉与表单在各自文件里；样式见 fin-console.css（取值全部来自 kt tokens）。
import { type Signal } from '@preact/signals';
import type { ComponentChild } from 'preact';
import { PageHeader } from '@kingturf/ui';
import { ConsoleNotice } from './console-notice';
import { failureMessage } from '../../shared/api-error-message';
import { formatBusinessDateTime } from '../../shared/business-date';
import './fin-console.css';

export type FinRow = Readonly<Record<string, unknown>>;
export type FinPage<Row extends FinRow = FinRow> = Readonly<{
  items: readonly Row[];
  nextCursor: string | null;
  summary?: unknown;
}>;
/** 桥轨列表的查询参数（空串与 undefined 不出现在 URL 里）。 */
export type FinQuery = Readonly<Record<string, string | number | boolean | undefined>>;

export const finRecord = (value: unknown): FinRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as FinRow) : {};
export const finRows = (value: unknown): readonly FinRow[] =>
  Array.isArray(value) ? value.map(finRecord) : [];
/** 依次取第一个是字符串或数字的键（驼峰名、蛇形名……），都没有返回空串。 */
export const finText = (row: FinRow, ...keys: readonly string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
};
/** 日期（取 ISO 文本的前 10 位）；没有值显示「—」。 */
export const finDay = (row: FinRow, ...keys: readonly string[]): string => {
  const text = finText(row, ...keys).slice(0, 10);
  return text === '' ? '—' : text;
};
/** 日期时间（业务时区）；没有值或解析不了显示「—」。 */
export const finWhen = (row: FinRow, ...keys: readonly string[]): string => {
  const raw = finText(row, ...keys);
  if (raw === '') return '—';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '—' : formatBusinessDateTime(date);
};

const DECIMAL = /^-?\d+(?:\.\d+)?$/u;
/** 十进制文本去掉尾随的 0（'950000.000000' → '950000'，'850000.500000' → '850000.5'）；不是十进制文本返回空串。 */
export const finDecimal = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!DECIMAL.test(text)) return '';
  const [whole = '', fraction = ''] = text.split('.');
  const kept = fraction.replace(/0+$/u, '');
  return kept === '' ? whole : `${whole}.${kept}`;
};
// DataTable compares strings lexically. Pad the numeric(24,6) components and invert negative digits.
export const finDecimalSortKey = (value: unknown): string => {
  const decimal = finDecimal(value);
  if (decimal === '') return '';
  const negative = decimal.startsWith('-');
  const [whole = '', fraction = ''] = decimal.replace(/^-/, '').split('.');
  const magnitude = whole.padStart(18, '0') + fraction.padEnd(6, '0');
  return negative
    ? `0${magnitude.replace(/\d/g, (digit) => String(9 - Number(digit)))}`
    : `1${magnitude}`;
};

export const finMoneyText = (currency: unknown, value: unknown): string => {
  const exact = finDecimal(value);
  if (exact === '' || typeof currency !== 'string' || !/^[A-Z]{3}$/u.test(currency)) return '—';
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
  // Intl accepts decimal strings directly. The TypeScript declaration only exposes number and bigint.
  return (formatter.format as unknown as (amount: string) => string)(exact);
};
export const FinAmount = (
  props: Readonly<{
    currency: unknown;
    amount: unknown;
    testId?: string | undefined;
  }>,
) => {
  return (
    <span class="fin-money" data-testid={props.testId}>
      {finMoneyText(props.currency, props.amount)}
    </span>
  );
};

export const FinPage = (
  props: Readonly<{
    testId: string;
    title: string;
    description: string;
    actions?: ComponentChild;
    notice: string;
    // 抽屉开着时状态行放抽屉底部，这里不再重复显示。
    noticeHere: boolean;
    children?: ComponentChild;
  }>,
) => (
  <div class="commercial-console-page fin-page" data-testid={props.testId}>
    <PageHeader
      title={props.title}
      description={props.description}
      actions={props.actions === undefined ? undefined : props.actions}
    />
    {props.noticeHere ? <ConsoleNotice message={props.notice} /> : null}
    {props.children}
  </div>
);

export type FinSearch = Readonly<{
  value: string;
  applied: string;
  placeholder: string;
  onChange: (next: string) => void;
  onApply: () => void;
  onClear: () => void;
}>;

/** 筛选条：一组互斥的状态按钮（可作筛选）+ 可选的关键字搜索（回车或「搜索」生效）。 */
export const FinFilters = (
  props: Readonly<{
    testPrefix: string;
    chips: readonly Readonly<{ key: string; label: string }>[];
    active: string;
    onSelect: (key: string) => void;
    search?: FinSearch;
  }>,
) => (
  <div class="console-filters fin-filters">
    {props.chips.map((chip) => (
      <button
        key={chip.key}
        type="button"
        class={props.active === chip.key ? 'secondary compact active' : 'secondary compact'}
        aria-pressed={props.active === chip.key ? 'true' : 'false'}
        data-testid={`${props.testPrefix}-filter-${chip.key.toLowerCase()}`}
        onClick={() => {
          props.onSelect(chip.key);
        }}
      >
        {chip.label}
      </button>
    ))}
    {props.search === undefined ? null : (
      <form
        class="fin-search"
        data-testid={`${props.testPrefix}-search-form`}
        onSubmit={(event) => {
          event.preventDefault();
          props.search?.onApply();
        }}
      >
        <input
          type="search"
          aria-label="关键字搜索"
          placeholder={props.search.placeholder}
          data-testid={`${props.testPrefix}-search`}
          value={props.search.value}
          onInput={(event) => {
            props.search?.onChange((event.target as { value?: string }).value ?? '');
          }}
        />
        <button
          type="submit"
          class="secondary compact"
          data-testid={`${props.testPrefix}-search-submit`}
        >
          搜索
        </button>
        {props.search.applied === '' ? null : (
          <button
            type="button"
            class="secondary compact"
            data-testid={`${props.testPrefix}-search-clear`}
            onClick={() => {
              props.search?.onClear();
            }}
          >
            清除
          </button>
        )}
      </form>
    )}
  </div>
);

/** 详情抽屉里的一节：标题 + 口径说明 + 内容。 */
export const FinSection = (
  props: Readonly<{
    title: string;
    note?: string;
    testId: string;
    children?: ComponentChild;
  }>,
) => (
  <section class="fin-section" data-testid={props.testId}>
    <h3>{props.title}</h3>
    {props.note === undefined ? null : <p class="fin-muted">{props.note}</p>}
    {props.children}
  </section>
);

/** 字段清单（标签 / 值两列）；值里的长文本自动折行。 */
export const FinFacts = ({
  items,
}: Readonly<{ items: readonly (readonly [string, ComponentChild])[] }>) => (
  <dl class="fin-facts">
    {items.map(([label, value], index) => (
      <div key={String(index)}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

/** 抽屉里的行项表（核销分配、处置时间线等）：容器可横向滚动，窄屏不撑破抽屉。 */
export const FinTable = (
  props: Readonly<{
    testId: string;
    head: readonly string[];
    rows: readonly (readonly ComponentChild[])[];
    empty: string;
    // 行的测试标识（如 kt-ar-allocation）；不给则不加。
    rowTestId?: ((index: number) => string) | undefined;
  }>,
) => (
  <div class="fin-table-scroll">
    <table class="fin-table" data-testid={props.testId}>
      <thead>
        <tr>
          {props.head.map((cell, index) => (
            <th key={String(index)} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.length === 0 ? (
          <tr>
            <td colspan={props.head.length} class="fin-muted">
              {props.empty}
            </td>
          </tr>
        ) : (
          props.rows.map((cells, index) => (
            <tr
              key={String(index)}
              data-testid={props.rowTestId === undefined ? undefined : props.rowTestId(index)}
            >
              {cells.map((cell, at) => (
                <td key={String(at)}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

/** 跳到别的路由：hash 链接（与制造概览卡、治理概览卡同一机制）；onNavigate 用于先关掉抽屉。 */
export const FinLink = (
  props: Readonly<{
    href: string;
    testId: string;
    onNavigate?: () => void;
    children?: ComponentChild;
  }>,
) => (
  <a
    class="fin-link"
    href={props.href}
    data-testid={props.testId}
    onClick={() => {
      props.onNavigate?.();
    }}
  >
    {props.children}
  </a>
);

export const finLink = (route: string): string => `#/${route}`;

/** 一次写的收口：失败原因（经 failureMessage 转中文）写进指定的错误位；返回是否成功。 */
export async function finWrite(
  io: Readonly<{
    error: Signal<string>;
    loading: Signal<boolean>;
    fallback: string;
    run: () => Promise<void>;
  }>,
): Promise<boolean> {
  io.error.value = '';
  io.loading.value = true;
  try {
    await io.run();
    return true;
  } catch (error: unknown) {
    io.error.value = failureMessage(error, io.fallback);
    return false;
  } finally {
    io.loading.value = false;
  }
}

export type FinListSignals = Readonly<{
  rows: Signal<readonly FinRow[]>;
  nextCursor: Signal<string | null>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
}>;

/**
 * 键集分页列表的装载闭包。reload 从第一页重取（筛选或关键字变了、写操作之后）；
 * loadMore 沿 nextCursor 续取。请求序号守卫丢弃过期响应（先发的后到不覆盖后发的）。
 * 失败原因写进 loadError。
 */
export function createFinList<
  Page extends Readonly<{ items: readonly FinRow[]; nextCursor: string | null }>,
>(
  fetchPage: (query: FinQuery) => Promise<Page>,
  list: FinListSignals,
  onLoaded: (page: Page) => void = () => undefined,
) {
  let sequence = 0;
  const reload = async (query: FinQuery): Promise<void> => {
    const current = ++sequence;
    list.loading.value = true;
    try {
      const page = await fetchPage(query);
      if (current !== sequence) return;
      list.rows.value = page.items;
      list.nextCursor.value = page.nextCursor;
      list.loadError.value = '';
      onLoaded(page);
    } catch (error: unknown) {
      if (current === sequence) list.loadError.value = failureMessage(error, '列表加载失败');
    } finally {
      if (current === sequence) list.loading.value = false;
    }
  };
  const loadMore = async (query: FinQuery): Promise<void> => {
    const cursor = list.nextCursor.value;
    if (cursor === null || list.loadingMore.value || list.loading.value) return;
    const current = sequence;
    list.loadingMore.value = true;
    try {
      const page = await fetchPage({ ...query, cursor });
      if (current !== sequence) return;
      list.rows.value = [...list.rows.value, ...page.items];
      list.nextCursor.value = page.nextCursor;
      list.loadError.value = '';
    } catch (error: unknown) {
      if (current === sequence) list.loadError.value = failureMessage(error, '继续加载失败');
    } finally {
      list.loadingMore.value = false;
    }
  };
  return { reload, loadMore };
}
