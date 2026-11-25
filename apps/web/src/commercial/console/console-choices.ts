import type { OperationsViewContext } from '../operations-view-ports';

// TD-WF-007（写流程冒烟 WS-P2-04）：表单下拉选项是页面挂载时的快照。各宿主在挂载那一刻从 controller.views
// 算出 itemVersionChoices / supplierChoices / openOrderLineChoices，之后不再更新——刚建的供应商在采购订单
// 表单里选不到、刚签发的订单在收货表单里选不到、刚发布的物料在 BOM 表单里选不到，整页刷新才出现。
//
// 控制台每次写操作之后都会经 refresh 端口做一次 controller.load()，把全部视图重读一遍。所以选项改为
// 「读取时按最新视图计算」：宿主把下面这两个函数的返回值挂成 ports 上的 getter，表单每次渲染拿到的
// 就是当前快照里的选项。不新增任何请求，首屏请求不变。
type Row = Readonly<Record<string, unknown>>;
type Views = OperationsViewContext['controller']['views'];
type RecordText = OperationsViewContext['ports']['recordText'];

export type Choice = Readonly<{ value: string; label: string }>;
export type ItemVersionChoice = Readonly<{ value: string; label: string; itemId: string }>;

export const ITEM_VERSIONS_PATH = '/api/v1/manufacturing-items';

/**
 * 按视图数组缓存的取数函数。controller.load 每次重读都会给视图换一个新的数组，数组身份一变才重算；
 * 同一份快照内反复读取（列表每行、表单每次渲染）返回同一个结果。
 */
export function perView<T>(
  views: Views,
  path: string,
  build: (rows: readonly Row[]) => T,
): () => T {
  let seen: readonly Row[] | undefined;
  let cached: T | undefined;
  return () => {
    const rows = views.get(path) ?? [];
    if (cached === undefined || rows !== seen) {
      seen = rows;
      cached = build(rows);
    }
    return cached;
  };
}

/** 已发布物料版本行（各采购 / 制造表单的物料下拉同源）。 */
export const publishedItemRows = (rows: readonly Row[], recordText: RecordText): readonly Row[] =>
  rows.filter((row) => recordText(row, 'status', 'status') === 'PUBLISHED');

/**
 * 物料根 id → 「SKU · 名称」（TD-WF-010：BOM / 工艺路线列表的「产品」列此前直接显示 productItemId，
 * 一个 UUID）。清单一行是一个版本，同一物料有多个版本行：优先取已发布的那一版，没有则取第一行。
 */
export const itemLabelByIdOf = (
  rows: readonly Row[],
  recordText: RecordText,
): ReadonlyMap<string, string> => {
  const labels = new Map<string, string>();
  for (const row of rows) {
    const itemId = recordText(row, 'itemId', 'itemId');
    if (itemId === '') continue;
    if (!labels.has(itemId) || recordText(row, 'status', 'status') === 'PUBLISHED')
      labels.set(itemId, `${recordText(row, 'sku', 'sku')} · ${recordText(row, 'name', 'name')}`);
  }
  return labels;
};

/** 已发布物料版本选项。制造编辑器按需区分同一 SKU 的多版。 */
export const itemVersionChoicesOf = (
  rows: readonly Row[],
  recordText: RecordText,
  distinguishVersions = false,
): readonly ItemVersionChoice[] => {
  const published = publishedItemRows(rows, recordText);
  const versionsByItem = new Map<string, number>();
  if (distinguishVersions) {
    for (const row of published) {
      const itemId = recordText(row, 'itemId', 'itemId');
      versionsByItem.set(itemId, (versionsByItem.get(itemId) ?? 0) + 1);
    }
  }
  return published.map((row) => {
    const label = `${recordText(row, 'sku', 'sku')} · ${recordText(row, 'name', 'name')}`;
    const itemId = recordText(row, 'itemId', 'itemId');
    const version =
      (versionsByItem.get(itemId) ?? 0) > 1 ? recordText(row, 'version', 'version') : '';
    return {
      value: recordText(row, 'id', 'id'),
      label: version === '' ? label : `第 ${version} 版 · ${label}`,
      itemId,
    };
  });
};
