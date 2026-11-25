// U3-COM-4（ADR-0014 分域重写）：规格成本模型控制台的动作工厂（WFD 拆分，G1 ≤800 行纪律）。创建、
// 因子增改、重算、报价成本决策 handoff、查询 / 分页，以及因子对比的选择与加载；函数体与拆分前逐字节
// 相同，只是加了 export。视图组件与页面工厂留在 cost-matrix-console.tsx。
import type { Signal } from '@preact/signals';
import type { CostMatrixPage, CostMatrixQuery } from '../types';
import type { CostMatrixConsolePorts, CostMatrixRow } from './cost-matrix-ports';
import {
  MAX_COMPARE_MODELS,
  type CompareModel,
  type ComparisonState,
} from './cost-matrix-console-compare';
import type { MatrixFormKind } from './cost-matrix-console';
import { failureMessage } from '../../shared/api-error-message';

// G5 拆分：动作工厂独立于状态工厂（每函数 ≤200 行）。
export type MatrixSignalBundle = Readonly<{
  page: Signal<CostMatrixPage>;
  query: Signal<CostMatrixQuery>;
  loadError: Signal<string>;
  submitError: Signal<string>;
  search: Signal<string>;
  productFamily: Signal<string>;
  loading: Signal<boolean>;
  selected: Signal<CostMatrixRow | null>;
  activeForm: Signal<MatrixFormKind>;
  editingFactor: Signal<CostMatrixRow | null>;
  selectedIds: Signal<ReadonlySet<string>>;
  compareLimitNotice: Signal<boolean>;
  comparison: Signal<ComparisonState | null>;
  // TD-WF-014①（WFD 补齐）：最近一次写操作的成功提示。
  notice: Signal<string>;
}>;

