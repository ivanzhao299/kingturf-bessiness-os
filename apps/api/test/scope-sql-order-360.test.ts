import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';
const scopes: readonly (readonly DataScope[])[] = [
  [],
  ['SELF'],
  ['COMPANY'],
  ['GROUP'],
  ['TEAM'],
  ['DEPARTMENT'],
  ['REGION'],
  ['SELF', 'TEAM'],
  ['COMPANY', 'SELF'],
];
const anchors: readonly (readonly ScopeAnchor[])[] = [
  [],
  [{ scope: 'TEAM', organizationId: org }],
  [{ scope: 'DEPARTMENT', organizationId: org }],
  [{ scope: 'REGION', organizationId: org }],
  [{ scope: 'TEAM', organizationId: null }],
  [{ scope: 'SELF', organizationId: org }],
];

const legacyCustomerScope = (
  scopeSet: readonly DataScope[],
  anchorSet: readonly ScopeAnchor[],
  legacyActor: Actor,
  alias: string,
  offset: number,
) => {
  const clauses: string[] = [];
  const values: string[] = [];
  if (scopeSet.includes('COMPANY') || scopeSet.includes('GROUP')) clauses.push('TRUE');
  if (scopeSet.includes('SELF')) {
    values.push(legacyActor.employeeId);
    clauses.push(`${alias}.owner_id=$${String(offset + values.length - 1)}`);
  }
  for (const anchor of anchorSet)
    if (anchor.organizationId && scopeSet.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      const parameter = `$${String(offset + values.length - 1)}`;
      clauses.push(
        `EXISTS(SELECT 1 FROM organizations anchor JOIN organization_scope_relationships osr ON osr.ancestor_id=anchor.id AND osr.descendant_id=${alias}.owner_organization_id${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''} WHERE anchor.id=${parameter} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${anchor.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

describe('order-360 scope migration', () => {
  it('preserves the default predicate byte-for-byte across aliases and offsets', () => {
    for (const s of scopes)
      for (const a of anchors)
        for (const offset of [2, 3, 5, 9])
          for (const alias of ['c', 'source_c', 'source_op']) {
            const legacy = legacyCustomerScope(s, a, actor, alias, offset);
            const migrated = recordScopeSql(s, a, actor, alias, offset);
            expect(migrated.sql).toBe(legacy.sql);
            expect(migrated.values).toEqual(legacy.values);
          }
  });
  it('keeps dynamic order and entry offsets contiguous', () => {
    const order = recordScopeSql(
      ['SELF', 'TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'c',
      3,
    );
    const entry = recordScopeSql(['SELF'], [], actor, 'c', 3 + order.values.length);
    const legacyOrder = legacyCustomerScope(
      ['SELF', 'TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'c',
      3,
    );
    const legacyEntry = legacyCustomerScope(
      ['SELF'],
      [],
      actor,
      'c',
      3 + legacyOrder.values.length,
    );
    const values = [...order.values, ...entry.values];
    const legacyValues = [...legacyOrder.values, ...legacyEntry.values];
    expect(order.sql).toContain('$3');
    expect(order.sql).toContain('$4');
    expect(entry.sql).toContain('$5');
    expect(values).toEqual([actor.employeeId, org, actor.employeeId]);
    expect(order.sql).toBe(legacyOrder.sql);
    expect(entry.sql).toBe(legacyEntry.sql);
    expect(values).toEqual(legacyValues);
  });
  it('keeps source scope offsets based on accumulated values', () => {
    const values: unknown[] = [];
    const first = recordScopeSql(['SELF'], [], actor, 'c', 3 + values.length);
    values.push(...first.values);
    const second = recordScopeSql(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'source_op',
      3 + values.length,
    );
    values.push(...second.values);
    const legacyValues: string[] = [];
    const legacyFirst = legacyCustomerScope(['SELF'], [], actor, 'c', 3 + legacyValues.length);
    legacyValues.push(...legacyFirst.values);
    const legacySecond = legacyCustomerScope(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'source_op',
      3 + legacyValues.length,
    );
    legacyValues.push(...legacySecond.values);
    expect(first.sql).toContain('$3');
    expect(second.sql).toContain('$4');
    expect(values).toEqual([actor.employeeId, org]);
    expect(first.sql).toBe(legacyFirst.sql);
    expect(second.sql).toBe(legacySecond.sql);
    expect(values).toEqual(legacyValues);
  });
});
