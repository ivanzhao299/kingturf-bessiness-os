import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresRiskRepository } from '../src/risk-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

describe('risk repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  let repository: PostgresRiskRepository;
  const state = () => {
    if (!fixture) throw new Error('Owned commercial fixture not initialized');
    return fixture;
  };
  const policyInput = (code: string, publish = true) => ({
    code,
    name: code,
    minimumMarginBasisPoints: 3000,
    overdueGraceDays: 0,
    creditWarningDays: 0,
    effectiveAt: '2026-01-01T00:00:00Z',
    rules: [],
    publish,
  });
  const evaluationInput = (policyVersionId: string) => ({
    salesOrderId: state().graph.orderId,
    policyVersionId,
    assigneeEmployeeId: state().context.actor.employeeId,
    validUntil: '2099-01-01T00:00:00Z',
    dueAt: '2099-01-01T00:00:00Z',
  });
  const evidenceCounts = async (correlation: string) =>
    (
      await state().db.query<{ audit: string; outbox: string }>(
        'SELECT (SELECT count(*)::text FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::text FROM domain_event_outbox WHERE correlation_id=$1) outbox',
        [correlation],
      )
    ).rows[0];
  const counts = async () =>
    (
      await state().db.query(
        'SELECT (SELECT count(*)::integer FROM risk_evaluations) evaluations,(SELECT count(*)::integer FROM risk_tasks) tasks,(SELECT count(*)::integer FROM risk_task_events) events',
      )
    ).rows[0];

  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
    repository = new PostgresRiskRepository(fixture.db);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('creates versioned policies with audit-only evidence and immutable publication', async () => {
    const { context, otherContext, db } = state();
    const created = randomUUID(),
      revised = randomUUID(),
      published = randomUUID();
    const first = await repository.createPolicy(policyInput('VERSIONED', false), context, created);
    expect(first).toMatchObject({ version: 1, status: 'DRAFT' });
    const input = {
      minimumMarginBasisPoints: 4000,
      overdueGraceDays: 3,
      creditWarningDays: 7,
      effectiveAt: '2026-02-01T00:00:00Z',
      rules: [],
    };
    const second = await repository.createPolicyVersion(
      identifier(first, 'policyId'),
      input,
      context,
      revised,
    );
    expect(second).toMatchObject({ version: 2, status: 'DRAFT', minimumMarginBasisPoints: 4000 });
    expect(
      await repository.publishPolicyVersion(identifier(second), context, published),
    ).toMatchObject({ version: 2, status: 'PUBLISHED' });
    for (const [correlation, action] of [
      [created, 'risk-policy.created'],
      [revised, 'risk-policy.revised'],
      [published, 'risk-policy.published'],
    ] as const) {
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '0' });
      expect(
        (
          await db.query(
            'SELECT action,target_type,target_id FROM audit_events WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ action, target_type: 'risk-policy', target_id: identifier(first, 'policyId') }]);
    }
    await expect(
      repository.publishPolicyVersion(identifier(second), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      repository.createPolicyVersion(
        identifier(first, 'policyId'),
        input,
        otherContext,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      db.query('UPDATE risk_policy_versions SET minimum_margin_basis_points=0 WHERE id=$1', [
        identifier(second),
      ]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'risk evidence is immutable' });
    expect(
      (await repository.listPolicies(context)).filter((row) => row.code === 'VERSIONED'),
    ).toHaveLength(2);
    expect(await repository.listPolicies(otherContext)).toEqual([]);
    expect(await repository.listPolicies({ ...context, scopes: ['SELF'] })).toEqual([]);
    await expect(
      repository.createPolicy(
        policyInput('DENIED'),
        { ...context, scopes: ['SELF'] },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const collision = await repository.createPolicyVersion(
      identifier(first, 'policyId'),
      input,
      context,
      randomUUID(),
    );
    const failed = randomUUID();
    await expect(
      repository.publishPolicyVersion(identifier(collision), context, failed),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      (
        await db.query('SELECT status,published_at FROM risk_policy_versions WHERE id=$1', [
          identifier(collision),
        ])
      ).rows,
    ).toEqual([{ status: 'DRAFT', published_at: null }]);
    await expect(
      repository.createPolicy(
        { ...policyInput('INVALID-MARGIN'), minimumMarginBasisPoints: 10001 },
        context,
        failed,
      ),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      (
        await db.query(
          "SELECT count(*)::integer count FROM risk_policies WHERE code='INVALID-MARGIN'",
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(await evidenceCounts(failed)).toEqual({ audit: '0', outbox: '0' });
  });

  it('calculates fixed capped findings, trace and a task from the real order/AR graph', async () => {
    const { context, db } = state();
    const policy = await repository.createPolicy(policyInput('CRITICAL'), context, randomUUID());
    const correlation = randomUUID();
    const result = await repository.evaluate(
      evaluationInput(identifier(policy)),
      'critical',
      context,
      correlation,
    );
    expect(result).toMatchObject({
      salesOrderId: state().graph.orderId,
      severity: 'CRITICAL',
      score: 100,
      findings: [
        { code: 'LOW_MARGIN', severity: 'HIGH', actual: 2631, threshold: 3000 },
        { code: 'OVERDUE_AR', severity: 'CRITICAL', amount: '850000.000000', graceDays: 0 },
      ],
      canonicalInput: {
        marginBasisPoints: 2631,
        openAr: '850000.000000',
        overdueAr: '850000.000000',
      },
      recommendedActions: [
        { finding: 'LOW_MARGIN', action: '复核利润与例外审批' },
        { finding: 'OVERDUE_AR', action: '立即催收并升级' },
      ],
    });
    const task = identifier(result, 'taskId');
    expect(
      (
        await db.query(
          'SELECT effective_state,assignee_employee_id FROM effective_risk_tasks WHERE id=$1',
          [task],
        )
      ).rows,
    ).toEqual([{ effective_state: 'OPEN', assignee_employee_id: context.actor.employeeId }]);
    expect(
      (
        await db.query('SELECT calculation_trace FROM risk_evaluations WHERE id=$1', [
          identifier(result),
        ])
      ).rows,
    ).toMatchObject([
      {
        calculation_trace: [
          { rule: 'LOW_MARGIN', matched: true, actual: 2631, threshold: 3000 },
          { rule: 'OVERDUE_AR', matched: true, amount: '850000.000000' },
          { rule: 'CREDIT_EXPIRY', matched: false },
          { rule: 'CONTRACT_SIGNATURE', matched: false },
          { rule: 'ORDER_RELEASE_GATE', matched: false },
        ],
      },
    ]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    const listed = await repository.listEvaluations({ ...context, scopes: ['SELF'] });
    expect(listed.some((row) => row.id === identifier(result))).toBe(true);
    expect(
      (
        await repository.listEvaluations({
          ...context,
          scopes: ['TEAM'],
          anchors: [{ scope: 'TEAM', organizationId: state().teamId }],
        })
      ).some((row) => row.id === identifier(result)),
    ).toBe(true);
    expect(await repository.listEvaluations({ ...context, scopes: [] })).toEqual([]);
    expect(
      await repository.listEvaluations({
        ...context,
        actor: { ...context.actor, employeeId: state().reviewerEmployee },
        scopes: ['SELF'],
      }),
    ).toEqual([]);
    expect(await repository.listEvaluations(state().otherContext)).toEqual([]);
    await expect(
      db.query('DELETE FROM risk_evaluations WHERE id=$1', [identifier(result)]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'risk evidence is immutable' });
  });

  it('does not create a task for zero score and replays the existing persisted evaluation', async () => {
    const { context } = state();
    const policy = await repository.createPolicy(
      { ...policyInput('LOW'), minimumMarginBasisPoints: 0, overdueGraceDays: 3650 },
      context,
      randomUUID(),
    );
    const first = await repository.evaluate(
      evaluationInput(identifier(policy)),
      'low',
      context,
      randomUUID(),
    );
    expect(first).toMatchObject({
      severity: 'LOW',
      score: 0,
      findings: [],
      recommendedActions: [],
      taskId: null,
    });
    const before = await counts(),
      correlation = randomUUID();
    const replay = await repository.evaluate(
      { ...evaluationInput(randomUUID()), salesOrderId: randomUUID() },
      'low',
      context,
      correlation,
    );
    expect(replay).toMatchObject({
      id: identifier(first),
      sales_order_id: state().graph.orderId,
      canonical_hash: first.canonicalHash,
    });
    expect(await counts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });

  it('rejects ineligible references without inserting evaluation or task evidence', async () => {
    const { context, otherContext } = state();
    const draft = await repository.createPolicy(policyInput('DRAFT', false), context, randomUUID());
    const published = await repository.createPolicy(
      policyInput('PUBLISHED'),
      context,
      randomUUID(),
    );
    for (const [input, actor] of [
      [evaluationInput(identifier(draft)), context],
      [{ ...evaluationInput(identifier(published)), salesOrderId: randomUUID() }, context],
      [
        {
          ...evaluationInput(identifier(published)),
          assigneeEmployeeId: otherContext.actor.employeeId,
        },
        context,
      ],
      [evaluationInput(identifier(published)), otherContext],
    ] as const) {
      const before = await counts(),
        correlation = randomUUID();
      await expect(
        repository.evaluate(input, randomUUID(), actor, correlation),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(await counts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
  });

  it('records contiguous task decisions, enforces assignee access and preserves replay semantics', async () => {
    const { context, reviewerEmployee, db } = state();
    const policy = await repository.createPolicy(policyInput('TASK'), context, randomUUID());
    const result = await repository.evaluate(
      evaluationInput(identifier(policy)),
      'task',
      context,
      randomUUID(),
    );
    const task = identifier(result, 'taskId');
    const reviewer = {
      ...context,
      actor: { ...context.actor, employeeId: reviewerEmployee },
      scopes: ['SELF'] as const,
    };
    await expect(
      repository.transitionTask(
        task,
        { state: 'ACKNOWLEDGED', reason: 'Review', evidence: {} },
        'denied',
        reviewer,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    const key = randomUUID(),
      correlation = randomUUID();
    const first = await repository.transitionTask(
      task,
      { state: 'ACKNOWLEDGED', reason: 'Acknowledged', evidence: { receipt: true } },
      key,
      { ...context, scopes: ['SELF'] },
      correlation,
    );
    const replay = await repository.transitionTask(
      task,
      { state: 'ESCALATED', reason: 'Different input', evidence: {} },
      key,
      context,
      randomUUID(),
    );
    expect(replay).toMatchObject({
      taskId: task,
      state: 'ACKNOWLEDGED',
      reason: 'Acknowledged',
      evidence: { receipt: true },
    });
    expect(first).toHaveProperty('eventId');
    await repository.transitionTask(
      task,
      { state: 'ESCALATED', reason: 'Escalated', evidence: {} },
      randomUUID(),
      context,
      randomUUID(),
    );
    await expect(
      repository.transitionTask(
        task,
        { state: 'CLOSED', reason: 'No proof', evidence: {} },
        randomUUID(),
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await repository.transitionTask(
      task,
      { state: 'CLOSED', reason: 'Resolved', evidence: { resolution: true } },
      'closed',
      context,
      randomUUID(),
    );
    await expect(
      repository.transitionTask(
        task,
        { state: 'CLOSED', reason: 'Replay without evidence', evidence: {} },
        'closed',
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(
      repository.transitionTask(
        task,
        { state: 'ESCALATED', reason: 'After closure', evidence: {} },
        randomUUID(),
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect(
      (
        await db.query(
          'SELECT sequence,state FROM risk_task_events WHERE risk_task_id=$1 ORDER BY sequence',
          [task],
        )
      ).rows,
    ).toEqual([
      { sequence: 1, state: 'OPEN' },
      { sequence: 2, state: 'ACKNOWLEDGED' },
      { sequence: 3, state: 'ESCALATED' },
      { sequence: 4, state: 'CLOSED' },
    ]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });
  it('TD-RISK-001: binds fixed and dynamic parameters across real scope combinations and replays once', async () => {
    const { context, db, teamId, reviewerEmployee, otherContext } = state();
    const policy = await repository.createPolicy(
      policyInput('NARROW-SCOPE'),
      context,
      randomUUID(),
    );
    const department = randomUUID(),
      region = randomUUID();
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'RISK-DEPT','Risk department','DEPARTMENT'),($3,$2,'RISK-REGION','Risk region','REGION')",
      [department, context.actor.companyId, region],
    );
    await db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [region, department]);
    await db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [department, teamId]);
    const team = { scope: 'TEAM' as const, organizationId: teamId };
    const dept = { scope: 'DEPARTMENT' as const, organizationId: department };
    const variants: readonly Parameters<typeof repository.evaluate>[2][] = [
      { ...context, scopes: ['SELF'] },
      { ...context, scopes: ['TEAM'], anchors: [team] },
      { ...context, scopes: ['DEPARTMENT'], anchors: [dept] },
      { ...context, scopes: ['REGION'], anchors: [{ scope: 'REGION', organizationId: region }] },
      { ...context, scopes: ['SELF', 'TEAM'], anchors: [team] },
      { ...context, scopes: ['TEAM', 'DEPARTMENT'], anchors: [team, dept] },
      { ...context, scopes: ['COMPANY', 'TEAM'], anchors: [team] },
      { ...context, scopes: ['GROUP'] },
    ];
    for (const actor of variants) {
      const key = randomUUID(),
        correlation = randomUUID();
      const result = await repository.evaluate(
        evaluationInput(identifier(policy)),
        key,
        actor,
        correlation,
      );
      expect(result).toMatchObject({ salesOrderId: state().graph.orderId });
      const after = await counts(),
        paired = await evidenceCounts(correlation);
      expect(
        (await repository.evaluate(evaluationInput(identifier(policy)), key, actor, randomUUID()))
          .id,
      ).toBe(result.id);
      expect(await counts()).toEqual(after);
      expect(await evidenceCounts(correlation)).toEqual(paired);
      expect(paired).toEqual({ audit: '0', outbox: '0' });
      expect(
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int n FROM risk_evaluations WHERE id=$1 AND correlation_id=$2',
            [result.id, correlation],
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
    }
    for (const actor of [
      { ...context, scopes: ['TEAM'] as const, anchors: [] },
      {
        ...context,
        scopes: ['SELF'] as const,
        actor: { ...context.actor, employeeId: reviewerEmployee },
      },
      { ...otherContext, scopes: ['GROUP'] as const },
      {
        ...context,
        scopes: ['DEPARTMENT'] as const,
        anchors: [{ scope: 'DEPARTMENT' as const, organizationId: teamId }],
      },
    ]) {
      const before = await counts(),
        correlation = randomUUID();
      await expect(
        repository.evaluate(evaluationInput(identifier(policy)), randomUUID(), actor, correlation),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(await counts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
    await db.query('UPDATE organizations SET active=false WHERE id=$1', [department]);
    const before = await counts();
    await expect(
      repository.evaluate(
        evaluationInput(identifier(policy)),
        randomUUID(),
        { ...context, scopes: ['DEPARTMENT'], anchors: [dept] },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await counts()).toEqual(before);
  });
  it('TD-RISK-002: rejects a known-key replay outside the current scope and keeps authorized handoff', async () => {
    const { context, reviewerEmployee } = state();
    const policy = await repository.createPolicy(
      policyInput('REPLAY-SCOPE'),
      context,
      randomUUID(),
    );
    const key = randomUUID(),
      input = evaluationInput(identifier(policy));
    const first = await repository.evaluate(input, key, context, randomUUID());
    const before = await counts();
    const narrowed = {
      ...context,
      actor: { ...context.actor, employeeId: reviewerEmployee },
      scopes: ['SELF'] as const,
    };
    await expect(repository.evaluate(input, key, narrowed, randomUUID())).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      repository.evaluate({ ...input, salesOrderId: randomUUID() }, key, narrowed, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(
      (await repository.evaluate(input, key, { ...narrowed, scopes: ['COMPANY'] }, randomUUID()))
        .id,
    ).toBe(first.id);
    await expect(
      repository.evaluate(input, randomUUID(), narrowed, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await counts()).toEqual(before);
  });

  it('TD-RISK-002: reevaluates explicit anchors on the stored order for every replay', async () => {
    const { context, db, teamId, otherContext } = state();
    const policy = await repository.createPolicy(
      policyInput('REPLAY-ANCHORS'),
      context,
      randomUUID(),
    );
    const input = evaluationInput(identifier(policy)),
      key = randomUUID();
    const anchored = {
      ...context,
      scopes: ['TEAM'] as const,
      anchors: [{ scope: 'TEAM' as const, organizationId: teamId }],
    };
    const first = await repository.evaluate(input, key, anchored, randomUUID());
    const before = await counts();
    for (const denied of [
      { ...context, scopes: [] as const },
      { ...anchored, anchors: [] },
      { ...anchored, anchors: [{ scope: 'TEAM' as const, organizationId: randomUUID() }] },
      otherContext,
    ]) {
      const correlation = randomUUID();
      await expect(repository.evaluate(input, key, denied, correlation)).rejects.toMatchObject({
        code: 'not_found',
      });
      expect(await counts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
    await db.query('UPDATE organizations SET active=false WHERE id=$1', [teamId]);
    await expect(repository.evaluate(input, key, anchored, randomUUID())).rejects.toMatchObject({
      code: 'not_found',
    });
    await db.query('UPDATE organizations SET active=true WHERE id=$1', [teamId]);
    expect((await repository.evaluate(input, key, anchored, randomUUID())).id).toBe(first.id);
    expect(await counts()).toEqual(before);
  });
});
