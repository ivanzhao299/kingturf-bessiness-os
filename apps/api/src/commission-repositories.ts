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
type CommissionState = 'ACCRUED' | 'FROZEN' | 'RELEASED' | 'PAID' | 'CLAWED_BACK' | 'CANCELLED';
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const customerScope = (context: Context, alias = 'cu', offset = 2) => {
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

const recordEvidence = async (
  tx: SqlClient,
  action: string,
  targetType: string,
  targetId: string,
  version: number,
  actor: Actor,
  correlationId: string,
  payload: JsonObject,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, targetType, targetId, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [
      actor.companyId,
      action,
      targetType,
      targetId,
      version,
      actor.employeeId,
      correlationId,
      payload,
    ],
  );
};

export class PostgresCommissionRepository {
  public constructor(private readonly db: Db) {}

  public async listPolicies(context: Context) {
    if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP')) return [];
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(v)||jsonb_build_object('policyId',p.id,'code',p.code,'name',p.name,'applicability',p.applicability) AS item
         FROM commission_policy_versions v JOIN commission_policies p ON p.id=v.policy_id AND p.tenant_id=v.tenant_id
         WHERE v.tenant_id=$1 ORDER BY p.code,v.version DESC`,
        [context.actor.companyId],
      )
    ).rows.map((row) => row.item);
  }

  public createPolicy(
    input: {
      code: string;
      name: string;
      applicability: JsonObject;
      baseRateBasisPoints: number;
      minimumMarginBasisPoints: number;
      releaseCollectionBasisPoints: number;
      effectiveAt: string;
      rules: JsonObject[];
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
        throw new DomainError('forbidden', 'Commission policy management requires company scope');
      const policy = (
        await tx.query<{ id: string }>(
          'INSERT INTO commission_policies(tenant_id,code,name,applicability,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [
            context.actor.companyId,
            input.code,
            input.name,
            input.applicability,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!policy) throw new Error('Commission policy insert returned no row');
      const canonical = {
        baseRateBasisPoints: input.baseRateBasisPoints,
        minimumMarginBasisPoints: input.minimumMarginBasisPoints,
        releaseCollectionBasisPoints: input.releaseCollectionBasisPoints,
        effectiveAt: input.effectiveAt,
        rules: input.rules,
      };
      const version = (
        await tx.query<{ id: string }>(
          `INSERT INTO commission_policy_versions(tenant_id,policy_id,version,base_rate_basis_points,minimum_margin_basis_points,release_collection_basis_points,effective_at,rules,canonical_hash,created_by)
           VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            context.actor.companyId,
            policy.id,
            input.baseRateBasisPoints,
            input.minimumMarginBasisPoints,
            input.releaseCollectionBasisPoints,
            input.effectiveAt,
            JSON.stringify(input.rules),
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('Commission policy version insert returned no row');
      if (input.publish)
        await tx.query(
          "UPDATE commission_policy_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2",
          [version.id, context.actor.companyId],
        );
      const result = json({
        id: version.id,
        policyId: policy.id,
        version: 1,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        code: input.code,
        name: input.name,
        ...canonical,
        canonicalHash: hash(canonical),
      });
      await recordEvidence(
        tx,
        'commission-policy.created',
        'commission-policy',
        policy.id,
        1,
        context.actor,
        correlationId,
        result,
      );
      return result;
    });
  }

  public async listCases(context: Context) {
    const secured = customerScope(context, 'cu', 2);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(c)||jsonb_build_object(
           'orderNumber',o.order_number,'beneficiaryName',e.display_name,'policyCode',p.code,
           'policyVersion',v.version,'ledger',coalesce((SELECT jsonb_agg(to_jsonb(le) ORDER BY le.sequence)
             FROM commission_ledger_entries le WHERE le.tenant_id=c.tenant_id AND le.commission_case_id=c.id),'[]'::jsonb)) AS item
         FROM effective_commission_cases c
         JOIN sales_orders o ON o.id=c.sales_order_id AND o.tenant_id=c.tenant_id
         JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id
         JOIN employees e ON e.id=c.beneficiary_employee_id AND e.company_id=c.tenant_id
         JOIN commission_policy_versions v ON v.id=c.policy_version_id AND v.tenant_id=c.tenant_id
         JOIN commission_policies p ON p.id=v.policy_id AND p.tenant_id=v.tenant_id
         WHERE c.tenant_id=$1 AND ${secured.sql} ORDER BY c.created_at DESC,c.id`,
        [context.actor.companyId, ...secured.values],
      )
    ).rows.map((row) => row.item);
  }

  public accrue(
    input: {
      salesOrderId: string;
      beneficiaryEmployeeId: string;
      policyVersionId: string;
      accountingPeriod: string;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${context.actor.companyId}:${key}:commission-accrue`,
      ]);
      const replay = (
        await tx.query<{ item: JsonObject }>(
          'SELECT to_jsonb(c) AS item FROM commission_cases c WHERE c.tenant_id=$1 AND c.idempotency_key=$2',
          [context.actor.companyId, key],
        )
      ).rows[0];
      if (replay) return replay.item;
      const secured = customerScope(context, 'cu', 5);
      const basis = (
        await tx.query<{
          currency: string;
          eligible_revenue: string;
          margin_amount: string;
          margin_basis_points: number;
          collected_amount: string;
          collection_basis_points: number;
          base_rate_basis_points: number;
          minimum_margin_basis_points: number;
          release_collection_basis_points: number;
          commission_amount: string;
        }>(
          `SELECT o.currency,o.total::text AS eligible_revenue,qr.margin::text AS margin_amount,
             qr.margin_basis_points,least(o.total,coalesce(collected.amount,0))::text AS collected_amount,
             trunc(least(o.total,coalesce(collected.amount,0))/o.total*10000)::integer AS collection_basis_points,
             pv.base_rate_basis_points,pv.minimum_margin_basis_points,pv.release_collection_basis_points,
             trunc(o.total*pv.base_rate_basis_points/10000,6)::text AS commission_amount
           FROM sales_orders o
           JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id
           JOIN quote_revisions qr ON qr.id=o.quote_revision_id AND qr.tenant_id=o.tenant_id
           JOIN commission_policy_versions pv ON pv.id=$3 AND pv.tenant_id=o.tenant_id
             AND pv.status='PUBLISHED' AND pv.effective_at<=now()
           LEFT JOIN LATERAL(
             SELECT sum(a.amount) amount FROM allocation_entries a
             JOIN ar_open_items oi ON oi.id=a.ar_open_item_id AND oi.tenant_id=a.tenant_id
             JOIN ar_documents d ON d.id=oi.ar_document_id AND d.tenant_id=oi.tenant_id
             WHERE a.tenant_id=o.tenant_id AND d.sales_order_id=o.id
           ) collected ON true
           WHERE o.id=$1 AND o.tenant_id=$2 AND EXISTS(
             SELECT 1 FROM employees e WHERE e.id=$4 AND e.company_id=o.tenant_id AND e.active AND e.deleted_at IS NULL
           ) AND ${secured.sql}`,
          [
            input.salesOrderId,
            context.actor.companyId,
            input.policyVersionId,
            input.beneficiaryEmployeeId,
            ...secured.values,
          ],
        )
      ).rows[0];
      if (!basis) throw new DomainError('not_found', 'Eligible sales order or policy not found');
      const canonical = {
        ...input,
        currency: basis.currency,
        eligibleRevenue: basis.eligible_revenue,
        marginAmount: basis.margin_amount,
        marginBasisPoints: basis.margin_basis_points,
        collectedAmount: basis.collected_amount,
        collectionBasisPoints: basis.collection_basis_points,
        baseRateBasisPoints: basis.base_rate_basis_points,
        minimumMarginBasisPoints: basis.minimum_margin_basis_points,
        releaseCollectionBasisPoints: basis.release_collection_basis_points,
      };
      const trace = [
        {
          rule: 'minimum-margin',
          matched: basis.margin_basis_points >= basis.minimum_margin_basis_points,
          actual: basis.margin_basis_points,
          threshold: basis.minimum_margin_basis_points,
        },
        {
          rule: 'collection-release',
          matched: basis.collection_basis_points >= basis.release_collection_basis_points,
          actual: basis.collection_basis_points,
          threshold: basis.release_collection_basis_points,
        },
        {
          rule: 'commission-rate',
          basisPoints: basis.base_rate_basis_points,
          formula: 'trunc(eligible revenue × rate / 10000, 6)',
        },
      ];
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO commission_cases(tenant_id,sales_order_id,beneficiary_employee_id,policy_version_id,accounting_period,currency,eligible_revenue,margin_amount,margin_basis_points,collected_amount,collection_basis_points,commission_amount,canonical_input,calculation_trace,canonical_hash,actor_id,correlation_id,idempotency_key)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
          [
            context.actor.companyId,
            input.salesOrderId,
            input.beneficiaryEmployeeId,
            input.policyVersionId,
            input.accountingPeriod,
            basis.currency,
            basis.eligible_revenue,
            basis.margin_amount,
            basis.margin_basis_points,
            basis.collected_amount,
            basis.collection_basis_points,
            basis.commission_amount,
            canonical,
            JSON.stringify(trace),
            hash(canonical),
            context.actor.employeeId,
            correlationId,
            key,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Commission accrual insert returned no row');
      const accrued = {
        state: 'ACCRUED',
        amount: basis.commission_amount,
        reason: '按固定政策版本完成服务器计提',
        input: canonical,
        trace,
      };
      await tx.query(
        `INSERT INTO commission_ledger_entries(tenant_id,commission_case_id,sequence,state,amount,reason,evidence,canonical_hash,actor_id,correlation_id,idempotency_key)
         VALUES($1,$2,1,'ACCRUED',$3,$4,$5,$6,$7,$8,$9)`,
        [
          context.actor.companyId,
          row.id,
          basis.commission_amount,
          accrued.reason,
          accrued,
          hash(accrued),
          context.actor.employeeId,
          correlationId,
          `${key}:accrued`,
        ],
      );
      const releaseReady =
        basis.margin_basis_points >= basis.minimum_margin_basis_points &&
        basis.collection_basis_points >= basis.release_collection_basis_points;
      const control = {
        state: releaseReady ? 'RELEASED' : 'FROZEN',
        amount: '0',
        reason: releaseReady
          ? '毛利与回款条件满足，计提自动释放'
          : basis.margin_basis_points < basis.minimum_margin_basis_points
            ? '实际毛利率低于佣金政策门槛'
            : '回款比例尚未达到佣金释放门槛',
        collectionBasisPoints: basis.collection_basis_points,
      };
      await tx.query(
        `INSERT INTO commission_ledger_entries(tenant_id,commission_case_id,sequence,state,amount,reason,evidence,canonical_hash,actor_id,correlation_id,idempotency_key)
         VALUES($1,$2,2,$3,0,$4,$5,$6,$7,$8,$9)`,
        [
          context.actor.companyId,
          row.id,
          control.state,
          control.reason,
          control,
          hash(control),
          context.actor.employeeId,
          correlationId,
          `${key}:control`,
        ],
      );
      const result = json({
        id: row.id,
        effectiveState: control.state,
        commissionAmount: basis.commission_amount,
        ...canonical,
        calculationTrace: trace,
      });
      await recordEvidence(
        tx,
        'commission.accrued',
        'commission',
        row.id,
        2,
        context.actor,
        correlationId,
        result,
      );
      return result;
    });
  }

  public transition(
    id: string,
    input: {
      state: Exclude<CommissionState, 'ACCRUED'>;
      reason: string;
      externalReference: string | null;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${context.actor.companyId}:${id}:commission`,
      ]);
      const replay = (
        await tx.query<{ evidence: JsonObject }>(
          'SELECT evidence FROM commission_ledger_entries WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, key],
        )
      ).rows[0];
      if (replay) return replay.evidence;
      const secured = customerScope(context, 'cu', 3);
      const current = (
        await tx.query<{
          commission_amount: string;
          effective_state: CommissionState;
          release_collection_basis_points: number;
          collection_basis_points: number;
          collected_amount: string;
          paid_amount: string;
          next_sequence: number;
        }>(
          `SELECT c.commission_amount,c.effective_state,pv.release_collection_basis_points,
             trunc(least(o.total,coalesce(collected.amount,0))/o.total*10000)::integer AS collection_basis_points,
             least(o.total,coalesce(collected.amount,0))::text AS collected_amount,c.paid_amount,
             (SELECT max(sequence)+1 FROM commission_ledger_entries le WHERE le.tenant_id=c.tenant_id AND le.commission_case_id=c.id) AS next_sequence
           FROM effective_commission_cases c
           JOIN sales_orders o ON o.id=c.sales_order_id AND o.tenant_id=c.tenant_id
           JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id
           JOIN commission_policy_versions pv ON pv.id=c.policy_version_id AND pv.tenant_id=c.tenant_id
           LEFT JOIN LATERAL(
             SELECT sum(a.amount) amount FROM allocation_entries a
             JOIN ar_open_items oi ON oi.id=a.ar_open_item_id AND oi.tenant_id=a.tenant_id
             JOIN ar_documents d ON d.id=oi.ar_document_id AND d.tenant_id=oi.tenant_id
             WHERE a.tenant_id=o.tenant_id AND d.sales_order_id=o.id
           ) collected ON true
           WHERE c.id=$1 AND c.tenant_id=$2 AND ${secured.sql} FOR UPDATE OF o`,
          [id, context.actor.companyId, ...secured.values],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Commission case not found');
      if (
        input.state === 'RELEASED' &&
        current.collection_basis_points < current.release_collection_basis_points
      )
        throw new DomainError('conflict', 'Collection threshold has not been reached');
      if ((input.state === 'PAID' || input.state === 'CLAWED_BACK') && !input.externalReference)
        throw new DomainError('invalid_request', 'Payment and clawback require externalReference');
      const amount =
        input.state === 'PAID'
          ? current.commission_amount
          : input.state === 'CLAWED_BACK'
            ? current.paid_amount
            : '0';
      const evidence = json({
        id,
        state: input.state,
        amount,
        reason: input.reason,
        externalReference: input.externalReference,
        previousState: current.effective_state,
        collectedAmount: current.collected_amount,
        collectionBasisPoints: current.collection_basis_points,
        releaseCollectionBasisPoints: current.release_collection_basis_points,
      });
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO commission_ledger_entries(tenant_id,commission_case_id,sequence,state,amount,reason,external_reference,evidence,canonical_hash,actor_id,correlation_id,idempotency_key)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            id,
            current.next_sequence,
            input.state,
            amount,
            input.reason,
            input.externalReference,
            evidence,
            hash(evidence),
            context.actor.employeeId,
            correlationId,
            key,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Commission ledger insert returned no row');
      const result = json({ ...evidence, ledgerEntryId: row.id });
      await recordEvidence(
        tx,
        `commission.${input.state.toLocaleLowerCase()}`,
        'commission',
        id,
        current.next_sequence,
        context.actor,
        correlationId,
        result,
      );
      return result;
    });
  }
}
