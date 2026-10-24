import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createDriver } from './driver.mjs';
import { sessionOrigin } from './session-network-gateway.mjs';

const auth = '/api/v1/auth/';
const waitBarrier = (barrier) =>
  Promise.race([
    barrier.ready,
    delay(8000).then(() => {
      throw new Error('real response header barrier not reached');
    }),
  ]);

export async function installNetworkClient(page, fixture) {
  await page.evaluate(
    `globalThis.__s4={users:${JSON.stringify({ a: fixture.a, b: fixture.b })}, replacement:${JSON.stringify(fixture.replacement)}, snapshots:{}, jobs:{}};`,
  );
  await page.evaluate(`(() => {
    const state=globalThis.__s4;
    state.call=async(path,method='GET',headers={},body)=>{
      const response=await fetch('/api/v1'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const value=response.status===204?null:await response.json();
      return {status:response.status,value};
    };
    state.login=async(key,user,password)=>{
      const context=await state.call('/auth/login-context','GET',{'x-kingturf-session-intent':'login'});
      if(context.status!==200)throw Error('context failed');
      const result=await state.call('/auth/login','POST',{'x-kingturf-csrf':context.value.csrfToken},{login:state.users[user].login,password:password??state.users[user].password});
      if(result.status!==200||'token' in result.value)throw Error('login failed');
      state.snapshots[key]=result.value;
      return result.status;
    };
    state.headers=key=>({'x-kingturf-session-generation':state.snapshots[key].generation,'x-kingturf-csrf':state.snapshots[key].csrfToken});
    state.restore=async key=>{
      const result=await state.call('/auth/session','GET',{'x-kingturf-session-intent':'restore'});
      if(result.status!==200)throw Error('restore failed');
      state.snapshots[key]=result.value;
      return result.status;
    };
  })()`);
}

