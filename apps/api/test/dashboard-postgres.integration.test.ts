import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { PostgresDashboardRepository } from '../src/dashboard-repositories.js';
import { PostgresCommissionRepository } from '../src/commission-repositories.js';
import { PostgresRiskRepository } from '../src/risk-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const record = (value: JsonObject[string] | undefined): JsonObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected dashboard object');
  return value as JsonObject;
};
const values = (result: JsonObject) =>
  Object.fromEntries(
    Object.entries(record(result.metrics)).map(([key, metric]) => [key, record(metric).value]),
  );
const allZero = {
  weightedForecast: 0,
  bookedRevenue: 0,
  grossMargin: 0,
  cashCollected: 0,
  openReceivable: 0,
  overdueReceivable: 0,
  releasedOrders: 0,
  activeRisks: 0,
  criticalRisks: 0,
  commissionAccrued: 0,
};
const expected = {
  weightedForecast: 570000,
  bookedRevenue: 950000,
  grossMargin: 250000,
  cashCollected: 100000,
  openReceivable: 850000,
  overdueReceivable: 850000,
  releasedOrders: 1,
  activeRisks: 1,
  criticalRisks: 0,
  commissionAccrued: 28500,
};
const input = { from: '2000-01-01T00:00:00Z', to: '2100-01-01T00:00:00Z', currency: 'CNY' };

