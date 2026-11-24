#!/usr/bin/env node
// 全站走查（在 Playwright 容器内执行，只读）。对每个路由：导航 → 记录页面异常 / console.error /
// 状态码 ≥400 的接口响应 → 截图 → 基于 DOM 量测的布局检查 → 对行级「查看」类触发器验证抽屉是否
// 以浮层出现、焦点是否进入对话框、连按 Tab 是否留在对话框内、Esc 是否关闭、关闭后焦点是否归还。
// 用法：node scripts/e2e-local/walk.mjs [--viewport desktop|mobile|宽x高[@倍率]] [--routes a,b] [--out 目录]
//       [--max-drawers n] [--tabs n] [--base url]
// 账号取自 KINGTURF_CREDS_FILE（自举生成的合成全权限账号）。只走读路径，不点任何写操作。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { audit, pickTriggers } from './walk-audit.mjs';

const REPOSITORY = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const PRESETS = {
  desktop: { label: 'desktop', viewport: { width: 1440, height: 900 } },
  mobile: { label: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
};
const unique = (items) => [...new Set(items)];

function parseViewport(spec) {
  if (PRESETS[spec]) return PRESETS[spec];
  const match = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/u.exec(spec);
  assert(match, `invalid --viewport ${spec}; use desktop, mobile or 宽x高[@倍率]`);
  const scale = match[3] ? { deviceScaleFactor: Number(match[3]) } : {};
  return { label: spec, viewport: { width: Number(match[1]), height: Number(match[2]), ...scale } };
}

// 缺省路由全集取自应用的路由表（AppRoute），与被测提交保持一致。
async function defaultRoutes() {
  const navigation = await import(
    new URL('../../apps/web/src/shared/navigation.ts', import.meta.url)
  );
  return Object.keys(navigation.APP_ROUTE_LABELS);
}

// 等页面上正在运行的 CSS 过渡/动画结束。导航分组展开是 220ms 的 max-height 过渡，展开途中条目被
// 裁剪且容器可被程序滚动，此时点击会落到别的条目上。
const settleTransitions = (page) =>
  page.evaluate(() =>
    Promise.all(
      globalThis.document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

async function openRoute(page, route) {
  const parent = page.locator(`[data-nav-routes~="${route}"]`).first();
  await parent.waitFor({ state: 'attached', timeout: 20000 });
  if ((await parent.isVisible()) && (await parent.getAttribute('aria-expanded')) !== 'true') {
    await parent.click();
    await settleTransitions(page);
  }
  const menu = page.locator(`[data-app-route="${route}"]`).first();
  await menu.click({ timeout: 10000 });
  await page.waitForFunction(
    (value) =>
      globalThis.document
        .querySelector(`[data-app-route="${value}"]`)
        ?.getAttribute('aria-current') === 'page',
    route,
    { timeout: 20000 },
  );
  await page
    .locator(`[data-route-view~="${route}"]`)
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function checkDrawer(page, route, index, tag, { tabs, shot }) {
  const handle = page
    .locator(`[data-route-view~="${route}"] [data-e2e-pick="${index}"]`)
    .filter({ visible: true })
    .first();
  await handle.evaluate((element, value) => element.setAttribute('data-e2e-trigger', value), tag);
  await handle.scrollIntoViewIfNeeded();
  await handle.click({ timeout: 8000 });
  await page.locator('.detail-drawer').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
  const geo = await page.evaluate(() => {
    const drawer = globalThis.document.querySelector('.detail-drawer');
    const rect = drawer.getBoundingClientRect();
    return {
      position: globalThis.getComputedStyle(drawer).position,
      top: Math.round(rect.top),
      rightGap: Math.round(globalThis.window.innerWidth - rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: globalThis.window.innerWidth,
      viewportHeight: globalThis.window.innerHeight,
    };
  });
  const focusInDialog = () =>
    page.evaluate(() => Boolean(globalThis.document.activeElement?.closest('[role="dialog"]')));
  const focusInitial = await focusInDialog();
  const drawerAudit = await page.evaluate(audit, { kind: 'drawer' });
  await page.screenshot({ path: join(shot.directory, `${tag}-drawer.png`) });
  const tabStops = [];
  for (let step = 0; step < tabs; step += 1) {
    await page.keyboard.press('Tab');
    tabStops.push(await focusInDialog());
  }
  await page.keyboard.press('Escape');
  const closed = await page
    .locator('.detail-drawer')
    .first()
    .waitFor({ state: 'detached', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  // 焦点归还发生在抽屉节点移除之后（实测约 30 毫秒），所以移除后最多再等 1 秒；等不到记为 null。
  const detached = performance.now();
  const focusRestoredMs = closed
    ? await page
        .waitForFunction(
          (value) => globalThis.document.activeElement?.getAttribute('data-e2e-trigger') === value,
          tag,
          { timeout: 1000 },
        )
        .then(() => Math.round(performance.now() - detached))
        .catch(() => null)
    : null;
  return { tag, geo, focusInitial, tabs: tabStops, closed, focusRestoredMs, ...drawerAudit };
}

async function main() {
  const { values } = parseArgs({
    options: {
      viewport: { type: 'string', default: 'desktop' },
      routes: { type: 'string' },
      out: {
        type: 'string',
        default: join(process.env.E2E_LOCAL_OUT ?? '/tmp/kingturf-e2e-local', 'walk'),
      },
      'max-drawers': { type: 'string', default: '5' },
      tabs: { type: 'string', default: '4' },
      base: { type: 'string', default: process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:4198' },
    },
  });
  const maxDrawers = Number(values['max-drawers']);
  const tabs = Number(values.tabs);
  assert(
    Number.isSafeInteger(maxDrawers) && maxDrawers >= 0 && Number.isSafeInteger(tabs) && tabs >= 0,
    '--max-drawers and --tabs must be non-negative integers',
  );
  const credentialsFile = process.env.KINGTURF_CREDS_FILE ?? '';
  assert(
    credentialsFile,
    'KINGTURF_CREDS_FILE is required (run through e2e-local.mjs, or point it at the creds.json written by bootstrap.mjs)',
  );
  const credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'));
  const out = resolve(values.out);
  assert(
    relative(REPOSITORY, out).startsWith('..'),
    `--out must be outside the repository: ${out}`,
  );
  const preset = parseViewport(values.viewport);
  const shot = {
    directory: join(out, preset.label, 'shots'),
    report: join(out, preset.label, 'report.json'),
  };
  mkdirSync(shot.directory, { recursive: true, mode: 0o700 });
  const requested = values.routes
    ? unique(
        values.routes
          .split(',')
          .map((route) => route.trim())
          .filter(Boolean),
      )
    : await defaultRoutes();

  const require = createRequire(new URL('../../package.json', import.meta.url));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  // 2026-11-24 修复：viewport 必须落在 newContext 的 viewport 键里——直接把
  // {width,height} 当选项传会被 Playwright 忽略并静默回落默认 1280x720（此前桌面
  // 1440 与移动 390 两档均未生效，截图与 innerWidth 量测都曾是默认视口）。
  const context = await browser.newContext({
    viewport: { width: preset.viewport.width, height: preset.viewport.height },
    ...(preset.deviceScaleFactor !== undefined
      ? { deviceScaleFactor: preset.deviceScaleFactor }
      : {}),
  });
  const page = await context.newPage();
  let errors = [];
  let net = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${String(error).slice(0, 300)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text().slice(0, 300)}`);
  });
  const recordResponse = (response) => {
    if (response.status() >= 400)
      net.push({
        method: response.request().method(),
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  };

  const started = Date.now();
  await page.goto(values.base);
  await page.getByPlaceholder('账号').fill(credentials.admin.login);
  await page.getByPlaceholder('密码').fill(credentials.admin.password);
  const login = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const loginResponse = await login;
  assert(loginResponse.ok(), `login failed with HTTP ${loginResponse.status()}`);
  // 登录前对会话的探测必然返回 401（控制台随之报一条资源加载失败），属预期，不计入首屏报错。
  errors = [];
  net = [];
  page.on('response', recordResponse);
  await page
    .locator('[data-nav-routes~="opportunities"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60000 });
  const timeToShellMs = Date.now() - started;
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  const navRoutes = await page.evaluate(() =>
    [...globalThis.document.querySelectorAll('[data-app-route]')].map((element) =>
      element.getAttribute('data-app-route'),
    ),
  );
  const firstPaint = {
    errors: unique(errors),
    net: unique(net.map((entry) => `${entry.method} ${entry.path} ${entry.status}`)),
    notice: await page.evaluate(() =>
      (globalThis.document.querySelector('main')?.innerText ?? '')
        .split('\n')
        .filter((line) => /暂不可用|加载失败/u.test(line))
        .slice(0, 5),
    ),
  };
  errors = [];
  net = [];
  console.log(
    `login ok; shell attached after ${timeToShellMs}ms; nav exposes ${navRoutes.length} routes; viewport ${preset.label} ${preset.viewport.width}x${preset.viewport.height}`,
  );
  console.log(
    `first paint: errors=${firstPaint.errors.length} api>=400=${firstPaint.net.length} notice=${JSON.stringify(firstPaint.notice)}`,
  );
  for (const line of firstPaint.errors.slice(0, 8)) console.log(`  first-paint error: ${line}`);
  for (const line of firstPaint.net.slice(0, 12)) console.log(`  first-paint api>=400: ${line}`);

  const report = {
    viewport: preset.label,
    viewportSize: preset.viewport,
    base: values.base,
    timeToShellMs,
    navRoutes,
    firstPaint,
    tabs,
    routes: [],
  };
  for (const route of requested) {
    const row = { route };
    const routeStarted = Date.now();
    if (!navRoutes.includes(route)) {
      // 账号导航里没有入口的路由不打开；显式点名时视为错误。
      row.skipped = 'not-in-nav';
      if (values.routes) row.ok = false;
      report.routes.push(row);
      console.log(
        `${values.routes ? 'ERR' : 'SKIP'} ${route.padEnd(26)} (no navigation entry for this account)`,
      );
      continue;
    }
    try {
      await openRoute(page, route);
      row.readyMs = Date.now() - routeStarted;
      row.audit = await page.evaluate(audit, { kind: 'page', route });
      const slug = route.replaceAll('/', '__');
      await page.screenshot({ path: join(shot.directory, `${slug}.png`), fullPage: true });
      row.screenshot = join(shot.directory, `${slug}.png`);
      row.triggers = await page.evaluate(pickTriggers, route);
      row.drawers = [];
      for (let index = 0; index < Math.min(row.triggers.length, maxDrawers); index += 1) {
        const key = row.triggers[index];
        const tag = `${slug}--${key
          .replace(/^kt-/u, '')
          .replace(/-open$/u, '')
          .replace(/^text:/u, 'view')}`;
        try {
          row.drawers.push(await checkDrawer(page, route, index, tag, { tabs, shot }));
        } catch (error) {
          row.drawers.push({ tag, error: String(error).slice(0, 200) });
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      }
      row.ok = true;
    } catch (error) {
      row.ok = false;
      row.error = String(error).slice(0, 400);
    }
    row.errors = unique(errors);
    row.net = unique(net.map((entry) => `${entry.method} ${entry.path} ${entry.status}`));
    errors = [];
    net = [];
    report.routes.push(row);
    const pageIssues = row.audit ? row.audit.issues.length : '-';
    const drawerIssues = (row.drawers ?? []).reduce(
      (total, drawer) => total + (drawer.issues?.length ?? 0),
      0,
    );
    console.log(
      `${row.ok ? 'ok ' : 'ERR'} ${route.padEnd(26)} ready=${String(row.readyMs ?? '-').padStart(5)}ms errors=${String(row.errors.length)} api>=400=${String(row.net.length)} pageIssues=${String(pageIssues)} drawerIssues=${String(drawerIssues)} drawers=${String((row.drawers ?? []).length)}${row.ok ? '' : ` :: ${row.error}`}`,
    );
  }
  const reached = report.routes.filter((item) => item.ok).length;
  const failed = report.routes.filter((item) => item.ok === false).length;
  report.summary = {
    requested: report.routes.length,
    reached,
    failed,
    skipped: report.routes.filter((item) => item.skipped).length,
  };
  writeFileSync(shot.report, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(
    `--- ${preset.label}: ${reached}/${report.routes.length} routes reached, ${failed} failed; report ${shot.report}`,
  );
  return failed === 0 ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`walk: ${String(error.message ?? error).slice(0, 400)}`);
    process.exitCode = 1;
  },
);
