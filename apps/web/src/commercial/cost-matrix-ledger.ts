import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CostMatrixAttention, CostMatrixSort } from './types';
import type { CostViewContext } from './pricing-view-ports';

export function appendCostLedgerHeading(context: CostViewContext): void {
  const {
    controller,
    permissions,
    matrices,
    itemVersions,
    matrixSection,
    costDialogHost,
    setCostStatus,
    replaceCostMatrixSection,
  } = context;
  const { recordValue, costMatrixRoleGuidance } = context.ports;
  const matrixHeading = el('div', 'pipeline-heading');
  const matrixHeadingCopy = el('div');
  matrixHeadingCopy.append(
    el('h3', '', '规格成本模型台账'),
    el('p', 'muted', costMatrixRoleGuidance(permissions)),
  );
  matrixHeading.append(matrixHeadingCopy);
  if (permissions.has('cost-matrix:manage')) {
    const createMatrix = el('button', 'primary', '新建规格模型');
    createMatrix.addEventListener('click', () => {
      openForm(
        costDialogHost(),
        '新建规格成本模型',
        '每种成品规格独立维护成本因子、税率和价格来源。',
        [
          { name: 'code', label: '规格模型编号', required: true, placeholder: 'KT-50-3/8' },
          {
            name: 'name',
            label: '产品规格名称',
            required: true,
            placeholder: '50mm 单丝加密型',
          },
          ...(itemVersions.length
            ? [
                {
                  name: 'productItemVersionId',
                  label: '关联成品规格',
                  type: 'select' as const,
                  required: false,
                  options: [{ value: '', label: '暂不关联' }, ...itemVersions],
                },
              ]
            : []),
          {
            name: 'currency',
            label: '币种',
            type: 'select',
            required: true,
            options: [{ value: 'CNY', label: '人民币' }],
          },
          {
            name: 'defaultTaxRate',
            label: '默认税率（小数）',
            type: 'number',
            required: true,
            value: '0.13',
          },
        ],
        '创建模型',
        async (values) => {
          await controller.submit('/api/v1/cost-matrices', {
            code: values.code ?? '',
            name: values.name ?? '',
            ...(values.productItemVersionId
              ? { productItemVersionId: values.productItemVersionId }
              : {}),
            productSpecification: { displayName: values.name ?? '' },
            currency: values.currency ?? 'CNY',
            defaultTaxRate: values.defaultTaxRate ?? '0.13',
          });
          await controller.loadCostMatrixPage({ page: 1 });
          controller.message = `${values.name ?? '规格模型'}已创建`;
          setCostStatus(controller.message);
          replaceCostMatrixSection();
        },
      );
    });
    matrixHeading.append(createMatrix);
  }
  matrixSection.append(matrixHeading);

  const missingOnPage = matrices.filter(
    (matrix) =>
      Number(matrix.factorCount ?? 0) === 0 ||
      Number(matrix.missingPriceCount ?? 0) > 0 ||
      Number(matrix.missingSourceCount ?? 0) > 0,
  ).length;
  const recalculateOnPage = matrices.filter((matrix) => matrix.needsRecalculation === true).length;
  const inQuoteOnPage = matrices.filter((matrix) =>
    Boolean(recordValue(matrix.latestCalculation).costDecisionId),
  ).length;
  const metrics = el('div', 'cost-matrix-ledger-metrics');
  for (const [label, value, tone] of [
    ['全部模型', String(controller.costMatrixTotal || matrices.length), ''],
    ['本页待补数据', String(missingOnPage), missingOnPage > 0 ? 'attention' : ''],
    ['本页待重新核算', String(recalculateOnPage), recalculateOnPage > 0 ? 'attention' : ''],
    ['本页已进入报价', String(inQuoteOnPage), 'success'],
  ] as const) {
    const metric = el('div', `cost-matrix-ledger-metric ${tone}`.trim());
    metric.append(el('span', '', label), el('strong', '', value));
    metrics.append(metric);
  }
  matrixSection.append(metrics);
}

