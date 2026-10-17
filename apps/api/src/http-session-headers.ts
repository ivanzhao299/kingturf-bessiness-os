import type { IncomingMessage } from 'node:http';
import type { ApiRequest, ApiResponse } from './app.ts';

const sessionHeaders = [
  'cookie',
  'authorization',
  'origin',
  'sec-fetch-site',
  'sec-fetch-mode',
  'content-type',
  'x-kingturf-csrf',
  'x-kingturf-session-generation',
  'x-kingturf-session-intent',
] as const;
export function incomingSessionHeaders(
  request: IncomingMessage,
): Pick<ApiRequest, 'headers' | 'headersDistinct'> {
  return {
    headers: Object.fromEntries(
      sessionHeaders.map((name) => [name, request.headers[name] as string | undefined]),
    ),
    headersDistinct: Object.fromEntries(
      sessionHeaders
        .filter((name) => request.headersDistinct[name] !== undefined)
        .map((name) => [name, request.headersDistinct[name]]),
    ),
  };
}
export function outgoingHttpHeaders(
  headers: ApiResponse['headers'],
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([name, value]) => [
      name,
      typeof value === 'string' ? value : [...value],
    ]),
  );
}
