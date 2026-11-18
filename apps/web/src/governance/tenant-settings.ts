// D5（ADR-0013 / TD-ARCH-003）：governance/system 子页「系统参数」区。
// 键目录由服务端 GET /tenant-settings 提供（代码注册白名单单一来源）；
// 修改=PUT 写 DRAFT（幂等键随 controller.submit 注入），发布=POST publish（单向）。
import { el } from '../dom';
import type { FormField } from '../shared/forms';
import type { GovernanceActionContext } from './workspace-types';

type SettingItem = Readonly<{
  key: string;
  label: string;
  description: string;
  valueType: 'integer' | 'string';
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  default: number | string;
  value: number | string;
  publishedVersion: number | null;
  draftVersion: number | null;
  history: readonly Readonly<{
    version: number;
    value: number | string;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt: string | null;
  }>[];
}>;

const valueText = (item: SettingItem): string => {
  const raw = item.value === '' ? '（默认，未设置）' : String(item.value);
  return item.publishedVersion === null
    ? `${raw} · 使用代码默认`
    : `${raw} · 已发布 v${String(item.publishedVersion)}`;
};

const settingField = (item: SettingItem): FormField =>
  item.valueType === 'integer'
    ? {
        name: 'value',
        label: item.label,
        type: 'number',
        required: true,
        value: String(item.value),
        ...(item.minimum !== undefined ? { min: item.minimum } : {}),
        ...(item.maximum !== undefined ? { max: item.maximum } : {}),
      }
    : {
        name: 'value',
        label: item.label,
        type: 'textarea',
        required: true,
        value: String(item.value),
        ...(item.maxLength !== undefined
          ? { maxLength: item.maxLength, hint: `最长 ${String(item.maxLength)} 字符` }
          : {}),
      };

type SectionContext = Pick<GovernanceActionContext, 'controller' | 'permissions' | 'openAction'>;

function createEditButton(context: SectionContext, item: SettingItem): HTMLElement {
  const edit = el('button', 'secondary compact', '修改参数');
  edit.addEventListener('click', () => {
    context.openAction(
      `修改参数：${item.label}`,
      '保存仅创建新草稿；发布后立即生效且不可撤回，纠错需发布新版本。',
      [settingField(item)],
      async (values) => {
        const raw = values.value ?? '';
        await context.controller.submit(
          '/api/v1/tenant-settings',
          { key: item.key, value: item.valueType === 'integer' ? Number(raw) : raw },
          'PUT',
        );
      },
      '保存草稿',
    );
  });
  return edit;
}

function createPublishButton(context: SectionContext, item: SettingItem): HTMLElement {
  const publish = el('button', 'secondary compact', '发布该参数');
  publish.addEventListener('click', () => {
    context.openAction(
      `发布参数：${item.label}`,
      '发布为单向动作：版本冻结、立即生效并写入审计；发布后不可修改或删除。',
      [],
      async () => {
        await context.controller.submit(
          '/api/v1/tenant-settings/publish',
          { key: item.key },
          'POST',
        );
      },
      '发布参数',
    );
  });
  return publish;
}

export function createTenantSettingsSection(context: SectionContext): HTMLElement {
  const { controller, permissions } = context;
  const mayManage = permissions.has('tenant-setting:manage');
  const section = el('article', 'governance-card governance-domain-card');
  const heading = el('header', 'panel-head');
  heading.append(el('div', '', '系统参数'), el('span', 'status-badge success', '配置管理'));
  section.append(heading, el('p', 'governance-card-summary', '正在读取参数目录…'));
  const render = async () => {
    let items: readonly SettingItem[];
    try {
      const page = await controller.fetchPage<{ items: readonly SettingItem[] }>(
        '/api/v1/tenant-settings',
      );
      items = page.items;
    } catch {
      section.replaceChildren(heading, el('p', 'risk-note', '参数目录读取失败，请稍后重试'), retry);
      return;
    }
    section.replaceChildren(heading);
    for (const item of items) {
      const row = el('div', 'tenant-setting-row');
      const meta = el('div', 'tenant-setting-meta');
      meta.append(
        el('strong', '', item.label),
        el('small', 'muted', `${item.key} · ${item.description}`),
        el('span', 'tenant-setting-value', valueText(item)),
      );
      if (item.draftVersion !== null)
        meta.append(el('span', 'status-badge warning', `待发布草稿 v${String(item.draftVersion)}`));
      const actions = el('div', 'governance-actions');
      if (mayManage)
        actions.append(createEditButton(context, item), createPublishButton(context, item));
      row.append(meta, actions);
      const history = el('details', 'governance-source');
      const list = item.history
        .map(
          (entry) =>
            `v${String(entry.version)} · ${entry.status === 'PUBLISHED' ? `发布于 ${entry.publishedAt ?? '—'}` : '草稿'} · 值 ${String(entry.value)}`,
        )
        .join('\n');
      history.append(el('summary', '', `版本历史（${String(item.history.length)}）`));
      history.append(el('pre', 'tenant-setting-history', list || '暂无版本'));
      row.append(history);
      section.append(row);
    }
  };
  const retry = el('button', 'secondary compact', '重新读取');
  retry.addEventListener('click', () => {
    void render();
  });
  void render();
  return section;
}
