// CRM-UX：线索卡片单元格（来源图标/标题入口/负责人头像/最近更新）。
// 线索列表仍走 DataTable（排序/分页/空错载三态与既有 data-testid 守恒），仅富化单元格。
import type { LeadRow } from './lead-ports';
import { Avatar, SourceGlyphTile } from '../../crm/crm-ux-parts';
import {
  dateTimeLabelOf,
  isPoolLead,
  isStale,
  leadSourceIconOf,
  relativeTimeOf,
  textOf,
} from '../../crm/crm-ux';

export type LeadCardContext = Readonly<{
  employeeChoices: readonly Readonly<{ value: string; label: string }>[];
  /** 相对时间基准（宿主注入；缺省系统时钟）。 */
  now: number;
  open: (row: LeadRow) => void;
}>;

/** 命中员工目录的负责人姓名；未命中或无负责人返回空串（头像据此决定是否取首字）。 */
export const leadOwnerName = (
  row: LeadRow,
  employeeChoices: LeadCardContext['employeeChoices'],
): string => {
  const ownerId = textOf(row.ownerId);
  return employeeChoices.find((choice) => choice.value === ownerId)?.label ?? '';
};

/** 负责人展示文本：姓名 → 编号前 8 位（与原负责人列口径一致）→ 空（无负责人）。 */
export const leadOwnerText = (
  row: LeadRow,
  employeeChoices: LeadCardContext['employeeChoices'],
): string => {
  const name = leadOwnerName(row, employeeChoices);
  return name === '' ? textOf(row.ownerId).slice(0, 8) : name;
};

/** 无负责人文案：公海线索「待认领」，其余（如 NEW）「未分配」。 */
export const leadUnassignedLabel = (row: LeadRow): string =>
  isPoolLead(row) ? '待认领' : '未分配';

/** 标题单元格：来源图标 + 标题（点击打开详情）+ 来源/关联客户副行。 */
export const LeadTitleCell = ({
  row,
  context,
}: Readonly<{ row: LeadRow; context: LeadCardContext }>) => {
  const title = textOf(row.title, '线索');
  const source = textOf(row.source);
  const linked = textOf(row.customerId) === '' ? '' : ' · 已关联客户';
  return (
    <div class="crm-entity" data-testid="kt-lead-source" data-icon={leadSourceIconOf(source)}>
      <SourceGlyphTile kind={leadSourceIconOf(source)} label={source} />
      <div class="crm-entity-body">
        <button
          type="button"
          class="crm-entity-title"
          data-testid="kt-lead-open-title"
          onClick={() => {
            context.open(row);
          }}
        >
          {title}
        </button>
        <span class="crm-entity-meta">
          {source === '' ? '来源未填写' : source}
          {linked}
        </span>
      </div>
    </div>
  );
};

/** 负责人单元格：字头像 + 姓名；未命中员工目录用轮廓头像 + 编号，无负责人用虚线头像 + 文案。 */
export const LeadOwnerCell = ({
  row,
  context,
}: Readonly<{ row: LeadRow; context: LeadCardContext }>) => {
  const name = leadOwnerName(row, context.employeeChoices);
  const text = leadOwnerText(row, context.employeeChoices);
  return (
    <span class="crm-owner" data-testid="kt-lead-owner" data-tone={text === '' ? 'empty' : 'named'}>
      <Avatar name={name} />
      <span>{text === '' ? leadUnassignedLabel(row) : text}</span>
    </span>
  );
};

/** 最近更新单元格：相对时间 + 悬停绝对时间；超过 7 天未更新以警示色提示（不改任何业务状态）。 */
export const LeadUpdatedCell = ({
  row,
  context,
}: Readonly<{ row: LeadRow; context: LeadCardContext }>) => {
  const updated = textOf(row.updatedAt);
  const relative = relativeTimeOf(updated, context.now);
  const absolute = dateTimeLabelOf(updated);
  return (
    <time
      class="crm-recency"
      data-testid="kt-lead-updated"
      {...(updated === '' ? {} : { datetime: updated })}
      data-stale={isStale(updated, context.now)}
      {...(absolute === '' ? {} : { title: `${absolute} 更新` })}
    >
      {relative === '' ? '—' : relative}
    </time>
  );
};
