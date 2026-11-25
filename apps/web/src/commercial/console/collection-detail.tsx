import type { JSX } from 'preact';
import { DetailDrawer, StatusBadge } from '@kingturf/ui';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import { CollectionActionFields, type CollectionFormProps } from './collection-forms';
import type { CollectionForm } from './collection-payload';
import {
  FinAmount,
  FinFacts,
  FinLink,
  FinSection,
  finLink,
  finRecord,
  finRows,
  finText,
  finWhen,
  finDay,
  type FinRow,
} from './fin-kit';

export const collectionStates: Readonly<Record<string, string>> = {
  OPEN: '待跟进',
  CONTACTING: '正在催收',
  PROMISE_ACTIVE: '承诺付款',
  PROMISE_BROKEN: '承诺违约',
  LEGAL_PENDING: '法务待受理',
  LEGAL_ACCEPTED: '法务已受理',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
};
export const caseNumber = (row: FinRow): string => finText(row, 'caseNumber', 'case_number');
export const caseState = (row: FinRow): string => finText(row, 'state');
export const CaseBadge = ({ row }: Readonly<{ row: FinRow }>) => {
  const state = caseState(row);
  const tone =
    state === 'PROMISE_BROKEN'
      ? 'danger'
      : state === 'LEGAL_PENDING'
        ? 'warning'
        : state === 'RESOLVED' || state === 'CLOSED'
          ? 'success'
          : 'neutral';
  return <StatusBadge tone={tone}>{collectionStates[state] ?? (state || '—')}</StatusBadge>;
};

