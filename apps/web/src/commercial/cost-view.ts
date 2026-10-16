import { el } from '../dom';
import { createCostMatrixBindings } from './cost-matrix-bindings';
import { createCostFactorFields } from './cost-factor-form';
import { appendCostMatrixDetail } from './cost-matrix-detail';
import { appendCostMatrixLedger } from './cost-matrix-ledger';
import { appendCostModelHeading } from './cost-model-heading';
import {
  appendCostModelCatalog,
  appendCostEvaluationForm,
  appendCostDecisions,
} from './cost-model-evaluations';
import type { PricingViewContext, CostViewContext } from './pricing-view-ports';

export function appendCostView(pricingContext: PricingViewContext): void {
  const { workspace, status, controller, permissions, ports } = pricingContext;
  const { textValue } = ports;
  const costPanel = el('section', 'decision-workbench cost-workbench');
  const costHeading = el('div', 'pipeline-heading');
  const costCopy = el('div');
  costCopy.append(el('h2', '', '成本核算'), el('p', '', '成本模型、核算明细与版本依据'));
  const models = controller.views.get('/api/v1/cost-models') ?? [];
  const publishedModels = models.filter((item) => item.status === 'PUBLISHED');
  const solutions = (controller.views.get('/api/v1/technical-solutions') ?? []).filter(
    (item) => item.status === 'FINAL',
  );
  appendCostModelHeading(pricingContext, costHeading, costCopy);
  costPanel.append(costHeading);
  const costFlow = el('ol', 'cost-governance-flow');
  for (const [role, action] of [
    ['采购专员', '维护采购订单、合同价与有效供应商报价'],
    ['成本测算专员', '维护因子、核验来源并冻结成本快照'],
    ['报价编制专员', '按商机与技术方案引用成本生成报价'],
    ['报价审批 / 签发', '校验毛利、折扣与销售政策后冻结版本'],
    ['合同与订单岗位', '签署合同并由已签发报价创建销售订单'],
  ]) {
    const step = el('li');
    step.append(el('strong', '', role ?? ''), el('span', '', action ?? ''));
    costFlow.append(step);
  }
  costPanel.append(costFlow);
  const matrices = controller.views.get('/api/v1/cost-matrices') ?? [];
  const itemVersions = (controller.views.get('/api/v1/manufacturing-items') ?? []).flatMap((item) =>
    (Array.isArray(item.versions) ? item.versions : []).map((candidate) => {
      const version = candidate as Record<string, unknown>;
      return {
        value: textValue(version.id, ''),
        label: `${textValue(item.sku, '物料')} · ${textValue(item.name, '')} · 第 ${textValue(version.version, '1')} 版`,
      };
    }),
  );
  const categoryOptions = [
    ['DIRECT_MATERIAL', '直接材料'],
    ['DIRECT_LABOR', '直接人工'],
    ['DIRECT_ENERGY', '直接能源'],
    ['DIRECT_OVERHEAD', '直接制造费用'],
    ['FIXED', '固定成本（预留）'],
    ['PERSONNEL', '人员成本（预留）'],
    ['FINANCE', '财务费用（预留）'],
    ['MARKETING', '营销费用（预留）'],
    ['OTHER', '其他费用'],
  ].map(([value, label]) => ({ value: value ?? '', label: label ?? '' }));
  const sourceOptions = [
    { value: 'PURCHASE_ORDER', label: '已下达采购订单 / 合同价' },
    { value: 'SUPPLIER_QUOTE', label: '有效供应商报价' },
    { value: 'MARKET_REFERENCE', label: '市场公开参考价' },
    { value: 'INTERNAL_BENCHMARK', label: '企业计划成本基准' },
    { value: 'MANUAL', label: '临时手工录入' },
  ];
  const unitOptions = [
    { value: 'KG', label: '千克 kg' },
    { value: 'M2', label: '平方米 m²' },
    { value: 'HOUR', label: '工时' },
    { value: 'KWH', label: '千瓦时 kWh' },
    { value: 'EA', label: '项 / 件' },
  ];
  const matrixSection = el('section', 'cost-matrix-section cost-matrix-ledger-workspace');
  const bindings = createCostMatrixBindings(pricingContext, matrixSection);
  const factorFields = createCostFactorFields(
    { itemVersions, categoryOptions, sourceOptions, unitOptions },
    textValue,
  );
  const selectedId = controller.selectedCostMatrixId;
  const selectedMatrix = selectedId ? controller.costMatrixDetails.get(selectedId) : undefined;

  const context: CostViewContext = {
    workspace,
    status,
    controller,
    permissions,
    ports,
    costPanel,
    models,
    publishedModels,
    solutions,
    matrices,
    itemVersions,
    categoryOptions,
    sourceOptions,
    unitOptions,
    matrixSection,
    ...bindings,
    factorFields,
  };
  if (selectedId && selectedMatrix) {
    appendCostMatrixDetail(context, selectedId, selectedMatrix);
  } else {
    appendCostMatrixLedger(context);
  }
  costPanel.append(matrixSection);
  appendCostModelCatalog(context);
  appendCostEvaluationForm(context);
  appendCostDecisions(context);
  workspace.append(costPanel);
}
