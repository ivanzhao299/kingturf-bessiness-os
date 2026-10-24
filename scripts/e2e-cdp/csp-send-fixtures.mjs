// Opt-in only. Every identity and credential is synthetic; none is logged or persisted here.
import { randomUUID } from 'node:crypto';
import { createStubRouter } from './fixtures.mjs';
import { documentEditorRoutes } from './document-editor-fixtures.mjs';

export const cspDocumentId = '44444444-4444-4444-8444-444444444444';
export const cspTaskId = '66666666-6666-4666-8666-666666666666';
export const cspDocumentTitle = 'CDP CSP 合成发送文档';
export const cspCredentials = Object.freeze({ login: 'csp-observation', password: randomUUID() });
export const cspSendFields = Object.freeze({
  recipientName: 'CSP Synthetic Recipient',
  recipientAddress: ['csp-recipient', 'example.invalid'].join('@'),
  subject: 'CSP Synthetic Subject',
  message: 'CSP Synthetic Observation Only',
});
const documentValue = {
  id: cspDocumentId,
  templateKey: '01-opportunities',
  title: cspDocumentTitle,
  route: 'opportunities',
  state: 'APPROVED',
  customerId: '55555555-5555-4555-8555-555555555555',
  currentVersion: 1,
  versions: [
    {
      version: 1,
      content: {
        body: 'CSP synthetic approved content',
        html: '<h2>CSP synthetic approved content</h2><p>Local observation, no external delivery.</p>',
      },
      changeSummary: 'Synthetic approved version',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  translations: [],
};
const reject = () => {
  throw new Error('unmapped synthetic API request');
};
const exactObject = (actual, expected) =>
  actual &&
  typeof actual === 'object' &&
  !Array.isArray(actual) &&
  Object.keys(actual).sort().join('|') === Object.keys(expected).sort().join('|') &&
  Object.entries(expected).every(([key, value]) => actual[key] === value);
const response = (value, status = 200) => ({ completion: null, status, value });
export function createCspSendRouter() {
  const base = createStubRouter({ salesViews: true });
  const token = randomUUID().replaceAll('-', '');
  const counts = new Map();
  let loggedIn = false;
  let sendKey;
  const count = (key) => counts.set(key, (counts.get(key) ?? 0) + 1);
  return {
    ...base,
    counts: () => ({ ...base.counts(), ...Object.fromEntries(counts) }),
    async respond(pathname, method, parameters = new URLSearchParams(), request) {
      if (!request || typeof request.url !== 'string' || request.method !== method) reject();
      const url = new URL(request.url);
      if (
        url.origin !== 'http://127.0.0.1:4173' ||
        url.username ||
        url.password ||
        url.hash ||
        url.pathname !== pathname ||
        url.searchParams.toString() !== parameters.toString()
      )
        reject();
      const headers = new Map();
      for (const [name, value] of Object.entries(request.headers ?? {})) {
        const key = name.toLowerCase();
        if (headers.has(key) || typeof value !== 'string') reject();
        headers.set(key, value);
      }
      const jsonBody = () => {
        if (
          typeof request.postData !== 'string' ||
          request.postData.length > 4000 ||
          headers.get('content-type') !== 'application/json'
        )
          reject();
        try {
          return JSON.parse(request.postData);
        } catch {
          return reject();
        }
      };
      if (pathname === '/api/v1/auth/login') {
        if (
          method !== 'POST' ||
          parameters.toString() !== '' ||
          loggedIn ||
          headers.has('authorization') ||
          !exactObject(jsonBody(), cspCredentials)
        )
          reject();
        loggedIn = true;
        count('cspLogin');
        return response({ token });
      }
      if (!loggedIn || headers.get('authorization') !== 'Bearer ' + token) reject();
      if (pathname === `/api/v1/business-documents/${cspDocumentId}/send`) {
        const expected = { expectedVersion: 1, channel: 'EMAIL', ...cspSendFields };
        const key = headers.get('idempotency-key');
        if (
          method !== 'POST' ||
          parameters.toString() !== '' ||
          !key ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(key) ||
          !exactObject(jsonBody(), expected) ||
          (sendKey !== undefined && sendKey !== key)
        )
          reject();
        sendKey = key;
        count('cspSend');
        return response({ id: cspTaskId, status: 'QUEUED' }, 202);
      }
      if (method !== 'GET' || request.postData !== undefined) reject();
      if (pathname === '/api/v1/document-connectors') {
        if (parameters.toString() !== '') reject();
        count('cspConnectors');
        return response({
          items: [
            {
              connector: 'EMAIL',
              label: 'CSP Synthetic Email',
              provider: 'SYNTHETIC',
              displayName: 'CSP Synthetic',
              status: 'READY',
              version: 1,
            },
          ],
        });
      }
      if (pathname === '/api/v1/business-documents') {
        const route = parameters.get('route');
        if (
          !documentEditorRoutes.includes(route) ||
          parameters.toString() !== new URLSearchParams({ route }).toString()
        )
          reject();
        count('cspDocumentList:' + route);
        return response({ items: route === 'opportunities' ? [documentValue] : [] });
      }
      if (pathname === `/api/v1/business-documents/${cspDocumentId}`) {
        if (parameters.toString() !== '') reject();
        count('cspDocumentDetail');
        return response(documentValue);
      }
      const result = await base.respond(pathname, method, parameters);
      if (pathname === '/api/v1/auth/session') {
        count('cspSession');
        return {
          ...result,
          value: {
            ...result.value,
            permissions: [
              ...result.value.permissions,
              'business-document:read',
              'business-document:send',
            ],
          },
        };
      }
      return result;
    },
  };
}
