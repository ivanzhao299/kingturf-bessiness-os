import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { createDriver } from './driver.mjs';

const origin = 'http://127.0.0.1:4173';
const sessionName = '__Host-kingturf-session';
const csrfName = '__Host-kingturf-csrf';
const paths = new Map([
  ['/', 'GET'],
  ['/cookie-preflight.js', 'GET'],
  ['/favicon.ico', 'GET'],
  ['/__cookie-http/login', 'POST'],
  ['/__cookie-http/session', 'GET'],
  ['/__cookie-http/write', 'POST'],
]);

export function cookieHttpMode(args) {
  const enabled = args.includes('--cookie-http-preflight');
  if (enabled && args.some((arg) => arg === '--probes' || arg === '--csp-observe'))
    throw new Error('Cookie HTTP preflight is a separate opt-in suite');
  return enabled;
}

export function cookieHttpReportData(kind, data) {
  if (kind === 'launch')
    return { installedChrome: true, freshProfile: true, unchangedSafetyFlags: true };
  if (kind === 'cdp-version' || kind === 'http-version') return { connected: true };
  if (kind === 'connect-failure') return { failed: true };
  if (kind === 'blocked')
    return {
      category: data.error?.startsWith('C7:')
        ? 'secure-cookie-transport-failed-C7'
        : 'cookie-http-preflight-failed',
    };
  if (kind === 'preflight-pass')
    return {
      checks: [
        'owned-loopback',
        'real-http-two-cookie-transport',
        'trusted-isolated-DOM',
        'owned-resource-cleanup',
      ],
      notRun: 'legacy harness probes, CSP suite and Playwright',
    };
  if (kind === 'cookie-http-pass')
    return {
      counts: {
        login: data.counts.login,
        read: data.counts.read,
        write: data.counts.write,
        rejected: data.counts.rejected,
      },
      checks: {
        origin: data.checks.origin,
        cookieReturn: data.checks.cookieReturn,
        csrfHeader: data.checks.csrfHeader,
        twoCookies: data.checks.twoCookies,
      },
      attributes: data.attributes,
      httpOnlyInvisible: data.httpOnlyInvisible,
      trustedDom: data.trustedDom,
      isolatedFixtureOnly: data.isolatedFixtureOnly,
    };
  const fields =
    {
      'owned-process': ['ownedPid'],
      listen: ['port'],
      'endpoint-identity': ['port', 'activePortPathMatches', 'noUserInfo'],
      'cookie-http-owned-listener': ['pid', 'port', 'owned'],
      'cookie-http-request-blocked': ['blockedRequests'],
      'cookie-http-cleanup': ['listenerGone'],
      'process-cleanup': ['rootGone', 'profileProcessCount'],
      'profile-cleanup': ['profileGone', 'previewStarted'],
      'cleanup-failure': ['requiresInspection', 'profileRetained', 'cookieHttpListenerRetained'],
    }[kind] ?? [];
  return Object.fromEntries(
    fields
      .filter(
        (field) =>
          typeof data[field] === 'boolean' ||
          typeof data[field] === 'number' ||
          data[field] === null,
      )
      .map((field) => [field, data[field]]),
  );
}

export function allowsCookieHttpRequest(rawUrl, method) {
  try {
    const url = new URL(rawUrl);
    return (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      rawUrl === `${origin}${url.pathname}` &&
      paths.get(url.pathname) === method
    );
  } catch {
    return false;
  }
}

