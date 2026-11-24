// 未预期异常的诊断记录（TD-API-004）。响应体保持固定的 internal_error（不向客户端泄露
// 内部细节），但服务端日志必须能定位失败点：此前两条分发路径——legacy dispatch 的 catch 与
// Fastify 桥的 setErrorHandler——都直接丢弃 cause，生产上的 500 无从诊断。
//
// 日志不携带载荷是既定安全契约（foundation-api「without payload leakage」）：异常消息会回显
// 请求数据（解析/校验错误常把用户输入带在消息里），所以这里只记类型、系统错误码与栈帧——
// 栈帧只有函数名与文件行号，足以定位语句；数据库类错误另有 SQLSTATE 可查。
import type { OperationalLogger } from '@kingturf/domain';

const MAX_FRAMES = 10;
const MAX_FRAME_LENGTH = 240;

// 首行是「类型: 消息」，丢弃；只保留 "at …" 帧，多行消息因此也不会混入。
const framesOf = (stack: string | undefined): readonly string[] =>
  stack === undefined
    ? []
    : stack
        .split('\n')
        .slice(1)
        .filter((line) => line.trimStart().startsWith('at '))
        .slice(0, MAX_FRAMES)
        .map((line) => line.trim().slice(0, MAX_FRAME_LENGTH));

const describe = (
  cause: unknown,
): Readonly<{ name: string; code?: string; frames: readonly string[] }> => {
  if (!(cause instanceof Error)) return { name: typeof cause, frames: [] };
  const code = (cause as { code?: unknown }).code;
  return {
    name: cause.name,
    ...(typeof code === 'string' ? { code: code.slice(0, 64) } : {}),
    frames: framesOf(cause.stack),
  };
};

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