export function appendCostLedgerToolbar(context: CostViewContext): void {
  const { controller, matrixSection, setCostStatus, replaceCostMatrixSection } = context;
  const toolbar = el('div', 'cost-matrix-toolbar cost-matrix-ledger-toolbar');
  const search = document.createElement('input');
  search.className = 'cost-matrix-search';
  search.type = 'search';
  search.placeholder = '搜索规格、名称、SKU 或模型编号';
  search.setAttribute('aria-label', '搜索成本模型');
  search.value = controller.costMatrixQuery.query;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener('input', () => {
    if (searchTimer) globalThis.clearTimeout(searchTimer);
    searchTimer = globalThis.setTimeout(() => {
      void controller
        .loadCostMatrixPage({ page: 1, query: search.value.trim() })
        .then(replaceCostMatrixSection)
        .catch((failure: unknown) => {
          setCostStatus(failure instanceof Error ? failure.message : '成本模型搜索失败');
        });
    }, 280);
  });
  const productFamily = document.createElement('input');
  productFamily.className = 'cost-matrix-filter';
  productFamily.type = 'search';
  productFamily.placeholder = '产品族';
  productFamily.setAttribute('aria-label', '筛选成本模型产品族');
  productFamily.value = controller.costMatrixQuery.productFamily;
  let productFamilyTimer: ReturnType<typeof setTimeout> | undefined;
  productFamily.addEventListener('input', () => {
    if (productFamilyTimer) globalThis.clearTimeout(productFamilyTimer);
    productFamilyTimer = globalThis.setTimeout(() => {
      void controller
        .loadCostMatrixPage({ page: 1, productFamily: productFamily.value.trim() })
        .then(replaceCostMatrixSection)
        .catch((failure: unknown) => {
          setCostStatus(failure instanceof Error ? failure.message : '产品族筛选失败');
        });
    }, 280);
  });
  const attention = el('select', 'cost-matrix-filter');
  attention.setAttribute('aria-label', '筛选成本模型处理状态');
  for (const [value, label] of [
    ['ALL', '全部处理状态'],
    ['NEEDS_INPUT', '待补价格或来源'],
    ['NEEDS_CALCULATION', '待重新核算'],
    ['READY_FOR_QUOTE', '可进入报价'],
    ['IN_QUOTE', '已进入报价'],
  ]) {
    const option = el('option', '', label ?? '');
    option.value = value ?? '';
    attention.append(option);
  }
  attention.value = controller.costMatrixQuery.attention;
  attention.addEventListener('change', () => {
    void controller
      .loadCostMatrixPage({
        page: 1,
        attention: attention.value as CostMatrixAttention,
      })
      .then(replaceCostMatrixSection)
      .catch((failure: unknown) => {
        setCostStatus(failure instanceof Error ? failure.message : '成本模型筛选失败');
      });
  });
  const sort = el('select', 'cost-matrix-filter');
  sort.setAttribute('aria-label', '排序成本模型');
  for (const [value, label] of [
    ['ATTENTION', '异常优先'],
    ['UPDATED', '最近更新'],
    ['COST_DESC', '综合成本从高到低'],
    ['CODE', '模型编号'],
  ]) {
    const option = el('option', '', label ?? '');
    option.value = value ?? '';
    sort.append(option);
  }
  sort.value = controller.costMatrixQuery.sort;
  sort.addEventListener('change', () => {
    void controller
      .loadCostMatrixPage({ page: 1, sort: sort.value as CostMatrixSort })
      .then(replaceCostMatrixSection)
      .catch((failure: unknown) => {
        setCostStatus(failure instanceof Error ? failure.message : '成本模型排序失败');
      });
  });
  toolbar.append(search, productFamily, attention, sort);
  matrixSection.append(toolbar);
}

export function appendCostLedgerRows(context: CostViewContext): void {
  const { controller, matrices, matrixSection, openMatrix } = context;
  const { textValue, recordValue } = context.ports;
  const ledger = el('div', 'cost-matrix-ledger');
  ledger.setAttribute('role', 'table');
  const header = el('div', 'cost-matrix-ledger-row header');
  header.setAttribute('role', 'row');
  for (const label of [
    '模型 / 产品规格',
    '因子完整度',
    '最近综合成本',
    '处理状态',
    '最近更新',
    '操作',
  ])
    header.append(el('span', '', label));
  ledger.append(header);
  for (const cell of Array.from(header.children)) cell.setAttribute('role', 'columnheader');
  for (const matrix of matrices) {
    const latest = recordValue(matrix.latestCalculation);
    const factorCount = Number(
      matrix.factorCount ?? (Array.isArray(matrix.factors) ? matrix.factors.length : 0),
    );
    const missing = Number(matrix.missingPriceCount ?? 0) + Number(matrix.missingSourceCount ?? 0);
    const state = costMatrixLedgerState(matrix, latest, factorCount, missing);
    const row = el('div', 'cost-matrix-ledger-row');
    row.setAttribute('role', 'row');
    const identity = el('div', 'cost-matrix-ledger-identity');
    const openName = el(
      'button',
      'cost-matrix-ledger-link',
      textValue(matrix.name, '未命名规格模型'),
    );
    openName.addEventListener('click', () => {
      openMatrix(matrix, openName);
    });
    identity.append(
      openName,
      el(
        'small',
        '',
        `${textValue(matrix.code, '规格')} · ${textValue(matrix.productSku, '未关联 SKU')}${matrix.isSystemPreset === true ? ' · 系统预置' : ''}`,
      ),
    );
    const completeness = el('div', 'cost-matrix-completeness');
    completeness.append(
      el('strong', '', `${String(factorCount)} 个因子`),
      el(
        'small',
        missing > 0 ? 'attention-text' : '',
        missing > 0 ? `${String(missing)} 项需补充` : '价格依据完整',
      ),
    );
    const cost = el('div', 'cost-matrix-ledger-cost');
    cost.append(
      el('strong', '', latest.id ? `¥ ${Number(latest.totalCost ?? 0).toFixed(2)}` : '—'),
      el(
        'small',
        '',
        latest.id
          ? textValue(latest.pricingMode, '') === 'TAX_EXCLUSIVE'
            ? '未税口径'
            : '含税口径'
          : '等待核算',
      ),
    );
    const stateCell = el('div', `cost-matrix-ledger-state ${state.className}`.trim());
    stateCell.append(el('span', '', state.label));
    const updated = textValue(matrix.updatedAt, textValue(latest.calculatedAt, ''));
    const action = el('div', 'cost-matrix-ledger-actions');
    const view = el('button', 'secondary compact-action', '查看模型');
    view.addEventListener('click', () => {
      openMatrix(matrix, view);
    });
    action.append(view);
    row.append(
      identity,
      completeness,
      cost,
      stateCell,
      el('span', '', updated ? new Date(updated).toLocaleDateString('zh-CN') : '—'),
      action,
    );
    for (const [index, label] of [
      '模型 / 产品规格',
      '因子完整度',
      '最近综合成本',
      '处理状态',
      '最近更新',
      '操作',
    ].entries()) {
      row.children[index]?.setAttribute('data-field-label', label);
      row.children[index]?.setAttribute('role', 'cell');
    }
    ledger.append(row);
  }
  if (matrices.length === 0)
    ledger.append(
      el(
        'p',
        'pipeline-empty',
        controller.costMatrixQuery.query ||
          controller.costMatrixQuery.productFamily ||
          controller.costMatrixQuery.attention !== 'ALL'
          ? '没有符合当前条件的成本模型，请调整搜索或筛选条件。'
          : '暂无规格成本模型。请先按常用产品规格建立模型。',
      ),
    );
  matrixSection.append(ledger);
}

