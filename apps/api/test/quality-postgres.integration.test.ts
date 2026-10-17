import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { PostgresQualityRepository } from '../src/quality-repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

const id = (value: JsonObject): string => {
  if (typeof value.id !== 'string') throw new Error('Fixture ID missing');
  return value.id;
};
const event = (idempotencyKey: string) => ({
  reason: 'Fixed quality evidence',
  evidence: { checked: true },
  idempotencyKey,
});

describe('quality repository and immutable ledgers on real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedPostgres>> | undefined;
  let quality: PostgresQualityRepository;
  let itemId: string, lotId: string;
  const owned = () => {
    if (!fixture) throw new Error('Owned quality fixture missing');
    return fixture;
  };
  const planInput = () => ({
    code: 'QUALITY-1',
    name: 'Fixed inspection plan',
    itemVersionId: itemId,
    inspectionStage: 'INCOMING' as const,
    samplingMethod: 'ONE',
    acceptanceRule: { allRequired: true },
    effectiveAt: '2026-01-01T00:00:00Z',
    publish: false,
    characteristics: [
      {
        code: 'LENGTH',
        name: 'Length',
        dataType: 'NUMERIC' as const,
        unitCode: 'M',
        lowerLimit: '10',
        upperLimit: '12',
        required: true,
        instructions: 'Inclusive limits',
      },
      {
        code: 'PACK',
        name: 'Packaging',
        dataType: 'BOOLEAN' as const,
        required: true,
        instructions: 'Check packaging',
      },
      {
        code: 'MARK',
        name: 'Mark',
        dataType: 'TEXT' as const,
        required: true,
        instructions: 'Read mark',
      },
    ],
  });
  const openInput = (planVersionId: string) => ({
    inspectionNumber: 'INSPECTION-1',
    planVersionId,
    lotId,
    sourceType: 'SYNTHETIC_LOT',
    sourceId: lotId,
    sampleSize: '1',
  });
  const counts = async () =>
    (
      await owned().db.query(
        'SELECT (SELECT count(*)::integer FROM quality_inspection_events) inspections,(SELECT count(*)::integer FROM inventory_lot_quality_events) lots,(SELECT count(*)::integer FROM quality_inspection_results) results,(SELECT count(*)::integer FROM audit_events) audits,(SELECT count(*)::integer FROM domain_event_outbox) outbox',
      )
    ).rows[0];
  const open = async () => {
    const { context, db } = owned();
    const plan = await quality.createPlan(planInput(), context, randomUUID());
    await quality.publishPlan(id(plan), context, randomUUID());
    const inspection = await quality.openInspection(openInput(id(plan)), context, randomUUID());
    const characteristics = (
      await db.query<{ id: string; code: string }>(
        'SELECT id,code FROM quality_plan_characteristics WHERE inspection_plan_version_id=$1 ORDER BY sequence',
        [id(plan)],
      )
    ).rows;
    const characteristic = (code: string) => {
      const row = characteristics.find((value) => value.code === code);
      if (!row) throw new Error('Fixture characteristic missing');
      return row.id;
    };
    return { plan, inspection, characteristic };
  };
  const results = async (
    inspectionId: string,
    characteristic: (code: string) => string,
    length = '10',
    passed = true,
  ) => {
    for (const input of [
      { characteristicId: characteristic('LENGTH'), measuredNumeric: length, passed },
      { characteristicId: characteristic('PACK'), measuredBoolean: true, passed: true },
      { characteristicId: characteristic('MARK'), measuredText: 'KT-FIXED', passed: true },
    ])
      await quality.recordResult(
        inspectionId,
        {
          ...input,
          notes: 'Fixed observation',
          occurredAt: '2026-01-02T00:00:00Z',
          idempotencyKey: randomUUID(),
        },
        owned().context,
        randomUUID(),
      );
  };
  beforeEach(async () => {
    fixture = await ownedPostgres('quality_pg');
    quality = new PostgresQualityRepository(fixture.db);
    const item = await new PostgresManufacturingRepository(fixture.db).createItem(
      {
        sku: 'QUALITY-RAW',
        name: 'Quality material',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'M',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      fixture.context,
      randomUUID(),
    );
    itemId = id(item);
    // Explicit synthetic QUARANTINE lot with real tenant/item FKs; not procurement receipt proof.
    const lot = (
      await fixture.db.query<{ id: string }>(
        "INSERT INTO inventory_lots(tenant_id,lot_number,item_version_id,quality_status) VALUES($1,'QUALITY-LOT',$2,'QUARANTINE') RETURNING id",
        [fixture.company, itemId],
      )
    ).rows[0];
    if (!lot) throw new Error('Fixture lot missing');
    lotId = lot.id;
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it.each(['10', '12'])(
    'pins published plan, typed results and inclusive boundary %s through release',
    async (length) => {
      const { context, db } = owned();
      const { plan, inspection, characteristic } = await open();
      await quality.transitionInspection(
        id(inspection),
        'SAMPLED',
        event('SAMPLE'),
        context,
        randomUUID(),
      );
      await results(id(inspection), characteristic, length);
      await quality.transitionInspection(
        id(inspection),
        'COMPLETED',
        event('COMPLETE'),
        context,
        randomUUID(),
      );
      const correlation = randomUUID();
      await quality.dispose(id(inspection), 'RELEASED', event('RELEASE'), context, correlation);
      expect(await quality.list('plans', context)).toMatchObject([
        {
          id: id(plan),
          status: 'PUBLISHED',
          characteristics: [
            { code: 'LENGTH', sequence: 1 },
            { code: 'PACK', sequence: 2 },
            { code: 'MARK', sequence: 3 },
          ],
        },
      ]);
      expect(await quality.list('inspections', context)).toMatchObject([
        {
          id: id(inspection),
          inspection_plan_version_id: id(plan),
          state: 'DISPOSITIONED',
          stateSequence: 4,
          results: [
            { measured_numeric: Number(length), passed: true },
            { measured_boolean: true, passed: true },
            { measured_text: 'KT-FIXED', passed: true },
          ],
          events: [
            { state: 'OPEN', sequence: 1 },
            { state: 'SAMPLED', sequence: 2 },
            { state: 'COMPLETED', sequence: 3 },
            { state: 'DISPOSITIONED', sequence: 4 },
          ],
        },
      ]);
      expect(await quality.list('lots', context)).toMatchObject([
        {
          lotId,
          qualityStatus: 'RELEASED',
          inspectionId: id(inspection),
          movements: [],
          usedByOrders: [],
          producedRolls: [],
          qualityEvents: [
            { state: 'QUARANTINE', sequence: 1 },
            { state: 'RELEASED', sequence: 2 },
          ],
        },
      ]);
      expect(
        (
          await db.query(
            'SELECT a.action,a.target_type,a.target_id,o.event_type,o.aggregate_type,o.aggregate_id FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id WHERE a.correlation_id=$1',
            [correlation],
          )
        ).rows,
      ).toEqual([
        {
          action: 'quality-inspection.released',
          target_type: 'quality-inspection',
          target_id: id(inspection),
          event_type: 'quality-inspection.released',
          aggregate_type: 'quality-inspection',
          aggregate_id: id(inspection),
        },
      ]);
      await expect(
        db.query('UPDATE quality_plan_characteristics SET name=$1 WHERE id=$2', [
          'changed',
          characteristic('LENGTH'),
        ]),
      ).rejects.toMatchObject({
        code: 'P0001',
        message: 'published quality plan characteristics are immutable',
      });
      await expect(
        db.query('DELETE FROM quality_inspection_results WHERE inspection_id=$1', [id(inspection)]),
      ).rejects.toMatchObject({ code: 'P0001', message: 'quality evidence is immutable' });
    },
  );

  it('rejects premature completion, wrong types, wrong numeric verdicts and duplicate observations without evidence writes', async () => {
    const { context } = owned();
    const { inspection, characteristic } = await open();
    const inspectionId = id(inspection);
    await quality.transitionInspection(
      inspectionId,
      'SAMPLED',
      event('SAMPLE'),
      context,
      randomUUID(),
    );
    const before = await counts();
    await expect(
      quality.transitionInspection(
        inspectionId,
        'COMPLETED',
        event('EARLY'),
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'inspection completion requires all mandatory results',
    });
    for (const input of [
      { characteristicId: characteristic('LENGTH'), measuredNumeric: '9', passed: true },
      { characteristicId: characteristic('LENGTH'), measuredText: '10', passed: true },
      { characteristicId: characteristic('PACK'), measuredNumeric: '1', passed: true },
    ])
      await expect(
        quality.recordResult(
          inspectionId,
          { ...input, notes: '', occurredAt: '2026-01-02T00:00:00Z', idempotencyKey: randomUUID() },
          context,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'P0001' });
    expect(await counts()).toEqual(before);
    await results(inspectionId, characteristic);
    const recorded = await counts();
    await expect(
      quality.recordResult(
        inspectionId,
        {
          characteristicId: characteristic('LENGTH'),
          measuredNumeric: '10',
          passed: true,
          notes: '',
          occurredAt: '2026-01-02T00:00:00Z',
          idempotencyKey: 'DUPLICATE',
        },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await counts()).toEqual(recorded);
  });

  it('rejects release of a failed inspection but permits inspected rejection', async () => {
    const { context } = owned();
    const { inspection, characteristic } = await open();
    await quality.transitionInspection(
      id(inspection),
      'SAMPLED',
      event('SAMPLE'),
      context,
      randomUUID(),
    );
    await results(id(inspection), characteristic, '12.000001', false);
    await quality.transitionInspection(
      id(inspection),
      'COMPLETED',
      event('COMPLETE'),
      context,
      randomUUID(),
    );
    const before = await counts();
    await expect(
      quality.dispose(id(inspection), 'RELEASED', event('BAD-RELEASE'), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'P0001', message: 'failed inspection cannot release lot' });
    expect(await counts()).toEqual(before);
    await quality.dispose(id(inspection), 'REJECTED', event('REJECT'), context, randomUUID());
    expect(await quality.list('lots', context)).toMatchObject([
      { lotId, qualityStatus: 'REJECTED' },
    ]);
    expect(await quality.list('inspections', context)).toMatchObject([{ state: 'DISPOSITIONED' }]);
  });

  it('keeps GROUP tenant-bound, denies narrow scopes, and refuses unpublished or foreign plan use', async () => {
    const { context, otherContext } = owned();
    const draft = await quality.createPlan(planInput(), context, randomUUID());
    await expect(
      quality.openInspection(openInput(id(draft)), context, randomUUID()),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(quality.publishPlan(id(draft), otherContext, randomUUID())).rejects.toMatchObject({
      code: 'not_found',
    });
    await quality.publishPlan(id(draft), context, randomUUID());
    await expect(
      quality.openInspection(openInput(id(draft)), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'conflict' });
    await quality.openInspection(openInput(id(draft)), context, randomUUID());
    for (const view of ['plans', 'inspections', 'lots'] as const) {
      expect(await quality.list(view, { ...context, scopes: ['GROUP'] })).toHaveLength(1);
      expect(await quality.list(view, { ...otherContext, scopes: ['GROUP'] })).toEqual([]);
    }
    const inspectionId = id((await quality.list('inspections', context))[0] ?? {});
    const before = await counts();
    for (const scopes of [[], ['SELF'], ['TEAM']] as const) {
      const denied = { ...context, scopes };
      for (const view of ['plans', 'inspections', 'lots'] as const)
        await expect(quality.list(view, denied)).rejects.toMatchObject({ code: 'forbidden' });
      for (const operation of [
        () => quality.createPlan({ ...planInput(), code: 'DENIED' }, denied, randomUUID()),
        () => quality.publishPlan(id(draft), denied, randomUUID()),
        () => quality.openInspection(openInput(id(draft)), denied, randomUUID()),
        () =>
          quality.transitionInspection(
            inspectionId,
            'SAMPLED',
            event('DENIED'),
            denied,
            randomUUID(),
          ),
        () =>
          quality.recordResult(
            inspectionId,
            {
              characteristicId: randomUUID(),
              measuredNumeric: '10',
              passed: true,
              notes: '',
              occurredAt: '2026-01-02T00:00:00Z',
              idempotencyKey: 'DENIED',
            },
            denied,
            randomUUID(),
          ),
        () => quality.dispose(inspectionId, 'RELEASED', event('DENIED'), denied, randomUUID()),
      ])
        await expect(operation()).rejects.toMatchObject({ code: 'forbidden' });
    }
    await expect(
      quality.transitionInspection(
        inspectionId,
        'SAMPLED',
        event('FOREIGN'),
        otherContext,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      quality.dispose(inspectionId, 'RELEASED', event('FOREIGN'), otherContext, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await counts()).toEqual(before);
  });

  it('rolls back the first disposition ledger insert when the later inspection key conflicts', async () => {
    const { context } = owned();
    const { inspection, characteristic } = await open();
    await quality.transitionInspection(
      id(inspection),
      'SAMPLED',
      event('DISPOSE:INSPECTION'),
      context,
      randomUUID(),
    );
    await results(id(inspection), characteristic);
    await quality.transitionInspection(
      id(inspection),
      'COMPLETED',
      event('COMPLETE'),
      context,
      randomUUID(),
    );
    const before = await counts();
    await expect(
      quality.dispose(id(inspection), 'RELEASED', event('DISPOSE'), context, randomUUID()),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await counts()).toEqual(before);
    expect(await quality.list('lots', context)).toMatchObject([
      { qualityStatus: 'QUARANTINE', qualityEvents: [{ state: 'QUARANTINE', sequence: 1 }] },
    ]);
    expect(await quality.list('inspections', context)).toMatchObject([
      { state: 'COMPLETED', stateSequence: 3 },
    ]);
    await quality.dispose(
      id(inspection),
      'RELEASED',
      event('RETRY-FRESH-KEY'),
      context,
      randomUUID(),
    );
    expect(await quality.list('lots', context)).toMatchObject([{ qualityStatus: 'RELEASED' }]);
  });
});
