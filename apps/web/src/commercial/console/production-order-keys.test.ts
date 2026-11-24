import { describe, expect, it } from 'vitest';
import { executionIdempotencyKey, executionKeyStamp } from './production-order-keys';

// U3-MFG-5：车间执行幂等键由前端生成（不再让用户手填）。形状须被服务端 assertStableCode
// 接受——下面的正则与服务端同一条（apps/api 经 @kingturf/domain 的 assertStableCode；
// web 包不依赖 domain，这里按同一规则断言，API 契约测试用同形键走真实解析链）。
const STABLE_CODE = /^[A-Z][A-Z0-9_-]{0,63}$/u;
const at = new Date(2026, 10, 24, 9, 5, 7);
const token = (): string => 'A1B2';

describe('execution idempotency key', () => {
  it('形状为 工单号-RPT-yyyyMMddHHmmss-四位随机（本地时间），领退料用 MAT', () => {
    expect(executionKeyStamp(at)).toBe('20261124090507');
    expect(executionIdempotencyKey('WO-KT-2026-RETURN-DEMO', 'RPT', at, token)).toBe(
      'WO-KT-2026-RETURN-DEMO-RPT-20261124090507-A1B2',
    );
    expect(executionIdempotencyKey('WO-KT-2026-RETURN-DEMO', 'MAT', at, token)).toBe(
      'WO-KT-2026-RETURN-DEMO-MAT-20261124090507-A1B2',
    );
  });

  it.each([
    ['WO-KT-2026-001', 'WO-KT-2026-001'],
    ['', 'WO'],
    ['123', 'WO123'],
    ['wo-kt-001', 'WO-KT-001'],
    ['工单 001', 'WO001'],
    // 只去结尾的连字符：开头补 WO 后读起来是 WO-ABC-DEF。
    ['-abc-def', 'WO-ABC-DEF'],
    ['WO-KT---', 'WO-KT'],
  ])('工单编号 %j 清洗成合法前缀 %j', (orderNumber, head) => {
    expect(executionIdempotencyKey(orderNumber, 'RPT', at, token)).toBe(
      `${head}-RPT-20261124090507-A1B2`,
    );
  });

  it('超长工单编号截断后总长仍为 64，且每个字符都合法', () => {
    const key = executionIdempotencyKey(`W${'X'.repeat(80)}`, 'MAT', at, token);
    expect(key).toHaveLength(64);
    expect(key).toMatch(STABLE_CODE);
    expect(key.endsWith('-MAT-20261124090507-A1B2')).toBe(true);
    // 以非字母开头的超长编号：补 WO 前缀后同样截到 64。
    const numeric = executionIdempotencyKey('9'.repeat(80), 'MAT', at, token);
    expect(numeric).toHaveLength(64);
    expect(numeric).toMatch(STABLE_CODE);
  });

  it('缺省随机源取 Web Crypto：四位大写字母或数字，同一秒内连续生成彼此不同', () => {
    const keys = new Set(
      Array.from({ length: 200 }, () => executionIdempotencyKey('WO-KT-2026-001', 'RPT', at)),
    );
    expect(keys.size).toBe(200);
    for (const key of keys) {
      expect(key).toMatch(STABLE_CODE);
      expect(key).toMatch(/-RPT-20261124090507-[A-Z0-9]{4}$/u);
    }
  });

  it('不同时刻生成不同的键', () => {
    const first = executionIdempotencyKey('WO-1', 'RPT', at, token);
    const next = executionIdempotencyKey('WO-1', 'RPT', new Date(at.getTime() + 1000), token);
    expect(first).not.toBe(next);
    expect(next).toBe('WO-1-RPT-20261124090508-A1B2');
  });
});
