import { el } from '../dom';
import { formatBusinessDateTime } from '../shared/business-date';
import { openForm } from '../shared/forms';
import { factorPayload } from './cost-factor-form';
import { setAppRoute, appRouteFromHash } from '../shared/navigation';
import type {
  CostViewContext,
  CostDetailContext,
  CostDetailPanelsContext,
  PricingViewPorts,
} from './pricing-view-ports';

export function appendCostDetailHeading(context: CostDetailContext): void {
  const { controller, matrixSection, replaceCostMatrixSection, selectedMatrix, latest, factors } =
    context;
  const { textValue, recordValue, currencyLabel } = context.ports;
  const detailHeading = el('div', 'cost-matrix-detail-heading');
  const back = el('button', 'secondary cost-matrix-back', '← 返回成本模型');
  back.addEventListener('click', () => {
    controller.closeCostMatrix();
    replaceCostMatrixSection();
  });
  const headingCopy = el('div');
  headingCopy.append(
    el('p', 'eyebrow', textValue(selectedMatrix.code, '规格成本模型')),
    el('h3', '', textValue(selectedMatrix.name, '未命名规格模型')),
    el(
      'p',
      'muted',
      `${textValue(selectedMatrix.productSku, '未关联成品')} · ${currencyLabel(selectedMatrix.currency)} · 默认税率 ${(
        Number(selectedMatrix.defaultTaxRate ?? 0) * 100
      ).toFixed(0)}%`,
    ),
  );
  detailHeading.append(back, headingCopy);
  if (selectedMatrix.isSystemPreset === true)
    detailHeading.append(el('span', 'ctr-state state-approved', '系统预置'));
  matrixSection.append(detailHeading);

  const summary = el('div', 'cost-matrix-detail-summary');
  const missingFactors = factors.filter((candidate) => {
    const factor = recordValue(candidate);
    return (
      Number(factor.quantity ?? 0) > 0 &&
      (Number(factor.manualUnitPriceTaxInclusive ?? 0) <= 0 ||
        !textValue(factor.priceSourceName, '') ||
        !textValue(factor.priceEffectiveAt, ''))
    );
  }).length;
  for (const [label, value, tone] of [
    ['成本因子', `${String(factors.length)} 项`, ''],
    ['待补数据', `${String(missingFactors)} 项`, missingFactors > 0 ? 'attention' : ''],
    [
      '直接生产成本',
      latest.id ? `¥ ${Number(latest.directProductionCost ?? 0).toFixed(2)}` : '未核算',
      '',
    ],
    ['综合成本', latest.id ? `¥ ${Number(latest.totalCost ?? 0).toFixed(2)}` : '未核算', 'strong'],
  ] as const) {
    const metric = el('div', `cost-matrix-detail-metric ${tone}`.trim());
    metric.append(el('span', '', label), el('strong', '', value));
    summary.append(metric);
  }
  matrixSection.append(summary);
}

export function appendCostDetailActions(context: CostDetailContext): void {
  const {
    controller,
    permissions,
    matrixSection,
    costDialogHost,
    refreshCostWorkspace,
    factorFields,
    selectedId,
    selectedMatrix,
    latest,
  } = context;
  const { textValue } = context.ports;
  const detailActions = el('div', 'cost-matrix-detail-actions');
  const actionStatus = el(
    'p',
    'cost-matrix-action-status',
    latest.id
      ? `最近核算：${textValue(latest.pricingMode, '') === 'TAX_EXCLUSIVE' ? '未税成本' : '含税成本'} · ${textValue(latest.calculatedAt, '') ? formatBusinessDateTime(new Date(textValue(latest.calculatedAt, ''))) : '时间未知'}`
      : '尚未核算；请先核验所有价格来源。',
  );
  actionStatus.setAttribute('role', 'status');
  actionStatus.setAttribute('aria-live', 'polite');
  if (permissions.has('cost-matrix:manage')) {
    const add = el('button', 'secondary', '添加成本因子');
    add.addEventListener('click', () => {
      openForm(
        costDialogHost(),
        `添加因子 · ${textValue(selectedMatrix.name, '')}`,
        '按基本信息、耗用价格和追溯依据分区维护；采购来源须关联物料。',
        factorFields(selectedMatrix),
        '保存因子',
        async (values) => {
          await controller.submit(
            `/api/v1/cost-matrices/${selectedId}/factors`,
            factorPayload(values, true),
          );
          await refreshCostWorkspace(`${values.factorName ?? '成本因子'}已添加并显示`);
        },
        { className: 'cost-factor-dialog' },
      );
    });
    detailActions.append(add);
  }
  const calculateButtons: HTMLButtonElement[] = [];
  if (permissions.has('cost-matrix:calculate'))
    for (const [mode, label] of [
      ['TAX_INCLUSIVE', '重新核算含税成本'],
      ['TAX_EXCLUSIVE', '重新核算未税成本'],
    ] as const) {
      const calculate = createCostCalculateButton(
        context,
        mode,
        label,
        calculateButtons,
        actionStatus,
      );
      calculateButtons.push(calculate);
      detailActions.append(calculate);
    }
  appendCostQuoteActions(context, detailActions);
  matrixSection.append(detailActions, actionStatus);
}

