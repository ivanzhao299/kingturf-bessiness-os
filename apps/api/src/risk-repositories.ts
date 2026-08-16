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
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const scope = (context: Context, alias = 'c', offset = 3) => {
  const clauses: string[] = [],
    values: string[] = [];
  if (context.scopes.includes('COMPANY') || context.scopes.includes('GROUP')) clauses.push('TRUE');
  if (context.scopes.includes('SELF')) {
    values.push(context.actor.employeeId);
    clauses.push(`${alias}.owner_id=$${String(offset + values.length - 1)}`);
  }
  for (const anchor of context.anchors)
    if (anchor.organizationId && context.scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.length - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

export class PostgresRiskRepository {
  public constructor(private readonly db: Db) {}
  public async listPolicies(context: Context) {
    if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP')) return [];
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(v)||jsonb_build_object('policyId',p.id,'code',p.code,'name',p.name) item FROM risk_policy_versions v JOIN risk_policies p ON p.id=v.policy_id AND p.tenant_id=v.tenant_id WHERE v.tenant_id=$1 ORDER BY p.code,v.version DESC`,
        [context.actor.companyId],
      )
    ).rows.map((r) => r.item);
  }
  public async listEvaluations(context: Context) {
    const secured = scope(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(e)||jsonb_build_object('orderNumber',o.order_number,'policyCode',p.code,'policyVersion',v.version,'task',to_jsonb(t),'taskEvents',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sequence) FROM risk_task_events x WHERE x.tenant_id=t.tenant_id AND x.risk_task_id=t.id),'[]'::jsonb)) item FROM risk_evaluations e JOIN sales_orders o ON o.id=e.sales_order_id AND o.tenant_id=e.tenant_id JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id JOIN risk_policy_versions v ON v.id=e.policy_version_id AND v.tenant_id=e.tenant_id JOIN risk_policies p ON p.id=v.policy_id AND p.tenant_id=v.tenant_id LEFT JOIN effective_risk_tasks t ON t.risk_evaluation_id=e.id AND t.tenant_id=e.tenant_id WHERE e.tenant_id=$1 AND ${secured.sql} ORDER BY e.created_at DESC`,
        [context.actor.companyId, ...secured.values],
      )
    ).rows.map((r) => r.item);
  }
  public createPolicy(
    input: {
      code: string;
      name: string;
      minimumMarginBasisPoints: number;
      overdueGraceDays: number;
      creditWarningDays: number;
      effectiveAt: string;
      rules: JsonObject[];
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
        throw new DomainError('forbidden', 'Risk policy management requires company scope');
      const p = (
        await tx.query<{ id: string }>(
          'INSERT INTO risk_policies(tenant_id,code,name,created_by) VALUES($1,$2,$3,$4) RETURNING id',
          [context.actor.companyId, input.code, input.name, context.actor.employeeId],
        )
      ).rows[0];
      if (!p) throw new Error('Risk policy insert failed');
      const canonical = {
        code: input.code,
        name: input.name,
        minimumMarginBasisPoints: input.minimumMarginBasisPoints,
        overdueGraceDays: input.overdueGraceDays,
        creditWarningDays: input.creditWarningDays,
        effectiveAt: input.effectiveAt,
        rules: input.rules,
      };
      const v = (
        await tx.query<{ id: string }>(
          `INSERT INTO risk_policy_versions(tenant_id,policy_id,version,status,minimum_margin_basis_points,overdue_grace_days,credit_warning_days,effective_at,rules,canonical_hash,published_at,created_by) VALUES($1,$2,1,$3::risk_policy_status,$4,$5,$6,$7,$8,$9,CASE WHEN $3::text='PUBLISHED' THEN now() END,$10) RETURNING id`,
          [
            context.actor.companyId,
            p.id,
            input.publish ? 'PUBLISHED' : 'DRAFT',
            input.minimumMarginBasisPoints,
            input.overdueGraceDays,
            input.creditWarningDays,
            input.effectiveAt,
            JSON.stringify(input.rules),
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!v) throw new Error('Risk policy version insert failed');
      await tx.query(
        "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES('risk-policy.created','SUCCESS',$1,$2,'risk-policy',$3,$4,$5)",
        [context.actor.employeeId, context.actor.companyId, p.id, correlationId, canonical],
      );
      return json({
        id: v.id,
        policyId: p.id,
        version: 1,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        ...input,
        canonicalHash: hash(canonical),
      });
    });
  }
  public createPolicyVersion(
    policyId: string,
    input: {
      minimumMarginBasisPoints: number;
      overdueGraceDays: number;
      creditWarningDays: number;
      effectiveAt: string;
      rules: JsonObject[];
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
        throw new DomainError('forbidden', 'Risk policy management requires company scope');
      const policy = (
        await tx.query<{ code: string; name: string }>(
          'SELECT code,name FROM risk_policies WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [policyId, context.actor.companyId],
        )
      ).rows[0];
      if (!policy) throw new DomainError('not_found', 'Risk policy not found');
      const canonical = { policyId, ...input };
      const version = (
        await tx.query<{ id: string; version: number }>(
          `INSERT INTO risk_policy_versions(tenant_id,policy_id,version,minimum_margin_basis_points,overdue_grace_days,credit_warning_days,effective_at,rules,canonical_hash,created_by)
           SELECT $1,$2,coalesce(max(version),0)+1,$3,$4,$5,$6,$7,$8,$9 FROM risk_policy_versions
           WHERE tenant_id=$1 AND policy_id=$2 RETURNING id,version`,
          [
            context.actor.companyId,
            policyId,
            input.minimumMarginBasisPoints,
            input.overdueGraceDays,
            input.creditWarningDays,
            input.effectiveAt,
            JSON.stringify(input.rules),
            hash(canonical),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('Risk policy version insert failed');
      await tx.query(
        "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES('risk-policy.revised','SUCCESS',$1,$2,'risk-policy',$3,$4,$5)",
        [context.actor.employeeId, context.actor.companyId, policyId, correlationId, canonical],
      );
      return json({
        id: version.id,
        policyId,
        code: policy.code,
        name: policy.name,
        version: version.version,
        status: 'DRAFT',
        ...input,
        canonicalHash: hash(canonical),
      });
    });
  }
  public publishPolicyVersion(id: string, context: Context, correlationId: string) {
    return this.db.transaction(async (tx) => {
      if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
        throw new DomainError('forbidden', 'Risk policy management requires company scope');
      const row = (
        await tx.query<{ policy_id: string; version: number }>(
          "UPDATE risk_policy_versions SET status='PUBLISHED',published_at=now() WHERE id=$1 AND tenant_id=$2 AND status='DRAFT' RETURNING policy_id,version",
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Draft risk policy version not found');
      const result = json({
        id,
        policyId: row.policy_id,
        version: row.version,
        status: 'PUBLISHED',
      });
      await tx.query(
        "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES('risk-policy.published','SUCCESS',$1,$2,'risk-policy',$3,$4,$5)",
        [context.actor.employeeId, context.actor.companyId, row.policy_id, correlationId, result],
      );
      return result;
    });
  }
  public evaluate(
    input: {
      salesOrderId: string;
      policyVersionId: string;
      assigneeEmployeeId: string;
      validUntil: string;
      dueAt: string;
    },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${context.actor.companyId}:${key}:risk`,
      ]);
      const replay = (
        await tx.query<{ item: JsonObject }>(
          'SELECT to_jsonb(e) item FROM risk_evaluations e WHERE e.tenant_id=$1 AND e.idempotency_key=$2',
          [context.actor.companyId, key],
        )
      ).rows[0];
      if (replay) return replay.item;
      const secured = scope(context);
      const basis = (
        await tx.query<{
          order_number: string;
          margin_basis_points: number;
          credit_valid_until: string;
          open_ar: string;
          overdue_ar: string;
          minimum_margin_basis_points: number;
          overdue_grace_days: number;
          credit_warning_days: number;
        }>(
          `SELECT o.order_number,qr.margin_basis_points,cd.valid_until::text credit_valid_until,coalesce(sum(b.remaining_amount),0)::text open_ar,coalesce(sum(b.remaining_amount) FILTER(WHERE b.due_at+make_interval(days=>pv.overdue_grace_days)<now()),0)::text overdue_ar,pv.minimum_margin_basis_points,pv.overdue_grace_days,pv.credit_warning_days FROM sales_orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id JOIN quote_revisions qr ON qr.id=o.quote_revision_id AND qr.tenant_id=o.tenant_id JOIN effective_credit_decisions cd ON cd.id=o.credit_decision_id AND cd.tenant_id=o.tenant_id JOIN risk_policy_versions pv ON pv.id=$3 AND pv.tenant_id=o.tenant_id AND pv.status='PUBLISHED' AND pv.effective_at<=now() LEFT JOIN ar_documents d ON d.sales_order_id=o.id AND d.tenant_id=o.tenant_id LEFT JOIN ar_open_item_balances b ON b.ar_document_id=d.id AND b.tenant_id=d.tenant_id WHERE o.id=$1 AND o.tenant_id=$2 AND ${secured.sql} AND EXISTS(SELECT 1 FROM employees x WHERE x.id=$4 AND x.company_id=o.tenant_id AND x.active) GROUP BY o.id,qr.margin_basis_points,cd.valid_until,pv.minimum_margin_basis_points,pv.overdue_grace_days,pv.credit_warning_days`,
          [
            input.salesOrderId,
            context.actor.companyId,
            input.policyVersionId,
            input.assigneeEmployeeId,
            ...secured.values,
          ],
        )
      ).rows[0];
      if (!basis)
        throw new DomainError('not_found', 'Eligible order, policy, or assignee not found');
      const findings: JsonObject[] = [];
      let score = 0;
      if (basis.margin_basis_points < basis.minimum_margin_basis_points) {
        findings.push(
          json({
            code: 'LOW_MARGIN',
            severity: 'HIGH',
            actual: basis.margin_basis_points,
            threshold: basis.minimum_margin_basis_points,
          }),
        );
        score += 45;
      }
      if (Number(basis.overdue_ar) > 0) {
        findings.push(
          json({
            code: 'OVERDUE_AR',
            severity: 'CRITICAL',
            amount: basis.overdue_ar,
            graceDays: basis.overdue_grace_days,
          }),
        );
        score += 60;
      }
      const warningAt = Date.now() + basis.credit_warning_days * 86400000;
      if (new Date(basis.credit_valid_until).getTime() <= warningAt) {
        findings.push(
          json({
            code: 'CREDIT_EXPIRY',
            severity: 'HIGH',
            validUntil: basis.credit_valid_until,
            warningDays: basis.credit_warning_days,
          }),
        );
        score += 35;
      }
      score = Math.min(100, score);
      const severity =
        score >= 80 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score > 0 ? 'MEDIUM' : 'LOW';
      const canonical = {
        ...input,
        orderNumber: basis.order_number,
        marginBasisPoints: basis.margin_basis_points,
        openAr: basis.open_ar,
        overdueAr: basis.overdue_ar,
        creditValidUntil: basis.credit_valid_until,
      };
      const trace = [
        json({
          rule: 'LOW_MARGIN',
          matched: basis.margin_basis_points < basis.minimum_margin_basis_points,
          actual: basis.margin_basis_points,
          threshold: basis.minimum_margin_basis_points,
        }),
        json({
          rule: 'OVERDUE_AR',
          matched: Number(basis.overdue_ar) > 0,
          amount: basis.overdue_ar,
          graceDays: basis.overdue_grace_days,
        }),
        json({
          rule: 'CREDIT_EXPIRY',
          matched: new Date(basis.credit_valid_until).getTime() <= warningAt,
          validUntil: basis.credit_valid_until,
          warningDays: basis.credit_warning_days,
        }),
        json({
          rule: 'CONTRACT_SIGNATURE',
          matched: false,
          evidence: 'released order pins an exact signed contract',
        }),
        json({
          rule: 'ORDER_RELEASE_GATE',
          matched: false,
          evidence: 'order status and graph were validated at release',
        }),
      ];
      const actions = findings.map((f) =>
        json({
          finding: f.code,
          action:
            f.code === 'LOW_MARGIN'
              ? '复核利润与例外审批'
              : f.code === 'OVERDUE_AR'
                ? '立即催收并升级'
                : '重新评估信用',
        }),
      );
      const e = (
        await tx.query<{ id: string }>(
          `INSERT INTO risk_evaluations(tenant_id,sales_order_id,policy_version_id,severity,score,findings,recommended_actions,canonical_input,calculation_trace,canonical_hash,valid_until,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            context.actor.companyId,
            input.salesOrderId,
            input.policyVersionId,
            severity,
            score,
            JSON.stringify(findings),
            JSON.stringify(actions),
            canonical,
            JSON.stringify(trace),
            hash(canonical),
            input.validUntil,
            context.actor.employeeId,
            correlationId,
            key,
          ],
        )
      ).rows[0];
      if (!e) throw new Error('Risk evaluation insert failed');
      let taskId: null | string = null;
      if (score >= 40) {
        const t = (
          await tx.query<{ id: string }>(
            'INSERT INTO risk_tasks(tenant_id,risk_evaluation_id,assignee_employee_id,due_at,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
            [
              context.actor.companyId,
              e.id,
              input.assigneeEmployeeId,
              input.dueAt,
              context.actor.employeeId,
            ],
          )
        ).rows[0];
        if (!t) throw new Error('Risk task insert failed');
        taskId = t.id;
        const evidence = { evaluationId: e.id, severity, score, findings };
        await tx.query(
          "INSERT INTO risk_task_events(tenant_id,risk_task_id,sequence,state,reason,evidence,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,1,'OPEN','高风险评价自动生成责任任务',$3,$4,$5,$6,$7)",
          [
            context.actor.companyId,
            t.id,
            evidence,
            hash(evidence),
            context.actor.employeeId,
            correlationId,
            `${key}:task-open`,
          ],
        );
      }
      return json({
        id: e.id,
        salesOrderId: input.salesOrderId,
        severity,
        score,
        findings,
        recommendedActions: actions,
        canonicalInput: canonical,
        canonicalHash: hash(canonical),
        taskId,
      });
    });
  }
  public transitionTask(
    id: string,
    input: { state: 'ACKNOWLEDGED' | 'ESCALATED' | 'CLOSED'; reason: string; evidence: JsonObject },
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (input.state === 'CLOSED' && Object.keys(input.evidence).length === 0)
        throw new DomainError('invalid_request', 'Risk task closure requires evidence');
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${context.actor.companyId}:${id}:risk-task`,
      ]);
      const replay = (
        await tx.query<{ evidence: JsonObject }>(
          'SELECT evidence FROM risk_task_events WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, key],
        )
      ).rows[0];
      if (replay) return replay.evidence;
      const current = (
        await tx.query<{ next_sequence: number }>(
          `SELECT max(x.sequence)+1 next_sequence FROM risk_tasks t JOIN risk_evaluations e ON e.id=t.risk_evaluation_id AND e.tenant_id=t.tenant_id JOIN sales_orders o ON o.id=e.sales_order_id AND o.tenant_id=e.tenant_id JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id JOIN risk_task_events x ON x.risk_task_id=t.id AND x.tenant_id=t.tenant_id WHERE t.id=$1 AND t.tenant_id=$2 AND (t.assignee_employee_id=$3 OR $4::boolean) GROUP BY t.id`,
          [
            id,
            context.actor.companyId,
            context.actor.employeeId,
            context.scopes.includes('COMPANY') || context.scopes.includes('GROUP'),
          ],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Risk task not found');
      const evidence = json({
        taskId: id,
        state: input.state,
        reason: input.reason,
        evidence: input.evidence,
      });
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO risk_task_events(tenant_id,risk_task_id,sequence,state,reason,evidence,canonical_hash,actor_id,correlation_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [
            context.actor.companyId,
            id,
            current.next_sequence,
            input.state,
            input.reason,
            evidence,
            hash(evidence),
            context.actor.employeeId,
            correlationId,
            key,
          ],
        )
      ).rows[0];
      return json({ ...evidence, eventId: row?.id });
    });
  }
}
