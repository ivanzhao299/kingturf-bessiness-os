// TD-TEST-040：稳定触发器、真实状态筛选与详情抽屉的浏览器交互。只点击已有读控件。
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { audit } from './walk-audit.mjs';

const FILTER_PATHS = {
  'kt-collection-filter-open': '/api/v1/collection-cases',
  'kt-payment-filter-open': '/api/v1/bank-payments',
  'kt-qi-inspections-filter-open': '/api/v1/quality-inspections',
};

export function triggerSelector(route, trigger) {
  const root = `[data-route-view~=${JSON.stringify(route)}]`;
  const row = trigger.rowId ? ` [data-row-id=${JSON.stringify(trigger.rowId)}]` : '';
  const target = trigger.testId
    ? `[data-testid=${JSON.stringify(trigger.testId)}]`
    : trigger.tagName;
  return `${root}${row} ${target}`;
}

export function currentTrigger(page, route, trigger) {
  const candidate = page.locator(triggerSelector(route, trigger)).filter({ visible: true });
  // 发现阶段按同一标识取一个代表行；操作时以原行 ID 和真实文字重新定位，不依赖旧 DOM 上的序号。
  return candidate.filter({ hasText: trigger.label }).first();
}

function drawerState() {
  const visible = (node) => node && node.getBoundingClientRect().width > 0;
  const drawer = [...globalThis.document.querySelectorAll('.detail-drawer')].find(visible);
  const rect = drawer.getBoundingClientRect();
  const overlay = drawer.parentElement.querySelector('[data-drawer-overlay="true"]');
  const box = overlay?.getBoundingClientRect();
  const style = overlay ? globalThis.getComputedStyle(overlay) : null;
  const hit =
    rect.left > 0
      ? globalThis.document.elementFromPoint(rect.left / 2, globalThis.window.innerHeight / 2)
      : overlay;
  return {
    geo: {
      position: globalThis.getComputedStyle(drawer).position,
      size: drawer.getAttribute('data-size'),
      top: Math.round(rect.top),
      rightGap: Math.round(globalThis.window.innerWidth - rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: globalThis.window.innerWidth,
      viewportHeight: globalThis.window.innerHeight,
    },
    overlay: Boolean(
      box &&
      style.position === 'fixed' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      box.top <= 0 &&
      box.left <= 0 &&
      box.right >= globalThis.window.innerWidth &&
      box.bottom >= globalThis.window.innerHeight &&
      hit === overlay,
    ),
    modal: drawer.getAttribute('role') === 'dialog' && drawer.getAttribute('aria-modal') === 'true',
    focusInitial: drawer.contains(globalThis.document.activeElement),
  };
}

const focusInDrawer = (page) =>
  page.evaluate(() =>
    Boolean(globalThis.document.activeElement?.closest('.detail-drawer[role="dialog"]')),
  );

export async function checkDrawer(page, route, trigger, tag, { tabs, shot }) {
  assert.equal(
    await page.locator('.detail-drawer').filter({ visible: true }).count(),
    0,
    'another drawer is already open',
  );
  const handle = currentTrigger(page, route, trigger);
  await handle.waitFor({ state: 'visible', timeout: 8000 });
  await handle.evaluate((element, value) => element.setAttribute('data-e2e-trigger', value), tag);
  await handle.scrollIntoViewIfNeeded();
  await handle.click({ timeout: 8000 });
  const drawer = page.locator('.detail-drawer').filter({ visible: true }).first();
  await drawer.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
  const state = await page.evaluate(drawerState);
  const drawerAudit = await page.evaluate(audit, { kind: 'drawer' });
  const screenshot = join(shot.directory, `${tag}-drawer.png`);
  await page.screenshot({ path: screenshot });
  const tabStops = [];
  for (let step = 0; step < tabs; step += 1) {
    await page.keyboard.press('Tab');
    tabStops.push(await focusInDrawer(page));
  }
  await drawer.evaluate((node, value) => {
    const stops = [
      ...node.querySelectorAll('button, input, select, textarea, a, [tabindex]'),
    ].filter(
      (element) =>
        !element.disabled && element.tabIndex !== -1 && element.getClientRects().length > 0,
    );
    if (stops.length === 0) return;
    stops[0].setAttribute('data-e2e-first', value);
    stops.at(-1).setAttribute('data-e2e-last', value);
    stops.at(-1).focus();
  }, tag);
  await page.keyboard.press('Tab');
  const wrapForward = await page.evaluate(
    (value) => globalThis.document.activeElement?.getAttribute('data-e2e-first') === value,
    tag,
  );
  await page.keyboard.press('Shift+Tab');
  const wrapBackward = await page.evaluate(
    (value) => globalThis.document.activeElement?.getAttribute('data-e2e-last') === value,
    tag,
  );
  await page.keyboard.press('Escape');
  const closed = await drawer
    .waitFor({ state: 'detached', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  const detached = performance.now();
  const focusRestoredMs = closed
    ? await page
        .waitForFunction(
          (value) =>
            globalThis.document.activeElement?.isConnected === true &&
            globalThis.document.activeElement.getAttribute('data-e2e-trigger') === value,
          tag,
          { timeout: 1000 },
        )
        .then(() => Math.round(performance.now() - detached))
        .catch(() => null)
    : null;
  return {
    key: trigger.key,
    tag,
    ...state,
    tabs: tabStops,
    wrapForward,
    wrapBackward,
    closed,
    focusRestoredMs,
    ...drawerAudit,
    screenshot,
  };
}

async function applyStatusFilter(page, route, trigger, path, state) {
  const handle = currentTrigger(page, route, trigger);
  await handle.waitFor({ state: 'visible', timeout: 8000 });
  const [response] = await Promise.all([
    page.waitForResponse(
      (reply) => {
        const url = new URL(reply.url());
        return (
          reply.request().method() === 'GET' &&
          url.pathname === path &&
          (url.searchParams.get('state') ?? '') === state
        );
      },
      { timeout: 8000 },
    ),
    handle.click({ timeout: 8000 }),
  ]);
  assert(response.ok(), `filter GET failed: HTTP ${response.status()}`);
  const body = await response.json();
  assert(Array.isArray(body.items), 'filter GET did not return items');
  const ids = body.items.map((item) => String(item.id ?? item.lotId)).sort();
  const readiness = await page.waitForFunction(
    ({ route, key, ids }) => {
      const nodes = [
        ...globalThis.document.querySelectorAll(
          `[data-route-view~="${route}"] [data-testid="${key}"]`,
        ),
      ];
      const button = nodes.find((node) => node.getBoundingClientRect().width > 0);
      const content = button?.closest('.fin-filters')?.nextElementSibling;
      const table = content?.querySelector('table');
      const rows = [...(table?.querySelectorAll('tbody [data-row-id]') ?? [])]
        .map((row) => row.getAttribute('data-row-id'))
        .sort();
      return (
        button?.getAttribute('aria-pressed') === 'true' &&
        table?.getAttribute('aria-busy') === 'false' &&
        JSON.stringify(rows) === JSON.stringify(ids)
      );
    },
    { route, key: trigger.testId, ids },
    { timeout: 8000 },
  );
  const listReady = await readiness.jsonValue();
  await readiness.dispose();
  return { method: 'GET', path, state, status: response.status(), rows: ids.length, listReady };
}

export async function checkStatusFilter(page, route, trigger, tag, { shot }) {
  const path = FILTER_PATHS[trigger.key];
  assert(path && trigger.reset, `unrecognized status filter: ${trigger.key}`);
  assert.equal(await page.locator('.detail-drawer').filter({ visible: true }).count(), 0);
  const response = await applyStatusFilter(page, route, trigger, path, 'OPEN');
  const selected =
    (await currentTrigger(page, route, trigger).getAttribute('aria-pressed')) === 'true';
  const filterAudit = await page.evaluate(audit, { kind: 'page', route });
  const screenshot = join(shot.directory, `${tag}-filter.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  // 恢复真实「全部」按钮；等待实际读响应和对应行重建，后续详情才有稳定的新入口。
  const resetResponse = await applyStatusFilter(page, route, trigger.reset, path, '');
  const restored =
    (await currentTrigger(page, route, trigger.reset).getAttribute('aria-pressed')) === 'true' &&
    (await currentTrigger(page, route, trigger).getAttribute('aria-pressed')) === 'false';
  assert.equal(
    await page.locator('.detail-drawer').filter({ visible: true }).count(),
    0,
    'status chip unexpectedly opened a drawer',
  );
  const restoredScreenshot = join(shot.directory, `${tag}-restored.png`);
  await page.screenshot({ path: restoredScreenshot, fullPage: true });
  const restoredAudit = await page.evaluate(audit, { kind: 'page', route });
  return {
    key: trigger.key,
    tag,
    kind: 'status-filter',
    selected,
    restored,
    listReady: response.listReady === true && resetResponse.listReady === true,
    response,
    resetResponse,
    issues: [...filterAudit.issues, ...restoredAudit.issues],
    screenshot,
    restoredScreenshot,
  };
}
