import http from 'node:http';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const sessionOrigin = 'http://127.0.0.1:4173';
const apiMethods = new Map([
  ['/api/v1/auth/login-context', ['GET']],
  ['/api/v1/auth/login', ['POST']],
  ['/api/v1/auth/session', ['GET']],
  ['/api/v1/auth/logout', ['POST']],
  ['/api/v1/auth/credential', ['PUT']],
  ['/api/v1/employees', ['GET', 'POST']],
]);
const root = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));

export function assertBuiltWeb() {
  assert.ok(
    existsSync(`${root}/index.html`) && existsSync(`${root}/assets`),
    'owned SPA build required',
  );
}

export function createSessionGateway(servers, report, documentId) {
  const methods = new Map(apiMethods);
  for (const path of [
    '/api/v1/opportunities',
    '/api/v1/business-documents/reference-data',
    '/api/v1/document-connectors',
  ])
    methods.set(path, ['GET']);
  if (documentId) {
    assert.match(documentId, /^[a-f0-9-]{36}$/u);
    methods.set(`/api/v1/business-documents/${documentId}`, ['GET']);
  }
  const assets = new Set(
    (existsSync(`${root}/assets`) ? readdirSync(`${root}/assets`) : []).map(
      (name) => `/assets/${name}`,
    ),
  );
  const pending = [];
  const held = new Set();
  const upstreams = new Set();
  const seen = [];
  let blocked = 0;
  let index = 0;
  let closed = false;
  const allows = (url, method) => {
    try {
      const parsed = new URL(url);
      const documentList =
        method === 'GET' &&
        url === sessionOrigin + '/api/v1/business-documents?route=opportunities';
      return (
        (url === sessionOrigin + parsed.pathname || documentList) &&
        parsed.origin === sessionOrigin &&
        !parsed.username &&
        !parsed.password &&
        !parsed.hash &&
        (documentList ||
          methods.get(parsed.pathname)?.includes(method) ||
          (method === 'GET' &&
            !parsed.search &&
            (parsed.pathname === '/' ||
              parsed.pathname === '/favicon.ico' ||
              assets.has(parsed.pathname))))
      );
    } catch {
      return false;
    }
  };
  const arm = (method, path) => {
    let arrive;
    let release;
    const ready = new Promise((resolve) => {
      arrive = resolve;
    });
    const released = new Promise((resolve) => {
      release = resolve;
    });
    const barrier = {
      method,
      path,
      ready,
      release,
      released,
      arrive,
      status: null,
      noAuthCookie: false,
    };
    pending.push(barrier);
    held.add(barrier);
    return barrier;
  };
  const server = http.createServer((req, res) => {
    const fail = () => {
      blocked++;
      if (!res.headersSent) res.writeHead(502);
      res.end();
    };
    res.on('error', () => {
      blocked++;
    });
    try {
      const url = new URL(req.url, sessionOrigin);
      if (
        !req.url.startsWith('/') ||
        req.url.startsWith('//') ||
        !allows(sessionOrigin + req.url, req.method)
      ) {
        blocked++;
        res.writeHead(403).end();
        return;
      }
      if (!methods.has(url.pathname) && url.pathname !== '/api/v1/business-documents') {
        if (url.pathname === '/favicon.ico') {
          res.writeHead(204).end();
          return;
        }
        const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const type = path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.svg')
              ? 'image/svg+xml'
              : path.endsWith('.png')
                ? 'image/png'
                : 'text/html';
        res
          .writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
          .end(readFileSync(`${root}/${path}`));
        return;
      }
      const position = pending.findIndex(
        (item) => item.method === req.method && item.path === url.pathname,
      );
      const barrier = position < 0 ? null : pending.splice(position, 1)[0];
      const target = new URL(url.pathname + url.search, servers[index].origin);
      const upstream = http.request(
        target,
        { method: req.method, headers: { ...req.headers, host: target.host } },
        async (incoming) => {
          try {
            incoming.pause();
            incoming.on('error', fail);
            const cookies = incoming.headers['set-cookie'] ?? [];
            const noAuthCookie = !cookies.some((line) =>
              line.startsWith('__Host-kingturf-session='),
            );
            const observation = {
              method: req.method,
              path: url.pathname,
              status: incoming.statusCode,
              noAuthCookie,
              cookieCount: cookies.length,
              noStore: incoming.headers['cache-control'] === 'no-store',
              receivedSessionCookie: (req.headers.cookie ?? '').includes(
                '__Host-kingturf-session=',
              ),
              loginJsonNoToken: null,
              loginCookieContract:
                cookies.length === 2 &&
                cookies.every(
                  (line) =>
                    /; Path=\/; /u.test(line) &&
                    /; Secure; SameSite=Lax/u.test(line) &&
                    !/Domain=/iu.test(line),
                ) &&
                cookies.some(
                  (line) =>
                    line.startsWith('__Host-kingturf-session=') && line.includes('; HttpOnly;'),
                ),
            };
            seen.push(observation);
            if (barrier) {
              barrier.status = incoming.statusCode;
              barrier.noAuthCookie = noAuthCookie;
              barrier.onlyCsrfCookie =
                cookies.length === 1 && cookies[0].startsWith('__Host-kingturf-csrf=');
              barrier.arrive();
              await barrier.released;
              held.delete(barrier);
            }
            if (closed || res.destroyed) {
              incoming.destroy();
              return;
            }
            res.writeHead(incoming.statusCode, incoming.headers);
            res.flushHeaders();
            if (
              req.method === 'POST' &&
              url.pathname === '/api/v1/auth/login' &&
              incoming.statusCode === 200
            ) {
              let body = '';
              incoming.on('data', (chunk) => {
                if (body.length < 16384) body += chunk;
                else {
                  blocked++;
                }
              });
              incoming.on('end', () => {
                try {
                  observation.loginJsonNoToken = !Object.hasOwn(JSON.parse(body), 'token');
                } catch {
                  blocked++;
                  observation.loginJsonNoToken = false;
                }
              });
            }
            incoming.pipe(res);
          } catch {
            fail();
          }
        },
      );
      upstreams.add(upstream);
      upstream.on('close', () => upstreams.delete(upstream));
      upstream.on('error', () => {
        if (!closed) fail();
      });
      req.pipe(upstream);
    } catch {
      fail();
    }
  });
  server.requestTimeout = 20000;
  server.on('error', () => {
    blocked++;
  });
  return {
    allows,
    arm,
    seen,
    select(instance) {
      assert.ok(instance === 0 || instance === 1);
      index = instance;
    },
    faultServerError() {
      server.emit('error', new Error('injected owned listener error'));
    },
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(4173, '127.0.0.1', resolve);
      });
      report('gateway-ready', { port: 4173, owned: true, actualApiProxy: true });
    },
    async close() {
      closed = true;
      for (const barrier of held) barrier.release();
      for (const upstream of upstreams) upstream.destroy();
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      report('gateway-cleanup', { listenerGone: !server.listening, blocked });
    },
    assertClean() {
      assert.equal(blocked, 0, 'gateway unknown requests');
      assert.equal(held.size, 0, 'unreleased barriers');
    },
  };
}
