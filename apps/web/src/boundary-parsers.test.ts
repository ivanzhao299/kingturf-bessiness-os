import { afterEach, expect, it, vi } from 'vitest';
import { json, onSessionExpired, RequestError } from './http';
import { createFetchCommercialApi } from './shared/commercial-http';
import { createFetchCrmApi } from './shared/crm-http';
import { createDocumentReadService } from './shared/document-read-service';
import { parseResponseRecord } from './shared/response-parser';
import {
  parseResponseArray,
  parseResponseItems,
  parseCursorPage,
  parseCostMatrixPage,
  parseCustomer360Response,
} from './shared/api-response-parser';
import {
  parseStoredSessionToken,
  parseSessionExpired,
  parseLoginResponse,
  parseSessionResponse,
} from './shared/session-parser';
import { parseSidebarCollapsed, parseStoredRegisterView } from './shared/register-view-parser';
import { parseKnownDocumentResponse } from './shared/document-response-parser';

afterEach(() => {
  onSessionExpired(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function response(value: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(value) };
}

it.each(
  [null, 'text', 13, true, [{ id: 'a' }], { any: ['value'] }].map((value) => [value] as const),
)('keeps the generic transport compatible with legal JSON %#', async (value) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(value)));
  await expect(json('/unknown-json', '')).resolves.toBe(value);
});

it('decodes once after the response body, preserving references, receiver and public arity', async () => {
  const value = { items: [{}], extra: 'retained' };
  const reply = response(value);
  const events: string[] = [];
  reply.json.mockImplementation(() => {
    events.push('body');
    return Promise.resolve(value);
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply));
  const decode = vi.fn((input: unknown) => {
    events.push('decode');
    return parseResponseItems(input);
  });
  await expect(json('/known', '', undefined, decode)).resolves.toBe(value);
  expect(events).toEqual(['body', 'decode']);
  expect(reply.json.mock.contexts[0]).toBe(reply);
  expect(decode).toHaveBeenCalledExactlyOnceWith(value);
  expect(json.length).toBe(3);
});

it('does not decode 204 or errors, and notifies 401 before reading its body', async () => {
  const events: string[] = [];
  const denied = response(null, 401);
  denied.json.mockImplementation(() => {
    events.push('body');
    return Promise.resolve(null);
  });
  onSessionExpired(() => {
    events.push('expire');
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce(response(undefined, 204)).mockResolvedValueOnce(denied),
  );
  const decode = vi.fn(parseResponseRecord);
  await expect(json('/known', '', undefined, decode)).resolves.toBeUndefined();
  await expect(json('/known', 'unit-token', undefined, decode)).rejects.toMatchObject({
    status: 401,
  });
  expect(decode).not.toHaveBeenCalled();
  expect(events).toEqual(['expire', 'body']);
});

it.each(
  [null, [], true, 7, 'denied', { error: [] }, { error: { message: 7, correlationId: {} } }].map(
    (value) => [value] as const,
  ),
)('keeps HTTP status for malformed error bodies %#', async (value) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(value, 403)));
  await expect(json('/known', '')).rejects.toBeInstanceOf(RequestError);
  await expect(json('/known', '')).rejects.toMatchObject({
    status: 403,
    message: '请求失败（403）',
    correlationId: undefined,
  });
});

it('preserves nested error priority, empty strings and correlation IDs', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        response({ message: 'outer', error: { message: '', correlationId: '' } }, 409),
      ),
  );
  await expect(json('/known', '')).rejects.toMatchObject({
    status: 409,
    message: '',
    correlationId: '',
  });
});

it('cleans the exchange after decoder rejection without retaining abort listeners', async () => {
  const external = new AbortController();
  const remove = vi.spyOn(external.signal, 'removeEventListener');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null)));
  await expect(
    json('/known', '', { signal: external.signal }, parseResponseRecord),
  ).rejects.toThrow('格式无效');
  expect(remove).toHaveBeenCalledExactlyOnceWith('abort', expect.any(Function));
});

it('allows projected empty records and returns the original list and page objects', () => {
  const items = [{}, { projected: null }];
  const page = { items, extra: 1 };
  expect(parseResponseArray(items)).toBe(items);
  expect(parseResponseItems(page)).toBe(page);
  expect(parseResponseRecord(items[0])).toBe(items[0]);
});

it.each(
  [null, [], {}, { items: null }, { items: [null] }, { items: ['bad'] }].map(
    (value) => [value] as const,
  ),
)('rejects malformed known list envelopes %#', (value) => {
  expect(() => parseResponseItems(value)).toThrow();
});

it.each(
  [{}, { items: [] }, { items: [], nextCursor: 2 }, { items: [], nextCursor: false }].map(
    (value) => [value] as const,
  ),
)('rejects missing or malformed cursor metadata %#', (value) => {
  expect(() => parseCursorPage(value)).toThrow();
});

