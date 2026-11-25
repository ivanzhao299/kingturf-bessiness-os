import { signal } from '@preact/signals';
import { DetailDrawer, PageHeader, SummaryCards, type DataTableColumn } from '@kingturf/ui';
import { render } from 'preact';
import { registerRelatedRecord } from '../related-record';
import type { OperationsViewContext } from '../operations-view-ports';
import { ITEM_VERSIONS_PATH, itemVersionChoicesOf, perView } from './console-choices';
import { ConsoleConfirmDialog } from './console-confirm';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import { finReadPage, finDetailUrl } from './fin-host-kit';
import { finRecord, finRows, finText, finWhen, type FinRow } from './fin-kit';
import { createOpsWriter, OpsInlineForm, type OpsForm } from './ops-form';
import { createOpsList, OpsLedger, opsColumn } from './ops-ledger';
import { reloadSelectedDetail, syncSelected } from './selected-sync';
import {
  complaintBatch,
  complaintCreate,
  complaintNcr,
  complaintSla,
  complaintTransition,
} from './complaint-forms';
import { complaintClosure } from './complaint-closure';
import {
  ComplaintDetail,
  LotDetail,
  QualityInspectionDetail,
  QualityPlanDetail,
  slaRemaining,
  type QualityView,
} from './quality-detail';
import {
  inspectionForms,
  newQualityInspection,
  newQualityPlan,
  publishQualityPlan,
  qualityPaths,
} from './quality-forms';

const tables = {
  plans: { title: '检验计划', capability: 'quality-plan:read', number: ['code'] },
  inspections: {
    title: '检验单',
    capability: 'quality:read',
    number: ['inspectionNumber', 'inspection_number'],
  },
  complaints: {
    title: '客户投诉与整改闭环',
    capability: 'complaint:read',
    number: ['complaintNumber', 'complaint_number'],
  },
  lots: { title: '批次追溯', capability: 'traceability:read', number: ['lotNumber', 'lot_number'] },
} as const;
const details = {
  plans: QualityPlanDetail,
  inspections: QualityInspectionDetail,
  complaints: ComplaintDetail,
  lots: LotDetail,
};
const idOf = (row: FinRow) => finText(row, 'id', 'lotId');
const viewKeys: readonly QualityView[] = ['plans', 'inspections', 'complaints', 'lots'];

function createQualityModel(context: OperationsViewContext) {
  const { controller, permissions, ports } = context;
  const read = controller.api.get;
  const visible = viewKeys.filter((view) => permissions.has(tables[view].capability));
  const active = signal<QualityView>(
    visible.includes('inspections') ? 'inspections' : (visible[0] ?? 'plans'),
  );
  const selected = signal<FinRow | null>(null);
  const detailLoading = signal(false);
  const picked = signal<ReadonlyMap<string, FinRow>>(new Map());
  const canBatch = () =>
    permissions.has('complaint:triage') &&
    permissions.has('complaint:assign') &&
    controller.employees.length > 0;
  const model = (view: QualityView) =>
    createOpsList(
      (query) => finReadPage(read, qualityPaths[view], query),
      view === 'inspections' || view === 'lots' ? { summary: 'true' } : {},
    );
  const lists = {
    plans: model('plans'),
    inspections: model('inspections'),
    complaints: model('complaints'),
    lots: model('lots'),
  };
  const itemChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, ports.recordText),
  );
  const planChoices = perView(controller.views, qualityPaths.plans, (rows) =>
    rows
      .filter((row) => row.status === 'PUBLISHED')
      .map((row) => ({
        value: idOf(row),
        label: `${finText(row, 'code')} · ${finText(row, 'name')}`,
      })),
  );
  const lotChoices = perView(controller.views, qualityPaths.lots, (rows) =>
    rows.map((row) => ({
      value: idOf(row),
      label: `${finText(row, 'lotNumber', 'lot_number')} · ${finText(row, 'sku')}`,
    })),
  );
  const selection = () => ({
    selected,
    rows: lists[active.peek()].rows.peek(),
    idOf,
    loadDetail: async (id: string) =>
      read ? await read(finDetailUrl(qualityPaths[active.peek()], id)) : null,
  });
  const reload = async () => {
    await Promise.all(visible.map((view) => lists[view].reload()));
  };
  const writer = createOpsWriter(
    (path, body) => controller.submit(path, body),
    async () => {
      picked.value = new Map();
      const [, refresh] = await Promise.allSettled([
        reload(),
        controller.refreshViews(
          [qualityPaths.plans, qualityPaths.lots, qualityPaths.sla].filter((path) =>
            controller.views.has(path),
          ),
        ),
      ]);
      const current = selection();
      if (current.rows.some((row) => idOf(row) === idOf(selected.peek() ?? {})))
        syncSelected(current);
      await reloadSelectedDetail(current);
      if (refresh.status === 'rejected') throw refresh.reason;
    },
  );
  const close = () => {
    if (writer.busy.peek()) return;
    selected.value = null;
    detailLoading.value = false;
    writer.close();
  };
  const open = async (row: FinRow) => {
    writer.close();
    writer.notice.value = '';
    selected.value = row;
    detailLoading.value = true;
    await reloadSelectedDetail(selection());
    if (idOf(selected.peek() ?? {}) === idOf(row)) detailLoading.value = false;
  };
  return {
    active,
    visible,
    lists,
    itemChoices,
    planChoices,
    lotChoices,
    writer,
    selected,
    detailLoading,
    picked,
    canBatch,
    reload,
    open,
    close,
  };
}