describe('dashboard repository real PostgreSQL contracts', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  let repository: PostgresDashboardRepository;
  const state = () => {
    if (!fixture) throw new Error('Owned commercial fixture not initialized');
    return fixture;
  };
  const writes = async () =>
    (
      await state().db.query(
        'SELECT (SELECT count(*)::integer FROM audit_events) audit,(SELECT count(*)::integer FROM domain_event_outbox) outbox,(SELECT count(*)::integer FROM risk_task_events) risk_events,(SELECT count(*)::integer FROM commission_ledger_entries) commission_entries',
      )
    ).rows[0];
  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
    repository = new PostgresDashboardRepository(fixture.db);
  }, 30_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('aggregates ten fixed metrics and source-bound drilldowns from the real commercial graph', async () => {
    const { context, db, graph } = state();
    const result = await repository.get(input, context);
    expect(values(result)).toEqual(expected);
    expect(result).toMatchObject({
      filters: { currency: 'CNY' },
      metrics: {
        bookedRevenue: {
          value: 950000,
          unit: 'CNY',
          source: 'sales_orders',
          basis: 'released order date',
        },
        grossMargin: {
          value: 250000,
          source: 'quote_revisions',
          basis: 'pinned issued quote margin',
        },
        cashCollected: {
          value: 100000,
          source: 'allocation_entries',
          basis: 'allocation posting date',
        },
        openReceivable: {
          value: 850000,
          source: 'ar_open_item_balances',
          basis: 'as-of open-item balance',
        },
        releasedOrders: { value: 1, unit: 'orders' },
        activeRisks: { value: 1, unit: 'cases' },
      },
      drilldowns: {
        orders: [
          {
            id: graph.orderId,
            orderNumber: 'AUTH-ORDER',
            total: 950000,
            margin: 250000,
            status: 'RELEASED',
          },
        ],
        overdue: [{ documentNumber: 'SENSITIVE-AR', remaining: 850000 }],
        risks: [{ salesOrderId: graph.orderId, severity: 'HIGH', score: 60, state: 'OPEN' }],
      },
    });
    expect(typeof result.refreshedAt).toBe('string');
    if (typeof result.refreshedAt !== 'string') throw new Error('Refresh timestamp missing');
    expect(Number.isFinite(Date.parse(result.refreshedAt))).toBe(true);
    expect(
      (await db.query('SELECT status FROM sales_orders WHERE id=$1', [graph.orderId])).rows,
    ).toEqual([{ status: 'RELEASED' }]);
  });

  it('applies real owner and tenant scope across every metric and drilldown', async () => {
    const { context, otherContext, reviewerEmployee } = state();
    for (const scopes of [['SELF'], ['COMPANY'], ['GROUP']] as const)
      expect(values(await repository.get(input, { ...context, scopes }))).toEqual(expected);
    for (const actor of [
      { ...context, scopes: [] },
      {
        ...context,
        actor: { ...context.actor, employeeId: reviewerEmployee },
        scopes: ['SELF'] as const,
      },
      { ...otherContext, scopes: ['GROUP'] as const },
    ]) {
      const result = await repository.get(input, actor);
      expect(values(result)).toEqual(allZero);
      expect(result.drilldowns).toEqual({ orders: [], overdue: [], risks: [] });
    }
  });

  it('preserves the existing currency and from/as-of asymmetries without rewriting SQL', async () => {
    const { context } = state();
    // Risk has no currency predicate in the current query; financial metrics do.
    const usd = await repository.get({ ...input, currency: 'USD' }, context);
    expect(values(usd)).toEqual({ ...allZero, activeRisks: 1 });
    expect(usd).toMatchObject({
      drilldowns: { orders: [], overdue: [], risks: [{ severity: 'HIGH', score: 60 }] },
    });
    // AR and risks are as-of `to`; they do not share the period's `from` filter.
    const future = await repository.get({ ...input, from: '2099-01-01T00:00:00Z' }, context);
    expect(values(future)).toEqual({
      ...allZero,
      openReceivable: 850000,
      overdueReceivable: 850000,
      activeRisks: 1,
    });
    expect(future).toMatchObject({
      drilldowns: { orders: [], overdue: [{ remaining: 850000 }], risks: [{ severity: 'HIGH' }] },
    });
    expect(values(await repository.get({ ...input, to: '2001-01-01T00:00:00Z' }, context))).toEqual(
      allZero,
    );
  });

  it('uses inclusive starts, exclusive ends and allocation posting rather than bank receipt dates', async () => {
    const { context, db, graph } = state();
    const order = (
      await db.query<{ created_at: string }>(
        'SELECT created_at::text FROM sales_orders WHERE id=$1',
        [graph.orderId],
      )
    ).rows[0];
    const allocation = (
      await db.query<{ created_at: string; received_at: string }>(
        'SELECT a.created_at::text,p.received_at::text FROM allocation_entries a JOIN bank_payments p ON p.id=a.bank_payment_id AND p.tenant_id=a.tenant_id',
      )
    ).rows[0];
    if (!order || !allocation) throw new Error('Boundary fixture evidence missing');
    expect(
      values(await repository.get({ ...input, from: order.created_at }, context)),
    ).toMatchObject({ bookedRevenue: 950000, releasedOrders: 1 });
    expect(values(await repository.get({ ...input, to: order.created_at }, context))).toMatchObject(
      { bookedRevenue: 0, releasedOrders: 0 },
    );
    expect(
      values(await repository.get({ ...input, from: allocation.created_at }, context)),
    ).toMatchObject({ cashCollected: 100000 });
    expect(
      values(
        await repository.get(
          { ...input, from: allocation.received_at, to: allocation.created_at },
          context,
        ),
      ),
    ).toMatchObject({ cashCollected: 0 });
  });

  it('projects latest task closure and pinned accrual without performing new writes', async () => {
    const { context, db } = state();
    const task = (await db.query<{ id: string }>('SELECT id FROM risk_tasks')).rows[0];
    const commission = (await db.query<{ id: string }>('SELECT id FROM commission_cases')).rows[0];
    if (!task || !commission) throw new Error('Fixture task or commission missing');
    await new PostgresRiskRepository(db).transitionTask(
      task.id,
      { state: 'CLOSED', reason: 'Synthetic resolution', evidence: { resolved: true } },
      randomUUID(),
      context,
      randomUUID(),
    );
    await new PostgresCommissionRepository(db).transition(
      commission.id,
      { state: 'CANCELLED', reason: 'Synthetic cancellation', externalReference: null },
      randomUUID(),
      context,
      randomUUID(),
    );
    const before = await writes();
    const result = await repository.get(input, context);
    expect(values(result)).toEqual({ ...expected, activeRisks: 0 });
    expect(result).toMatchObject({ drilldowns: { risks: [{ state: 'CLOSED', score: 60 }] } });
    expect(await writes()).toEqual(before);
  });
});
