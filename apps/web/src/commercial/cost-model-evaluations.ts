import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CostViewContext } from './pricing-view-ports';

export function appendCostModelCatalog(context: CostViewContext): void {
  const { workspace, status, controller, permissions, costPanel, models } = context;
  const { textValue, currencyLabel } = context.ports;
  const modelCatalog = el('div', 'definition-catalog');
  const latestModelVersions = new Map<string, number>();
  for (const model of models) {
    const definitionId = textValue(model.definitionId, '');
    latestModelVersions.set(
      definitionId,
      Math.max(latestModelVersions.get(definitionId) ?? 0, Number(model.version ?? 0)),
    );
  }
  for (const model of models) {
    const modelCard = el('article', 'definition-card');
    const rules = Array.isArray(model.rules) ? model.rules : [];
    modelCard.append(
      el('strong', '', `${textValue(model.code, '模型')} · 第 ${textValue(model.version, '1')} 版`),
      el(
        'span',
        `ctr-state state-${textValue(model.status, 'DRAFT').toLocaleLowerCase()}`,
        textValue(model.status, 'DRAFT'),
      ),
      el(
        'p',
        'muted',
        `${textValue(model.name, '')} · ${currencyLabel(model.currency)} · ${String(rules.length)} 条规则`,
      ),
    );
    if (
      permissions.has('cost-model:manage') &&
      Number(model.version) === latestModelVersions.get(textValue(model.definitionId, ''))
    ) {
      const reviseModel = el('button', 'secondary', '新建模型版本');
      reviseModel.addEventListener('click', () => {
        openForm(
          workspace,
          `修订 ${textValue(model.code, '成本模型')}`,
          '创建新的发布版本；历史成本决策继续引用原模型版本。',
          [
            {
              name: 'overheadPercent',
              label: '管理费率（%）',
              type: 'number',
              required: true,
              value: '3',
            },
          ],
          '发布新版本',
          async (values) => {
            const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
            await controller.submit(
              `/api/v1/cost-models/${textValue(model.definitionId, '')}/versions`,
              {
                currency: textValue(model.currency, 'CNY'),
                rules: [
                  {
                    when: { op: 'literal', value: true },
                    adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                    reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
                  },
                ],
                publish: true,
              },
            );
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      modelCard.append(reviseModel);
    }
    modelCatalog.append(modelCard);
  }
  costPanel.append(modelCatalog);
}

export function appendCostEvaluationForm(context: CostViewContext): void {
  const { workspace, status, controller, permissions, costPanel, publishedModels, solutions } =
    context;
  const { textValue } = context.ports;
  if (permissions.has('cost:evaluate') && publishedModels.length > 0 && solutions.length > 0) {
    const evaluate = el('button', 'primary', '＋ 新建成本核算');
    evaluate.addEventListener('click', () => {
      openForm(
        workspace,
        '新建成本核算',
        '每一行都保存数量、单位、单价和币种；服务器重新计算小计及模型调整。',
        [
          {
            name: 'modelVersionId',
            label: '已发布成本模型',
            type: 'select',
            required: true,
            options: publishedModels.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.code, '模型')} · 第 ${textValue(item.version, '1')} 版 · ${textValue(item.currency, '人民币')}`,
            })),
          },
          {
            name: 'technicalSolutionRevisionId',
            label: '定稿技术方案',
            type: 'select',
            required: true,
            options: solutions.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.code, '方案')} · 第 ${textValue(item.revision, '1')} 版`,
            })),
          },
          { name: 'materialQuantity', label: '草坪面积（㎡）', type: 'number', required: true },
          {
            name: 'materialUnitCost',
            label: '草坪单位成本（元/㎡）',
            type: 'number',
            required: true,
          },
          {
            name: 'installationQuantity',
            label: '铺装面积（㎡）',
            type: 'number',
            required: true,
          },
          {
            name: 'installationUnitCost',
            label: '铺装单位成本（元/㎡）',
            type: 'number',
            required: true,
          },
          {
            name: 'logisticsQuantity',
            label: '物流批次',
            type: 'number',
            required: true,
            value: '1',
          },
          {
            name: 'logisticsUnitCost',
            label: '单批物流成本（元）',
            type: 'number',
            required: true,
          },
          { name: 'region', label: '项目区域', required: true, value: 'CN' },
        ],
        '执行核算',
        async (values) => {
          const model = publishedModels.find((item) => item.id === values.modelVersionId);
          const currency = textValue(model?.currency, 'CNY');
          await controller.submit('/api/v1/cost-evaluations', {
            modelVersionId: values.modelVersionId ?? '',
            technicalSolutionRevisionId: values.technicalSolutionRevisionId ?? '',
            currency,
            lines: [
              ['turf', '人造草坪材料', values.materialQuantity, 'M2', values.materialUnitCost],
              [
                'installation',
                '铺装施工',
                values.installationQuantity,
                'M2',
                values.installationUnitCost,
              ],
              ['logistics', '运输与装卸', values.logisticsQuantity, 'EA', values.logisticsUnitCost],
            ].map(([key, description, quantity, unit, unitCost]) => ({
              key,
              description,
              quantity,
              unit,
              unitCost,
              currency,
            })),
            context: { region: values.region ?? 'CN' },
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    costPanel.append(evaluate);
  }
}

export function appendCostDecisions(context: CostViewContext): void {
  const { controller, costPanel } = context;
  const { textValue, recordValue, displayTime } = context.ports;
  const decisions = controller.views.get('/api/v1/cost-evaluations') ?? [];
  const decisionList = el('div', 'decision-list');
  for (const decision of decisions) {
    const card = el('article', 'decision-card');
    card.append(
      el('p', 'eyebrow', `COST · ${textValue(decision.currency, '—')}`),
      el(
        'strong',
        'decision-total',
        `${textValue(decision.currency, '')} ${textValue(decision.total, '—')}`,
      ),
      el(
        'p',
        'muted',
        `小计 ${textValue(decision.subtotal, '—')} · ${displayTime(textValue(decision.evaluatedAt, ''))}`,
      ),
      el(
        'p',
        'version-pin',
        `模型 ${textValue(decision.modelVersionId, '').slice(0, 8)} · 方案 ${textValue(decision.technicalSolutionRevisionId, '').slice(0, 8)}`,
      ),
    );
    const lines = Array.isArray(decision.lines) ? decision.lines : [];
    const lineList = el('ul', 'decision-lines');
    for (const line of lines) {
      const item = recordValue(line);
      lineList.append(
        el(
          'li',
          '',
          `${textValue(item.description, '成本项')} · ${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')} × ${textValue(item.unit_cost, '—')} = ${textValue(item.total, '—')}`,
        ),
      );
    }
    const trace = Array.isArray(decision.trace) ? decision.trace : [];
    for (const entry of trace) {
      const rule = recordValue(entry);
      card.append(
        el(
          'p',
          rule.matched === true ? 'rule-hit' : 'rule-miss',
          `${rule.matched === true ? '已命中' : '未命中'} · ${textValue(rule.reason, '规则')}`,
        ),
      );
    }
    card.append(lineList, el('code', 'input-hash', textValue(decision.inputHash, '')));
    decisionList.append(card);
  }
  if (decisions.length === 0) decisionList.append(el('p', 'pipeline-empty', '暂无成本核算结果。'));
  costPanel.append(decisionList);
}