type Model = ReturnType<typeof createQualityModel>;

function rowForms(
  context: OperationsViewContext,
  view: QualityView,
  row: FinRow,
): readonly OpsForm[] {
  const { controller, permissions } = context;
  const id = idOf(row);
  if (!id || view === 'lots') return [];
  if (view === 'plans')
    return row.status === 'DRAFT' && permissions.has('quality-plan:manage')
      ? [publishQualityPlan(id)]
      : [];
  if (view === 'inspections') {
    const planId = finText(row, 'inspectionPlanVersionId', 'inspection_plan_version_id');
    const plan = controller.views.get(qualityPaths.plans)?.find((item) => item.id === planId);
    const characteristics = finRows(plan?.characteristics).map((item) => ({
      value: idOf(item),
      label: `${finText(item, 'code')} · ${finText(item, 'name')}`,
    }));
    return inspectionForms(row, permissions, characteristics);
  }
  const state = finText(row, 'state');
  if (state === 'TRIAGED' && permissions.has('complaint:triage'))
    return [
      complaintTransition(
        context,
        row,
        id,
        'investigate',
        '开始调查',
        '确认责任人已接单，并填写启动调查的依据。',
      ),
    ];
  if (state === 'INVESTIGATING' && permissions.has('ncr:manage') && controller.employees.length)
    return [complaintNcr(context, row, id)];
  const closure = ['NCR_OPEN', 'CAPA_ACTIVE', 'VERIFIED'].includes(state)
    ? complaintClosure(context, row, row)
    : null;
  return closure ? [closure] : [];
}

function stateLabels(
  context: OperationsViewContext,
  view: QualityView,
): Readonly<Record<string, string>> {
  if (view === 'complaints') return context.ports.COMPLAINT_STATE_LABELS;
  if (view === 'plans') return { DRAFT: '草稿', PUBLISHED: '已发布' };
  if (view === 'lots') return { QUARANTINE: '待检隔离', RELEASED: '已放行', REJECTED: '已拒收' };
  return {
    OPEN: '待抽样',
    SAMPLED: '检验进行中',
    COMPLETED: '待质量处置',
    DISPOSITIONED: '已处置',
    CANCELLED: '已取消',
  };
}

const statusFields = {
  plans: ['status'],
  inspections: ['state'],
  complaints: ['state'],
  lots: ['qualityStatus', 'quality_status'],
} as const;
const supportColumns: Readonly<Record<QualityView, readonly DataTableColumn<FinRow>[]>> = {
  plans: [opsColumn('名称', 'name'), opsColumn('物料', 'sku'), opsColumn('版本', 'version')],
  inspections: [
    opsColumn('检验计划', 'planCode', 'plan_code'),
    opsColumn('批次', 'lotNumber', 'lot_number'),
  ],
  complaints: [opsColumn('客户', 'customerName', 'customer_name')],
  lots: [opsColumn('物料', 'sku'), opsColumn('名称', 'itemName', 'item_name')],
};

