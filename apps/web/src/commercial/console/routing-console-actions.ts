// U3-MFG-3：工艺路线控制台动作工厂（自 RoutingConsolePage 拆分——G5 ≤200 行纪律，
// 沿 bom-console-actions 先例）。装载/筛选分页闭包（createRoutingLoaders）与变更
// 闭包（createRoutingMutations：行级发布/创建载荷/工序编辑器）分离；bundle 为页面
// signal 束的最小面，请求序号守卫丢弃过期响应。
import type { Signal } from '@preact/signals';
import {
  ALL_PRODUCTS,
  ROUTING_PAGE_SIZE,
  type RoutingProductFilter,
  type RoutingStatusFilter,
} from './routing-state';
import type { RoutingConsolePorts, RoutingPageQuery, RoutingRow } from './routing-ports';
import { failureMessage } from '../../shared/api-error-message';

export type RoutingBundle = Readonly<{
  snapshot: Signal<readonly RoutingRow[]>;
  routings: Signal<readonly RoutingRow[]>;
  nextCursor: Signal<string | null>;
  productFilter: Signal<RoutingProductFilter>;
  statusFilter: Signal<RoutingStatusFilter>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<RoutingRow | null>;
  detail: Signal<RoutingRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<'create' | null>;
  operationRows: Signal<readonly string[]>;
}>;

// 装载/筛选/分页/详情闭包（变更动作经 createRoutingMutations 注入 io）。
export function createRoutingActions(ports: RoutingConsolePorts, bundle: RoutingBundle) {
  let requestSequence = 0;
  let detailSequence = 0;
  const isFiltered = (): boolean =>
    bundle.productFilter.value !== ALL_PRODUCTS ||
    bundle.statusFilter.value !== 'ALL' ||
    bundle.appliedQuery.value !== '';
  const pageQuery = (cursor?: string): RoutingPageQuery => ({
    ...(bundle.productFilter.value === ALL_PRODUCTS
      ? {}
      : { productType: bundle.productFilter.value }),
    ...(bundle.statusFilter.value === 'ALL' ? {} : { status: bundle.statusFilter.value }),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: ROUTING_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  // 失败文案统一经 failureMessage：接口的常见英文消息转成中文，其余原样（TD-WF-006）。
  const messageOf = failureMessage;
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
    bundle.routings.value = bundle.snapshot.value;
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
      bundle.routings.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '工艺路线加载失败');
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
      bundle.routings.value = [...bundle.routings.value, ...page.items];
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
      loadFailed(error, '工艺路线刷新失败');
      bundle.loading.value = false;
    }
  };
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const routingId = row ? ports.textValue(row.routingId ?? row.id, '') : '';
    if (!row || routingId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    try {
      const detail = await ports.loadDetail(routingId);
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
    open: (row: RoutingRow | null): void => {
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

// 变更动作工厂（G5 拆分）：行级发布、创建载荷（与 vanilla 表单逐字节一致）、工序
// 编辑器（增删/上移下移/模板行）。装载侧 io 经注入（避免闭包互相穿透）。
export function createRoutingMutations(
  ports: RoutingConsolePorts,
  bundle: RoutingBundle,
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
    bundle.operationRows.value = ['o1'];
  };

  // 草稿发布走现代化统一动作端点 PUT /:id/publish（分派 legacy publish('routing') 同链）。
  const runPublish = async (row: RoutingRow): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit(
        `/api/v1/manufacturing-routings/${ports.textValue(row.id ?? row.routing_id, '')}/publish`,
        {},
        'PUT',
      );
      await io.sync();
      const opened = bundle.selected.value;
      if (opened) {
        const openedId = ports.textValue(opened.routingId ?? opened.id, '');
        bundle.selected.value =
          bundle.snapshot.value.find(
            (candidate) => ports.textValue(candidate.routingId ?? candidate.id, '') === openedId,
          ) ?? opened;
        bundle.detail.value = null;
        await io.reloadDetail();
      }
    } catch (error: unknown) {
      io.actionFailed(error, '版本发布失败');
    }
  };

  // 创建载荷与原 vanilla「创建标准工艺路线」表单逐字节一致（单工序 TUFT 场景：
  // productItemId 取所选版本行的 itemId、publish 恒 false、effectiveAt 归一、
  // sequence 10、instructions {}）；多工序为同端点形状的 additive 能力（sequence
  // 按行序 10/20/30… 重排）。工序行字段名一律带行前缀（与载荷无关——见
  // routing-state.operationsOf 注记）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    const choiceOf = (versionId: string): string =>
      ports.itemVersionChoices.find((choice) => choice.value === versionId)?.itemId ?? '';
    const field = (row: string, name: string): string => values[`${row}:${name}`] ?? '';
    try {
      await ports.submit('/api/v1/manufacturing-routings', {
        code: values.code ?? '',
        name: values.name ?? '',
        productItemId: choiceOf(values.product ?? ''),
        productItemVersionId: values.product ?? '',
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        operations: bundle.operationRows.value.map((row, index) => ({
          operationCode: field(row, 'operationCode'),
          name: field(row, 'name'),
          workCenterCode: field(row, 'workCenterCode'),
          sequence: (index + 1) * 10,
          setupMinutes: field(row, 'setupMinutes'),
          runMinutesPerUnit: field(row, 'runMinutesPerUnit'),
          instructions: {},
        })),
        publish: false,
      });
    } catch (error: unknown) {
      io.actionFailed(error, '工艺路线创建失败');
      return;
    }
    closeForm();
    await io.sync();
  };

  return {
    closeForm,
    runPublish,
    runCreate,
    addOperationRow: (): void => {
      rowSequence += 1;
      bundle.operationRows.value = [...bundle.operationRows.value, `o${String(rowSequence + 1)}`];
    },
    removeOperationRow: (rowId: string): void => {
      bundle.operationRows.value = bundle.operationRows.value.filter((row) => row !== rowId);
    },
    moveOperationRow: (rowId: string, direction: 'up' | 'down'): void => {
      const rows = [...bundle.operationRows.value];
      const index = rows.indexOf(rowId);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= rows.length) return;
      rows[index] = rows[target] ?? rowId;
      rows[target] = rowId;
      bundle.operationRows.value = rows;
    },
  };
}