export function appendCostDetailTabs(context: CostDetailContext): Map<string, HTMLElement> {
  const { matrixSection, selectedMatrix, factors, calculations, auditTrail } = context;

  const tabs = el('div', 'cost-matrix-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '成本模型详情');
  const tabPanels = new Map<string, HTMLElement>();
  const selectTab = (tabId: string) => {
    for (const button of Array.from(tabs.querySelectorAll<HTMLButtonElement>('button'))) {
      const selected = button.dataset.costMatrixTab === tabId;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const [id, panel] of tabPanels) panel.hidden = id !== tabId;
  };
  for (const [id, label] of [
    ['factors', `成本因子（${String(factors.length)}）`],
    ['calculations', `核算记录（${String(calculations.length)}）`],
    ['quote', '报价引用'],
    ['audit', `变更日志（${String(auditTrail.length)}）`],
  ]) {
    if (id === 'audit' && selectedMatrix.auditTrailVisible !== true) continue;
    const button = el('button', id === 'factors' ? 'active' : '', label ?? '');
    button.type = 'button';
    button.dataset.costMatrixTab = id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(id === 'factors'));
    button.id = `cost-tab-${id ?? ''}`;
    button.setAttribute('aria-controls', `cost-panel-${id ?? ''}`);
    button.tabIndex = id === 'factors' ? 0 : -1;
    button.addEventListener('keydown', (event) => {
      const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const index = buttons.indexOf(button);
      const nextIndex = costTabNextIndex(event, index, buttons);
      const next = buttons[nextIndex];
      if (!next) return;
      event.preventDefault();
      selectTab(next.dataset.costMatrixTab ?? 'factors');
      next.focus();
    });
    button.addEventListener('click', () => {
      selectTab(id ?? 'factors');
    });
    tabs.append(button);
  }
  matrixSection.append(tabs);

  return tabPanels;
}

