import { signal } from '@preact/signals';
import {
  ActionBar,
  ConfirmDialog,
  DataTable,
  DetailDrawer,
  EmptyState,
  FormSection,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import { failureMessage } from '../../shared/api-error-message';
import { ConsoleNotice } from '../../shared/console-notice';
import { FocusAnchor } from '../../shared/focus-anchor';
import { recordOf, textOf, type ConsolePorts } from './ports';
import { VersionCompare } from './version-compare';
import { createVersionCompare } from './version-compare-state';
import type { VersionSpec } from './version-model';

// UI-M2b：六配置页（master-data/numbering/rules/workflow/notifications/system）通用
// 控制台——配置页解剖=结构化表单（FormSection 弹层）+ 版本侧栏（选中行只读摘要）。
// 动作端点/权限/敏感词语义自 *-actions.ts 守恒迁移（resolve 描述符）。
// GOV-UX ④：版本侧栏内增加「版本对比」（上一版本 vs 当前版本并排差异高亮）；
// 页面 spec 声明 versions 来源，未声明的页面（通知/业务对象）不出现该区。
type Row = Readonly<Record<string, unknown>>;

export type ConfigActionSubmit = Readonly<{
  path: string;
  payload: Record<string, unknown>;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}>;

export type ConfigActionCtx = Readonly<{
  rowsOf: (path: string) => readonly Row[];
  hintFor: (path: string) => string | undefined;
  jsonField: (value: string | undefined, label: string) => Record<string, unknown>;
  versionOf: (path: string, id: string) => number | undefined;
}>;

export type ConfigActionSpec = Readonly<{
  id: string;
  label: string;
  permission: string;
  title: string;
  description: string;
  submitLabel: string;
  confirmation?: true | 'destructive';
  fields: (ctx: ConfigActionCtx) => readonly FormSectionField[];
  resolve: (values: Readonly<Record<string, string>>, ctx: ConfigActionCtx) => ConfigActionSubmit;
}>;

export type ConfigEntitySpec = Readonly<{
  path: string;
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rowId: (row: Row) => string;
  summaryKeys: readonly string[];
}>;

export type ConfigPageSpec = Readonly<{
  route: string;
  pageTestId: string;
  title: string;
  entity: ConfigEntitySpec;
  extraEntities?: readonly ConfigEntitySpec[];
  actions: readonly ConfigActionSpec[];
  appendix?: (ports: ConsolePorts) => preact.ComponentType;
  /** 版本对比来源（缺省=该页不提供版本对比）。 */
  versions?: VersionSpec;
}>;

const jsonParseField = (value: string | undefined, label: string): Record<string, unknown> => {
  if (value === undefined || value.trim() === '') throw new Error(`${label}必须填写结构化 JSON`);
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error(`${label}不是合法 JSON`);
  }
};

// G2 压平：动作按钮渲染抽为模块级组件。
const ConfigActionBar = (
  props: Readonly<{
    allowed: readonly ConfigActionSpec[];
    active: string;
    onOpen: (item: ConfigActionSpec) => void;
  }>,
): preact.VNode => (
  <ActionBar label={props.allowed[0]?.label ?? '操作'}>
    {props.allowed.map((item) => (
      <button
        type="button"
        class="secondary"
        data-testid={`kt-cfg-action-${item.id}`}
        onClick={() => {
          props.onOpen(item);
        }}
      >
        {item.label}
      </button>
    ))}
    <FocusAnchor token={props.active} />
  </ActionBar>
);

