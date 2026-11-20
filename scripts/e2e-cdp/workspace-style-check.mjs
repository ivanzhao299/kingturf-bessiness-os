// W1 真实浏览器级样式守卫：登录后在治理三页断言工作台样式在真实 Chromium 里生效。
// 纯逻辑（styleGuardEnvironment / assertWorkspaceStyleEvidence / 探针表达式）导出给
// workspace-style-check.test.mjs（node --test，无浏览器，进 ci:local test 链）。
// 直跑（main guard）需显式验收变量 + 本地生产态栈（postgres + API:3000 + vite preview:4173，
// 服务 dist 产物）；无 /opt/google/chrome 的 WSL 复用 wave1 方案：Playwright Chromium +
// 用户目录解包库（LD_LIBRARY_PATH），并以 env -u 语义剥离代理变量（见
// docs/evidence/wave1-verification-2026-11-18.md §3 偏差 a/b）。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { createDriver } from './driver.mjs';

export const WORKSPACE_STYLE_ROUTES = [
  'governance/identity',
  'governance/organization',
  'governance/audit',
];

const workspaceFontPattern = /^\s*"?(Inter|Noto)/u;
const serifDefaultPattern = /^\s*"?(Times|serif)/iu;

export function styleGuardEnvironment(env) {
  if (env.KINGTURF_STYLE_GUARD_ACCEPTANCE !== '1')
    throw new Error(
      'Workspace style guard is opt-in: set KINGTURF_STYLE_GUARD_ACCEPTANCE=1 with a local production-mode stack (postgres + API :3000 + vite preview :4173)',
    );
  const parsed = new URL(env.KINGTURF_STYLE_GUARD_ORIGIN ?? 'http://127.0.0.1:4173');
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  )
    throw new Error('Workspace style guard requires a loopback HTTP web origin');
  const login = env.KINGTURF_STYLE_GUARD_LOGIN;
  const password = env.KINGTURF_STYLE_GUARD_PASSWORD;
  if (!login || !password)
    throw new Error('Synthetic local identity is required (KINGTURF_STYLE_GUARD_LOGIN/PASSWORD)');
  return Object.freeze({
    origin: parsed.origin,
    login,
    password,
    chromium: env.KINGTURF_STYLE_GUARD_CHROMIUM ?? '',
    libraries: env.KINGTURF_STYLE_GUARD_LIBS ?? '',
    artifacts: env.KINGTURF_STYLE_GUARD_ARTIFACTS ?? '/tmp/kingturf-style-guard',
  });
}

// The workspace keeps every route view mounted; hidden containers also carry .data-table
// markup. Style probes must anchor on the VISIBLE console surface, not document order.
export function consoleSurfaceReadyExpression() {
  return `(() => {const page=[...document.querySelectorAll('.console-page')].find(n=>n.getClientRects().length>0);const header=page?.querySelector('.data-table thead th');return !!page&&!!header&&header.getClientRects().length>0;})()`;
}

export function consoleStyleEvidenceExpression() {
  return `(() => {
    let consoleSheet=null;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText&&rule.selectorText.includes('.console-page')) {consoleSheet={href:sheet.href,rule:rule.selectorText};break;}
        }
      } catch { /* cross-origin sheets are opaque; same-origin bundle is the carrier */ }
      if (consoleSheet) break;
    }
    const page=[...document.querySelectorAll('.console-page')].find(n=>n.getClientRects().length>0);
    const header=page?.querySelector('.data-table thead th');
    return {
      hash:location.hash,
      consolePage:!!page,
      sheetCount:document.styleSheets.length,
      consoleSheet,
      bodyFontFamily:getComputedStyle(document.body).fontFamily,
      headerSample:header?header.textContent.trim().slice(0,40):null,
      headerFontFamily:header?getComputedStyle(header).fontFamily:null,
    };
  })()`;
}

export function assertWorkspaceStyleEvidence(route, evidence) {
  assert.equal(evidence.consolePage, true, `${route}: console surface did not render`);
  assert.ok(
    typeof evidence.consoleSheet?.rule === 'string' &&
      evidence.consoleSheet.rule.includes('.console-page'),
    `${route}: no document.styleSheets rule carries .console-page (sheets=${evidence.sheetCount})`,
  );
  assert.match(
    String(evidence.bodyFontFamily),
    workspaceFontPattern,
    `${route}: body font family must lead with Inter/Noto`,
  );
  assert.ok(
    typeof evidence.headerFontFamily === 'string' && evidence.headerFontFamily.length > 0,
    `${route}: data table header has no computed font-family`,
  );
  assert.doesNotMatch(
    evidence.headerFontFamily,
    serifDefaultPattern,
    `${route}: data table header fell back to the serif default`,
  );
  assert.match(
    evidence.headerFontFamily,
    workspaceFontPattern,
    `${route}: data table header font family must lead with Inter/Noto`,
  );
}

