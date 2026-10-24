import { el } from '../dom';
import { openForm, type FormField } from '../shared/forms';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';

const solutionFields = (
  eligibleCtrs: readonly Record<string, unknown>[],
  ports: SalesViewPorts,
  specification: Record<string, unknown> = {},
  assumptions: readonly unknown[] = [],
  ctrVersionId = '',
  state = 'DRAFT',
): readonly FormField[] => {
  const { formValue, textValue } = ports;
  return [
    {
      name: 'ctrVersionId',
      label: '已批准技术需求版本',
      type: 'select',
      required: true,
      value: ctrVersionId,
      options: eligibleCtrs.map((item) => ({
        value: String(item.id),
        label: `${textValue(item.code, '技术需求')} · 第 ${textValue(item.version, '1')} 版 · ${textValue(item.title, '')}`,
      })),
    },
    {
      name: 'productFamily',
      label: '产品系列',
      required: true,
      value: formValue(specification.productFamily),
    },
    {
      name: 'pileHeight',
      label: '草高（mm）',
      type: 'number',
      required: true,
      value: formValue(specification.pileHeightMm),
    },
    {
      name: 'dtex',
      label: '草丝纤度（分特）',
      type: 'number',
      required: true,
      value: formValue(specification.dtex),
    },
    {
      name: 'yarnMaterial',
      label: '草丝材质与形态',
      required: true,
      value: formValue(specification.yarnMaterial),
      placeholder: '聚乙烯单丝 + 曲丝',
    },
    {
      name: 'gauge',
      label: '行距',
      required: true,
      value: formValue(specification.gauge),
      placeholder: '3/4 英寸',
    },
    {
      name: 'stitchRate',
      label: '簇密度（针/㎡）',
      type: 'number',
      required: true,
      value: formValue(specification.stitchRate),
    },
    {
      name: 'backing',
      label: '底布系统',
      required: true,
      value: formValue(specification.backing),
    },
    {
      name: 'rollWidthMeters',
      label: '卷宽（米）',
      type: 'number',
      required: true,
      value: formValue(specification.rollWidthMeters),
    },
    {
      name: 'drainageRate',
      label: '排水能力（升/分钟/㎡）',
      type: 'number',
      required: true,
      value: formValue(specification.drainageRate),
    },
    {
      name: 'infill',
      label: '填充建议',
      required: true,
      value: formValue(specification.infill),
    },
    {
      name: 'warrantyYears',
      label: '质保年限',
      type: 'number',
      required: true,
      value: formValue(specification.warrantyYears),
    },
    {
      name: 'assumptions',
      label: '工程假设（每行一项）',
      type: 'textarea',
      required: true,
      value: assumptions.map(String).join('\n'),
    },
    {
      name: 'state',
      label: '方案状态',
      type: 'select',
      required: true,
      value: state,
      options: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'FINAL', label: '定稿（可进入成本核算）' },
      ],
    },
  ];
};

