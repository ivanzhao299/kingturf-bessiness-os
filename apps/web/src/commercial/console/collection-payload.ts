import { COLLECTION_PATH } from './collection-ports';

export type CollectionAction =
  | 'create'
  | 'followup'
  | 'promise'
  | 'break'
  | 'handoff'
  | 'accept'
  | 'package';
export type CollectionForm = Readonly<{ action: CollectionAction; subjectId: string }>;
const prefixes: Record<CollectionAction, string> = {
  create: 'COL',
  followup: 'FOLLOW',
  promise: 'PROMISE',
  break: 'BROKEN',
  handoff: 'LEGAL',
  accept: 'LEGAL-ACCEPT',
  package: 'DEBT',
};

export function collectionSubmission(
  form: CollectionForm,
  values: Readonly<Record<string, string>>,
) {
  const idempotencyKey = `${prefixes[form.action]}-${Date.now().toString(36)}`;
  const value = (key: string, fallback = '') => (values[key] ?? fallback).trim();
  const stamp = (key: string) => new Date(value(key)).toISOString();
  const id = encodeURIComponent(form.subjectId);
  const evidence = { reference: value('evidenceReference') };
  const reason = value('reason');
  switch (form.action) {
    case 'create':
      return {
        path: COLLECTION_PATH,
        body: {
          caseNumber: value('caseNumber'),
          arOpenItemId: value('arOpenItemId'),
          assignedTo: value('assignedTo'),
          priority: value('priority', 'HIGH'),
          reason,
          idempotencyKey,
        },
      };
    case 'followup':
      return {
        path: `${COLLECTION_PATH}/${id}/followups`,
        body: {
          channel: value('channel', 'PHONE'),
          occurredAt: stamp('occurredAt'),
          contactPerson: value('contactPerson'),
          outcome: value('outcome'),
          ...(value('nextActionAt') ? { nextActionAt: stamp('nextActionAt') } : {}),
          evidence,
          idempotencyKey,
        },
      };
    case 'promise':
      return {
        path: `${COLLECTION_PATH}/${id}/promises`,
        body: {
          promisedAmount: value('promisedAmount'),
          currency: value('currency', 'CNY'),
          promisedAt: stamp('promisedAt'),
          dueAt: stamp('dueAt'),
          debtorContact: value('debtorContact'),
          evidence,
          idempotencyKey,
        },
      };
    case 'break':
      return {
        path: `/api/v1/collection-promises/${id}/break`,
        body: { reason, allocationEntryIds: [], evidence, idempotencyKey },
      };
    case 'handoff':
      return {
        path: `${COLLECTION_PATH}/${id}/legal-handoffs`,
        body: { handoffNumber: value('handoffNumber'), reason, idempotencyKey },
      };
    case 'accept':
      return {
        path: `/api/v1/legal-handoffs/${id}/accept`,
        body: { reason, evidence: { reviewReference: value('reviewReference') }, idempotencyKey },
      };
    case 'package':
      return {
        path: `/api/v1/legal-handoffs/${id}/evidence-packages`,
        body: { packageNumber: value('packageNumber'), idempotencyKey },
      };
  }
}
