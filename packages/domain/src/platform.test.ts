import { describe, expect, it } from 'vitest';
import {
  DomainError,
  evaluateRule,
  sanitizeAuditMetadata,
  validateRuleExpression,
  validateWorkflowSpec,
} from './index.js';

describe('platform safety contracts', () => {
  it('accepts a closed deterministic rule and defaults deny on missing input', () => {
    const ast = validateRuleExpression({
      op: 'gte',
      left: { op: 'input', path: 'order.total' },
      right: { op: 'literal', value: 100 },
    });
    expect(evaluateRule(ast, { order: { total: 120 } })).toMatchObject({ decision: true });
    expect(evaluateRule(ast, {})).toMatchObject({ decision: false });
  });
  it('rejects executable, unknown, and prototype-sensitive rule nodes', () => {
    for (const ast of [
      { op: 'eval', code: 'true' },
      { op: 'input', path: '__proto__.x' },
      { op: 'literal', value: 1, extra: true },
    ])
      expect(() => validateRuleExpression(ast)).toThrow(DomainError);
  });
  it('bounds and redacts audit metadata', () => {
    expect(sanitizeAuditMetadata({ version: 2 }, ['version'])).toEqual({ version: 2 });
    expect(() => sanitizeAuditMetadata({ token: 'secret' }, ['token'])).toThrow(/sensitive/u);
    expect(() => sanitizeAuditMetadata({ body: {} }, [])).toThrow(/not allowed/u);
  });
  it('validates generic ordered workflow definitions', () => {
    expect(
      validateWorkflowSpec({
        states: ['PENDING', 'APPROVED'],
        initialState: 'PENDING',
        terminalStates: ['APPROVED'],
        transitions: [{ from: 'PENDING', to: 'APPROVED', decision: 'approve' }],
        steps: [
          {
            key: 'approval',
            order: 1,
            eligibleRoles: ['approver'],
            eligibleActors: [],
            quorum: 1,
            separateFromRequester: true,
          },
        ],
      }).initialState,
    ).toBe('PENDING');
  });
});
