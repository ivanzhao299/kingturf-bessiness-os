import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor } from '@kingturf/domain';
import type { Database } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Context = Readonly<{ actor: Actor; scopes: readonly DataScope[] }>;
const digest = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const companyWide = (context: Context) =>
  context.scopes.includes('COMPANY') || context.scopes.includes('GROUP');

export class PostgresBusinessDocumentRepository {
  public constructor(private readonly db: Database) {}

  public async list(route: string | undefined, context: Context) {
    const values: unknown[] = [context.actor.companyId];
    const clauses = ['d.tenant_id=$1', "d.state<>'ARCHIVED'"];
    if (!companyWide(context)) {
      values.push(context.actor.employeeId);
      clauses.push(`d.created_by=$${String(values.length)}`);
    }
    if (route) {
      values.push(route);
      clauses.push(`d.route=$${String(values.length)}`);
    }
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object(
          'id',d.id,'templateKey',d.template_key,'title',d.title,'route',d.route,
          'subjectType',d.subject_type,'subjectId',d.subject_id,'state',d.state,
          'currentVersion',d.current_version,'createdBy',d.created_by,
          'createdAt',d.created_at,'updatedAt',d.updated_at) item
         FROM business_documents d WHERE ${clauses.join(' AND ')}
         ORDER BY d.updated_at DESC,d.id DESC LIMIT 200`,
        values,
      )
    ).rows.map((row) => row.item);
  }

  public async get(id: string, context: Context) {
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object(
          'id',d.id,'templateKey',d.template_key,'title',d.title,'route',d.route,
          'subjectType',d.subject_type,'subjectId',d.subject_id,'state',d.state,
          'currentVersion',d.current_version,'createdBy',d.created_by,
          'createdAt',d.created_at,'updatedAt',d.updated_at,
          'versions',coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',v.id,'version',v.version,'content',v.content,'changeSummary',v.change_summary,
            'canonicalHash',v.canonical_hash,'createdBy',v.created_by,'createdAt',v.created_at)
            ORDER BY v.version DESC) FROM business_document_versions v
            WHERE v.tenant_id=d.tenant_id AND v.document_id=d.id),'[]'::jsonb)) item
         FROM business_documents d
         WHERE d.id=$1 AND d.tenant_id=$2 AND ($3::boolean OR d.created_by=$4)`,
        [id, context.actor.companyId, companyWide(context), context.actor.employeeId],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Business document not found');
    return row.item;
  }

  public create(
    input: {
      templateKey: string;
      title: string;
      route: string;
      subjectType?: string;
      subjectId?: string;
      content: JsonObject;
    },
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const document = (
        await tx.query<{ id: string }>(
          `INSERT INTO business_documents(
            tenant_id,template_key,title,route,subject_type,subject_id,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            actor.companyId,
            input.templateKey,
            input.title,
            input.route,
            input.subjectType ?? null,
            input.subjectId ?? null,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!document) throw new Error('Business document insert failed');
      const canonicalHash = digest(input.content);
      await tx.query(
        `INSERT INTO business_document_versions(
          tenant_id,document_id,version,content,change_summary,canonical_hash,created_by)
         VALUES($1,$2,1,$3,'从受控模板创建',$4,$5)`,
        [actor.companyId, document.id, input.content, canonicalHash, actor.employeeId],
      );
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES('business-document.create','SUCCESS',$1,$2,'business-document',$3,$4,$5)`,
        [
          actor.employeeId,
          actor.companyId,
          document.id,
          correlationId,
          { templateKey: input.templateKey },
        ],
      );
      return {
        id: document.id,
        templateKey: input.templateKey,
        title: input.title,
        route: input.route,
        currentVersion: 1,
        versions: [
          { version: 1, content: input.content, changeSummary: '从受控模板创建', canonicalHash },
        ],
      };
    });
  }

  public saveVersion(
    id: string,
    input: { expectedVersion: number; content: JsonObject; changeSummary: string },
    context: Context,
    correlationId: string,
  ) {
    const { actor } = context;
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:business-document:${id}`,
      ]);
      const nextVersion = input.expectedVersion + 1;
      const updated = (
        await tx.query<{ current_version: number }>(
          `UPDATE business_documents SET current_version=$3,updated_at=now()
           WHERE id=$1 AND tenant_id=$2 AND current_version=$4 AND state<>'ARCHIVED'
             AND ($5::boolean OR created_by=$6)
           RETURNING current_version`,
          [
            id,
            actor.companyId,
            nextVersion,
            input.expectedVersion,
            companyWide(context),
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!updated)
        throw new DomainError('conflict', 'Document was changed by another user; reload first');
      await tx.query(
        `INSERT INTO business_document_versions(
          tenant_id,document_id,version,content,change_summary,canonical_hash,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          actor.companyId,
          id,
          nextVersion,
          input.content,
          input.changeSummary,
          digest(input.content),
          actor.employeeId,
        ],
      );
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES('business-document.version-created','SUCCESS',$1,$2,'business-document',$3,$4,$5)`,
        [actor.employeeId, actor.companyId, id, correlationId, { version: nextVersion }],
      );
      return { id, currentVersion: nextVersion };
    });
  }
}
