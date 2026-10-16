import { setTimeout as delay } from 'node:timers/promises';

export function createDriver(send) {
  const counts = { dom: 0, viewport: 0, route: 0, text: 0, overflow: 0 };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error('CDP DOM evaluation failed');
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    throw new Error(`DOM condition timed out: ${label}`);
  };
  const click = async (selector) => {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',inline:'center'})`,
    );
    await waitFor(
      `(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n?.getClientRects().length)return false;const r=n.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(n===hit||n.contains(hit));})()`,
      'unobscured click target',
    );
    const rect = await evaluate(
      `(() => {const node=document.querySelector(${JSON.stringify(selector)});if(!node||!node.getClientRects().length)throw Error('missing visible target');node.scrollIntoView({block:'center',inline:'center'});const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, ...rect, button: 'left', clickCount: 1 });
    counts.dom++;
  };
  const fill = async (selector, text) => {
    await click(selector);
    for (const type of ['rawKeyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', {
        type,
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        modifiers: 2,
      });
    await send('Input.insertText', { text });
    counts.dom++;
  };
  const onlyRoute = async (route) => {
    try {
      await waitFor(
        `(() => {const active=document.querySelectorAll('[data-app-route][aria-current="page"]');return active.length===1&&active[0].dataset.appRoute===${JSON.stringify(route)}&&[...document.querySelectorAll('[data-route-view]')].some(n=>(n.dataset.routeView??'').split(/\\s+/).includes(${JSON.stringify(route)})&&n.getClientRects().length>0)&&[...document.querySelectorAll('[data-route-view]')].every(n=>(n.dataset.routeView??'').split(/\\s+/).includes(${JSON.stringify(route)})||n.getClientRects().length===0);})()`,
        `exclusive route ${route}`,
      );
      counts.route++;
    } catch (error) {
      const state = await evaluate(
        `JSON.stringify({active:[...document.querySelectorAll('[data-app-route][aria-current="page"]')].map(n=>n.dataset.appRoute),visible:[...document.querySelectorAll('[data-route-view]')].filter(n=>n.getClientRects().length).map(n=>n.dataset.routeView)})`,
      );
      throw new Error(`${error.message}; route diagnostic ${state}`);
    }
  };
  return {
    counts,
    evaluate,
    waitFor,
    click,
    fill,
    onlyRoute,
    async route(route) {
      const selector = `[data-app-route="${route}"]`;
      const parentClosed = await evaluate(
        `(() => {const p=document.querySelector('.nav-parent[data-nav-routes~="${route}"]');return !!p?.getClientRects().length&&p.getAttribute('aria-expanded')==='false';})()`,
      );
      if (parentClosed) await click(`.nav-parent[data-nav-routes~="${route}"]`);
      await click(selector);
      await onlyRoute(route);
    },
    async viewport(width, height, mobile) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await waitFor(`innerWidth===${width}&&innerHeight===${height}`, 'device metrics');
      counts.viewport++;
    },
    async text(selector, expected, { visible = true } = {}) {
      await waitFor(
        `(() => {const node=document.querySelector(${JSON.stringify(selector)});return !!node&&node.textContent.includes(${JSON.stringify(expected)})&&(${!visible}||node.getClientRects().length>0);})()`,
        'expected synthetic UI text',
      );
      counts.text++;
    },
    async noOverflow() {
      await delay(100);
      if (
        !(await evaluate(
          'document.documentElement.scrollWidth<=document.documentElement.clientWidth',
        ))
      )
        throw new Error('document horizontal overflow');
      counts.overflow++;
    },
  };
}
