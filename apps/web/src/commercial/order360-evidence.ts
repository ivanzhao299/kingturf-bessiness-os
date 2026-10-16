import { el } from '../dom';
import type { FulfillmentViewContext } from './fulfillment-view-ports';

export function createOrderEvidence(
  context: FulfillmentViewContext,
  aggregate: Record<string, unknown>,
): HTMLElement {
  const { status } = context;
  const {
    recordValue,
    recordText,
    textValue,
    displayMoney,
    businessStateLabel,
    businessEventLabel,
    businessEventDetailLabel,
  } = context.ports;
  const order = recordValue(aggregate.order);
  const quote = recordValue(aggregate.quote);
  const credit = recordValue(aggregate.credit);
  const contract = recordValue(aggregate.contract);
  const receivables = Array.isArray(aggregate.receivables) ? aggregate.receivables : [];
  const payments = Array.isArray(aggregate.payments) ? aggregate.payments : [];
  const commissions = Array.isArray(aggregate.commissions) ? aggregate.commissions : [];
  const risks = Array.isArray(aggregate.risks) ? aggregate.risks : [];
  const collections = Array.isArray(aggregate.collections) ? aggregate.collections : [];
  const anomalies = Array.isArray(aggregate.anomalies)
    ? aggregate.anomalies.map(recordValue).filter((item) => item.active === true)
    : [];
  const timeline = Array.isArray(aggregate.timeline)
    ? aggregate.timeline
        .map(recordValue)
        .sort(
          (left, right) =>
            Date.parse(recordText(right, 'occurredAt', 'occurredAt')) -
            Date.parse(recordText(left, 'occurredAt', 'occurredAt')),
        )
    : [];
  const card = el('article', 'order-360-card');
  card.append(
    el('p', 'eyebrow', recordText(order, 'orderNumber', 'order_number', '销售订单')),
    el(
      'h3',
      '',
      `${displayMoney(recordText(order, 'currency', 'currency'), recordText(order, 'total', 'total', '—'))} · ${businessStateLabel(recordText(order, 'status', 'status'))}`,
    ),
    el(
      'p',
      'qtc-metrics',
      `报价 ${recordText(quote, 'quoteNumber', 'quoteNumber', '—')} · 信用 ${businessStateLabel(recordText(credit, 'effectiveStatus', 'effective_status', '—'), '—')} · 合同 ${recordText(contract, 'contractNumber', 'contractNumber', '—')}`,
    ),
    el(
      'p',
      anomalies.length ? 'risk-alert' : 'success-note',
      anomalies.length
        ? `当前异常 ${String(anomalies.length)} 项：${anomalies.map((item) => textValue(item.message, '')).join('；')}`
        : '当前未发现活动异常',
    ),
    el(
      'p',
      'muted',
      `应收 ${String(receivables.length)} · 回款 ${String(payments.length)} · 催收 ${String(collections.length)} · 佣金 ${String(commissions.length)} · 风险 ${String(risks.length)} · 证据 ${String(timeline.length)}`,
    ),
  );
  const evidenceTools = el('div', 'evidence-tools');
  const eventFilter = el('select', 'filter-select');
  eventFilter.setAttribute('aria-label', '筛选证据事件');
  for (const [value, label] of [
    ['ALL', '全部事件'],
    ['COMMERCIAL', '商务与订单'],
    ['FINANCE', '应收、回款与佣金'],
    ['RISK', '风险与审批'],
    ['DELIVERY', '发货与签收'],
    ['LEGAL', '催收与法务'],
  ] as const) {
    const option = el('option', '', label);
    option.setAttribute('value', value);
    eventFilter.append(option);
  }
  const sortEvidence = el('button', 'secondary compact-action', '时间：最新在前');
  sortEvidence.type = 'button';
  const copyEvidence = el('button', 'secondary compact-action', '复制当前证据');
  copyEvidence.type = 'button';
  evidenceTools.append(eventFilter, sortEvidence, copyEvidence);
  const evidence = el('ol', 'order-360-timeline');
  const eventCategory = (type: string): string => {
    if (/COLLECTION|LEGAL_HANDOFF|DEBT_EVIDENCE/iu.test(type)) return 'LEGAL';
    if (/PAYMENT|AR_|COMMISSION/iu.test(type)) return 'FINANCE';
    if (/RISK|EXCEPTION|APPROV|REJECT/iu.test(type)) return 'RISK';
    if (/SHIPMENT|DISPATCH|DELIVER/iu.test(type)) return 'DELIVERY';
    return 'COMMERCIAL';
  };
  for (const event of timeline) {
    const type = recordText(event, 'type', 'type');
    const item = el(
      'li',
      '',
      `${recordText(event, 'occurredAt', 'occurredAt').slice(0, 16).replace('T', ' ')} · ${businessEventLabel(type)} · ${businessEventDetailLabel(type, recordText(event, 'label', 'label'))}`,
    );
    item.setAttribute('data-event-category', eventCategory(type));
    item.setAttribute('data-event-time', recordText(event, 'occurredAt', 'occurredAt'));
    item.setAttribute('title', `事件编码：${type}`);
    evidence.append(item);
  }
  const applyEvidenceFilter = () => {
    const selected = eventFilter.value;
    for (const item of Array.from(evidence.children) as HTMLElement[])
      item.hidden = selected !== 'ALL' && item.dataset.eventCategory !== selected;
  };
  eventFilter.addEventListener('change', applyEvidenceFilter);
  let newestFirst = true;
  sortEvidence.addEventListener('click', () => {
    newestFirst = !newestFirst;
    const items = Array.from(evidence.children) as HTMLElement[];
    items.sort((left, right) => {
      const delta =
        Date.parse(left.dataset.eventTime ?? '') - Date.parse(right.dataset.eventTime ?? '');
      return newestFirst ? -delta : delta;
    });
    evidence.replaceChildren(...items);
    sortEvidence.textContent = newestFirst ? '时间：最新在前' : '时间：最早在前';
  });
  copyEvidence.addEventListener('click', () => {
    const lines = (Array.from(evidence.children) as HTMLElement[])
      .filter((item) => !item.hidden)
      .map((item) => item.textContent.trim());
    void globalThis.navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => {
        status.textContent = `已复制 ${String(lines.length)} 条订单证据`;
      })
      .catch(() => {
        status.textContent = '复制失败，请检查浏览器剪贴板权限';
      });
  });
  card.append(evidenceTools, evidence);
  return card;
}
