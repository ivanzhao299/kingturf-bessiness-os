// CRM-UX：客户 360 抽屉内容——活动时间线（按日分组/类型图标/内联链接）、联系人卡片
//（敏感字段遮蔽）、商机漏斗、关联商机/线索、信用概要（可选数据通道）。
// 除信用概要外，数据全部来自既有 360 视图（/api/v1/customers/:id/360），不新增任何请求。
import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { StatusBadge } from '@kingturf/ui';
import { businessEventLabel } from '../../shared/business-labels';
import { displayMoney } from '../../shared/business-format';
import { Avatar, SectionCard } from '../../crm/crm-ux-parts';
import { ActivityGlyph, EyeGlyph, TargetGlyph, UserGlyph } from '../../crm/crm-ux-icons';
import {
  UNKNOWN_DAY,
  activityIconOf,
  amountsLabel,
  closedOpportunitiesOf,
  creditDecisionLabel,
  creditDecisionTone,
  creditSummaryOf,
  creditUsageOf,
  dateTimeLabelOf,
  dayLabelOf,
  funnelOf,
  groupByDay,
  isCreditSummaryEmpty,
  leadStatusLabel,
  leadStatusTone,
  maskEmail,
  maskPhone,
  opportunityStageLabel,
  opportunityStageTone,
  recordOf,
  relatedOf,
  relativeTimeOf,
  sortActivities,
  textOf,
  timeOf,
  type CrmRecord,
  type CustomerCreditSummary,
} from '../../crm/crm-ux';

export type Customer360State = Readonly<{
  view: CrmRecord;
  /** 相对时间与日期分组的基准（宿主注入；缺省系统时钟）。 */
  now: number;
  /** 联系方式是否明文显示；默认遮蔽，每次打开抽屉重置。 */
  contactsVisible: boolean;
  setContactsVisible: (next: boolean) => void;
  typeFilter: string;
  onTypeFilter: (next: string) => void;
  /** 内联链接跳转目标的锚点 id；空串表示无高亮。 */
  highlight: string;
  jumpTo: (targetId: string) => void;
  clearHighlight: () => void;
  /** 新增分区（商机漏斗 / 关联线索）无对应读权限时不渲染：服务端此时恒返回空，呈现「暂无」会误导。 */
  canReadOpportunities: boolean;
  canReadLeads: boolean;
  /** 信用概要：undefined = 无数据通道或加载失败（不渲染），null = 无信用记录。 */
  credit: CustomerCreditSummary | null | undefined;
}>;

type LinkKind = 'opportunity' | 'lead';
type TimelineLink = Readonly<{ kind: LinkKind; id: string; name: string; target: string }>;
type TimelineContext = Readonly<{
  leads: readonly CrmRecord[];
  opportunities: readonly CrmRecord[];
}>;

const HIGHLIGHT_MS = 1800;

const opportunityAnchor = (id: string): string => `kt-customer-opportunity-${id}`;
const leadAnchor = (id: string): string => `kt-customer-lead-${id}`;

const rowsOf = (value: unknown): readonly CrmRecord[] =>
  Array.isArray(value) ? value.map(recordOf) : [];

const hasChannel = (contact: CrmRecord): boolean =>
  textOf(contact.email) !== '' || textOf(contact.phone) !== '';

