import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Optional new guards. Original probes, driver budgets and GET allowlist stay unchanged.
export async function runLazyRouteProbes({ page, send, router, check }) {
  const bounded = (promise, label) =>
    Promise.race([
      promise,
      delay(3500).then(() => {
        throw new Error(label);
      }),
    ]);
  const reset = async (route) => {
    await send('Page.navigate', { url: 'about:blank' });
    await send('Page.navigate', { url: `http://127.0.0.1:4173/#${route}` });
    await page.waitFor(`!!document.querySelector('.app-shell .customer-row')`, 'new lazy shell');
    await page.onlyRoute(route);
  };
  const ready = () =>
    page.waitFor(
      `!document.querySelector('.commercial-route-notice')&&!document.querySelector('.commercial-workspace > [inert]')`,
      'lazy route settled',
    );
  const enter = async (selector) => {
    await page.click(selector);
    // Focus the real keyboard target, then deliver actual CDP keyboard input.
    await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    for (const type of ['rawKeyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', { type, key: 'Enter', windowsVirtualKeyCode: 13 });
    await page.waitFor(`!!document.querySelector('.record-detail-drawer:not([hidden])')`, 'drawer');
  };
  await page.viewport(1440, 1000, false);
  await check('lazy-customer-entry-does-not-prefetch-business', async () => {
    const before = router.counts();
    await reset('customers');
    const after = router.counts();
    const independent = new Set(['session', 'customers', 'organizations']);
    const business = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (key) =>
        !independent.has(key) &&
        !key.startsWith('governance:') &&
        !key.startsWith('documentList:') &&
        key !== 'documentDetail',
    );
    assert.ok(business.length > 0, 'bind actual business request counters');
    for (const key of business)
      assert.equal(after[key] ?? 0, before[key] ?? 0, `unexpected initial business GET: ${key}`);
    assert.equal(
      await page.evaluate(`(() => {
      const nodes=[...document.querySelectorAll('.commercial-workspace > [data-commercial-data-state="unloaded"]')];
      return nodes.length>0&&nodes.every(node=>getComputedStyle(node).display==='none')&&
        (()=>{const tasks=[...document.querySelectorAll('[data-role-task-route]')].filter(task=>
          nodes.some(node=>(node.dataset.routeView??'').split(/\\s+/u).includes(task.dataset.roleTaskRoute)));
          return tasks.length>0&&tasks.every(task=>task.querySelector('.role-task-state')?.textContent==='业务数据尚未加载'&&
            task.querySelector('.role-task-count')?.textContent==='进入后加载');})();
    })()`),
      true,
      'unread business content must not appear as empty records',
    );
  });
  await check('lazy-first-route-and-return-preserve-workspace-menu-input', async () => {
    await page.route('quotes');
    await page.text('.quote-workbench .quote-card', 'CDP-');
    await ready();
    await page.evaluate(`globalThis.__cdpLazy={workspace:document.querySelector('.commercial-workspace'),
      menus:[...document.querySelectorAll('.route-section-nav')],
      list:document.querySelector('.quote-list'),input:document.querySelector('.quote-list').previousElementSibling.querySelector('input[aria-label="在当前业务列表中搜索"]')}`);
    const before = router.counts();
    await page.route('customers');
    await page.route('quotes');
    await ready();
    assert.deepEqual(router.counts(), before, 'visited route must reuse loaded sources');
    assert.equal(
      await page.evaluate(`(() => {const old=globalThis.__cdpLazy,menus=[...document.querySelectorAll('.route-section-nav')];return old.menus.length>0&&!!old.input&&
      old.workspace===document.querySelector('.commercial-workspace')&&
      old.menus.length===menus.length&&old.menus.every((node,index)=>node===menus[index])&&
      old.list===document.querySelector('.quote-list')&&old.input===old.list.previousElementSibling.querySelector('input[aria-label="在当前业务列表中搜索"]');})()`),
      true,
      'real existing section menus, workspace, list and input must retain identity',
    );
    await page.evaluate(
      `globalThis.__cdpLazy.input.focus();globalThis.dispatchEvent(new HashChangeEvent('hashchange'))`,
    );
    await ready();
    assert.equal(
      await page.evaluate(`document.activeElement===globalThis.__cdpLazy.input`),
      true,
      'ready route application must not steal focus',
    );
  });
  await check('lazy-new-route-reuses-original-register-drawer', async () => {
    await enter('.quote-list > .quote-card');
    await page.evaluate(
      `globalThis.__cdpLazy.drawer=document.querySelector('.record-detail-drawer')`,
    );
    await page.click('.record-detail-close');
    await page.route('technical-solutions');
    await page.text('.solution-list > .solution-card', 'CDP-TS-A');
    await ready();
    await enter('.solution-list > .solution-card');
    assert.equal(
      await page.evaluate(`document.querySelectorAll('.record-detail-drawer').length===1&&
      document.querySelector('.record-detail-drawer')===globalThis.__cdpLazy.drawer`),
      true,
    );
    await page.click('.record-detail-close');
  });
  await check('lazy-overview-inserts-dashboard-in-original-assembly-order', async () => {
    await page.route('overview');
    await page.text('.executive-dashboard h2', '管理驾驶舱');
    await ready();
    assert.equal(
      await page.evaluate(`(() => {const root=document.querySelector('.commercial-workspace'),
      children=[...root.children],dashboard=root.querySelector(':scope > .executive-dashboard'),
      readiness=root.querySelector(':scope > .contract-order-readiness'),
      order=root.querySelector(':scope > .order-workbench');
      return !!dashboard&&!!readiness&&!!order&&children.indexOf(readiness)<children.indexOf(dashboard)&&
        children.indexOf(dashboard)<children.indexOf(order);})()`),
      true,
    );
    await page.noOverflow();
  });
  await check('lazy-late-first-route-does-not-overwrite-new-shared-source', async () => {
    await reset('customers');
    const old = router.hold('solutions');
    try {
      await page.route('technical-solutions');
      await bounded(old.started, 'first lazy solutions request did not reach hold');
      await page.text('.commercial-route-notice', '正在加载');
      await page.route('quotes');
      await page.text('.quote-workbench .quote-card', 'CDP-');
      await ready();
      await page.evaluate(
        `globalThis.__cdpLateLazy={workspace:document.querySelector('.commercial-workspace'),list:document.querySelector('.quote-list')}`,
      );
      await page.evaluate(
        `globalThis.__cdpLazyPaint={running:true,frames:0};requestAnimationFrame(function tick(){const p=globalThis.__cdpLazyPaint;p.frames++;if(p.running)requestAnimationFrame(tick)})`,
      );
      old.release();
      await bounded(old.fulfilled, 'old lazy Fetch fulfillment did not complete');
      await page.waitFor(
        `performance.getEntriesByType('resource').filter(entry=>
        new URL(entry.name).pathname==='/api/v1/technical-solutions'&&entry.responseEnd>0).length===2`,
        'both shared-source response bodies finished',
      );
      const frame = await page.evaluate(`globalThis.__cdpLazyPaint.frames`);
      await delay(350);
      assert.equal(
        await page.evaluate(`globalThis.__cdpLazyPaint.frames>=${frame + 2}`),
        true,
        'observe two real paint frames after response completion',
      );
      await page.evaluate(`globalThis.__cdpLazyPaint.running=false`);
      await page.waitFor(
        `!document.querySelector('.commercial-workspace > [inert]')`,
        'old busy released',
      );
      assert.equal(
        await page.evaluate(`location.hash==='#/quotes'&&
        globalThis.__cdpLateLazy.workspace===document.querySelector('.commercial-workspace')&&
        globalThis.__cdpLateLazy.list===document.querySelector('.quote-list')`),
        true,
      );
      const before = router.counts();
      await page.route('technical-solutions');
      await page.text('.solution-list > .solution-card', 'CDP-TS-A');
      await ready();
      assert.equal(
        await page.evaluate(
          `!document.querySelector('.solution-list').textContent.includes('CDP-TS-OLD-LAZY')`,
        ),
        true,
      );
      assert.deepEqual(router.counts(), before, 'return adopts the newer committed shared source');
    } finally {
      old.release();
    }
  });
  await check('lazy-first-source-failure-retries-only-failed-source', async () => {
    await reset('customers');
    router.lazyQuoteFailure(true);
    try {
      await page.route('quotes');
      await page.text('.commercial-route-notice[role="alert"]', '暂不可用');
      assert.equal(
        await page.evaluate(
          `getComputedStyle(document.querySelector('.quote-workbench')).display==='none'`,
        ),
        true,
        'failed initial read must not masquerade as an empty quote register',
      );
      const before = router.counts();
      router.lazyQuoteFailure(false);
      await page.click('.commercial-route-notice button');
      await page.text('.quote-workbench .quote-card', 'CDP-');
      await ready();
      assert.deepEqual(
        router.counts(),
        { ...before, quotes: before.quotes + 1 },
        'real retry button must fetch only the failed source',
      );
    } finally {
      router.lazyQuoteFailure(false);
    }
  });
}