export function appendCostFactorPanel(context: CostDetailPanelsContext): void {
  const {
    controller,
    permissions,
    categoryOptions,
    sourceOptions,
    matrixSection,
    costDialogHost,
    refreshCostWorkspace,
    factorFields,
    selectedId,
    selectedMatrix,
    factors,
    tabPanels,
  } = context;
  const { textValue, recordValue } = context.ports;
  const factorsPanel = el('section', 'cost-matrix-tab-panel cost-factor-ledger');
  factorsPanel.setAttribute('role', 'tabpanel');
  const factorHeader = el('div', 'cost-factor-ledger-row header');
  for (const label of ['成本因子', '类别', '耗用量', '价格来源', '含税单价', '参考成本', '操作'])
    factorHeader.append(el('span', '', label));
  factorsPanel.append(factorHeader);
  for (const candidate of factors) {
    const factor = recordValue(candidate);
    const procurementPriced =
      factor.sourceType === 'PURCHASE_ORDER' || factor.sourceType === 'SUPPLIER_QUOTE';
    const row = el('div', 'cost-factor-ledger-row');
    const identity = el('div', 'cost-factor-ledger-name');
    identity.append(
      el('strong', '', textValue(factor.factorName, '成本因子')),
      el('small', '', textValue(factor.factorCode, '')),
    );
    row.append(
      identity,
      el(
        'span',
        '',
        categoryOptions.find((option) => option.value === factor.category)?.label ??
          textValue(factor.category, '其他费用'),
      ),
      el(
        'span',
        'numeric',
        `${textValue(factor.quantity, '0')} ${textValue(factor.unitCode, 'EA')}/㎡`,
      ),
    );
    const source = el('div', 'cost-factor-ledger-source');
    source.append(
      el(
        'strong',
        '',
        sourceOptions.find((option) => option.value === factor.sourceType)?.label ??
          textValue(factor.sourceType, '人工录入'),
      ),
      el(
        'small',
        '',
        `${textValue(factor.priceSourceName, '未说明')} · ${textValue(factor.priceEffectiveAt, '未标日期')}`,
      ),
    );
    row.append(
      source,
      el(
        'span',
        'numeric',
        procurementPriced
          ? '核算时取有效采购价'
          : `¥ ${Number(factor.manualUnitPriceTaxInclusive ?? 0).toFixed(4)}`,
      ),
      el(
        'strong',
        'numeric cost-factor-amount',
        procurementPriced
          ? '以核算快照为准'
          : `¥ ${(
              Number(factor.quantity ?? 0) * Number(factor.manualUnitPriceTaxInclusive ?? 0)
            ).toFixed(4)}`,
      ),
    );
    const rowActions = el('div', 'cost-factor-ledger-actions');
    if (permissions.has('cost-matrix:manage') && factor.adjustable !== false) {
      const edit = el('button', 'secondary compact-action', '编辑');
      edit.setAttribute('aria-label', `编辑${textValue(factor.factorName, '成本因子')}`);
      edit.addEventListener('click', () => {
        openForm(
          costDialogHost(),
          `维护因子 · ${textValue(factor.factorName, '')}`,
          '采购来源需绑定物料；市场或企业基准必须保留来源和生效日期。',
          factorFields(selectedMatrix, factor),
          '保存因子',
          async (values) => {
            await controller.submit(
              `/api/v1/cost-matrices/${selectedId}/factors/${textValue(factor.id, '')}`,
              factorPayload(values, false),
              'PATCH',
            );
            await refreshCostWorkspace(`${textValue(factor.factorName, '成本因子')}已更新`);
          },
          { className: 'cost-factor-dialog' },
        );
      });
      rowActions.append(edit);
    } else rowActions.append(el('span', 'muted', '只读'));
    row.append(rowActions);
    for (const [index, label] of [
      '成本因子',
      '类别',
      '耗用量',
      '价格来源',
      '含税单价',
      '参考成本',
      '操作',
    ].entries())
      row.children[index]?.setAttribute('data-field-label', label);
    factorsPanel.append(row);
  }
  if (factors.length === 0)
    factorsPanel.append(
      el('p', 'pipeline-empty', '尚未配置成本因子。请先录入材料、人工、能源与预留费用。'),
    );
  tabPanels.set('factors', factorsPanel);
  matrixSection.append(factorsPanel);
}

