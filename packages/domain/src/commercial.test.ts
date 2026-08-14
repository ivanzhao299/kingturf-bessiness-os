import { describe, expect, it } from 'vitest';
import {
  addDecimal,
  assertOpportunityTransition,
  calculateBasisPoints,
  calculateCost,
  calculateCreditExposure,
  canonicalize,
  evaluateCreditEligibility,
  evaluateCommercialRule,
  multiplyDecimal,
  assertCreditDecisionUsable,
  reconcileAllocations,
} from './index.js';

describe('commercial domain', () => {
  it('calculates exact scaled decimals without floating point drift', () => {
    expect(addDecimal('0.1', '0.2')).toBe('0.3');
    expect(multiplyDecimal('12.5', '3')).toBe('37.5');
    expect(multiplyDecimal('1.000001', '2.000001')).toBe('2.000003');
    expect(calculateBasisPoints('0.000001', '0.000003')).toBe(3333);
    expect(calculateBasisPoints('-1', '3')).toBe(-3333);
    expect(() => calculateBasisPoints('1', '0')).toThrow(/positive/u);
    const decision = calculateCost(
      {
        modelVersionId: 'model-v1',
        currency: 'CNY',
        context: { segment: 'A' },
        lines: [
          {
            key: 'x',
            description: 'item',
            quantity: { value: '3', unit: 'EA' },
            unitCost: { amount: '12.5', currency: 'CNY' },
          },
        ],
      },
      [],
    );
    expect(decision.total).toBe('37.5');
  });
  it('canonicalizes keys and evaluates only the closed AST', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(
      evaluateCommercialRule(
        {
          op: 'eq',
          left: { op: 'input', path: 'customer.segment' },
          right: { op: 'literal', value: 'A' },
        },
        { customer: { segment: 'A' } },
      ),
    ).toBe(true);
  });
  it('guards opportunity lifecycle', () => {
    expect(() => {
      assertOpportunityTransition('OPEN', 'QUALIFIED');
    }).not.toThrow();
    expect(() => {
      assertOpportunityTransition('WON', 'OPEN');
    }).toThrow(/Illegal opportunity transition/u);
  });
  it('calculates credit exposure and the exact limit boundary', () => {
    const exposure = calculateCreditExposure({
      currency: 'CNY',
      receivables: ['100.000001', '20'],
      uninvoicedOrders: ['10'],
      unappliedPayments: ['30.000001'],
    });
    expect(exposure.exposure.amount).toBe('100');
    expect(
      evaluateCreditEligibility({
        limit: { amount: '125', currency: 'CNY', scale: 6 },
        exposure: exposure.exposure,
        requested: { amount: '25', currency: 'CNY', scale: 6 },
      }).eligible,
    ).toBe(true);
    expect(() =>
      evaluateCreditEligibility({
        limit: { amount: '125', currency: 'USD', scale: 6 },
        exposure: exposure.exposure,
        requested: { amount: '25', currency: 'CNY', scale: 6 },
      }),
    ).toThrow(/Currency mismatch/u);
  });
  it('rejects stale, rejected, expired, and non-exact decision pins', () => {
    const validUntil = '2030-01-01T00:00:00.000Z';
    expect(() => {
      assertCreditDecisionUsable(
        { status: 'APPROVED', validUntil, quoteRevisionId: 'revision-1' },
        'revision-1',
        new Date('2029-01-01T00:00:00.000Z'),
      );
    }).not.toThrow();
    expect(() => {
      assertCreditDecisionUsable(
        { status: 'REJECTED', validUntil, quoteRevisionId: 'revision-1' },
        'revision-1',
      );
    }).toThrow(/not approved/u);
    expect(() => {
      assertCreditDecisionUsable(
        { status: 'APPROVED', validUntil, quoteRevisionId: 'revision-1' },
        'revision-2',
      );
    }).toThrow(/exact quote revision/u);
    expect(() => {
      assertCreditDecisionUsable(
        { status: 'APPROVED', validUntil: '2020-01-01T00:00:00Z', quoteRevisionId: 'revision-1' },
        'revision-1',
      );
    }).toThrow(/expired/u);
  });
  it('enforces allocation balances and deterministically replays canonical order', () => {
    const balances = {
      payment: { p1: { amount: '100', currency: 'CNY', scale: 6 as const } },
      open: {
        a1: { amount: '70', currency: 'CNY', scale: 6 as const },
        a2: { amount: '30', currency: 'CNY', scale: 6 as const },
      },
    };
    const input = [
      { paymentId: 'p1', openItemId: 'a2', currency: 'CNY', amount: '30', dueAt: '2026-02-01' },
      { paymentId: 'p1', openItemId: 'a1', currency: 'CNY', amount: '70', dueAt: '2026-01-01' },
    ];
    const first = reconcileAllocations(input, balances.payment, balances.open);
    const replay = reconcileAllocations([...input].reverse(), balances.payment, balances.open);
    expect(first).toEqual(replay);
    expect(first.allocations.map((item) => item.openItemId)).toEqual(['a1', 'a2']);
    expect(() =>
      reconcileAllocations(
        [{ paymentId: 'p1', openItemId: 'a1', currency: 'CNY', amount: '70.000001' }],
        balances.payment,
        balances.open,
      ),
    ).toThrow(/remaining balance/u);
  });
});
