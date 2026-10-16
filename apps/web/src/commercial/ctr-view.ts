import { openForm, openFileForm } from '../shared/forms';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';

function createCtrCreateButton(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
): HTMLButtonElement {
  const create = document.createElement('button');
  create.className = 'primary';
  create.textContent = '＋ 新建技术需求';
  create.addEventListener('click', () => {
    openForm(
      workspace,
      '新建技术需求',
      '技术需求单必须关联一个商机，提交前可以继续创建修订版本。',
      [
        {
          name: 'opportunityId',
          label: '关联商机',
          type: 'select',
          required: true,
          options: controller.opportunities.map((item) => ({
            value: item.id,
            label: item.name ?? item.id,
          })),
        },
        {
          name: 'code',
          label: '技术需求单编号',
          required: true,
          placeholder: 'JSXQ-2026-001',
        },
        {
          name: 'title',
          label: '需求标题',
          required: true,
          placeholder: '学校足球场人造草坪技术需求',
        },
        {
          name: 'application',
          label: '应用场景',
          type: 'select',
          required: true,
          options: [
            { value: '足球场', label: '足球场' },
            { value: '休闲景观', label: '休闲景观' },
            { value: '多功能运动场', label: '多功能运动场' },
            { value: '门球场', label: '门球场' },
            { value: '幼儿园活动区', label: '幼儿园活动区' },
            { value: '屋顶及露台', label: '屋顶及露台' },
          ],
        },
        { name: 'projectRegion', label: '项目地区', required: true, placeholder: '山东青岛' },
        {
          name: 'performanceStandard',
          label: '执行标准',
          type: 'select',
          required: true,
          options: [
            { value: '企业验收标准', label: '企业验收标准' },
            { value: 'GB/T 20394', label: 'GB/T 20394 体育用人造草' },
            { value: '国际足联场地质量标准', label: '国际足联场地质量标准' },
            { value: '客户技术规范', label: '客户技术规范' },
          ],
        },
        {
          name: 'pileHeight',
          label: '草高（mm）',
          type: 'number',
          required: true,
          placeholder: '50',
        },
        {
          name: 'quantity',
          label: '预计面积（㎡）',
          type: 'number',
          required: true,
          placeholder: '8000',
        },
        { name: 'color', label: '颜色要求', required: true, placeholder: '双色翠绿' },
        {
          name: 'baseCondition',
          label: '场地基础条件',
          required: true,
          placeholder: '沥青基础已完工，平整度待复测',
        },
        {
          name: 'drainageRequirement',
          label: '排水要求',
          required: true,
          placeholder: '暴雨后 30 分钟内无明显积水',
        },
        { name: 'fireRating', label: '阻燃要求', required: true, placeholder: '按项目规范' },
        {
          name: 'warrantyYears',
          label: '质保年限',
          type: 'number',
          required: true,
          value: '8',
        },
        { name: 'delivery', label: '交付要求', type: 'textarea', required: true },
      ],
      '创建技术需求',
      async (values) => {
        await controller.submit('/api/v1/ctrs', {
          opportunityId: values.opportunityId ?? '',
          code: values.code ?? '',
          title: values.title ?? '',
          requirements: {
            application: values.application ?? '',
            projectRegion: values.projectRegion ?? '',
            performanceStandard: values.performanceStandard ?? '',
            pileHeightMm: Number(values.pileHeight ?? 0),
            quantitySquareMeters: Number(values.quantity ?? 0),
            color: values.color ?? '',
            baseCondition: values.baseCondition ?? '',
            drainageRequirement: values.drainageRequirement ?? '',
            fireRating: values.fireRating ?? '',
            warrantyYears: Number(values.warrantyYears ?? 0),
            delivery: values.delivery ?? '',
          },
        });
        await controller.load();
        status.textContent = controller.message;
      },
    );
  });
  return create;
}

