import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const psExe = '/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ps = (script) =>
  execFileSync(psExe, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 15000,
  }).trim();
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const winTemp = ps('[System.IO.Path]::GetTempPath()');
const linuxTemp = execFileSync('wslpath', ['-u', winTemp], { encoding: 'utf8' }).trim();
const profile = mkdtempSync(join(linuxTemp, 'kingturf-cdp-preflight-'));
const winProfile = execFileSync('wslpath', ['-w', profile], { encoding: 'utf8' }).trim();
const runId = profile.split('/').at(-1);
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
let nextId = 0;
const pending = new Map();
const cdp = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 8000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
try {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(4173, '127.0.0.1', () => probe.close(resolve));
  });
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
  const activePath = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 40 && !existsSync(activePath); attempt++) await delay(250);
  if (!existsSync(activePath)) throw new Error('DevToolsActivePort missing after 10 seconds');
  const [portLine] = readFileSync(activePath, 'utf8').trim().split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid CDP port');
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
  endpoint.hostname = reachable;
  socket = new WebSocket(endpoint);
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
  const responses = [];
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const wait = pending.get(msg.id);
      if (!wait) return;
      clearTimeout(wait.timer);
      pending.delete(msg.id);
      if (msg.error) wait.reject(new Error(`CDP error ${msg.error.code}`));
      else wait.resolve(msg.result);
    } else if (msg.method === 'Fetch.requestPaused') {
      const url = new URL(msg.params.request.url);
      const allow = url.origin === 'http://127.0.0.1:4173' && !url.pathname.startsWith('/api/');
      if (!allow) requestBlocks++;
      cdp(
        allow ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        allow
          ? { requestId: msg.params.requestId }
          : { requestId: msg.params.requestId, errorReason: 'BlockedByClient' },
        msg.sessionId,
      ).catch(() => {
        process.exitCode = 1;
      });
    } else if (msg.method === 'Network.responseReceived') {
      const url = new URL(msg.params.response.url);
      if (url.origin === 'http://127.0.0.1:4173')
        responses.push({
          path: url.pathname,
          status: msg.params.response.status,
          type: msg.params.type,
        });
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
  report('owned-preview', { pid: preview.pid, origin: 'http://127.0.0.1:4173' });
  let previewReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
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
  const navigation = await cdp('Page.navigate', { url: 'http://127.0.0.1:4173' }, session);
  if (navigation.errorText) throw new Error(`preview navigation failed: ${navigation.errorText}`);
  let snapshot;
  for (let attempt = 0; attempt < 40; attempt++) {
    snapshot = (
      await cdp(
        'Runtime.evaluate',
        {
          expression: `JSON.stringify({url:location.origin+location.pathname,title:document.title,readyState:document.readyState,heading:document.querySelector('h1')?.textContent,formCount:document.forms.length,inputCount:document.querySelectorAll('input').length,bodyText:document.body.innerText.slice(0,1200)})`,
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
  await cdp('Browser.close');
  passed = true;
} catch (e) {
  report('blocked', { error: e.message });
  process.exitCode = 1;
} finally {
  socket?.close();
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
    if (ownedPid) {
      const cleanup = ps(
        `$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${ownedPid}'; if ($p) { if ($p.ExecutablePath -ne ${quote(chrome)} -or -not $p.CommandLine.Contains(${quote(winProfile)})) { throw 'Owned process identity mismatch; refusing stop' }; Stop-Process -Id ${ownedPid} -ErrorAction Stop }; Start-Sleep -Milliseconds 750; $remaining = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains(${quote(winProfile)}) }); @{ rootGone = -not [bool](Get-Process -Id ${ownedPid} -ErrorAction SilentlyContinue); profileProcessCount = $remaining.Count } | ConvertTo-Json -Compress`,
      );
      report('process-cleanup', JSON.parse(cleanup));
      const cleanupState = JSON.parse(cleanup);
      chromeGone = cleanupState.rootGone && cleanupState.profileProcessCount === 0;
    }
    if (chromeGone && profile.startsWith(join(linuxTemp, 'kingturf-cdp-preflight-'))) {
      rmSync(profile, { recursive: true, force: false });
      report('profile-cleanup', { profileGone: !existsSync(profile), previewStarted: !!preview });
    } else {
      clean = false;
      process.exitCode = 1;
      report('cleanup-failure', { profileRetained: existsSync(profile), requiresInspection: true });
    }
  } catch {
    clean = false;
    process.exitCode = 1;
    report('cleanup-failure', { profileRetained: existsSync(profile), requiresInspection: true });
  }
}
if (passed && clean && !process.exitCode)
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
    notRun: 'five-class harness probes and Playwright',
  });
