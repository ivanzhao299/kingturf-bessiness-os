import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createDriver } from './driver.mjs';
import { sessionOrigin } from './session-network-gateway.mjs';

const editor = '.business-document-dialog[open]:not(.translation-preview-dialog)';
const saved = '.contextual-documents[data-route-view="opportunities"] .business-document-open';
const profileIs = (name) =>
  `document.querySelector('.profile-chip > span:nth-child(2)')?.textContent===${JSON.stringify('S4 ' + name)}`;
const until = async (work, label) => {
  for (let i = 0; i < 100; i++) {
    if (await work()) return;
    await delay(50);
  }
  throw new Error(`DOM condition timed out: ${label}`);
};

export async function runSessionDomLifecycle(browser, gateway, fixture, check) {
  const main = await browser.page();
  const second = await browser.page();
  const page = createDriver(main.send);
  const other = createDriver(second.send);
  let navigations = 0;
  let restoresFinished = 0;
  const restoresInFlight = new Set();
  const unobserve = browser.observe((event) => {
    if (event.sessionId !== main.session) return;
    if (
      event.method === 'Network.requestWillBeSent' &&
      event.params.request.url === sessionOrigin + '/api/v1/auth/session'
    )
      restoresInFlight.add(event.params.requestId);
    if (
      event.method === 'Network.loadingFinished' &&
      restoresInFlight.delete(event.params.requestId)
    )
      restoresFinished++;
    if (event.method === 'Network.loadingFailed') restoresInFlight.delete(event.params.requestId);
    if (
      event.sessionId === main.session &&
      event.method === 'Page.frameNavigated' &&
      !event.params.frame.parentId
    )
      navigations++;
  });
  const restore = async () => {
    await main.send('Page.navigate', { url: sessionOrigin + '/#/opportunities' });
    await page.waitFor(`!!document.querySelector('.app-shell')`, 'restore workspace');
  };
  const changeFromOtherTab = async (user) => {
    await second.send('Page.bringToFront');
    await other.evaluate(
      `sessionStorage.setItem('kingturf.session','synthetic-obsolete-presence')`,
    );
    await second.send('Page.reload');
    await other.waitFor(
      `!!document.querySelector('input[name=login]')`,
      'other tab interactive login',
    );
    await other.fill('input[name=login]', user.login);
    await other.fill('input[name=password]', user.password);
    await other.click('form button[type=submit]');
    await other.waitFor(`!!document.querySelector('.app-shell')`, 'other tab real login workspace');
  };
  const markButton = async (scope, text, key) => {
    await page.waitFor(
      `(()=>{const n=[...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(n=>n.textContent===${JSON.stringify(text)});if(!n)return false;n.dataset.s4Action=${JSON.stringify(key)};return true})()`,
      'actual document action exists',
    );
    return `[data-s4-action="${key}"]`;
  };
  const openEditor = async () => {
    await main.send('Page.bringToFront');
    await page.route('opportunities');
    await page.waitFor(
      `!!document.querySelector(${JSON.stringify(saved)})`,
      'real saved PG document',
    );
    await page.click(saved);
    await page.waitFor(`!!document.querySelector(${JSON.stringify(editor)})`, 'real body editor');
    await page.waitFor(
      `(()=>{const n=document.querySelector(${JSON.stringify(editor + ' .business-document-body')});return n?.textContent.includes('S4 synthetic document body')&&n.contentEditable==='true'})()`,
      'real seeded editable body',
    );
    assert.equal(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(editor)})?.parentElement===document.body`,
      ),
      true,
    );
  };
  const changeAndAssertReload = async (user, expectedProfile) => {
    const before = navigations;
    await page.evaluate(`globalThis.__s4PreviousDocument=document; void 0`);
    await changeFromOtherTab(user);
    await page.waitFor(profileIs(expectedProfile), 'actual new generation profile');
    assert.ok(navigations > before, 'new identity caused an actual main-frame navigation');
    assert.equal(
      await page.evaluate(
        `globalThis.__s4PreviousDocument===undefined&&document.querySelectorAll('body > dialog').length===0`,
      ),
      true,
    );
  };
  try {
    await check('DOM-legacy-presence-cleared-once-then-real-Cookie-restore', async () => {
      await restore();
      await page.waitFor(profileIs('B'), 'restored B profile');
      await page.evaluate(
        `sessionStorage.setItem('kingturf.session','synthetic-obsolete-presence');sessionStorage.setItem('kingturf.sessionExpired','synthetic-presence');`,
      );
      const before = gateway.seen.filter((row) => row.path === '/api/v1/auth/session').length;
      await main.send('Page.reload');
      await page.waitFor(
        `!!document.querySelector('input[name=login]')`,
        'legacy forced interactive login',
      );
      assert.equal(
        await page.evaluate(
          `sessionStorage.getItem('kingturf.session')===null&&sessionStorage.getItem('kingturf.sessionExpired')===null`,
        ),
        true,
      );
      assert.equal(
        gateway.seen.filter((row) => row.path === '/api/v1/auth/session').length,
        before,
      );
      await main.send('Page.reload');
      await page.waitFor(profileIs('B'), 'next startup really restores Cookie');
      assert.ok(gateway.seen.filter((row) => row.path === '/api/v1/auth/session').length > before);
    });
    await check(
      'DOM-two-tabs-natural-focus-same-generation-retains-form-node-value-selection',
      async () => {
        await second.send('Page.navigate', { url: sessionOrigin + '/#/opportunities' });
        await other.waitFor(`!!document.querySelector('.app-shell')`, 'true second tab restore');
        await openEditor();
        await page.click(await markButton(editor, '翻译文档', 'translate'));
        await page.waitFor(
          `!!document.querySelector('textarea[name=translatedContent]')`,
          'actual translation form',
        );
        await page.fill('textarea[name=translatedContent]', 'S4 unsaved translation');
        for (const [key, code, modifiers] of [
          ['Home', 36, 0],
          ['ArrowRight', 39, 8],
          ['ArrowRight', 39, 8],
        ]) {
          for (const type of ['rawKeyDown', 'keyUp'])
            await main.send('Input.dispatchKeyEvent', {
              type,
              key,
              windowsVirtualKeyCode: code,
              modifiers,
            });
        }
        await page.evaluate(
          `globalThis.__s4Form={node:document.querySelector('textarea[name=translatedContent]'),shell:document.querySelector('.app-shell'),start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}; void 0`,
        );
        const before = navigations;
        const finished = restoresFinished;
        await second.send('Page.bringToFront');
        await delay(150);
        await main.send('Page.bringToFront');
        await until(
          () => restoresFinished > finished && restoresInFlight.size === 0,
          'natural focus restore body loadingFinished',
        );
        await page.evaluate(
          `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`,
        );
        assert.equal(restoresInFlight.size, 0, 'focus revalidation drained before form assertion');
        assert.equal(navigations, before);
        assert.equal(
          await page.evaluate(
            `(()=>{const f=globalThis.__s4Form,n=document.querySelector('textarea[name=translatedContent]');return n===f.node&&document.querySelector('.app-shell')===f.shell&&n.value==='S4 unsaved translation'&&document.activeElement===n&&n.selectionStart===f.start&&n.selectionEnd===f.end})()`,
          ),
          true,
        );
      },
    );
    await check(
      'DOM-real-translation-and-editor-removed-by-cross-tab-generation-reload',
      async () => {
        assert.equal(
          await page.evaluate(`document.querySelectorAll('body > dialog[open]').length>=2`),
          true,
        );
        await changeAndAssertReload(fixture.a, 'A');
      },
    );
    await check('DOM-real-settings-and-editor-removed-by-cross-tab-generation-reload', async () => {
      await openEditor();
      const reads = gateway.seen.filter((row) => row.path === '/api/v1/document-connectors').length;
      await page.click(await markButton(editor, '发送给客户', 'send'));
      await page.click(await markButton('.document-send-notice[open]', '发送渠道配置', 'settings'));
      await page.waitFor(
        `!!document.querySelector('.document-send-settings[open]')`,
        'actual connector settings',
      );
      await until(
        () =>
          gateway.seen.filter(
            (row) => row.path === '/api/v1/document-connectors' && row.status === 200,
          ).length > reads,
        'real connector read completed',
      );
      assert.equal(
        await page.evaluate(
          `document.querySelector('.document-send-settings').parentElement===document.body`,
        ),
        true,
      );
      await changeAndAssertReload(fixture.b, 'B');
    });
    await check('DOM-late-A-document-detail-cannot-open-editor-in-B', async () => {
      await changeFromOtherTab(fixture.a);
      await page.waitFor(profileIs('A'), 'A before old detail');
      await main.send('Page.bringToFront');
      await page.route('opportunities');
      await page.waitFor(
        `!!document.querySelector(${JSON.stringify(saved)})`,
        'A saved document button',
      );
      const held = gateway.arm('GET', `/api/v1/business-documents/${fixture.documentId}`);
      await page.click(saved);
      await until(() => held.status !== null, 'real held old document header');
      await changeAndAssertReload(fixture.b, 'B');
      held.release();
      await delay(250);
      assert.equal(
        await page.evaluate(
          `${profileIs('B')}&&document.querySelectorAll('body > dialog').length===0`,
        ),
        true,
      );
    });
    await check('DOM-late-old-mount-cannot-replace-new-B-workspace', async () => {
      await changeFromOtherTab(fixture.a);
      await page.waitFor(profileIs('A'), 'A before old mount');
      const held = gateway.arm('GET', '/api/v1/employees');
      await main.send('Page.reload');
      await until(() => held.status !== null, 'real held old mount header');
      await changeFromOtherTab(fixture.b);
      await page.waitFor(profileIs('B'), 'new B workspace before old mount release');
      held.release();
      await delay(250);
      assert.equal(
        await page.evaluate(
          `${profileIs('B')}&&document.querySelectorAll('.app-shell').length===1`,
        ),
        true,
      );
    });
  } finally {
    unobserve();
    await main.send('Target.closeTarget', { targetId: main.target });
    await second.send('Target.closeTarget', { targetId: second.target });
  }
}
