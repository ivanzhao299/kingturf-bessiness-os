import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';
const scopeCases: readonly (readonly DataScope[])[] = [
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
const anchorCases: readonly (readonly ScopeAnchor[])[] = [
  [],
  [{ scope: 'TEAM', organizationId: org }],
  [{ scope: 'DEPARTMENT', organizationId: org }],
  [{ scope: 'REGION', organizationId: org }],
  [{ scope: 'TEAM', organizationId: null }],
  [{ scope: 'SELF', organizationId: org }],
];
const legacy = (
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  offset: number,
  alias: string,
) => {
  const clauses: string[] = [],
    values: string[] = [];
  if (scopes.includes('COMPANY') || scopes.includes('GROUP')) clauses.push('TRUE');
  if (scopes.includes('SELF')) {
    values.push(actor.employeeId);
    clauses.push(`${alias}.owner_id=$${String(offset + values.length - 1)}`);
  }
  for (const anchor of anchors)
    if (anchor.organizationId && scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.length - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

describe('dashboard scope migration', () => {
  it('matches the frozen customerScope snapshot across scope, anchor, offset, and alias dimensions', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of [2, 5, 9])
          for (const alias of ['c', 'cu']) {
            const result = recordScopeSql(scopes, anchors, actor, alias, offset, {
              anchorPredicate: 'relationshipOnly',
            });
            const previous = legacy(scopes, anchors, offset, alias);
            expect(result.values).toEqual(previous.values);
            if (!previous.sql.includes('osr.tenant_id')) expect(result.sql).toBe(previous.sql);
            else {
              expect(result.sql).toContain('anchor.owner_organization_id=' + alias + '.tenant_id');
              expect(result.sql).toContain('anchor.active AND anchor.deleted_at IS NULL');
              expect(result.sql).not.toContain('osr.tenant_id');
              expect(result.sql).not.toContain('osr.scope=');
            }
          }
  });
  it('preserves relationship-only semantics and parameter numbering', () => {
    const result = recordScopeSql(
      ['TEAM', 'SELF'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'c',
      5,
      { anchorPredicate: 'relationshipOnly' },
    );
    expect(result.sql).toContain(
      'FROM organizations anchor JOIN organization_scope_relationships osr',
    );
    expect(result.sql).toContain("anchor.organization_type='TEAM'");
    expect(result.sql).not.toContain('JOIN organizations');
    expect(result.sql).not.toContain('osr.depth<=1');
    expect(result.values).toEqual([actor.employeeId, org]);
  });
});