function createCtrRevisionButton(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  ctrId: string,
  ctrCode: string,
  ctrVersion: number,
  ctrTitle: string,
  requirements: Record<string, unknown>,
  ports: SalesViewPorts,
): HTMLButtonElement {
  const { displayRequirement } = ports;
  const revise = document.createElement('button');
  revise.className = 'secondary';
  revise.textContent = '新建修订';
  revise.addEventListener('click', () => {
    openForm(
      workspace,
      `新建 ${ctrCode} 修订`,
      `基于第 ${String(ctrVersion)} 版创建新的可编辑草稿，历史版本保持不变。`,
      [
        { name: 'title', label: '需求标题', required: true, value: ctrTitle },
        {
          name: 'application',
          label: '应用场景',
          required: true,
          value: displayRequirement(requirements.application),
        },
        {
          name: 'projectRegion',
          label: '项目地区',
          required: true,
          value: displayRequirement(requirements.projectRegion),
        },
        {
          name: 'performanceStandard',
          label: '执行标准',
          required: true,
          value: displayRequirement(requirements.performanceStandard),
        },
        {
          name: 'pileHeight',
          label: '草高（mm）',
          type: 'number',
          required: true,
          value: displayRequirement(requirements.pileHeightMm),
        },
        {
          name: 'quantity',
          label: '预计面积（㎡）',
          type: 'number',
          required: true,
          value: displayRequirement(requirements.quantitySquareMeters),
        },
        {
          name: 'color',
          label: '颜色要求',
          required: true,
          value: displayRequirement(requirements.color),
        },
        {
          name: 'baseCondition',
          label: '场地基础条件',
          required: true,
          value: displayRequirement(requirements.baseCondition),
        },
        {
          name: 'drainageRequirement',
          label: '排水要求',
          required: true,
          value: displayRequirement(requirements.drainageRequirement),
        },
        {
          name: 'fireRating',
          label: '阻燃要求',
          required: true,
          value: displayRequirement(requirements.fireRating),
        },
        {
          name: 'warrantyYears',
          label: '质保年限',
          type: 'number',
          required: true,
          value: displayRequirement(requirements.warrantyYears),
        },
        {
          name: 'delivery',
          label: '交付要求',
          type: 'textarea',
          required: true,
          value: displayRequirement(requirements.delivery),
        },
      ],
      '创建修订草稿',
      async (values) => {
        await controller.submit(`/api/v1/ctrs/${ctrId}/versions`, {
          title: values.title ?? '',
          requirements: {
            application: values.application ?? '',
            projectRegion: values.projectRegion ?? '',
            performanceStandard: values.performanceStandard ?? '',
            pileHeightMm: Number(values.pileHeight ?? 0),
            quantitySquareMeters: Number(values.quantity ?? 0),
            color: values.color ?? '',
            baseCondition: values.baseCondition ?? '',
            drainageRequirement: values.drainageRequirement ?? '',
            fireRating: values.fireRating ?? '',
            warrantyYears: Number(values.warrantyYears ?? 0),
            delivery: values.delivery ?? '',
          },
        });
        await controller.load();
        status.textContent = controller.message;
      },
    );
  });
  return revise;
}

