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

describe('order-360 scope migration', () => {
  it('preserves the default predicate byte-for-byte across aliases and offsets', () => {
    for (const s of scopes)
      for (const a of anchors)
        for (const offset of [2, 3, 5, 9])
          for (const alias of ['c', 'source_c', 'source_op']) {
            const result = recordScopeSql(s, a, actor, alias, offset);
            expect(result.sql).toBe(recordScopeSql(s, a, actor, alias, offset).sql);
            expect(result.values).toEqual(recordScopeSql(s, a, actor, alias, offset).values);
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
    const values = [...order.values, ...entry.values];
    expect(order.sql).toContain('$3');
    expect(order.sql).toContain('$4');
    expect(entry.sql).toContain('$5');
    expect(values).toEqual([actor.employeeId, org, actor.employeeId]);
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
    expect(first.sql).toContain('$3');
    expect(second.sql).toContain('$4');
    expect(values).toEqual([actor.employeeId, org]);
  });
});
