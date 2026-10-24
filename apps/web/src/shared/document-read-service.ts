import { json } from '../http';
import type { SessionContext } from '../session';
import { parseKnownDocumentResponse } from './document-response-parser';
export function createDocumentReadService(context: SessionContext | null = null) {
  const onlineDocumentApi = <T>(path: string, init?: RequestInit): Promise<T> => {
    if (!context?.owner.isCurrent()) throw new Error('登录状态已失效，请重新登录');
    return json<T>(path, context, init, (value) => parseKnownDocumentResponse(path, value));
  };
  const onlineDocumentReadCache = new Map<string, Promise<unknown>>();
  const clearSessionReadCache = (): void => {
    onlineDocumentReadCache.clear();
  };
  context?.owner.onDispose(clearSessionReadCache);
  const onlineDocumentRead = <T>(path: string): Promise<T> => {
    if (!context?.owner.isCurrent()) throw new Error('登录状态已失效，请重新登录');
    const key = `${context.generation}:${String(context.epoch)}:${path}`;
    const cached = onlineDocumentReadCache.get(key);
    if (cached) return cached as Promise<T>;
    const request = onlineDocumentApi<T>(path).catch((error: unknown) => {
      if (onlineDocumentReadCache.get(key) === request) onlineDocumentReadCache.delete(key);
      throw error;
    });
    onlineDocumentReadCache.set(key, request);
    return request;
  };
  return { onlineDocumentApi, clearSessionReadCache, onlineDocumentRead };
}
