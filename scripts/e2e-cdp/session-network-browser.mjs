// Independent opt-in owner. Shares the exact profile-argument matcher with legacy CDP.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { profileArgumentPattern } from './ownership.mjs';

const psExe = '/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const ps = (script) =>
  execFileSync(psExe, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 15000,
  }).trim();

export async function createSessionBrowser(allows, report, fault = '') {
  let profile;
  let winProfile;
  let linuxTemp;
  let pid;
  let socket;
  let closing = false;
  let sequence = 0;
  let blocked = 0;
  let failed = false;
  let failureKind = null;
  const pending = new Map();
  const observers = new Set();
  const fail = (kind = 'cdp-event') => {
    failed = true;
    failureKind = typeof kind === 'string' ? kind : 'cdp-command';
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('owned CDP stopped'));
    }
    pending.clear();
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      if ((failed && method !== 'Browser.close') || socket?.readyState !== WebSocket.OPEN) {
        reject(new Error('owned CDP unavailable'));
        return;
      }
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('owned CDP deadline'));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch {
        fail();
      }
    });
  const close = async () => {
    closing = true;
    report('browser-network-summary', {
      blocked,
      asynchronousFailure: failed,
      failureKind,
    });
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        await send('Browser.close');
      } catch {
        /* exact process cleanup still required */
      }
    }
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('owned CDP closing'));
    }
    pending.clear();
    socket?.close();
    if (winProfile) {
      const state = JSON.parse(
        ps(
          `$pattern=${quote(profileArgumentPattern(winProfile))}; $owned=@(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and [regex]::IsMatch($_.CommandLine,$pattern,[System.Text.RegularExpressions.RegexOptions]::IgnoreCase) }); foreach($p in $owned) { if($p.ExecutablePath -ne ${quote(chrome)}) { throw 'Owned process mismatch' }; Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 750; $remaining=@(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and [regex]::IsMatch($_.CommandLine,$pattern,[System.Text.RegularExpressions.RegexOptions]::IgnoreCase) }); @{ rootGone=${pid ? `-not [bool](Get-Process -Id ${pid} -ErrorAction SilentlyContinue)` : '$null'}; profileProcessCount=$remaining.Count } | ConvertTo-Json -Compress`,
        ),
      );
      assert.notEqual(state.rootGone, false, 'owned Chrome root cleanup');
      assert.equal(state.profileProcessCount, 0, 'owned Chrome profile process cleanup');
      report('browser-process-cleanup', { rootGone: state.rootGone, profileProcessCount: 0 });
    }
    if (profile) {
      assert.ok(profile.startsWith(join(linuxTemp, 'kingturf-s4-network-')));
      rmSync(profile, { recursive: true, force: false });
      assert.equal(existsSync(profile), false);
      report('browser-profile-cleanup', { profileGone: true });
    }
  };
  try {
    const temp = ps('[System.IO.Path]::GetTempPath()');
    linuxTemp = execFileSync('wslpath', ['-u', temp], { encoding: 'utf8' }).trim();
    profile = mkdtempSync(join(linuxTemp, 'kingturf-s4-network-'));
    winProfile = execFileSync('wslpath', ['-w', profile], { encoding: 'utf8' }).trim();
    if (fault === 'profile') throw new Error('injected profile failure');
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
    pid = Number(
      ps(
        `$p=Start-Process -FilePath ${quote(chrome)} -ArgumentList ${quote(flags.map((flag) => `"${flag}"`).join(' '))} -PassThru; $p.Id`,
      ),
    );
    assert.ok(Number.isInteger(pid) && pid > 0);
    const active = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 40 && !existsSync(active); i++) await delay(250);
    assert.ok(existsSync(active), 'owned ActivePort');
    const [portText, path] = readFileSync(active, 'utf8').trim().split(/\r?\n/);
    const port = Number(portText);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    assert.match(path, /^\/devtools\/browser\/[a-z0-9-]+$/i);
    const connections = JSON.parse(
      ps(
        `@(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object LocalAddress,OwningProcess) | ConvertTo-Json -Compress`,
      ),
    );
    const listeners = Array.isArray(connections) ? connections : [connections];
    assert.ok(
      listeners.length > 0 &&
        listeners.every(
          (item) => item.OwningProcess === pid && ['127.0.0.1', '::1'].includes(item.LocalAddress),
        ),
      'owned loopback CDP',
    );
    const hosts = ['127.0.0.1', '::1'];
    const routes = execFileSync('ip', ['-4', 'route', 'show', 'default'], { encoding: 'utf8' });
    for (const match of routes.matchAll(/default via ([0-9.]+)/g))
      if (!hosts.includes(match[1])) hosts.push(match[1]);
    let endpoint;
    for (const host of hosts) {
      try {
        const metadata = await (
          await fetch(`http://${host.includes(':') ? `[${host}]` : host}:${port}/json/version`, {
            signal: AbortSignal.timeout(2000),
          })
        ).json();
        const candidate = new URL(metadata.webSocketDebuggerUrl);
        assert.ok(
          candidate.protocol === 'ws:' &&
            Number(candidate.port) === port &&
            candidate.pathname === path &&
            !candidate.username &&
            !candidate.password &&
            !candidate.search &&
            !candidate.hash &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(candidate.hostname),
        );
        candidate.hostname = host.includes(':') ? `[${host}]` : host;
        endpoint = candidate;
        break;
      } catch {
        /* try only known loopback transport routes */
      }
    }
    assert.ok(endpoint, 'WSL owned CDP reachable');
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('owned websocket deadline')), 8000);
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
          reject(new Error('owned websocket failure'));
        },
        { once: true },
      );
    });
    socket.addEventListener('close', () => {
      if (!closing) fail();
    });
    socket.addEventListener('error', () => {
      if (!closing) fail();
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.id) {
          const item = pending.get(message.id);
          if (!item) return;
          clearTimeout(item.timer);
          pending.delete(message.id);
          if (message.error) item.reject(new Error('owned CDP command failed'));
          else item.resolve(message.result);
          return;
        }
        if (message.method === 'Fetch.requestPaused') {
          const request = message.params.request;
          const allow = allows(request.url, request.method);
          if (!allow) blocked++;
          void send(
            allow ? 'Fetch.continueRequest' : 'Fetch.failRequest',
            allow
              ? { requestId: message.params.requestId }
              : { requestId: message.params.requestId, errorReason: 'BlockedByClient' },
            message.sessionId,
          )
            .then(() => {
              if (!allow) fail('blocked-request');
            })
            .catch(() => fail('resume-command'));
        }
        for (const observer of observers) observer(message);
      } catch {
        fail();
      }
    });
    const version = await send('Browser.getVersion');
    report('browser-ready', {
      product: version.product,
      protocol: version.protocolVersion,
      ownedLoopback: true,
      freshProfile: true,
      unchangedSafetyFlags: true,
    });
    const page = async () => {
      const target = await send('Target.createTarget', { url: 'about:blank' });
      const session = (
        await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
      ).sessionId;
      const bound = (method, params) => send(method, params, session);
      await bound('Page.enable');
      await bound('Network.enable');
      await bound('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      return { send: bound, session, target: target.targetId };
    };
    return {
      page,
      close,
      observe(fn) {
        observers.add(fn);
        return () => observers.delete(fn);
      },
      assertClean() {
        assert.equal(blocked, 0, 'Chrome unexpected requests');
        assert.equal(failed, false, 'Chrome asynchronous failure');
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
