import { ActionBar } from '@kingturf/ui';
import type { CostMatrixRow } from './cost-matrix-ports';
import type { MatrixPageState } from './cost-matrix-console';
import './commercial-ux.css';

// COM-UX 成本矩阵因子对比：列表多选模型（≤ MAX_COMPARE_MODELS）后，把同一因子在各模型中的
// 含税单价与取价来源并排。数据模型中每个因子只绑定一个取价来源，「多供应商并排」即同一
// 因子在不同模型里绑定的来源并排；真正的供应商多报价横向比价需接供应商报价数据面（见台账）。
export const MAX_COMPARE_MODELS = 4;

export type CompareModel = Readonly<{
  id: string;
  code: string;
  name: string;
  currency: string;
  factors: readonly CostMatrixRow[];
  /** 详情加载失败原因；空串 = 正常。 */
  error: string;
}>;

export type ComparisonState = Readonly<{ loading: boolean; models: readonly CompareModel[] }>;

export type CompareCell = Readonly<{
  /** 含税单价；未录入（≤0）或不可解析 = null。 */
  price: number | null;
  quantity: number | null;
  /** 单位产品耗用金额 = 耗用量 × 单价。 */
  amount: number | null;
  sourceType: string;
  source: string;
  effectiveAt: string;
}>;

export type CompareRow = Readonly<{
  code: string;
  unit: string;
  name: string;
  cells: readonly (CompareCell | null)[];
  /** 最优单元格列号；可比较取价不足两个时为 null。 */
  best: number | null;
}>;

export type Comparison = Readonly<{
  rows: readonly CompareRow[];
  totals: readonly (number | null)[];
  bestTotal: number | null;
  totalsComparable: boolean;
}>;

type PortsFace = Pick<MatrixPageState['ports'], 'textValue' | 'recordValue'>;

// 来源类型的短标签（与 cost-factor-form SOURCE_OPTIONS 同值域，仅取便于并排显示的短名）。
const SOURCE_SHORT_LABELS: Readonly<Record<string, string>> = {
  PURCHASE_ORDER: '采购订单',
  SUPPLIER_QUOTE: '供应商报价',
  MARKET_REFERENCE: '市场参考',
  INTERNAL_BENCHMARK: '计划基准',
  MANUAL: '手工录入',
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cellOf = (factor: CostMatrixRow, ports: PortsFace): CompareCell => {
  const parsed = toNumber(factor.manualUnitPriceTaxInclusive);
  const price = parsed !== null && parsed > 0 ? parsed : null;
  const quantity = toNumber(factor.quantity);
  return {
    price,
    quantity,
    amount: price !== null && quantity !== null ? price * quantity : null,
    sourceType: ports.textValue(factor.sourceType, ''),
    source: ports.textValue(factor.priceSourceName, ''),
    effectiveAt: ports.textValue(factor.priceEffectiveAt, '').slice(0, 10),
  };
};

// 同一行内单位一致：至少两个已录价才标「最优」，取最低含税单价。
const bestOf = (cells: readonly (CompareCell | null)[]): number | null => {
  const priced = cells.flatMap((cell, index) =>
    cell?.price != null ? [{ index, price: cell.price }] : [],
  );
  if (priced.length < 2) return null;
  return priced.reduce((lowest, item) => (item.price < lowest.price ? item : lowest)).index;
};

// 行 = 因子 + 单位（单位不同不比价，分行呈现）；行序取首次出现的顺序。
export const buildComparison = (models: readonly CompareModel[], ports: PortsFace): Comparison => {
  type Draft = Readonly<{
    code: string;
    unit: string;
    name: string;
    cells: (CompareCell | null)[];
  }>;
  const drafts: Draft[] = [];
  const indexOf = new Map<string, number>();
  models.forEach((model, column) => {
    for (const factor of model.factors) {
      const code = ports.textValue(factor.factorCode, '') || ports.textValue(factor.factorName, '');
      if (code === '') continue;
      const unit = ports.textValue(factor.unitCode, '');
      const key = `${code}|${unit}`;
      let at = indexOf.get(key);
      if (at === undefined) {
        at = drafts.length;
        indexOf.set(key, at);
        drafts.push({
          code,
          unit,
          name: ports.textValue(factor.factorName, ''),
          cells: models.map(() => null),
        });
      }
      const draft = drafts[at];
      if (draft) draft.cells[column] = cellOf(factor, ports);
    }
  });
  const rows = drafts.map((draft) => ({
    ...draft,
    cells: [...draft.cells],
    best: bestOf(draft.cells),
  }));
  const totals = models.map((_model, column) => {
    const amounts = rows.flatMap((row) => {
      const amount = row.cells[column]?.amount;
      return amount == null ? [] : [amount];
    });
    return amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) : null;
  });
  // 合计只在各模型因子集与取价完整度一致时才可比（否则最低合计没有意义）。
  const complete = models.map((_model, column) =>
    rows.every((row) => row.cells[column]?.price != null),
  );
  const pricedTotals = totals.flatMap((total) => (total == null ? [] : [total]));
  const totalsComparable =
    models.length >= 2 && complete.every(Boolean) && pricedTotals.length === models.length;
  const bestTotal = totalsComparable
    ? pricedTotals.reduce(
        (best, total, index) => (total < (pricedTotals[best] ?? total) ? index : best),
        0,
      )
    : null;
  return { rows, totals, bestTotal, totalsComparable };
};

