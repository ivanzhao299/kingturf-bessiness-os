import { describe, expectTypeOf, it } from 'vitest';
import type {
  Customer360Dto,
  DataScope,
  Decimal,
  ErrorCode,
  ErrorEnvelope,
  JsonObject,
  JsonValue,
  Money,
  Page,
  PermissionKey,
  RuleExpression,
} from './index.js';

// Vitest executes the positive harness; the existing tsc --noEmit gate checks all
// expectTypeOf constraints and @ts-expect-error negatives. These callbacks are
// inspected as types, never invoked with deliberately invalid runtime values.
describe('shared DTO compile-time contracts (enforced by typecheck)', () => {
  it('keeps scope, permission and error codes closed at their declared boundaries', () => {
    expectTypeOf<DataScope>().toEqualTypeOf<
      'SELF' | 'TEAM' | 'DEPARTMENT' | 'REGION' | 'COMPANY' | 'GROUP'
    >();
    expectTypeOf<'customer:read'>().toExtend<PermissionKey>();
    expectTypeOf<'customer-read'>().not.toExtend<PermissionKey>();
    expectTypeOf<ErrorEnvelope['error']['code']>().toEqualTypeOf<ErrorCode>();
    expectTypeOf<'arbitrary_error'>().not.toExtend<ErrorCode>();
    const invalidCodes = () => {
      // @ts-expect-error Scope is not an open string or an extra privilege.
      const scope: DataScope = 'EVERYONE';
      // @ts-expect-error Capability keys require a colon-separated shape.
      const permission: PermissionKey = 'customer-read';
      return { scope, permission };
    };
    expectTypeOf(invalidCodes).returns.toEqualTypeOf<{
      scope: DataScope;
      permission: PermissionKey;
    }>();
  });

  it('requires cursor metadata and preserves readonly collections and CRM tuple shape', () => {
    type Item = Readonly<{ id: string }>;
    expectTypeOf<Page<Item>>().toEqualTypeOf<
      Readonly<{ items: readonly Item[]; nextCursor: string | null }>
    >();
    expectTypeOf<Customer360Dto['unavailableSections']>().toEqualTypeOf<
      readonly ['orders', 'finance']
    >();
    const invalidPage = () => {
      // @ts-expect-error A page cannot omit even a terminal null cursor.
      const missing: Page<Item> = { items: [] };
      const page: Page<Item> = { items: [{ id: 'synthetic-id' }], nextCursor: null };
      // @ts-expect-error Shared page collections cannot become consumer-mutable arrays.
      const mutable: Item[] = page.items;
      // @ts-expect-error Cursor properties are readonly.
      page.nextCursor = 'changed';
      // @ts-expect-error Customer360 requires the fixed unavailable-section tuple.
      const sections: Pick<Customer360Dto, 'unavailableSections'> = { unavailableSections: [] };
      return { missing, sections, mutable };
    };
    expectTypeOf(invalidPage).returns.toEqualTypeOf<{
      missing: Page<Item>;
      sections: Pick<Customer360Dto, 'unavailableSections'>;
      mutable: Item[];
    }>();
  });

  it('transports decimal money as strings and JSON as recursively serializable values', () => {
    expectTypeOf<Decimal>().toEqualTypeOf<string>();
    expectTypeOf<Money>().toEqualTypeOf<Readonly<{ amount: string; currency: string }>>();
    const payload = { amount: '0.10', nested: [null, true, { count: 2 }] } as const;
    expectTypeOf(payload).toExtend<JsonObject>();
    expectTypeOf<readonly [string, null, boolean]>().toExtend<JsonValue>();
    const invalidTransport = () => {
      // @ts-expect-error Decimal amounts cannot silently become IEEE-754 numbers.
      const money: Money = { amount: 42, currency: 'CNY' };
      // @ts-expect-error JSON payloads cannot carry executable functions.
      const executable: JsonObject = { value: () => true };
      // @ts-expect-error Undefined is not a serialized JSON value.
      const absent: JsonObject = { value: undefined };
      return { money, executable, absent };
    };
    expectTypeOf(invalidTransport).returns.toEqualTypeOf<{
      money: Money;
      executable: JsonObject;
      absent: JsonObject;
    }>();
  });

  it('preserves discriminated rule operands instead of accepting malformed ASTs', () => {
    expectTypeOf<Extract<RuleExpression, { op: 'literal' }>>().toEqualTypeOf<
      Readonly<{ op: 'literal'; value: string | number | boolean | null }>
    >();
    expectTypeOf<Extract<RuleExpression, { op: 'and' | 'or' }>['values']>().toEqualTypeOf<
      readonly RuleExpression[]
    >();
    const invalidRule = () => {
      // @ts-expect-error An input node requires a path rather than a literal value.
      const input: RuleExpression = { op: 'input', value: true };
      // @ts-expect-error A comparison requires both operands.
      const comparison: RuleExpression = { op: 'eq', left: { op: 'literal', value: 1 } };
      return { input, comparison };
    };
    expectTypeOf(invalidRule).returns.toEqualTypeOf<{
      input: RuleExpression;
      comparison: RuleExpression;
    }>();
  });
});