export async function runNetworkBrowserMatrix(browser, gateway, fixture, check) {
  const target = await browser.page();
  const page = createDriver(target.send);
  await target.send('Network.clearBrowserCookies');
  await target.send('Page.navigate', { url: sessionOrigin });
  await page.waitFor(`!!document.querySelector('input[name=login]')`, 'matrix app initial401');
  await installNetworkClient(page, fixture);
  const evalStatus = async (expression, expected) =>
    assert.equal(await page.evaluate(expression), expected);
  const login = (key, user = 'a', replacement = false) =>
    evalStatus(`__s4.login('${key}','${user}'${replacement ? ',__s4.replacement' : ''})`, 200);
  const sessionIs = async (key, user = 'a', expected = 200) =>
    evalStatus(
      `(async()=>{const r=await __s4.call('/auth/session');return r.status===${expected}${expected === 200 ? `&&r.value.employeeId===__s4.users.${user}.employeeId&&r.value.generation===__s4.snapshots.${key}.generation` : ''};})()`,
      true,
    );
  const start = async (key, expression) => page.evaluate(`__s4.jobs.${key}=(${expression});void 0`);
  const finish = async (key, expected) =>
    evalStatus(`__s4.jobs.${key}.then(r=>typeof r==='number'?r:r.status)`, expected);
  const body = {
    organizationId: fixture.a.organizationId,
    employeeNumber: `s4-${randomUUID()}`,
    displayName: 'S4 created synthetic',
    email: `${randomUUID()}@example.test`,
  };
  await page.evaluate(`__s4.employee=${JSON.stringify(body)}`);

  for (const sameAccount of [true, false])
    for (const late of ['a', 'b']) {
      await check(
        `login-header-order-${sameAccount ? 'same' : 'different'}-${late}-last`,
        async () => {
          const first = late === 'a' ? 'b' : 'a';
          const delayed = gateway.arm('POST', auth + 'login');
          await start('late', `__s4.login('${late}','${late === 'a' || sameAccount ? 'a' : 'b'}')`);
          await waitBarrier(delayed);
          assert.equal(delayed.status, 200);
          await login(first, first === 'a' || sameAccount ? 'a' : 'b');
          await sessionIs(first, first === 'a' || sameAccount ? 'a' : 'b');
          delayed.release();
          await finish('late', 200);
          await sessionIs(late, late === 'a' || sameAccount ? 'a' : 'b');
        },
      );
    }
  await check('old401-header-after-B', async () => {
    await login('a');
    const held = gateway.arm('GET', auth + 'session');
    await start(
      'old',
      `__s4.call('/auth/session','GET',{'x-kingturf-session-generation':'invalid'})`,
    );
    await waitBarrier(held);
    assert.equal(held.status, 401);
    assert.equal(held.noAuthCookie, true);
    await login('b', 'b');
    await sessionIs('b', 'b');
    held.release();
    await finish('old', 401);
    await sessionIs('b', 'b');
  });
  await check('logout-header-after-B-cross-instance', async () => {
    await login('a');
    gateway.select(1);
    const held = gateway.arm('POST', auth + 'logout');
    await start('old', `__s4.call('/auth/logout','POST',__s4.headers('a'))`);
    await waitBarrier(held);
    assert.equal(held.status, 204);
    assert.equal(held.noAuthCookie, true);
    gateway.select(0);
    await login('b', 'b');
    await sessionIs('b', 'b');
    held.release();
    await finish('old', 204);
    await sessionIs('b', 'b');
  });
  await check('late-login-after-logout', async () => {
    await login('a');
    const held = gateway.arm('POST', auth + 'login');
    await start('late', `__s4.login('b','b')`);
    await waitBarrier(held);
    // Login-context changed CSRF only; bounded restore of the actual A cookie is explicit.
    await evalStatus(`__s4.restore('a')`, 200);
    await evalStatus(`__s4.call('/auth/logout','POST',__s4.headers('a')).then(r=>r.status)`, 204);
    held.release();
    await finish('late', 200);
    await sessionIs('b', 'b');
  });
  for (const sameAccount of [true, false])
    await check(
      `old-proof-new-Cookie-${sameAccount ? 'same' : 'different'}-account-zero-write`,
      async () => {
        await login('a');
        await login('b', sameAccount ? 'a' : 'b');
        await page.evaluate(
          `__s4.employee.employeeNumber+='x'; __s4.employee.email='x'+__s4.employee.email; void 0`,
        );
        const count = await fixture.employeeCount();
        await evalStatus(
          `__s4.call('/employees','POST',__s4.headers('a'),__s4.employee).then(r=>r.status)`,
          401,
        );
        await delay(200);
        assert.equal(await fixture.employeeCount(), count);
        await evalStatus(
          `__s4.call('/auth/logout','POST',__s4.headers('a')).then(r=>r.status)`,
          401,
        );
        await sessionIs('b', sameAccount ? 'a' : 'b');
        // Current generation with old session proof reaches proof validation, not only generation.
        await evalStatus(
          `__s4.call('/employees','POST',{...__s4.headers('a'),'x-kingturf-session-generation':__s4.snapshots.b.generation},__s4.employee).then(r=>r.status)`,
          403,
        );
        assert.equal(await fixture.employeeCount(), count);
        for (const header of [{}, { 'x-kingturf-csrf': 'invalid' }]) {
          await evalStatus(
            `__s4.call('/employees','POST',{'x-kingturf-session-generation':__s4.snapshots.b.generation,...${JSON.stringify(header)}},__s4.employee).then(r=>r.status)`,
            403,
          );
        }
        assert.equal(await fixture.employeeCount(), count);
        await evalStatus(`__s4.call('/employees').then(r=>r.status)`, 200);
        await evalStatus(
          `__s4.call('/employees','GET',{authorization:'Bearer invalid'}).then(r=>r.status)`,
          401,
        );
        await evalStatus(`__s4.restore('b')`, 200);
        await evalStatus(
          `__s4.call('/employees','POST',__s4.headers('b'),__s4.employee).then(r=>r.status)`,
          201,
        );
        assert.equal(await fixture.employeeCount(), count + 1);
      },
    );
  await check('late-restore-only-CSRF-mispair-and-manual-new-write', async () => {
    await login('a');
    await evalStatus(
      `__s4.call('/auth/login-context','GET',{'x-kingturf-session-intent':'login'}).then(r=>r.status)`,
      200,
    );
    const held = gateway.arm('GET', auth + 'session');
    await start(
      'restore',
      `__s4.call('/auth/session','GET',{'x-kingturf-session-intent':'restore'})`,
    );
    await waitBarrier(held);
    assert.equal(held.noAuthCookie, true);
    assert.equal(held.onlyCsrfCookie, true);
    await login('b', 'b');
    await sessionIs('b', 'b');
    held.release();
    await finish('restore', 200);
    await sessionIs('b', 'b');
    // A's real restore has now replaced ONLY the CSRF cookie, not B's authentication.
    const count = await fixture.employeeCount();
    await evalStatus(
      `__s4.call('/employees','POST',__s4.headers('b'),__s4.employee).then(r=>r.status)`,
      403,
    );
    assert.equal(await fixture.employeeCount(), count);
    await delay(200);
    assert.equal(await fixture.employeeCount(), count, 'no automatic write replay');
    await evalStatus(`__s4.restore('b')`, 200);
    await page.evaluate(
      `__s4.employee.employeeNumber+='x'; __s4.employee.email='x'+__s4.employee.email; void 0`,
    );
    await evalStatus(
      `__s4.call('/employees','POST',__s4.headers('b'),__s4.employee).then(r=>r.status)`,
      201,
    );
    assert.equal(await fixture.employeeCount(), count + 1);
  });
  await check('credential-transaction-old-B-revoked-new-B-survives', async () => {
    await login('a');
    await login('same');
    const revokedBefore = await fixture.revokedCount(fixture.a);
    const held = gateway.arm('PUT', auth + 'credential');
    await start(
      'changed',
      `__s4.call('/auth/credential','PUT',__s4.headers('same'),{currentPassword:__s4.users.a.password,password:__s4.replacement})`,
    );
    await waitBarrier(held);
    assert.equal(held.status, 204);
    assert.equal(held.noAuthCookie, true);
    assert.ok(
      (await fixture.revokedCount(fixture.a)) > revokedBefore,
      'transaction completed before header release',
    );
    await sessionIs('same', 'a', 401);
    await login('new', 'a', true);
    await sessionIs('new');
    held.release();
    await finish('changed', 204);
    await sessionIs('new');
  });
  await check('old-login-response-after-password-transaction-is-revoked', async () => {
    await login('current', 'a', true);
    const held = gateway.arm('POST', auth + 'login');
    await start('oldLogin', `__s4.login('old','a',__s4.replacement)`);
    await waitBarrier(held);
    await evalStatus(`__s4.restore('current')`, 200);
    await evalStatus(
      `__s4.call('/auth/credential','PUT',__s4.headers('current'),{currentPassword:__s4.replacement,password:__s4.users.a.password}).then(r=>r.status)`,
      204,
    );
    held.release();
    await finish('oldLogin', 200);
    await sessionIs('old', 'a', 401);
  });
  await check('credential-other-account-B-survives-old-header', async () => {
    await login('a');
    const held = gateway.arm('PUT', auth + 'credential');
    await start(
      'changed',
      `__s4.call('/auth/credential','PUT',__s4.headers('a'),{currentPassword:__s4.users.a.password,password:__s4.replacement})`,
    );
    await waitBarrier(held);
    assert.equal(held.status, 204);
    assert.equal(held.noAuthCookie, true);
    await login('b', 'b');
    await sessionIs('b', 'b');
    held.release();
    await finish('changed', 204);
    await sessionIs('b', 'b');
  });
  await check('real-PG-expiry-cross-instance-natural-Cookie', async () => {
    await login('b', 'b');
    gateway.select(1);
    await sessionIs('b', 'b');
    await fixture.expire(fixture.b);
    gateway.select(0);
    await sessionIs('b', 'b', 401);
    gateway.select(1);
    await sessionIs('b', 'b', 401);
    gateway.select(0);
  });
  await target.send('Target.closeTarget', { targetId: target.target });
}

