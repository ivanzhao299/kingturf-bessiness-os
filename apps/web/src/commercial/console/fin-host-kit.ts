// FIN（财务域迁移）：应收 / 收款与核销 / 催收三个控制台宿主共用的装配件——宿主上下文类型、
// 桥轨分页 URL 与响应归一、挂载。三个宿主各自独立成文件（bom-host 范式），不向
// console-entry.ts 追加。页面内部的共用件见 fin-kit.tsx。
import type { AppRoute } from '../../shared/navigation';
import { el } from '../../dom';
import type { FinanceRiskViewContext } from '../finance-risk-view-ports';
import type { CommercialApi } from '../types';
import type { FinQuery } from './fin-kit';
import type { ConsoleMountPorts } from './mount';

// 桥轨分页与详情读取需要 controller.api.get——FinanceRiskViewContext 的 controller 最小面不含
// api（其余 vanilla 视图无需），财务域三个宿主加宽这一项（同 production-order-host）。
export type FinHostController = FinanceRiskViewContext['controller'] &
  Readonly<{ api: Readonly<Pick<CommercialApi, 'get'>> }>;
export type FinHostContext = Readonly<{
  workspace: HTMLElement;
  status: HTMLElement;
  controller: FinHostController;
  permissions: FinanceRiskViewContext['permissions'];
  appRoutes: ReadonlySet<AppRoute>;
  ports: FinanceRiskViewContext['ports'];
}>;

export type FinHostPage = Readonly<{
  items: readonly Record<string, unknown>[];
  nextCursor: string | null;
  summary?: unknown;
}>;

export const finRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// 与文字值端口同式（shared/business-format.ts textValue）：字符串与数字原样转文本，其余取兜底。
export const finTextOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

/** 桥轨分页 URL：空串与 undefined 的参数不出现；布尔以 1 / 0 表示。 */
export const finPageUrl = (path: string, query: FinQuery): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
};

export const finDetailUrl = (path: string, id: string): string =>
  `${path}/${encodeURIComponent(id)}`;

/** 经 controller.api.get 读一页桥轨列表并归一（读不到 api 时给空页，不另发请求）。 */
export const finReadPage = async (
  read: FinHostController['api']['get'],
  path: string,
  query: FinQuery,
): Promise<FinHostPage> => {
  if (!read) return { items: [], nextCursor: null };
  const page = await read(finPageUrl(path, query));
  const items = Array.isArray(page.items) ? page.items.map(finRecord) : [];
  return {
    items,
    nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
    ...(page.summary === undefined ? {} : { summary: page.summary }),
  };
};

/** 控制台宿主节段：自带路由标记（路由可见性由 applyRouteVisibility 按它切换）与测试标识。 */
export const finHostSection = (className: string, testId: string, route: string): HTMLElement => {
  const section = el('section', `commercial-console ${className}`);
  section.setAttribute('data-testid', testId);
  section.setAttribute('data-route-view', route);
  return section;
};

/** 工作区每次重建都会新建节段；只有仍连在文档里的那一个才挂载（与 console-entry 同款守卫）。 */
export const finMount = (section: HTMLElement, mount: ConsoleMountPorts): void => {
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, mount);
  });
};

export type FinLedgerUpdates = Readonly<{
  subscribe: (reload: () => Promise<void>) => () => void;
  publish: () => void;
}>;

const ledgerReaders = new WeakMap<HTMLElement, Map<HTMLElement, () => Promise<void>>>();

/** Keep already-mounted sibling finance consoles in step after a ledger write. */
export function finLedgerUpdates(workspace: HTMLElement, section: HTMLElement): FinLedgerUpdates {
  const readers = ledgerReaders.get(workspace) ?? new Map<HTMLElement, () => Promise<void>>();
  ledgerReaders.set(workspace, readers);
  return {
    subscribe: (reload) => {
      readers.set(section, reload);
      return () => {
        readers.delete(section);
      };
    },
    publish: () => {
      for (const [host, reload] of readers) {
        if (!host.isConnected) readers.delete(host);
        else if (host !== section) void reload();
      }
    },
  };
}
