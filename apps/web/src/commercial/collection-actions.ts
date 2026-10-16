import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';

export function appendCollectionFollowups(
  context: FinanceRiskViewContext,
  item: Record<string, unknown>,
  caseId: string,
  state: string,
  actions: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText, currencyLabel } = context.ports;
  if (permissions.has('collection:manage') && !['LEGAL_ACCEPTED', 'CLOSED'].includes(state)) {
    const follow = el('button', 'secondary', '记录催收跟进');
    follow.addEventListener('click', () => {
      openForm(
        workspace,
        '记录催收跟进',
        '联系结果和下一动作将形成不可变证据。',
        [
          {
            name: 'channel',
            label: '联系渠道',
            type: 'select',
            required: true,
            options: [
              { value: 'PHONE', label: '电话' },
              { value: 'EMAIL', label: '邮件' },
              { value: 'LETTER', label: '函件' },
              { value: 'MEETING', label: '会议' },
              { value: 'VISIT', label: '上门' },
              { value: 'OTHER', label: '其他' },
            ],
          },
          { name: 'occurredAt', label: '联系时间', type: 'datetime-local', required: true },
          { name: 'contactPerson', label: '对方联系人', required: true },
          { name: 'outcome', label: '联系结果', type: 'textarea', required: true },
          { name: 'nextActionAt', label: '下一动作时间', type: 'datetime-local' },
          { name: 'evidenceReference', label: '证据引用', required: true },
        ],
        '保存跟进',
        async (values) => {
          await controller.submit(`/api/v1/collection-cases/${caseId}/followups`, {
            channel: values.channel ?? 'PHONE',
            occurredAt: new Date(values.occurredAt ?? '').toISOString(),
            contactPerson: values.contactPerson ?? '',
            outcome: values.outcome ?? '',
            ...(values.nextActionAt
              ? { nextActionAt: new Date(values.nextActionAt).toISOString() }
              : {}),
            evidence: { reference: values.evidenceReference ?? '' },
            idempotencyKey: `FOLLOW-${Date.now().toString(36)}`,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(follow);
    if (['OPEN', 'CONTACTING', 'PROMISE_BROKEN'].includes(state)) {
      const promise = el('button', 'secondary', '登记付款承诺');
      promise.addEventListener('click', () => {
        openForm(
          workspace,
          '登记付款承诺',
          '承诺金额不得超过实时应收余额；履约只能引用真实核销条目。',
          [
            { name: 'promisedAmount', label: '承诺金额', type: 'number', required: true },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                {
                  value: recordText(item, 'currency', 'currency', 'CNY'),
                  label: currencyLabel(recordText(item, 'currency', 'currency', 'CNY')),
                },
              ],
            },
            { name: 'promisedAt', label: '承诺时间', type: 'datetime-local', required: true },
            { name: 'dueAt', label: '承诺付款期限', type: 'datetime-local', required: true },
            { name: 'debtorContact', label: '承诺人', required: true },
            { name: 'evidenceReference', label: '承诺证据引用', required: true },
          ],
          '保存承诺',
          async (values) => {
            await controller.submit(`/api/v1/collection-cases/${caseId}/promises`, {
              promisedAmount: values.promisedAmount ?? '',
              currency: values.currency ?? 'CNY',
              promisedAt: new Date(values.promisedAt ?? '').toISOString(),
              dueAt: new Date(values.dueAt ?? '').toISOString(),
              debtorContact: values.debtorContact ?? '',
              evidence: { reference: values.evidenceReference ?? '' },
              idempotencyKey: `PROMISE-${Date.now().toString(36)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      actions.append(promise);
    }
  }
}

export function appendCollectionEscalations(
  context: FinanceRiskViewContext,
  caseId: string,
  state: string,
  promises: readonly Record<string, unknown>[],
  actions: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue } = context.ports;
  if (permissions.has('collection:escalate')) {
    for (const promise of promises.filter((candidate) => candidate.state === 'PENDING')) {
      const broken = el('button', 'secondary', '确认承诺违约');
      broken.addEventListener('click', () => {
        openForm(
          workspace,
          '确认付款承诺违约',
          '确认前应核对承诺期限和最新核销记录。',
          [
            { name: 'reason', label: '违约说明', type: 'textarea', required: true },
            { name: 'evidenceReference', label: '复核证据引用', required: true },
          ],
          '确认违约',
          async (values) => {
            await controller.submit(
              `/api/v1/collection-promises/${textValue(promise.id, '')}/break`,
              {
                reason: values.reason ?? '',
                allocationEntryIds: [],
                evidence: { reference: values.evidenceReference ?? '' },
                idempotencyKey: `BROKEN-${Date.now().toString(36)}`,
              },
            );
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      actions.append(broken);
    }
    if (['CONTACTING', 'PROMISE_BROKEN'].includes(state)) {
      const legal = el('button', 'primary', '申请法务移交');
      legal.addEventListener('click', () => {
        openForm(
          workspace,
          '申请法务移交',
          '申请人不能受理自己的移交；索赔金额由实时应收余额冻结。',
          [
            { name: 'handoffNumber', label: '移交编号', required: true },
            { name: 'reason', label: '移交原因', type: 'textarea', required: true },
          ],
          '提交法务',
          async (values) => {
            await controller.submit(`/api/v1/collection-cases/${caseId}/legal-handoffs`, {
              handoffNumber: values.handoffNumber ?? '',
              reason: values.reason ?? '',
              idempotencyKey: `LEGAL-${Date.now().toString(36)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      actions.append(legal);
    }
  }
}

export function appendCollectionLegalHandoff(
  context: FinanceRiskViewContext,
  handoff: Record<string, unknown>,
  actions: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue } = context.ports;
  if (permissions.has('legal-case:decide') && handoff.state === 'REQUESTED') {
    const accept = el('button', 'primary', '受理法务移交');
    accept.addEventListener('click', () => {
      openForm(
        workspace,
        '独立受理法务移交',
        '服务器和数据库会拒绝申请人自受理。',
        [
          { name: 'reason', label: '受理意见', type: 'textarea', required: true },
          { name: 'reviewReference', label: '审查记录引用', required: true },
        ],
        '确认受理',
        async (values) => {
          await controller.submit(`/api/v1/legal-handoffs/${textValue(handoff.id, '')}/accept`, {
            reason: values.reason ?? '',
            evidence: { reviewReference: values.reviewReference ?? '' },
            idempotencyKey: `LEGAL-ACCEPT-${Date.now().toString(36)}`,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(accept);
  }
  if (permissions.has('debt-evidence:generate') && handoff.state === 'ACCEPTED') {
    const packageAction = el('button', 'primary', '生成债权证据包');
    packageAction.addEventListener('click', () => {
      openForm(
        workspace,
        '生成不可变债权证据包',
        '系统会列出缺失项；不完整证据包不能用于法务结案。',
        [{ name: 'packageNumber', label: '证据包编号', required: true }],
        '冻结证据包',
        async (values) => {
          await controller.submit(
            `/api/v1/legal-handoffs/${textValue(handoff.id, '')}/evidence-packages`,
            {
              packageNumber: values.packageNumber ?? '',
              idempotencyKey: `DEBT-${Date.now().toString(36)}`,
            },
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(packageAction);
  }
}