const quantityText = (cell: CompareCell): string =>
  cell.quantity === null ? '—' : String(cell.quantity);

// 对比栏：选中即出现；不足两个模型时「对比因子」不可用。
export const CompareBar = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const count = state.selectedIds.size;
  if (count === 0) return null;
  return (
    <ActionBar label="因子对比" count={count}>
      <button
        type="button"
        class="primary compact"
        data-testid="kt-matrix-compare-open"
        disabled={count < 2 || state.loading}
        onClick={() => {
          void state.openComparison();
        }}
      >
        对比因子
      </button>
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-matrix-compare-clear"
        onClick={state.clearSelection}
      >
        清除选择
      </button>
      {state.compareLimitNotice ? (
        <span
          class="console-hint"
          role="status"
        >{`最多同时对比 ${String(MAX_COMPARE_MODELS)} 个模型`}</span>
      ) : null}
    </ActionBar>
  );
};

const CompareCellView = ({
  cell,
  ports,
  isBest,
}: Readonly<{ cell: CompareCell | null; ports: MatrixPageState['ports']; isBest: boolean }>) => {
  if (!cell)
    return (
      <span class="com-compare-missing" aria-label="该模型无此因子或取价不可见">
        —
      </span>
    );
  const source = `${SOURCE_SHORT_LABELS[cell.sourceType] ?? cell.sourceType}${
    cell.source === '' ? '' : ` · ${cell.source}`
  }`;
  return (
    <>
      <span class="com-compare-price">
        {cell.price === null ? '未录价' : ports.decimalValue(cell.price)}
      </span>
      {isBest ? (
        <span class="com-tag" data-tone="success">
          最优
        </span>
      ) : null}
      <small class="com-compare-source">{source}</small>
      <small class="com-compare-source">{`耗用 ${quantityText(cell)} · ${
        cell.effectiveAt === '' ? '生效日期未填' : `生效 ${cell.effectiveAt}`
      }`}</small>
    </>
  );
};

// 对比面板：语义化表格（caption + 作用域表头），窄屏横向滚动；加载/失败/空态齐备。
export const ComparePanel = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const comparison = state.comparison;
  if (!comparison) return null;
  const { ports } = state;
  const result = buildComparison(comparison.models, ports);
  const { models } = comparison;
  return (
    <section class="com-compare" data-testid="kt-matrix-compare" aria-label="因子对比表">
      <header class="com-compare-head">
        <div>
          <h2 class="com-compare-title">因子对比</h2>
          <p class="console-hint">
            同一因子（同单位）在各模型中的含税单价与取价来源并排，最低价标记「最优」。
          </p>
        </div>
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-matrix-compare-close"
          onClick={state.closeComparison}
        >
          关闭对比
        </button>
      </header>
      {comparison.loading ? (
        <p class="com-compare-status" role="status">
          正在加载模型详情…
        </p>
      ) : (
        <div class="com-compare-scroll">
          <table class="com-compare-table">
            <caption>{`因子对比：${models.map((model) => model.code).join(' / ')}`}</caption>
            <thead>
              <tr>
                <th scope="col">因子</th>
                {models.map((model) => (
                  <th
                    scope="col"
                    class="com-compare-model"
                    data-testid={`kt-matrix-compare-column-${model.id}`}
                  >
                    <span>{model.code}</span>
                    <small>{`${model.name}${model.currency === '' ? '' : ` · ${model.currency}`}`}</small>
                    {model.error !== '' ? (
                      <span class="com-compare-error" role="alert">
                        {`加载失败：${model.error}`}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colspan={models.length + 1} class="com-compare-empty">
                    所选模型暂无因子
                  </td>
                </tr>
              ) : null}
              {result.rows.map((row) => (
                <tr key={`${row.code}|${row.unit}`} data-factor={`${row.code}|${row.unit}`}>
                  <th scope="row">
                    <span>{row.code}</span>
                    <small>{`${row.name}${row.unit === '' ? '' : ` · ${row.unit}`}`}</small>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={models[index]?.id ?? String(index)}
                      class={index === row.best ? 'is-best' : ''}
                      data-best={index === row.best ? 'true' : 'false'}
                    >
                      <CompareCellView cell={cell} ports={ports} isBest={index === row.best} />
                    </td>
                  ))}
                </tr>
              ))}
              {result.rows.length > 0 ? (
                <tr class="com-compare-total">
                  <th scope="row">
                    <span>因子合计（含税）</span>
                  </th>
                  {result.totals.map((total, index) => (
                    <td
                      key={models[index]?.id ?? String(index)}
                      class={index === result.bestTotal ? 'is-best' : ''}
                      data-best={index === result.bestTotal ? 'true' : 'false'}
                    >
                      <span class="com-compare-price">
                        {total === null ? '—' : ports.decimalValue(total)}
                      </span>
                      {index === result.bestTotal ? (
                        <span class="com-tag" data-tone="success">
                          最低
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
          {result.rows.length > 0 && !result.totalsComparable ? (
            <p class="console-hint">各模型因子集或取价完整度不同，合计不可直接比较。</p>
          ) : null}
        </div>
      )}
    </section>
  );
};
