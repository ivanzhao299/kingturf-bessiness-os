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
            WHERE v.tenant_id=d.tenant_id AND v.document_id=d.id),'[]'::jsonb)) item
         FROM business_documents d
         LEFT JOIN customers c ON c.id=d.customer_id AND c.tenant_id=d.tenant_id
         LEFT JOIN sales_orders o ON o.id=d.sales_order_id AND o.tenant_id=d.tenant_id
         LEFT JOIN employees op ON op.id=d.operator_id AND op.company_id=d.tenant_id
         LEFT JOIN employees sp ON sp.id=d.salesperson_id AND sp.company_id=d.tenant_id
         LEFT JOIN employees assignee ON assignee.id=d.assigned_to AND assignee.company_id=d.tenant_id
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
}
