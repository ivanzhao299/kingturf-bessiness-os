// WF-A（TD-WF-003 / TD-WF-013）：数据库拒绝的「识别」工具。供端点在调用点就地映射成带说明
// 的业务错误——刻意只做识别：状态码与提示文字由各端点自己给出，不进全局错误处理器
//（主协调裁定：不做全局映射）。
//
// 数据库原始消息不回显给客户端：唯一约束的消息带请求值（「Key (tenant_id,
// customer_number)=(…, 'CUST-1') already exists.」），回显即泄露——与 request-failure.ts
// 的「日志不带载荷」是同一条契约。所以这里只按约束名、或按守卫触发器里写死的消息做
// 精确匹配；匹配不上就交给调用方原样抛出（仍是 500，照常留诊断日志）。
type PgRejection = Readonly<{ code?: unknown; constraint?: unknown; message?: unknown }>;

const rejection = (error: unknown): PgRejection | null =>
  typeof error === 'object' && error !== null ? error : null;

/** 唯一约束冲突（SQLSTATE 23505）且冲突的约束名恰为 constraint。 */
export const isUniqueViolation = (error: unknown, constraint: string): boolean => {
  const found = rejection(error);
  return found?.code === '23505' && found.constraint === constraint;
};

/** 检查约束拒绝（SQLSTATE 23514），仅精确匹配约束名。 */
export const isCheckViolation = (error: unknown, constraint: string): boolean => {
  const found = rejection(error);
  return found?.code === '23514' && found.constraint === constraint;
};

/**
 * 守卫触发器的 RAISE EXCEPTION（SQLSTATE P0001）且消息精确等于 hints 的某个键时，返回对应
 * 的说明；其余情况返回 null。
 */
export const guardRejection = (
  error: unknown,
  hints: Readonly<Record<string, string>>,
): string | null => {
  const found = rejection(error);
  if (found?.code !== 'P0001' || typeof found.message !== 'string') return null;
  return Object.hasOwn(hints, found.message) ? (hints[found.message] ?? null) : null;
};
