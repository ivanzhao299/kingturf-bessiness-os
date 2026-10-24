import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CreditContractViewContext } from './credit-contract-view-ports';
import { createContractDocumentPanel } from './contract-documents';

function appendContractHeading(
  context: CreditContractViewContext,
  issuedQuotes: readonly Record<string, unknown>[],
  heading: HTMLElement,
  copy: HTMLElement,
): void {
  const { workspace, status, controller, permissions } = context;
  const { textValue } = context.ports;
  if (permissions.has('contract:revise') && issuedQuotes.length > 0) {
    const createContract = el('button', 'primary', '＋ 新建合同');
    createContract.addEventListener('click', () => {
      openForm(
        workspace,
        '新建合同修订',
        '合同正文使用结构化商务条款生成，并固定到所选报价快照。',
        [
          {
            name: 'quoteRevisionId',
            label: '已签发报价',
            type: 'select',
            required: true,
            options: issuedQuotes.map((item) => ({
              value: textValue(item.id, ''),
              label: `${textValue(item.quoteNumber, '报价')} · 第 ${textValue(item.revision, '1')} 版`,
            })),
          },
          { name: 'contractNumber', label: '合同编号', required: true },
          { name: 'paymentTerms', label: '付款条款', type: 'textarea', required: true },
          { name: 'deliveryTerms', label: '交付条款', type: 'textarea', required: true },
          { name: 'warranty', label: '质保条款', type: 'textarea', required: true },
          { name: 'acceptance', label: '验收标准', type: 'textarea', required: true },
        ],
        '创建合同修订',
        async (values) => {
          const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
          const opportunity = controller.opportunities.find(
            (item) => item.id === quote?.opportunityId,
          );
          if (!quote || typeof opportunity?.customerId !== 'string')
            throw new Error('报价未关联有效客户');
          await controller.submit('/api/v1/contracts', {
            customerId: opportunity.customerId,
            opportunityId: textValue(quote.opportunityId, ''),
            contractNumber: values.contractNumber ?? '',
            quoteRevisionId: textValue(quote.id, ''),
            quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
            content: {
              paymentTerms: values.paymentTerms ?? '',
              deliveryTerms: values.deliveryTerms ?? '',
              warranty: values.warranty ?? '',
              acceptance: values.acceptance ?? '',
            },
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    heading.append(copy, createContract);
  } else heading.append(copy);
}

function createContractCard(
  context: CreditContractViewContext,
  contract: Record<string, unknown>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, recordValue } = context.ports;
  const state = recordText(contract, 'effectiveStatus', 'effectiveStatus', 'DRAFT');
  const content = recordValue(contract.content);
  const card = el('article', 'qtc-card');
  card.append(
    el(
      'p',
      'eyebrow',
      `${recordText(contract, 'contractNumber', 'contractNumber', '合同')} · 第 ${recordText(contract, 'revision', 'revision', '1')} 版`,
    ),
    el('strong', '', state === 'SIGNED' ? '合同已签署' : '合同待签署'),
    el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
    el('p', 'muted', `付款：${textValue(content.paymentTerms, '—')}`),
    el('p', 'muted', `交付：${textValue(content.deliveryTerms, '—')}`),
    el(
      'code',
      'input-hash',
      `签署存证 ${recordText(contract, 'contentHash', 'content_hash').slice(0, 16)}…`,
    ),
  );
  const documentPanel = createContractDocumentPanel(context, contract);
  card.append(documentPanel);
  if (state === 'DRAFT' && permissions.has('contract:sign')) {
    const sign = el('button', 'primary', '记录签署回执');
    sign.addEventListener('click', () => {
      openForm(
        workspace,
        '记录合同签署',
        '签署平台回执、签署时间和载荷哈希将作为不可变证据保存。',
        [
          { name: 'provider', label: '签署平台', required: true, value: '线下盖章' },
          { name: 'providerReceiptId', label: '回执编号', required: true },
          { name: 'signedAt', label: '签署日期', type: 'date', required: true },
          { name: 'signer', label: '签署人 / 经办人', required: true },
        ],
        '确认签署',
        async (values) => {
          await controller.submit(`/api/v1/contracts/${textValue(contract.id, '')}/sign`, {
            provider: values.provider ?? '',
            providerReceiptId: values.providerReceiptId ?? '',
            payload: { signer: values.signer ?? '', acknowledged: true },
            signedAt: new Date(`${values.signedAt ?? ''}T12:00:00.000Z`).toISOString(),
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    card.append(sign);
  }
  return card;
}

export function appendContractView(context: CreditContractViewContext): void {
  const { workspace, controller } = context;
  const contractPanel = el('section', 'qtc-workbench contract-workbench');
  const heading = el('div', 'pipeline-heading');
  const copy = el('div');
  copy.append(el('h2', '', '合同与签署'), el('p', '', '合同版本、报价依据与签署记录'));
  const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
    (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
  );
  appendContractHeading(context, issuedQuotes, heading, copy);
  contractPanel.append(heading);
  const contracts = controller.views.get('/api/v1/contracts') ?? [];
  const list = el('div', 'qtc-list');
  for (const contract of contracts) {
    const card = createContractCard(context, contract);
    list.append(card);
  }
  if (contracts.length === 0) list.append(el('p', 'pipeline-empty', '暂无合同修订。'));
  contractPanel.append(list);
  workspace.append(contractPanel);
}
