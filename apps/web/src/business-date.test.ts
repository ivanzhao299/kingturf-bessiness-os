import { afterEach, expect, it, vi } from 'vitest';
import { env } from 'node:process';
import {
  formatBusinessDate,
  formatBusinessDateTime,
  businessHeadingDateFormatter,
} from './shared/business-date';
import { displayTime } from './shared/business-format';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cases = ['UTC', 'Asia/Shanghai', 'America/New_York'].flatMap((zone) =>
  ['2026-10-16T23:59:59.123Z', '2026-03-08T07:00:00Z', '2024-02-29', 'invalid-date'].map(
    (timestamp) => [zone, timestamp] as const,
  ),
);

it.each(cases)('preserves native zh-CN formatting in %s for %s', (zone, timestamp) => {
  const previousZone = env.TZ;
  env.TZ = zone;
  try {
    const date = new Date(timestamp);
    expect(formatBusinessDate(date)).toBe(date.toLocaleDateString('zh-CN'));
    expect(formatBusinessDateTime(date)).toBe(date.toLocaleString('zh-CN'));
  } finally {
    if (previousZone === undefined) delete env.TZ;
    else env.TZ = previousZone;
  }
});

it('passes the original Date receiver and only the original locale argument', () => {
  const date = new Date('2026-10-16T00:00:00Z');
  const day = vi.spyOn(date, 'toLocaleDateString').mockReturnValue('original-day');
  const time = vi.spyOn(date, 'toLocaleString').mockReturnValue('original-time');
  expect(formatBusinessDate(date)).toBe('original-day');
  expect(formatBusinessDateTime(date)).toBe('original-time');
  expect(day).toHaveBeenCalledExactlyOnceWith('zh-CN');
  expect(time).toHaveBeenCalledExactlyOnceWith('zh-CN');
  expect(day.mock.contexts[0]).toBe(date);
  expect(time.mock.contexts[0]).toBe(date);
});

it('constructs a fresh heading formatter before its Date and preserves all options', () => {
  const events: string[] = [];
  const argumentsSeen: unknown[][] = [];
  const OriginalDate = Date;
  vi.stubGlobal(
    'Date',
    class extends OriginalDate {
      public constructor() {
        events.push('Date');
        super('2026-10-16T00:00:00Z');
      }
    },
  );
  vi.stubGlobal('Intl', {
    DateTimeFormat: class {
      public constructor(...args: unknown[]) {
        events.push('Intl');
        argumentsSeen.push(args);
      }
      public format(date: Date): string {
        events.push('format');
        return String(date.getUTCFullYear());
      }
    },
  });
  const first = businessHeadingDateFormatter();
  expect(first.format(new Date())).toBe('2026');
  const second = businessHeadingDateFormatter();
  expect(second).not.toBe(first);
  expect(events).toEqual(['Intl', 'Date', 'format', 'Intl']);
  expect(argumentsSeen).toEqual(
    Array.from({ length: 2 }, () => [
      'zh-CN',
      { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
    ]),
  );
});

it('preserves the original displayTime falsy fallback without formatting', () => {
  const formatting = vi.spyOn(Date.prototype, 'toLocaleString');
  expect(displayTime(undefined)).toBe('时间未知');
  expect(displayTime('')).toBe('时间未知');
  expect(formatting).not.toHaveBeenCalled();
});

it('preserves the native heading invalid-date exception', () => {
  expect(() => businessHeadingDateFormatter().format(new Date('invalid-date'))).toThrow(RangeError);
});
