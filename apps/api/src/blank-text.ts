// TD-OPS-006（2026-11-26 项目所有者裁定）：检验与投诉写路径上「留空」的判据。
// 与 app-values.ts 的 string() 同口径——字符串去掉首尾空白后为空即留空（空串、纯空白串）。
// null、数字、布尔、对象都不是留空：交回原解析器按原口径拒绝，不放宽。
// 留空落库有两种，按各列的可空性分开：
//   - 可空列 quality_plan_characteristics.lower_limit / upper_limit：当未传处理，仓储存 NULL；
//   - NOT NULL 文本列 quality_inspection_results.notes 与
//     nonconformance_reports.temporary_containment：存空串，不把纯空白原样存库。
// 只在这几条路由的解析点使用（quality-plan-create / quality-result-record / ncr-create）。

/** 字符串形式的留空：空串，或去掉首尾空白后为空的字符串。 */
export const isBlankText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === '';

/**
 * 未填的规格上下限：未传（undefined）、null 或字符串形式的留空。null 与空串是同一个意思的两种
 * 写法（数字输入框发哪一种取决于组件实现），不该因此一个通过一个被拒。
 */
export const isUnfilledLimit = (value: unknown): boolean =>
  value === undefined || value === null || isBlankText(value);

/**
 * NOT NULL 文本列的取值：字符串形式留空 → ''；其余交回必填解析器，未传、null 与非字符串的
 * 拒绝消息与此前逐字相同。
 */
export const blankableText = (
  value: unknown,
  name: string,
  parse: (value: unknown, name: string) => string,
): string => (isBlankText(value) ? '' : parse(value ?? '', name));
