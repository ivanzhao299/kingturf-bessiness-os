// TD-MFG-017（项目所有者裁定 2026-11-26）：制造主数据的内容指纹，只此一份实现。物料、BOM、
// 工艺路线的根创建入口（manufacturing-repositories.ts）与续版入口
// （manufacturing-version-repository.ts）都用它计算版本行的 canonical_hash。
//
// 这里涉及两种摘要。它们按设计就不同、各管一件事，不是重复实现，不要把它们「收敛」成一种：
//   1. 内容指纹（本文件）：回答「这份规格 / 行项的内容是什么」，落在版本行的 canonical_hash 上。
//      规范化在 TypeScript 里做（@kingturf/domain 的 canonicalizeWith）。数值口径见下方
//      manufacturingNumber：旧口径原本接受的输入（安全整数）文本与原来逐字节相同，所以新代码
//      给已有版本内容算出的指纹不会变；小数现在也接受。
//   2. 幂等请求绑定摘要（manufacturing-version-repository.ts 的 requestBinding）：回答「带这个
//      Idempotency-Key 的是不是同一个请求」，只落在续版回执的 request_hash 上。它在 SQL 里由
//      PostgreSQL 对 jsonb 规范文本求 sha256，自续版端点上线起口径未变；已有回执靠它重放，所以
//      保持不动（主协调裁定 2026-11-26：本次只收敛内容指纹）。
import { createHash } from 'node:crypto';
import { canonicalizeWith, DomainError, type CanonicalNumberPolicy } from '@kingturf/domain';

/**
 * 制造主数据的数值口径：安全整数照旧；有限的小数按最短往返十进制文本渲染（同一个数值只有
 * 一种写法，12.50 与 12.5 的指纹相同）。旧口径拒绝的另外两类数值继续拒绝：非有限值，以及
 * 超出安全整数范围的整数值（精度已不可信；裁定只放开了小数）。
 */
const manufacturingNumber: CanonicalNumberPolicy = (value) => {
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
    throw new DomainError(
      'invalid_request',
      'Canonical numeric inputs must be safe integers or finite decimals',
    );
  return String(value);
};

/** 制造主数据的内容指纹：sha256(规范文本)。 */
export const manufacturingContentHash = (value: unknown): string =>
  createHash('sha256').update(canonicalizeWith(manufacturingNumber, value)).digest('hex');
