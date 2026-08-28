import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Contract document operations require company scope');
};
const audit = (
  tx: SqlClient,
  action: string,
  actor: Actor,
  target: string,
  id: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, target, id, correlationId, metadata],
  );

export class PostgresContractDocumentRepository {
  public constructor(private readonly db: Database) {}
  public async list(context: Context, subjectType?: string, subjectId?: string) {
    company(context);
    const rows = await this.db.query<{ item: JsonObject }>(
      `SELECT to_jsonb(d)||jsonb_build_object('attachmentName',a.original_name,'attachmentMimeType',a.mime_type,'envelopes',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('signers',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sequence) FROM contract_signature_signers s WHERE s.tenant_id=e.tenant_id AND s.envelope_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC) FROM contract_signature_envelopes e WHERE e.tenant_id=d.tenant_id AND e.contract_document_id=d.id),'[]'::jsonb)) item
       FROM contract_documents d JOIN attachments a ON a.id=d.attachment_id AND a.tenant_id=d.tenant_id
       WHERE d.tenant_id=$1 AND ($2::text IS NULL OR d.subject_type=$2) AND ($3::uuid IS NULL OR d.subject_id=$3)
       ORDER BY d.created_at DESC`,
      [context.actor.companyId, subjectType ?? null, subjectId ?? null],
    );
    return rows.rows.map((row) => row.item);
  }
  public create(
    input: {
      businessType: 'SALES' | 'PURCHASE';
      subjectType: 'contract-revision' | 'purchase-order';
      subjectId: string;
      attachmentId: string;
      title: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const subjectTable =
        input.subjectType === 'contract-revision' ? 'contract_revisions' : 'purchase_orders';
      const subject = await tx.query(
        `SELECT id FROM ${subjectTable} WHERE id=$1 AND tenant_id=$2`,
        [input.subjectId, context.actor.companyId],
      );
      if (!subject.rows[0])
        throw new DomainError('not_found', 'Contract business record not found');
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO contract_documents(tenant_id,business_type,subject_type,subject_id,attachment_id,title,created_by)
        SELECT $1,$2,$3,$4,a.id,$6,$7 FROM attachments a WHERE a.id=$5 AND a.tenant_id=$1 AND a.state='AVAILABLE' RETURNING id`,
          [
            context.actor.companyId,
            input.businessType,
            input.subjectType,
            input.subjectId,
            input.attachmentId,
            input.title,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Contract file must be uploaded before binding');
      await tx.query(
        `INSERT INTO attachment_bindings(tenant_id,attachment_id,object_type,object_id,bound_by) VALUES($1,$2,'contract-document',$3,$4) ON CONFLICT DO NOTHING`,
        [context.actor.companyId, input.attachmentId, row.id, context.actor.employeeId],
      );
      await audit(
        tx,
        'contract-document.created',
        context.actor,
        'contract-document',
        row.id,
        correlationId,
        { ...input },
      );
      return { id: row.id, state: 'UPLOADED', ...input };
    });
  }
  public ocr(
    id: string,
    input: { provider: string; text: string; fields: JsonObject; confidence: number },
    reviewed: boolean,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const event = reviewed ? 'REVIEWED' : 'SUCCEEDED';
      const state = reviewed ? 'READY_TO_SIGN' : 'OCR_REVIEW';
      const row = (
        await tx.query<{ id: string }>(
          `UPDATE contract_documents SET state=$3,ocr_provider=$4,ocr_text=$5,extracted_fields=$6,ocr_confidence=$7,ocr_completed_at=coalesce(ocr_completed_at,now()),reviewed_by=CASE WHEN $8 THEN $2 ELSE reviewed_by END,reviewed_at=CASE WHEN $8 THEN now() ELSE reviewed_at END,version=version+1,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id`,
          [
            id,
            context.actor.companyId,
            state,
            input.provider,
            input.text,
            input.fields,
            input.confidence,
            reviewed,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Contract document not found');
      const payload = {
        text: input.text,
        fields: input.fields,
        confidence: input.confidence,
      } as JsonObject;
      await tx.query(
        `INSERT INTO contract_ocr_events(tenant_id,contract_document_id,event_type,provider,payload,payload_hash,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          context.actor.companyId,
          id,
          event,
          input.provider,
          payload,
          hash(payload),
          context.actor.employeeId,
          correlationId,
        ],
      );
      await audit(
        tx,
        `contract-ocr.${event.toLowerCase()}`,
        context.actor,
        'contract-document',
        id,
        correlationId,
        { state },
      );
      return {
        id,
        state,
        ocrProvider: input.provider,
        ocrConfidence: input.confidence,
      };
    });
  }
  public createEnvelope(
    id: string,
    input: {
      provider: string;
      providerEnvelopeId: string;
      signingOrder: 'SEQUENTIAL' | 'PARALLEL';
      expiresAt: string | null;
      signers: readonly { sequence: number; role: string; name: string; contact: string }[];
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO contract_signature_envelopes(tenant_id,contract_document_id,provider,provider_envelope_id,state,signing_order,expires_at,sent_at,created_by)
        SELECT $1,d.id,$3,$4,'SENT',$5,$6,now(),$7 FROM contract_documents d WHERE d.id=$2 AND d.tenant_id=$1 AND d.state='READY_TO_SIGN' RETURNING id`,
          [
            context.actor.companyId,
            id,
            input.provider,
            input.providerEnvelopeId,
            input.signingOrder,
            input.expiresAt,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'OCR review must be completed before signing');
      for (const signer of input.signers)
        await tx.query(
          `INSERT INTO contract_signature_signers(tenant_id,envelope_id,sequence,role,name,contact,status) VALUES($1,$2,$3,$4,$5,$6,'SENT')`,
          [
            context.actor.companyId,
            row.id,
            signer.sequence,
            signer.role,
            signer.name,
            signer.contact,
          ],
        );
      await tx.query(
        `UPDATE contract_documents SET state='SIGNING',version=version+1,updated_at=now() WHERE id=$1 AND tenant_id=$2`,
        [id, context.actor.companyId],
      );
      await audit(
        tx,
        'contract-signature.sent',
        context.actor,
        'contract-document',
        id,
        correlationId,
        {
          envelopeId: row.id,
          provider: input.provider,
          signerCount: input.signers.length,
        },
      );
      return { id: row.id, contractDocumentId: id, state: 'SENT' };
    });
  }
  public completeEnvelope(
    envelopeId: string,
    input: {
      providerEventId: string;
      signedAt: string;
      signedAttachmentId: string;
      evidence: JsonObject;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const evidenceHash = hash(input.evidence);
      const row = (
        await tx.query<{ document_id: string }>(
          `UPDATE contract_signature_envelopes e SET state='SIGNED',signed_attachment_id=$3,evidence=$4,evidence_hash=$5,completed_at=$6,version=version+1,updated_at=now()
        FROM attachments a WHERE e.id=$1 AND e.tenant_id=$2 AND a.id=$3 AND a.tenant_id=e.tenant_id AND a.state='AVAILABLE' AND e.state IN('SENT','VIEWED') RETURNING e.contract_document_id document_id`,
          [
            envelopeId,
            context.actor.companyId,
            input.signedAttachmentId,
            input.evidence,
            evidenceHash,
            input.signedAt,
          ],
        )
      ).rows[0];
      if (!row)
        throw new DomainError('conflict', 'Open envelope and uploaded signed file are required');
      await tx.query(
        `INSERT INTO contract_signature_events(tenant_id,envelope_id,provider_event_id,event_type,payload,payload_hash,occurred_at) VALUES($1,$2,$3,'SIGNED',$4,$5,$6)`,
        [
          context.actor.companyId,
          envelopeId,
          input.providerEventId,
          input.evidence,
          evidenceHash,
          input.signedAt,
        ],
      );
      await tx.query(
        `UPDATE contract_signature_signers SET status='SIGNED',signed_at=$3 WHERE envelope_id=$1 AND tenant_id=$2`,
        [envelopeId, context.actor.companyId, input.signedAt],
      );
      await tx.query(
        `UPDATE contract_documents SET state='SIGNED',version=version+1,updated_at=now() WHERE id=$1 AND tenant_id=$2`,
        [row.document_id, context.actor.companyId],
      );
      await audit(
        tx,
        'contract-signature.completed',
        context.actor,
        'contract-document',
        row.document_id,
        correlationId,
        { envelopeId, evidenceHash },
      );
      return {
        id: envelopeId,
        contractDocumentId: row.document_id,
        state: 'SIGNED',
        evidenceHash,
      };
    });
  }
}
