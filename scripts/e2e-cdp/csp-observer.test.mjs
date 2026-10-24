import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { CONTENT_SECURITY_POLICY } from '../../packages/config/src/csp.ts';
import { cspBinding, cspCollectorSource, createCspObserver, safeCspUrl } from './csp-observer.mjs';

test('CSP URL projection omits credentials/query/hash, data/blob bodies and inline samples', () => {
  assert.equal(
    safeCspUrl('https://synthetic:withheld@example.invalid/path?private=withheld#fragment'),
    'external-http',
  );
  assert.equal(safeCspUrl('data:image/png;base64,withheld'), 'data:');
  assert.equal(safeCspUrl('blob:https://example.invalid/withheld'), 'blob:');
  assert.equal(safeCspUrl('inline'), 'inline');
  assert.equal(safeCspUrl('x'.repeat(5000)), 'oversize');
  assert.ok(safeCspUrl('https://example.invalid/' + 'x'.repeat(2000)).length <= 512);
});
test('CSP metadata never preserves identity fragments in paths or arbitrary origins', () => {
  const outputs = [
    safeCspUrl('http://127.0.0.1:4173/api/v1/identity/synthetic-private-path'),
    safeCspUrl('http://127.0.0.1:4173/assets/synthetic-private-path.js'),
    safeCspUrl('https://identity.example.invalid/synthetic-private-path'),
  ];
  assert.deepEqual(outputs, ['loopback-api', 'loopback-static', 'external-http']);
  assert.ok(
    !JSON.stringify(outputs).includes('private') && !JSON.stringify(outputs).includes('identity'),
  );
});
const event = {
  effectiveDirective: 'style-src-attr',
  disposition: 'report',
  blockedURI: 'inline',
  documentURI: 'http://127.0.0.1:4173/?private=withheld#fragment',
  sourceFile: 'http://127.0.0.1:4173/assets/synthetic.js?private=withheld',
  lineNumber: 1,
  columnNumber: 2,
  sample: 'withheld-inline-code',
};
test('pre-navigation source binds the actual DOM event and projects only the allowed fields', () => {
  let listener;
  const messages = [];
  runInNewContext(cspCollectorSource, {
    URL,
    document: {
      addEventListener(name, callback) {
        assert.equal(name, 'securitypolicyviolation');
        listener = callback;
      },
    },
    [cspBinding]: (value) => messages.push(value),
  });
  listener(event);
  assert.equal(messages.length, 1);
  assert.ok(
    !messages[0].includes('private') &&
      !messages[0].includes('withheld') &&
      !messages[0].includes('sample'),
  );
  assert.equal(JSON.parse(messages[0]).disposition, 'report');
  for (let index = 0; index < 2000; index++) listener(event);
  assert.equal(messages.length, 1000, 'Per-document collection is bounded');
});
test('collector installation order precedes navigation and never injects session storage', async () => {
  const calls = [];
  await createCspObserver({ report: () => undefined }).install((method, params) => {
    calls.push({ method, params });
    return Promise.resolve({});
  });
  assert.deepEqual(
    calls.map((call) => call.method),
    ['Runtime.enable', 'Runtime.addBinding', 'Page.addScriptToEvaluateOnNewDocument'],
  );
  assert.ok(!calls[2].params.source.includes('sessionStorage'));
});
const documentResponse = (headers) => ({
  type: 'Document',
  response: { url: 'http://127.0.0.1:4173/', headers },
});
test('Document response proof rejects missing/wrong/meta-only or enforced policy', () => {
  const observer = createCspObserver({ report: () => undefined });
  assert.throws(() => observer.response(documentResponse({})), /Document/u);
  assert.throws(
    () => observer.response(documentResponse({ 'Content-Security-Policy-Report-Only': 'wrong' })),
    /Document/u,
  );
  assert.throws(
    () =>
      observer.response(
        documentResponse({
          'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY,
          'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        }),
      ),
    /enforcement/u,
  );
  observer.response(
    documentResponse({ 'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY }),
  );
  assert.equal(observer.snapshot().documents, 1);
});
test('send response proof is independent of the fixture and checks actual network status', () => {
  const sendPath = '/api/v1/business-documents/synthetic/send';
  const observer = createCspObserver({ report: () => undefined, sendPath });
  const result = (status) => ({
    type: 'Fetch',
    response: { url: 'http://127.0.0.1:4173' + sendPath, status },
  });
  assert.throws(() => observer.response(result(200)), /202/u);
  observer.response(result(202));
  assert.equal(observer.snapshot().sendResponses, 1);
});
test('node receiver bounds counts/samples, re-sanitizes and excludes reports with extra payload', () => {
  const observer = createCspObserver({ report: () => undefined });
  const safe = { ...event };
  delete safe.sample;
  const value = { phase: 'workspace', ...safe };
  for (let index = 0; index < 2100; index++)
    observer.receive({ name: cspBinding, payload: JSON.stringify(value) });
  observer.receive({
    name: cspBinding,
    payload: JSON.stringify({ ...value, sample: 'withheld-inline-code' }),
  });
  const snapshot = observer.snapshot();
  assert.equal(snapshot.total, 2000);
  assert.equal(snapshot.samples.length, 100);
  assert.ok(snapshot.dropped > 0 && snapshot.truncated);
  assert.ok(
    !JSON.stringify(snapshot).includes('private') && !JSON.stringify(snapshot).includes('withheld'),
  );
  assert.equal(observer.receive({ name: 'unrelated', payload: '{}' }), false);
});
test('sentinel requires an actual report-only script event and Document proof, not zero events', () => {
  const observer = createCspObserver({ report: () => undefined });
  assert.throws(() => observer.assertSentinel(), /Document/u);
  observer.response(
    documentResponse({ 'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY }),
  );
  assert.throws(() => observer.assertSentinel(), /sentinel/u);
  const safe = { ...event };
  delete safe.sample;
  observer.receive({
    name: cspBinding,
    payload: JSON.stringify({ ...safe, phase: 'sentinel', effectiveDirective: 'script-src-elem' }),
  });
  observer.assertSentinel();
  assert.equal(observer.snapshot().productionReceiverConfigured, false);
});
