// A-F1（A1-P3-1/2）：calendarDate 真实日历回验 + uuid 小写归一。
import { describe, expect, it } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { calendarDate, uuid } from '../src/app-values.ts';

describe('A1-P3-1 calendarDate round-trip revalidation', () => {
  it('rejects overflowed calendar dates like 2026-02-30', () => {
    expect(() => calendarDate('2026-02-30', 'priceEffectiveAt')).toThrowError(DomainError);
    expect(() => calendarDate('2026-13-01', 'date')).toThrowError(DomainError);
    expect(() => calendarDate('2024-02-30', 'date')).toThrowError(DomainError);
  });
  it('still accepts real calendar dates', () => {
    expect(calendarDate('2026-02-28', 'date')).toBe('2026-02-28');
    expect(calendarDate('2024-02-29', 'date')).toBe('2024-02-29');
    expect(calendarDate('2026-12-31', 'date')).toBe('2026-12-31');
  });
});

describe('A1-P3-2 uuid lowercase normalization', () => {
  it('normalizes uppercase hex to lowercase (BOUND-004 变体对齐)', () => {
    const mixed = '2222AAAA-2222-4222-8222-222222222222';
    expect(uuid(mixed, 'id')).toBe(mixed.toLowerCase());
  });
  it('still rejects non-canonical shapes', () => {
    expect(() => uuid('not-a-uuid', 'id')).toThrowError(DomainError);
  });
});