it('preserves null and empty-string cursors without normalization', () => {
  for (const nextCursor of [null, '', 'next']) {
    const page = { items: [{}], nextCursor };
    expect(parseCursorPage(page)).toBe(page);
  }
});

it.each(
  [
    {},
    { items: [], total: -1, page: 1, pageSize: 20 },
    { items: [], total: 1, page: 0, pageSize: 20 },
    { items: [], total: 1, page: 1, pageSize: '20' },
    { items: [], total: Infinity, page: 1, pageSize: 20 },
  ].map((value) => [value] as const),
)('rejects malformed cost page metadata %#', (value) => {
  expect(() => parseCostMatrixPage(value)).toThrow();
});

const customer360 = {
  customer: {},
  contacts: [{}],
  ownership: [],
  leads: [],
  opportunities: [],
  activities: [],
  unavailableSections: ['orders', 'finance'],
};

it('does not invent a new maximum for valid numeric metadata', () => {
  const page = { items: [{}], total: 2 ** 53, page: 1, pageSize: 20 };
  expect(parseCostMatrixPage(page)).toBe(page);
});

it('preserves projected customer 360 records but requires every fixed container', () => {
  expect(parseCustomer360Response(customer360)).toBe(customer360);
  for (const key of Object.keys(customer360)) {
    const partial = Object.fromEntries(
      Object.entries(customer360).filter(([field]) => field !== key),
    );
    expect(() => parseCustomer360Response(partial)).toThrow();
  }
  expect(() => parseCustomer360Response({ ...customer360, unavailableSections: [1] })).toThrow();
});

it('runs schema checks in real CRM and commercial HTTP adapters', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ items: [null] }));
  vi.stubGlobal('fetch', fetcher);
  const crm = createFetchCrmApi('unit-token');
  const commercial = createFetchCommercialApi('unit-token');
  await expect(crm.listCustomers()).rejects.toThrow();
  await expect(commercial.list('/api/v1/quotes')).rejects.toThrow();
  fetcher.mockResolvedValue(response([{}]));
  await expect(crm.listEmployees()).resolves.toEqual([{}]);
  fetcher.mockResolvedValue(response({ items: [], nextCursor: 3 }));
  await expect(commercial.list('/api/v1/ar-open-items')).rejects.toThrow();
  fetcher.mockResolvedValue(response({ ...customer360, unavailableSections: undefined }));
  await expect(crm.customer360('unit-customer')).rejects.toThrow();
});

it.each(
  [null, '', {}, [], 42, 'bad token', 'bad\nvalue', '"json-token"', '{"token":"value"}'].map(
    (value) => [value] as const,
  ),
)('rejects malformed stored tokens without decoding JSON %#', (value) => {
  expect(parseStoredSessionToken(value)).toBeNull();
});

it('preserves opaque tokens, exact marker literals and valid session object identity', () => {
  for (const token of ['old', 'a_b-9', 'cdp-isolated-synthetic-session']) {
    expect(parseStoredSessionToken(token)).toBe(token);
    const login = { token, extra: 1 };
    expect(parseLoginResponse(login)).toBe(login);
  }
  const session = {
    employeeId: 'e',
    companyId: 'c',
    permissions: ['unknown:read'],
    displayName: null,
    employeeNumber: '',
    extra: 1,
  };
  expect(parseSessionResponse(session)).toBe(session);
  for (const value of [null, undefined, 1, true, 'true', 'false', '1']) {
    expect(parseSessionExpired(value)).toBe(value === '1');
    expect(parseSidebarCollapsed(value)).toBe(value === 'true');
  }
});

it.each(
  [
    { employeeId: 'e', companyId: 'c', permissions: [] },
    {
      employeeId: 'e',
      companyId: 'c',
      permissions: [],
      displayName: undefined,
      employeeNumber: undefined,
    },
    { employeeId: 'e', companyId: 'c', permissions: [], displayName: null, employeeNumber: null },
    {
      employeeId: 'e',
      companyId: 'c',
      permissions: ['future:read'],
      displayName: '',
      employeeNumber: 'E',
    },
  ].map((value) => [value] as const),
)('preserves legal optional session fields %#', (value) => {
  expect(parseSessionResponse(value)).toBe(value);
});

it.each([null, [], {}, { token: 1 }, { token: 'bad token' }].map((value) => [value] as const))(
  'rejects malformed login DTOs %#',
  (value) => {
    expect(() => parseLoginResponse(value)).toThrow();
  },
);

it.each(
  [
    null,
    [],
    {},
    { employeeId: 'e', companyId: 'c', permissions: [1] },
    { employeeId: 'e', companyId: 'c', permissions: [], displayName: {} },
  ].map((value) => [value] as const),
)('rejects malformed session DTOs %#', (value) => {
  expect(() => parseSessionResponse(value)).toThrow();
});

