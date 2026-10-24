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
const legacy = (
  s: readonly DataScope[],
  a: readonly ScopeAnchor[],
  offset: number,
  alias: string,
) => {
  const clauses: string[] = [],
    values: string[] = [];
  if (s.includes('COMPANY') || s.includes('GROUP')) clauses.push('TRUE');
  if (s.includes('SELF'))
    clauses.push(`${alias}.owner_id=$${String(offset + values.push(actor.employeeId) - 1)}`);
  for (const anchor of a)
    if (anchor.organizationId && s.includes(anchor.scope)) {
      clauses.push(
        `EXISTS(SELECT 1 FROM organizations anchor JOIN organization_scope_relationships osr ON osr.ancestor_id=anchor.id AND osr.descendant_id=${alias}.owner_organization_id${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''} WHERE anchor.id=$${String(offset + values.push(anchor.organizationId) - 1)} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${anchor.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

describe('commission scope migration', () => {
  it('matches the frozen customerScope snapshot byte-for-byte across scope, anchor, offset, and alias dimensions', () => {
    for (const s of scopes)
      for (const a of anchors)
        for (const offset of [2, 3, 5, 9])
          for (const alias of ['cu', 'c']) {
            expect(recordScopeSql(s, a, actor, alias, offset)).toEqual(legacy(s, a, offset, alias));
          }
  });
  it('preserves FALSE, SELF numbering, and TEAM relationship semantics', () => {
    expect(recordScopeSql([], [], actor, 'cu', 2)).toEqual({ sql: 'FALSE', values: [] });
    expect(recordScopeSql(['SELF'], [], actor, 'cu', 5)).toEqual({
      sql: '(cu.owner_id=$5)',
      values: [actor.employeeId],
    });
    const team = recordScopeSql(['TEAM'], [{ scope: 'TEAM', organizationId: org }], actor, 'cu', 2);
    expect(team.sql).toContain('osr.depth<=1');
    expect(team.sql).toContain('anchor.owner_organization_id=cu.tenant_id');
    expect(team.values).toEqual([org]);
  });
});
