import { el } from '../dom';
import type { Customer360 } from './types';
import { businessEventLabel, businessStateLabel } from '../shared/business-labels';
import { displayMoney, displayTime } from '../shared/business-format';

export function customer360Content(view: Customer360): HTMLElement {
  const content = el('section', 'customer-360-content');

  const contacts = el('section', 'detail-section contacts-section');
  contacts.append(el('h3', '', '联系人'));
  if (view.contacts.length === 0) contacts.append(el('p', 'empty', '暂无可见联系人'));
  for (const contact of view.contacts) {
    const card = el('article', 'info-card contact-card');
    card.append(
      el('strong', '', `${contact.name}${contact.primary === true ? ' · 主要联系人' : ''}`),
    );
    if (contact.title) card.append(el('span', 'contact-title', contact.title));
    const details = el('p', 'contact-details');
    const visibleDetails = [
      Object.hasOwn(contact, 'email') ? contact.email : undefined,
      Object.hasOwn(contact, 'phone') ? contact.phone : undefined,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);
    details.textContent =
      visibleDetails.length > 0 ? visibleDetails.join(' · ') : '联系方式受限或未提供';
    card.append(details);
    contacts.append(card);
  }

  const ownership = el('section', 'detail-section ownership-section');
  ownership.append(el('h3', '', '归属历史'));
  if (view.ownership.length === 0) ownership.append(el('p', 'empty', '暂无可见归属记录'));
  for (const item of view.ownership) {
    const row = el('article', 'history-row');
    row.append(
      el('strong', '', item.ownerId),
      el('span', '', item.reason),
      el(
        'time',
        '',
        `${displayTime(item.startedAt)}${item.endedAt ? ` — ${displayTime(item.endedAt)}` : ' — 当前'}`,
      ),
    );
    ownership.append(row);
  }

  const leads = el('section', 'detail-section related-leads-section');
  leads.append(el('h3', '', '关联线索'));
  if (view.leads.length === 0) leads.append(el('p', 'empty', '暂无可见关联线索'));
  for (const lead of view.leads) {
    const row = el('article', 'history-row related-lead');
    row.append(
      el('strong', '', lead.title ?? lead.id),
      el('span', '', `${lead.source ?? '来源未知'} · ${lead.status ?? '状态未知'}`),
      el('time', '', displayTime(lead.createdAt)),
    );
    leads.append(row);
  }

  const timeline = el('section', 'detail-section activity-timeline');
  timeline.append(el('h3', '', '活动时间线'));
  const activities = [...view.activities].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
  if (activities.length === 0) timeline.append(el('p', 'empty', '暂无可见活动'));
  for (const activity of activities) {
    const row = el('article', 'timeline-item');
    row.append(
      el('time', '', displayTime(activity.occurredAt)),
      el('strong', '', businessEventLabel(activity.type)),
      el('p', '', activity.summary),
    );
    timeline.append(row);
  }

  const opportunities = el('section', 'detail-section related-opportunities-section');
  opportunities.append(el('h3', '', '关联商机'));
  if (view.opportunities.length === 0) opportunities.append(el('p', 'empty', '暂无可见关联商机'));
  for (const item of view.opportunities) {
    const row = el('article', 'history-row related-opportunity');
    const amount = item.value?.amount;
    const currency = item.value?.currency;
    const probability =
      typeof item.probabilityBasisPoints === 'number'
        ? `${(item.probabilityBasisPoints / 100).toFixed(0)}%`
        : '概率受限';
    row.append(
      el('strong', '', item.name ?? item.id),
      el(
        'span',
        '',
        `${businessStateLabel(item.status)} · ${currency && amount ? displayMoney(currency, amount) : '金额受限'} · ${probability}`,
      ),
      el('time', '', item.expectedCloseDate ?? '预计日期受限'),
    );
    opportunities.append(row);
  }

  content.append(contacts, ownership, leads, opportunities, timeline);
  return content;
}
