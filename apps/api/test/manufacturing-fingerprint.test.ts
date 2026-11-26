import { createHash } from 'node:crypto';
import { canonicalize } from '@kingturf/domain';
import { describe, expect, it } from 'vitest';
import { manufacturingContentHash } from '../src/manufacturing-fingerprint.js';

// 旧入口的原公式。canonicalize 的原文本另由 domain 的 30 条基线钉子保护；这里把同一语料
// 分别交给旧公式与制造共享公式，不能只验证「新实现调用了自己」。
const previousHash = (value: unknown): string =>
  createHash('sha256').update(canonicalize(value)).digest('hex');
const integerCorpus: readonly unknown[] = [
  null,
  true,
  false,
  '',
  '001',
  '中文·规格',
  'a"b\\c\n\t',
  '\ud800',
  0,
  -0,
  1,
  -7,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  [],
  [0, -1, '001', true, false, null],
  [[1, [2, [3]]], []],
  {},
  { dtex: 12000, grade: 'A' },
  { b: 1, a: 2 },
  { a: 2, b: 1 },
  { a: 1, B: 2, '': 3, _x: 4, 10: 5, 2: 6, é: 7, 中: 8 },
  { calibration: { offsets: [0, -2, 7], active: true, notes: null } },
  Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`k${String(index)}`, index])),
  Array.from({ length: 1000 }, (_, index) => index - 500),
];

describe('TD-MFG-017 shared manufacturing content fingerprint', () => {
  it('matches the previous formula for every integer, nested, array, string, boolean and null input', () => {
    for (const value of integerCorpus)
      expect(manufacturingContentHash(value)).toBe(previousHash(value));
    // 实际旧入口把规格包在 itemId / effectiveAt 里；根创建与续版都必须同样保真。
    for (const specification of integerCorpus)
      for (const itemId of ['root-a', 'root-b']) {
        const content = { itemId, specification, effectiveAt: '2026-01-01T00:00:00Z' };
        expect(manufacturingContentHash(content)).toBe(previousHash(content));
      }
    expect(manufacturingContentHash({ b: 1, a: 2 })).toBe(manufacturingContentHash({ a: 2, b: 1 }));
  });

  it('accepts finite decimals at any depth while the old formula rejects them', () => {
    for (const value of [
      12.5,
      -0.1,
      1e-7,
      0.1 + 0.2,
      { height: 50.5, nested: [0, { x: -1.25 }] },
    ]) {
      expect(() => previousHash(value)).toThrow(/safe integers/u);
      expect(manufacturingContentHash(value)).toMatch(/^[0-9a-f]{64}$/u);
    }
    const expected = createHash('sha256')
      .update('{"height":50.5,"nested":[0,{"x":-1.25}]}')
      .digest('hex');
    expect(manufacturingContentHash({ nested: [0, { x: -1.25 }], height: 50.5 })).toBe(expected);
    expect(manufacturingContentHash(12.5)).toBe(manufacturingContentHash(12.5));
  });

  it('keeps non-finite numbers, unsafe integers and non-JSON values rejected', () => {
    for (const value of [NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 53), 1e21]) {
      expect(() => previousHash(value)).toThrow(/safe integers/u);
      expect(() => manufacturingContentHash(value)).toThrow(/safe integers or finite decimals/u);
      expect(() => manufacturingContentHash({ nested: [value] })).toThrow(
        /safe integers or finite decimals/u,
      );
    }
    for (const value of [undefined, () => 1, Symbol('unsupported'), 1n])
      expect(() => manufacturingContentHash(value)).toThrow(/Unsupported canonical value/u);
  });
});
