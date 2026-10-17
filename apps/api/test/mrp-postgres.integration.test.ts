import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresMrpRepository } from '../src/mrp-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};

describe('MRP repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let manufacturing: PostgresManufacturingRepository;
  let repository: PostgresMrpRepository;
  let product: JsonObject, material: JsonObject, draft: JsonObject, foreign: JsonObject;
  let initialRun: JsonObject;
  const initialCorrelation = randomUUID();
  const creationEvidence: { correlation: string; action: string; id: string }[] = [];
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const item = (
    sku: string,
    itemType = 'RAW_MATERIAL',
    publish = true,
    context: Parameters<PostgresManufacturingRepository['createItem']>[1] = state().context,
  ) =>
    manufacturing.createItem(
      {
        sku,
        name: sku,
        itemType,
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2025-01-01T00:00:00Z',
        publish,
      },
      context,
      randomUUID(),
    );
  const policy = (itemVersionId: string, makeOrBuy: 'MAKE' | 'BUY') => ({
    itemVersionId,
    safetyStock: makeOrBuy === 'BUY' ? '5' : '0',
    minimumOrderQuantity: makeOrBuy === 'BUY' ? '20' : '0',
    orderMultiple: makeOrBuy === 'BUY' ? '10' : '1',
    leadTimeDays: makeOrBuy === 'BUY' ? 2 : 3,
    freezeWindowDays: 0,
    makeOrBuy,
    effectiveAt: '2025-01-01T00:00:00Z',
  });
  const demand = (itemVersionId: string) => ({
    itemVersionId,
    // An explicit synthetic algorithm demand, not a commercial order/FK fixture.
    sourceType: 'TEST_ALGORITHM',
    sourceId: randomUUID(),
    requiredAt: '2026-02-01',
    quantity: '10',
    priority: 100,
  });
  const runInput = (runNumber: string) => ({
    runNumber,
    asOf: '2026-01-01T00:00:00Z',
    horizonEnd: '2026-03-01',
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
        'SELECT (SELECT count(*)::integer FROM mrp_runs) runs,(SELECT count(*)::integer FROM mrp_demand_snapshots) snapshots,(SELECT count(*)::integer FROM mrp_item_calculations) calculations,(SELECT count(*)::integer FROM mrp_proposals) proposals,(SELECT count(*)::integer FROM mrp_proposal_events) events',
      )
    ).rows[0];
  const proposals = async (runId: string) =>
    (
      await state().db.query<{ id: string; proposal_type: string; frozen: boolean }>(
        'SELECT id,proposal_type,frozen FROM mrp_proposals WHERE mrp_run_id=$1 ORDER BY proposal_type',
        [runId],
      )
    ).rows;
  const proposalState = async (id: string) =>
    (
      await state().db.query<{ state: string; sequence: number }>(
        'SELECT state,sequence FROM mrp_proposal_effective_states WHERE proposal_id=$1',
        [id],
      )
    ).rows[0];
  const transitionInput = { reason: 'Dedicated PG decision', evidence: {} };

  beforeEach(async () => {
    creationEvidence.length = 0;
    fixture = await ownedPostgres('mrp_pg');
    manufacturing = new PostgresManufacturingRepository(fixture.db);
    repository = new PostgresMrpRepository(fixture.db);
    product = await item('FG-1', 'FINISHED_GOOD');
    material = await item('RAW-1');
    draft = await item('DRAFT-1', 'RAW_MATERIAL', false);
    foreign = await item('FOREIGN-1', 'RAW_MATERIAL', true, fixture.otherContext);
    await manufacturing.createBom(
      {
        code: 'BOM-FG',
        name: 'Fixed two-unit BOM with five percent scrap',
        productItemId: identifier(product, 'itemId'),
        productItemVersionId: identifier(product),
        outputQuantity: '1',
        effectiveAt: '2025-01-01T00:00:00Z',
        publish: true,
        lines: [
          {
            componentItemVersionId: identifier(material),
            quantity: '2',
            scrapBasisPoints: 500,
            substitutes: [],
          },
        ],
      },
      fixture.context,
      randomUUID(),
    );
    for (const [version, makeOrBuy] of [
      [product, 'MAKE'],
      [material, 'BUY'],
    ] as const) {
      const correlation = randomUUID();
      const result = await repository.createPolicy(
        policy(identifier(version), makeOrBuy),
        fixture.context,
        correlation,
      );
      creationEvidence.push({ correlation, action: 'mrp-policy.created', id: identifier(result) });
    }
    const correlation = randomUUID();
    const result = await repository.createDemand(
      demand(identifier(product)),
      fixture.context,
      correlation,
    );
    creationEvidence.push({ correlation, action: 'mrp-demand.created', id: identifier(result) });
    initialRun = await repository.run(runInput('BASE'), fixture.context, initialCorrelation);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('explodes a real published BOM, nets fixed quantities and persists paired evidence', async () => {
    expect(initialRun).toMatchObject({
      status: 'COMPUTED',
      calculationCount: 2,
      proposalCount: 2,
      freezeUntil: '2026-01-01',
    });
    const runs = await repository.list('runs', state().context);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: identifier(initialRun),
      calculations: [
        {
          sku: 'FG-1',
          gross_demand: 10,
          on_hand: 0,
          scheduled_receipts: 0,
          safety_stock: 0,
          net_requirement: 10,
          planned_quantity: 10,
          make_or_buy: 'MAKE',
        },
        {
          sku: 'RAW-1',
          gross_demand: 21,
          on_hand: 0,
          scheduled_receipts: 0,
          safety_stock: 5,
          net_requirement: 26,
          planned_quantity: 30,
          make_or_buy: 'BUY',
        },
      ],
      proposals: [
        {
          sku: 'FG-1',
          proposal_type: 'PRODUCTION',
          quantity: 10,
          start_at: '2026-01-29',
          due_at: '2026-02-01',
          frozen: false,
          effectiveState: 'PROPOSED',
          events: [{ sequence: 1, state: 'PROPOSED', correlation_id: initialCorrelation }],
        },
        {
          sku: 'RAW-1',
          proposal_type: 'PURCHASE',
          quantity: 30,
          start_at: '2026-01-30',
          due_at: '2026-02-01',
          frozen: false,
          effectiveState: 'PROPOSED',
          events: [{ sequence: 1, state: 'PROPOSED', correlation_id: initialCorrelation }],
        },
      ],
    });
    expect(await counts()).toEqual({
      runs: 1,
      snapshots: 1,
      calculations: 2,
      proposals: 2,
      events: 2,
    });
    for (const { correlation, action, id } of [
      ...creationEvidence,
      { correlation: initialCorrelation, action: 'mrp.computed', id: identifier(initialRun) },
    ]) {
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      const aggregateType =
        action === 'mrp.computed' ? 'mrp-run' : action.slice(0, -'.created'.length);
      expect(
        (
          await state().db.query(
            'SELECT a.action,a.target_id,o.event_type,o.aggregate_type,o.aggregate_id,o.aggregate_version FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id WHERE a.correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([
        {
          action,
          target_id: id,
          event_type: action,
          aggregate_type: aggregateType,
          aggregate_id: id,
          aggregate_version: 1,
        },
      ]);
    }
  });

  it('rejects non-company scopes and keeps GROUP reads and writes inside the actor tenant', async () => {
    const { context, otherContext } = state();
    const firstProposal = (await proposals(identifier(initialRun)))[0];
    if (!firstProposal) throw new Error('Expected base proposal');
    for (const scopes of [[], ['SELF'], ['TEAM']] as const) {
      const denied = { ...context, scopes };
      await expect(repository.list('runs', denied)).rejects.toMatchObject({ code: 'forbidden' });
      await expect(
        repository.createPolicy(policy(identifier(product), 'MAKE'), denied, randomUUID()),
      ).rejects.toMatchObject({ code: 'forbidden' });
      await expect(
        repository.createDemand(demand(identifier(product)), denied, randomUUID()),
      ).rejects.toMatchObject({ code: 'forbidden' });
      await expect(repository.run(runInput('DENIED'), denied, randomUUID())).rejects.toMatchObject({
        code: 'forbidden',
      });
      await expect(
        repository.transitionProposal(
          firstProposal.id,
          'APPROVED',
          transitionInput,
          denied,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
    }
    for (const view of ['policies', 'demands', 'runs'] as const)
      expect(await repository.list(view, { ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    await expect(
      repository.transitionProposal(
        firstProposal.id,
        'APPROVED',
        transitionInput,
        otherContext,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await proposalState(firstProposal.id)).toEqual({ state: 'PROPOSED', sequence: 1 });
    expect(await repository.list('policies', { ...context, scopes: ['GROUP'] })).toHaveLength(2);
    expect(await repository.list('demands', context)).toHaveLength(1);
  });

  it('requires published tenant versions and preserves uniqueness without inventing idempotency', async () => {
    const { context, db } = state();
    for (const version of [identifier(draft), identifier(foreign), randomUUID()]) {
      for (const operation of [
        (correlation: string) =>
          repository.createPolicy(policy(version, 'MAKE'), context, correlation),
        (correlation: string) => repository.createDemand(demand(version), context, correlation),
      ]) {
        const correlation = randomUUID();
        await expect(operation(correlation)).rejects.toMatchObject({ code: 'conflict' });
        expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
      }
    }
    const duplicate = randomUUID();
    await expect(
      repository.createPolicy(policy(identifier(product), 'MAKE'), context, duplicate),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await evidenceCounts(duplicate)).toEqual({ audit: '0', outbox: '0' });
    const stored = (
      await db.query<{ source_id: string }>('SELECT source_id FROM mrp_demand_signals')
    ).rows[0];
    if (!stored) throw new Error('Expected base demand');
    await expect(
      repository.createDemand(
        { ...demand(identifier(product)), sourceId: stored.source_id },
        context,
        duplicate,
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await evidenceCounts(duplicate)).toEqual({ audit: '0', outbox: '0' });
    expect(await repository.list('policies', context)).toHaveLength(2);
    expect(await repository.list('demands', context)).toHaveLength(1);
  });

  it('makes distinct runs with identical input hashes and atomically rejects a duplicate run number', async () => {
    const { context } = state();
    const second = await repository.run(runInput('REPEAT'), context, randomUUID());
    expect(identifier(second)).not.toBe(identifier(initialRun));
    expect(second.inputHash).toBe(initialRun.inputHash);
    const before = await counts(),
      correlation = randomUUID();
    await expect(repository.run(runInput('REPEAT'), context, correlation)).rejects.toMatchObject({
      code: '23505',
    });
    expect(await counts()).toEqual(before);
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
  });

  it('enforces frozen approval evidence, contiguous decisions and immutable computed evidence', async () => {
    const { context, db } = state();
    await repository.createPolicy(
      {
        ...policy(identifier(product), 'MAKE'),
        effectiveAt: '2026-01-02T00:00:00Z',
        freezeWindowDays: 30,
      },
      context,
      randomUUID(),
    );
    const frozenRun = await repository.run(
      { ...runInput('FROZEN'), asOf: '2026-01-02T00:00:00Z' },
      context,
      randomUUID(),
    );
    expect(frozenRun.freezeUntil).toBe('2026-02-01');
    const entries = await proposals(identifier(frozenRun));
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.frozen)).toBe(true);
    const proposal = entries[0];
    if (!proposal) throw new Error('Expected frozen proposal');
    const failed = randomUUID();
    await expect(
      repository.transitionProposal(proposal.id, 'APPROVED', transitionInput, context, failed),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'frozen proposal approval requires override evidence',
    });
    expect(await proposalState(proposal.id)).toEqual({ state: 'PROPOSED', sequence: 1 });
    expect(await evidenceCounts(failed)).toEqual({ audit: '0', outbox: '0' });
    for (const [decision, sequence] of [
      ['APPROVED', 2],
      ['RELEASED', 3],
    ] as const) {
      const correlation = randomUUID();
      expect(
        await repository.transitionProposal(
          proposal.id,
          decision,
          { ...transitionInput, evidence: { freezeOverrideApproval: 'synthetic-pg-approval' } },
          context,
          correlation,
        ),
      ).toMatchObject({ id: proposal.id, state: decision, sequence });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
    }
    await expect(
      repository.transitionProposal(proposal.id, 'CANCELLED', transitionInput, context, failed),
    ).rejects.toMatchObject({ code: 'P0001', message: 'closed proposal is immutable' });
    expect(await proposalState(proposal.id)).toEqual({ state: 'RELEASED', sequence: 3 });
    expect(
      (
        await db.query(
          'SELECT sequence,state FROM mrp_proposal_events WHERE proposal_id=$1 ORDER BY sequence',
          [proposal.id],
        )
      ).rows,
    ).toEqual([
      { sequence: 1, state: 'PROPOSED' },
      { sequence: 2, state: 'APPROVED' },
      { sequence: 3, state: 'RELEASED' },
    ]);
    for (const sql of [
      'UPDATE mrp_demand_snapshots SET quantity=999 WHERE mrp_run_id=$1',
      'DELETE FROM mrp_item_calculations WHERE mrp_run_id=$1',
      'DELETE FROM mrp_proposals WHERE mrp_run_id=$1',
    ])
      await expect(db.query(sql, [identifier(frozenRun)])).rejects.toMatchObject({
        code: 'P0001',
        message: 'computed MRP evidence is immutable',
      });
    await expect(
      db.query('DELETE FROM mrp_proposal_events WHERE proposal_id=$1', [proposal.id]),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rolls back a proposal decision and its audit when outbox uniqueness fails afterwards', async () => {
    const { db, context, company } = state();
    const proposal = (await proposals(identifier(initialRun)))[0];
    if (!proposal) throw new Error('Expected base proposal');
    const collision = randomUUID(),
      correlation = randomUUID();
    await db.query(
      "INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,payload,correlation_id) VALUES($1,'mrp-proposal.approved',1,'mrp-proposal',$2,1,now(),'{}'::jsonb,$3)",
      [company, proposal.id, collision],
    );
    await expect(
      repository.transitionProposal(proposal.id, 'APPROVED', transitionInput, context, correlation),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await proposalState(proposal.id)).toEqual({ state: 'PROPOSED', sequence: 1 });
    expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    expect(await evidenceCounts(collision)).toEqual({ audit: '0', outbox: '1' });
  });

  it('rejects skipped decisions and stops new decisions once the run is closed', async () => {
    const { context, db } = state();
    const run = await repository.run(runInput('DECISIONS'), context, randomUUID());
    const entries = await proposals(identifier(run));
    const rejected = entries[0],
      cancelled = entries[1];
    if (!rejected || !cancelled) throw new Error('Expected two decision proposals');
    const invalid = randomUUID();
    await expect(
      repository.transitionProposal(rejected.id, 'RELEASED', transitionInput, context, invalid),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'proposal requires approval, rejection, or cancellation',
    });
    await expect(
      db.query(
        "INSERT INTO mrp_proposal_events(tenant_id,proposal_id,sequence,state,reason,evidence,actor_id,correlation_id,canonical_hash) SELECT tenant_id,proposal_id,99,'REJECTED',reason,evidence,actor_id,$2,canonical_hash FROM mrp_proposal_events WHERE proposal_id=$1 AND sequence=1",
        [rejected.id, invalid],
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'proposal event sequence must be contiguous',
    });
    expect(await evidenceCounts(invalid)).toEqual({ audit: '0', outbox: '0' });
    expect(await proposalState(rejected.id)).toEqual({ state: 'PROPOSED', sequence: 1 });
    for (const [proposal, decision] of [
      [rejected, 'REJECTED'],
      [cancelled, 'CANCELLED'],
    ] as const) {
      const correlation = randomUUID();
      await repository.transitionProposal(
        proposal.id,
        decision,
        transitionInput,
        context,
        correlation,
      );
      expect(await proposalState(proposal.id)).toEqual({ state: decision, sequence: 2 });
      expect(await evidenceCounts(correlation)).toEqual({ audit: '1', outbox: '1' });
      await expect(
        repository.transitionProposal(proposal.id, 'APPROVED', transitionInput, context, invalid),
      ).rejects.toMatchObject({ code: 'P0001', message: 'closed proposal is immutable' });
    }
    const closed = await repository.run(runInput('CLOSED'), context, randomUUID());
    const pending = (await proposals(identifier(closed)))[0];
    if (!pending) throw new Error('Expected pending proposal');
    await db.query("UPDATE mrp_runs SET status='CANCELLED' WHERE id=$1", [identifier(closed)]);
    await expect(
      repository.transitionProposal(pending.id, 'APPROVED', transitionInput, context, invalid),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'proposal decisions require a computed active MRP run',
    });
    expect(await proposalState(pending.id)).toEqual({ state: 'PROPOSED', sequence: 1 });
    expect(await evidenceCounts(invalid)).toEqual({ audit: '0', outbox: '0' });
  });

  it('rolls back runs and snapshots for cyclic BOMs and empty demand horizons', async () => {
    const { context } = state();
    await manufacturing.createBom(
      {
        code: 'BOM-CYCLE',
        name: 'Reverse edge creates a real cycle',
        productItemId: identifier(material, 'itemId'),
        productItemVersionId: identifier(material),
        outputQuantity: '1',
        effectiveAt: '2026-04-01T00:00:00Z',
        publish: true,
        lines: [
          {
            componentItemVersionId: identifier(product),
            quantity: '1',
            scrapBasisPoints: 0,
            substitutes: [],
          },
        ],
      },
      context,
      randomUUID(),
    );
    await repository.createDemand(
      { ...demand(identifier(product)), requiredAt: '2026-05-01' },
      context,
      randomUUID(),
    );
    for (const [input, message] of [
      [
        { runNumber: 'CYCLE', asOf: '2026-04-01T00:00:00Z', horizonEnd: '2026-06-01' },
        'MRP rejected a cyclic or excessively deep BOM graph',
      ],
      [
        { runNumber: 'EMPTY', asOf: '2028-01-01T00:00:00Z', horizonEnd: '2028-02-01' },
        'MRP horizon contains no demand to calculate',
      ],
    ] as const) {
      const before = await counts(),
        correlation = randomUUID();
      await expect(repository.run(input, context, correlation)).rejects.toMatchObject({
        code: 'conflict',
        message,
      });
      expect(await counts()).toEqual(before);
      expect(await evidenceCounts(correlation)).toEqual({ audit: '0', outbox: '0' });
    }
  });
});
