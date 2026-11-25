// FIN-1：应收控制台动作工厂——装载 / 筛选 / 关键字 / 续载、刷新、抽屉开合、过账。bundle 为页面
// signal 束的最小面；请求序号守卫在 createFinList 里（先发的后到不覆盖后发的）。
import { signal, type Signal } from '@preact/signals';
import { createFinList, finRows, finWrite, type FinQuery } from './fin-kit';
import { reloadSelectedDetail, syncSelected } from './selected-sync';
import { failureMessage } from '../../shared/api-error-message';
import { arPostPayload } from './ar-payload';
import {
  AR_LIST_PATH,
  AR_PAGE_SIZE,
  type ArConsolePorts,
  type ArPage,
  type ArRow,
  type ArSummaryRow,
} from './ar-ports';
import type { ArFilter } from './ar-state';

export type ArBundle = Readonly<{
  rows: Signal<readonly ArRow[]>;
  nextCursor: Signal<string | null>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  filter: Signal<ArFilter>;
  search: Signal<string>;
  appliedSearch: Signal<string>;
  summary: Signal<readonly ArSummaryRow[] | null>;
  selected: Signal<ArRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<'create' | null>;
  submitError: Signal<string>;
  notice: Signal<string>;
}>;

export const createArBundle = (): ArBundle => ({
  rows: signal<readonly ArRow[]>([]),
  nextCursor: signal<string | null>(null),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  filter: signal<ArFilter>('ALL'),
  search: signal(''),
  appliedSearch: signal(''),
  summary: signal<readonly ArSummaryRow[] | null>(null),
  selected: signal<ArRow | null>(null),
  detailLoading: signal(false),
  activeForm: signal<'create' | null>(null),
  submitError: signal(''),
  notice: signal(''),
});

export function createArActions(ports: ArConsolePorts, bundle: ArBundle) {
  const list = createFinList<ArPage>(
    (query) => ports.fetchPage(query),
    bundle,
    (page) => {
      bundle.summary.value = page.summary === undefined ? null : finRows(page.summary);
    },
  );
  // 汇总随每次列表响应一起回来：币种之间不相加，与筛选、分页无关。
  const query = (): FinQuery => ({
    summary: true,
    limit: AR_PAGE_SIZE,
    ...(bundle.filter.value === 'ALL' ? {} : { state: bundle.filter.value }),
    ...(bundle.appliedSearch.value === '' ? {} : { search: bundle.appliedSearch.value }),
  });
  const reload = (): Promise<void> => list.reload(query());
  const selection = () => ({
    selected: bundle.selected,
    rows: bundle.rows.value,
    idOf: (row: ArRow) => ports.textValue(row.id, ''),
    loadDetail: ports.loadDetail,
  });
  // 整站重读（与旧版页面写后刷新同式）后重取第一页与汇总；开着的抽屉重读详情。
  const refresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      await ports.refresh();
    } catch (error: unknown) {
      bundle.loadError.value = failureMessage(error, '应收刷新失败');
      bundle.loading.value = false;
      return;
    }
    await reload();
    if (bundle.loadError.value === '') {
      const latest = selection();
      if (syncSelected(latest)) await reloadSelectedDetail(latest);
    }
  };
  let detailSequence = 0;

  return {
    reload,
    setFilter: (next: ArFilter): void => {
      bundle.filter.value = next;
      void reload();
    },
    setSearch: (next: string): void => {
      bundle.search.value = next;
    },
    applySearch: (): void => {
      bundle.appliedSearch.value = bundle.search.value.trim();
      void reload();
    },
    clearSearch: (): void => {
      bundle.search.value = '';
      bundle.appliedSearch.value = '';
      void reload();
    },
    loadMore: (): void => {
      void list.loadMore(query());
    },
    refresh,
    // 开始下一个动作时清掉上一次的提示（与 submitError 同一处）。
    open: (row: ArRow | null): void => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      bundle.notice.value = '';
      detailSequence += 1;
      if (!row) {
        bundle.detailLoading.value = false;
        return;
      }
      // 详情读取失败静默回退列表行；迟到的详情只在抽屉仍开着、且还是这一条时才替换。
      const current = detailSequence;
      bundle.detailLoading.value = true;
      void reloadSelectedDetail(selection()).finally(() => {
        if (current === detailSequence) bundle.detailLoading.value = false;
      });
    },
    openCreate: (): void => {
      bundle.activeForm.value = 'create';
      bundle.submitError.value = '';
      bundle.notice.value = '';
    },
    closeForm: (): void => {
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
    },
    // 载荷与旧版表单逐字节一致（ar-payload.ts）；失败原因留在表单提示区。
    runCreate: async (values: Readonly<Record<string, string>>): Promise<void> => {
      let payload: Record<string, unknown>;
      try {
        payload = arPostPayload(ports, values);
      } catch (error: unknown) {
        bundle.submitError.value = failureMessage(error, '请选择有效订单');
        return;
      }
      const saved = await finWrite({
        error: bundle.submitError,
        loading: bundle.loading,
        fallback: '应收过账失败',
        run: async () => {
          await ports.submit(AR_LIST_PATH, payload);
        },
      });
      if (!saved) return;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      bundle.notice.value = `已过账应收单据 ${String(payload.documentNumber)}`;
      await refresh();
    },
  };
}
