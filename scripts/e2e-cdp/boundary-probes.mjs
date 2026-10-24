import assert from 'node:assert/strict';

export async function runBoundaryParserProbes({ page, send, router, check }) {
  const navigate = async (route) => {
    await send('Page.navigate', { url: 'about:blank' });
    await send('Page.navigate', { url: `http://127.0.0.1:4173/#${route}` });
  };
  const ready = () =>
    page.waitFor(
      `document.querySelector('.quote-list')?.dataset.listTools==='true'&&!document.querySelector('.commercial-route-notice')`,
      'parsed quote register is ready',
    );
  const addScript = async (source) => {
    const result = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `if(location.origin==='http://127.0.0.1:4173'){${source}}`,
    });
    return () =>
      send('Page.removeScriptToEvaluateOnNewDocument', { identifier: result.identifier });
  };
  await page.viewport(1440, 1000, false);
  await check('boundary-malformed-stored-token-never-requests-session', async () => {
    const before = router.counts().session;
    const remove = await addScript(`sessionStorage.setItem('kingturf.session','bad token')`);
    try {
      await navigate('customers');
      await page.waitFor(
        `!!document.querySelector('.login-shell')`,
        'invalid token returns to login',
      );
      assert.equal(router.counts().session, before);
      assert.equal(
        await page.evaluate(`sessionStorage.getItem('kingturf.session')`),
        'bad token',
        'parser must not silently rewrite or remove stored tokens',
      );
    } finally {
      await remove();
    }
  });
  await check('boundary-malformed-view-and-storage-errors-preserve-default-controls', async () => {
    const key = 'kingturf.register-view.quote-list';
    const malformed = JSON.stringify({ query: 'CDP-REG-07', compact: 'true' });
    const remove = await addScript(
      `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(malformed)})`,
    );
    try {
      await navigate('quotes');
      await ready();
      assert.equal(
        await page.evaluate(`(() => {const list=document.querySelector('.quote-list'),
        input=list.previousElementSibling.querySelector('input[aria-label="在当前业务列表中搜索"]');
        return input.value===''&&!list.classList.contains('is-compact')&&list.querySelectorAll('.quote-card').length===10;})()`),
        true,
        'wrong known field type rejects the entire view, not just that field',
      );
      assert.equal(
        await page.evaluate(`localStorage.getItem(${JSON.stringify(key)})`),
        malformed,
        'rejecting a stored view must not delete or write it back',
      );
    } finally {
      await remove();
      await page.evaluate(`localStorage.removeItem(${JSON.stringify(key)})`);
    }
    const restore = await addScript(`const original=Storage.prototype.getItem;
      Storage.prototype.getItem=function(key){if(this===localStorage&&(key==='kingturf.sidebar.collapsed'||key==='kingturf.register-view.quote-list'))throw Error('synthetic storage unavailable');return Reflect.apply(original,this,[key]);}`);
    try {
      await navigate('quotes');
      await ready();
      assert.equal(
        await page.evaluate(`!document.querySelector('.app-shell').classList.contains('sidebar-collapsed')&&
        document.querySelector('.quote-list').previousElementSibling.querySelector('input[aria-label="在当前业务列表中搜索"]').value===''`),
        true,
      );
    } finally {
      await restore();
    }
  });
  await check('boundary-malformed-success-body-is-local-and-real-retry-recovers', async () => {
    await navigate('customers');
    await page.waitFor(`!!document.querySelector('.customer-row')`, 'fresh synthetic CRM shell');
    router.boundaryQuoteFailure(true);
    try {
      await page.route('quotes');
      await page.text('.commercial-route-notice[role="alert"]', '暂不可用');
      assert.equal(
        await page.evaluate(
          `getComputedStyle(document.querySelector('.quote-workbench')).display==='none'`,
        ),
        true,
      );
      const before = router.counts();
      router.boundaryQuoteFailure(false);
      await page.click('.commercial-route-notice button');
      await page.text('.quote-workbench .quote-card', 'CDP-');
      await ready();
      assert.deepEqual(router.counts(), { ...before, quotes: before.quotes + 1 });
      await page.noOverflow();
    } finally {
      router.boundaryQuoteFailure(false);
    }
  });
}
