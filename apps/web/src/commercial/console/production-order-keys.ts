// U3-MFG-5：车间执行幂等键——由前端生成，可读且唯一，不再让用户手填。
// 形状：`工单号-RPT-yyyyMMddHHmmss-四位随机`（领退料用 MAT）。须过服务端 assertStableCode
//（大写字母开头，其后大写字母 / 数字 / 下划线 / 连字符，总长不超过 64）——API 契约测试
// production-order-execution.test.ts 用同一形状的键走真实解析链。
// 工序报工与领退料的端点以幂等键去重；成品卷入库端点没有幂等键（唯一性由卷号 / 批次号约束）。
export type ExecutionKeyKind = 'RPT' | 'MAT';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_LENGTH = 64;
const TOKEN_LENGTH = 4;

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

// 秒级时间戳取本地时间（用户读得懂）；唯一性由「秒级时间 + 四位随机」在同一工单内保证。
export const executionKeyStamp = (now: Date): string =>
  `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`;

// 四位随机取大写字母与数字（36^4 ≈ 168 万种），来自 Web Crypto。
const randomToken = (): string => {
  const words = globalThis.crypto.getRandomValues(new Uint32Array(TOKEN_LENGTH));
  return Array.from(words, (word) => ALPHABET.charAt(word % ALPHABET.length)).join('');
};

// 工单编号经服务端 stableCode 校验，但列表数据不保证：清洗成合法字符，不以字母开头时补
// `WO` 前缀，并给后缀留出长度。
const headOf = (orderNumber: string, room: number): string => {
  const cleaned = orderNumber
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/gu, '')
    .slice(0, room)
    .replace(/-+$/u, '');
  return (/^[A-Z]/u.test(cleaned) ? cleaned : `WO${cleaned}`).slice(0, room);
};

export const executionIdempotencyKey = (
  orderNumber: string,
  kind: ExecutionKeyKind,
  now: Date = new Date(),
  random: () => string = randomToken,
): string => {
  const tail = `-${kind}-${executionKeyStamp(now)}-${random()}`;
  return `${headOf(orderNumber, MAX_LENGTH - tail.length)}${tail}`;
};
