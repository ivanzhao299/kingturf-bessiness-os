import { setTimeout as delay } from 'node:timers/promises';

export function createDriver(send) {
  const traceNavClicks = process.argv.includes('--trace-nav-clicks');
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
    const trace = traceNavClicks && /data-app-route|nav-parent/u.test(selector);
    if (trace)
      await evaluate(
        `(() => {if(globalThis.__cdpNavTrace)return;globalThis.__cdpNavTrace=[];document.addEventListener('click',event=>{const n=event.target.closest?.('[data-app-route],.nav-parent');if(n)globalThis.__cdpNavTrace.push({route:n.dataset.appRoute??null,parent:n.dataset.navRoutes??null,hash:location.hash,at:performance.now()});},true);})()`,
      );
    await evaluate(
      `(() => {const node=document.querySelector(${JSON.stringify(selector)});globalThis.__cdpClickTarget=node;node?.scrollIntoView({block:'center',inline:'center'});})()`,
    );
    // One shared original ~3s budget; never extend it with another animation wait.
    // Retain the actual node, sample its final hit/geometry, and do not scroll again.
    const deadline = Date.now() + 3000;
    let previous = null;
    let rect;
    for (let attempt = 0; attempt < 60 && Date.now() < deadline; attempt++) {
      const candidate = await evaluate(
        `(() => {const node=document.querySelector(${JSON.stringify(selector)});if(!node||node!==globalThis.__cdpClickTarget||!node.isConnected)throw Error('click target disappeared or changed');if(!node.getClientRects().length)return null;const r=node.getBoundingClientRect();const point={x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,scrollX,scrollY};if(r.width<=0||r.height<=0||point.x<0||point.y<0||point.x>=innerWidth||point.y>=innerHeight)return null;const hit=document.elementFromPoint(point.x,point.y);if(!hit||!(node===hit||node.contains(hit)))return null;const sidebar=node.closest('.sidebar');const groups=[...(sidebar?.querySelectorAll('.nav-children')??[])].filter(group=>group.contains(node)||(group.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)!==0);if(groups.some(group=>(group.getAnimations?.()??[]).some(animation=>animation.transitionProperty==='max-height'&&(animation.playState==='running'||animation.pending))))return null;if(${trace}){const routeHit=hit.closest('[data-app-route],.nav-parent');const parent=document.querySelector('.nav-parent[data-nav-routes~="'+(node.dataset.appRoute??'')+'"]');point.trace={at:performance.now(),hash:location.hash,selector:${JSON.stringify(selector)},target:node.dataset.appRoute??null,expanded:parent?.getAttribute('aria-expanded')??null,hit:routeHit?.dataset.appRoute??routeHit?.dataset.navRoutes??null,rect:{x:r.x,y:r.y,width:r.width,height:r.height},scrollY,layoutAnimationApi:groups.every(group=>typeof group.getAnimations==='function'),animations:document.getAnimations().map(a=>({state:a.playState,time:a.currentTime,target:a.effect?.target?.className??null}))};}return point;})()`,
      );
      if (
        candidate &&
        previous &&
        ['x', 'y', 'width', 'height'].every(
          (key) => Math.abs(candidate[key] - previous[key]) <= 0.5,
        ) &&
        candidate.scrollX === previous.scrollX &&
        candidate.scrollY === previous.scrollY &&
        Date.now() < deadline
      ) {
        rect = candidate;
        break;
      }
      previous = candidate;
      await delay(50);
    }
    if (!rect) throw new Error('DOM condition timed out: stable unobscured click target');
    if (trace) console.log(JSON.stringify({ kind: 'nav-click-before', ...rect.trace }));
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        x: rect.x,
        y: rect.y,
        button: 'left',
        clickCount: 1,
      });
    if (trace)
      console.log(
        JSON.stringify({
          kind: 'nav-click-after',
          selector,
          point: { x: rect.x, y: rect.y },
          state: await evaluate(
            `(() => {const n=document.querySelector(${JSON.stringify(selector)});const r=n?.getBoundingClientRect();const hit=document.elementFromPoint(${rect.x},${rect.y})?.closest('[data-app-route],.nav-parent');return {at:performance.now(),hash:location.hash,targetRect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,hit:hit?.dataset.appRoute??hit?.dataset.navRoutes??null,events:globalThis.__cdpNavTrace.splice(0)};})()`,
          ),
        }),
      );
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
