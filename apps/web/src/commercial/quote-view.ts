import { el } from '../dom';
import { appendQuoteHeading } from './quote-create';
import { appendQuoteCard } from './quote-cards';
import type { PricingViewContext, QuoteViewContext } from './pricing-view-ports';

export function appendQuoteView(pricingContext: PricingViewContext): void {
  const { workspace, controller } = pricingContext;
  const { textValue } = pricingContext.ports;
  const quotePanel = el('section', 'quote-workbench');
  const quoteHeading = el('div', 'pipeline-heading');
  const quoteCopy = el('div');
  quoteCopy.append(el('h2', '', '销售报价'), el('p', '', '报价明细、毛利与政策校验'));
  const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
  const policies = (controller.views.get('/api/v1/sales-policies') ?? []).filter(
    (item) => item.status === 'PUBLISHED',
  );
  const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
  const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
  const context: QuoteViewContext = { ...pricingContext, costs, policies, solutions, ctrs };
  appendQuoteHeading(context, quoteHeading, quoteCopy);
  quotePanel.append(quoteHeading);
  const quotes = controller.views.get('/api/v1/quotes') ?? [];
  const latestQuoteVersions = new Map<string, number>();
  for (const quote of quotes) {
    const quoteId = textValue(quote.quoteId, '');
    latestQuoteVersions.set(
      quoteId,
      Math.max(latestQuoteVersions.get(quoteId) ?? 0, Number(quote.revision ?? 0)),
    );
  }
  const quoteList = el('div', 'quote-list');
  for (const quote of quotes) {
    appendQuoteCard(context, latestQuoteVersions, quote, quoteList);
  }
  if (quotes.length === 0) quoteList.append(el('p', 'pipeline-empty', '暂无报价。'));
  quotePanel.append(quoteList);
  workspace.append(quotePanel);
}
