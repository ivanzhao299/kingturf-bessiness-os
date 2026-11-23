// U3-MFG-2：BOM 控制台动作工厂（自 BomConsolePage 拆分——G5 ≤200 行纪律，沿
// po-console-actions 先例）。装载/筛选分页闭包（createBomLoaders）与变更闭包
// （createBomMutations：行级发布/创建载荷）分离；bundle 为页面 signal 束的最小面，
// 请求序号守卫丢弃过期响应。
import type { Signal } from '@preact/signals';
import {
  ALL_PRODUCTS,
  BOM_PAGE_SIZE,
  type BomProductFilter,
  type BomStatusFilter,
} from './bom-state';
import type { BomConsolePorts, BomPageQuery, BomRow } from './bom-ports';

export type BomBundle = Readonly<{
  snapshot: Signal<readonly BomRow[]>;
  boms: Signal<readonly BomRow[]>;
  nextCursor: Signal<string | null>;
  productFilter: Signal<BomProductFilter>;
  statusFilter: Signal<BomStatusFilter>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<BomRow | null>;
  detail: Signal<BomRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<'create' | null>;
  componentRows: Signal<readonly string[]>;
  compareVersions: Signal<readonly [string, string] | null>;
  collapsed: Signal<ReadonlySet<string>>;
}>;

// 装载/筛选/分页/详情闭包（变更动作经 createBomMutations 注入 sync/reloadDetail）。
export function createBomActions(ports: BomConsolePorts, bundle: BomBundle) {
  let requestSequence = 0;
  let detailSequence = 0;
  const isFiltered = (): boolean =>
    bundle.productFilter.value !== ALL_PRODUCTS ||
    bundle.statusFilter.value !== 'ALL' ||
    bundle.appliedQuery.value !== '';
  const pageQuery = (cursor?: string): BomPageQuery => ({
    ...(bundle.productFilter.value === ALL_PRODUCTS
      ? {}
      : { productType: bundle.productFilter.value }),
    ...(bundle.statusFilter.value === 'ALL' ? {} : { status: bundle.statusFilter.value }),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: BOM_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  const messageOf = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback;
  const loadFailed = (error: unknown, fallback: string): void => {
    bundle.loadError.value = messageOf(error, fallback);
  };
  const actionFailed = (error: unknown, fallback: string): void => {
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = messageOf(error, fallback);
    else bundle.actionError.value = messageOf(error, fallback);
  };
  const showAll = (): void => {
    requestSequence += 1;
    bundle.actionError.value = '';
    bundle.boms.value = bundle.snapshot.value;
    bundle.nextCursor.value = null;
    bundle.loadError.value = '';
    bundle.loading.value = false;
  };
  const reload = async (): Promise<void> => {
    const sequence = ++requestSequence;
    bundle.loading.value = true;
    try {
      const page = await ports.fetchPage(pageQuery());
      if (sequence !== requestSequence) return;
      bundle.boms.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, 'BOM 加载失败');
    } finally {
      if (sequence === requestSequence) bundle.loading.value = false;
    }
  };
  const loadMore = async (): Promise<void> => {
    const cursor = bundle.nextCursor.value;
    if (cursor === null || bundle.loadingMore.value) return;
    const sequence = requestSequence;
    bundle.loadingMore.value = true;
    try {
      const page = await ports.fetchPage(pageQuery(cursor));
      if (sequence !== requestSequence) return;
      bundle.boms.value = [...bundle.boms.value, ...page.items];
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '继续加载失败');
    } finally {
      bundle.loadingMore.value = false;
    }
  };
  const sync = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.snapshot.value = await ports.refresh();
      if (isFiltered()) await reload();
      else showAll();
    } catch (error: unknown) {
      loadFailed(error, 'BOM 刷新失败');
      bundle.loading.value = false;
    }
  };
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const bomId = row ? ports.textValue(row.bomId ?? row.id, '') : '';
    if (!row || bomId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    bundle.compareVersions.value = null;
    bundle.collapsed.value = new Set();
    try {
      const detail = await ports.loadDetail(bomId);
      if (sequence === detailSequence && detail) bundle.detail.value = detail;
    } catch {
      // 详情读取失败静默回退列表行数据。
    } finally {
      if (sequence === detailSequence) bundle.detailLoading.value = false;
    }
  };
  const settle = (): void => {
    if (isFiltered()) void reload();
    else showAll();
  };

  return {
    isFiltered,
    sync,
    settle,
    loadMore,
    reloadDetail,
    actionFailed,
    open: (row: BomRow | null): void => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      bundle.detail.value = null;
      if (row === null) detailSequence += 1;
      void reloadDetail();
    },
    openCreate: (): void => {
      bundle.activeForm.value = 'create';
      bundle.submitError.value = '';
    },
    toggleNode: (bomVersionId: string): void => {
      const next = new Set(bundle.collapsed.value);
      if (next.has(bomVersionId)) next.delete(bomVersionId);
      else next.add(bomVersionId);
      bundle.collapsed.value = next;
    },
    applySearch: (): void => {
      bundle.appliedQuery.value = bundle.search.value.trim();
      settle();
    },
    clearSearch: (): void => {
      bundle.search.value = '';
      bundle.appliedQuery.value = '';
      settle();
    },
  };
}

