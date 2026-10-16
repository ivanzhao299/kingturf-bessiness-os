import { setOperationStatus } from '../dom';
import type { CommercialPermission } from './permissions';
import type {
  WorkspaceAssemblyContext,
  LegacyAssemblyController,
  CommercialRevisionPath,
} from './workspace-assembly-ports';

function createLegacyCommercialPanel(
  context: WorkspaceAssemblyContext<LegacyAssemblyController>,
  immutable: boolean,
  commercialRevisionPath: CommercialRevisionPath,
  className: string,
  title: string,
  description: string,
  fields: readonly string[],
  action: string,
  path: string,
  canRead: boolean,
  canAct: boolean,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const panel = document.createElement('section');
  panel.className = `commercial-panel ${className}`;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const help = document.createElement('p');
  help.className = 'commercial-help';
  help.textContent = description;
  const form = document.createElement('form');
  form.className = 'commercial-form';
  const hint = document.createElement('p');
  hint.className = 'field-hint';
  hint.textContent = fields.join(' · ');
  const request = document.createElement('textarea');
  request.setAttribute('aria-label', `${title}高级配置请求`);
  request.placeholder = '{ }';
  request.disabled = immutable || Boolean(controller && !canAct);
  form.append(hint, request);
  const button = document.createElement('button');
  button.type = 'submit';
  button.disabled = request.disabled;
  button.textContent = action;
  form.append(button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!controller) return;
    try {
      const parsed = JSON.parse(request.value || '{}') as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('请求必须是键值对象格式');
      const payload = { ...(parsed as Record<string, unknown>) };
      const rootId = typeof payload.rootId === 'string' ? payload.rootId : null;
      delete payload.rootId;
      const target = (rootId ? commercialRevisionPath(className, rootId) : null) ?? path;
      setOperationStatus(status, 'loading', '正在提交，请勿重复操作…');
      button.disabled = true;
      button.textContent = '处理中…';
      void controller
        .submit(target, payload)
        .then(() => {
          setOperationStatus(status, 'success', controller.message);
          evidence.textContent = JSON.stringify(controller.revisionState, null, 2);
        })
        .catch((error: unknown) => {
          setOperationStatus(
            status,
            'error',
            error instanceof Error ? error.message : '操作失败，请稍后重试',
          );
        })
        .finally(() => {
          button.disabled = false;
          button.textContent = action;
        });
    } catch (error) {
      setOperationStatus(status, 'error', error instanceof Error ? error.message : '请求格式无效');
    }
  });
  const evidence = document.createElement('details');
  evidence.className = 'decision-evidence';
  const summary = document.createElement('summary');
  summary.textContent = '版本引用与决策证据';
  evidence.append(summary);
  const loaded = canRead ? controller?.views.get(path) : undefined;
  if (loaded) evidence.append(document.createTextNode(JSON.stringify(loaded, null, 2)));
  else if (controller && !canRead) evidence.hidden = true;
  if (className === 'ctr-revisions' && controller && !immutable) {
    const versionId = document.createElement('input');
    versionId.setAttribute('aria-label', '技术需求版本编号');
    const expectedCtrVersion = document.createElement('input');
    expectedCtrVersion.type = 'number';
    expectedCtrVersion.min = '1';
    expectedCtrVersion.value = '1';
    expectedCtrVersion.setAttribute('aria-label', '技术需求预期版本号');
    const submitCtr = document.createElement('button');
    submitCtr.type = 'button';
    submitCtr.textContent = '提交技术需求';
    submitCtr.hidden = !permissions.has('ctr:submit');
    submitCtr.addEventListener('click', () => {
      void controller.submit(`/api/v1/ctr-versions/${versionId.value}/submit`, {
        expectedVersion: Number(expectedCtrVersion.value),
      });
    });
    const approveCtr = document.createElement('button');
    approveCtr.type = 'button';
    approveCtr.textContent = '批准技术需求';
    approveCtr.hidden = !permissions.has('ctr:approve');
    approveCtr.addEventListener('click', () => {
      void controller.submit(`/api/v1/ctr-versions/${versionId.value}/decision`, {
        decision: 'APPROVED',
        reason: 'UI approval',
      });
    });
    panel.append(versionId, expectedCtrVersion, submitCtr, approveCtr);
  }
  if (className === 'quote-builder' && controller && !immutable) {
    const revisionId = document.createElement('input');
    revisionId.setAttribute('aria-label', '报价修订编号');
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.textContent = '批准报价';
    approve.hidden = !permissions.has('quote:approve');
    approve.addEventListener('click', () => {
      void controller
        .quoteCommand(revisionId.value, 'approve', {
          decision: 'APPROVED',
          reason: 'UI approval',
        })
        .then(() => {
          status.textContent = controller.message;
        });
    });
    const issue = document.createElement('button');
    issue.type = 'button';
    issue.textContent = '签发报价';
    issue.hidden = !permissions.has('quote:issue');
    issue.addEventListener('click', () => {
      void controller.quoteCommand(revisionId.value, 'issue').then(() => {
        workspace.classList.add('immutable');
        request.disabled = true;
        button.disabled = true;
        status.textContent = controller.message;
      });
    });
    panel.append(revisionId, approve, issue);
  }
  panel.append(heading, help, form, evidence);
  return panel;
}