export function appendCostHistoryPanels(context: CostDetailPanelsContext): void {
  const { matrixSection, selectedMatrix, latest, calculations, auditTrail, tabPanels } = context;
  const { textValue, recordValue, costMatrixAuditLabel } = context.ports;
  const calculationsPanel = el('section', 'cost-matrix-tab-panel cost-calculation-ledger');
  calculationsPanel.hidden = true;
  const calculationHeader = el('div', 'cost-calculation-row header');
  for (const label of ['核算时间', '口径', '直接成本', '预留费用', '综合成本', '报价状态'])
    calculationHeader.append(el('span', '', label));
  calculationsPanel.append(calculationHeader);
  for (const candidate of calculations) {
    const calculation = recordValue(candidate);
    const row = el('div', 'cost-calculation-row');
    row.append(
      el(
        'span',
        '',
        textValue(calculation.calculatedAt, '')
          ? formatBusinessDateTime(new Date(textValue(calculation.calculatedAt, '')))
          : '时间未知',
      ),
      el(
        'span',
        '',
        textValue(calculation.pricingMode, '') === 'TAX_EXCLUSIVE' ? '未税成本' : '含税成本',
      ),
      el('span', 'numeric', `¥ ${Number(calculation.directProductionCost ?? 0).toFixed(2)}`),
      el('span', 'numeric', `¥ ${Number(calculation.reservedExpenseCost ?? 0).toFixed(2)}`),
      el('strong', 'numeric', `¥ ${Number(calculation.totalCost ?? 0).toFixed(2)}`),
      el(
        'span',
        calculation.costDecisionId ? 'state-inline success' : 'state-inline',
        calculation.costDecisionId ? '已进入报价' : '未引用',
      ),
    );
    for (const [index, label] of [
      '核算时间',
      '口径',
      '直接成本',
      '预留费用',
      '综合成本',
      '报价状态',
    ].entries())
      row.children[index]?.setAttribute('data-field-label', label);
    calculationsPanel.append(row);
  }
  if (calculations.length === 0)
    calculationsPanel.append(el('p', 'pipeline-empty', '暂无核算记录。'));
  tabPanels.set('calculations', calculationsPanel);
  matrixSection.append(calculationsPanel);

  const quotePanel = el('section', 'cost-matrix-tab-panel cost-matrix-quote-panel');
  quotePanel.hidden = true;
  quotePanel.append(
    el('h4', '', latest.costDecisionId ? '该模型已进入报价流程' : '当前模型尚未进入报价流程'),
    el(
      'p',
      'muted',
      latest.costDecisionId
        ? `报价成本决策：${textValue(latest.costDecisionId, '')}。后续报价、审批、合同和订单将引用这一冻结快照。`
        : '完成核算后，由具备成本评价权限的岗位选择最终技术方案和企业成本规则，冻结成本并交给报价编制专员。',
    ),
  );
  tabPanels.set('quote', quotePanel);
  matrixSection.append(quotePanel);

  const auditPanel = el('section', 'cost-matrix-tab-panel cost-matrix-audit-ledger');
  auditPanel.hidden = true;
  for (const candidate of auditTrail) {
    const audit = recordValue(candidate);
    const row = el('div', 'cost-matrix-audit-row');
    row.append(
      el('strong', '', costMatrixAuditLabel(textValue(audit.action, ''))),
      el(
        'span',
        '',
        `${textValue(audit.actorName, textValue(audit.actorId, '系统'))} · ${textValue(audit.occurredAt, '') ? formatBusinessDateTime(new Date(textValue(audit.occurredAt, ''))) : '时间未知'}`,
      ),
    );
    auditPanel.append(row);
  }
  if (auditTrail.length === 0) auditPanel.append(el('p', 'pipeline-empty', '暂无可见变更日志。'));
  tabPanels.set('audit', auditPanel);
  if (selectedMatrix.auditTrailVisible === true) matrixSection.append(auditPanel);
  for (const [id, panel] of tabPanels) {
    panel.id = `cost-panel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `cost-tab-${id}`);
    panel.tabIndex = 0;
  }
}

export function appendCostMatrixDetail(
  costContext: CostViewContext,
  selectedId: string,
  selectedMatrix: Record<string, unknown>,
): void {
  const { recordValue } = costContext.ports;
  const latest = recordValue(selectedMatrix.latestCalculation);
  const factors = Array.isArray(selectedMatrix.factors) ? selectedMatrix.factors : [];
  const calculations = Array.isArray(selectedMatrix.calculations)
    ? selectedMatrix.calculations
    : latest.id
      ? [latest]
      : [];
  const auditTrail = Array.isArray(selectedMatrix.auditTrail) ? selectedMatrix.auditTrail : [];
  const context: CostDetailContext = {
    ...costContext,
    selectedId,
    selectedMatrix,
    latest,
    factors,
    calculations,
    auditTrail,
  };
  appendCostDetailHeading(context);
  appendCostDetailActions(context);
  const tabPanels = appendCostDetailTabs(context);
  const panelsContext: CostDetailPanelsContext = { ...context, tabPanels };
  appendCostFactorPanel(panelsContext);

  appendCostHistoryPanels(panelsContext);
}

export function createCostCalculateButton(
  context: CostDetailContext,
  mode: 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE',
  label: string,
  calculateButtons: HTMLButtonElement[],
  actionStatus: HTMLElement,
): HTMLButtonElement {
  const { controller, setCostStatus, refreshCostWorkspace, selectedId, selectedMatrix, latest } =
    context;
  const { textValue } = context.ports;
  const calculate = el('button', mode === 'TAX_INCLUSIVE' ? 'primary' : 'secondary', label);
  calculate.setAttribute('data-cost-matrix-calculate', mode);
  calculate.addEventListener('click', () => {
    void (async () => {
      for (const button of calculateButtons) button.disabled = true;
      calculate.textContent = '核算中…';
      calculate.setAttribute('aria-busy', 'true');
      actionStatus.className = 'cost-matrix-action-status pending';
      actionStatus.textContent = `正在核算${mode === 'TAX_INCLUSIVE' ? '含税' : '未税'}成本，请稍候…`;
      setCostStatus(actionStatus.textContent);
      try {
        const previousTotal = Number(latest.totalCost ?? 0);
        await controller.submit(`/api/v1/cost-matrices/${selectedId}/calculate`, {
          pricingMode: mode,
        });
        const total = Number(controller.revisionState?.totalCost ?? 0);
        const delta = latest.id ? total - previousTotal : 0;
        await refreshCostWorkspace(
          costCalculationMessage(selectedMatrix, latest, total, delta, textValue),
        );
      } catch (failure) {
        actionStatus.className = 'cost-matrix-action-status error';
        actionStatus.textContent =
          failure instanceof Error ? `核算失败：${failure.message}` : '核算失败';
        setCostStatus(actionStatus.textContent);
      } finally {
        for (const button of calculateButtons) button.disabled = false;
        calculate.textContent = label;
        calculate.setAttribute('aria-busy', 'false');
      }
    })();
  });
  return calculate;
}

export function appendCostQuoteActions(
  context: CostDetailContext,
  detailActions: HTMLElement,
): void {
  const { controller, permissions, publishedModels, solutions, costDialogHost, latest } = context;
  const { textValue } = context.ports;
  if (
    latest.id &&
    permissions.has('cost:evaluate') &&
    publishedModels.length > 0 &&
    solutions.length > 0
  ) {
    if (latest.costDecisionId) {
      detailActions.append(el('span', 'ctr-state state-approved', '已进入报价成本池'));
      if (permissions.has('quote:read') && permissions.has('quote:create')) {
        const continueQuote = el('button', 'primary', '继续销售报价');
        continueQuote.addEventListener('click', () => {
          controller.preferredQuoteCostDecisionId = textValue(latest.costDecisionId, '');
          setAppRoute('quotes');
          costDialogHost()
            .querySelector<HTMLButtonElement>('.quote-workbench [data-create-quote]')
            ?.click();
        });
        detailActions.append(continueQuote);
      }
    } else {
      const quoteCost = createCostQuoteButton(context);
      detailActions.append(quoteCost);
    }
  }
}

export function createCostQuoteButton(context: CostDetailContext): HTMLButtonElement {
  const {
    controller,
    permissions,
    publishedModels,
    solutions,
    costDialogHost,
    selectedMatrix,
    latest,
    matrixSection,
  } = context;
  const { textValue, replaceRouteView, rebuildWorkspace, prepareQuoteRoute } = context.ports;
  const quoteCost = el('button', 'primary', '冻结并用于报价');
  quoteCost.addEventListener('click', () => {
    openForm(
      costDialogHost(),
      `生成报价成本 · ${textValue(selectedMatrix.name, '')}`,
      '冻结本次因子取数，生成报价可选用的成本决策；后续报价、审批、合同和订单均引用该快照。',
      [
        {
          name: 'technicalSolutionRevisionId',
          label: '最终技术方案 / 商机',
          type: 'select',
          required: true,
          options: solutions.map((solution) => ({
            value: textValue(solution.id, ''),
            label: `${textValue(solution.code, '技术方案')} · 商机 ${textValue(solution.opportunityId, '')}`,
          })),
        },
        {
          name: 'modelVersionId',
          label: '企业成本规则版本',
          type: 'select',
          required: true,
          options: publishedModels.map((model) => ({
            value: textValue(model.id, ''),
            label: `${textValue(model.code, '成本规则')} · v${textValue(model.version, '1')}`,
          })),
        },
      ],
      '冻结并进入报价',
      async (values) => {
        await controller.submit(
          `/api/v1/cost-matrix-calculations/${textValue(latest.id, '')}/quote-cost-decision`,
          {
            technicalSolutionRevisionId: values.technicalSolutionRevisionId ?? '',
            modelVersionId: values.modelVersionId ?? '',
          },
        );
        const costDecisionId = textValue(controller.revisionState?.costDecisionId, '');
        if (!costDecisionId) throw new Error('服务器未返回报价成本决策编号');
        controller.preferredQuoteCostDecisionId = costDecisionId;
        await controller.refreshViews(['/api/v1/cost-evaluations']);
        await controller.loadCostMatrixPage();
        await controller.refreshSelectedCostMatrix();
        const canContinueQuote = permissions.has('quote:read') && permissions.has('quote:create');
        const liveWorkspace = costDialogHost();
        const isCurrent = () =>
          liveWorkspace.isConnected &&
          matrixSection.isConnected &&
          matrixSection.closest('.commercial-workspace') === liveWorkspace &&
          costDialogHost() === liveWorkspace &&
          appRouteFromHash(globalThis.location.hash) === 'costing';
        if (canContinueQuote) {
          if (!isCurrent()) return;
          // Finish lazy route reads before publishing the cost handoff's success message.
          let quoteState: 'ready' | 'unavailable' | 'cancelled' = 'unavailable';
          try {
            quoteState = await prepareQuoteRoute(isCurrent);
          } catch {
            // The decision is already saved: do not reopen a retryable submission form.
          }
          if (!isCurrent() || quoteState === 'cancelled') return;
          if (quoteState !== 'ready') {
            controller.message = `${textValue(selectedMatrix.name, '成本模型')}已进入报价成本池，销售报价暂不可用，请稍后重试`;
            replaceRouteView(liveWorkspace, rebuildWorkspace());
            return;
          }
        }
        controller.message = canContinueQuote
          ? `${textValue(selectedMatrix.name, '成本模型')}已形成报价成本快照，正在进入销售报价`
          : `${textValue(selectedMatrix.name, '成本模型')}已进入报价成本池，等待报价编制专员处理`;
        const refreshedWorkspace = rebuildWorkspace();
        replaceRouteView(liveWorkspace, refreshedWorkspace);
        if (!canContinueQuote || appRouteFromHash(globalThis.location.hash) !== 'costing') return;
        setAppRoute('quotes');
        const continueToQuote = () => {
          if (
            !refreshedWorkspace.isConnected ||
            appRouteFromHash(globalThis.location.hash) !== 'quotes'
          )
            return;
          refreshedWorkspace.querySelector<HTMLButtonElement>('[data-create-quote]')?.click();
        };
        if (typeof globalThis.requestAnimationFrame === 'function')
          globalThis.requestAnimationFrame(continueToQuote);
        else continueToQuote();
      },
    );
  });
  return quoteCost;
}

function costTabNextIndex(
  event: KeyboardEvent,
  index: number,
  buttons: readonly HTMLButtonElement[],
): number {
  return event.key === 'ArrowRight'
    ? (index + 1) % buttons.length
    : event.key === 'ArrowLeft'
      ? (index + buttons.length - 1) % buttons.length
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : -1;
}

function costCalculationMessage(
  selectedMatrix: Record<string, unknown>,
  latest: Record<string, unknown>,
  total: number,
  delta: number,
  textValue: PricingViewPorts['textValue'],
): string {
  return `${textValue(selectedMatrix.name, '成本模型')}核算完成：综合成本 ¥ ${total.toFixed(2)}${latest.id ? `，较上次 ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : ''}`;
}