it.each(
  [
    null,
    [],
    1,
    true,
    'text',
    { query: 1 },
    { query: 'partial', compact: 'true' },
    { fields: [] },
  ].map((value) => [value] as const),
)('rejects an entire malformed register view rather than restoring partial fields %#', (value) => {
  expect(() => parseStoredRegisterView(JSON.stringify(value))).toThrow();
});

it('keeps valid optional and unknown register fields without coercion', () => {
  const view = {
    query: 'kept',
    status: 'future',
    attention: '',
    sortMode: 'unknown',
    compact: false,
    fields: 'future',
    extra: { kept: true },
  };
  expect(parseStoredRegisterView(JSON.stringify(view))).toEqual(view);
  expect(parseStoredRegisterView('{}')).toEqual({});
  expect(parseStoredRegisterView(null)).toBeUndefined();
  expect(parseStoredRegisterView('')).toBeUndefined();
});

const document = {
  id: 'doc',
  templateKey: 'template',
  title: '',
  route: 'quotes',
  currentVersion: 1,
  unknown: true,
};

it('uses fixed document schemas without transforming values or unknown JSON paths', () => {
  expect(parseKnownDocumentResponse('/api/v1/business-documents/doc', document)).toBe(document);
  const page = { items: [document] };
  expect(parseKnownDocumentResponse('/api/v1/business-documents?route=quotes', page)).toBe(page);
  for (const value of [null, 'text', 1, [], {}])
    expect(parseKnownDocumentResponse('/unknown-document-path', value)).toBe(value);
  for (const value of [[], {}, { items: [{}] }])
    expect(parseKnownDocumentResponse('/api/v1/quotes', value)).toBe(value);
});

it.each([
  ['/api/v1/business-documents/doc', {}],
  ['/api/v1/business-documents', { items: [null] }],
  ['/api/v1/business-documents/reference-data', { customers: [], orders: null, employees: [] }],
  ['/api/v1/business-documents/doc/versions', { currentVersion: 0 }],
  ['/api/v1/business-documents/doc/send', { id: 'task' }],
  ['/api/v1/business-documents/doc/translations', { status: false }],
  ['/api/v1/document-connectors', { items: null }],
] as const)('rejects malformed known document responses %s', (path, value) => {
  expect(() => parseKnownDocumentResponse(path, value)).toThrow();
});

it.each(
  [
    { versions: [{}] },
    { versions: [{ content: null }] },
    { versions: [{ content: [] }] },
    { versions: [{ content: { body: 7 } }] },
    { versions: [{ content: { html: {} } }] },
    { translations: [{ content: { body: false } }] },
  ].map((value) => [value] as const),
)('rejects malformed document content %#', (value) => {
  expect(() =>
    parseKnownDocumentResponse('/api/v1/business-documents/doc', { ...document, ...value }),
  ).toThrow();
});

it('keeps valid empty content, absent or null optional arrays and null translated content', () => {
  for (const fields of [
    {},
    { versions: null, translations: null, reviewEvents: null, dispatches: null },
    { versions: [{ content: {} }], translations: [{}] },
    { versions: [{ content: { body: null, html: null } }], translations: [{ content: null }] },
  ]) {
    const value = { ...document, ...fields };
    expect(parseKnownDocumentResponse('/api/v1/business-documents/doc', value)).toBe(value);
  }
});

it('preserves document synchronous token checks and cached Promise identity', async () => {
  let token: string | null = null;
  const getItem = vi.fn(() => token);
  vi.stubGlobal('sessionStorage', { getItem });
  const page = { items: [] };
  const fetcher = vi.fn().mockResolvedValue(response(page));
  vi.stubGlobal('fetch', fetcher);
  const service = createDocumentReadService();
  expect(() => service.onlineDocumentApi('/api/v1/business-documents')).toThrow('登录状态已失效');
  expect(fetcher).not.toHaveBeenCalled();
  token = 'unit-token';
  const first = service.onlineDocumentRead('/api/v1/business-documents');
  const second = service.onlineDocumentRead('/api/v1/business-documents');
  expect(first).toBe(second);
  await expect(first).resolves.toBe(page);
  expect(fetcher).toHaveBeenCalledTimes(1);
  service.clearSessionReadCache();
  token = 'new-token';
  const third = service.onlineDocumentRead('/api/v1/business-documents');
  expect(third).not.toBe(first);
  await third;
  expect(getItem).toHaveBeenCalledTimes(3);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('removes a malformed document read from the original cache so explicit retry can succeed', async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => 'unit-token' });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ items: null }))
    .mockResolvedValueOnce(response({ items: [] }));
  vi.stubGlobal('fetch', fetcher);
  const service = createDocumentReadService();
  await expect(service.onlineDocumentRead('/api/v1/business-documents')).rejects.toThrow();
  await expect(service.onlineDocumentRead('/api/v1/business-documents')).resolves.toEqual({
    items: [],
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
