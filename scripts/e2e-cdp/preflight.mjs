import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { profileArgumentPattern } from './ownership.mjs';
import { classifyRequest } from './network-policy.mjs';

const psExe = '/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ps = (script) =>
  execFileSync(psExe, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 15000,
  }).trim();
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
let linuxTemp;
let profile;
let winProfile;
let runId = 'initializing';
const report = (kind, data) => console.log(JSON.stringify({ kind, runId, ...data }));
const getJson = (hostname, port) =>
  new Promise((resolve, reject) => {
    const req = http.get({ hostname, port, path: '/json/version', timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
let ownedPid;
let preview;
let socket;
let passed = false;
let clean = true;
let stopping = false;
let closing = false;
let suiteRouter;
let suiteResult;
let nextId = 0;
const pending = new Map();
const cdp = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    if (stopping) {
      reject(new Error('preflight interrupted'));
      return;
    }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 8000);
    pending.set(id, { resolve, reject, timer });
    try {
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    } catch {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error('CDP send failed'));
    }
  });
const stop = () => {
  stopping = true;
  process.exitCode = 1;
  for (const wait of pending.values()) {
    clearTimeout(wait.timer);
    wait.reject(new Error('preflight interrupted'));
  }
  pending.clear();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  const winTemp = ps('[System.IO.Path]::GetTempPath()');
  linuxTemp = execFileSync('wslpath', ['-u', winTemp], { encoding: 'utf8' }).trim();
  profile = mkdtempSync(join(linuxTemp, 'kingturf-cdp-preflight-'));
  runId = profile.split('/').at(-1);
  if (process.argv.includes('--fault-after-profile'))
    throw new Error('injected profile initialization failure');
  winProfile = execFileSync('wslpath', ['-w', profile], { encoding: 'utf8' }).trim();
  const flags = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${winProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    'about:blank',
  ];
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(4173, '127.0.0.1', () => probe.close(resolve));
  });
  if (stopping) throw new Error('preflight interrupted');
  report('launch', {
    chrome,
    version: ps(`(Get-Item -LiteralPath ${quote(chrome)}).VersionInfo.ProductVersion`),
    profile: winProfile,
    flags,
  });
  const argLine = flags.map((f) => `"${f}"`).join(' ');
  ownedPid = Number(
    ps(
      `$p = Start-Process -FilePath ${quote(chrome)} -ArgumentList ${quote(argLine)} -PassThru; $p.Id`,
    ),
  );
  if (!Number.isInteger(ownedPid) || ownedPid < 1) throw new Error('invalid owned pid');
  report('owned-process', { ownedPid });
  if (process.argv.includes('--fault-lost-pid')) {
    ownedPid = undefined;
    throw new Error('injected lost Start-Process result');
  }
  const activePath = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 40 && !existsSync(activePath); attempt++) await delay(250);
  if (stopping) throw new Error('preflight interrupted');
  if (!existsSync(activePath)) throw new Error('DevToolsActivePort missing after 10 seconds');
  const [portLine, browserPath] = readFileSync(activePath, 'utf8').trim().split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid CDP port');
  if (!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath))
    throw new Error('invalid owned browser path');
  const listeners = JSON.parse(
    ps(
      `@(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess) | ConvertTo-Json -Compress`,
    ),
  );
  report('listen', { port, listeners });
  const list = Array.isArray(listeners) ? listeners : [listeners];
  if (
    list.length === 0 ||
    list.some((x) => !['127.0.0.1', '::1'].includes(x.LocalAddress) || x.OwningProcess !== ownedPid)
  )
    throw new Error('CDP listener is not owned loopback');
  const hosts = ['127.0.0.1', '::1'];
  const routes = execFileSync('ip', ['-4', 'route', 'show', 'default'], { encoding: 'utf8' });
  for (const match of routes.matchAll(/default via ([0-9.]+)/g))
    if (!hosts.includes(match[1])) hosts.push(match[1]);
  let reachable;
  let versionMetadata;
  for (const host of hosts) {
    try {
      const metadata = await getJson(host, port);
      report('http-version', {
        host,
        port,
        browser: metadata.Browser,
        protocol: metadata['Protocol-Version'],
      });
      reachable = host;
      versionMetadata = metadata;
      break;
    } catch (e) {
      report('connect-failure', { host, port, error: e.code ?? e.message });
    }
  }
  if (!reachable)
    throw new Error(
      'WSL to owned Windows loopback CDP unreachable; stop before preview/navigation/harness',
    );
  const endpoint = new URL(versionMetadata.webSocketDebuggerUrl);
  if (
    endpoint.protocol !== 'ws:' ||
    Number(endpoint.port) !== port ||
    endpoint.pathname !== browserPath ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
  )
    throw new Error('CDP endpoint does not match owned DevToolsActivePort');
  report('endpoint-identity', { port, activePortPathMatches: true, noUserInfo: true });
  endpoint.hostname = reachable;
  socket = new WebSocket(endpoint);
  socket.addEventListener('close', () => {
    if (!closing) stop();
  });
  socket.addEventListener('error', () => {
    if (!closing) stop();
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket handshake timeout')), 8000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('WebSocket handshake failed'));
      },
      { once: true },
    );
  });
  let session;
  let requestBlocks = 0;
  let unknownApiRequests = 0;
  let failedApiRequests = 0;
  const responses = [];
  let expectedDialog;
  const expectDialog = (accept) =>
    new Promise((resolve, reject) => {
      if (expectedDialog) throw new Error('dialog expectation already pending');
      const timer = setTimeout(() => {
        expectedDialog = undefined;
        reject(new Error('expected dirty-form confirmation was not observed'));
      }, 3500);
      expectedDialog = { accept, resolve, reject, timer };
    });
  socket.addEventListener('message', ({ data }) => {
    try {
      const msg = JSON.parse(data);
      if (msg.id) {
        const wait = pending.get(msg.id);
        if (!wait) return;
        clearTimeout(wait.timer);
        pending.delete(msg.id);
        if (msg.error) wait.reject(new Error(`CDP error ${msg.error.code}`));
        else wait.resolve(msg.result);
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        const expected = expectedDialog;
        expectedDialog = undefined;
        if (
          !expected ||
          msg.sessionId !== session ||
          msg.params.type !== 'confirm' ||
          msg.params.message !== '当前修改尚未保存，确定关闭吗？'
        ) {
          if (expected) {
            clearTimeout(expected.timer);
            expected.reject(new Error('unexpected form dialog'));
          }
          stop();
          return;
        }
        clearTimeout(expected.timer);
        cdp('Page.handleJavaScriptDialog', { accept: expected.accept }, session).then(
          expected.resolve,
          expected.reject,
        );
      } else if (msg.method === 'Fetch.requestPaused') {
        const url = new URL(msg.params.request.url);
        const requestClass = classifyRequest(msg.params.request.url, msg.params.request.method);
        if (requestClass === 'api' && suiteRouter) {
          suiteRouter
            .respond(url.pathname, msg.params.request.method, url.searchParams)
            .then(({ completion, status, value }) =>
              cdp(
                'Fetch.fulfillRequest',
                {
                  requestId: msg.params.requestId,
                  responseCode: status,
                  responseHeaders: [{ name: 'content-type', value: 'application/json' }],
                  body: Buffer.from(JSON.stringify(value)).toString('base64'),
                },
                msg.sessionId,
              ).then(() => suiteRouter.didFulfill(completion)),
            )
            .catch((error) => {
              if (error.message === 'unmapped synthetic API request') unknownApiRequests++;
              else failedApiRequests++;
              report('api-stub-rejected', {
                rejected: true,
                unknownApiRequests,
                failedApiRequests,
              });
              cdp(
                'Fetch.failRequest',
                { requestId: msg.params.requestId, errorReason: 'BlockedByClient' },
                msg.sessionId,
              )
                .catch(stop)
                .finally(stop);
            });
          return;
        }
        const allow = requestClass === 'static';
        if (!allow) requestBlocks++;
        cdp(
          allow ? 'Fetch.continueRequest' : 'Fetch.failRequest',
          allow
            ? { requestId: msg.params.requestId }
            : { requestId: msg.params.requestId, errorReason: 'BlockedByClient' },
          msg.sessionId,
        ).catch(stop);
      } else if (msg.method === 'Network.responseReceived') {
        const url = new URL(msg.params.response.url);
        if (url.origin === 'http://127.0.0.1:4173')
          responses.push({
            path: url.pathname,
            status: msg.params.response.status,
            type: msg.params.type,
          });
      }
    } catch {
      stop();
    }
  });
  const browserVersion = await cdp('Browser.getVersion');
  report('cdp-version', {
    product: browserVersion.product,
    protocolVersion: browserVersion.protocolVersion,
  });
  const target = await cdp('Target.createTarget', { url: 'about:blank' });
  session = (await cdp('Target.attachToTarget', { targetId: target.targetId, flatten: true }))
    .sessionId;
  await cdp('Page.enable', {}, session);
  await cdp('Network.enable', {}, session);
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, session);
  preview = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--strictPort',
    ],
    { cwd: fileURLToPath(new URL('../../apps/web/', import.meta.url)), stdio: 'ignore' },
  );
  preview.on('error', stop);
  report('owned-preview', { pid: preview.pid, origin: 'http://127.0.0.1:4173' });
  let previewReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (stopping) throw new Error('preflight interrupted');
    if (preview.exitCode !== null) throw new Error(`owned preview exited ${preview.exitCode}`);
    try {
      const response = await fetch('http://127.0.0.1:4173', { signal: AbortSignal.timeout(500) });
      if (response.status === 200) {
        previewReady = true;
        break;
      }
    } catch {
      // Retry only this owned loopback preview while it starts.
    }
    await delay(250);
  }
  if (!previewReady) throw new Error('preview not ready');
  const previewListener = execFileSync('ss', ['-ltnp', 'sport = :4173'], { encoding: 'utf8' });
  if (!previewListener.includes(`pid=${preview.pid},`) || preview.exitCode !== null)
    throw new Error('4173 listener does not belong to owned preview');
  report('preview-owned-listener', { pid: preview.pid, port: 4173, owned: true });
  if (process.argv.includes('--pause-after-preview')) await delay(1000);
  if (stopping) throw new Error('preflight interrupted');
  if (process.argv.includes('--fault-after-preview'))
    throw new Error('injected failure after owned preview');
  const navigation = await cdp('Page.navigate', { url: 'http://127.0.0.1:4173' }, session);
  if (navigation.errorText) throw new Error(`preview navigation failed: ${navigation.errorText}`);
  let snapshot;
  for (let attempt = 0; attempt < 40; attempt++) {
    snapshot = (
      await cdp(
        'Runtime.evaluate',
        {
          expression: `JSON.stringify({url:location.origin+location.pathname,title:document.title,readyState:document.readyState,heading:document.querySelector('h1')?.textContent,formCount:document.forms.length,inputCount:document.querySelectorAll('input').length,loginInput:!!document.querySelector('input[name="login"]'),passwordInput:!!document.querySelector('input[name="password"]')})`,
          returnByValue: true,
        },
        session,
      )
    ).result.value;
    const state = JSON.parse(snapshot);
    if (state.readyState === 'complete' && state.inputCount > 0) break;
    await delay(250);
  }
  const state = JSON.parse(snapshot);
  if (
    state.url !== 'http://127.0.0.1:4173/' ||
    state.readyState !== 'complete' ||
    state.inputCount === 0
  )
    throw new Error('preview DOM did not render login inputs');
  if (
    !['Document', 'Script', 'Stylesheet'].every((type) =>
      responses.some((x) => x.type === type && x.status === 200),
    )
  )
    throw new Error('missing document/script/stylesheet 200 evidence');
  writeFileSync(`/tmp/${runId}-dom.json`, `${JSON.stringify(state, null, 2)}\n`);
  report('preview-dom', {
    ...state,
    responses,
    blockedRequests: requestBlocks,
    snapshot: `/tmp/${runId}-dom.json`,
  });
  if (process.argv.includes('--probes')) {
    const suite = await import('./probes.mjs');
    suiteRouter = suite.createStubRouter({
      salesViews: process.argv.includes('--sales-views'),
      pricingViews: process.argv.includes('--pricing-views'),
      creditContractViews: process.argv.includes('--credit-contract-views'),
      fulfillmentViews: process.argv.includes('--fulfillment-views'),
      financeRiskViews: process.argv.includes('--finance-risk-views'),
      operationsViews: process.argv.includes('--operations-views'),
    });
    if (process.argv.includes('--fault-unmapped-api')) {
      await cdp(
        'Runtime.evaluate',
        { expression: `fetch('/apix').catch(()=>false)`, awaitPromise: true, returnByValue: true },
        session,
      );
      throw new Error('unmapped API injection did not interrupt CDP');
    }
    suiteResult = await suite.runProbes({
      send: (method, params) => cdp(method, params, session),
      router: suiteRouter,
      runId,
      report,
      expectDialog,
    });
    if (requestBlocks !== 0) throw new Error('harness had blocked unexpected non-static traffic');
    if (unknownApiRequests !== 0) throw new Error('harness had unmapped API traffic');
    if (failedApiRequests !== 0) throw new Error('harness had failed API fulfillment');
    suiteResult.network = { blockedRequests: requestBlocks, unknownApiRequests, failedApiRequests };
  }
  closing = true;
  await cdp('Browser.close');
  passed = true;
} catch (e) {
  report('blocked', { error: e.message });
  process.exitCode = 1;
} finally {
  suiteRouter?.releaseAll();
  closing = true;
  for (const wait of pending.values()) {
    clearTimeout(wait.timer);
    wait.reject(new Error('preflight closing'));
  }
  pending.clear();
  try {
    socket?.close();
  } catch {
    clean = false;
    process.exitCode = 1;
  }
  if (preview) {
    preview.kill('SIGTERM');
    for (
      let attempt = 0;
      attempt < 20 && preview.exitCode === null && preview.signalCode === null;
      attempt++
    )
      await delay(100);
    if (preview.exitCode === null && preview.signalCode === null) {
      preview.kill('SIGKILL');
      for (let attempt = 0; attempt < 20 && preview.signalCode === null; attempt++)
        await delay(100);
    }
    const exited = preview.exitCode !== null || preview.signalCode !== null;
    report('preview-cleanup', { pid: preview.pid, exited });
    if (!exited) {
      clean = false;
      process.exitCode = 1;
    }
  }
  try {
    let chromeGone = true;
    if (winProfile) {
      const cleanup = ps(
        `$pattern=${quote(profileArgumentPattern(winProfile))}; $owned = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and [regex]::IsMatch($_.CommandLine, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) }); foreach ($p in $owned) { if ($p.ExecutablePath -ne ${quote(chrome)}) { throw 'Owned process identity mismatch; refusing stop' }; Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 750; $remaining = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and [regex]::IsMatch($_.CommandLine, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) }); @{ rootGone = ${ownedPid ? `-not [bool](Get-Process -Id ${ownedPid} -ErrorAction SilentlyContinue)` : '$null'}; profileProcessCount = $remaining.Count } | ConvertTo-Json -Compress`,
      );
      report('process-cleanup', JSON.parse(cleanup));
      const cleanupState = JSON.parse(cleanup);
      chromeGone = cleanupState.rootGone !== false && cleanupState.profileProcessCount === 0;
    }
    if (profile && chromeGone && profile.startsWith(join(linuxTemp, 'kingturf-cdp-preflight-'))) {
      rmSync(profile, { recursive: true, force: false });
      const profileGone = !existsSync(profile);
      report('profile-cleanup', { profileGone, previewStarted: !!preview });
      if (!profileGone) {
        clean = false;
        process.exitCode = 1;
      }
    } else if (profile) {
      clean = false;
      process.exitCode = 1;
      report('cleanup-failure', { profileRetained: existsSync(profile), requiresInspection: true });
    }
  } catch {
    clean = false;
    process.exitCode = 1;
    report('cleanup-failure', {
      profileRetained: profile ? existsSync(profile) : false,
      requiresInspection: true,
    });
  }
}
if (passed && clean && !process.exitCode) {
  report('preflight-pass', {
    checks: [
      'owned-loopback',
      'http-version',
      'Browser.getVersion',
      'preview-owned-listener',
      'preview-document-200',
      'preview-assets-200',
      'rendered-login-DOM',
      'owned-resource-cleanup',
    ],
    notRun: suiteResult ? 'Playwright' : 'five-class harness probes and Playwright',
  });
  if (suiteResult) report('harness-pass', suiteResult);
}
