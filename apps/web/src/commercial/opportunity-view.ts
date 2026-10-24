import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { Opportunity } from './types';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';

function createOpportunityCard(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  opportunity: Opportunity,
  stage: string,
  label: string,
  ports: SalesViewPorts,
): HTMLElement {
  const { displayMoney } = ports;
  const card = document.createElement('article');
  card.className = 'opportunity-card';
  const expectedDate = opportunity.expectedCloseDate?.slice(0, 10);
  const overdue =
    !['WON', 'LOST'].includes(stage) &&
    Boolean(expectedDate) &&
    String(expectedDate) < new Date().toISOString().slice(0, 10);
  if (overdue) card.classList.add('overdue');
  const name = document.createElement('strong');
  name.textContent = opportunity.name ?? opportunity.id;
  const amount = document.createElement('span');
  amount.textContent = opportunity.value
    ? displayMoney(opportunity.value.currency, opportunity.value.amount)
    : '金额受限';
  const meta = document.createElement('small');
  meta.textContent = `${String((opportunity.probabilityBasisPoints ?? 0) / 100)}% · ${opportunity.expectedCloseDate?.slice(0, 10) ?? '日期未定'}`;
  card.append(name, amount, meta);
  if (overdue) card.append(el('span', 'opportunity-alert', '成交日期已逾期'));
  const nextStage =
    stage === 'OPEN'
      ? 'QUALIFIED'
      : stage === 'QUALIFIED'
        ? 'PROPOSAL'
        : stage === 'PROPOSAL'
          ? 'WON'
          : null;
  if (nextStage && permissions.has('opportunity:lifecycle')) {
    const advance = document.createElement('button');
    advance.className = 'text-button';
    advance.textContent = '推进 →';
    advance.addEventListener('click', () => {
      openForm(
        workspace,
        '推进商机阶段',
        `从“${label}”推进至下一阶段。`,
        [{ name: 'reason', label: '推进依据', type: 'textarea', required: true }],
        '确认推进',
        async (values) => {
          await controller.transitionOpportunity(opportunity, nextStage, values.reason ?? '');
          status.textContent = controller.message;
        },
      );
    });
    card.append(advance);
  }
  return card;
}

export function appendOpportunityView(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  ports: SalesViewPorts,
): void {
  const { replaceRouteView, rebuildWorkspace, opportunityPipelineSummary } = ports;
  const pipeline = document.createElement('section');
  pipeline.className = 'pipeline-board';
  const heading = document.createElement('div');
  heading.className = 'pipeline-heading';
  const headingCopy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = '商机阶段看板';
  const subtitle = document.createElement('p');
  subtitle.textContent = '按阶段推进预计金额、赢率与成交日期';
  headingCopy.append(title, subtitle);
  if (permissions.has('opportunity:create')) {
    const create = document.createElement('button');
    create.className = 'primary';
    create.textContent = '＋ 新建商机';
    create.addEventListener('click', () => {
      openForm(
        workspace,
        '新建商机',
        '建立销售机会并设置初始金额、赢率与预计成交日期。',
        [
          {
            name: 'customerId',
            label: '关联客户',
            type: 'select',
            options: [
              { value: 'none', label: '暂不关联客户' },
              ...controller.customers.map((customer) => ({
                value: customer.id,
                label: customer.name ?? customer.id,
              })),
            ],
          },
          {
            name: 'name',
            label: '商机名称',
            required: true,
            placeholder: '例如：国际学校足球场项目',
          },
          {
            name: 'value',
            label: '预计金额',
            type: 'number',
            required: true,
            placeholder: '500000',
          },
          {
            name: 'currency',
            label: '币种',
            type: 'select',
            required: true,
            options: [
              { value: 'CNY', label: '人民币' },
              { value: 'USD', label: '美元 USD' },
              { value: 'EUR', label: '欧元 EUR' },
            ],
          },
          {
            name: 'probability',
            label: '成交概率（%）',
            type: 'number',
            required: true,
            placeholder: '30',
          },
          { name: 'expectedCloseDate', label: '预计成交日期', type: 'date', required: true },
        ],
        '创建商机',
        async (values) => {
          await controller.submit('/api/v1/opportunities', {
            customerId: values.customerId === 'none' ? null : (values.customerId ?? null),
            leadId: null,
            name: values.name ?? '',
            value: values.value ?? '',
            currency: values.currency ?? 'CNY',
            probabilityBasisPoints: Math.round(Number(values.probability ?? 0) * 100),
            expectedCloseDate: values.expectedCloseDate ?? '',
          });
          replaceRouteView(
            pipeline,
            rebuildWorkspace().querySelector('.pipeline-board') ?? pipeline,
          );
        },
      );
    });
    heading.append(headingCopy, create);
  } else heading.append(headingCopy);
  pipeline.append(heading);
  const pipelineSummary = opportunityPipelineSummary(controller.opportunities);
  const summary = el('div', 'pipeline-summary');
  for (const [label, value, tone] of [
    ['在途商机', pipelineSummary.active, 'neutral'],
    ['已逾期', pipelineSummary.overdue, pipelineSummary.overdue > 0 ? 'danger' : 'success'],
    ['30 天内预计成交', pipelineSummary.closingSoon, 'attention'],
    [
      '未关联客户',
      pipelineSummary.customerMissing,
      pipelineSummary.customerMissing > 0 ? 'warning' : 'success',
    ],
  ] as const) {
    const metric = el('article', `pipeline-metric ${tone}`);
    metric.append(el('span', '', label), el('strong', '', String(value)));
    summary.append(metric);
  }
  pipeline.append(summary);
  const columns = document.createElement('div');
  columns.className = 'pipeline-columns';
  const stages = [
    ['OPEN', '初步接洽'],
    ['QUALIFIED', '需求确认'],
    ['PROPOSAL', '方案报价'],
    ['WON', '赢单'],
    ['LOST', '输单'],
  ] as const;
  for (const [stage, label] of stages) {
    const column = document.createElement('section');
    column.className = `pipeline-column stage-${stage.toLocaleLowerCase()}`;
    const opportunities = controller.opportunities.filter((item) => item.status === stage);
    const columnHeading = document.createElement('header');
    columnHeading.textContent = `${label} · ${String(opportunities.length)}`;
    column.append(columnHeading);
    for (const opportunity of opportunities) {
      const card = createOpportunityCard(
        workspace,
        status,
        controller,
        permissions,
        opportunity,
        stage,
        label,
        ports,
      );
      column.append(card);
    }
    if (opportunities.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = '暂无商机';
      column.append(empty);
    }
    columns.append(column);
  }
  pipeline.append(columns);
  workspace.append(pipeline);
}