const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Cookie transport preflight</title><script src="/cookie-preflight.js" defer></script></head><body data-state="initial"><h1>Isolated cookie transport</h1><form><input name="login" value="synthetic"><button id="login" type="submit">Login</button></form><button id="read">Read</button><button id="write">Write</button><button id="unexpected">Unexpected request</button></body></html>`;
const documentScript = `let proof;
const state = value => { document.body.dataset.state = value; };
async function exchange(path, options, next) {
  try {
    const response = await fetch(path, {credentials:'same-origin', ...options});
    if (!response.ok) throw Error('transport');
    const result = await response.json();
    if (next === 'logged-in') proof = result.csrfToken;
    state(next);
  } catch { state('failed'); }
}
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  document.body.dataset.trusted = String(event.isTrusted);
  void exchange('/__cookie-http/login', {method:'POST', headers:{'content-type':'application/json'}, body:'{}'}, 'logged-in');
});
document.querySelector('#read').addEventListener('click', () => { void exchange('/__cookie-http/session', {}, 'read'); });
document.querySelector('#write').addEventListener('click', () => { void exchange('/__cookie-http/write', {method:'POST', headers:{'x-kingturf-csrf':proof}, body:'{}'}, 'written'); });
document.querySelector('#unexpected').addEventListener('click', () => { void exchange('/__cookie-http/unmapped', {method:'POST',body:'{}'}, 'unexpected'); });
state('ready');`;

// Synthetic transport fixture only: not the application's authentication/CSRF implementation.
export function createCookieHttpFixture(
  onFailure = () => {
    /* Unit callers inspect rejection counts. */
  },
) {
  const session = randomBytes(32).toString('base64url');
  const csrf = randomBytes(32).toString('base64url');
  const counts = { login: 0, read: 0, write: 0, rejected: 0 };
  const checks = { origin: false, cookieReturn: false, csrfHeader: false, twoCookies: false };
  let owned = false;
  const server = http.createServer((req, res) => {
    const reply = (status, value, headers = {}) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...headers,
      });
      res.end(typeof value === 'string' ? value : JSON.stringify(value));
    };
    const pathname = req.url;
    if (!paths.has(pathname) || paths.get(pathname) !== req.method) {
      counts.rejected++;
      reply(404, { rejected: true });
      return;
    }
    if (pathname === '/') {
      reply(200, documentHtml, { 'content-type': 'text/html; charset=utf-8' });
      return;
    }
    if (pathname === '/cookie-preflight.js') {
      reply(200, documentScript, { 'content-type': 'text/javascript; charset=utf-8' });
      return;
    }
    if (pathname === '/favicon.ico') {
      reply(204, '');
      return;
    }
    const cookies = new Map(
      (req.headers.cookie ?? '').split(';').map((part) => {
        const at = part.indexOf('=');
        return [part.slice(0, at).trim(), part.slice(at + 1)];
      }),
    );
    const returned = cookies.get(sessionName) === session && cookies.get(csrfName) === csrf;
    if (pathname === '/__cookie-http/login') {
      if (req.headers.origin !== origin) {
        counts.rejected++;
        reply(403, { rejected: true });
        return;
      }
      counts.login++;
      checks.origin = true;
      const cookieHeaders = [
        `${sessionName}=${session}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax`,
        `${csrfName}=${csrf}; Path=/; Max-Age=300; Secure; SameSite=Lax`,
      ];
      reply(200, { csrfToken: csrf }, { 'set-cookie': cookieHeaders });
      return;
    }
    if (!returned) {
      counts.rejected++;
      reply(401, { rejected: true });
      return;
    }
    checks.cookieReturn = true;
    if (pathname === '/__cookie-http/session') {
      counts.read++;
      reply(200, { authenticated: true });
      return;
    }
    if (req.headers.origin !== origin || req.headers['x-kingturf-csrf'] !== csrf) {
      counts.rejected++;
      reply(403, { rejected: true });
      return;
    }
    checks.csrfHeader = true;
    counts.write++;
    reply(200, { written: true });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.on('clientError', (_error, socket) => socket.destroy());
  server.on('error', () => {
    counts.rejected++;
    onFailure();
  });
  return {
    snapshot: () => ({ counts: { ...counts }, checks: { ...checks } }),
    observeResponseHeaders(headersText) {
      const lines = (headersText ?? '').split('\r\n').filter((line) => /^set-cookie:/i.test(line));
      if (!lines.length) return;
      checks.twoCookies =
        lines.length === 2 &&
        [
          `${sessionName}=${session}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax`,
          `${csrfName}=${csrf}; Path=/; Max-Age=300; Secure; SameSite=Lax`,
        ].every((value) =>
          lines.some((line) => line.slice(line.indexOf(':') + 1).trim() === value),
        );
    },
    async listen(port = 4173) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          owned = true;
          server.removeListener('error', reject);
          resolve();
        });
      });
      return server.address().port;
    },
    async close() {
      if (owned) {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('owned HTTP close timed out')), 3000);
          server.close((error) => {
            clearTimeout(timer);
            if (error) reject(new Error('owned HTTP close failed'));
            else {
              owned = false;
              resolve();
            }
          });
        });
      }
      return server.address() === null;
    },
  };
}

export async function runCookieHttpProbe({ send, fixture, unexpected = false }) {
  const driver = createDriver(send);
  await send('Page.navigate', { url: origin });
  await driver.waitFor('document.body?.dataset.state === "ready"', 'isolated transport page');
  const initialJar = await send('Network.getCookies', { urls: [origin] });
  if (initialJar.cookies.length !== 0 || !(await driver.evaluate('document.cookie === ""')))
    throw new Error('Cookie preflight profile was not fresh');
  if (unexpected) {
    await driver.click('#unexpected');
    await driver.waitFor('document.body.dataset.state === "unexpected"', 'blocked unknown request');
    throw new Error('Cookie network guard failed to interrupt');
  }
  await driver.click('#login');
  await driver.waitFor(
    'document.body.dataset.state === "logged-in"',
    'natural HTTP login response',
  );
  const jar = await send('Network.getCookies', { urls: [origin] });
  const auth = jar.cookies.find((cookie) => cookie.name === sessionName);
  const csrf = jar.cookies.find((cookie) => cookie.name === csrfName);
  const attributes =
    jar.cookies.length === 2 &&
    [auth, csrf].every(
      (cookie) =>
        cookie &&
        cookie.secure &&
        cookie.sameSite === 'Lax' &&
        cookie.path === '/' &&
        cookie.domain === '127.0.0.1' &&
        cookie.expires > Date.now() / 1000,
    ) &&
    auth.httpOnly &&
    !csrf.httpOnly;
  if (!attributes) throw new Error('C7: natural loopback Secure Cookie storage failed');
  const visibility = await driver.evaluate(
    `(() => { const names=document.cookie.split(';').map(part=>part.trim().split('=')[0]); return !names.includes(${JSON.stringify(sessionName)}) && names.includes(${JSON.stringify(csrfName)}) && document.body.dataset.trusted === 'true'; })()`,
  );
  if (!visibility) throw new Error('Cookie visibility or trusted DOM submission failed');
  await driver.click('#read');
  await driver.waitFor('document.body.dataset.state === "read"', 'natural Cookie read return');
  await driver.click('#write');
  await driver.waitFor('document.body.dataset.state === "written"', 'natural Cookie write return');
  const result = fixture.snapshot();
  if (
    result.counts.login !== 1 ||
    result.counts.read !== 1 ||
    result.counts.write !== 1 ||
    result.counts.rejected !== 0 ||
    !Object.values(result.checks).every(Boolean)
  )
    throw new Error('C7: natural loopback Cookie return failed');
  return {
    ...result,
    attributes: true,
    httpOnlyInvisible: true,
    trustedDom: true,
    isolatedFixtureOnly: true,
  };
}
