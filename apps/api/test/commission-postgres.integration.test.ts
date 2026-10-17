import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresCommissionRepository } from '../src/commission-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

describe('commission repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  let repository: PostgresCommissionRepository;
  const state = () => {
    if (!fixture) throw new Error('Owned commercial fixture not initialized');
    return fixture;
  };
  const policyInput = (code: string, publish = true) => ({
    code,
    name: code,
    applicability: { currency: 'CNY', channel: 'DIRECT' },
    baseRateBasisPoints: 300,
    minimumMarginBasisPoints: 2000,
    releaseCollectionBasisPoints: 0,
    effectiveAt: '2026-01-01T00:00:00Z',
    rules: [],
    publish,
  });
  const accrueInput = (policyVersionId: string) => ({
    salesOrderId: state().graph.orderId,
    beneficiaryEmployeeId: state().context.actor.employeeId,
    policyVersionId,
    accountingPeriod: '2026-08',
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
        'SELECT (SELECT count(*)::integer FROM commission_cases) cases,(SELECT count(*)::integer FROM commission_ledger_entries) entries',
      )
    ).rows[0];
  const ledger = async (id: string) =>
    (
      await state().db.query<{ sequence: number; state: string; amount: string }>(
        'SELECT sequence,state,amount::text FROM commission_ledger_entries WHERE commission_case_id=$1 ORDER BY sequence',
        [id],
      )
    ).rows;
  const accrue = async (code: string, overrides: Partial<ReturnType<typeof policyInput>> = {}) => {
    const policy = await repository.createPolicy(
      { ...policyInput(code), ...overrides },
      state().context,
      randomUUID(),
    );
    return repository.accrue(
      accrueInput(identifier(policy)),
      randomUUID(),
      state().context,
      randomUUID(),
    );
  };
  const collision = (
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    version: number,
    correlation: string,
  ) =>
    state().db.query(
      "INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,payload,correlation_id) VALUES($1,$2,1,$3,$4,$5,now(),'{}'::jsonb,$6)",
      [
        state().context.actor.companyId,
        eventType,
        aggregateType,
        aggregateId,
        version,
        correlation,
      ],
    );

  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
    repository = new PostgresCommissionRepository(fixture.db);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('versions and publishes policies with exact paired aggregate evidence', async () => {
    const { context, otherContext, db } = state();
    const created = randomUUID(),
      revised = randomUUID(),
      published = randomUUID();
    const first = await repository.createPolicy(policyInput('VERSIONED', false), context, created);
    const input = {
      baseRateBasisPoints: 400,
      minimumMarginBasisPoints: 1500,
      releaseCollectionBasisPoints: 5000,
      effectiveAt: '2026-02-01T00:00:00Z',
      rules: [],
    };
    const second = await repository.createPolicyVersion(
      identifier(first, 'policyId'),
      input,
      context,
      revised,
    );
    expect(second).toMatchObject({ version: 2, status: 'DRAFT', baseRateBasisPoints: 400 });
    expect(
      await repository.publishPolicyVersion(identifier(second), context, published),
    ).toMatchObject({ version: 2, status: 'PUBLISHED' });
    for (const [correlation, action, version] of [
      [created, 'commission-policy.created', 1],
      [revised, 'commission-policy.revised', 2],
      [published, 'commission-policy.published', 2],
    ] as const) {
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(
        (
          await db.query(
            'SELECT a.action,a.target_id,o.event_type,o.aggregate_type,o.aggregate_id,o.aggregate_version FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id WHERE a.correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([
        {
          action,
          target_id: identifier(first, 'policyId'),
          event_type: action,
          aggregate_type: 'commission-policy',
          aggregate_id: identifier(first, 'policyId'),
          aggregate_version: version,
        },
      ]);
    }
    await expect(
      repository.publishPolicyVersion(identifier(second), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      db.query('UPDATE commission_policy_versions SET base_rate_basis_points=0 WHERE id=$1', [
        identifier(second),
      ]),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect(
      (await repository.listPolicies(context)).filter((row) => row.code === 'VERSIONED'),
    ).toHaveLength(2);
    expect(await repository.listPolicies(otherContext)).toEqual([]);
    expect(await repository.listPolicies({ ...context, scopes: ['SELF'] })).toEqual([]);
    await expect(
      repository.createPolicy(policyInput('DENIED'), { ...context, scopes: [] }, randomUUID()),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      repository.createPolicyVersion(
        identifier(first, 'policyId'),
        input,
        otherContext,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('accrues fixed money and collection ratios with separate release and freeze causes', async () => {
    const { context, db } = state();
    for (const [code, overrides, effectiveState, reason] of [
      ['RELEASE', {}, 'RELEASED', '毛利与回款条件满足，计提自动释放'],
      [
        'COLLECTION',
        { releaseCollectionBasisPoints: 10000 },
        'FROZEN',
        '回款比例尚未达到佣金释放门槛',
      ],
      ['MARGIN', { minimumMarginBasisPoints: 4000 }, 'FROZEN', '实际毛利率低于佣金政策门槛'],
    ] as const) {
      const policy = await repository.createPolicy(
        { ...policyInput(code), ...overrides },
        context,
        randomUUID(),
      );
      const correlation = randomUUID();
      const result = await repository.accrue(
        accrueInput(identifier(policy)),
        code,
        { ...context, scopes: ['SELF'] },
        correlation,
      );
      expect(result).toMatchObject({
        effectiveState,
        currency: 'CNY',
        eligibleRevenue: '950000.000000',
        marginAmount: '250000.000000',
        marginBasisPoints: 2631,
        collectedAmount: '100000.000000',
        collectionBasisPoints: 1052,
        commissionAmount: '28500.000000',
      });
      expect(await ledger(identifier(result))).toEqual([
        { sequence: 1, state: 'ACCRUED', amount: '28500.000000' },
        { sequence: 2, state: effectiveState, amount: '0.000000' },
      ]);
      expect(
        (
          await db.query(
            'SELECT reason FROM commission_ledger_entries WHERE commission_case_id=$1 AND sequence=2',
            [identifier(result)],
          )
        ).rows,
      ).toEqual([{ reason }]);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(
        (
          await db.query(
            'SELECT event_type,aggregate_type,aggregate_id,aggregate_version FROM domain_event_outbox WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([
        {
          event_type: 'commission.accrued',
          aggregate_type: 'commission',
          aggregate_id: identifier(result),
          aggregate_version: 2,
        },
      ]);
      const own = await repository.listCases({ ...context, scopes: ['SELF'] });
      expect(own.find((row) => row.id === identifier(result))).toMatchObject({
        commission_amount: 28500,
        effective_state: effectiveState,
        ledger: [
          { sequence: 1, amount: 28500 },
          { sequence: 2, amount: 0 },
        ],
      });
    }
  });

  it('filters actual owner and TEAM scope and preserves accrual replay without duplicate evidence', async () => {
    const { context, otherContext, teamId, reviewerEmployee } = state();
    const policy = await repository.createPolicy(policyInput('SCOPED'), context, randomUUID());
    const key = randomUUID();
    const result = await repository.accrue(
      accrueInput(identifier(policy)),
      key,
      { ...context, scopes: ['TEAM'], anchors: [{ scope: 'TEAM', organizationId: teamId }] },
      randomUUID(),
    );
    expect(
      (
        await repository.listCases({
          ...context,
          scopes: ['TEAM'],
          anchors: [{ scope: 'TEAM', organizationId: teamId }],
        })
      ).some((row) => row.id === identifier(result)),
    ).toBe(true);
    const reviewer = {
      ...context,
      actor: { ...context.actor, employeeId: reviewerEmployee },
      scopes: ['SELF'] as const,
    };
    expect(await repository.listCases(reviewer)).toEqual([]);
    const differentBeneficiary = await repository.accrue(
      { ...accrueInput(identifier(policy)), beneficiaryEmployeeId: reviewerEmployee },
      randomUUID(),
      { ...context, scopes: ['SELF'] },
      randomUUID(),
    );
    expect(
      (await repository.listCases({ ...context, scopes: ['SELF'] })).some(
        (row) => row.id === identifier(differentBeneficiary),
      ),
    ).toBe(true);
    expect(await repository.listCases(reviewer)).toEqual([]);
    expect(await repository.listCases({ ...context, scopes: [] })).toEqual([]);
    expect(await repository.listCases({ ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    const before = await counts(),
      correlation = randomUUID();
    const persisted = (
      await state().db.query<{ canonical_hash: string }>(
        'SELECT canonical_hash FROM commission_cases WHERE id=$1',
        [identifier(result)],
      )
    ).rows[0];
    if (!persisted) throw new Error('Persisted commission case missing');
    expect(persisted.canonical_hash).toMatch(/^[a-f0-9]{64}$/u);
    const replay = await repository.accrue(
      { ...accrueInput(randomUUID()), salesOrderId: randomUUID() },
      key,
      context,
      correlation,
    );
    expect(replay).toMatchObject({
      id: identifier(result),
      canonical_hash: persisted.canonical_hash,
      commission_amount: 28500,
      sales_order_id: state().graph.orderId,
    });
    expect(await counts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    await expect(
      repository.accrue(accrueInput(identifier(policy)), randomUUID(), context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      repository.accrue(accrueInput(identifier(policy)), randomUUID(), reviewer, correlation),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      repository.transition(
        identifier(result),
        { state: 'PAID', reason: 'Denied', externalReference: 'SYNTHETIC' },
        randomUUID(),
        reviewer,
        correlation,
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await counts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });

  it('enforces release thresholds, exact paid/clawback ledger and terminal states', async () => {
    const { context, db } = state();
    const frozen = await accrue('FROZEN', { releaseCollectionBasisPoints: 10000 });
    const failed = randomUUID();
    await expect(
      repository.transition(
        identifier(frozen),
        { state: 'RELEASED', reason: 'Not collected', externalReference: null },
        randomUUID(),
        context,
        failed,
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      repository.transition(
        identifier(frozen),
        { state: 'PAID', reason: 'Cannot skip release', externalReference: 'SYNTHETIC' },
        randomUUID(),
        context,
        failed,
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    await repository.transition(
      identifier(frozen),
      { state: 'CANCELLED', reason: 'Cancelled', externalReference: null },
      randomUUID(),
      context,
      randomUUID(),
    );
    const released = await accrue('PAYABLE');
    for (const [decision, sequence, externalReference] of [
      ['PAID', 3, 'SYNTHETIC-PAYMENT'],
      ['CLAWED_BACK', 4, 'SYNTHETIC-CLAWBACK'],
    ] as const) {
      await expect(
        repository.transition(
          identifier(released),
          { state: decision, reason: 'Missing reference', externalReference: null },
          randomUUID(),
          context,
          failed,
        ),
      ).rejects.toMatchObject({ code: 'invalid_request' });
      const key = randomUUID(),
        correlation = randomUUID();
      const result = await repository.transition(
        identifier(released),
        { state: decision, reason: decision, externalReference },
        key,
        context,
        correlation,
      );
      expect(result).toMatchObject({ state: decision, amount: '28500.000000' });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      expect(
        (
          await db.query(
            'SELECT aggregate_version FROM domain_event_outbox WHERE correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([{ aggregate_version: sequence }]);
      const replayCorrelation = randomUUID();
      expect(
        await repository.transition(
          identifier(released),
          { state: 'CANCELLED', reason: 'Different replay input', externalReference: null },
          key,
          context,
          replayCorrelation,
        ),
      ).toMatchObject({ state: decision, amount: '28500.000000' });
      expect(await evidenceCounts(replayCorrelation)).toEqual({ audit: '0', outbox: '0' });
    }
    expect(await ledger(identifier(released))).toEqual([
      { sequence: 1, state: 'ACCRUED', amount: '28500.000000' },
      { sequence: 2, state: 'RELEASED', amount: '0.000000' },
      { sequence: 3, state: 'PAID', amount: '28500.000000' },
      { sequence: 4, state: 'CLAWED_BACK', amount: '28500.000000' },
    ]);
    expect(
      (
        await db.query(
          'SELECT effective_state,paid_amount::text,clawed_back_amount::text FROM effective_commission_cases WHERE id=$1',
          [identifier(released)],
        )
      ).rows,
    ).toEqual([
      {
        effective_state: 'CLAWED_BACK',
        paid_amount: '28500.000000',
        clawed_back_amount: '28500.000000',
      },
    ]);
    await expect(
      repository.transition(
        identifier(released),
        { state: 'PAID', reason: 'Closed', externalReference: 'SYNTHETIC' },
        randomUUID(),
        context,
        failed,
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect(await evidenceCounts(failed)).toEqual({ audit: '0', outbox: '0' });
    await expect(
      db.query('DELETE FROM commission_cases WHERE id=$1', [identifier(released)]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'commission evidence is immutable' });
  });

  it('rejects ineligible references and malformed periods with no partial accrual writes', async () => {
    const { context, otherContext } = state();
    const draft = await repository.createPolicy(policyInput('DRAFT', false), context, randomUUID());
    const published = await repository.createPolicy(policyInput('VALID'), context, randomUUID());
    for (const [input, actor, code] of [
      [accrueInput(identifier(draft)), context, 'not_found'],
      [
        {
          ...accrueInput(identifier(published)),
          beneficiaryEmployeeId: otherContext.actor.employeeId,
        },
        context,
        'not_found',
      ],
      [accrueInput(identifier(published)), otherContext, 'not_found'],
      [{ ...accrueInput(identifier(published)), accountingPeriod: '2026-13' }, context, '23514'],
    ] as const) {
      const before = await counts(),
        correlation = randomUUID();
      await expect(
        repository.accrue(input, randomUUID(), actor, correlation),
      ).rejects.toMatchObject({ code });
      expect(await counts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
  });

  it('rolls back ledger/state or policy version plus audit on later outbox conflicts', async () => {
    const { context, db } = state();
    const released = await accrue('COLLISION');
    const existing = randomUUID(),
      correlation = randomUUID();
    await collision('commission.paid', 'commission', identifier(released), 3, existing);
    const before = await counts();
    await expect(
      repository.transition(
        identifier(released),
        { state: 'PAID', reason: 'Outbox conflict', externalReference: 'SYNTHETIC' },
        randomUUID(),
        context,
        correlation,
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await counts()).toEqual(before);
    expect((await ledger(identifier(released))).map((row) => row.state)).toEqual([
      'ACCRUED',
      'RELEASED',
    ]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(await evidenceCounts(existing)).toEqual({ audit: '0', outbox: '1' });
    const policy = await repository.createPolicy(
      policyInput('REVISION-COLLISION', false),
      context,
      randomUUID(),
    );
    await collision(
      'commission-policy.revised',
      'commission-policy',
      identifier(policy, 'policyId'),
      2,
      randomUUID(),
    );
    await expect(
      repository.createPolicyVersion(
        identifier(policy, 'policyId'),
        {
          baseRateBasisPoints: 200,
          minimumMarginBasisPoints: 0,
          releaseCollectionBasisPoints: 0,
          effectiveAt: '2026-02-01T00:00:00Z',
          rules: [],
        },
        context,
        correlation,
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      (
        await db.query('SELECT version FROM commission_policy_versions WHERE policy_id=$1', [
          identifier(policy, 'policyId'),
        ])
      ).rows,
    ).toEqual([{ version: 1 }]);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });
});