function qualityColumns(
  context: OperationsViewContext,
  state: Model,
  view: QualityView,
): DataTableColumn<FinRow>[] {
  const { ports, controller } = context;
  const prefix = `kt-qi-${view}`;
  const label = stateLabels(context, view);
  const status = (row: FinRow) => finText(row, ...statusFields[view]);
  const columns: DataTableColumn<FinRow>[] = [
    {
      ...opsColumn('编号', ...tables[view].number),
      render: (row) => (
        <strong data-testid={`${prefix}-number`}>
          {finText(row, ...tables[view].number) || '—'}
        </strong>
      ),
    },
    ...supportColumns[view],
    ...(view === 'plans'
      ? [
          {
            key: 'stage',
            header: '检验阶段',
            sortable: true,
            field: (row: FinRow) => finText(row, 'inspectionStage', 'inspection_stage'),
            render: (row: FinRow) =>
              ports.qualityStageLabel(finText(row, 'inspectionStage', 'inspection_stage')),
          },
        ]
      : []),
    {
      key: 'status',
      header: '状态',
      sortable: true,
      field: status,
      render: (row) => (
        <span class={`console-chip state-${status(row).toLowerCase()}`}>
          {label[status(row)] ?? ports.businessStateLabel(status(row))}
        </span>
      ),
    },
  ];
  if (view === 'complaints') {
    columns.push(
      {
        key: 'severity',
        header: '等级',
        sortable: true,
        field: (row) => finText(row, 'severity'),
        render: (row) => ports.COMPLAINT_SEVERITY_LABELS[finText(row, 'severity')] ?? '未分级',
      },
      {
        key: 'assignedTo',
        header: '负责人',
        render: (row) =>
          controller.employees.find(
            (employee) => employee.id === finText(row, 'assignedTo', 'assigned_to'),
          )?.displayName ?? '待分派',
      },
      {
        key: 'closure',
        header: '关闭时限',
        sortable: true,
        field: (row) => finText(row, 'closureDueAt', 'closure_due_at'),
        render: (row) => (
          <>
            <span>{finWhen(row, 'closureDueAt', 'closure_due_at')}</span>
            <br />
            <span>{slaRemaining(row)}</span>
          </>
        ),
      },
    );
    if (state.canBatch())
      columns.unshift({
        key: 'pick',
        header: '选择',
        render: (row) => <ComplaintSelection row={row} model={state} />,
      });
  }
  return [
    ...columns,
    {
      key: 'action',
      header: '操作',
      render: (row) =>
        idOf(row) ? (
          <button
            type="button"
            class="secondary compact"
            data-testid={`${prefix}-open`}
            onClick={() => {
              void state.open(row);
            }}
          >
            查看
          </button>
        ) : (
          '—'
        ),
    },
  ];
}

function ComplaintSelection({ row, model }: Readonly<{ row: FinRow; model: Model }>) {
  const id = idOf(row);
  if (!id || row.state !== 'REPORTED') return '—';
  return (
    <input
      type="checkbox"
      aria-label={`选择投诉 ${finText(row, 'complaintNumber', 'complaint_number')}`}
      checked={model.picked.value.has(id)}
      onChange={(event) => {
        const updated = new Map(model.picked.peek());
        if (event.currentTarget.checked) updated.set(id, row);
        else updated.delete(id);
        model.picked.value = updated;
      }}
    />
  );
}

function topForms(
  context: OperationsViewContext,
  model: Model,
  view: QualityView,
): readonly { label: string; form: () => OpsForm; disabled?: boolean }[] {
  const { controller, permissions } = context;
  if (view === 'plans' && permissions.has('quality-plan:manage'))
    return [{ label: '＋ 创建检验计划', form: () => newQualityPlan(model.itemChoices()) }];
  if (view === 'inspections' && permissions.has('quality:inspect'))
    return [
      {
        label: '＋ 开立检验',
        form: () => newQualityInspection(model.planChoices(), model.lotChoices()),
      },
    ];
  if (view !== 'complaints') return [];
  const forms = [];
  const policies = () => controller.views.get(qualityPaths.sla) ?? [];
  if (permissions.has('complaint:create') && policies().length && controller.customers.length)
    forms.push({ label: '＋ 登记投诉', form: () => complaintCreate(context, policies()) });
  if (permissions.has('complaint-sla:manage'))
    forms.push({ label: '发布处理时限', form: complaintSla });
  if (model.canBatch())
    forms.push({
      label: model.picked.value.size
        ? `批量分派（${String(model.picked.value.size)}）`
        : '批量分派',
      form: () => complaintBatch(context, model.picked.peek()),
      disabled: model.picked.value.size === 0,
    });
  return forms;
}