export async function runNaturalDomFlow(browser, gateway, fixture, check) {
  const target = await browser.page();
  const page = createDriver(target.send);
  let navigations = 0;
  const unobserve = browser.observe((event) => {
    if (
      event.sessionId === target.session &&
      event.method === 'Page.frameNavigated' &&
      !event.params.frame.parentId
    )
      navigations++;
  });
  const login = async () => {
    await page.waitFor(`!!document.querySelector('input[name=login]')`, 'real login DOM');
    await page.fill('input[name=login]', fixture.b.login);
    await page.fill('input[name=password]', fixture.b.password);
    await page.click('form button[type=submit]');
    await page.waitFor(`!!document.querySelector('.app-shell')`, 'real authenticated workspace');
  };
  await check('natural-SPA-DOM-login-workspace-cookie-properties', async () => {
    const seenStart = gateway.seen.length;
    const reads = gateway.seen.filter((row) => row.path === auth + 'session').length;
    await target.send('Page.navigate', { url: sessionOrigin });
    await page.waitFor(`!!document.querySelector('input[name=login]')`, 'initial401 actual login');
    await delay(200);
    assert.equal(navigations, 1, 'initial401 does not reload loop');
    assert.equal(
      gateway.seen.filter((row) => row.path === auth + 'session').length - reads,
      1,
      'initial401 is bounded',
    );
    await login();
    const ownResponses = gateway.seen.slice(seenStart);
    const cookies = (await target.send('Network.getCookies', { urls: [sessionOrigin] })).cookies;
    const session = cookies.find((item) => item.name === '__Host-kingturf-session');
    const csrf = cookies.find((item) => item.name === '__Host-kingturf-csrf');
    assert.ok(session && csrf);
    assert.ok(session.httpOnly && session.secure && !csrf.httpOnly && csrf.secure);
    assert.ok(
      [session, csrf].every(
        (item) => item.sameSite === 'Lax' && item.path === '/' && item.domain === '127.0.0.1',
      ),
    );
    assert.equal(
      await page.evaluate(
        `!document.cookie.includes('__Host-kingturf-session=')&&document.cookie.includes('__Host-kingturf-csrf=')`,
      ),
      true,
    );
    assert.ok(
      ownResponses.some(
        (item) =>
          item.path === auth + 'login' &&
          item.cookieCount === 2 &&
          item.status === 200 &&
          item.loginJsonNoToken === true &&
          item.loginCookieContract &&
          item.noStore,
      ),
    );
    assert.ok(
      ownResponses.some(
        (item) =>
          item.path === auth + 'session' &&
          item.status === 200 &&
          item.receivedSessionCookie &&
          item.noStore,
      ),
    );
  });
  await check('mount-signal-conflict-visible-manual-DOM-logout-relogin', async () => {
    const held = gateway.arm('GET', '/api/v1/employees');
    await target.send('Page.reload');
    await waitBarrier(held);
    await page.evaluate(`new BroadcastChannel('kingturf.session').postMessage('invalidate')`);
    await delay(100);
    held.release();
    await page.waitFor(
      `!!document.querySelector('.startup-shell')&&[...document.querySelectorAll('button')].some(n=>n.textContent==='返回登录')`,
      'mount conflict manual recovery',
    );
    await page.evaluate(
      `document.querySelectorAll('button').forEach(n=>{if(n.textContent==='返回登录')n.dataset.s4Signout='true'})`,
    );
    await page.click('[data-s4-signout=true]');
    await delay(200);
    console.log(
      JSON.stringify({
        kind: 'DOM-signout-diagnostic',
        logoutRequests: gateway.seen.filter((item) => item.path === auth + 'logout').length,
        hasLoginForm: await page.evaluate(`!!document.querySelector('input[name=login]')`),
        retryFailureVisible: await page.evaluate(
          `document.querySelector('.startup-status')?.textContent==='退出未完成，请重试；当前登录状态未被清除。'`,
        ),
      }),
    );
    await page.waitFor(`!!document.querySelector('input[name=login]')`, 'DOM logout returns login');
    assert.ok(
      gateway.seen.some(
        (item) => item.path === auth + 'logout' && item.status === 204 && item.noAuthCookie,
      ),
    );
    await login();
  });
  unobserve();
  await target.send('Target.closeTarget', { targetId: target.target });
}