export function appendLegacyCommercialPanels(
  context: WorkspaceAssemblyContext<LegacyAssemblyController>,
  immutable: boolean,
  permittedPaths: ReadonlyMap<string, readonly [CommercialPermission, CommercialPermission]>,
  commercialRevisionPath: CommercialRevisionPath,
): void {
  const { workspace, controller, permissions } = context;
  for (const [className, title, description, fields, action, path] of [
    [
      'opportunity-pipeline',
      '商机',
      '按负责人和阶段管理预计金额、赢率与成交日期',
      ['商机名称', '客户编号', '金额', '币种', '预计成交日'],
      '新建商机',
      '/api/v1/opportunities',
    ],
    [
      'ctr-revisions',
      '技术需求版本',
      '编辑需求草稿，提交后保留哈希、附件和审批证据',
      ['商机编号', '技术需求编号', '标题', '结构化需求'],
      '保存技术需求草稿',
      '/api/v1/ctrs',
    ],
    [
      'technical-solution-history',
      '技术方案',
      '方案修订精确引用已提交的技术需求版本',
      ['商机编号', '技术需求版本编号', '方案编码', '规格与假设'],
      '创建方案修订',
      '/api/v1/technical-solutions',
    ],
    [
      'cost-explanation',
      '成本说明',
      '使用固定币种、单位和已发布模型生成可解释成本决策',
      ['模型版本编号', '方案修订编号', '成本明细'],
      '计算成本',
      '/api/v1/cost-evaluations',
    ],
    [
      'policy-explanation',
      '销售政策',
      '显示命中规则、利润率边界、审批要求与原因',
      ['政策版本编号', '成本决策编号', '报价上下文'],
      '评估政策',
      '/api/v1/sales-policy-evaluations',
    ],
    [
      'quote-builder',
      '报价',
      '汇总行项目、折扣、成本、利润、有效期与全部版本引用',
      ['商机编号', '技术需求/方案/成本/政策引用', '报价明细', '有效期'],
      immutable ? '已签发（只读）' : '创建报价修订',
      '/api/v1/quotes',
    ],
    [
      'credit-review',
      '信用审查',
      '服务器从应收与未分配收款计算信用敞口，显示审批及到期状态',
      ['报价修订/快照', '敞口快照', '额度与有效期'],
      '评估信用',
      '/api/v1/credit-decisions',
    ],
    [
      'contract-evidence',
      '合同与签署证据',
      '显示精确报价引用、合同修订、签名回执和不可变哈希',
      ['报价快照', '合同内容', '签名回执'],
      '创建合同修订',
      '/api/v1/contracts',
    ],
    [
      'order-release',
      '订单释放',
      '仅使用已签发报价、有效信用决定与已签合同的精确引用',
      ['报价/信用/合同/签名编号', '订单行'],
      '释放订单',
      '/api/v1/sales-orders',
    ],
    [
      'ar-aging',
      '应收与账龄',
      '余额由过账与分配推导，不提供人工覆盖',
      ['客户', '原始金额', '到期日', '剩余余额'],
      '过账应收',
      '/api/v1/ar-open-items',
    ],
    [
      'payment-intake',
      '收款登记',
      '原始银行载荷、引用与哈希只读且不可删除',
      ['客户', '银行引用', '金额', '原始载荷'],
      '登记收款',
      '/api/v1/bank-payments',
    ],
    [
      'reconciliation',
      '核销',
      '按稳定顺序展示匹配解释、分配次序与剩余余额',
      ['收款余额', '开放项余额', '规范结果哈希'],
      '运行核销',
      '/api/v1/reconciliation-runs',
    ],
  ] as const) {
    if (
      controller &&
      [
        '/api/v1/opportunities',
        '/api/v1/ctrs',
        '/api/v1/technical-solutions',
        '/api/v1/cost-evaluations',
        '/api/v1/sales-policy-evaluations',
        '/api/v1/quotes',
        '/api/v1/credit-decisions',
        '/api/v1/contracts',
        '/api/v1/sales-orders',
        '/api/v1/ar-open-items',
        '/api/v1/bank-payments',
        '/api/v1/reconciliation-runs',
      ].includes(path)
    )
      continue;
    const requiredPermission = permittedPaths.get(path),
      canRead = Boolean(requiredPermission && permissions.has(requiredPermission[0])),
      canAct =
        (requiredPermission?.[1] !== undefined && permissions.has(requiredPermission[1])) ||
        (path === '/api/v1/ctrs' &&
          (permissions.has('ctr:submit') || permissions.has('ctr:approve'))) ||
        (path === '/api/v1/quotes' &&
          (permissions.has('quote:approve') || permissions.has('quote:issue')));
    if (controller && !canRead && !canAct) continue;
    const panel = createLegacyCommercialPanel(
      context,
      immutable,
      commercialRevisionPath,
      className,
      title,
      description,
      fields,
      action,
      path,
      canRead,
      canAct,
    );
    workspace.append(panel);
  }
}
