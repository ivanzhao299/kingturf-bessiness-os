import { el } from '../dom';
import { appendCostModelHeading } from './cost-model-heading';
import {
  appendCostModelCatalog,
  appendCostEvaluationForm,
  appendCostDecisions,
} from './cost-model-evaluations';
import type { PricingViewContext, CostViewContext } from './pricing-view-ports';

// U3-COM-4：矩阵区（台账/详情/因子配置）迁移至 Preact 矩阵控制台（console-entry），
// 本文件保留成本模型目录/评估表单/决策区。
export function appendCostView(pricingContext: PricingViewContext): void {
  const { workspace, status, controller, permissions, ports } = pricingContext;
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
  };
  appendCostModelCatalog(context);
  appendCostEvaluationForm(context);
  appendCostDecisions(context);
  workspace.append(costPanel);
}
