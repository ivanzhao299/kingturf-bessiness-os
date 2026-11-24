// 未预期异常的诊断记录（TD-API-004）。响应体保持固定的 internal_error（不向客户端泄露
// 内部细节），但服务端日志必须留下异常本身：此前两条分发路径——legacy dispatch 的 catch 与
// Fastify 桥的 setErrorHandler——都直接丢弃 cause，生产上的 500 无从诊断。
import type { OperationalLogger } from '@kingturf/domain';

const describe = (cause: unknown): Readonly<{ name: string; message: string; stack?: string }> =>
  cause instanceof Error
    ? {
        name: cause.name,
        message: cause.message,
        ...(cause.stack === undefined ? {} : { stack: cause.stack }),
      }
    : { name: typeof cause, message: String(cause) };

export const recordRequestFailure = (
  logger: OperationalLogger | undefined,
  request: Readonly<{ method: string; pathname: string }>,
  correlationId: string,
  statusCode: number,
  cause: unknown,
): void => {
  if (!logger) return;
  try {
    logger.write({
      level: 'error',
      event: 'http.request.failed',
      correlationId,
      statusCode,
      method: request.method,
      pathname: request.pathname,
      error: describe(cause),
    });
  } catch {
    // 日志通道故障不得掩盖原始失败：响应仍按原状态码返回。
  }
};
