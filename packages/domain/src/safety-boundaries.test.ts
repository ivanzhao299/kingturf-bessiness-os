import { describe, expect, it } from 'vitest';
import type { DataScope, PermissionKey } from '@kingturf/types';
import {
  assertEffectiveRange,
  assertExactVersionPin,
  assertPermission,
  assertStableCode,
  evaluateRule,
  NOOP_TELEMETRY,
  parseEffectiveTimestamp,
  validateBusinessObjectSchema,
  validateRuleExpression,
  type AuthorizationContext,
} from './index.js';

describe('production domain boundary execution', () => {
  it('normalizes a closed business schema while preserving relationship pins', () => {
    expect(
      validateBusinessObjectSchema({
        fields: [
          { key: 'name', label: ' 名称 ', type: 'string', required: true },
          {
            key: 'customer',
            label: '客户',
            type: 'relationship',
            required: false,
            targetDefinitionId: 'customer-definition',
            cardinality: 'ONE',
          },
        ],
      }),
    ).toEqual({
      fields: [
        { key: 'name', label: '名称', type: 'string', required: true },
        {
          key: 'customer',
          label: '客户',
          type: 'relationship',
          required: false,
          targetDefinitionId: 'customer-definition',
          cardinality: 'ONE',
        },
      ],
    });
  });

  it('rejects malformed, executable-key, duplicate and oversized business schemas', () => {
    const field = { key: 'name', label: '名称', type: 'string', required: true };
    for (const value of [null, [], { fields: [], extra: true }, { fields: null }])
      expect(() => validateBusinessObjectSchema(value)).toThrow();
    for (const invalid of [
      null,
      [],
      { ...field, extra: true },
      { ...field, key: 'constructor' },
      { ...field, key: '__proto__' },
      { ...field, label: ' ' },
      { ...field, label: 'a'.repeat(129) },
      { ...field, type: 'javascript' },
      { ...field, required: 'yes' },
      { ...field, targetDefinitionId: 'unexpected' },
      { ...field, type: 'relationship' },
      { ...field, type: 'relationship', targetDefinitionId: 'customer', cardinality: 'INVALID' },
    ])
      expect(() => validateBusinessObjectSchema({ fields: [invalid] })).toThrow();
    expect(() => validateBusinessObjectSchema({ fields: [field, field] })).toThrow();
    expect(() =>
      validateBusinessObjectSchema({
        fields: Array.from({ length: 101 }, (_, index) => ({
          ...field,
          key: `field${String(index)}`,
        })),
      }),
    ).toThrow(/at most 100/u);
    expect(() =>
      validateBusinessObjectSchema({
        fields: Array.from({ length: 100 }, (_, index) => ({
          ...field,
          key: `field${String(index)}`,
          label: '中'.repeat(128),
        })),
      }),
    ).toThrow(/32 KiB/u);
  });

  it('denies missing grants, empty scopes and forbidden fields, never widening a grant', () => {
    const context = (
      fields: readonly string[] | null,
      scopes: readonly DataScope[] = ['SELF'],
    ): AuthorizationContext => ({
      actor: { employeeId: 'employee', companyId: 'company' },
      permissions: new Map<
        PermissionKey,
        { fields: readonly string[] | null; scopes: readonly DataScope[] }
      >([['customer:read', { fields, scopes }]]),
    });
    const scoped = context(['name']);
    expect(assertPermission(scoped, 'customer:read', ['name'])).toBe(scoped);
    expect(() => assertPermission(null, 'customer:read')).toThrow(/required/u);
    expect(() => assertPermission(scoped, 'customer:create')).toThrow(/Permission denied/u);
    expect(() => assertPermission(context(null, []), 'customer:read')).toThrow(
      /Permission denied/u,
    );
    expect(() => assertPermission(scoped, 'customer:read', ['name', 'email'])).toThrow(
      /Field permission/u,
    );
    const unrestricted = context(null);
    expect(assertPermission(unrestricted, 'customer:read', ['name', 'email'])).toBe(unrestricted);
  });

  it('requires exact positive version pins, valid effective ranges and stable codes', () => {
    expect(() => {
      assertExactVersionPin({ id: 'item', versionId: 'revision', version: 1 });
      assertEffectiveRange('2026-01-01T00:00:00Z', null);
      assertEffectiveRange('2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z');
    }).not.toThrow();
    for (const pin of [
      {},
      { id: ' ', versionId: 'revision', version: 1 },
      { id: 'item', versionId: '', version: 1 },
      { id: 'item', versionId: 'revision', version: 0 },
      { id: 'item', versionId: 'revision', version: 1.5 },
    ])
      expect(() => {
        assertExactVersionPin(pin);
      }).toThrow(/exact identity/u);
    for (const [from, to] of [
      ['invalid', '2026-01-01'],
      ['2026-01-01', 'invalid'],
      ['2026-01-01', '2026-01-01'],
      ['2026-01-02', '2026-01-01'],
    ])
      expect(() => {
        assertEffectiveRange(from ?? '', to ?? '');
      }).toThrow();
    expect(parseEffectiveTimestamp('2026-01-01T08:00:00+08:00').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(() => parseEffectiveTimestamp('invalid', 'effectiveAt')).toThrow(/effectiveAt/u);
    expect(assertStableCode(' BOM-1_A ')).toBe('BOM-1_A');
    for (const code of ['', 'lower', '1INVALID', 'A'.repeat(65), 'A B'])
      expect(() => assertStableCode(code)).toThrow(/Code must/u);
    expect(() => {
      NOOP_TELEMETRY.count('synthetic');
      NOOP_TELEMETRY.timing('synthetic', 1);
    }).not.toThrow();
    expect(Object.isFrozen(NOOP_TELEMETRY)).toBe(true);
  });

  it('executes each closed rule operator and defaults deny on missing or non-object input paths', () => {
    for (const [op, left, right, decision] of [
      ['eq', 2, 2, true],
      ['ne', 2, 3, true],
      ['gt', 3, 2, true],
      ['gte', 2, 2, true],
      ['lt', 2, 3, true],
      ['lte', 2, 2, true],
      ['gt', '3', 2, false],
    ] as const) {
      const ast = validateRuleExpression({
        op,
        left: { op: 'literal', value: left },
        right: { op: 'literal', value: right },
      });
      expect(evaluateRule(ast, {}).decision).toBe(decision);
    }
    for (const [raw, input, decision] of [
      [
        { op: 'in', left: { op: 'literal', value: 2 }, right: { op: 'input', path: 'values' } },
        { values: [1, 2] },
        true,
      ],
      [{ op: 'not', value: { op: 'literal', value: false } }, {}, true],
      [
        {
          op: 'and',
          values: [
            { op: 'literal', value: true },
            { op: 'literal', value: false },
          ],
        },
        {},
        false,
      ],
      [
        {
          op: 'or',
          values: [
            { op: 'literal', value: false },
            { op: 'literal', value: true },
          ],
        },
        {},
        true,
      ],
      [{ op: 'input', path: 'customer.active' }, { customer: null }, false],
      [{ op: 'input', path: 'customer.active' }, { customer: [] }, false],
    ] as const)
      expect(evaluateRule(validateRuleExpression(raw), input).decision).toBe(decision);
    expect(evaluateRule(validateRuleExpression({ op: 'input', path: 'missing' }), {})).toEqual({
      decision: false,
      trace: [{ op: 'default-deny', result: false }],
    });
  });

  it('rejects malformed rule trees and bounds traces without changing the decision', () => {
    for (const raw of [
      null,
      [],
      {},
      { op: 'literal', value: Infinity },
      { op: 'literal', value: [] },
      { op: 'input', path: 'customer..id' },
      { op: 'input', path: 'constructor.id' },
      { op: 'and', values: [] },
      { op: 'or', values: Array(51).fill({ op: 'literal', value: true }) },
      { op: 'unknown' },
    ])
      expect(() => validateRuleExpression(raw)).toThrow();
    expect(() =>
      validateRuleExpression({ op: 'not', value: { op: 'literal', value: true } }, 0),
    ).toThrow(/nested/u);
    const ast = validateRuleExpression({
      op: 'and',
      values: Array.from({ length: 3 }, () => ({
        op: 'and',
        values: Array.from({ length: 50 }, () => ({ op: 'literal', value: true })),
      })),
    });
    const result = evaluateRule(ast, {});
    expect(result.decision).toBe(true);
    expect(result.trace).toHaveLength(100);
  });
});
