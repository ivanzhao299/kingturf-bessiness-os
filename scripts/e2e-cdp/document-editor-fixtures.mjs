export const documentEditorId = '11111111-1111-4111-8111-111111111111';
export const documentEditorRoutes = [
  'opportunities',
  'technical-requirements',
  'technical-solutions',
  'procurement',
  'contracts',
  'quality-inspection',
  'shipments',
  'order-360',
  'quotes',
  'credit-review',
  'sales-orders',
  'manufacturing-master',
  'material-planning',
  'production-orders',
  'business-risks',
];
const documentValue = {
  id: documentEditorId,
  templateKey: '01-opportunities',
  title: 'CDP只读在线文档',
  route: 'opportunities',
  state: 'DRAFT',
  currentVersion: 2,
  versions: [
    {
      version: 1,
      content: {
        body: 'CDP-V1 earlier body',
        html: '<h2>CDP-V1 earlier body</h2><p>Original project specification.</p>',
      },
      changeSummary: 'CDP first version',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      version: 2,
      content: {
        body: 'CDP-V2 current body',
        html:
          '<h2 onclick="globalThis.__cdpDocumentUnsafe=true">CDP-V2 current body</h2><script>globalThis.__cdpDocumentUnsafe=true</script>' +
          Array.from(
            { length: 120 },
            (_, index) =>
              `<p>CDP controlled paragraph ${String(index + 1)}: project quality and delivery evidence.</p>`,
          ).join(''),
      },
      changeSummary: 'CDP current version',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  translations: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      sourceVersion: 2,
      targetLocale: 'en-US',
      provider: 'MANUAL',
      status: 'READY',
      content: {
        body: 'CDP-EN-READY',
        html: '<p onclick="globalThis.__cdpDocumentUnsafe=true">CDP-EN-READY</p>',
      },
    },
  ],
};

export function withDocumentEditor(router) {
  const counts = new Map();
  const count = (key) => counts.set(key, (counts.get(key) ?? 0) + 1);
  return {
    ...router,
    counts: () => ({ ...router.counts(), ...Object.fromEntries(counts) }),
    async respond(pathname, method, parameters = new URLSearchParams()) {
      if (pathname === '/api/v1/business-documents') {
        const route = parameters.get('route');
        if (
          method !== 'GET' ||
          !documentEditorRoutes.includes(route) ||
          parameters.toString() !== new URLSearchParams({ route }).toString()
        )
          throw new Error('unmapped synthetic document request');
        count(`documentList:${route}`);
        return {
          completion: null,
          status: 200,
          value: { items: route === 'opportunities' ? [documentValue] : [] },
        };
      }
      if (pathname === `/api/v1/business-documents/${documentEditorId}`) {
        if (method !== 'GET' || parameters.toString() !== '')
          throw new Error('unmapped synthetic document request');
        count('documentDetail');
        return { completion: null, status: 200, value: documentValue };
      }
      const response = await router.respond(pathname, method, parameters);
      if (pathname === '/api/v1/auth/session' && response.status === 200)
        return {
          ...response,
          value: {
            ...response.value,
            permissions: [...response.value.permissions, 'business-document:read'],
          },
        };
      return response;
    },
  };
}
