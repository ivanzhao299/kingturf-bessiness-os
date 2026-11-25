import { signal } from '@preact/signals';
import { ConfirmDialog, FormSection, StatusBadge, type FormSectionField } from '@kingturf/ui';
import { failureMessage } from '../../shared/api-error-message';
import { ConsoleNotice } from '../../shared/console-notice';
import { FocusAnchor } from '../../shared/focus-anchor';
import { recordOf, type ConsolePorts } from './ports';

// D5（ADR-0013）系统参数区——Preact 迁移版（原 vanilla createTenantSettingsSection
// 语义守恒：目录只读 + 修改草稿 + 单向发布 + 历史只读；顺修原首败 catch 的
// retry 前置引用缺陷：本版错误态与重试按钮同渲染，无 TDZ 路径）。
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

const settingField = (item: SettingItem): FormSectionField =>
  item.valueType === 'integer'
    ? {
        name: 'value',
        label: item.label,
        type: 'number',
        required: true,
        ...(item.minimum !== undefined ? { min: item.minimum } : {}),
        ...(item.maximum !== undefined ? { max: item.maximum } : {}),
      }
    : {
        name: 'value',
        label: item.label,
        type: 'textarea',
        required: true,
        ...(item.maxLength !== undefined
          ? { maxLength: item.maxLength, hint: `最长 ${String(item.maxLength)} 字符` }
          : {}),
      };

export function TenantSettingsAppendix(ports: ConsolePorts): preact.ComponentType {
  const items = signal<readonly SettingItem[]>([]);
  const error = signal('');
  const busy = signal(false);
  const editKey = signal<string | null>(null);
  const pending = signal<SettingItem | null>(null);
  const publishing = signal(false);
  const draftError = signal('');
  const publishError = signal<{ key: string; message: string } | null>(null);
  const notice = signal('');

  const reload = async (): Promise<void> => {
    busy.value = true;
    await ports
      .fetchPage('/api/v1/tenant-settings')
      .then((page) => {
        items.value = page.items.map((item) => recordOf(item) as unknown as SettingItem);
        error.value = '';
      })
      .catch(() => {
        error.value = '参数目录读取失败，请稍后重试';
      })
      .finally(() => {
        busy.value = false;
      });
  };

  const MayManage = ports.permissions.has('tenant-setting:manage');

  const saveDraft = async (item: SettingItem, raw: string): Promise<void> => {
    draftError.value = '';
    try {
      await ports.submit(
        '/api/v1/tenant-settings',
        { key: item.key, value: item.valueType === 'integer' ? Number(raw) : raw },
        'PUT',
      );
    } catch (error) {
      if (editKey.value === item.key) draftError.value = failureMessage(error, '参数草稿保存失败');
      return;
    }
    if (editKey.value === item.key) editKey.value = null;
    notice.value = `已保存「${item.label}」草稿`;
    await reload();
  };

  const publishItem = async (item: SettingItem): Promise<void> => {
    pending.value = null;
    publishing.value = true;
    try {
      await ports.submit('/api/v1/tenant-settings/publish', { key: item.key }, 'POST');
      editKey.value = null;
      notice.value = `已发布「${item.label}」`;
      await reload();
    } catch (error) {
      publishError.value = { key: item.key, message: failureMessage(error, '参数发布失败') };
    } finally {
      publishing.value = false;
    }
  };

  const Appendix = () => (
    <section class="console-split-tree" data-testid="kt-tenant-settings">
      <h3>系统参数</h3>
      <StatusBadge tone="success">配置管理</StatusBadge>
      <ConsoleNotice message={notice.value} />
      {error.value !== '' ? (
        <p class="console-error" role="alert">
          {error.value}
        </p>
      ) : null}
      {items.value.length === 0 && error.value === '' && !busy.value ? (
        <p class="console-hint">正在读取参数目录…</p>
      ) : null}
      {items.value.map((item) => (
        <div class="console-chip" data-testid={`kt-tenant-setting-${item.key}`}>
          <div>
            <strong>{item.label}</strong>
            <small class="console-hint">
              {item.key} · {item.description}
            </small>
            <span class="console-hint">{valueText(item)}</span>
            {item.draftVersion !== null ? (
              <StatusBadge tone="warning">{'待发布草稿 v' + String(item.draftVersion)}</StatusBadge>
            ) : null}
          </div>
          {MayManage ? (
            <div>
              <button
                type="button"
                class="secondary compact"
                data-testid="kt-tenant-setting-edit"
                onClick={() => {
                  editKey.value = item.key;
                  draftError.value = '';
                  publishError.value = null;
                  notice.value = '';
                }}
              >
                修改参数
              </button>
              <button
                type="button"
                class="secondary compact"
                data-testid="kt-tenant-setting-publish"
                disabled={publishing.value}
                onClick={() => {
                  publishError.value = null;
                  notice.value = '';
                  pending.value = item;
                }}
              >
                发布该参数
              </button>
              <FocusAnchor token={String(editKey.value === item.key)} />
              {publishError.value?.key === item.key ? (
                <p class="console-error" role="alert">
                  {publishError.value.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {editKey.value === item.key ? (
            <FormSection
              title={`修改参数：${item.label}`}
              description="保存仅创建新草稿；发布后立即生效且不可撤回，纠错需发布新版本。"
              fields={[settingField(item)]}
              submitLabel="保存草稿"
              error={draftError.value}
              onSubmit={(values) => saveDraft(item, values.value ?? '')}
            />
          ) : null}
          <details>
            <summary>版本历史（{String(item.history.length)}）</summary>
            <pre>
              {item.history
                .map(
                  (entry) =>
                    `v${String(entry.version)} · ${entry.status === 'PUBLISHED' ? `发布于 ${entry.publishedAt ?? '—'}` : '草稿'} · 值 ${String(entry.value)}`,
                )
                .join('\n') || '暂无版本'}
            </pre>
          </details>
        </div>
      ))}
      {pending.value ? (
        <PublishConfirm
          item={pending.value}
          onConfirm={publishItem}
          onCancel={() => {
            pending.value = null;
          }}
        />
      ) : null}
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-tenant-setting-reload"
        onClick={() => {
          void reload();
        }}
      >
        重新读取
      </button>
    </section>
  );
  void reload();
  return Appendix;
}

const PublishConfirm = ({
  item,
  onConfirm,
  onCancel,
}: Readonly<{
  item: SettingItem;
  onConfirm: (item: SettingItem) => Promise<void>;
  onCancel: () => void;
}>) => (
  <ConfirmDialog
    title={`发布参数 · ${item.label}`}
    message="发布后立即生效，无法撤回。需要纠正时请发布新版本。"
    confirmLabel="确认发布"
    destructive
    onCancel={onCancel}
    onConfirm={() => {
      void onConfirm(item);
    }}
  />
);