function appendCtrActions(
  actions: HTMLElement,
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  ctr: Record<string, unknown>,
  ctrId: string,
  ctrCode: string,
  ctrVersion: number,
  ctrTitle: string,
  ctrStatus: string,
  requirements: Record<string, unknown>,
  latestVersionByCtr: ReadonlyMap<string, number>,
  ports: SalesViewPorts,
): void {
  if (
    ctrStatus === 'DRAFT' &&
    permissions.has('ctr:update') &&
    permissions.has('attachment:manage')
  ) {
    const upload = document.createElement('button');
    upload.className = 'secondary';
    upload.textContent = '上传附件';
    upload.addEventListener('click', () => {
      openFileForm(workspace, `为 ${ctrCode} 第 ${String(ctrVersion)} 版上传附件`, async (file) => {
        await controller.uploadCtrAttachment(String(ctr.id), file);
        status.textContent = controller.message;
      });
    });
    actions.append(upload);
  }
  if (
    ctrId !== '' &&
    ctrVersion === latestVersionByCtr.get(ctrId) &&
    ctrStatus !== 'DRAFT' &&
    permissions.has('ctr:update')
  ) {
    const revise = createCtrRevisionButton(
      workspace,
      status,
      controller,
      ctrId,
      ctrCode,
      ctrVersion,
      ctrTitle,
      requirements,
      ports,
    );
    actions.append(revise);
  }
  if (ctrStatus === 'DRAFT' && permissions.has('ctr:submit')) {
    const submit = document.createElement('button');
    submit.className = 'secondary';
    submit.textContent = '提交评审';
    submit.addEventListener('click', () => {
      openForm(
        workspace,
        '提交技术需求评审',
        '提交后当前版本将冻结，并生成不可变需求快照。',
        [],
        '确认提交评审',
        async () => {
          await controller.submit(`/api/v1/ctr-versions/${String(ctr.id)}/submit`, {
            expectedVersion: ctrVersion,
          });
          status.textContent = '技术需求已提交并生成不可变快照';
        },
      );
    });
    actions.append(submit);
  }
  if (ctrStatus === 'SUBMITTED' && permissions.has('ctr:approve')) {
    for (const [decision, label] of [
      ['APPROVED', '批准'],
      ['REJECTED', '驳回'],
    ] as const) {
      const decide = document.createElement('button');
      decide.className = decision === 'APPROVED' ? 'primary' : 'secondary';
      decide.textContent = label;
      decide.addEventListener('click', () => {
        openForm(
          workspace,
          `${label}技术需求`,
          '审批决定和理由将永久保留。',
          [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
          `确认${label}`,
          async (values) => {
            await controller.submit(`/api/v1/ctr-versions/${String(ctr.id)}/decision`, {
              decision,
              reason: values.reason ?? '',
            });
            status.textContent = `技术需求已${label}`;
          },
        );
      });
      actions.append(decide);
    }
  }
}

function createCtrRow(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  ctr: Record<string, unknown>,
  ctrs: readonly Record<string, unknown>[],
  latestVersionByCtr: ReadonlyMap<string, number>,
  ports: SalesViewPorts,
): HTMLElement {
  const { recordValue, ctrRequirementFields, displayRequirement } = ports;
  const ctrCode = typeof ctr.code === 'string' ? ctr.code : '技术需求单';
  const ctrTitle = typeof ctr.title === 'string' ? ctr.title : '未命名需求';
  const ctrVersion = typeof ctr.version === 'number' ? ctr.version : 1;
  const ctrStatus = typeof ctr.status === 'string' ? ctr.status : 'DRAFT';
  const ctrId = typeof ctr.ctrId === 'string' ? ctr.ctrId : '';
  const requirements = recordValue(ctr.requirements);
  const attachments = Array.isArray(ctr.attachments) ? ctr.attachments : [];
  const row = document.createElement('article');
  row.className = 'ctr-row';
  const identity = document.createElement('div');
  const code = document.createElement('strong');
  code.textContent = ctrCode;
  const name = document.createElement('span');
  name.textContent = ctrTitle;
  identity.append(code, name);
  const version = document.createElement('span');
  version.textContent = `第 ${String(ctrVersion)} 版`;
  const state = document.createElement('span');
  state.className = `ctr-state state-${ctrStatus.toLocaleLowerCase()}`;
  state.textContent = ctrStatus;
  const actions = document.createElement('div');
  actions.className = 'ctr-actions';
  appendCtrActions(
    actions,
    workspace,
    status,
    controller,
    permissions,
    ctr,
    ctrId,
    ctrCode,
    ctrVersion,
    ctrTitle,
    ctrStatus,
    requirements,
    latestVersionByCtr,
    ports,
  );
  const evidence = document.createElement('details');
  evidence.className = 'ctr-evidence';
  const summary = document.createElement('summary');
  summary.textContent = `规格与证据 · ${String(attachments.length)} 个附件`;
  const specification = document.createElement('dl');
  specification.className = 'ctr-specification';
  const previous = ctrs.find((item) => item.ctrId === ctrId && item.version === ctrVersion - 1);
  const previousRequirements = recordValue(previous?.requirements);
  for (const [key, label] of ctrRequirementFields) {
    const term = document.createElement('dt');
    term.textContent = label;
    const definition = document.createElement('dd');
    const currentValue = displayRequirement(requirements[key]);
    const previousValue = displayRequirement(previousRequirements[key]);
    definition.textContent =
      previous && currentValue !== previousValue
        ? `${currentValue}（上一版：${previousValue}）`
        : currentValue;
    if (previous && currentValue !== previousValue) definition.className = 'changed';
    specification.append(term, definition);
  }
  evidence.append(summary, specification);
  row.append(identity, version, state, actions, evidence);
  return row;
}

export function appendCtrView(
  workspace: HTMLElement,
  status: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  ports: SalesViewPorts,
): void {
  const ctrPanel = document.createElement('section');
  ctrPanel.className = 'ctr-workbench';
  const heading = document.createElement('div');
  heading.className = 'pipeline-heading';
  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = '技术需求单';
  const subtitle = document.createElement('p');
  subtitle.textContent = '结构化记录场景、规格、数量和交付要求，提交后形成不可变快照';
  copy.append(title, subtitle);
  if (permissions.has('ctr:create')) {
    const create = createCtrCreateButton(workspace, status, controller);
    heading.append(copy, create);
  } else heading.append(copy);
  ctrPanel.append(heading);
  const table = document.createElement('div');
  table.className = 'ctr-table';
  const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
  const latestVersionByCtr = new Map<string, number>();
  for (const item of ctrs) {
    const rootId = typeof item.ctrId === 'string' ? item.ctrId : '';
    const revision = typeof item.version === 'number' ? item.version : 0;
    latestVersionByCtr.set(rootId, Math.max(latestVersionByCtr.get(rootId) ?? 0, revision));
  }
  for (const ctr of ctrs) {
    const row = createCtrRow(
      workspace,
      status,
      controller,
      permissions,
      ctr,
      ctrs,
      latestVersionByCtr,
      ports,
    );
    table.append(row);
  }
  if (ctrs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pipeline-empty';
    empty.textContent = '暂无技术需求单，请先从已确认需求的商机创建。';
    table.append(empty);
  }
  ctrPanel.append(table);
  workspace.append(ctrPanel);
}
