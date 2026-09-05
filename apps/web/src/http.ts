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
export async function json<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: { message?: string; correlationId?: string };
      };
      controller.signal.throwIfAborted();
      throw new RequestError(
        body.error?.message ?? body.message ?? `请求失败（${String(response.status)}）`,
        response.status,
        body.error?.correlationId,
      );
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  } catch (error) {
    if (controller.signal.reason === timeoutError) throw timeoutError;
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abort);
  }
}
