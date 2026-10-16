import { json } from '../http';
import { parseStoredSessionToken } from './session-parser';
import { parseKnownDocumentResponse } from './document-response-parser';
export function createDocumentReadService() {
  const onlineDocumentApi = <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = parseStoredSessionToken(sessionStorage.getItem('kingturf.session'));
    if (!token) throw new Error('登录状态已失效，请重新登录');
    return json<T>(path, token, init, (value) => parseKnownDocumentResponse(path, value));
  };
  const onlineDocumentReadCache = new Map<string, Promise<unknown>>();
  const clearSessionReadCache = (): void => {
    onlineDocumentReadCache.clear();
  };
  const onlineDocumentRead = <T>(path: string): Promise<T> => {
    const cached = onlineDocumentReadCache.get(path);
    if (cached) return cached as Promise<T>;
    const request = onlineDocumentApi<T>(path).catch((error: unknown) => {
      onlineDocumentReadCache.delete(path);
      throw error;
    });
    onlineDocumentReadCache.set(path, request);
    return request;
  };
  return { onlineDocumentApi, clearSessionReadCache, onlineDocumentRead };
}