const eventLabels: Readonly<Record<string, string>> = {
  OPENED: '建立案件',
  FOLLOWUP_RECORDED: '记录跟进',
  PROMISE_CREATED: '登记承诺',
  PROMISE_BROKEN: '确认承诺违约',
  PROMISE_FULFILLED: '承诺已履行',
  PROMISE_CANCELLED: '承诺已取消',
  LEGAL_REQUESTED: '申请法务移交',
  LEGAL_ACCEPTED: '受理法务移交',
  LEGAL_RETURNED: '退回法务移交',
  RESOLVED: '解决案件',
  CLOSED: '关闭案件',
};
const priorities: Readonly<Record<string, string>> = {
  CRITICAL: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

function CaseActions({
  row,
  permissions,
  open,
  busy,
}: Readonly<{
  row: FinRow;
  permissions: ReadonlySet<string>;
  open: (form: CollectionForm) => void;
  busy: boolean;
}>) {
  const state = caseState(row);
  const id = finText(row, 'id');
  const canManage =
    permissions.has('collection:manage') &&
    state !== '' &&
    !['LEGAL_ACCEPTED', 'CLOSED'].includes(state);
  const escalates = permissions.has('collection:escalate');
  const button = (action: CollectionForm['action'], subjectId: string, label: string) => (
    <button
      key={`${action}-${subjectId}`}
      type="button"
      class="secondary compact"
      disabled={busy}
      data-testid={`kt-collection-action-${action}`}
      onClick={() => {
        open({ action, subjectId });
      }}
    >
      {label}
    </button>
  );
  const buttons = [
    ...(canManage ? [button('followup', id, '记录催收跟进')] : []),
    ...(canManage && ['OPEN', 'CONTACTING', 'PROMISE_BROKEN'].includes(state)
      ? [button('promise', id, '登记付款承诺')]
      : []),
    ...(escalates
      ? finRows(row.promises)
          .filter((promise) => promise.state === 'PENDING')
          .map((promise) => button('break', finText(promise, 'id'), '确认承诺违约'))
      : []),
    ...(escalates && ['CONTACTING', 'PROMISE_BROKEN'].includes(state)
      ? [button('handoff', id, '申请法务移交')]
      : []),
    ...legalActions(row, permissions, button),
  ];
  return buttons.length ? <div class="inline-actions fin-case-actions">{buttons}</div> : null;
}

function legalActions(
  row: FinRow,
  permissions: ReadonlySet<string>,
  button: (action: CollectionForm['action'], id: string, label: string) => JSX.Element,
) {
  if (!permissions.has('legal-case:read')) return [];
  return finRows(row.legalHandoffs).flatMap((entry) => {
    const id = finText(entry, 'id');
    if (entry.state === 'REQUESTED' && permissions.has('legal-case:decide'))
      return [button('accept', id, '受理法务移交')];
    if (entry.state === 'ACCEPTED' && permissions.has('debt-evidence:generate'))
      return [button('package', id, '生成债权证据包')];
    return [];
  });
}

const packageStates: Readonly<Record<string, string>> = { READY: '已就绪', INCOMPLETE: '待补证据' };
const EvidencePackage = ({ pkg }: Readonly<{ pkg: FinRow }>) => (
  <span data-testid="kt-collection-package">
    {`证据包 ${finText(pkg, 'packageNumber', 'package_number')} · ${packageStates[finText(pkg, 'state')] ?? '—'} · ${finText(pkg, 'packageHash', 'package_hash').slice(0, 12)}`}
  </span>
);

const CaseEvidence = ({ row, legal }: Readonly<{ row: FinRow; legal: boolean }>) => {
  const events = finRows(row.events);
  const followups = finRows(row.followups);
  const promises = finRows(row.promises);
  const handoffs = legal ? finRows(row.legalHandoffs) : [];
  return (
    <>
      <FinSection title="处置时间线" testId="kt-collection-timeline">
        {events.length === 0 ? (
          <p class="fin-muted">暂无可见处置记录</p>
        ) : (
          <ol class="fin-timeline">
            {events.map((event) => {
              const type = finText(event, 'event_type');
              const status = finText(event, 'state');
              return (
                <li key={finText(event, 'id')}>
                  <strong>
                    {eventLabels[type] ?? collectionStates[status] ?? (type || '处置记录')}
                  </strong>
                  <time>{finWhen(event, 'created_at')}</time>
                  <span>{finText(event, 'reason')}</span>
                </li>
              );
            })}
          </ol>
        )}
      </FinSection>
      {followups.length ? (
        <FinSection title="跟进记录" testId="kt-collection-followups">
          <ul class="fin-timeline">
            {followups.map((entry) => (
              <li key={finText(entry, 'id')}>
                <time>{finWhen(entry, 'occurred_at')}</time>
                <strong>{finText(entry, 'contact_person')}</strong>
                <span>{finText(entry, 'outcome')}</span>
                <span>{finText(finRecord(entry.evidence), 'reference')}</span>
              </li>
            ))}
          </ul>
        </FinSection>
      ) : null}
      {promises.length ? (
        <FinSection title="付款承诺" testId="kt-collection-promises">
          <ul class="fin-timeline">
            {promises.map((entry) => (
              <li key={finText(entry, 'id')}>
                <strong>{finText(entry, 'debtor_contact') || '付款承诺'}</strong>
                <span>
                  {(
                    {
                      PENDING: '待履行',
                      BROKEN: '已违约',
                      FULFILLED: '已履行',
                      CANCELLED: '已取消',
                    } as Readonly<Record<string, string>>
                  )[finText(entry, 'state')] ?? '—'}
                </span>
                <span>{`到期 ${finWhen(entry, 'due_at')}`}</span>
              </li>
            ))}
          </ul>
        </FinSection>
      ) : null}
      {handoffs.length ? (
        <FinSection title="法务移交与债权证据" testId="kt-collection-legal">
          <ul class="fin-timeline">
            {handoffs.map((entry) => (
              <li key={finText(entry, 'id')}>
                <strong>{finText(entry, 'handoff_number', 'handoffNumber') || '法务移交'}</strong>
                <span>
                  {(
                    { REQUESTED: '待受理', ACCEPTED: '已受理', RETURNED: '已退回' } as Readonly<
                      Record<string, string>
                    >
                  )[finText(entry, 'state')] ?? '—'}
                </span>
                {finRows(entry.packages).map((pkg) => (
                  <EvidencePackage key={finText(pkg, 'id')} pkg={pkg} />
                ))}
              </li>
            ))}
          </ul>
        </FinSection>
      ) : null}
    </>
  );
};

type DetailProps = Readonly<{
  row: FinRow;
  ports: CollectionFormProps['ports'];
  form: CollectionForm | null;
  error: string;
  notice: string;
  busy: boolean;
  loading: boolean;
  openForm: (form: CollectionForm) => void;
  close: () => void;
  closeForm: () => void;
  submit: CollectionFormProps['onSubmit'];
}>;

export const CollectionDetail = (props: DetailProps) => {
  const { row, ports, form } = props;
  const ar = finRecord(row.receivable);
  const doc = finText(row, 'documentNumber');
  return (
    <DetailDrawer
      title={`催收案件 · ${caseNumber(row) || '—'}`}
      onClose={props.close}
      footer={props.notice === '' ? undefined : <ConsoleNotice message={props.notice} />}
    >
      <FinSection title="案件信息" testId="kt-collection-detail">
        <FinFacts
          items={[
            ['客户', finText(row, 'customerName') || '—'],
            ['阶段', <CaseBadge row={row} />],
            ['优先级', priorities[finText(row, 'priority')] ?? '—'],
            ['责任人', finText(row, 'assignedName') || '—'],
            ['建立时间', finWhen(row, 'opened_at')],
            ['下一次跟进', finWhen(row, 'nextActionAt')],
          ]}
        />
      </FinSection>
      <FinSection title="关联应收单" testId="kt-collection-ar">
        <FinFacts
          items={[
            [
              '应收单号',
              doc && ports.arRouteVisible ? (
                <FinLink
                  href={finLink('receivables')}
                  testId="kt-collection-link-ar"
                  onNavigate={props.close}
                >
                  {doc}
                </FinLink>
              ) : (
                doc || '—'
              ),
            ],
            ['到期日', finDay(ar, 'due_at') === '—' ? finDay(row, 'due_at') : finDay(ar, 'due_at')],
            ['原始金额', <FinAmount currency={ar.currency} amount={ar.original_amount} />],
            ['未核销余额', <FinAmount currency={row.currency} amount={row.remainingAmount} />],
            ['账龄', finText(row, 'overdueDays') ? `逾期 ${finText(row, 'overdueDays')} 天` : '—'],
          ]}
        />
      </FinSection>
      {form ? (
        <>
          <CollectionActionFields
            key={`${form.action}-${form.subjectId}`}
            action={form.action}
            row={row}
            ports={ports}
            error={props.error}
            onSubmit={props.submit}
          />
          <button type="button" class="secondary" disabled={props.busy} onClick={props.closeForm}>
            返回案件
          </button>
        </>
      ) : props.loading ? (
        <p role="status">正在读取案件详情…</p>
      ) : (
        <CaseActions
          row={row}
          permissions={ports.permissions}
          open={props.openForm}
          busy={props.busy}
        />
      )}
      <CaseEvidence row={row} legal={ports.permissions.has('legal-case:read')} />
      <FocusAnchor token={form?.action ?? 'detail'} />
    </DetailDrawer>
  );
};
