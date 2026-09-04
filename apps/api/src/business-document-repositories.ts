import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor } from '@kingturf/domain';
import type { Database } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  includeAudit?: boolean;
}>;
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
          'customerId',d.customer_id,'customerName',c.name,
          'salesOrderId',d.sales_order_id,'salesOrderNumber',o.order_number,
          'operatorId',d.operator_id,'operatorName',op.display_name,
          'salespersonId',d.salesperson_id,'salespersonName',sp.display_name,
          'assignedTo',d.assigned_to,'assigneeName',assignee.display_name,
          'currentVersion',d.current_version,'createdBy',d.created_by,
          'createdAt',d.created_at,'updatedAt',d.updated_at) item
         FROM business_documents d
         LEFT JOIN customers c ON c.id=d.customer_id AND c.tenant_id=d.tenant_id
         LEFT JOIN sales_orders o ON o.id=d.sales_order_id AND o.tenant_id=d.tenant_id
         LEFT JOIN employees op ON op.id=d.operator_id AND op.company_id=d.tenant_id
         LEFT JOIN employees sp ON sp.id=d.salesperson_id AND sp.company_id=d.tenant_id
         LEFT JOIN employees assignee ON assignee.id=d.assigned_to AND assignee.company_id=d.tenant_id
         WHERE ${clauses.join(' AND ')}
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
          'customerId',d.customer_id,'customerName',c.name,
          'salesOrderId',d.sales_order_id,'salesOrderNumber',o.order_number,
          'operatorId',d.operator_id,'operatorName',op.display_name,
          'salespersonId',d.salesperson_id,'salespersonName',sp.display_name,
          'assignedTo',d.assigned_to,'assigneeName',assignee.display_name,
          'currentVersion',d.current_version,'createdBy',d.created_by,
          'createdAt',d.created_at,'updatedAt',d.updated_at,
          'reviewEvents',coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',e.id,'version',e.version,'action',e.action,'reason',e.reason,
            'actorId',e.actor_id,'createdAt',e.created_at) ORDER BY e.created_at DESC)
            FROM business_document_review_events e
            WHERE e.tenant_id=d.tenant_id AND e.document_id=d.id),'[]'::jsonb),
          'versions',coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',v.id,'version',v.version,'content',v.content,'changeSummary',v.change_summary,
            'canonicalHash',v.canonical_hash,'createdBy',v.created_by,'createdAt',v.created_at)
            ORDER BY v.version DESC) FROM business_document_versions v
            WHERE v.tenant_id=d.tenant_id AND v.document_id=d.id),'[]'::jsonb),
          'translations',coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',t.id,'sourceVersion',t.source_version,'targetLocale',t.target_locale,
            'provider',t.provider,'status',t.status,'content',t.content,
            'requestedBy',t.requested_by,'createdAt',t.created_at) ORDER BY t.created_at DESC)
            FROM business_document_translations t
            WHERE t.tenant_id=d.tenant_id AND t.document_id=d.id),'[]'::jsonb),
          'dispatches',coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',x.id,'documentVersion',x.document_version,'translationId',x.translation_id,
            'channel',x.channel,'recipientName',x.recipient_name,
            'recipientMasked',CASE WHEN length(x.recipient_address)<=4 THEN '***'
              ELSE left(x.recipient_address,2)||'***'||right(x.recipient_address,2) END,
            'subject',x.subject,'status',x.status,'requestedBy',x.requested_by,
            'requestedAt',x.requested_at,'deliveredAt',x.delivered_at)
            ORDER BY x.requested_at DESC) FROM business_document_dispatches x
            WHERE x.tenant_id=d.tenant_id AND x.document_id=d.id AND $5::boolean),'[]'::jsonb)) item
         FROM business_documents d
         LEFT JOIN customers c ON c.id=d.customer_id AND c.tenant_id=d.tenant_id
         LEFT JOIN sales_orders o ON o.id=d.sales_order_id AND o.tenant_id=d.tenant_id
         LEFT JOIN employees op ON op.id=d.operator_id AND op.company_id=d.tenant_id
         LEFT JOIN employees sp ON sp.id=d.salesperson_id AND sp.company_id=d.tenant_id
         LEFT JOIN employees assignee ON assignee.id=d.assigned_to AND assignee.company_id=d.tenant_id
         WHERE d.id=$1 AND d.tenant_id=$2 AND ($3::boolean OR d.created_by=$4)`,
        [
          id,
          context.actor.companyId,
          companyWide(context),
          context.actor.employeeId,
          context.includeAudit === true,
        ],
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
      customerId?: string;
      salesOrderId?: string;
      operatorId?: string;
      salespersonId?: string;
      assignedTo?: string;
      content: JsonObject;
    },
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const document = (
        await tx.query<{ id: string }>(
          `INSERT INTO business_documents(
            tenant_id,template_key,title,route,subject_type,subject_id,customer_id,sales_order_id,
            operator_id,salesperson_id,assigned_to,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            actor.companyId,
            input.templateKey,
            input.title,
            input.route,
            input.subjectType ?? null,
            input.subjectId ?? null,
            input.customerId ?? null,
            input.salesOrderId ?? null,
            input.operatorId ?? null,
            input.salespersonId ?? null,
            input.assignedTo ?? null,
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
        customerId: input.customerId,
        salesOrderId: input.salesOrderId,
        operatorId: input.operatorId,
        salespersonId: input.salespersonId,
        assignedTo: input.assignedTo,
        versions: [
          { version: 1, content: input.content, changeSummary: '从受控模板创建', canonicalHash },
        ],
      };
    });
  }

  public async referenceData(context: Context) {
    const [customers, orders, employees] = await Promise.all([
      this.db.query<{ id: string; name: string; number: string }>(
        `SELECT id,name,customer_number number FROM customers
         WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 300`,
        [context.actor.companyId],
      ),
      this.db.query<{ id: string; name: string; customerId: string }>(
        `SELECT id,order_number name,customer_id "customerId" FROM sales_orders
         WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 300`,
        [context.actor.companyId],
      ),
      this.db.query<{ id: string; name: string; number: string }>(
        `SELECT id,display_name name,employee_number number FROM employees
         WHERE company_id=$1 AND active AND deleted_at IS NULL ORDER BY display_name LIMIT 300`,
        [context.actor.companyId],
      ),
    ]);
    return { customers: customers.rows, orders: orders.rows, employees: employees.rows };
  }

  public async updateBindings(
    id: string,
    input: {
      customerId?: string | null | undefined;
      salesOrderId?: string | null | undefined;
      operatorId?: string | null | undefined;
      salespersonId?: string | null | undefined;
      assignedTo?: string | null | undefined;
    },
    context: Context,
    correlationId: string,
  ) {
    const updated = (
      await this.db.query<{ id: string }>(
        `UPDATE business_documents SET customer_id=$3,sales_order_id=$4,operator_id=$5,
           salesperson_id=$6,assigned_to=$7,updated_at=now()
         WHERE id=$1 AND tenant_id=$2 AND state IN ('DRAFT','REJECTED')
           AND ($8::boolean OR created_by=$9) RETURNING id`,
        [
          id,
          context.actor.companyId,
          input.customerId ?? null,
          input.salesOrderId ?? null,
          input.operatorId ?? null,
          input.salespersonId ?? null,
          input.assignedTo ?? null,
          companyWide(context),
          context.actor.employeeId,
        ],
      )
    ).rows[0];
    if (!updated)
      throw new DomainError('conflict', 'Document bindings cannot be changed in the current state');
    await this.db.query(
      `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
       VALUES('business-document.bindings-updated','SUCCESS',$1,$2,'business-document',$3,$4,$5)`,
      [context.actor.employeeId, context.actor.companyId, id, correlationId, input],
    );
    return { id, ...input };
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
           WHERE id=$1 AND tenant_id=$2 AND current_version=$4 AND state IN ('DRAFT','REJECTED')
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

  public transition(
    id: string,
    input: {
      expectedVersion: number;
      action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
      reason: string;
    },
    context: Context,
    correlationId: string,
  ) {
    const { actor } = context;
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:business-document:${id}`,
      ]);
      const document = (
        await tx.query<{ state: string; current_version: number; created_by: string }>(
          `SELECT state,current_version,created_by FROM business_documents
           WHERE id=$1 AND tenant_id=$2 AND ($3::boolean OR created_by=$4) FOR UPDATE`,
          [
            id,
            actor.companyId,
            input.action !== 'SUBMITTED' || companyWide(context),
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!document) throw new DomainError('not_found', 'Business document not found');
      if (document.current_version !== input.expectedVersion)
        throw new DomainError('conflict', 'Document version changed; reload first');
      const expectedState = input.action === 'SUBMITTED' ? ['DRAFT', 'REJECTED'] : ['IN_REVIEW'];
      if (!expectedState.includes(document.state))
        throw new DomainError('conflict', 'Document is not in the required review state');
      if (input.action !== 'SUBMITTED' && document.created_by === actor.employeeId)
        throw new DomainError(
          'forbidden',
          'Document author cannot approve or reject their own document',
        );
      const nextState =
        input.action === 'SUBMITTED'
          ? 'IN_REVIEW'
          : input.action === 'APPROVED'
            ? 'APPROVED'
            : 'REJECTED';
      await tx.query(
        'UPDATE business_documents SET state=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2',
        [id, actor.companyId, nextState],
      );
      await tx.query(
        `INSERT INTO business_document_review_events(
          tenant_id,document_id,version,action,reason,actor_id)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [actor.companyId, id, input.expectedVersion, input.action, input.reason, actor.employeeId],
      );
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES($1,'SUCCESS',$2,$3,'business-document',$4,$5,$6)`,
        [
          `business-document.${input.action.toLowerCase()}`,
          actor.employeeId,
          actor.companyId,
          id,
          correlationId,
          { version: input.expectedVersion, reason: input.reason },
        ],
      );
      return { id, state: nextState, currentVersion: input.expectedVersion };
    });
  }

  public async listConnectors(actor: Actor, includeConfiguration: boolean) {
    const rows = await this.db.query<{ item: JsonObject }>(
      `WITH supported(connector,label,default_provider) AS (VALUES
        ('EMAIL','电子邮件','RESEND'),
        ('WECHAT_WORK','企业微信 / 微信公众号','WECHAT_WORK_APP'),
        ('WHATSAPP_BUSINESS','WhatsApp Business','META_CLOUD_API'),
        ('MICROSOFT_TEAMS','Microsoft Teams','MICROSOFT_GRAPH'),
        ('TELEGRAM','Telegram','TELEGRAM_BOT'),
        ('LINE','LINE','LINE_MESSAGING_API'),
        ('TRANSLATION','在线文档翻译','DEEPL_OR_OPENAI_COMPATIBLE')
      ) SELECT jsonb_build_object(
        'connector',s.connector,'label',s.label,
        'provider',coalesce(c.provider,s.default_provider),
        'displayName',coalesce(c.display_name,s.label),
        'senderIdentity',c.sender_identity,'status',coalesce(c.status,'UNCONFIGURED'),
        'version',coalesce(c.version,0),'configuredAt',c.updated_at,
        'configuredBy',CASE WHEN $2 THEN c.configured_by ELSE NULL END,
        'configuration',CASE WHEN $2 THEN coalesce(c.configuration,'{}'::jsonb) ELSE '{}'::jsonb END,
        'secretReference',CASE WHEN $2 THEN c.secret_reference ELSE NULL END) item
       FROM supported s LEFT JOIN business_document_connectors c
         ON c.tenant_id=$1 AND c.connector=s.connector
       ORDER BY CASE s.connector WHEN 'EMAIL' THEN 1 WHEN 'WECHAT_WORK' THEN 2
         WHEN 'WHATSAPP_BUSINESS' THEN 3 WHEN 'MICROSOFT_TEAMS' THEN 4
         WHEN 'TELEGRAM' THEN 5 WHEN 'LINE' THEN 6 ELSE 7 END`,
      [actor.companyId, includeConfiguration],
    );
    return rows.rows.map((row) => row.item);
  }

  public configureConnector(
    connector: string,
    input: {
      provider: string;
      displayName: string;
      senderIdentity: string | null;
      secretReference: string | null;
      configuration: JsonObject;
      status: 'UNCONFIGURED' | 'READY' | 'DISABLED';
      expectedVersion: number;
    },
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query<{ item: JsonObject }>(
          `INSERT INTO business_document_connectors(
             tenant_id,connector,provider,display_name,sender_identity,secret_reference,
             configuration,status,configured_by)
           SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE $10=0
           ON CONFLICT(tenant_id,connector) DO UPDATE SET
             provider=excluded.provider,display_name=excluded.display_name,
             sender_identity=excluded.sender_identity,secret_reference=excluded.secret_reference,
             configuration=excluded.configuration,status=excluded.status,
             configured_by=excluded.configured_by,version=business_document_connectors.version+1,
             updated_at=now()
           WHERE business_document_connectors.version=$10
           RETURNING jsonb_build_object(
             'connector',connector,'provider',provider,'displayName',display_name,
             'senderIdentity',sender_identity,'secretReference',secret_reference,
             'configuration',configuration,'status',status,'version',version,
             'configuredAt',updated_at) item`,
          [
            actor.companyId,
            connector,
            input.provider,
            input.displayName,
            input.senderIdentity,
            input.secretReference,
            input.configuration,
            input.status,
            actor.employeeId,
            input.expectedVersion,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Connector configuration version is stale');
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES('business-document.connector-configured','SUCCESS',$1,$2,'business-document-connector',
           (SELECT id FROM business_document_connectors WHERE tenant_id=$2 AND connector=$3),$4,$5)`,
        [
          actor.employeeId,
          actor.companyId,
          connector,
          correlationId,
          { connector, provider: input.provider, status: input.status, version: row.item.version },
        ],
      );
      return row.item;
    });
  }

  public createTranslation(
    id: string,
    input: {
      expectedVersion: number;
      targetLocale: string;
      content?: JsonObject;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const source = (
        await tx.query<{ canonical_hash: string; state: string }>(
          `SELECT v.canonical_hash,d.state FROM business_documents d
           JOIN business_document_versions v ON v.tenant_id=d.tenant_id AND v.document_id=d.id
             AND v.version=$3
           WHERE d.id=$1 AND d.tenant_id=$2 AND d.current_version=$3
             AND ($4::boolean OR d.created_by=$5)`,
          [
            id,
            context.actor.companyId,
            input.expectedVersion,
            companyWide(context),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!source) throw new DomainError('conflict', 'Document version changed or is unavailable');
      const manual = input.content !== undefined;
      if (!manual) {
        const connector = (
          await tx.query(
            `SELECT id FROM business_document_connectors
             WHERE tenant_id=$1 AND connector='TRANSLATION' AND status='READY'`,
            [context.actor.companyId],
          )
        ).rows[0];
        if (!connector)
          throw new DomainError(
            'conflict',
            'Automatic translation is not configured; an administrator can enable a translation connector',
          );
      }
      const translation = (
        await tx.query<{ item: JsonObject }>(
          `INSERT INTO business_document_translations(
             tenant_id,document_id,source_version,source_hash,target_locale,provider,status,
             content,requested_by,correlation_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING jsonb_build_object('id',id,'sourceVersion',source_version,
             'targetLocale',target_locale,'provider',provider,'status',status,
             'content',content,'requestedBy',requested_by,'createdAt',created_at) item`,
          [
            context.actor.companyId,
            id,
            input.expectedVersion,
            source.canonical_hash,
            input.targetLocale,
            manual ? 'MANUAL' : 'CONNECTED_PROVIDER',
            manual ? 'READY' : 'QUEUED',
            input.content ?? null,
            context.actor.employeeId,
            correlationId,
          ],
        )
      ).rows[0];
      if (!translation) throw new Error('Business document translation insert failed');
      if (!manual) {
        await tx.query(
          `INSERT INTO domain_event_outbox(
             tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,
             occurred_at,actor_id,correlation_id,payload)
           VALUES($1,'business-document.translation.requested',1,'business-document-translation',$2,1,
             now(),$3,$4,jsonb_build_object('translationId',$2::uuid))`,
          [context.actor.companyId, translation.item.id, context.actor.employeeId, correlationId],
        );
      }
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES('business-document.translation-created','SUCCESS',$1,$2,'business-document',$3,$4,$5)`,
        [
          context.actor.employeeId,
          context.actor.companyId,
          id,
          correlationId,
          {
            version: input.expectedVersion,
            targetLocale: input.targetLocale,
            provider: manual ? 'MANUAL' : 'CONNECTED_PROVIDER',
            translationId: translation.item.id,
          },
        ],
      );
      return translation.item;
    });
  }

  public async recordClientActivity(
    id: string,
    action: 'PRINTED' | 'DOWNLOADED',
    version: number,
    context: Context,
    correlationId: string,
  ) {
    const document = (
      await this.db.query<{ id: string }>(
        `SELECT id FROM business_documents WHERE id=$1 AND tenant_id=$2
         AND current_version=$3 AND ($4::boolean OR created_by=$5)`,
        [id, context.actor.companyId, version, companyWide(context), context.actor.employeeId],
      )
    ).rows[0];
    if (!document) throw new DomainError('not_found', 'Business document not found');
    await this.db.query(
      `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
       VALUES($1,'SUCCESS',$2,$3,'business-document',$4,$5,$6)`,
      [
        `business-document.${action.toLowerCase()}`,
        context.actor.employeeId,
        context.actor.companyId,
        id,
        correlationId,
        { version },
      ],
    );
    return { id, action, version };
  }

  public dispatch(
    id: string,
    input: {
      expectedVersion: number;
      channel: string;
      recipientName: string;
      recipientAddress: string;
      subject: string;
      message: string;
      translationId?: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const requestHash = digest({
        id,
        version: input.expectedVersion,
        channel: input.channel,
        recipientName: input.recipientName,
        recipientAddress: input.recipientAddress,
        subject: input.subject,
        message: input.message,
        translationId: input.translationId ?? null,
      });
      const existing = (
        await tx.query<{ item: JsonObject; request_hash: string }>(
          `SELECT request_hash,jsonb_build_object('id',id,'documentVersion',document_version,
             'translationId',translation_id,'channel',channel,'recipientName',recipient_name,
             'recipientMasked',CASE WHEN length(recipient_address)<=4 THEN '***'
               ELSE left(recipient_address,2)||'***'||right(recipient_address,2) END,
             'subject',subject,'status',status,'requestedAt',requested_at) item
           FROM business_document_dispatches WHERE tenant_id=$1 AND idempotency_key=$2`,
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        if (existing.request_hash !== requestHash)
          throw new DomainError('conflict', 'Idempotency key was used for another document send');
        return existing.item;
      }
      const document = (
        await tx.query<{ id: string }>(
          `SELECT id FROM business_documents WHERE id=$1 AND tenant_id=$2
           AND current_version=$3 AND state='APPROVED' AND customer_id IS NOT NULL
           AND ($4::boolean OR created_by=$5) FOR UPDATE`,
          [
            id,
            context.actor.companyId,
            input.expectedVersion,
            companyWide(context),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!document)
        throw new DomainError(
          'conflict',
          'Only the current approved version of a customer-bound document can be sent',
        );
      const connector = (
        await tx.query<{ id: string }>(
          `SELECT id FROM business_document_connectors
           WHERE tenant_id=$1 AND connector=$2 AND status='READY'`,
          [context.actor.companyId, input.channel],
        )
      ).rows[0];
      if (!connector)
        throw new DomainError(
          'conflict',
          'This delivery channel is not configured; ask an administrator to enable it',
        );
      if (input.translationId) {
        const translation = (
          await tx.query(
            `SELECT id FROM business_document_translations
             WHERE id=$1 AND tenant_id=$2 AND document_id=$3 AND source_version=$4 AND status='READY'`,
            [input.translationId, context.actor.companyId, id, input.expectedVersion],
          )
        ).rows[0];
        if (!translation)
          throw new DomainError('conflict', 'Selected translation is not ready for this version');
      }
      const dispatch = (
        await tx.query<{ item: JsonObject }>(
          `INSERT INTO business_document_dispatches(
             tenant_id,document_id,document_version,translation_id,connector_id,channel,
             recipient_name,recipient_address,recipient_hash,subject,message,request_hash,
             idempotency_key,requested_by,correlation_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING jsonb_build_object('id',id,'documentVersion',document_version,
             'translationId',translation_id,'channel',channel,'recipientName',recipient_name,
             'recipientMasked',CASE WHEN length(recipient_address)<=4 THEN '***'
               ELSE left(recipient_address,2)||'***'||right(recipient_address,2) END,
             'subject',subject,'status',status,'requestedAt',requested_at) item`,
          [
            context.actor.companyId,
            id,
            input.expectedVersion,
            input.translationId ?? null,
            connector.id,
            input.channel,
            input.recipientName,
            input.recipientAddress,
            digest(input.recipientAddress.trim().toLowerCase()),
            input.subject,
            input.message,
            requestHash,
            input.idempotencyKey,
            context.actor.employeeId,
            correlationId,
          ],
        )
      ).rows[0];
      if (!dispatch) throw new Error('Business document dispatch insert failed');
      await tx.query(
        `INSERT INTO domain_event_outbox(
           tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,
           occurred_at,actor_id,correlation_id,payload)
         VALUES($1,'business-document.dispatch.requested',1,'business-document-dispatch',$2,1,
           now(),$3,$4,jsonb_build_object('dispatchId',$2::uuid,'channel',$5::text))`,
        [
          context.actor.companyId,
          dispatch.item.id,
          context.actor.employeeId,
          correlationId,
          input.channel,
        ],
      );
      await tx.query(
        `INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata)
         VALUES('business-document.send-requested','SUCCESS',$1,$2,'business-document',$3,$4,$5)`,
        [
          context.actor.employeeId,
          context.actor.companyId,
          id,
          correlationId,
          {
            version: input.expectedVersion,
            channel: input.channel,
            recipientHash: digest(input.recipientAddress.trim().toLowerCase()),
            dispatchId: dispatch.item.id,
            translationId: input.translationId ?? null,
          },
        ],
      );
      return dispatch.item;
    });
  }

  public async activityLog(
    actor: Actor,
    filter: { documentId?: string; actorId?: string; limit?: number },
  ) {
    const values: unknown[] = [actor.companyId];
    const clauses = ['a.organization_id=$1', "a.action LIKE 'business-document.%'"];
    if (filter.documentId) {
      values.push(filter.documentId);
      clauses.push(`a.target_id=$${String(values.length)}`);
    }
    if (filter.actorId) {
      values.push(filter.actorId);
      clauses.push(`a.actor_id=$${String(values.length)}`);
    }
    values.push(Math.min(Math.max(filter.limit ?? 100, 1), 200));
    const rows = await this.db.query<{ item: JsonObject }>(
      `SELECT jsonb_build_object(
         'id',a.id,'occurredAt',a.occurred_at,'action',a.action,'outcome',a.outcome,
         'actorId',a.actor_id,'actorName',e.display_name,'targetType',a.target_type,
         'targetId',a.target_id,'correlationId',a.correlation_id,'metadata',a.metadata,
         'documentTitle',d.title) item
       FROM audit_events a
       LEFT JOIN employees e ON e.id=a.actor_id AND e.company_id=a.organization_id
       LEFT JOIN business_documents d ON d.id=a.target_id AND d.tenant_id=a.organization_id
       WHERE ${clauses.join(' AND ')} ORDER BY a.occurred_at DESC,a.id DESC
       LIMIT $${String(values.length)}`,
      values,
    );
    return rows.rows.map((row) => row.item);
  }
}
