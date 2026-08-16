import { createHash } from 'node:crypto';
/* eslint-disable @typescript-eslint/no-non-null-assertion -- INSERT/aggregate RETURNING rows are transaction invariants. */
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const scope = (context: Context, alias = 'c', offset = 2) => {
  const clauses: string[] = [];
  const values: string[] = [];
  if (context.scopes.includes('COMPANY') || context.scopes.includes('GROUP')) clauses.push('TRUE');
  if (context.scopes.includes('SELF'))
    clauses.push(
      `${alias}.owner_id=$${String(offset + values.push(context.actor.employeeId) - 1)}`,
    );
  for (const anchor of context.anchors)
    if (anchor.organizationId && context.scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.length - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};
const requireCustomer = async (tx: SqlClient, customerId: string, context: Context) => {
  const secured = scope(context, 'c', 3);
  const found = await tx.query(
    `SELECT 1 FROM customers c WHERE c.id=$1 AND c.tenant_id=$2 AND c.deleted_at IS NULL AND ${secured.sql}`,
    [customerId, context.actor.companyId, ...secured.values],
  );
  if (!found.rowCount) throw new DomainError('not_found', 'Customer not found');
};
const evidence = async (
  tx: SqlClient,
  action: string,
  aggregate: string,
  id: string,
  version: number,
  actor: Actor,
  correlationId: string,
  payload: JsonObject,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, aggregate, id, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [actor.companyId, action, aggregate, id, version, actor.employeeId, correlationId, payload],
  );
};
const command = async <T extends JsonObject>(
  tx: SqlClient,
  key: string,
  type: string,
  subject: string,
  actor: Actor,
  input: unknown,
  authorize: () => Promise<void>,
  work: () => Promise<T>,
): Promise<T> => {
  const requestHash = hash(input);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${actor.companyId}:${key}`,
  ]);
  // Authorization is deliberately re-evaluated before looking up a replay. A
  // previously valid idempotency result must not bypass a revoked DataScope.
  await authorize();
  const prior = (
    await tx.query<{
      command_type: string;
      subject_id: string;
      actor_id: string;
      request_hash: string;
      payload: T;
    }>(
      'SELECT command_type,subject_id,actor_id,request_hash,payload FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
      [actor.companyId, key],
    )
  ).rows[0];
  if (prior) {
    if (
      prior.command_type !== type ||
      prior.subject_id !== subject ||
      prior.actor_id !== actor.employeeId ||
      prior.request_hash !== requestHash
    )
      throw new DomainError('conflict', 'Idempotency key is bound to another command');
    return prior.payload;
  }
  const result = await work();
  await tx.query(
    'INSERT INTO commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [actor.companyId, key, type, subject, actor.employeeId, requestHash, result],
  );
  return result;
};

export class PostgresQuoteToCashRepository {
  public constructor(private readonly db: Db) {}

  public setCreditLimit(
    input: {
      customerId: string;
      currency: string;
      amount: string;
      effectiveAt: string;
      expiresAt: string;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'CREDIT_LIMIT_SET',
        input.customerId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          const row = (
            await tx.query<{ id: string }>(
              'INSERT INTO credit_limits(tenant_id,customer_id,currency,amount,effective_at,expires_at,actor_id,canonical_input,canonical_hash,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                input.currency,
                input.amount,
                input.effectiveAt,
                input.expiresAt,
                context.actor.employeeId,
                input,
                hash(input),
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const result = json({ id: row.id, ...input });
          await evidence(
            tx,
            'credit-limit.set',
            'credit-limit',
            row.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public async list(
    view: 'limits' | 'credit' | 'contracts' | 'orders' | 'ar' | 'payments' | 'reconciliation',
    context: Context,
  ) {
    const secured = scope(context, 'c', 2);
    const queries = {
      limits: `SELECT to_jsonb(l) AS item FROM credit_limits l JOIN customers c ON c.id=l.customer_id AND c.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND ${secured.sql} ORDER BY l.effective_at DESC,l.id`,
      credit: `SELECT to_jsonb(d) AS item FROM effective_credit_decisions d JOIN customers c ON c.id=d.customer_id AND c.tenant_id=d.tenant_id WHERE d.tenant_id=$1 AND ${secured.sql} ORDER BY d.created_at DESC,d.id`,
      contracts: `SELECT to_jsonb(r)||jsonb_build_object('customerId',c.customer_id,'opportunityId',c.opportunity_id,'contractNumber',c.contract_number,'effectiveStatus',CASE WHEN EXISTS(SELECT 1 FROM contract_signature_evidence sx WHERE sx.tenant_id=r.tenant_id AND sx.contract_revision_id=r.id) THEN 'SIGNED' ELSE 'DRAFT' END,'signatureEvidenceId',(SELECT sx.id FROM contract_signature_evidence sx WHERE sx.tenant_id=r.tenant_id AND sx.contract_revision_id=r.id ORDER BY sx.signed_at DESC LIMIT 1)) AS item FROM contract_revisions r JOIN contracts c ON c.id=r.contract_id AND c.tenant_id=r.tenant_id JOIN customers cu ON cu.id=c.customer_id AND cu.tenant_id=c.tenant_id WHERE r.tenant_id=$1 AND ${secured.sql.replaceAll('c.', 'cu.')} ORDER BY r.created_at DESC,r.id`,
      orders: `SELECT to_jsonb(o) AS item FROM sales_orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND ${secured.sql} ORDER BY o.created_at DESC,o.id`,
      ar: `SELECT to_jsonb(b) AS item FROM ar_open_item_balances b JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND ${secured.sql} ORDER BY b.due_at,b.id`,
      payments: `SELECT to_jsonb(b) AS item FROM bank_payment_balances b JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND ${secured.sql} ORDER BY b.received_at,b.id`,
      reconciliation: `SELECT to_jsonb(r) AS item FROM reconciliation_runs r JOIN bank_payments p ON p.id=(r.input->>'paymentId')::uuid AND p.tenant_id=r.tenant_id JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id WHERE r.tenant_id=$1 AND ${secured.sql} ORDER BY r.created_at DESC,r.id`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [
        context.actor.companyId,
        ...secured.values,
      ])
    ).rows.map((r) => r.item);
  }

  public evaluateCredit(
    input: {
      customerId: string;
      quoteRevisionId: string;
      quoteSnapshotId: string;
      creditLimitId: string;
      validUntil: string;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'CREDIT_EVALUATE',
        input.quoteRevisionId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          // Serialize credit evaluation with ledger postings for this customer.
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${context.actor.companyId}:${input.customerId}:credit-ledger`,
          ]);
          const base = (
            await tx.query<{ total: string; currency: string; limit_amount: string }>(
              `SELECT qr.total,qr.currency,cl.amount AS limit_amount FROM quote_revisions qr JOIN quotes q ON q.id=qr.quote_id AND q.tenant_id=qr.tenant_id JOIN opportunities o ON o.id=q.opportunity_id AND o.tenant_id=q.tenant_id JOIN quote_issued_snapshots qs ON qs.id=$3 AND qs.tenant_id=qr.tenant_id AND qs.quote_revision_id=qr.id JOIN credit_limits cl ON cl.id=$4 AND cl.tenant_id=qr.tenant_id AND cl.customer_id=$1 AND cl.currency=qr.currency AND cl.effective_at<=now() AND cl.expires_at>now() WHERE qr.id=$2 AND qr.tenant_id=$5 AND o.customer_id=$1 AND qr.status='ISSUED' AND qr.valid_until>now() AND $6::timestamptz<=qr.valid_until AND $6::timestamptz<=cl.expires_at`,
              [
                input.customerId,
                input.quoteRevisionId,
                input.quoteSnapshotId,
                input.creditLimitId,
                context.actor.companyId,
                input.validUntil,
              ],
            )
          ).rows[0];
          if (!base)
            throw new DomainError(
              'conflict',
              'Quote, customer, snapshot, currency, or credit limit is invalid',
            );
          const amounts = (
            await tx.query<{
              receivable: string;
              orders: string;
              payments: string;
              exposure: string;
            }>(
              `SELECT greatest(0,coalesce((SELECT sum(CASE WHEN d.document_type='INVOICE' THEN b.remaining_amount ELSE -b.remaining_amount END) FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.customer_id=$2 AND b.currency=$3),0))::numeric(24,6) receivable,coalesce((SELECT sum(o.total-coalesce((SELECT sum(d.amount) FROM ar_documents d WHERE d.tenant_id=o.tenant_id AND d.sales_order_id=o.id AND d.document_type='INVOICE'),0)) FROM sales_orders o WHERE o.tenant_id=$1 AND o.customer_id=$2 AND o.currency=$3 AND o.status='RELEASED'),0)::numeric(24,6) orders,coalesce((SELECT sum(b.remaining_amount) FROM bank_payment_balances b WHERE b.tenant_id=$1 AND b.customer_id=$2 AND b.currency=$3),0)::numeric(24,6) payments`,
              [context.actor.companyId, input.customerId, base.currency],
            )
          ).rows[0]!;
          const exposure = (
            await tx.query<{ v: string }>(
              'SELECT greatest(0,$1::numeric+$2::numeric-$3::numeric)::numeric(24,6) v',
              [amounts.receivable, amounts.orders, amounts.payments],
            )
          ).rows[0]!.v;
          const snapshotInput = {
            customerId: input.customerId,
            currency: base.currency,
            receivableAmount: amounts.receivable,
            uninvoicedOrderAmount: amounts.orders,
            unappliedPaymentAmount: amounts.payments,
          };
          const snapshot = (
            await tx.query<{ id: string }>(
              'INSERT INTO credit_exposure_snapshots(tenant_id,customer_id,currency,receivable_amount,uninvoiced_order_amount,unapplied_payment_amount,exposure_amount,canonical_input,calculation_trace,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                base.currency,
                amounts.receivable,
                amounts.orders,
                amounts.payments,
                exposure,
                snapshotInput,
                hash(snapshotInput),
                context.actor.employeeId,
                correlationId,
                `${key}:exposure`,
              ],
            )
          ).rows[0]!;
          const eligible = (
            await tx.query<{ ok: boolean }>('SELECT $1::numeric+$2::numeric<=$3::numeric ok', [
              exposure,
              base.total,
              base.limit_amount,
            ])
          ).rows[0]!.ok;
          const version = (
            await tx.query<{ v: number }>(
              'SELECT coalesce(max(version),0)+1 v FROM credit_decisions WHERE tenant_id=$1 AND customer_id=$2 AND quote_revision_id=$3',
              [context.actor.companyId, input.customerId, input.quoteRevisionId],
            )
          ).rows[0]!.v;
          const decisionInput = {
            ...input,
            requestedAmount: base.total,
            exposureSnapshotId: snapshot.id,
            exposureAmount: exposure,
            creditLimit: base.limit_amount,
          };
          const decision = (
            await tx.query<{ id: string }>(
              "INSERT INTO credit_decisions(tenant_id,customer_id,quote_revision_id,quote_snapshot_id,exposure_snapshot_id,credit_limit_id,version,status,requested_amount,currency,approval_required,valid_until,canonical_input,calculation_trace,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING_APPROVAL',$8,$9,true,$10,$11,$11,$12,$13,$14,$15) RETURNING id",
              [
                context.actor.companyId,
                input.customerId,
                input.quoteRevisionId,
                input.quoteSnapshotId,
                snapshot.id,
                input.creditLimitId,
                version,
                base.total,
                base.currency,
                input.validUntil,
                decisionInput,
                hash(decisionInput),
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const result = json({
            id: decision.id,
            version,
            effectiveStatus: 'PENDING_APPROVAL',
            eligible,
            exposureSnapshotId: snapshot.id,
            exposureAmount: exposure,
            requestedAmount: base.total,
            creditLimit: base.limit_amount,
            currency: base.currency,
          });
          await evidence(
            tx,
            'credit.evaluated',
            'credit-decision',
            decision.id,
            version,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public approveCredit(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'CREDIT_APPROVE',
        id,
        context.actor,
        { decision, reason },
        async () => {
          const secured = await tx.query<{ customer_id: string }>(
            'SELECT customer_id FROM credit_decisions WHERE id=$1 AND tenant_id=$2',
            [id, context.actor.companyId],
          );
          if (!secured.rows[0]) throw new DomainError('not_found', 'Credit decision not found');
          await requireCustomer(tx, secured.rows[0].customer_id, context);
        },
        async () => {
          const row = (
            await tx.query<{ customer_id: string; version: number }>(
              'SELECT customer_id,version FROM credit_decisions WHERE id=$1 AND tenant_id=$2 FOR SHARE',
              [id, context.actor.companyId],
            )
          ).rows[0];
          if (!row) throw new DomainError('not_found', 'Credit decision not found');
          await requireCustomer(tx, row.customer_id, context);
          await tx.query(
            'INSERT INTO credit_approvals(tenant_id,credit_decision_id,decision,reason,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              context.actor.companyId,
              id,
              decision,
              reason,
              context.actor.employeeId,
              correlationId,
              key,
              hash({ id, decision, reason }),
            ],
          );
          const result = json({ id, effectiveStatus: decision });
          await evidence(
            tx,
            'credit.decided',
            'credit-decision',
            id,
            row.version,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public createContract(
    input: {
      customerId: string;
      opportunityId: string;
      contractNumber: string;
      quoteRevisionId: string;
      quoteSnapshotId: string;
      content: JsonObject;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'CONTRACT_REVISE',
        input.opportunityId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          const valid = await tx.query(
            "SELECT 1 FROM quote_revisions qr JOIN quotes q ON q.id=qr.quote_id AND q.tenant_id=qr.tenant_id JOIN opportunities o ON o.id=q.opportunity_id AND o.tenant_id=q.tenant_id JOIN quote_issued_snapshots s ON s.quote_revision_id=qr.id AND s.id=$2 AND s.tenant_id=qr.tenant_id WHERE qr.id=$1 AND qr.tenant_id=$3 AND qr.status='ISSUED' AND o.id=$4 AND o.customer_id=$5",
            [
              input.quoteRevisionId,
              input.quoteSnapshotId,
              context.actor.companyId,
              input.opportunityId,
              input.customerId,
            ],
          );
          if (!valid.rowCount)
            throw new DomainError(
              'conflict',
              'Contract pins do not belong to customer opportunity',
            );
          const contract = (
            await tx.query<{ id: string }>(
              'INSERT INTO contracts(tenant_id,customer_id,opportunity_id,contract_number,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                input.opportunityId,
                input.contractNumber,
                context.actor.employeeId,
              ],
            )
          ).rows[0]!;
          const revision = (
            await tx.query<{ id: string }>(
              'INSERT INTO contract_revisions(tenant_id,contract_id,revision,quote_revision_id,quote_snapshot_id,content,content_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
              [
                context.actor.companyId,
                contract.id,
                input.quoteRevisionId,
                input.quoteSnapshotId,
                input.content,
                hash(input.content),
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const result = json({
            id: revision.id,
            contractId: contract.id,
            revision: 1,
            status: 'DRAFT',
            contentHash: hash(input.content),
          });
          await evidence(
            tx,
            'contract.revised',
            'contract',
            contract.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public signContract(
    id: string,
    input: { provider: string; providerReceiptId: string; payload: JsonObject; signedAt: string },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'CONTRACT_SIGN',
        id,
        context.actor,
        input,
        async () => {
          const secured = await tx.query<{ customer_id: string }>(
            'SELECT c.customer_id FROM contract_revisions r JOIN contracts c ON c.id=r.contract_id AND c.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2',
            [id, context.actor.companyId],
          );
          if (!secured.rows[0]) throw new DomainError('not_found', 'Contract revision not found');
          await requireCustomer(tx, secured.rows[0].customer_id, context);
        },
        async () => {
          const row = (
            await tx.query<{ contract_id: string; revision: number; customer_id: string }>(
              "SELECT r.contract_id,r.revision,c.customer_id FROM contract_revisions r JOIN contracts c ON c.id=r.contract_id AND c.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2 AND r.status='DRAFT' AND NOT EXISTS(SELECT 1 FROM contract_signature_evidence s WHERE s.tenant_id=r.tenant_id AND s.contract_revision_id=r.id) FOR UPDATE OF r",
              [id, context.actor.companyId],
            )
          ).rows[0];
          if (!row) throw new DomainError('not_found', 'Unsigned contract revision not found');
          await requireCustomer(tx, row.customer_id, context);
          const signed = (
            await tx.query<{ id: string }>(
              'INSERT INTO contract_signature_evidence(tenant_id,contract_revision_id,provider,provider_receipt_id,payload,payload_hash,signed_at,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
              [
                context.actor.companyId,
                id,
                input.provider,
                input.providerReceiptId,
                input.payload,
                hash(input.payload),
                input.signedAt,
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const result = json({
            id: signed.id,
            contractRevisionId: id,
            status: 'SIGNED',
            payloadHash: hash(input.payload),
          });
          await evidence(
            tx,
            'contract.signed',
            'contract',
            row.contract_id,
            row.revision,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public createOrder(
    input: {
      customerId: string;
      opportunityId: string;
      orderNumber: string;
      quoteRevisionId: string;
      quoteSnapshotId: string;
      creditDecisionId: string;
      contractRevisionId: string;
      signatureEvidenceId: string;
      currency: string;
      total: string;
      lines: readonly { description: string; quantity: string; unitPrice: string; total: string }[];
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'SALES_ORDER_RELEASE',
        input.opportunityId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${context.actor.companyId}:${input.customerId}:credit-ledger`,
          ]);
          const order = (
            await tx.query<{ id: string }>(
              'INSERT INTO sales_orders(tenant_id,customer_id,opportunity_id,order_number,quote_revision_id,quote_snapshot_id,credit_decision_id,contract_revision_id,signature_evidence_id,currency,total,canonical_input,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                input.opportunityId,
                input.orderNumber,
                input.quoteRevisionId,
                input.quoteSnapshotId,
                input.creditDecisionId,
                input.contractRevisionId,
                input.signatureEvidenceId,
                input.currency,
                input.total,
                input,
                hash(input),
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          for (const [index, line] of input.lines.entries())
            await tx.query(
              'INSERT INTO sales_order_lines(tenant_id,sales_order_id,line_number,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5,$6,$7)',
              [
                context.actor.companyId,
                order.id,
                index + 1,
                line.description,
                line.quantity,
                line.unitPrice,
                line.total,
              ],
            );
          const result = json({ id: order.id, status: 'RELEASED', ...input });
          await evidence(
            tx,
            'sales-order.released',
            'sales-order',
            order.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public postAr(
    input: {
      customerId: string;
      salesOrderId: string | null;
      documentNumber: string;
      documentType: 'INVOICE' | 'CREDIT_NOTE';
      currency: string;
      amount: string;
      dueAt: string;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'AR_POST',
        input.customerId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${context.actor.companyId}:${input.customerId}:credit-ledger`,
          ]);
          const doc = (
            await tx.query<{ id: string }>(
              'INSERT INTO ar_documents(tenant_id,customer_id,sales_order_id,document_number,document_type,currency,amount,due_at,canonical_input,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                input.salesOrderId,
                input.documentNumber,
                input.documentType,
                input.currency,
                input.amount,
                input.dueAt,
                input,
                hash(input),
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const item = (
            await tx.query<{ id: string }>(
              'INSERT INTO ar_open_items(tenant_id,ar_document_id,customer_id,currency,original_amount,due_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
              [
                context.actor.companyId,
                doc.id,
                input.customerId,
                input.currency,
                input.amount,
                input.dueAt,
              ],
            )
          ).rows[0]!;
          const result = json({
            id: item.id,
            arDocumentId: doc.id,
            remainingAmount: input.amount,
            ...input,
          });
          await evidence(
            tx,
            'ar.posted',
            'ar-document',
            doc.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public intakePayment(
    input: {
      customerId: string;
      currency: string;
      amount: string;
      receivedAt: string;
      bankReference: string;
      rawPayload: JsonObject;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'BANK_PAYMENT_INTAKE',
        input.customerId,
        context.actor,
        input,
        () => requireCustomer(tx, input.customerId, context),
        async () => {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${context.actor.companyId}:${input.customerId}:credit-ledger`,
          ]);
          const payment = (
            await tx.query<{ id: string }>(
              'INSERT INTO bank_payments(tenant_id,customer_id,currency,amount,received_at,bank_reference,raw_payload,raw_payload_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
              [
                context.actor.companyId,
                input.customerId,
                input.currency,
                input.amount,
                input.receivedAt,
                input.bankReference,
                input.rawPayload,
                hash(input.rawPayload),
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          const result = json({
            id: payment.id,
            remainingAmount: input.amount,
            rawPayloadHash: hash(input.rawPayload),
            ...input,
          });
          await evidence(
            tx,
            'bank-payment.received',
            'bank-payment',
            payment.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }

  public reconcile(
    input: { paymentId: string },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction((tx) =>
      command(
        tx,
        key,
        'RECONCILIATION_RUN',
        input.paymentId,
        context.actor,
        input,
        async () => {
          const secured = await tx.query<{ customer_id: string | null }>(
            'SELECT customer_id FROM bank_payments WHERE id=$1 AND tenant_id=$2',
            [input.paymentId, context.actor.companyId],
          );
          if (!secured.rows[0]?.customer_id)
            throw new DomainError('not_found', 'Payment not found');
          await requireCustomer(tx, secured.rows[0].customer_id, context);
        },
        async () => {
          const payment = (
            await tx.query<{ customer_id: string; currency: string; remaining_amount: string }>(
              'SELECT p.customer_id,p.currency,p.amount-coalesce((SELECT sum(a.amount) FROM allocation_entries a WHERE a.tenant_id=p.tenant_id AND a.bank_payment_id=p.id),0) AS remaining_amount FROM bank_payments p WHERE p.id=$1 AND p.tenant_id=$2 FOR UPDATE OF p',
              [input.paymentId, context.actor.companyId],
            )
          ).rows[0];
          if (!payment?.customer_id) throw new DomainError('not_found', 'Payment not found');
          await requireCustomer(tx, payment.customer_id, context);
          const items = (
            await tx.query<{ id: string; remaining_amount: string }>(
              "SELECT oi.id,oi.original_amount-coalesce((SELECT sum(a.amount) FROM allocation_entries a WHERE a.tenant_id=oi.tenant_id AND a.ar_open_item_id=oi.id),0) AS remaining_amount FROM ar_open_items oi JOIN ar_documents d ON d.id=oi.ar_document_id AND d.tenant_id=oi.tenant_id AND d.document_type='INVOICE' WHERE oi.tenant_id=$1 AND oi.customer_id=$2 AND oi.currency=$3 AND oi.original_amount-coalesce((SELECT sum(a.amount) FROM allocation_entries a WHERE a.tenant_id=oi.tenant_id AND a.ar_open_item_id=oi.id),0)>0 ORDER BY oi.due_at,oi.created_at,oi.id FOR UPDATE OF oi",
              [context.actor.companyId, payment.customer_id, payment.currency],
            )
          ).rows;
          let remaining = payment.remaining_amount;
          const allocations: { openItemId: string; amount: string; order: number }[] = [];
          for (const item of items) {
            const amount = (
              await tx.query<{ v: string }>(
                'SELECT least($1::numeric,$2::numeric)::numeric(24,6) v',
                [remaining, item.remaining_amount],
              )
            ).rows[0]!.v;
            if (Number(amount) <= 0) break;
            allocations.push({ openItemId: item.id, amount, order: allocations.length + 1 });
            remaining = (
              await tx.query<{ v: string }>('SELECT ($1::numeric-$2::numeric)::numeric(24,6) v', [
                remaining,
                amount,
              ])
            ).rows[0]!.v;
          }
          const trace = {
            algorithm: 'due_at,created_at,id',
            paymentId: input.paymentId,
            allocations,
          };
          const ledgerState = {
            paymentRemaining: payment.remaining_amount,
            candidates: items.map((item) => ({ id: item.id, remaining: item.remaining_amount })),
          };
          const resultHash = hash(trace);
          const run = (
            await tx.query<{ id: string }>(
              'INSERT INTO reconciliation_runs(tenant_id,status,input,calculation_trace,input_hash,result_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
              [
                context.actor.companyId,
                allocations.length ? 'COMPLETED' : 'NO_MATCH',
                input,
                trace,
                hash({ ...input, ledgerState }),
                resultHash,
                context.actor.employeeId,
                correlationId,
                key,
              ],
            )
          ).rows[0]!;
          for (const a of allocations)
            await tx.query(
              'INSERT INTO allocation_entries(tenant_id,reconciliation_run_id,bank_payment_id,ar_open_item_id,currency,amount,allocation_order,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
              [
                context.actor.companyId,
                run.id,
                input.paymentId,
                a.openItemId,
                payment.currency,
                a.amount,
                a.order,
                hash(a),
                context.actor.employeeId,
                correlationId,
                `${key}:${String(a.order)}`,
              ],
            );
          const result = json({
            id: run.id,
            status: allocations.length ? 'COMPLETED' : 'NO_MATCH',
            resultHash,
            remainingAmount: remaining,
            allocations,
          });
          await evidence(
            tx,
            'reconciliation.completed',
            'reconciliation-run',
            run.id,
            1,
            context.actor,
            correlationId,
            result,
          );
          return result;
        },
      ),
    );
  }
}
