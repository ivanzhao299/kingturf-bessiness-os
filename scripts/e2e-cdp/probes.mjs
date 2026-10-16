import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createDriver } from './driver.mjs';
export { createStubRouter } from './fixtures.mjs';
import { syntheticSessionInit } from './fixtures.mjs';

export async function runProbes({ send, router, runId, report, expectDialog }) {
  const page = createDriver(send);
  const passed = [];
  const check = async (name, work) => {
    await work();
    passed.push(name);
    report('probe-pass', { name });
  };
  const reset = async () => {
    router.detailFailure(false);
    await send('Page.navigate', { url: 'about:blank' });
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#customers' });
    await page.waitFor(
      `!!document.querySelector('.app-shell .customer-row')`,
      'synthetic workspace',
    );
    await page.onlyRoute('customers');
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: syntheticSessionInit });
  try {
    await page.viewport(1440, 1000, false);
    await reset();
    if (process.argv.includes('--fault-hidden-target')) {
      await page.evaluate(
        `for(const node of document.querySelectorAll('[data-route-view]'))node.style.display='none'`,
      );
      await page.onlyRoute('customers');
      throw new Error('hidden route injection was not detected');
    }
    await check('synthetic-workspace-text', async () => {
      await page.text('.crm-records .customer-row .identity', 'CDP客户甲');
      await page.noOverflow();
    });
    await check('form-open-fill-cancel-confirmation', async () => {
      await page.route('overview');
      await page.evaluate(
        `(() => {const button=[...document.querySelectorAll('button')].find(n=>n.textContent==='＋ 新建客户');if(!button)throw Error('missing customer-create button');button.dataset.cdpCreate='true';})()`,
      );
      await page.click('[data-cdp-create="true"]');
      await page.text('.form-dialog[open] h2', '新建客户');
      await page.fill('.form-dialog[open] [name="name"]', 'CDP未保存客户');
      await page.fill('.form-dialog[open] [name="customerNumber"]', 'CDP-UNSAVED');
      const valuesRemain = `(() => {const form=document.querySelector('.form-dialog[open] form');return !!form&&form.elements.namedItem('name').value==='CDP未保存客户'&&form.elements.namedItem('customerNumber').value==='CDP-UNSAVED'&&form.elements.namedItem('name').required&&form.elements.namedItem('name').minLength===2&&form.elements.namedItem('customerNumber').required;})()`;
      assert.equal(await page.evaluate(valuesRemain), true, 'real filled form must remain bound');
      await Promise.all([
        expectDialog(false),
        page.click('.form-dialog[open] .dialog-actions .secondary'),
      ]);
      assert.equal(await page.evaluate(valuesRemain), true, 'declined cancel must preserve values');
      await Promise.all([
        expectDialog(true),
        page.click('.form-dialog[open] .dialog-actions .secondary'),
      ]);
      await page.waitFor(`!document.querySelector('.form-dialog')`, 'accepted cancel removes form');
      await page.onlyRoute('overview');
      await page.route('customers');
      await page.onlyRoute('customers');
      await page.noOverflow();
    });
    await check('CRM-filter-preserves-commercial-and-menu', async () => {
      await page.evaluate(
        `globalThis.__cdpIdentity={workspace:document.querySelector('.commercial-workspace'),menu:[...document.querySelectorAll('[data-app-route]')],costInput:document.querySelector('.cost-matrix-search')}`,
      );
      assert.equal(
        await page.evaluate(
          `!!globalThis.__cdpIdentity.workspace&&!!globalThis.__cdpIdentity.costInput&&globalThis.__cdpIdentity.menu.length>0`,
        ),
        true,
        'identity probe must bind real nodes',
      );
      await page.fill('[placeholder="搜索客户名称或编号"]', 'CDP客户甲');
      await page.waitFor(`document.querySelectorAll('.customer-row').length===1`, 'CRM filter');
      assert.equal(
        await page.evaluate(
          `(() => {const input=document.querySelector('[placeholder="搜索客户名称或编号"]');return document.activeElement===input&&input.selectionStart===6&&input.selectionEnd===6;})()`,
        ),
        true,
        'CRM input focus/selection was not restored',
      );
      assert.equal(
        await page.evaluate(
          `(() => {const old=globalThis.__cdpIdentity;const menu=[...document.querySelectorAll('[data-app-route]')];return old.workspace===document.querySelector('.commercial-workspace')&&old.costInput===document.querySelector('.cost-matrix-search')&&menu.length===old.menu.length&&menu.every((n,i)=>n===old.menu[i])&&document.querySelector('[placeholder="搜索客户名称或编号"]').value==='CDP客户甲';})()`,
        ),
        true,
        'unrelated DOM identity or CRM input value changed',
      );
      await page.route('costing');
      await page.route('customers');
      assert.equal(
        await page.evaluate(
          `document.querySelector('[placeholder="搜索客户名称或编号"]').value==='CDP客户甲'`,
        ),
        true,
      );
    });
    await check('desktop-mobile-route-text-overflow', async () => {
      for (const metrics of [
        [390, 844, true],
        [1440, 1000, false],
      ]) {
        await page.viewport(...metrics);
        await page.waitFor(
          `document.querySelector('.app-shell')?.classList.contains(${JSON.stringify(metrics[2] ? 'mobile' : 'desktop')})===true`,
          'live viewport shell class',
        );
        await page.noOverflow();
        await reset();
        for (const route of ['customers', 'costing', 'quotes']) {
          await page.route(route);
          await page.text(
            '[data-route-context] h1',
            { customers: '客户', costing: '成本', quotes: '报价' }[route],
          );
          await page.noOverflow();
        }
      }
    });
    await check('late-cost-never-paints-on-quotes', async () => {
      await page.route('costing');
      const hold = router.hold('cost', 'CDP慢请求');
      await page.fill('.cost-matrix-search', 'CDP慢请求');
      await Promise.race([
        hold.started,
        delay(3500).then(() => {
          throw new Error('cost hold not reached');
        }),
      ]);
      await page.route('quotes');
      await page.evaluate(
        `globalThis.__cdpPaint={running:true,frames:0,leaks:0};requestAnimationFrame(function tick(){const p=globalThis.__cdpPaint;p.frames++;for(const n of document.querySelectorAll('[data-route-view]'))if(!(n.dataset.routeView??'').split(/\\s+/).includes('quotes')&&n.getClientRects().length)p.leaks++;if(p.running)requestAnimationFrame(tick);})`,
      );
      hold.release();
      await Promise.race([
        hold.fulfilled,
        delay(3500).then(() => {
          throw new Error('cost Fetch fulfillment did not complete');
        }),
      ]);
      const framesAtFulfillment = await page.evaluate(`globalThis.__cdpPaint.frames`);
      await delay(350);
      assert.equal(
        await page.evaluate(`globalThis.__cdpPaint.frames>=${framesAtFulfillment + 2}`),
        true,
        'paint probe must observe real animation frames',
      );
      assert.equal(
        await page.evaluate(`globalThis.__cdpPaint.running=false;globalThis.__cdpPaint.leaks`),
        0,
        'non-target view painted',
      );
      assert.equal(
        await page.evaluate(`document.querySelector('.cost-matrix-search')?.value==='CDP慢请求'`),
        true,
        'late cost response must preserve search value',
      );
      await page.onlyRoute('quotes');
    });
    await check('late-customer-detail-keeps-cost-and-menu', async () => {
      await reset();
      const hold = router.hold('detail');
      await page.click('.customer-row');
      await Promise.race([
        hold.started,
        delay(3500).then(() => {
          throw new Error('detail hold not reached');
        }),
      ]);
      await page.route('costing');
      const menu = await page.evaluate(`document.querySelectorAll('[data-app-route]').length`);
      hold.release();
      await Promise.race([
        hold.fulfilled,
        delay(3500).then(() => {
          throw new Error('detail Fetch fulfillment did not complete');
        }),
      ]);
      await page.text('.crm-records .detail h2', 'CDP客户甲', { visible: false });
      await page.onlyRoute('costing');
      assert.equal(
        await page.evaluate(`document.querySelectorAll('[data-app-route]').length`),
        menu,
      );
      assert.equal(
        await page.evaluate(
          `!!document.querySelector('.cost-matrix-search')?.getClientRects().length`,
        ),
        true,
      );
    });
    await check('customer503-is-local-and-menu-remains', async () => {
      await reset();
      router.detailFailure(true);
      await page.click('.customer-row');
      await page.text('.crm-records [role="alert"]', 'CDP合成服务暂不可用');
      await page.onlyRoute('customers');
      await page.route('costing');
      await page.onlyRoute('costing');
    });
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`/tmp/${runId}-probes.png`, Buffer.from(screenshot.data, 'base64'));
    return {
      cases: passed.length,
      categories: page.counts,
      requests: router.counts(),
      screenshot: `/tmp/${runId}-probes.png`,
      notCovered: [
        'SQL',
        'real API',
        'real-account security matrix',
        'Playwright specs',
        'all 21 business views',
      ],
    };
  } finally {
    router.releaseAll();
  }
}
