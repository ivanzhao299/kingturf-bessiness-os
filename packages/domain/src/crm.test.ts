import { describe, expect, it } from 'vitest';
import {
  assertCustomerTransition,
  assertLeadPoolClaim,
  assertLeadTransition,
  assertSeparationOfDuties,
  normalizeContactEmail,
  normalizeContactPhone,
  normalizeCustomerIdentity,
} from './index.js';

describe('CRM domain invariants', () => {
  it('normalizes customer identity deterministically', () => {
    expect(normalizeCustomerIdentity(' ＡＣＭＥ   Turf ')).toBe('acme turf');
  });
  it('normalizes valid contact identities and rejects blank or malformed values', () => {
    expect(normalizeContactEmail(' Buyer@Example.TEST ')).toBe('buyer@example.test');
    expect(normalizeContactPhone(' +86 138-0013-8000 ')).toBe('+8613800138000');
    for (const email of ['', '   ', 'missing-at.example.test', 'buyer@example'])
      expect(() => normalizeContactEmail(email)).toThrow(/malformed/u);
    for (const phone of ['', '---', '+12', 'call 1234567', '1234567890123456'])
      expect(() => normalizeContactPhone(phone)).toThrow(/malformed/u);
  });
  it('allows only declared customer and lead transitions', () => {
    expect(() => {
      assertCustomerTransition('PROSPECT', 'ACTIVE');
    }).not.toThrow();
    expect(() => {
      assertCustomerTransition('ARCHIVED', 'ACTIVE');
    }).toThrow(/Illegal customer/u);
    expect(() => {
      assertLeadTransition('POOL', 'CLAIMED');
    }).not.toThrow();
    expect(() => {
      assertLeadTransition('CONVERTED', 'POOL');
    }).toThrow(/Illegal lead/u);
    expect(() => {
      assertLeadPoolClaim('POOL');
    }).not.toThrow();
    expect(() => {
      assertLeadPoolClaim('NEW');
    }).toThrow(/^Illegal lead transition: NEW -> CLAIMED$/u);
    expect(() => {
      assertLeadPoolClaim('CLAIMED');
    }).toThrow(/^Illegal lead transition: CLAIMED -> CLAIMED$/u);
  });
  it('requires a distinct reassignment approver and assignee', () => {
    expect(() => {
      assertSeparationOfDuties('actor', 'actor', true);
    }).toThrow(/actor other/u);
    expect(() => {
      assertSeparationOfDuties('actor', 'assignee', true);
    }).not.toThrow();
  });
});
