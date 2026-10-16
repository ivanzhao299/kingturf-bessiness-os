import { json, requestId } from '../http';
import type { CommercialApi, Opportunity, CostMatrixPage } from '../commercial/types';

export const createFetchCommercialApi = (token: string): CommercialApi => ({
  async listOpportunities() {
    const response = await json<{
      items: readonly Opportunity[];
    }>('/api/v1/opportunities', token);
    return response.items;
  },
  async list(path) {
    if (
      path !== '/api/v1/ar-open-items' &&
      path !== '/api/v1/bank-payments' &&
      path !== '/api/v1/complaints'
    )
      return (await json<{ items: readonly Record<string, unknown>[] }>(path, token)).items;
    const items: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    const visitedCursors = new Set<string>();
    do {
      const query = new URLSearchParams({ limit: '100' });
      if (cursor) query.set('cursor', cursor);
      const page = await json<{
        items: readonly Record<string, unknown>[];
        nextCursor: string | null;
      }>(`${path}?${query.toString()}`, token);
      items.push(...page.items);
      if (page.nextCursor && visitedCursors.has(page.nextCursor))
        throw new Error('服务器返回了重复分页游标，已停止加载以避免重复数据');
      cursor = page.nextCursor;
      if (cursor) visitedCursors.add(cursor);
    } while (cursor);
    return items;
  },
  async listCostMatrixSummaries(query) {
    const parameters = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
      attention: query.attention,
      sort: query.sort,
    });
    if (query.query) parameters.set('q', query.query);
    if (query.productFamily) parameters.set('productFamily', query.productFamily);
    return json<CostMatrixPage>(`/api/v1/cost-matrix-summaries?${parameters.toString()}`, token);
  },
  get: (path) => json<Record<string, unknown>>(path, token),
  submit: (path, payload, method = 'POST') =>
    json<Record<string, unknown>>(path, token, {
      method,
      ...(method === 'POST' ? { headers: { 'idempotency-key': requestId() } } : {}),
      body: JSON.stringify(payload),
    }),
  async uploadCtrAttachment(versionId, file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const metadata = await json<Record<string, unknown>>('/api/v1/attachments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type === '' ? 'application/octet-stream' : file.type,
        size: file.size,
        checksum: hex,
      }),
    });
    if (typeof metadata.id !== 'string') throw new Error('附件元数据响应无效');
    const uploaded = await json<Record<string, unknown>>(
      `/api/v1/attachments/${metadata.id}/content`,
      token,
      { method: 'PUT', body: JSON.stringify({ contentBase64: btoa(binary) }) },
    );
    await json(`/api/v1/ctr-versions/${versionId}/attachments`, token, {
      method: 'POST',
      body: JSON.stringify({ attachmentId: metadata.id }),
    });
    return uploaded;
  },
  async uploadContractDocument(businessType, subjectType, subjectId, file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const checksum = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const metadata = await json<Record<string, unknown>>('/api/v1/attachments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        checksum,
      }),
    });
    if (typeof metadata.id !== 'string') throw new Error('附件元数据响应无效');
    await json(`/api/v1/attachments/${metadata.id}/content`, token, {
      method: 'PUT',
      body: JSON.stringify({ contentBase64: btoa(binary) }),
    });
    return json<Record<string, unknown>>('/api/v1/contract-documents', token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify({
        businessType,
        subjectType,
        subjectId,
        attachmentId: metadata.id,
        title: file.name,
      }),
    });
  },
  command: (revisionId, action, payload = {}) =>
    json<Record<string, unknown>>(`/api/v1/quote-revisions/${revisionId}/${action}`, token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    }),
});
