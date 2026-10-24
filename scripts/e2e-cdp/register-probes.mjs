import assert from 'node:assert/strict';

export async function runRegisterProbes({ page, send, router, check }) {
  const tools = '[data-cdp-register-tools="true"]';
  const search = `${tools} input[aria-label="在当前业务列表中搜索"]`;
  const key = async (name, code) => {
    for (const type of ['rawKeyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', {
        type,
        key: name,
        windowsVirtualKeyCode: code,
      });
  };
  const select = async (selector, value) => {
    const index = await page.evaluate(
      `(() => {const node=document.querySelector(${JSON.stringify(selector)});return node?[...node.options].findIndex(option=>option.value===${JSON.stringify(value)}):-1;})()`,
    );
    assert.ok(index >= 0, 'real select option must exist');
    await page.click(selector);
    await key('Home', 36);
    for (let step = 0; step < index; step++) await key('ArrowDown', 40);
    await key('Enter', 13);
    assert.equal(
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),
      value,
      'real keyboard selection must reach the original change handler',
    );
  };
  const bind = async () => {
    assert.equal(
      await page.evaluate(`(() => {
        const list=document.querySelector('.quote-list'),controls=list?.previousElementSibling,pager=list?.nextElementSibling;
        if(!controls?.classList.contains('workspace-list-tools')||!pager?.classList.contains('record-register-pager'))return false;
        controls.dataset.cdpRegisterTools='true';
        for(const [label,id] of [['重置','reset'],['查看批量摘要','bulk'],['查看选中详情','inspect'],['保存视图','save'],['紧凑显示','density']]){
          const button=[...controls.querySelectorAll('button')].find(node=>node.textContent===label||(id==='density'&&node.textContent==='标准显示'));if(!button)return false;button.dataset.cdpRegisterControl=id;
        }
        controls.querySelector('summary').dataset.cdpRegisterControl='advanced';
        pager.querySelector('button:first-child').dataset.cdpRegisterControl='previous';
        pager.querySelector('button:last-child').dataset.cdpRegisterControl='next';
        return true;
      })()`),
      true,
      'probe controls must bind existing list nodes',
    );
  };
  const click = (name) => page.click(`[data-cdp-register-control="${name}"]`);
  const advanced = async () => {
    if (
      !(await page.evaluate(`document.querySelector(${JSON.stringify(tools + ' details')}).open`))
    )
      await click('advanced');
  };
  const rows = () => page.evaluate(`document.querySelectorAll('.quote-list > .quote-card').length`);
  await page.viewport(1440, 1000, false);
  await page.route('quotes');
  await page.waitFor(
    `document.querySelector('.quote-list')?.dataset.listTools==='true'&&document.querySelector('.quote-list')?.previousElementSibling.classList.contains('workspace-list-tools')&&document.querySelector('.quote-list')?.nextElementSibling.classList.contains('record-register-pager')`,
    'original register controls and pager are installed',
  );
  await bind();
  const initialRequests = router.counts().quotes;
  await check('register-pagination-search-sort-preserves-nodes', async () => {
    assert.equal(await rows(), 10);
    await page.evaluate(
      `globalThis.__cdpRegister={list:document.querySelector('.quote-list'),tools:document.querySelector(${JSON.stringify(tools)}),header:document.querySelector('.quote-list > .record-register-head'),first:document.querySelector('.quote-list > .quote-card')}`,
    );
    await click('next');
    assert.equal(await rows(), 2);
    await click('previous');
    assert.equal(await rows(), 10);
    await page.fill(search, 'CDP-REG');
    await page.text(`${tools} > .workspace-list-count`, '11 / 12');
    await advanced();
    await select(`${tools} .register-sort`, 'name');
    await page.text('.quote-list > .quote-card .eyebrow', 'CDP-REG-01');
    await page.fill(search, 'CDP-REG-07');
    assert.equal(await rows(), 1);
    await page.text('.quote-list > .quote-card .eyebrow', 'CDP-REG-07');
    await click('reset');
    assert.equal(await rows(), 10);
    assert.equal(
      await page.evaluate(
        `(() => {const old=globalThis.__cdpRegister;return old.list===document.querySelector('.quote-list')&&old.tools===document.querySelector(${JSON.stringify(tools)})&&old.header===document.querySelector('.quote-list > .record-register-head')&&old.first===document.querySelector('.quote-list > .quote-card');})()`,
      ),
      true,
    );
    assert.equal(router.counts().quotes, initialRequests, 'local list operations must not fetch');
    await page.noOverflow();
  });
  await check('register-selection-drawer-reuse-and-original-reset', async () => {
    assert.equal(
      await page.evaluate(`document.querySelectorAll('.record-detail-drawer').length`),
      0,
    );
    const expected = await page.evaluate(
      `(() => {const rows=[...document.querySelectorAll('.quote-list > .quote-card')];rows[2].querySelector('.record-select').dataset.cdpRegisterSelect='third';rows[0].querySelector('.record-select').dataset.cdpRegisterSelect='first';rows[2].querySelector('.eyebrow').dataset.cdpRegisterRow='selected';return [rows[2].querySelector('strong').textContent,rows[0].querySelector('strong').textContent];})()`,
    );
    await page.click('[data-cdp-register-select="third"]');
    await page.click('[data-cdp-register-select="first"]');
    await page.click('[data-cdp-register-row="selected"]');
    await click('bulk');
    await page.text('.record-detail-drawer h2', '已选 2 条记录');
    assert.deepEqual(
      await page.evaluate(
        `[...document.querySelectorAll('.record-detail-drawer .bulk-summary-list li strong')].map(node=>node.textContent)`,
      ),
      expected,
      'bulk output retains Set insertion order rather than DOM order',
    );
    await page.evaluate(
      `globalThis.__cdpRegister.drawer=document.querySelector('.record-detail-drawer')`,
    );
    await page.click('.record-detail-drawer .record-detail-close');
    await click('reset');
    await page.text(`${tools} .register-selection-count`, '已选 0 条');
    assert.equal(
      await page.evaluate(`document.querySelectorAll('.quote-list .record-select:checked').length`),
      0,
    );
    await click('inspect');
    await page.text('.record-detail-drawer h2', expected[0]);
    assert.equal(
      await page.evaluate(
        `document.querySelectorAll('.record-detail-drawer').length===1&&globalThis.__cdpRegister.drawer===document.querySelector('.record-detail-drawer')`,
      ),
      true,
    );
    await page.click('.record-detail-drawer .record-detail-close');
    assert.equal(router.counts().quotes, initialRequests);
  });
  await check('register-local-view-save-reload-restores-controls', async () => {
    await page.fill(search, 'CDP-REG');
    await select(`${tools} .register-status-filter`, '草稿');
    await select(`${tools} .register-sort`, 'name');
    await select(`${tools} .register-field-mode`, 'key');
    await click('density');
    await click('save');
    const stored = await page.evaluate(
      `JSON.parse(localStorage.getItem('kingturf.register-view.quote-list'))`,
    );
    assert.deepEqual(Object.keys(stored), [
      'query',
      'status',
      'attention',
      'dateFrom',
      'dateTo',
      'amountFrom',
      'amountTo',
      'sortMode',
      'compact',
      'fields',
    ]);
    assert.deepEqual(stored, {
      query: 'CDP-REG',
      status: '草稿',
      attention: '',
      dateFrom: '',
      dateTo: '',
      amountFrom: '',
      amountTo: '',
      sortMode: 'name',
      compact: true,
      fields: 'key',
    });
    const before = router.counts();
    await send('Page.reload', { ignoreCache: false });
    await page.waitFor(
      `document.querySelector('.quote-list')?.dataset.listTools==='true'&&document.querySelector('.quote-list')?.previousElementSibling.querySelector('.filter-search')?.value==='CDP-REG'`,
      'real document reload restores local register view',
    );
    await page.onlyRoute('quotes');
    assert.equal(await rows(), 6);
    assert.equal(
      await page.evaluate(
        `(() => {const list=document.querySelector('.quote-list'),controls=list.previousElementSibling;return list.classList.contains('is-compact')&&list.classList.contains('is-key-fields')&&controls.querySelector('.register-status-filter').value==='草稿'&&controls.querySelector('.register-sort').value==='name'&&controls.querySelector('.register-field-mode').value==='key'&&controls.querySelector('.register-selection-count').textContent==='已选 0 条'&&document.querySelectorAll('.record-detail-drawer').length===0;})()`,
      ),
      true,
    );
    assert.equal(router.counts().quotes, before.quotes + 1);
    assert.equal(router.counts().session, before.session + 1);
    await page.evaluate(`localStorage.removeItem('kingturf.register-view.quote-list')`);
    await bind();
    await advanced();
    await click('reset');
    await page.noOverflow();
  });
  if (process.argv.includes('--sales-views'))
    await check('register-state-isolated-between-two-real-lists', async () => {
      await page.click('.quote-list > .quote-card .record-select');
      await page.text(`${tools} .register-selection-count`, '已选 1 条');
      await page.evaluate(
        `globalThis.__cdpRegisterQuoteList=document.querySelector('.quote-list')`,
      );
      await page.route('technical-solutions');
      assert.equal(
        await page.evaluate(
          `document.querySelector('.solution-list').previousElementSibling.querySelector('.register-selection-count').textContent`,
        ),
        '已选 0 条',
      );
      await page.click('.solution-list > article .record-select');
      assert.equal(
        await page.evaluate(
          `document.querySelector('.solution-list').previousElementSibling.querySelector('.register-selection-count').textContent`,
        ),
        '已选 1 条',
      );
      await page.route('quotes');
      await page.text(`${tools} .register-selection-count`, '已选 1 条');
      assert.equal(
        await page.evaluate(
          `globalThis.__cdpRegisterQuoteList===document.querySelector('.quote-list')`,
        ),
        true,
      );
      await click('reset');
      await page.route('technical-solutions');
      assert.equal(
        await page.evaluate(
          `document.querySelector('.solution-list').previousElementSibling.querySelector('.register-selection-count').textContent`,
        ),
        '已选 1 条',
      );
      await page.noOverflow();
    });
}
