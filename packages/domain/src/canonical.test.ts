import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  canonicalizeWith,
  DomainError,
  type CanonicalNumberPolicy,
} from './index.js';

// TD-MFG-017（MG2）第一步：规范化的结构只此一份（canonicalizeWith），数值口径作为策略传入，
// canonicalize 原样委托给它。下面的期望值全部由重构之前的 canonicalize（提交 4a93003 的实现）
// 对同一语料算出，是「逐字节不变」的钉子：字符串、布尔、数组、对象键排序或安全整数的文本
// 任何一个字节变了，这里都会变红。完整差分（30 条精选语料 + 20 万条
// 随机生成的安全整数 JSON 值）见 docs/evidence/mfg-guards-2026-11-26.md。
type Row = readonly [string, unknown, string];
const PINNED_TEXT: readonly Row[] = [
  ['null', null, 'null'],
  ['true', true, 'true'],
  ['false', false, 'false'],
  ['空字符串', '', '""'],
  ['ASCII', 'KG', '"KG"'],
  ['引号与反斜杠', 'a"b\\c', '"a\\"b\\\\c"'],
  ['控制字符', 'line\nbreak\ttab', '"line\\nbreak\\ttab"'],
  ['中文与 emoji', '中文·Émoji 🌱', '"中文·Émoji 🌱"'],
  ['孤立代理项', '\ud800', '"\\ud800"'],
  ['零', 0, '0'],
  ['负零', -0, '0'],
  ['一', 1, '1'],
  ['负数', -7, '-7'],
  ['最大安全整数', Number.MAX_SAFE_INTEGER, '9007199254740991'],
  ['最小安全整数', Number.MIN_SAFE_INTEGER, '-9007199254740991'],
  [
    '各数量级',
    [1, 10, 100, 1000, 1e6, 1e10, 1e15],
    '[1,10,100,1000,1000000,10000000000,1000000000000000]',
  ],
  ['空数组', [], '[]'],
  ['整数数组', [1, 2, 3], '[1,2,3]'],
  ['混合数组', [1, 'a', null, true, false], '[1,"a",null,true,false]'],
  ['嵌套数组', [[1, [2, [3]]], []], '[[1,[2,[3]]],[]]'],
  ['空对象', {}, '{}'],
  ['扁平对象', { grade: 'A', dtex: 12000 }, '{"dtex":12000,"grade":"A"}'],
  ['键序 A', { b: 1, a: 2, c: 3 }, '{"a":2,"b":1,"c":3}'],
  ['键序 B（与 A 同值异序）', { c: 3, b: 1, a: 2 }, '{"a":2,"b":1,"c":3}'],
  [
    '大小写与数字键',
    { a: 1, B: 2, '': 3, _x: 4, 10: 5, 2: 6, é: 7, 中: 8 },
    '{"":3,"_x":4,"10":5,"2":6,"a":1,"B":2,"é":7,"中":8}',
  ],
  [
    '内嵌对象',
    {
      pileHeightMm: { value: 50, unit: 'mm', tolerance: { min: 49, max: 51 } },
      gauge: [1, 2],
      notes: ['a', null],
    },
    '{"gauge":[1,2],"notes":["a",null],"pileHeightMm":{"tolerance":{"max":51,"min":49},"unit":"mm","value":50}}',
  ],
  [
    '深嵌套八层',
    { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } },
    '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":1}}}}}}}}',
  ],
  [
    'JSON 往返后的规格',
    JSON.parse('{"dtex":12000,"layers":2,"color":"#4C8C3A","nested":[1,{"x":0}]}'),
    '{"color":"#4C8C3A","dtex":12000,"layers":2,"nested":[1,{"x":0}]}',
  ],
];
const PINNED_DIGEST: readonly Row[] = [
  [
    '宽对象两百键',
    Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${String(i)}`, i])),
    '15fceca2577e094069c09f357a063223511dcd5880c5c93996e49eee6d491e1f',
  ],
  [
    '长数组一千项',
    Array.from({ length: 1000 }, (_, i) => i - 500),
    '7086bd05236eab9790c0a2944ce56a1395629fce887907192f1e9fbb515dc274',
  ],
];

describe('canonicalize is byte-identical to the implementation before the refactor (TD-MFG-017)', () => {
  it('produces the pinned canonical text for every input the old rule accepted', () => {
    for (const [name, value, expected] of PINNED_TEXT)
      expect(canonicalize(value), name).toBe(expected);
    // 同值异序的两个对象落成同一段文本——键序不影响指纹。
    const reordered = PINNED_TEXT.filter(([name]) => name.startsWith('键序'));
    expect(reordered).toHaveLength(2);
    expect(reordered[0]?.[2]).toBe(reordered[1]?.[2]);
  });

  it('produces the pinned sha256 for the large inputs', () => {
    for (const [name, value, expected] of PINNED_DIGEST)
      expect(createHash('sha256').update(canonicalize(value)).digest('hex'), name).toBe(expected);
  });

  it('rejects exactly what it rejected before, with the same words', () => {
    for (const value of [0.5, -0.1, 12.5, 1e-7, 0.1 + 0.2, NaN, Infinity, -Infinity, 2 ** 53, 1e21])
      expect(() => canonicalize(value)).toThrow(
        new DomainError('invalid_request', 'Canonical numeric inputs must be safe integers'),
      );
    // 小数藏在任意一层都会被拦下。
    expect(() => canonicalize([1, { a: [0, 1.5] }])).toThrow(/safe integers/u);
    for (const value of [undefined, () => 1, Symbol('s'), 1n])
      expect(() => canonicalize(value)).toThrow(
        new DomainError('invalid_request', 'Unsupported canonical value'),
      );
  });
});

describe('canonicalizeWith keeps one structure and takes the number policy', () => {
  const twoDecimals = (value: number): string => value.toFixed(2);

  it('routes every number through the policy and keeps the structure rules', () => {
    expect(canonicalizeWith(twoDecimals, { b: 1.5, a: [2, 'x'], c: null, d: true })).toBe(
      '{"a":[2.00,"x"],"b":1.50,"c":null,"d":true}',
    );
    expect(canonicalizeWith(twoDecimals, [])).toBe('[]');
    expect(canonicalizeWith(twoDecimals, {})).toBe('{}');
    // 策略只能决定数值：它拒绝不了字符串、数组或对象。
    expect(canonicalizeWith(twoDecimals, ['\u0000', 'a"b'])).toBe('["\\u0000","a\\"b"]');
  });

  it('propagates the rejection raised by the policy, wherever the number sits', () => {
    const evenOnly: CanonicalNumberPolicy = (value) => {
      if (value % 2 !== 0) throw new DomainError('invalid_request', 'even numbers only');
      return String(value);
    };
    expect(canonicalizeWith(evenOnly, { a: [2, 4] })).toBe('{"a":[2,4]}');
    expect(() => canonicalizeWith(evenOnly, { a: [2, { b: 3 }] })).toThrow(
      new DomainError('invalid_request', 'even numbers only'),
    );
  });

  it('equals canonicalize whenever it is given the strict policy', () => {
    const strict = (value: number): string => {
      if (!Number.isSafeInteger(value))
        throw new DomainError('invalid_request', 'Canonical numeric inputs must be safe integers');
      return String(value);
    };
    for (const [name, value, expected] of PINNED_TEXT)
      expect(canonicalizeWith(strict, value), name).toBe(expected);
    expect(() => canonicalizeWith(strict, 12.5)).toThrow(/safe integers/u);
  });
});
