import assert from 'node:assert/strict';
import { createDriver } from './driver.mjs';
import {
  cspCredentials,
  cspDocumentTitle,
  cspSendFields,
  cspTaskId,
} from './csp-send-fixtures.mjs';

export async function runCspSendProbes({ send, router, observer, report }) {
  const page = createDriver(send);
  const passed = [];
  const check = async (name, work) => {
    await work();
    passed.push(name);
    report('probe-pass', { name });
  };
  await page.viewport(1440, 1000, false);
  await check('csp-fresh-profile-real-login-DOM', async () => {
    assert.equal(
      await page.evaluate(`sessionStorage.getItem('kingturf.session')===null`),
      true,
      'No seeded session is permitted',
    );
    await page.fill('input[name="login"]', cspCredentials.login);
    await page.fill('input[name="password"]', cspCredentials.password);
    await page.click('form button[type="submit"]');
    await page.waitFor(
      `!!document.querySelector('.app-shell')`,
      'real login initializes workspace',
    );
    assert.equal(router.counts().cspLogin, 1, 'One intercepted actual login POST');
    assert.ok((router.counts().cspSession ?? 0) >= 1, 'Actual session GET after login');
    await page.evaluate(`globalThis.__kingturfCspPhase='workspace'`);
    await page.route('opportunities');
    await page.onlyRoute('opportunities');
  });
  const editor = '.business-document-dialog[open]:not(.translation-preview-dialog)';
  await check('csp-approved-document-real-send-DOM-stub-202', async () => {
    const button = '.contextual-documents[data-route-view="opportunities"] .business-document-open';
    await page.text(button, cspDocumentTitle);
    await page.click(button);
    await page.text(`${editor} h2`, cspDocumentTitle);
    await page.evaluate(
      `globalThis.__kingturfCspPhase='send'; (()=>{const button=[...document.querySelectorAll('${editor} button')].find(node=>node.textContent==='发送给客户');if(!button||button.hidden)throw Error('missing permitted send');button.dataset.cspSend='true';})()`,
    );
    await page.click(`${editor} [data-csp-send="true"]`);
    await page.waitFor(
      `!!document.querySelector('.form-dialog[open] [name="recipientAddress"]')`,
      'actual send form after connector read',
    );
    for (const [name, value] of Object.entries(cspSendFields))
      await page.fill(`.form-dialog[open] [name="${name}"]`, value);
    await page.click('.form-dialog[open] button[type="submit"]');
    await page.waitFor(
      `!!document.querySelector('${editor} .business-document-review-event')?.textContent.includes(${JSON.stringify(cspTaskId)})`,
      'synthetic task receipt in real DOM',
    );
    await page.text(`${editor} .business-document-review-event`, '待发送（尚未确认送达）');
    assert.equal(router.counts().cspConnectors, 1, 'One actual exact connector GET');
    assert.equal(
      router.counts().cspSend,
      1,
      'One exact body/key-validated send POST fulfilled 202',
    );
    assert.equal(
      observer.snapshot().sendResponses,
      1,
      'Independent Network.responseReceived must prove actual 202',
    );
    await page.noOverflow();
  });
  await check('csp-real-report-only-sentinel-separated', async () => {
    await page.evaluate(
      `globalThis.__kingturfCspPhase='sentinel'; (()=>{const node=document.createElement('script');node.textContent='globalThis.__kingturfCspSentinelExecuted=true';document.head.append(node);node.remove();})()`,
    );
    await page.waitFor(
      `globalThis.__kingturfCspSentinelExecuted===true`,
      'RO must not block sentinel execution',
    );
    // Real events are asynchronous; wait only for the observed event, not a synthetic dispatch.
    for (let attempt = 0; attempt < 60; attempt++) {
      if (observer.snapshot().counts['sentinel:script-src-elem:report'] > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    observer.assertSentinel();
    await page.evaluate(`globalThis.__kingturfCspPhase='send'`);
  });
  report('csp-observation', observer.snapshot());
  return {
    checks: passed,
    counts: { ...page.counts },
    requests: router.counts(),
    scope:
      'synthetic DOM login/workspace/send only; queued is not delivered; no production receiver or Playwright',
  };
}
