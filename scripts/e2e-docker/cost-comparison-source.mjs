import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const comparisonConditions = Object.freeze(['old-cold', 'current-cold', 'current-warm']);
export const costSourceHash = '7290b42f60ae107770622ac4f685f97308a68b14ede29281648afbc69665c0ca';
const patchHash = '1f77630ed4b01e498a46b299ec3e2fba1c37fc80059231da6953a4f9e5dee2a1';
const adaptedHash = '8ce3d50454711e0b31008a2a39b47af1ccce5f9d528d35899281b47a9c91a788';
export const oldWebCommit = 'b210c770434e8b9500322ca824cb2dea31e43e2b';
const digest = (value) => createHash('sha256').update(value).digest('hex');
export function validateCostComparison(condition, label) {
  assert(comparisonConditions.includes(condition), 'unknown fixed comparison condition');
  assert.match(label, /^[a-z0-9][a-z0-9-]{0,63}$/u);
}

// Exact previously authorized authentication patch; never a fuzzy patch or changed oracle.
export function costComparisonSource(source, patch, condition) {
  validateCostComparison(condition, 'source');
  assert.equal(digest(source), costSourceHash, 'frozen cost source changed');
  assert.equal(digest(patch), patchHash, 'authorized authentication patch changed');
  let adapted = source;
  if (condition !== 'old-cold') {
    const original = source.split('\n'),
      lines = patch.split('\n'),
      output = [];
    let cursor = 0;
    for (let index = 0; index < lines.length; index++) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(lines[index]);
      if (!match) continue;
      const start = Number(match[1]) - 1;
      assert(start >= cursor, 'overlapping authentication patch');
      output.push(...original.slice(cursor, start));
      const oldLines = [],
        newLines = [];
      while (index + 1 < lines.length && /^[ +-]/u.test(lines[index + 1])) {
        const line = lines[++index];
        if (line[0] !== '+') oldLines.push(line.slice(1));
        if (line[0] !== '-') newLines.push(line.slice(1));
      }
      assert.equal(oldLines.length, Number(match[2] ?? 1));
      assert.equal(newLines.length, Number(match[4] ?? 1));
      assert.deepEqual(original.slice(start, start + oldLines.length), oldLines);
      output.push(...newLines);
      cursor = start + oldLines.length;
    }
    adapted = [...output, ...original.slice(cursor)].join('\n');
    assert.equal(digest(adapted), adaptedHash, 'authentication-only result changed');
  }
  const title = "test('hands an approved matrix cost directly into a preselected sales quote'";
  const start = adapted.indexOf(title);
  assert(start > 0 && adapted.indexOf(title, start + 1) === -1);
  let scenario = adapted.slice(start);
  const marker =
    "  await page.evaluate(() => {\n    globalThis.location.hash = '#/costing';\n  });";
  assert.equal(scenario.split(marker).length, 2);
  if (condition === 'current-warm') scenario = scenario.replace(marker, `${warmVisit}\n${marker}`);
  const imports =
    "import { expect, test } from '@playwright/test';\nimport { writeFile } from 'node:fs/promises';\n" +
    (condition === 'old-cold'
      ? ''
      : "import { installSyntheticLogin } from '/work/tests/e2e/fixtures/browser-session';\n");
  return `${imports}\n${scenario}\n${observers}`;
}

const warmVisit = `  await page.locator('.app-shell').waitFor();
  const quoteParent = page.locator('[data-nav-routes~="quotes"]');
  await quoteParent.waitFor({ state: 'attached' });
  if (await quoteParent.isVisible() && await quoteParent.getAttribute('aria-expanded') !== 'true') await quoteParent.click();
  await page.locator('[data-app-route="quotes"]').click();
  await page.locator('[data-route-view~="quotes"][data-commercial-data-state="ready"]').first().waitFor();
  await page.evaluate(() => { globalThis.__ktCostObservation.warmVisited = true; });`;

// Passive DOM/node and frame sampling; no setter interception, waits, DOM changes or product hooks.
const observers = `
let blockedNetwork = 0;
test.beforeEach(async ({ page, context }) => {
  await context.routeWebSocket('**/*', (socket) => { blockedNetwork++; socket.close(); });
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4173' && request.method() === 'GET' && !url.pathname.startsWith('/api/')) await route.continue();
    else { blockedNetwork++; await route.abort(); }
  });
  await page.addInitScript(() => {
    const text = '景观草报价模型已形成报价成本快照，正在进入销售报价';
    const state = globalThis.__ktCostObservation = { textNodeSeen: false, renderedFrameSeen: false, viewportFrameSeen: false, frames: 0, warmVisited: false, stopped: false };
    const check = (node) => {
      if (!node || !node.isConnected || !node.textContent.includes(text)) return { rendered: false, viewport: false };
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      const rendered = !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
      return { rendered, viewport: rendered && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth };
    };
    const sample = () => Array.from(document.querySelectorAll('.commercial-status')).reduce((result, node) => {
      const flags = check(node);
      return { rendered: result.rendered || flags.rendered, viewport: result.viewport || flags.viewport };
    }, { rendered: false, viewport: false });
    globalThis.__ktCostFinal = () => {
      const final = sample(); state.stopped = true;
      return { textNodeSeen: state.textNodeSeen, renderedFrameSeen: state.renderedFrameSeen, viewportFrameSeen: state.viewportFrameSeen, frames: state.frames, warmVisited: state.warmVisited, finalRendered: final.rendered, finalViewport: final.viewport };
    };
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node.textContent && node.textContent.includes(text)) state.textNodeSeen = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
    const frame = () => {
      if (state.stopped) return;
      const flags = sample(); state.frames++;
      state.renderedFrameSeen ||= flags.rendered; state.viewportFrameSeen ||= flags.viewport;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
});
test.afterEach(async ({ page }, info) => {
  if (blockedNetwork !== 0) throw Error('comparison network hard gate rejected unhandled traffic');
  const observation = await page.evaluate(() => globalThis.__ktCostFinal());
  const dialog = page.locator('.form-dialog');
  const dialogVisible = await dialog.getByRole('heading', { name: '新建销售报价' }).isVisible();
  const field = dialog.locator('[name="costDecisionId"]');
  const preselected = await field.count() === 1 && await field.inputValue() === '00000000-0000-4000-8000-000000000003';
  await writeFile('/tmp/kingturf-private/cost-observation.json', JSON.stringify({ ...observation, quotesRoute: new URL(page.url()).hash === '#/quotes', dialogVisible, preselected, status: info.status }));
});
`;

export function safeCostObservation(value) {
  const result = {};
  for (const key of [
    'textNodeSeen',
    'renderedFrameSeen',
    'viewportFrameSeen',
    'warmVisited',
    'finalRendered',
    'finalViewport',
    'quotesRoute',
    'dialogVisible',
    'preselected',
  ]) {
    assert.equal(typeof value[key], 'boolean', 'fixed boolean observation required');
    result[key] = value[key];
  }
  assert(Number.isInteger(value.frames) && value.frames >= 0 && value.frames <= 100_000);
  assert(['passed', 'failed', 'timedOut', 'interrupted'].includes(value.status));
  return { ...result, frames: value.frames, status: value.status };
}
