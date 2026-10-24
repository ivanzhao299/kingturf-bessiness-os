// Manual serialized suite: NODE_ENV=test node --experimental-transform-types ...
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createRealSessionFixture } from './session-network-fixture.mjs';
import { assertBuiltWeb, createSessionGateway } from './session-network-gateway.mjs';
import { createSessionBrowser } from './session-network-browser.mjs';
import { runNaturalDomFlow, runNetworkBrowserMatrix } from './session-network-probes.mjs';
import { runNodeOriginMatrix } from './session-network-node.mjs';
import { runSessionDomLifecycle } from './session-network-dom.mjs';

const report = (kind, data) => console.log(JSON.stringify({ kind, ...data }));
const protocolOnly = process.argv.includes('--protocol-only');
let fixture;
let gateway;
let browser;
let cases = 0;
let pass = false;
let aborted = false;
const interrupt = () => {
  aborted = true;
  process.exitCode = 1;
};
const assertRunning = () => assert.equal(aborted, false, 'suite interrupted');
process.once('SIGTERM', interrupt);
process.once('SIGINT', interrupt);
const deadline = setTimeout(
  interrupt,
  process.argv.includes('--deadline-during-setup') ? 10 : 240000,
);
const check = async (name, work) => {
  assertRunning();
  report('case-start', { name });
  await work();
  assertRunning();
  cases++;
  report('case-pass', { name, cases });
};
try {
  assert.ok(process.env.DATABASE_URL, 'guarded DATABASE_URL required');
  assertBuiltWeb();
  // Drain the bounded current operation before teardown; never race live work with finally.
  fixture = await createRealSessionFixture(process.env.DATABASE_URL, report);
  if (process.argv.includes('--pause-after-fixture')) await delay(500);
  assertRunning();
  gateway = createSessionGateway(fixture.servers, report, fixture.documentId);
  await gateway.listen();
  assertRunning();
  if (process.argv.includes('--fault-listener')) throw new Error('injected listener fault');
  if (process.argv.includes('--fault-server-error')) {
    gateway.faultServerError();
    gateway.assertClean();
  }
  await runNodeOriginMatrix(fixture, check);
  browser = await createSessionBrowser(
    gateway.allows,
    report,
    process.argv.includes('--fault-profile') ? 'profile' : '',
  );
  if (process.argv.includes('--pause-after-browser')) await delay(500);
  assertRunning();
  if (process.argv.includes('--fault-unexpected-write')) {
    const target = await browser.page();
    await target.send('Page.navigate', { url: 'http://127.0.0.1:4173' });
    await target.send('Runtime.evaluate', {
      expression: `fetch('/api/v1/forbidden',{method:'POST'}).catch(()=>null)`,
      awaitPromise: true,
    });
    browser.assertClean();
  }
  if (!protocolOnly) await runNaturalDomFlow(browser, gateway, fixture, check);
  if (!protocolOnly) await runSessionDomLifecycle(browser, gateway, fixture, check);
  await runNetworkBrowserMatrix(browser, gateway, fixture, check);
  gateway.assertClean();
  browser.assertClean();
  assertRunning();
  assert.equal(cases, protocolOnly ? 18 : 26, 'complete classified scenario inventory');
  pass = true;
} catch (error) {
  const safeLabel = /^(DOM condition timed out: |real response header barrier not reached$)/u.test(
    error.message,
  )
    ? error.message
    : 'details-suppressed';
  const primitive = (value) =>
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 599)
      ? value
      : null;
  report('network-failed', {
    cases,
    safeLabel,
    assertion: error.code === 'ERR_ASSERTION',
    actual: primitive(error.actual),
    expected: primitive(error.expected),
    cdpDeadline: error.message === 'owned CDP deadline',
    cdpEvaluation: error.message === 'CDP DOM evaluation failed',
    detailsSuppressed: true,
  });
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  // Close gateway first: unblock response barriers before browser/API teardown.
  for (const close of [() => gateway?.close(), () => browser?.close(), () => fixture?.close()]) {
    const diagnostic = setTimeout(() => {
      report('cleanup-deadline', { requiresInspection: true });
      process.exitCode = 1;
    }, 35000);
    try {
      if (process.argv.includes('--pause-during-cleanup')) {
        report('cleanup-started', { signalWindow: true });
        await delay(500);
      }
      await close();
    } catch {
      report('cleanup-failed', { requiresInspection: true });
      process.exitCode = 1;
    } finally {
      clearTimeout(diagnostic);
    }
  }
}
if (pass && !aborted && !process.exitCode)
  report('network-pass', {
    cases,
    mode: protocolOnly
      ? 'Node-Origin-and-Chrome-Jar-controlled-Runtime-fetch'
      : 'DOM-plus-protocol',
    naturalCookieJar: true,
    domSubmatrixRan: !protocolOnly,
    nodeOriginCases: 4,
    spaDomCases: protocolOnly ? 0 : 8,
    controlledJarProtocolCases: 14,
    realApi: true,
    realPg: true,
    notPlaywright: true,
  });