function QualityOverview({ model }: Readonly<{ model: Model }>) {
  const inspections = finRecord(model.lists.inspections.summary.value);
  const lots = finRecord(model.lists.lots.summary.value);
  return (
    <SummaryCards
      label="质量状态汇总"
      testId="kt-qi-summary"
      items={[
        {
          id: 'waiting',
          label: '待抽样',
          value: finText(inspections, 'open') || '—',
          hint: 'OPEN 检验单 · 单',
        },
        {
          id: 'sampled',
          label: '检验进行中',
          value: finText(inspections, 'sampled') || '—',
          hint: 'SAMPLED 检验单 · 单',
        },
        {
          id: 'disposition',
          label: '待质量处置',
          value: finText(inspections, 'completed') || '—',
          hint: 'COMPLETED 检验单 · 单',
        },
        {
          id: 'quarantine',
          label: '隔离批次',
          value: finText(lots, 'quarantine') || '—',
          hint: 'QUARANTINE 批次 · 批',
        },
      ]}
    />
  );
}

function QualityDrawer({
  context,
  model,
  view,
}: Readonly<{ context: OperationsViewContext; model: Model; view: QualityView }>) {
  const { writer } = model;
  const row = model.selected.value;
  const form = writer.form.value;
  if (!row && !form) return null;
  const title = row
    ? finText(row, ...tables[view].number) || tables[view].title
    : (form?.title ?? '');
  const Detail = details[view];
  const labels = stateLabels(context, view);
  const label = (value: string) => labels[value] ?? context.ports.businessStateLabel(value);
  return (
    <DetailDrawer
      title={title}
      onClose={model.close}
      footer={<ConsoleNotice message={writer.notice.value} />}
    >
      {row ? <Detail row={row} label={label} /> : null}
      {row && !form && !model.detailLoading.value ? (
        <div class="console-row-actions">
          {rowForms(context, view, row).map((action) => (
            <button
              key={action.title}
              type="button"
              class="secondary compact"
              onClick={() => {
                writer.open(action);
              }}
            >
              {action.title === '发布检验计划' ? '发布计划' : action.title}
            </button>
          ))}
        </div>
      ) : null}
      {model.detailLoading.value ? <p role="status">正在加载详情…</p> : null}
      <OpsInlineForm model={writer} />
      <FocusAnchor token={`${form?.title ?? ''}|${finText(row ?? {}, 'state', 'status')}`} />
    </DetailDrawer>
  );
}

export function mountQualityConsole(host: HTMLElement, context: OperationsViewContext) {
  const model = createQualityModel(context);
  const Page = () => {
    const view = model.active.value;
    const definition = tables[view];
    return (
      <div class="commercial-console-page fin-page">
        <PageHeader title="质量检验与批次追溯" />
        {model.selected.value || model.writer.form.value ? null : (
          <ConsoleNotice message={model.writer.notice.value} />
        )}
        <QualityOverview model={model} />
        <nav aria-label="质量台账" class="console-filters fin-filters">
          {model.visible.map((key) => (
            <button
              key={key}
              type="button"
              class={key === view ? 'secondary compact active' : 'secondary compact'}
              aria-pressed={key === view}
              data-testid={`kt-qi-tab-${key}`}
              onClick={() => {
                model.close();
                model.active.value = key;
              }}
            >
              {tables[key].title}
            </button>
          ))}
        </nav>
        <div class="console-row-actions">
          {topForms(context, model, view).map((action) => (
            <button
              key={action.label}
              type="button"
              class="primary compact"
              disabled={action.disabled}
              onClick={() => {
                model.writer.open(action.form());
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <OpsLedger
          key={view}
          prefix={`kt-qi-${view}`}
          label={definition.title}
          states={stateLabels(context, view)}
          columns={qualityColumns(context, model, view)}
          model={model.lists[view]}
        />
        <QualityDrawer context={context} model={model} view={view} />
        <ConsoleConfirmDialog pending={model.writer.confirmation} />
      </div>
    );
  };
  render(<Page />, host);
  if (model.visible.includes('lots'))
    registerRelatedRecord(context.workspace, host, 'quality-inspection', (id) => {
      model.close();
      model.active.value = 'lots';
      void model.open({ lotId: id });
    });
  void model.reload();
}