export function appendCostLedgerPagination(context: CostViewContext): void {
  const { controller, matrixSection, setCostStatus, replaceCostMatrixSection } = context;
  const pageCount = Math.max(
    1,
    Math.ceil(controller.costMatrixTotal / controller.costMatrixQuery.pageSize),
  );
  const pagination = el('div', 'cost-matrix-pagination');
  const previous = el('button', 'secondary', '上一页');
  previous.disabled = controller.costMatrixQuery.page <= 1;
  previous.addEventListener('click', () => {
    previous.disabled = true;
    next.disabled = true;
    setCostStatus('正在加载成本模型…');
    void controller
      .loadCostMatrixPage({ page: controller.costMatrixQuery.page - 1 })
      .then((accepted) => {
        if (accepted)
          setCostStatus(`已加载第 ${String(controller.costMatrixQuery.page)} 页成本模型`);
        replaceCostMatrixSection(accepted);
      })
      .catch((failure: unknown) => {
        setCostStatus(failure instanceof Error ? failure.message : '分页加载失败，请重试');
        previous.disabled = controller.costMatrixQuery.page <= 1;
        next.disabled = controller.costMatrixQuery.page >= pageCount;
      });
  });
  const next = el('button', 'secondary', '下一页');
  next.disabled = controller.costMatrixQuery.page >= pageCount;
  next.addEventListener('click', () => {
    previous.disabled = true;
    next.disabled = true;
    setCostStatus('正在加载成本模型…');
    void controller
      .loadCostMatrixPage({ page: controller.costMatrixQuery.page + 1 })
      .then((accepted) => {
        if (accepted)
          setCostStatus(`已加载第 ${String(controller.costMatrixQuery.page)} 页成本模型`);
        replaceCostMatrixSection(accepted);
      })
      .catch((failure: unknown) => {
        setCostStatus(failure instanceof Error ? failure.message : '分页加载失败，请重试');
        previous.disabled = controller.costMatrixQuery.page <= 1;
        next.disabled = controller.costMatrixQuery.page >= pageCount;
      });
  });
  pagination.append(
    previous,
    el(
      'span',
      '',
      `第 ${String(controller.costMatrixQuery.page)} / ${String(pageCount)} 页 · 共 ${String(controller.costMatrixTotal)} 个模型`,
    ),
    next,
  );
  matrixSection.append(pagination);
}

export function appendCostMatrixLedger(context: CostViewContext): void {
  appendCostLedgerHeading(context);
  appendCostLedgerToolbar(context);

  appendCostLedgerRows(context);

  appendCostLedgerPagination(context);
}

function costMatrixLedgerState(
  matrix: Record<string, unknown>,
  latest: Record<string, unknown>,
  factorCount: number,
  missing: number,
) {
  return factorCount === 0 || missing > 0
    ? {
        label: factorCount === 0 ? '尚未配置因子' : `待补 ${String(missing)} 项数据`,
        className: 'attention',
      }
    : matrix.needsRecalculation === true
      ? { label: '待重新核算', className: 'attention' }
      : latest.costDecisionId
        ? { label: '已进入报价', className: 'success' }
        : latest.id
          ? { label: '可进入报价', className: 'ready' }
          : { label: '尚未核算', className: '' };
}