const solutionPayload = (values: Record<string, string>) => ({
  ctrVersionId: values.ctrVersionId ?? '',
  specification: {
    productFamily: values.productFamily ?? '',
    pileHeightMm: Number(values.pileHeight ?? 0),
    dtex: Number(values.dtex ?? 0),
    yarnMaterial: values.yarnMaterial ?? '',
    gauge: values.gauge ?? '',
    stitchRate: Number(values.stitchRate ?? 0),
    backing: values.backing ?? '',
    rollWidthMeters: Number(values.rollWidthMeters ?? 0),
    drainageRate: Number(values.drainageRate ?? 0),
    infill: values.infill ?? '',
    warrantyYears: Number(values.warrantyYears ?? 0),
  },
  assumptions: (values.assumptions ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
  final: values.state === 'FINAL',
});

function createSolutionCard(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  solution: Record<string, unknown>,
  solutions: readonly Record<string, unknown>[],
  eligibleCtrs: readonly Record<string, unknown>[],
  ports: SalesViewPorts,
): HTMLElement {
  const { recordValue, textValue, displayRequirement } = ports;
  const card = el('article', 'solution-card');
  const specification = recordValue(solution.specification);
  card.append(
    el(
      'strong',
      '',
      `${textValue(solution.code, '方案')} · 第 ${textValue(solution.revision, '1')} 版`,
    ),
    el(
      'span',
      `ctr-state state-${textValue(solution.status, 'DRAFT').toLocaleLowerCase()}`,
      textValue(solution.status, 'DRAFT'),
    ),
    el('p', 'muted', `技术需求版本：${textValue(solution.ctrVersionId, '—')}`),
  );
  const specs = el('dl', 'ctr-specification');
  const previousSolution = solutions.find(
    (item) =>
      item.technicalSolutionId === solution.technicalSolutionId &&
      Number(item.revision) === Number(solution.revision) - 1,
  );
  const previousSpecification = recordValue(previousSolution?.specification);
  for (const [key, label] of [
    ['productFamily', '产品系列'],
    ['pileHeightMm', '草高（mm）'],
    ['dtex', '草丝纤度（分特）'],
    ['yarnMaterial', '草丝材质与形态'],
    ['gauge', '行距'],
    ['stitchRate', '簇密度'],
    ['backing', '底布系统'],
    ['rollWidthMeters', '卷宽（米）'],
    ['drainageRate', '排水能力'],
    ['infill', '填充建议'],
    ['warrantyYears', '质保年限'],
  ] as const) {
    const currentValue = displayRequirement(specification[key]);
    const previousValue = displayRequirement(previousSpecification[key]);
    specs.append(
      el('dt', '', label),
      el(
        'dd',
        previousSolution && currentValue !== previousValue ? 'changed' : '',
        previousSolution && currentValue !== previousValue
          ? `${currentValue}（上一版：${previousValue}）`
          : currentValue,
      ),
    );
  }
  card.append(specs);
  if (permissions.has('technical-solution:update')) {
    const revise = el('button', 'secondary', '创建方案修订');
    revise.addEventListener('click', () => {
      openForm(
        workspace,
        `修订 ${textValue(solution.code, '技术方案')}`,
        '新修订将保留旧版本及其技术需求引用。',
        solutionFields(
          eligibleCtrs,
          ports,
          specification,
          Array.isArray(solution.assumptions) ? solution.assumptions : [],
          textValue(solution.ctrVersionId, ''),
          textValue(solution.status, 'DRAFT'),
        ),
        '保存新修订',
        async (values) => {
          await controller.submit(
            `/api/v1/technical-solutions/${textValue(solution.technicalSolutionId, '')}/revisions`,
            solutionPayload(values),
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    card.append(revise);
  }
  return card;
}

export function appendSolutionView(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  ports: SalesViewPorts,
): void {
  const { technicalSolutionOpportunityId } = ports;
  const solutionPanel = el('section', 'solution-workbench');
  const solutionHeading = el('div', 'pipeline-heading');
  const solutionCopy = el('div');
  solutionCopy.append(el('h2', '', '技术方案'), el('p', '', '产品规格、工程条件与版本修订'));
  const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
  const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
  const eligibleCtrs = ctrs.filter((item) => item.status === 'APPROVED');

  if (permissions.has('technical-solution:create') && eligibleCtrs.length > 0) {
    const createSolution = el('button', 'primary', '＋ 新建技术方案');
    createSolution.addEventListener('click', () => {
      openForm(
        workspace,
        '新建技术方案',
        '方案的每项规格都将关联到选定的已批准技术需求版本。',
        [
          { name: 'code', label: '方案编号', required: true, placeholder: 'TS-2026-001' },
          ...solutionFields(eligibleCtrs, ports),
        ],
        '保存技术方案',
        async (values) => {
          await controller.submit('/api/v1/technical-solutions', {
            opportunityId: technicalSolutionOpportunityId(ctrs, values.ctrVersionId ?? ''),
            code: values.code ?? '',
            ...solutionPayload(values),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    solutionHeading.append(solutionCopy, createSolution);
  } else solutionHeading.append(solutionCopy);
  solutionPanel.append(solutionHeading);
  const solutionList = el('div', 'solution-list');
  for (const solution of solutions) {
    const card = createSolutionCard(
      workspace,
      status,
      controller,
      permissions,
      solution,
      solutions,
      eligibleCtrs,
      ports,
    );
    solutionList.append(card);
  }
  if (solutions.length === 0)
    solutionList.append(
      el('p', 'pipeline-empty', '暂无技术方案；请先批准技术需求，再建立结构化方案。'),
    );
  solutionPanel.append(solutionList);
  workspace.append(solutionPanel);
}