export function ConfigConsolePage(spec: ConfigPageSpec) {
  return (ports: ConsolePorts): preact.ComponentType => {
    const activeAction = signal<ConfigActionSpec | null>(null);
    const actionError = signal('');
    const readError = signal('');
    const notice = signal('');
    const confirm = signal<{ action: ConfigActionSpec; settle: (answer: boolean) => void } | null>(
      null,
    );
    const refreshQueue = signal(0);
    const selectedId = signal<string | null>(null);
    const compare = createVersionCompare(spec.versions, ports);
    const Appendix = spec.appendix?.(ports);

    const cache = new Map<string, readonly Row[]>();
    const rowsOf = (path: string): readonly Row[] => {
      const cached = cache.get(path);
      if (cached) return cached;
      const rows = ports.initialView(path).items.map(recordOf);
      cache.set(path, rows);
      return rows;
    };
    const hintFor = (path: string): string | undefined =>
      ports.loaded(path) ? undefined : `该数据源未加载（通常缺少对应读取权限），无法提供选择项`;
    const ctx: ConfigActionCtx = {
      rowsOf,
      hintFor,
      jsonField: jsonParseField,
      versionOf: (path, id) => {
        const found = rowsOf(path).find((row) => String(row.id) === id);
        return typeof found?.version === 'number' ? found.version : undefined;
      },
    };

    const refresh = async (): Promise<void> => {
      const paths = [spec.entity.path, ...(spec.extraEntities ?? []).map((item) => item.path)];
      await Promise.all(
        paths.map((path) =>
          ports.fetchPage(path).then((page) => cache.set(path, page.items.map(recordOf))),
        ),
      );
      refreshQueue.value += 1;
    };

    const runAction = async (
      action: ConfigActionSpec,
      values: Readonly<Record<string, string>>,
    ): Promise<void> => {
      actionError.value = '';
      let submit: ConfigActionSubmit;
      try {
        submit = action.resolve(values, ctx);
      } catch (error) {
        actionError.value = failureMessage(error, '输入无法解析');
        return;
      }
      if (action.confirmation) {
        const accepted = await new Promise<boolean>((settle) => {
          confirm.value = { action, settle };
        });
        if (!accepted) return;
      }
      try {
        await ports.submit(submit.path, submit.payload, submit.method);
      } catch (error) {
        actionError.value = failureMessage(error, '配置操作失败');
        return;
      }
      if (activeAction.value === action) activeAction.value = null;
      notice.value = `${action.submitLabel}成功`;
      try {
        await refresh();
        readError.value = '';
      } catch (error) {
        readError.value = failureMessage(error, '已提交，配置列表刷新失败');
      }
    };
    const settleConfirm = (answer: boolean): void => {
      const request = confirm.value;
      confirm.value = null;
      request?.settle(answer);
    };

    const View = () => {
      void refreshQueue.value;
      const rows = rowsOf(spec.entity.path);
      const selected = rows.find((row) => spec.entity.rowId(row) === selectedId.value) ?? null;
      const action = activeAction.value;
      const confirmation = confirm.value;
      const comparison = compare.current();
      const allowed = spec.actions.filter((item) => ports.permissions.has(item.permission));
      return (
        <div class="console-page" data-testid={spec.pageTestId}>
          {selected === null ? <ConsoleNotice message={notice.value} /> : null}
          {readError.value !== '' ? (
            <p class="console-error" role="alert">
              {readError.value}
            </p>
          ) : null}
          {allowed.length > 0 ? (
            <ConfigActionBar
              allowed={allowed}
              active={action?.id ?? ''}
              onOpen={(item) => {
                activeAction.value = item;
                actionError.value = '';
                notice.value = '';
              }}
            />
          ) : null}
          <DataTable
            columns={[
              ...spec.entity.columns,
              openColumn((row) => {
                selectedId.value = spec.entity.rowId(row);
                notice.value = '';
                compare.open(row);
              }),
            ]}
            rows={rows}
            rowId={spec.entity.rowId}
            caption={spec.entity.caption}
            emptyTitle={`暂无${spec.title}`}
            emptyDescription="创建第一条记录后会出现在这里"
          />
          {selected ? (
            <DetailDrawer
              title={`${spec.title} · 当前版本`}
              footer={<ConsoleNotice message={notice.value} />}
              onClose={() => {
                selectedId.value = null;
                compare.clear();
              }}
            >
              <div class="console-summary" data-testid="kt-cfg-version-sidebar">
                {spec.entity.summaryKeys.map((key) => (
                  <p>
                    <span class="console-label">{key}</span> {textOf(selected[key], '—')}
                  </p>
                ))}
                <p>
                  <span class="console-label">版本</span>{' '}
                  {typeof selected.version === 'number' ? `v${String(selected.version)}` : '—'}
                </p>
              </div>
              {comparison ? <VersionCompare view={comparison} /> : null}
            </DetailDrawer>
          ) : null}
          {action ? (
            <div data-testid={`kt-cfg-form-${action.id}`}>
              <FormSection
                title={action.title}
                description={action.description}
                fields={action.fields(ctx)}
                submitLabel={action.submitLabel}
                error={actionError.value}
                onSubmit={(values) => runAction(action, values)}
              />
            </div>
          ) : null}
          {confirmation ? (
            <ConfirmDialog
              title={confirmation.action.title}
              message={confirmation.action.description}
              confirmLabel={confirmation.action.submitLabel}
              destructive={confirmation.action.confirmation === 'destructive'}
              onCancel={() => {
                settleConfirm(false);
              }}
              onConfirm={() => {
                settleConfirm(true);
              }}
            />
          ) : null}
          {(spec.extraEntities ?? []).map((entity) => (
            <DataTable
              columns={entity.columns}
              rows={rowsOf(entity.path)}
              rowId={entity.rowId}
              caption={entity.caption}
              emptyTitle={`暂无${entity.caption}`}
              emptyDescription=""
            />
          ))}
          {Appendix ? <Appendix /> : null}
          {rows.length === 0 && allowed.length === 0 ? (
            <EmptyState title={`暂无${spec.title}`} description="当前账号无管理权限时仅可查看" />
          ) : null}
        </div>
      );
    };
    return View;
  };
}

// 行级「查看」列（版本侧栏入口；六页共用）。
export const openColumn = <T extends Row>(onOpen: (row: T) => void): DataTableColumn<T> => ({
  key: 'actions',
  header: '操作',
  field: () => '查看',
  render: (row) => (
    <button
      type="button"
      class="secondary compact"
      data-testid="kt-cfg-open"
      onClick={() => {
        onOpen(row);
      }}
    >
      查看
    </button>
  ),
});