const resolveChromium = (override) => {
  if (override) {
    assert.ok(existsSync(override), `KINGTURF_STYLE_GUARD_CHROMIUM not found: ${override}`);
    return override;
  }
  const cache = join(homedir(), '.cache', 'ms-playwright');
  assert.ok(existsSync(cache), 'no Playwright browser cache; set KINGTURF_STYLE_GUARD_CHROMIUM');
  for (const name of readdirSync(cache)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()) {
    for (const layout of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const candidate = join(cache, name, layout);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('no Playwright chromium executable; set KINGTURF_STYLE_GUARD_CHROMIUM');
};

const resolveLibraries = (override) => {
  if (override) {
    assert.ok(existsSync(override), `KINGTURF_STYLE_GUARD_LIBS not found: ${override}`);
    return override;
  }
  const extracted = join(homedir(), 'pw-libs', 'extracted', 'usr', 'lib', 'x86_64-linux-gnu');
  return existsSync(extracted) ? extracted : '';
};

async function launchOwnedChromium(executable, libraries, report) {
  const profile = mkdtempSync(join(tmpdir(), 'kingturf-w1-style-'));
  // Session proxy variables hijack browser sockets on this host (wave1 §3 偏差 b): rebuild
  // the child environment instead of mutating or deleting from process.env.
  const stripped = new Set([
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
  ]);
  const env = {};
  for (const [name, value] of Object.entries(process.env))
    if (!stripped.has(name) && value !== undefined) env[name] = value;
  if (libraries) env.LD_LIBRARY_PATH = [libraries, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const child = spawn(
    executable,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      'about:blank',
    ],
    { env, stdio: ['ignore', 'ignore', 'ignore'] },
  );
  let socket;
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((resolveSend, rejectSend) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectSend(new Error('owned CDP deadline'));
      }, 15000);
      pending.set(id, {
        resolve: resolveSend,
        reject: rejectSend,
        timer,
      });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const close = async () => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        await send('Browser.close');
      } catch {
        /* exact process cleanup still required below */
      }
    }
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('owned CDP closing'));
    }
    pending.clear();
    socket?.close();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    for (let i = 0; i < 40 && child.exitCode === null && child.signalCode === null; i++)
      await delay(250);
    assert.ok(
      child.exitCode !== null || child.signalCode !== null,
      'owned chromium process cleanup',
    );
    rmSync(profile, { recursive: true, force: false });
    assert.equal(existsSync(profile), false, 'owned chromium profile cleanup');
  };
  try {
    const active = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 60 && !existsSync(active) && child.exitCode === null; i++) await delay(250);
    assert.ok(existsSync(active), 'owned DevToolsActivePort');
    const [portText, path] = readFileSync(active, 'utf8').trim().split(/\r?\n/);
    const port = Number(portText);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'owned ActivePort value');
    assert.match(path, /^\/devtools\/browser\//u);
    const metadata = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const endpoint = new URL(metadata.webSocketDebuggerUrl);
    assert.ok(
      endpoint.protocol === 'ws:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) &&
        String(port) === endpoint.port,
      'owned loopback CDP endpoint',
    );
    socket = new WebSocket(endpoint);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error('owned websocket deadline')), 8000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          resolveOpen();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          rejectOpen(new Error('owned websocket failure'));
        },
        { once: true },
      );
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.reject(new Error('owned CDP command failed'));
      else item.resolve(message.result);
    });
    const version = await send('Browser.getVersion');
    report('browser-ready', { product: version.product, executable, ownedLoopback: true });
    const page = async () => {
      const target = await send('Target.createTarget', { url: 'about:blank' });
      const session = (
        await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
      ).sessionId;
      const bound = (method, params) => send(method, params, session);
      await bound('Page.enable');
      await bound('Runtime.enable');
      await bound('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return { send: bound };
    };
    return { page, close };
  } catch (error) {
    await close();
    throw error;
  }
}

const waitUntil = async (driver, expression, label, attempts) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await driver.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`DOM condition timed out: ${label}`);
};

const runStyleGuard = async () => {
  const report = (kind, data) => console.log(JSON.stringify({ kind, ...data }));
  const config = styleGuardEnvironment(process.env);
  const executable = resolveChromium(config.chromium);
  const libraries = resolveLibraries(config.libraries);
  const browser = await launchOwnedChromium(executable, libraries, report);
  try {
    const page = await browser.page();
    const driver = createDriver(page.send);
    await driver.evaluate(`location.assign(${JSON.stringify(config.origin + '/')})`);
    await waitUntil(
      driver,
      `!!document.querySelector('.login-card input[placeholder="账号"]')`,
      'login form',
      200,
    );
    await driver.fill('input[placeholder="账号"]', config.login);
    await driver.fill('input[placeholder="密码"]', config.password);
    await driver.click('.login-card button.primary');
    await waitUntil(
      driver,
      `!!document.querySelector('.app-shell')`,
      'workspace shell after login',
      400,
    );
    mkdirSync(config.artifacts, { recursive: true });
    for (const route of WORKSPACE_STYLE_ROUTES) {
      await driver.evaluate(`location.hash = ${JSON.stringify('#/' + route)}`);
      await waitUntil(driver, consoleSurfaceReadyExpression(), `console surface ${route}`, 400);
      const evidence = await driver.evaluate(consoleStyleEvidenceExpression());
      assertWorkspaceStyleEvidence(route, evidence);
      const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
      const artifact = join(config.artifacts, `workspace-style-${route.replaceAll('/', '-')}.png`);
      writeFileSync(artifact, Buffer.from(screenshot.data, 'base64'));
      report('style-pass', {
        route,
        consoleSheet: evidence.consoleSheet,
        bodyFontFamily: evidence.bodyFontFamily,
        headerFontFamily: evidence.headerFontFamily,
        headerSample: evidence.headerSample,
        screenshot: artifact,
      });
    }
    report('workspace-style-pass', {
      origin: config.origin,
      routes: WORKSPACE_STYLE_ROUTES.length,
      realBrowser: true,
      servedFrom: 'vite preview dist',
    });
  } finally {
    await browser.close();
  }
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const deadline = setTimeout(() => {
    console.error(JSON.stringify({ kind: 'style-guard-deadline' }));
    process.exitCode = 1;
  }, 240000);
  void runStyleGuard()
    .catch((error) => {
      console.error(JSON.stringify({ kind: 'style-guard-failed', message: error.message }));
      process.exitCode = 1;
    })
    .finally(() => clearTimeout(deadline));
}
