import assert from 'node:assert/strict';

export async function runDocumentEditorProbes({ page, send, router, check }) {
  assert.ok(
    process.argv.includes('--sales-views'),
    'document editor probes need a real opportunity read route',
  );
  const editor = '.business-document-dialog[open]:not(.translation-preview-dialog)';
  const body = `${editor} .business-document-body`;
  const button = '.contextual-documents[data-route-view="opportunities"] .business-document-open';
  const close = async () => {
    await page.click(`${editor} [aria-label="关闭在线文档"]`);
    await page.waitFor(
      `!document.querySelector('.business-document-dialog:not(.translation-preview-dialog)')`,
      'original editor close removes modal',
    );
  };
  const open = async () => {
    await page.route('opportunities');
    await page.text(button, 'CDP只读在线文档');
    await page.click(button);
    await page.text(`${editor} h2`, 'CDP只读在线文档');
    await page.waitFor(
      `!!document.querySelector(${JSON.stringify(body)})&&document.querySelector(${JSON.stringify(editor + ' .business-document-page-indicator')})?.textContent.startsWith('第 1 / ')`,
      'real modal and initial pagination',
    );
  };
  const select = async (selector, value) => {
    const index = await page.evaluate(
      `(() => {const node=document.querySelector(${JSON.stringify(selector)});return node?[...node.options].findIndex(option=>option.value===${JSON.stringify(value)}):-1;})()`,
    );
    assert.ok(index >= 0, 'existing document option');
    await page.click(selector);
    for (const [key, code] of [
      ['Home', 36],
      ...Array.from({ length: index }, () => ['ArrowDown', 40]),
      ['Enter', 13],
    ])
      for (const type of ['rawKeyDown', 'keyUp'])
        await send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: code });
    assert.equal(
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),
      value,
    );
  };
  const mark = async (text, tag) => {
    assert.equal(
      await page.evaluate(
        `(() => {const root=document.querySelector(${JSON.stringify(editor)}),node=[...root.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)});if(!node)return false;node.dataset.cdpDocumentAction=${JSON.stringify(tag)};return true;})()`,
      ),
      true,
    );
    return `${editor} [data-cdp-document-action="${tag}"]`;
  };
  await page.waitFor(
    `!!document.querySelector(${JSON.stringify(button)})&&[...document.querySelectorAll('.business-document-register')].every(node=>!node.textContent.includes('正在加载'))`,
    'all allowed saved-document reads complete',
  );
  const listCounts = Object.fromEntries(
    Object.entries(router.counts()).filter(([name]) => name.startsWith('documentList:')),
  );
  const detailBefore = router.counts().documentDetail ?? 0;
  await check('document-editor-readonly-open-sanitized-desktop-mobile', async () => {
    for (const metrics of [
      [1440, 1000, false],
      [390, 844, true],
    ]) {
      await page.viewport(...metrics);
      await open();
      await page.text(body, 'CDP-V2 current body');
      assert.equal(
        await page.evaluate(
          `(() => {const root=document.querySelector(${JSON.stringify(editor)}),body=root.querySelector('.business-document-body');return body.contentEditable==='false'&&body.querySelectorAll('h2').length===1&&body.querySelectorAll('p').length===120&&!body.querySelector('script')&&[...body.querySelectorAll('*')].every(node=>node.attributes.length===0)&&globalThis.__cdpDocumentUnsafe===undefined&&['保存为新版本','翻译文档','发送给客户'].every(label=>{const nodes=[...root.querySelectorAll('button')].filter(node=>node.textContent===label);return nodes.length===1&&nodes[0].hidden;});})()`,
        ),
        true,
      );
      await page.noOverflow();
      await close();
    }
  });
  await check('document-editor-paper-zoom-pagination-and-preview', async () => {
    await page.viewport(1440, 1000, false);
    await open();
    await page.click(`${editor} [data-document-pagination] [aria-label="下一页"]`);
    await page.waitFor(
      `document.querySelector(${JSON.stringify(editor + ' .business-document-page-indicator')}).textContent.startsWith('第 2 / ')`,
      'original page navigation RAF',
    );
    await page.click(`${editor} [data-document-pagination] [aria-label="上一页"]`);
    await page.waitFor(
      `document.querySelector(${JSON.stringify(editor + ' .business-document-page-indicator')}).textContent.startsWith('第 1 / ')`,
      'previous page',
    );
    await select(`${editor} .business-document-page-select`, 'a4-landscape');
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor + ' .business-document-workspace')}).dataset.pageSize`,
      ),
      'a4-landscape',
    );
    await select(`${editor} .business-document-zoom-select`, '1.25');
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor + ' .business-document-workspace')}).style.getPropertyValue('--document-zoom')`,
      ),
      '1.25',
    );
    await select(`${editor} .business-document-page-select`, 'adaptive');
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor + ' [data-document-pagination]')}).hidden`,
      ),
      true,
    );
    await select(`${editor} .business-document-page-select`, 'a4-portrait');
    const preview = await mark('阅读预览', 'preview');
    const edit = await mark('编辑', 'edit');
    await page.click(preview);
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor + ' .business-document-workspace')}).dataset.viewMode`,
      ),
      'preview',
    );
    await page.click(edit);
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor + ' .business-document-workspace')}).dataset.viewMode==='edit'&&document.querySelector(${JSON.stringify(body)}).contentEditable==='false'`,
      ),
      true,
    );
    await page.noOverflow();
  });
  await check('document-editor-history-preview-keeps-current-version', async () => {
    assert.equal(
      await page.evaluate(
        `(() => {const root=document.querySelector(${JSON.stringify(editor)});for(const version of [1,2]){const node=[...root.querySelectorAll('.business-document-version')].find(button=>button.querySelector('strong')?.textContent==='V'+version);if(!node)return false;node.dataset.cdpDocumentVersion=String(version);}globalThis.__cdpEditorBody=root.querySelector('.business-document-body');return true;})()`,
      ),
      true,
    );
    await page.click(`${editor} [data-cdp-document-version="1"]`);
    await page.text(body, 'CDP-V1 earlier body');
    await page.text(`${editor} .business-document-comparison h3`, 'V1 与 V2 对比');
    await page.text(`${editor} .dialog-heading .muted`, '当前版本 V2');
    assert.equal(
      await page.evaluate(
        `globalThis.__cdpEditorBody===document.querySelector(${JSON.stringify(body)})&&document.querySelector(${JSON.stringify(body)}).contentEditable==='false'`,
      ),
      true,
    );
  });
  await check('document-editor-ready-translation-preview-and-clean-close', async () => {
    // TD-WEB-005: returning through V2 after comparison is not covered here.
    await close();
    await open();
    await page.text(body, 'CDP-V2 current body');
    const preview = await mark('查看译文', 'translation');
    await page.click(preview);
    await page.text('.translation-preview-dialog[open] .translation-preview', 'CDP-EN-READY');
    assert.equal(
      await page.evaluate(
        `(() => {const node=document.querySelector('.translation-preview-dialog[open] .translation-preview');return node.querySelectorAll('p').length===1&&!node.querySelector('script')&&[...node.querySelectorAll('*')].every(child=>child.attributes.length===0)&&globalThis.__cdpDocumentUnsafe===undefined;})()`,
      ),
      true,
    );
    await page.click('.translation-preview-dialog[open] button');
    await page.waitFor(
      `!document.querySelector('.translation-preview-dialog')`,
      'translation preview close',
    );
    await page.text(body, 'CDP-V2 current body');
    await close();
    assert.equal(
      await page.evaluate(`document.querySelectorAll('.business-document-dialog').length`),
      0,
    );
    assert.equal(router.counts().documentDetail, detailBefore + 4);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(router.counts()).filter(([name]) => name.startsWith('documentList:')),
      ),
      listCounts,
      'modal interactions reuse the original saved-document cache',
    );
    await page.noOverflow();
  });
}
