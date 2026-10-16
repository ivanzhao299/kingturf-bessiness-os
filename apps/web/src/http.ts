import {
  responseErrorMessage,
  responseErrorCorrelation,
  type ResponseParser,
} from './shared/response-parser';

let sessionExpiredHandler: ((token: string) => void) | undefined;

/** Only the application owns session storage and navigation; requests report the affected token. */
export function onSessionExpired(handler: ((token: string) => void) | undefined): void {
  sessionExpiredHandler = handler;
}

export const requestId = () => globalThis.crypto.randomUUID();

export class RequestError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

/** Bound the complete exchange, including a stalled response body, not just the headers. */
export async function json<T>(
  path: string,
  token: string,
  init?: RequestInit,
  decode: ResponseParser<unknown> | null = null,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  if (init?.body !== undefined) headers.set('content-type', 'application/json');
  headers.set('x-correlation-id', requestId());
  if (token) headers.set('authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timeoutError = new Error('请求超时，请检查网络后重试');
  const timeout = globalThis.setTimeout(() => {
    controller.abort(timeoutError);
  }, 15_000);
  const externalSignal = init?.signal;
  const abort = () => {
    controller.abort(externalSignal?.reason);
  };
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
      signal: controller.signal,
    });
    if (response.status === 401 && token) sessionExpiredHandler?.(token);
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      controller.signal.throwIfAborted();
      throw new RequestError(
        responseErrorMessage(body, () => `请求失败（${String(response.status)}）`),
        response.status,
        responseErrorCorrelation(body),
      );
    }
    if (
      response.status === 204 &&
      init?.method === 'PUT' &&
      path === '/api/v1/auth/credential' &&
      token
    )
      sessionExpiredHandler?.(token);
    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json();
    return (decode ? decode(body) : body) as T;
  } catch (error) {
    if (controller.signal.reason === timeoutError) throw timeoutError;
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abort);
  }
}