export type MatrixActions = Readonly<{
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runAddFactor: (values: Readonly<Record<string, string>>) => Promise<void>;
  runUpdateFactor: (values: Readonly<Record<string, string>>) => Promise<void>;
  runCalculate: (mode: 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE') => Promise<void>;
  runQuoteCostDecision: () => Promise<void>;
}>;

const applyPage = (bundle: MatrixSignalBundle, next: CostMatrixPage): void => {
  bundle.page.value = next;
  bundle.loadError.value = '';
};
export const closeForm = (bundle: MatrixSignalBundle): void => {
  bundle.activeForm.value = null;
  bundle.editingFactor.value = null;
  bundle.submitError.value = '';
};
export const fail = (error: unknown, bundle: MatrixSignalBundle, fallback: string): void => {
  const message = failureMessage(error, fallback);
  // 抽屉打开（含行级动作失败）就地呈现；列表级失败走表格错误面。
  if (bundle.selected.value !== null || bundle.activeForm.value !== null)
    bundle.submitError.value = message;
  else bundle.loadError.value = message;
};

export const runQueryFor = async (
  ports: CostMatrixConsolePorts,
  bundle: MatrixSignalBundle,
  next: CostMatrixQuery,
): Promise<void> => {
  bundle.loading.value = true;
  try {
    bundle.query.value = next;
    applyPage(bundle, await ports.querySummaries(next));
  } catch (error: unknown) {
    fail(error, bundle, '规格成本模型加载失败');
  } finally {
    bundle.loading.value = false;
  }
};

export const costMatrixActions = (
  ports: CostMatrixConsolePorts,
  bundle: MatrixSignalBundle,
): MatrixActions => {
  // WFD-2：抽屉里的详情与页面上的列表是各自读取的。添加 / 更新因子、重算之后此前只重读了抽屉里的
  // 详情，列表（状态、因子数、「本页待重新核算」计数）仍是写入之前的；按当前查询条件把列表重查一次。
  const reloadPage = (): Promise<void> => runQueryFor(ports, bundle, bundle.query.value);
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/cost-matrices', {
        code: values.code ?? '',
        name: values.name ?? '',
        ...(values.productItemVersionId
          ? { productItemVersionId: values.productItemVersionId }
          : {}),
        productSpecification: {},
        currency: values.currency ?? 'CNY',
        defaultTaxRate: values.defaultTaxRate ?? '0.13',
      });
      applyPage(bundle, await ports.refresh());
      closeForm(bundle);
      bundle.notice.value = `已创建规格成本模型 ${values.code ?? ''}`;
    } catch (error: unknown) {
      fail(error, bundle, '规格模型创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  const runAddFactor = async (values: Readonly<Record<string, string>>): Promise<void> => {
    const matrix = bundle.selected.value;
    if (!matrix) return;
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(`/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/factors`, {
        ...values,
      });
      const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
      if (fresh) bundle.selected.value = fresh;
      bundle.submitError.value = '';
      bundle.activeForm.value = null;
      await reloadPage();
      bundle.notice.value = `已添加因子 ${values.factorName ?? values.factorCode ?? ''}`;
    } catch (error: unknown) {
      fail(error, bundle, '因子添加失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  const runUpdateFactor = async (values: Readonly<Record<string, string>>): Promise<void> => {
    const matrix = bundle.selected.value;
    const factor = bundle.editingFactor.value;
    if (!matrix || !factor) return;
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/factors/${ports.textValue(factor.id, '')}`,
        { ...values },
        'PUT',
      );
      const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
      if (fresh) bundle.selected.value = fresh;
      closeForm(bundle);
      await reloadPage();
      // 说用户刚保存的名称（因子可能被改名），没有才退回原来的名称 / 编号。
      bundle.notice.value = `已更新因子 ${values.factorName ?? ports.textValue(factor.factorName ?? factor.factorCode, '')}`;
    } catch (error: unknown) {
      fail(error, bundle, '因子保存失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  const runCalculate = async (mode: 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE'): Promise<void> => {
    const matrix = bundle.selected.value;
    if (!matrix) return;
    bundle.loading.value = true;
    bundle.notice.value = '';
    bundle.submitError.value = '';
    try {
      await ports.submit(`/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/calculate`, {
        pricingMode: mode,
      });
      const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
      if (fresh) bundle.selected.value = fresh;
      await reloadPage();
      bundle.notice.value = `已重新核算（${mode === 'TAX_INCLUSIVE' ? '含税' : '未税'}成本）`;
    } catch (error: unknown) {
      fail(error, bundle, '矩阵重算失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  const runQuoteCostDecision = async () => {
    const matrix = bundle.selected.value;
    if (!matrix) return;
    const calculations = Array.isArray(matrix.calculations) ? matrix.calculations : [];
    const latest = calculations.length > 0 ? ports.recordValue(calculations[0]) : null;
    if (!latest || typeof latest.id !== 'string') return;
    bundle.loading.value = true;
    bundle.notice.value = '';
    bundle.submitError.value = '';
    try {
      const result = ports.recordValue(
        await ports.submit(
          `/api/v1/cost-matrix-calculations/${ports.textValue(latest.id, '')}/quote-cost-decision`,
          {
            technicalSolutionRevisionId: ports.textValue(
              latest.technicalSolutionRevisionId ?? matrix.technicalSolutionRevisionId,
              '',
            ),
            modelVersionId: ports.textValue(latest.modelVersionId ?? matrix.version, ''),
          },
        ),
      );
      // 成功后的去向是报价页（那里会预选这个成本决策）；状态行留在本页，回到本页时看得到。
      bundle.notice.value = '已生成报价成本决策，请到「销售报价」选用';
      if (typeof result.costDecisionId === 'string') ports.navigateToQuotes();
    } catch (error: unknown) {
      fail(error, bundle, '报价成本决策创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  return {
    runCreate,
    runAddFactor,
    runUpdateFactor,
    runCalculate,
    runQuoteCostDecision,
  };
};

// COM-UX 因子对比动作：选择截断到上限并提示；对比时逐个加载详情，失败的列就地呈现，
// 期间面板被关闭/重开则丢弃过期结果。
export const comparisonActions = (ports: CostMatrixConsolePorts, bundle: MatrixSignalBundle) => {
  let token = 0;
  const setSelection = (next: ReadonlySet<string>): void => {
    const ids = [...next];
    bundle.compareLimitNotice.value = ids.length > MAX_COMPARE_MODELS;
    bundle.selectedIds.value = new Set(ids.slice(0, MAX_COMPARE_MODELS));
  };
  const openComparison = async (): Promise<void> => {
    const ids = [...bundle.selectedIds.value];
    if (ids.length < 2) return;
    const current = ++token;
    const headerOf = (id: string): Omit<CompareModel, 'factors' | 'error'> => {
      const summary = bundle.page.value.items.find((item) => ports.textValue(item.id, '') === id);
      return {
        id,
        code: ports.textValue(summary?.code, id),
        name: ports.textValue(summary?.name, ''),
        currency: '',
      };
    };
    bundle.comparison.value = {
      loading: true,
      models: ids.map((id) => ({ ...headerOf(id), factors: [], error: '' })),
    };
    const models = await Promise.all(
      ids.map(async (id): Promise<CompareModel> => {
        try {
          const detail = await ports.loadMatrix(id);
          return {
            ...headerOf(id),
            currency: ports.textValue(detail?.currency, ''),
            factors: Array.isArray(detail?.factors) ? detail.factors : [],
            error: '',
          };
        } catch (error: unknown) {
          return {
            ...headerOf(id),
            factors: [],
            error: failureMessage(error, '矩阵详情加载失败'),
          };
        }
      }),
    );
    // 面板关闭会推进 token：过期结果直接丢弃。
    if (current !== token) return;
    bundle.comparison.value = { loading: false, models };
  };
  const closeComparison = (): void => {
    token += 1;
    bundle.comparison.value = null;
  };
  return {
    setSelection,
    openComparison,
    closeComparison,
    clearSelection: () => {
      setSelection(new Set());
      closeComparison();
    },
  };
};