// 变更动作工厂（G5 拆分：装载/筛选与变更闭包分离）：行级发布与创建载荷。装载侧的
// sync/reloadDetail/actionFailed 经 io 注入（避免闭包互相穿透）。
export function createBomMutations(
  ports: BomConsolePorts,
  bundle: BomBundle,
  io: Readonly<{
    sync: () => Promise<void>;
    reloadDetail: () => Promise<void>;
    actionFailed: (error: unknown, fallback: string) => void;
  }>,
) {
  let rowSequence = 0;
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
    bundle.componentRows.value = ['r1'];
  };

  // 草稿发布走现代化统一动作端点 PUT /:id/publish（分派 legacy publish('bom') 同链）。
  const runPublish = async (row: BomRow): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit(
        `/api/v1/manufacturing-boms/${ports.textValue(row.id ?? row.bom_id, '')}/publish`,
        {},
        'PUT',
      );
      await io.sync();
      const opened = bundle.selected.value;
      if (opened) {
        const openedId = ports.textValue(opened.bomId ?? opened.id, '');
        bundle.selected.value =
          bundle.snapshot.value.find(
            (candidate) => ports.textValue(candidate.bomId ?? candidate.id, '') === openedId,
          ) ?? opened;
        bundle.detail.value = null;
        await io.reloadDetail();
      }
    } catch (error: unknown) {
      io.actionFailed(error, '版本发布失败');
    }
  };

  // 创建载荷与原 vanilla「创建标准 BOM」表单逐字节一致（productItemId 取所选版本行
  // 的 itemId、outputQuantity '1'、publish 恒 false；首行字段裸名与 legacy 对齐，
  // 追加行带前缀；替代料 priority 1 / conversionFactor '1'）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    const choiceOf = (versionId: string): string =>
      ports.itemVersionChoices.find((choice) => choice.value === versionId)?.itemId ?? '';
    const field = (row: string, name: string): string =>
      values[row === 'r1' ? name : `${row}:${name}`] ?? '';
    try {
      await ports.submit('/api/v1/manufacturing-boms', {
        code: values.code ?? '',
        name: values.name ?? '',
        productItemId: choiceOf(values.product ?? ''),
        productItemVersionId: values.product ?? '',
        outputQuantity: '1',
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        lines: bundle.componentRows.value.map((row) => {
          const substitute = field(row, 'substitute');
          return {
            componentItemVersionId: field(row, 'component'),
            quantity: field(row, 'quantity'),
            scrapBasisPoints: Number(field(row, 'scrap') || '0'),
            substitutes: substitute
              ? [{ itemVersionId: substitute, priority: 1, conversionFactor: '1' }]
              : [],
          };
        }),
        publish: false,
      });
    } catch (error: unknown) {
      io.actionFailed(error, 'BOM 创建失败');
      return;
    }
    closeForm();
    await io.sync();
  };

  return {
    closeForm,
    runPublish,
    runCreate,
    addComponentRow: (): void => {
      rowSequence += 1;
      bundle.componentRows.value = [...bundle.componentRows.value, `r${String(rowSequence + 1)}`];
    },
    removeComponentRow: (rowId: string): void => {
      bundle.componentRows.value = bundle.componentRows.value.filter((row) => row !== rowId);
    },
  };
}
