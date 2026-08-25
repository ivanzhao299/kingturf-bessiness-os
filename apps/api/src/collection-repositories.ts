import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
type CaseState =
  | 'OPEN'
  | 'CONTACTING'
  | 'PROMISE_ACTIVE'
  | 'PROMISE_BROKEN'
  | 'LEGAL_PENDING'
  | 'LEGAL_ACCEPTED'
  | 'RESOLVED'
  | 'CLOSED';
const digest = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const audit = (
  tx: SqlClient,
  action: string,
  targetType: string,
  targetId: string,
  context: Context,
  correlationId: string,
  metadata: JsonObject,
) =>
  tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [
      action,
      context.actor.employeeId,
      context.actor.companyId,
      targetType,
      targetId,
      correlationId,
      metadata,
    ],
  );
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Collection and legal operations require company scope');
};

export class PostgresCollectionRepository {
  public constructor(private readonly db: Db) {}

  public async list(context: Context) {
    company(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(c)||jsonb_build_object(
          'state',s.state,'remainingAmount',b.remaining_amount,'currency',b.currency,
          'documentNumber',d.document_number,'customerName',cu.name,'orderNumber',o.order_number,
          'overdueDays',greatest(0,floor(extract(epoch FROM(now()-b.due_at))/86400)),
          'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM collection_case_events e WHERE e.tenant_id=c.tenant_id AND e.collection_case_id=c.id),'[]'::jsonb),
          'followups',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.occurred_at,f.id) FROM collection_followups f WHERE f.tenant_id=c.tenant_id AND f.collection_case_id=c.id),'[]'::jsonb),
          'promises',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('state',ps.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.sequence) FROM collection_promise_events pe WHERE pe.tenant_id=p.tenant_id AND pe.promise_id=p.id),'[]'::jsonb)) ORDER BY p.created_at) FROM collection_promises p JOIN collection_promise_effective_states ps ON ps.tenant_id=p.tenant_id AND ps.promise_id=p.id WHERE p.tenant_id=c.tenant_id AND p.collection_case_id=c.id),'[]'::jsonb),
          'legalHandoffs',coalesce((SELECT jsonb_agg(to_jsonb(h)||jsonb_build_object('state',hs.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(he) ORDER BY he.sequence) FROM legal_handoff_events he WHERE he.tenant_id=h.tenant_id AND he.legal_handoff_id=h.id),'[]'::jsonb),'packages',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.version) FROM debt_evidence_packages p WHERE p.tenant_id=h.tenant_id AND p.legal_handoff_id=h.id),'[]'::jsonb)) ORDER BY h.created_at) FROM legal_handoffs h JOIN legal_handoff_effective_states hs ON hs.tenant_id=h.tenant_id AND hs.legal_handoff_id=h.id WHERE h.tenant_id=c.tenant_id AND h.collection_case_id=c.id),'[]'::jsonb)
        ) item
        FROM collection_cases c JOIN collection_case_effective_states s ON s.tenant_id=c.tenant_id AND s.collection_case_id=c.id
        JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
        JOIN ar_documents d ON d.tenant_id=b.tenant_id AND d.id=b.ar_document_id
        JOIN customers cu ON cu.tenant_id=b.tenant_id AND cu.id=b.customer_id
        LEFT JOIN sales_orders o ON o.tenant_id=d.tenant_id AND o.id=d.sales_order_id
        WHERE c.tenant_id=$1 ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,b.due_at,c.opened_at`,
        [context.actor.companyId],
      )
    ).rows.map((row) => row.item);
  }

  public createCase(
    input: {
      caseNumber: string;
      arOpenItemId: string;
      assignedTo: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      reason: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const receivable = (
        await tx.query<{
          remaining_amount: string;
          due_at: string;
          currency: string;
          document_number: string;
          customer_id: string;
          sales_order_id: string | null;
        }>(
          `SELECT b.remaining_amount,b.due_at,b.currency,d.document_number,b.customer_id,d.sales_order_id
           FROM ar_open_item_balances b JOIN ar_documents d ON d.tenant_id=b.tenant_id AND d.id=b.ar_document_id
           WHERE b.tenant_id=$1 AND b.id=$2`,
          [context.actor.companyId, input.arOpenItemId],
        )
      ).rows[0];
      if (!receivable) throw new DomainError('not_found', 'Receivable not found');
      if (Number(receivable.remaining_amount) <= 0 || new Date(receivable.due_at) >= new Date())
        throw new DomainError('conflict', 'Collection case requires overdue positive balance');
      const snapshot = {
        formulaVersion: 'KT-L19-COLLECTION-V1',
        arOpenItemId: input.arOpenItemId,
        documentNumber: receivable.document_number,
        customerId: receivable.customer_id,
        salesOrderId: receivable.sales_order_id,
        currency: receivable.currency,
        remainingAmount: receivable.remaining_amount,
        dueAt: new Date(receivable.due_at).toISOString(),
        evaluatedAt: new Date().toISOString(),
      };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO collection_cases(tenant_id,case_number,ar_open_item_id,assigned_to,priority,opened_at,opened_balance,due_at,opening_snapshot,opening_hash,created_by,correlation_id,idempotency_key)
           VALUES($1,$2,$3,$4,$5,now(),$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            input.caseNumber,
            input.arOpenItemId,
            input.assignedTo,
            input.priority,
            receivable.remaining_amount,
            receivable.due_at,
            snapshot,
            digest(snapshot),
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Collection case insert failed');
      await this.insertCaseEvent(
        tx,
        row.id,
        1,
        'OPEN',
        'CASE_OPENED',
        input.reason,
        { openingSnapshotHash: digest(snapshot) },
        `${input.idempotencyKey}:event`,
        context,
        correlationId,
      );
      await audit(tx, 'collection-case.opened', 'collection-case', row.id, context, correlationId, {
        arOpenItemId: input.arOpenItemId,
        priority: input.priority,
      });
      return { id: row.id, state: 'OPEN', openingSnapshot: snapshot };
    });
  }

  public addFollowup(
    caseId: string,
    input: {
      channel: 'PHONE' | 'EMAIL' | 'LETTER' | 'MEETING' | 'VISIT' | 'OTHER';
      occurredAt: string;
      contactPerson: string;
      outcome: string;
      nextActionAt?: string;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = await this.currentCase(tx, caseId, context);
      if (current.state === 'CLOSED' || current.state === 'LEGAL_ACCEPTED')
        throw new DomainError('conflict', 'Case state does not allow collection follow-up');
      const payload = { caseId, ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO collection_followups(tenant_id,collection_case_id,channel,occurred_at,contact_person,outcome,next_action_at,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            caseId,
            input.channel,
            input.occurredAt,
            input.contactPerson,
            input.outcome,
            input.nextActionAt ?? null,
            input.evidence,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Collection follow-up insert failed');
      if (current.state === 'OPEN' || current.state === 'PROMISE_BROKEN')
        await this.insertCaseEvent(
          tx,
          caseId,
          current.sequence + 1,
          'CONTACTING',
          'FOLLOWUP_RECORDED',
          input.outcome,
          { followupId: row.id },
          `${input.idempotencyKey}:case-event`,
          context,
          correlationId,
        );
      await audit(
        tx,
        'collection-followup.recorded',
        'collection-followup',
        row.id,
        context,
        correlationId,
        { caseId, channel: input.channel },
      );
      return { id: row.id, caseId, state: current.state === 'OPEN' ? 'CONTACTING' : current.state };
    });
  }

  public createPromise(
    caseId: string,
    input: {
      promisedAmount: string;
      currency: string;
      promisedAt: string;
      dueAt: string;
      debtorContact: string;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = await this.currentCase(tx, caseId, context);
      const payload = { caseId, ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO collection_promises(tenant_id,collection_case_id,promised_amount,currency,promised_at,due_at,debtor_contact,evidence,created_by,correlation_id,idempotency_key,canonical_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            caseId,
            input.promisedAmount,
            input.currency,
            input.promisedAt,
            input.dueAt,
            input.debtorContact,
            input.evidence,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Collection promise insert failed');
      await tx.query(
        `INSERT INTO collection_promise_events(tenant_id,promise_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,1,'PENDING','付款承诺已登记',$3,$4,$5,$6,$7)`,
        [
          context.actor.companyId,
          row.id,
          { debtorContact: input.debtorContact },
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:promise-event`,
          digest({ promiseId: row.id, sequence: 1, state: 'PENDING' }),
        ],
      );
      await this.insertCaseEvent(
        tx,
        caseId,
        current.sequence + 1,
        'PROMISE_ACTIVE',
        'PROMISE_CREATED',
        '付款承诺生效',
        { promiseId: row.id, dueAt: input.dueAt, promisedAmount: input.promisedAmount },
        `${input.idempotencyKey}:case-event`,
        context,
        correlationId,
      );
      await audit(
        tx,
        'collection-promise.created',
        'collection-promise',
        row.id,
        context,
        correlationId,
        {
          caseId,
          dueAt: input.dueAt,
          promisedAmount: input.promisedAmount,
        },
      );
      return { id: row.id, caseId, state: 'PENDING' };
    });
  }

  public decidePromise(
    promiseId: string,
    state: 'FULFILLED' | 'BROKEN' | 'CANCELLED',
    input: {
      reason: string;
      allocationEntryIds: readonly string[];
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const promise = (
        await tx.query<{ collection_case_id: string; sequence: number }>(
          `SELECT p.collection_case_id,s.sequence FROM collection_promises p JOIN collection_promise_effective_states s ON s.tenant_id=p.tenant_id AND s.promise_id=p.id
           WHERE p.tenant_id=$1 AND p.id=$2`,
          [context.actor.companyId, promiseId],
        )
      ).rows[0];
      if (!promise) throw new DomainError('not_found', 'Payment promise not found');
      const event = { promiseId, sequence: promise.sequence + 1, state, ...input };
      await tx.query(
        `INSERT INTO collection_promise_events(tenant_id,promise_id,sequence,state,reason,allocation_entry_ids,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          context.actor.companyId,
          promiseId,
          event.sequence,
          state,
          input.reason,
          input.allocationEntryIds,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          digest(event),
        ],
      );
      const current = await this.currentCase(tx, promise.collection_case_id, context);
      const caseState: CaseState = state === 'BROKEN' ? 'PROMISE_BROKEN' : 'CONTACTING';
      await this.insertCaseEvent(
        tx,
        promise.collection_case_id,
        current.sequence + 1,
        caseState,
        `PROMISE_${state}`,
        input.reason,
        { promiseId, allocationEntryIds: input.allocationEntryIds },
        `${input.idempotencyKey}:case-event`,
        context,
        correlationId,
      );
      await audit(
        tx,
        `collection-promise.${state.toLowerCase()}`,
        'collection-promise',
        promiseId,
        context,
        correlationId,
        { caseId: promise.collection_case_id, state },
      );
      return { promiseId, state, caseState };
    });
  }

  public requestLegal(
    caseId: string,
    input: { handoffNumber: string; reason: string; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = await this.currentCase(tx, caseId, context);
      const balance = (
        await tx.query<{ remaining_amount: string }>(
          `SELECT b.remaining_amount FROM collection_cases c JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
           WHERE c.tenant_id=$1 AND c.id=$2`,
          [context.actor.companyId, caseId],
        )
      ).rows[0];
      if (!balance) throw new DomainError('not_found', 'Collection case not found');
      const payload = { caseId, claimAmount: balance.remaining_amount, ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO legal_handoffs(tenant_id,handoff_number,collection_case_id,claim_amount,requested_at,request_reason,requested_by,correlation_id,idempotency_key,canonical_hash)
           VALUES($1,$2,$3,$4,now(),$5,$6,$7,$8,$9) RETURNING id`,
          [
            context.actor.companyId,
            input.handoffNumber,
            caseId,
            balance.remaining_amount,
            input.reason,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Legal handoff insert failed');
      await tx.query(
        `INSERT INTO legal_handoff_events(tenant_id,legal_handoff_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,1,'REQUESTED',$3,$4,$5,$6,$7,$8)`,
        [
          context.actor.companyId,
          row.id,
          input.reason,
          { collectionCaseId: caseId, claimAmount: balance.remaining_amount },
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:legal-event`,
          digest({ legalHandoffId: row.id, sequence: 1, state: 'REQUESTED' }),
        ],
      );
      await this.insertCaseEvent(
        tx,
        caseId,
        current.sequence + 1,
        'LEGAL_PENDING',
        'LEGAL_HANDOFF_REQUESTED',
        input.reason,
        { legalHandoffId: row.id },
        `${input.idempotencyKey}:case-event`,
        context,
        correlationId,
      );
      await audit(tx, 'legal-handoff.requested', 'legal-handoff', row.id, context, correlationId, {
        caseId,
        claimAmount: balance.remaining_amount,
      });
      return { id: row.id, caseId, state: 'REQUESTED', claimAmount: balance.remaining_amount };
    });
  }

  public decideLegal(
    legalHandoffId: string,
    state: 'ACCEPTED' | 'RETURNED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const handoff = (
        await tx.query<{ collection_case_id: string; sequence: number }>(
          `SELECT h.collection_case_id,s.sequence FROM legal_handoffs h JOIN legal_handoff_effective_states s ON s.tenant_id=h.tenant_id AND s.legal_handoff_id=h.id
           WHERE h.tenant_id=$1 AND h.id=$2`,
          [context.actor.companyId, legalHandoffId],
        )
      ).rows[0];
      if (!handoff) throw new DomainError('not_found', 'Legal handoff not found');
      const event = { legalHandoffId, sequence: handoff.sequence + 1, state, ...input };
      await tx.query(
        `INSERT INTO legal_handoff_events(tenant_id,legal_handoff_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          context.actor.companyId,
          legalHandoffId,
          event.sequence,
          state,
          input.reason,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          digest(event),
        ],
      );
      const current = await this.currentCase(tx, handoff.collection_case_id, context);
      await this.insertCaseEvent(
        tx,
        handoff.collection_case_id,
        current.sequence + 1,
        state === 'ACCEPTED' ? 'LEGAL_ACCEPTED' : 'CONTACTING',
        `LEGAL_HANDOFF_${state}`,
        input.reason,
        { legalHandoffId, ...input.evidence },
        `${input.idempotencyKey}:case-event`,
        context,
        correlationId,
      );
      await audit(
        tx,
        `legal-handoff.${state.toLowerCase()}`,
        'legal-handoff',
        legalHandoffId,
        context,
        correlationId,
        { caseId: handoff.collection_case_id, state },
      );
      return { legalHandoffId, state };
    });
  }

  public generateEvidencePackage(
    legalHandoffId: string,
    input: { packageNumber: string; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const evidence = (
        await tx.query<{
          collection_case_id: string;
          legal_state: string;
          sales_order_id: string | null;
          contract_signature_id: string | null;
          ar_document_id: string;
          ar_open_item_id: string;
          shipment_id: string | null;
          pod_event_id: string | null;
          followup_ids: string[];
          promise_ids: string[];
        }>(
          `SELECT h.collection_case_id,hs.state legal_state,d.sales_order_id,o.signature_evidence_id contract_signature_id,
             d.id ar_document_id,c.ar_open_item_id,
             sh.id shipment_id,pod.id pod_event_id,
             ARRAY(SELECT f.id FROM collection_followups f WHERE f.tenant_id=c.tenant_id AND f.collection_case_id=c.id ORDER BY f.occurred_at,f.id) followup_ids,
             ARRAY(SELECT p.id FROM collection_promises p WHERE p.tenant_id=c.tenant_id AND p.collection_case_id=c.id ORDER BY p.created_at,p.id) promise_ids
           FROM legal_handoffs h JOIN legal_handoff_effective_states hs ON hs.tenant_id=h.tenant_id AND hs.legal_handoff_id=h.id
           JOIN collection_cases c ON c.tenant_id=h.tenant_id AND c.id=h.collection_case_id
           JOIN ar_open_items i ON i.tenant_id=c.tenant_id AND i.id=c.ar_open_item_id
           JOIN ar_documents d ON d.tenant_id=i.tenant_id AND d.id=i.ar_document_id
           LEFT JOIN sales_orders o ON o.tenant_id=d.tenant_id AND o.id=d.sales_order_id
           LEFT JOIN shipment_release_requests sr ON sr.tenant_id=d.tenant_id AND sr.sales_order_id=d.sales_order_id
           LEFT JOIN shipments sh ON sh.tenant_id=sr.tenant_id AND sh.release_request_id=sr.id
           LEFT JOIN LATERAL(SELECT e.id FROM shipment_events e WHERE e.tenant_id=sh.tenant_id AND e.shipment_id=sh.id AND e.state='DELIVERED' ORDER BY e.sequence DESC LIMIT 1)pod ON true
           WHERE h.tenant_id=$1 AND h.id=$2 ORDER BY sh.created_at DESC NULLS LAST LIMIT 1`,
          [context.actor.companyId, legalHandoffId],
        )
      ).rows[0];
      if (!evidence) throw new DomainError('not_found', 'Legal handoff not found');
      const missing = [
        ...(evidence.legal_state === 'ACCEPTED' ? [] : ['LEGAL_ACCEPTANCE']),
        ...(evidence.sales_order_id && !evidence.contract_signature_id
          ? ['CONTRACT_SIGNATURE']
          : []),
        ...(evidence.followup_ids.length ? [] : ['COLLECTION_FOLLOWUP']),
        ...(evidence.shipment_id && !evidence.pod_event_id ? ['POD'] : []),
      ];
      const sourceItems = [
        ...(evidence.sales_order_id
          ? [
              {
                evidenceType: 'SALES_ORDER',
                sourceType: 'sales-order',
                sourceId: evidence.sales_order_id,
              },
            ]
          : []),
        ...(evidence.contract_signature_id
          ? [
              {
                evidenceType: 'CONTRACT_SIGNATURE',
                sourceType: 'contract-signature',
                sourceId: evidence.contract_signature_id,
              },
            ]
          : []),
        {
          evidenceType: 'AR_DOCUMENT',
          sourceType: 'ar-document',
          sourceId: evidence.ar_document_id,
        },
        {
          evidenceType: 'AR_OPEN_ITEM',
          sourceType: 'ar-open-item',
          sourceId: evidence.ar_open_item_id,
        },
        ...evidence.followup_ids.map((sourceId) => ({
          evidenceType: 'COLLECTION_FOLLOWUP',
          sourceType: 'collection-followup',
          sourceId,
        })),
        ...evidence.promise_ids.map((sourceId) => ({
          evidenceType: 'PAYMENT_PROMISE',
          sourceType: 'collection-promise',
          sourceId,
        })),
        { evidenceType: 'LEGAL_HANDOFF', sourceType: 'legal-handoff', sourceId: legalHandoffId },
        ...(evidence.pod_event_id
          ? [{ evidenceType: 'POD', sourceType: 'shipment-event', sourceId: evidence.pod_event_id }]
          : []),
      ];
      const versionRow = (
        await tx.query<{ version: number }>(
          'SELECT coalesce(max(version),0)+1 version FROM debt_evidence_packages WHERE tenant_id=$1 AND legal_handoff_id=$2',
          [context.actor.companyId, legalHandoffId],
        )
      ).rows[0];
      const version = versionRow?.version ?? 1;
      const manifest = {
        formulaVersion: 'KT-L19-EVIDENCE-V1',
        legalHandoffId,
        collectionCaseId: evidence.collection_case_id,
        generatedAt: new Date().toISOString(),
        missingRequirements: missing,
        sources: sourceItems,
      };
      const packageRow = (
        await tx.query<{ id: string }>(
          `INSERT INTO debt_evidence_packages(tenant_id,package_number,legal_handoff_id,version,state,generated_at,manifest,missing_requirements,package_hash,generated_by,correlation_id,idempotency_key)
           VALUES($1,$2,$3,$4,$5,now(),$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            context.actor.companyId,
            input.packageNumber,
            legalHandoffId,
            version,
            missing.length ? 'INCOMPLETE' : 'READY',
            manifest,
            missing,
            digest(manifest),
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
          ],
        )
      ).rows[0];
      if (!packageRow) throw new Error('Debt evidence package insert failed');
      for (const [index, source] of sourceItems.entries()) {
        const summary = {
          evidenceType: source.evidenceType,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
        };
        await tx.query(
          `INSERT INTO debt_evidence_package_items(tenant_id,package_id,sequence,evidence_type,source_type,source_id,source_occurred_at,summary,source_hash)
           VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8)`,
          [
            context.actor.companyId,
            packageRow.id,
            index + 1,
            source.evidenceType,
            source.sourceType,
            source.sourceId,
            summary,
            digest(summary),
          ],
        );
      }
      await audit(
        tx,
        'debt-evidence-package.generated',
        'debt-evidence-package',
        packageRow.id,
        context,
        correlationId,
        {
          legalHandoffId,
          version,
          state: missing.length ? 'INCOMPLETE' : 'READY',
          packageHash: digest(manifest),
        },
      );
      return {
        id: packageRow.id,
        legalHandoffId,
        version,
        state: missing.length ? 'INCOMPLETE' : 'READY',
        missingRequirements: missing,
        packageHash: digest(manifest),
      };
    });
  }

  public transitionCase(
    caseId: string,
    state: 'RESOLVED' | 'CLOSED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = await this.currentCase(tx, caseId, context);
      await this.insertCaseEvent(
        tx,
        caseId,
        current.sequence + 1,
        state,
        `CASE_${state}`,
        input.reason,
        input.evidence,
        input.idempotencyKey,
        context,
        correlationId,
      );
      await audit(
        tx,
        `collection-case.${state.toLowerCase()}`,
        'collection-case',
        caseId,
        context,
        correlationId,
        { state, reason: input.reason },
      );
      return { caseId, state };
    });
  }

  private async currentCase(tx: SqlClient, caseId: string, context: Context) {
    const current = (
      await tx.query<{ state: CaseState; sequence: number }>(
        'SELECT state,sequence FROM collection_case_effective_states WHERE tenant_id=$1 AND collection_case_id=$2',
        [context.actor.companyId, caseId],
      )
    ).rows[0];
    if (!current) throw new DomainError('not_found', 'Collection case not found');
    return current;
  }

  private insertCaseEvent(
    tx: SqlClient,
    caseId: string,
    sequence: number,
    state: CaseState,
    eventType: string,
    reason: string,
    evidence: JsonObject,
    idempotencyKey: string,
    context: Context,
    correlationId: string,
  ) {
    const event = { caseId, sequence, state, eventType, reason, evidence };
    return tx.query(
      `INSERT INTO collection_case_events(tenant_id,collection_case_id,sequence,state,event_type,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        context.actor.companyId,
        caseId,
        sequence,
        state,
        eventType,
        reason,
        evidence,
        context.actor.employeeId,
        correlationId,
        idempotencyKey,
        digest(event),
      ],
    );
  }
}
