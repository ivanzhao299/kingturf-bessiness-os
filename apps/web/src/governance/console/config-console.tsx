import { signal } from '@preact/signals';
import {
  ActionBar,
  DataTable,
  DetailDrawer,
  EmptyState,
  FormSection,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import { recordOf, textOf, type ConsolePorts } from './ports';

// UI-M2b：六配置页（master-data/numbering/rules/workflow/notifications/system）通用
// 控制台——配置页解剖=结构化表单（FormSection 弹层）+ 版本侧栏（选中行只读摘要）。
// 动作端点/权限/敏感词语义自 *-actions.ts 守恒迁移（resolve 描述符）。
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
  </ActionBar>
);

export function ConfigConsolePage(spec: ConfigPageSpec) {
  return (ports: ConsolePorts): preact.ComponentType => {
    const activeAction = signal<ConfigActionSpec | null>(null);
    const actionError = signal('');
    const refreshQueue = signal(0);
    const selectedId = signal<string | null>(null);

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

    const runAction = (
      action: ConfigActionSpec,
      values: Readonly<Record<string, string>>,
    ): Promise<void> => {
      let submit: ConfigActionSubmit;
      try {
        submit = action.resolve(values, ctx);
      } catch (error) {
        actionError.value = error instanceof Error ? error.message : '输入无法解析';
        return Promise.resolve();
      }
      return ports
        .submit(submit.path, submit.payload, submit.method)
        .then(() => {
          activeAction.value = null;
          actionError.value = '';
          return refresh();
        })
        .catch((error: unknown) => {
          actionError.value = error instanceof Error ? error.message : '操作失败';
        });
    };

    const View = () => {
      void refreshQueue.value;
      const rows = rowsOf(spec.entity.path);
      const selected = rows.find((row) => spec.entity.rowId(row) === selectedId.value) ?? null;
      const action = activeAction.value;
      const allowed = spec.actions.filter((item) => ports.permissions.has(item.permission));
      return (
        <div class="console-page" data-testid={spec.pageTestId}>
          {allowed.length > 0 ? (
            <ConfigActionBar
              allowed={allowed}
              onOpen={(item) => {
                activeAction.value = item;
                actionError.value = '';
              }}
            />
          ) : null}
          <DataTable
            columns={[
              ...spec.entity.columns,
              openColumn((row) => {
                selectedId.value = spec.entity.rowId(row);
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
              onClose={() => {
                selectedId.value = null;
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
            </DetailDrawer>
          ) : null}
          {action ? (
            <div data-testid={`kt-cfg-form-${action.id}`}>
              <FormSection
                title={action.title}
                description={action.description}
                fields={action.fields(ctx)}
                submitLabel={action.submitLabel}
                onSubmit={(values) => runAction(action, values)}
              />
              {actionError.value !== '' ? (
                <p class="console-error" role="alert" data-testid="kt-cfg-form-error">
                  {actionError.value}
                </p>
              ) : null}
            </div>
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
          {spec.appendix
            ? (() => {
                const Appendix = spec.appendix(ports);
                return <Appendix />;
              })()
            : null}
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