const clockLabel = (value: unknown): string => {
  const time = timeOf(value);
  if (time === null) return '';
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const moneyOf = (value: Readonly<{ currency: string; amount: number }> | null): string =>
  value === null ? '—' : displayMoney(value.currency, value.amount);

/** 内联链接点击后滚动到目标卡并高亮；高亮在动画时长后自动清除，便于再次触发。 */
const useHighlight = (state: Customer360State): void => {
  const { highlight, clearHighlight } = state;
  useEffect(() => {
    if (highlight === '') return;
    const finder = globalThis.document as unknown as
      | { getElementById?: (id: string) => { scrollIntoView?: () => void } | null }
      | null
      | undefined;
    finder?.getElementById?.(highlight)?.scrollIntoView?.();
    const timer = setTimeout(clearHighlight, HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [highlight, clearHighlight]);
};

/** 联系方式遮蔽开关：默认遮蔽（肩后窥探防护），显隐状态以文字 + 眼形图标双载体表达。 */
const VisibilityToggle = ({
  visible,
  onToggle,
}: Readonly<{ visible: boolean; onToggle: (next: boolean) => void }>) => (
  <button
    type="button"
    class="crm-visibility"
    aria-pressed={visible}
    data-testid="kt-customer-contact-visibility"
    title={visible ? '联系方式当前可见，点击隐藏' : '联系方式已遮蔽，点击显示'}
    onClick={() => {
      onToggle(!visible);
    }}
  >
    <EyeGlyph off={visible} />
    {visible ? '隐藏联系方式' : '显示联系方式'}
  </button>
);

const ContactCard = ({ contact, visible }: Readonly<{ contact: CrmRecord; visible: boolean }>) => {
  const email = textOf(contact.email);
  const phone = textOf(contact.phone);
  const title = textOf(contact.title);
  return (
    <article
      class="crm-contact"
      data-testid="kt-customer-contact"
      data-primary={contact.primary === true}
    >
      <Avatar name={contact.name} large />
      <div class="crm-contact-body">
        <p class="crm-contact-name">
          <strong>{textOf(contact.name, '—')}</strong>
          {contact.primary === true ? <span class="crm-tag">主联系人</span> : null}
        </p>
        {title === '' ? null : <p class="crm-contact-title">{title}</p>}
        <ul class="crm-contact-channels">
          {email === '' ? null : (
            <li>
              <ActivityGlyph kind="mail" />
              <span data-testid="kt-customer-contact-email">
                {visible ? email : maskEmail(email)}
              </span>
            </li>
          )}
          {phone === '' ? null : (
            <li>
              <ActivityGlyph kind="call" />
              <span data-testid="kt-customer-contact-phone">
                {visible ? phone : maskPhone(phone)}
              </span>
            </li>
          )}
          {email === '' && phone === '' ? (
            <li data-restricted="true">联系方式受限或未提供</li>
          ) : null}
        </ul>
      </div>
    </article>
  );
};

const ContactsSection = ({
  state,
  contacts,
}: Readonly<{ state: Customer360State; contacts: readonly CrmRecord[] }>) => (
  <SectionCard
    title="联系人"
    count={contacts.length}
    testId="kt-customer-contacts"
    actions={
      contacts.some(hasChannel) ? (
        <VisibilityToggle visible={state.contactsVisible} onToggle={state.setContactsVisible} />
      ) : null
    }
  >
    {contacts.length === 0 ? (
      <p class="crm-empty">暂无联系人</p>
    ) : (
      contacts.map((contact) => (
        <ContactCard
          key={textOf(contact.id, textOf(contact.name))}
          contact={contact}
          visible={state.contactsVisible}
        />
      ))
    )}
  </SectionCard>
);

const TypeFilter = ({
  state,
  types,
}: Readonly<{ state: Customer360State; types: readonly string[] }>) => (
  <select
    class="console-input crm-select"
    aria-label="按活动类型筛选"
    data-testid="kt-customer-activity-type-filter"
    value={state.typeFilter}
    onChange={(event) => {
      state.onTypeFilter((event.target as HTMLSelectElement).value);
    }}
  >
    <option value="">全部类型</option>
    {types.map((type) => (
      <option key={type} value={type}>
        {businessEventLabel(type)}
      </option>
    ))}
  </select>
);

const linksOf = (activity: CrmRecord, context: TimelineContext): readonly TimelineLink[] => {
  const related = relatedOf(activity, context.leads, context.opportunities);
  return [
    ...related.opportunities.map((opportunity) => ({
      kind: 'opportunity' as const,
      id: textOf(opportunity.id),
      name: textOf(opportunity.name, '商机'),
      target: opportunityAnchor(textOf(opportunity.id)),
    })),
    ...related.leads.map((lead) => ({
      kind: 'lead' as const,
      id: textOf(lead.id),
      name: textOf(lead.title, '线索'),
      target: leadAnchor(textOf(lead.id)),
    })),
  ].filter((link) => link.id !== '');
};

const TimelineItem = ({
  activity,
  state,
  context,
}: Readonly<{ activity: CrmRecord; state: Customer360State; context: TimelineContext }>) => {
  const links = linksOf(activity, context);
  const icon = activityIconOf(activity.type);
  const occurredAt = textOf(activity.occurredAt);
  const absolute = dateTimeLabelOf(occurredAt);
  return (
    <article class="crm-timeline-item" data-testid="kt-customer-activity" data-icon={icon}>
      <span class="crm-timeline-icon">
        <ActivityGlyph kind={icon} />
      </span>
      <div class="crm-timeline-body">
        <p class="crm-timeline-head">
          <strong>{businessEventLabel(activity.type)}</strong>
          <time
            {...(occurredAt === '' ? {} : { datetime: occurredAt })}
            {...(absolute === '' ? {} : { title: absolute })}
          >
            {clockLabel(occurredAt)}
          </time>
        </p>
        <p class="crm-timeline-summary">{textOf(activity.summary, '—')}</p>
        {links.length === 0 ? null : (
          <p class="crm-timeline-links">
            {links.map((link) => (
              <button
                key={`${link.kind}-${link.id}`}
                type="button"
                class="crm-link-chip"
                data-kind={link.kind}
                data-testid="kt-customer-activity-link"
                onClick={() => {
                  state.jumpTo(link.target);
                }}
              >
                {link.kind === 'opportunity' ? <TargetGlyph /> : <UserGlyph />}
                {link.name}
              </button>
            ))}
          </p>
        )}
      </div>
    </article>
  );
};

/** 时间线：按本地自然日分组（今天/昨天/日期），保持发生时间倒序；类型筛选仅影响呈现。 */
const TimelineSection = ({
  state,
  activities,
  context,
}: Readonly<{
  state: Customer360State;
  activities: readonly CrmRecord[];
  context: TimelineContext;
}>) => {
  const typeOf = (activity: CrmRecord): string => textOf(activity.type, '');
  const types = [...new Set(activities.map(typeOf).filter((type) => type !== ''))];
  const visible =
    state.typeFilter === ''
      ? activities
      : activities.filter((row) => typeOf(row) === state.typeFilter);
  const groups = groupByDay(sortActivities(visible), (activity) => activity.occurredAt);
  return (
    <SectionCard
      title="活动时间线"
      count={activities.length}
      testId="kt-customer-activities"
      actions={types.length > 1 ? <TypeFilter state={state} types={types} /> : null}
    >
      {activities.length === 0 ? (
        <p class="crm-empty">暂无活动</p>
      ) : visible.length === 0 ? (
        <p class="crm-empty">该类型暂无活动</p>
      ) : (
        groups.map((group) => (
          <div class="crm-timeline-day" key={group.key}>
            <p class="crm-timeline-date">
              {group.key === UNKNOWN_DAY ? '时间未知' : dayLabelOf(group.key, state.now)}
            </p>
            <div class="crm-timeline">
              {group.rows.map((activity) => (
                <TimelineItem
                  key={textOf(activity.id, textOf(activity.summary))}
                  activity={activity}
                  state={state}
                  context={context}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </SectionCard>
  );
};

const FunnelSection = ({ opportunities }: Readonly<{ opportunities: readonly CrmRecord[] }>) => {
  const stages = funnelOf(opportunities);
  const closed = closedOpportunitiesOf(opportunities);
  const open = stages.reduce((sum, stage) => sum + stage.count, 0);
  return (
    <SectionCard title="商机漏斗" count={opportunities.length} testId="kt-customer-funnel">
      {open === 0 ? (
        <p class="crm-empty">暂无在途商机</p>
      ) : (
        <div class="crm-funnel">
          {stages.map((stage) => (
            <div
              class="crm-funnel-row"
              key={stage.stage}
              data-stage={stage.stage}
              data-testid="kt-customer-funnel-stage"
            >
              <span class="crm-funnel-stage">{stage.label}</span>
              <span
                class="crm-funnel-track"
                role="img"
                aria-label={`${stage.label} ${String(stage.count)} 个商机`}
              >
                <span
                  class="crm-funnel-bar"
                  style={{ width: `${String(Math.round(stage.share * 100))}%` }}
                />
              </span>
              <span class="crm-funnel-figure">
                <strong>{String(stage.count)}</strong>
                <span class="crm-funnel-amount">{amountsLabel(stage.amounts)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {closed.lost + closed.cancelled === 0 ? null : (
        <p class="crm-funnel-closed">
          已关闭：输单 {String(closed.lost)} · 已取消 {String(closed.cancelled)}
        </p>
      )}
    </SectionCard>
  );
};

const OpportunityCard = ({
  opportunity,
  highlighted,
}: Readonly<{ opportunity: CrmRecord; highlighted: boolean }>) => {
  const value = recordOf(opportunity.value);
  const amount = Number(value.amount);
  const closeDate = textOf(opportunity.expectedCloseDate).slice(0, 10);
  return (
    <article
      class="crm-related-card"
      id={opportunityAnchor(textOf(opportunity.id))}
      data-highlighted={highlighted}
      data-testid="kt-customer-opportunity"
    >
      <p class="crm-related-name">{textOf(opportunity.name, '—')}</p>
      <p class="crm-related-meta">
        <StatusBadge tone={opportunityStageTone(opportunity.status)}>
          {opportunityStageLabel(opportunity.status)}
        </StatusBadge>
        {Number.isFinite(amount) ? <span>{displayMoney(value.currency, amount)}</span> : null}
        {closeDate === '' ? null : <span>预计成交 {closeDate}</span>}
      </p>
    </article>
  );
};

const LeadCard = ({
  lead,
  highlighted,
  now,
}: Readonly<{ lead: CrmRecord; highlighted: boolean; now: number }>) => {
  const source = textOf(lead.source);
  const updated = relativeTimeOf(lead.updatedAt, now);
  return (
    <article
      class="crm-related-card"
      id={leadAnchor(textOf(lead.id))}
      data-highlighted={highlighted}
      data-testid="kt-customer-lead"
    >
      <p class="crm-related-name">{textOf(lead.title, '—')}</p>
      <p class="crm-related-meta">
        <StatusBadge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusBadge>
        {source === '' ? null : <span>来源 {source}</span>}
        {updated === '' ? null : <span>最近更新 {updated}</span>}
      </p>
    </article>
  );
};

const RelatedSection = ({
  title,
  count,
  testId,
  empty,
  children,
}: Readonly<{
  title: string;
  count: number;
  testId: string;
  empty: string;
  children: ComponentChildren;
}>) => (
  <SectionCard title={title} count={count} testId={testId}>
    {count === 0 ? <p class="crm-empty">{empty}</p> : <div class="crm-related">{children}</div>}
  </SectionCard>
);

/** 信用概要：额度/敞口/使用率进度条 + 最近一次信用决定；无记录时给出空态。 */
const CreditSection = ({ credit }: Readonly<{ credit: CustomerCreditSummary | null }>) => {
  if (credit === null || isCreditSummaryEmpty(credit))
    return (
      <SectionCard title="信用概要" testId="kt-customer-credit">
        <p class="crm-empty">暂无信用记录</p>
      </SectionCard>
    );
  const usage = creditUsageOf(credit);
  const percent = usage.ratio === null ? null : Math.round(usage.ratio * 100);
  const bar =
    percent === null ? (usage.level === 'danger' ? 100 : 0) : Math.min(100, Math.max(0, percent));
  return (
    <SectionCard title="信用概要" testId="kt-customer-credit">
      <div class="crm-credit-rows">
        <p class="crm-credit-row">
          <span>信用额度</span>
          <strong data-testid="kt-customer-credit-limit">{moneyOf(credit.limit)}</strong>
        </p>
        <p class="crm-credit-row">
          <span>已用敞口</span>
          <strong data-testid="kt-customer-credit-exposure">{moneyOf(credit.exposure)}</strong>
        </p>
      </div>
      <div
        class="crm-meter"
        role="progressbar"
        aria-label="额度使用率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar}
        data-level={usage.level}
      >
        <span class="crm-meter-fill" style={{ width: `${String(bar)}%` }} />
      </div>
      <p class="crm-credit-foot">
        <span data-testid="kt-customer-credit-usage">
          额度使用率 {percent === null ? '—' : `${String(percent)}%`}
        </span>
        {credit.decision === null ? null : (
          <span>
            最近决定{' '}
            <StatusBadge tone={creditDecisionTone(credit.decision.status)}>
              {creditDecisionLabel(credit.decision.status)}
            </StatusBadge>{' '}
            <time>{dateTimeLabelOf(credit.decision.decidedAt)}</time>
          </span>
        )}
      </p>
    </SectionCard>
  );
};

/** 客户 360 内容根：事实条 → 联系人 → 活动时间线 → 商机漏斗 → 关联商机/线索 → 信用概要。 */
export const Customer360Detail = (state: Customer360State) => {
  const { view } = state;
  const contacts = rowsOf(view.contacts);
  const activities = rowsOf(view.activities);
  const opportunities = rowsOf(view.opportunities);
  const leads = rowsOf(view.leads);
  // 信用数据来源：360 响应内嵌的 credit 分区优先，否则取宿主端口加载结果。
  const credit =
    view.credit === undefined || view.credit === null
      ? state.credit
      : (creditSummaryOf(view.credit) ?? null);
  useHighlight(state);
  const facts: readonly (readonly [string, number])[] = [
    ['联系人', contacts.length],
    ...(state.canReadLeads ? [['线索', leads.length] as const] : []),
    ['商机', opportunities.length],
    ['活动', activities.length],
  ];
  return (
    <div class="crm-360" data-testid="kt-customer-360">
      <ul class="crm-facts" data-testid="kt-customer-facts">
        {facts.map(([label, count]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{String(count)}</strong>
          </li>
        ))}
      </ul>
      <ContactsSection state={state} contacts={contacts} />
      <TimelineSection state={state} activities={activities} context={{ leads, opportunities }} />
      {/* 漏斗与关联线索为新增分区：无对应读权限时服务端恒返回空，呈现「暂无」会误导，故不渲染。 */}
      {state.canReadOpportunities ? <FunnelSection opportunities={opportunities} /> : null}
      <RelatedSection
        title="关联商机"
        count={opportunities.length}
        testId="kt-customer-opportunities"
        empty="暂无商机关联"
      >
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={textOf(opportunity.id)}
            opportunity={opportunity}
            highlighted={state.highlight === opportunityAnchor(textOf(opportunity.id))}
          />
        ))}
      </RelatedSection>
      {state.canReadLeads ? (
        <RelatedSection
          title="关联线索"
          count={leads.length}
          testId="kt-customer-leads"
          empty="暂无关联线索"
        >
          {leads.map((lead) => (
            <LeadCard
              key={textOf(lead.id)}
              lead={lead}
              now={state.now}
              highlighted={state.highlight === leadAnchor(textOf(lead.id))}
            />
          ))}
        </RelatedSection>
      ) : null}
      {credit === undefined ? null : <CreditSection credit={credit} />}
    </div>
  );
};
