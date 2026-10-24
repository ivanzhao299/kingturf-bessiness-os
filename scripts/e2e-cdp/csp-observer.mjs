import assert from 'node:assert/strict';
import { CONTENT_SECURITY_POLICY } from '../../packages/config/src/csp.ts';

export const cspBinding = '__kingturfCspObservation';
const phases = new Set(['login', 'workspace', 'send', 'sentinel']);
const directives = new Set([
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'img-src',
  'font-src',
  'connect-src',
  'frame-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
  'worker-src',
  'media-src',
  'manifest-src',
]);
export function safeCspUrl(value) {
  if (typeof value !== 'string') return 'other';
  if (
    [
      'inline',
      'eval',
      'wasm-eval',
      '',
      'loopback-document',
      'loopback-static',
      'loopback-api',
      'loopback-other',
      'external-http',
      'other-scheme',
      'other',
      'oversize',
    ].includes(value)
  )
    return value;
  if (value.startsWith('data:')) return 'data:';
  if (value.startsWith('blob:')) return 'blob:';
  if (value.length > 4096) return 'oversize';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return 'other-scheme';
    if (url.origin !== 'http://127.0.0.1:4173') return 'external-http';
    if (url.pathname === '/') return 'loopback-document';
    if (url.pathname.startsWith('/assets/')) return 'loopback-static';
    if (url.pathname.startsWith('/api')) return 'loopback-api';
    return 'loopback-other';
  } catch {
    return 'other';
  }
}
function install() {
  globalThis.__kingturfCspPhase = 'login';
  let sent = 0;
  globalThis.document.addEventListener('securitypolicyviolation', (event) => {
    if (sent >= 1000) return;
    sent++;
    globalThis.__kingturfCspObservation(
      JSON.stringify({
        phase: globalThis.__kingturfCspPhase,
        effectiveDirective: event.effectiveDirective,
        disposition: event.disposition,
        blockedURI: safeCspUrl(event.blockedURI),
        documentURI: safeCspUrl(event.documentURI),
        sourceFile: safeCspUrl(event.sourceFile),
        lineNumber: Math.min(1000000, Math.max(0, event.lineNumber)),
        columnNumber: Math.min(1000000, Math.max(0, event.columnNumber)),
      }),
    );
  });
}
export const cspCollectorSource = `(() => { const safeCspUrl = ${safeCspUrl.toString()}; (${install.toString()})(); })();`;

export function createCspObserver({ report, sendPath }) {
  const samples = [];
  const counts = new Map();
  let total = 0;
  let dropped = 0;
  let documents = 0;
  let sendResponses = 0;
  const receive = (params) => {
    if (params.name !== cspBinding) return false;
    if (
      typeof params.payload !== 'string' ||
      params.payload.length > 4096 ||
      total + dropped >= 2000
    ) {
      dropped = Math.min(1000000, dropped + 1);
      return true;
    }
    try {
      const value = JSON.parse(params.payload);
      const keys = [
        'phase',
        'effectiveDirective',
        'disposition',
        'blockedURI',
        'documentURI',
        'sourceFile',
        'lineNumber',
        'columnNumber',
      ];
      assert.ok(value && typeof value === 'object' && !Array.isArray(value));
      assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
      assert.ok(phases.has(value.phase) && directives.has(value.effectiveDirective));
      assert.ok(['report', 'enforce'].includes(value.disposition));
      assert.ok(
        ['blockedURI', 'documentURI', 'sourceFile'].every((key) => typeof value[key] === 'string'),
      );
      assert.ok(
        ['lineNumber', 'columnNumber'].every(
          (key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 1000000,
        ),
      );
      const item = {
        phase: value.phase,
        effectiveDirective: value.effectiveDirective,
        disposition: value.disposition,
        blockedURI: safeCspUrl(value.blockedURI),
        documentURI: safeCspUrl(value.documentURI),
        sourceFile: safeCspUrl(value.sourceFile),
        lineNumber: value.lineNumber,
        columnNumber: value.columnNumber,
      };
      const key = [item.phase, item.effectiveDirective, item.disposition].join(':');
      counts.set(key, Math.min(1000000, (counts.get(key) ?? 0) + 1));
      total++;
      if (samples.length < 100) samples.push(item);
    } catch {
      dropped = Math.min(1000000, dropped + 1);
    }
    return true;
  };
  return {
    receive,
    async install(send) {
      await send('Runtime.enable', {});
      await send('Runtime.addBinding', { name: cspBinding });
      await send('Page.addScriptToEvaluateOnNewDocument', { source: cspCollectorSource });
    },
    response(params) {
      if (
        sendPath &&
        ['Fetch', 'XHR'].includes(params.type) &&
        params.response.url === 'http://127.0.0.1:4173' + sendPath
      ) {
        assert.equal(params.response.status, 202, 'Actual intercepted send response must be 202');
        sendResponses = Math.min(100, sendResponses + 1);
        report('csp-send-network', { status: 202, synthetic: true, responseCount: sendResponses });
      }
      if (params.type !== 'Document') return;
      const url = new URL(params.response.url);
      if (url.origin !== 'http://127.0.0.1:4173' || url.pathname !== '/') return;
      const entries = Object.entries(params.response.headers);
      const values = (key) =>
        entries.filter(([name]) => name.toLowerCase() === key).map(([, value]) => value);
      assert.deepEqual(
        values('content-security-policy-report-only'),
        [CONTENT_SECURITY_POLICY],
        'Real HTML Document must carry exactly the reviewed report-only policy',
      );
      assert.deepEqual(
        values('content-security-policy'),
        [],
        'Test HTML must not enable enforcement',
      );
      documents = Math.min(100, documents + 1);
      report('csp-document-policy', {
        document: documents,
        reportOnlyMatches: true,
        enforced: false,
      });
    },
    snapshot() {
      return {
        documents,
        sendResponses,
        total,
        dropped,
        counts: Object.fromEntries(counts),
        samples: [...samples],
        truncated: total > samples.length,
        productionReceiverConfigured: false,
      };
    },
    assertSentinel() {
      assert.ok(documents > 0, 'Document header check must actually run');
      assert.ok(
        (counts.get('sentinel:script-src-elem:report') ?? 0) > 0,
        'A real report-only script sentinel event must be observed',
      );
    },
  };
}
