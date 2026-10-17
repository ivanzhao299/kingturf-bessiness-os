import { exchange, RequestError } from './http-core';
import type { ResponseParser } from './shared/response-parser';
import type { SessionContext, LoginProof } from './session';
export { RequestError, requestId } from './http-core';

let sessionExpiredHandler: ((context: SessionContext) => void) | undefined;
/** Only the application owns UI invalidation; requests report their captured context. */
export function onSessionExpired(handler: ((context: SessionContext) => void) | undefined): void {
  sessionExpiredHandler = handler;
}

/** Protected/browser-login policy wraps the same statically loaded exchange engine. */
export async function json<T>(
  path: string,
  context: SessionContext | LoginProof | null,
  init?: RequestInit,
  decode: ResponseParser<unknown> | null = null,
): Promise<T> {
  const session = context && 'owner' in context ? context : null;
  const unsafe = !['GET', 'HEAD'].includes((init?.method ?? 'GET').toUpperCase());
  const current = () => {
    if (session && !session.owner.isCurrent())
      throw new RequestError('登录上下文已变化，请重新操作', 401);
  };
  return exchange<T>(path, init, decode, {
    prepare(headers) {
      headers.delete('authorization');
      headers.delete('x-kingturf-csrf');
      headers.delete('x-kingturf-session-generation');
      current();
      if (session && unsafe && !session.owner.canWrite())
        throw new RequestError('正在核验登录状态，请稍后重新操作', 403);
      if (session) headers.set('x-kingturf-session-generation', session.generation);
      if (context && unsafe) headers.set('x-kingturf-csrf', context.csrfToken);
    },
    received(response) {
      if (response.status === 401 && session) sessionExpiredHandler?.(session);
      if (!response.ok) return;
      current();
      if (
        response.status === 204 &&
        init?.method === 'PUT' &&
        path === '/api/v1/auth/credential' &&
        session
      )
        sessionExpiredHandler?.(session);
    },
    decoded: current,
  });
}
