import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

function createMrpApprovalCommand(
  context: OperationsViewContext,
  proposal: Record<string, unknown>,
  action: string,
  label: string,
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller } = context;
  const command = el('button', action === 'approve' ? 'primary' : 'secondary', label);
  command.addEventListener('click', () => {
    openForm(
      workspace,
      `${label}物料需求建议`,
      '决定将追加到不可变事件台账。冻结建议必须提供覆盖审批编号。',
      [
        { name: 'reason', label: '决定理由', type: 'textarea', required: true },
        { name: 'approval', label: '审批证据编号', required: true },
        ...(proposal.frozen === true
          ? [
              {
                name: 'freezeOverrideApproval',
                label: '冻结覆盖审批编号',
                required: true,
              },
            ]
          : []),
      ],
      `确认${label}`,
      async (values) => {
        await controller.submit(`/api/v1/mrp-proposals/${String(proposal.id)}/${action}`, {
          reason: values.reason,
          evidence: {
            approval: values.approval,
            ...(values.freezeOverrideApproval
              ? { freezeOverrideApproval: values.freezeOverrideApproval }
              : {}),
          },
        });
        await refresh();
      },
    );
  });
  return command;
}

export function createMrpProposalCard(
  context: OperationsViewContext,
  proposal: Record<string, unknown>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel, supplyModeLabel, operationsNextAction } =
    context.ports;
  const explanation = recordValue(proposal.explanation),
    state = recordText(proposal, 'effectiveState', 'effectiveState'),
    card = el('article', `mrp-proposal-card ${proposal.frozen === true ? 'frozen' : ''}`);
  card.append(
    el(
      'strong',
      '',
      `${recordText(proposal, 'sku', 'sku')} · ${supplyModeLabel(recordText(proposal, 'proposalType', 'proposal_type'))}`,
    ),
    el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
    el(
      'p',
      '',
      `建议 ${recordText(proposal, 'quantity', 'quantity')} · ${recordText(proposal, 'startAt', 'start_at')} → ${recordText(proposal, 'dueAt', 'due_at')}`,
    ),
    el(
      'p',
      'mrp-formula',
      `毛需求 ${recordText(explanation, 'grossDemand', 'grossDemand')} + 安全库存 ${recordText(explanation, 'safetyStock', 'safetyStock')} − 可用库存 ${recordText(explanation, 'onHand', 'onHand')} − 在途 ${recordText(explanation, 'scheduledReceipts', 'scheduledReceipts')} = 净需求 ${recordText(explanation, 'netRequirement', 'netRequirement')}；按批量取整为 ${recordText(explanation, 'plannedQuantity', 'plannedQuantity')}`,
    ),
    el('p', 'next-action-note', `下一步：${operationsNextAction('mrp', state)}`),
  );
  if (proposal.frozen === true)
    card.append(el('p', 'warning-note', '冻结窗口内：批准必须提供覆盖审批证据'));
  if (permissions.has('mrp:approve') && state === 'PROPOSED') {
    for (const [action, label] of [
      ['approve', '批准'],
      ['reject', '拒绝'],
    ] as const) {
      const command = createMrpApprovalCommand(context, proposal, action, label, refresh);
      card.append(command);
    }
  }
  if (permissions.has('mrp:release') && state === 'APPROVED') {
    const release = el('button', 'primary', '释放到执行');
    release.addEventListener('click', () => {
      openForm(
        workspace,
        '释放物料需求建议',
        '释放后将进入采购或生产执行，请核对数量、日期和供应方式。',
        [
          { name: 'reason', label: '释放理由', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '计划凭证编号', required: true },
        ],
        '确认释放',
        async (values) => {
          await controller.submit(`/api/v1/mrp-proposals/${String(proposal.id)}/release`, {
            reason: values.reason,
            evidence: { reference: values.evidenceReference },
          });
          await refresh();
        },
      );
    });
    card.append(release);
  }
  return card;
}
