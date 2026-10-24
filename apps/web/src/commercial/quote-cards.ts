import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { QuoteViewContext, QuoteCardContext } from './pricing-view-ports';

export function appendQuoteCardActions(context: QuoteCardContext): void {
  const {
    workspace,
    status,
    controller,
    permissions,
    latestQuoteVersions,
    quote,
    quoteStatus,
    card,
    actions,
  } = context;
  const { textValue, recordValue, decimalValue, printIssuedQuote } = context.ports;
  if (
    permissions.has('quote:update') &&
    ['ISSUED', 'REJECTED'].includes(quoteStatus) &&
    Number(quote.revision) === latestQuoteVersions.get(textValue(quote.quoteId, ''))
  ) {
    const revise = el('button', 'secondary', '创建报价修订');
    revise.addEventListener('click', () => {
      openForm(
        workspace,
        `修订 ${textValue(quote.quoteNumber, '报价')}`,
        '基于当前签发版本调整整单折扣与有效期；原签发快照保持只读。',
        [
          {
            name: 'discountPercent',
            label: '新整单折扣（%）',
            type: 'number',
            required: true,
            value: String((Number(quote.discount ?? 0) * 100) / Number(quote.subtotal ?? 1)),
          },
          { name: 'validUntil', label: '新有效期至', type: 'date', required: true },
        ],
        '校验并创建修订',
        async (values) => {
          const quoteLines = (Array.isArray(quote.lines) ? quote.lines : []).map((line) => {
            const item = recordValue(line);
            return {
              description: textValue(item.description, '报价行'),
              quantity: textValue(item.quantity, '0'),
              unitCode: textValue(item.unit_code, ''),
              unitPrice: textValue(item.unit_price, '0'),
              total: textValue(item.total, '0'),
            };
          });
          const subtotal = quoteLines.reduce((sum, line) => sum + Number(line.total), 0);
          const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
          const total = subtotal - discount;
          const costTotal = Number(quote.costTotal ?? 0);
          const margin = total - costTotal;
          if (total <= 0) throw new Error('折扣后报价金额必须大于零');
          const marginBasisPoints = Math.trunc((margin * 10_000) / total);
          const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
          await controller.submit('/api/v1/sales-policy-evaluations', {
            policyVersionId: textValue(quote.policyVersionId, ''),
            costDecisionId: textValue(quote.costDecisionId, ''),
            context: { marginBasisPoints, discountBasisPoints },
          });
          const policyEvaluation = controller.revisionState;
          if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string')
            throw new Error('修订后的报价未通过销售政策');
          await controller.submit(`/api/v1/quotes/${textValue(quote.quoteId, '')}/revisions`, {
            quoteNumber: textValue(quote.quoteNumber, ''),
            opportunityId: textValue(quote.opportunityId, ''),
            ctrVersionId: textValue(quote.ctrVersionId, ''),
            technicalSolutionRevisionId: textValue(quote.technicalSolutionRevisionId, ''),
            costDecisionId: textValue(quote.costDecisionId, ''),
            policyVersionId: textValue(quote.policyVersionId, ''),
            policyEvaluationId: policyEvaluation.id,
            currency: textValue(quote.currency, 'CNY'),
            subtotal: decimalValue(subtotal),
            discount: decimalValue(discount),
            total: decimalValue(total),
            costTotal: decimalValue(costTotal),
            margin: decimalValue(margin),
            marginBasisPoints,
            validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
            lines: quoteLines,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(revise);
  }
  if (quoteStatus === 'DRAFT' && permissions.has('quote:approve')) {
    const approve = el('button', 'primary', '批准报价');
    approve.addEventListener('click', () => {
      openForm(
        workspace,
        '批准报价',
        '审批决定和理由将进入不可变证据链。',
        [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
        '确认批准',
        async (values) => {
          await controller.quoteCommand(textValue(quote.id, ''), 'approve', {
            decision: 'APPROVED',
            reason: values.reason ?? '',
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(approve);
  }
  if (quoteStatus === 'APPROVED' && permissions.has('quote:issue')) {
    const issue = el('button', 'primary', '签发报价');
    issue.addEventListener('click', () => {
      openForm(
        workspace,
        '签发报价',
        '签发后将生成只读快照，后续合同只能引用该快照。',
        [],
        '确认签发',
        async () => {
          await controller.quoteCommand(textValue(quote.id, ''), 'issue');
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    actions.append(issue);
  }
  if (quoteStatus === 'ISSUED') {
    const print = el('button', 'secondary', '打印 / 保存 PDF');
    print.addEventListener('click', () => {
      printIssuedQuote(quote);
    });
    actions.append(print);
  }
  card.append(actions);
}

export function appendQuoteCard(
  quoteContext: QuoteViewContext,
  latestQuoteVersions: ReadonlyMap<string, number>,
  quote: Record<string, unknown>,
  quoteList: HTMLElement,
): void {
  const { textValue, recordValue } = quoteContext.ports;
  const card = el('article', 'quote-card');
  const quoteStatus = textValue(quote.status, 'DRAFT');
  card.append(
    el(
      'p',
      'eyebrow',
      `${textValue(quote.quoteNumber, '报价')} · 第 ${textValue(quote.revision, '1')} 版`,
    ),
    el('strong', 'quote-total', `${textValue(quote.currency, '')} ${textValue(quote.total, '—')}`),
    el('span', `ctr-state state-${quoteStatus.toLocaleLowerCase()}`, quoteStatus),
    el(
      'p',
      'quote-economics',
      `折扣 ${textValue(quote.discount, '0')} · 成本 ${textValue(quote.costTotal, '—')} · 毛利 ${textValue(quote.margin, '—')}（${String(Number(quote.marginBasisPoints ?? 0) / 100)}%）`,
    ),
    el(
      'p',
      'version-pin',
      `技术需求 ${textValue(quote.ctrVersionId, '').slice(0, 8)} · 方案 ${textValue(quote.technicalSolutionRevisionId, '').slice(0, 8)} · 成本 ${textValue(quote.costDecisionId, '').slice(0, 8)} · 政策 ${textValue(quote.policyVersionId, '').slice(0, 8)}`,
    ),
  );
  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  const lineTable = el('div', 'quote-lines');
  for (const line of lines) {
    const item = recordValue(line);
    lineTable.append(
      el('span', '', textValue(item.description, '报价行')),
      el('span', '', `${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')}`),
      el('span', '', `${textValue(item.unit_price, '—')} / ${textValue(item.total, '—')}`),
    );
  }
  card.append(lineTable);
  const actions = el('div', 'quote-actions');
  const context: QuoteCardContext = {
    ...quoteContext,
    latestQuoteVersions,
    quote,
    quoteStatus,
    card,
    actions,
  };
  appendQuoteCardActions(context);
  quoteList.append(card);
}
