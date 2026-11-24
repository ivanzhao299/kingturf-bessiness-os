// 写流程冒烟的浏览器操作封装（在 Playwright 容器内执行）：导航、抽屉、表单、提交并等待写响应、
// 列表行、只读佐证、错误与提示采集、截图。写操作一律经界面触发；接口只用于只读佐证，以及信用流程里
// 明确标注的前置数据（见 write-smoke.mjs）。
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const tid = (id) => `[data-testid="${id}"]`;
const squash = (text) =>
  String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim();

/** 等页面上正在运行的 CSS 过渡 / 动画结束（导航分组展开是 220ms 的 max-height 过渡）。 */
export const settle = (page) =>
  page.evaluate(() =>
    Promise.all(
      globalThis.document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

const ready = (page) =>
  page
    .locator('[data-nav-routes~="opportunities"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60000 });

/** 登录合成账号并等工作区外壳挂载。返回登录响应状态码。 */
export async function login(page, base, account) {
  await page.goto(base);
  await page.getByPlaceholder('账号').fill(account.login);
  await page.getByPlaceholder('密码').fill(account.password);
  const waiting = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const response = await waiting;
  if (!response.ok())
    throw new Error(`login as ${account.login} failed with HTTP ${response.status()}`);
  await ready(page);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  return response.status();
}

/** 经侧栏进入路由，等路由视图就绪（与 walk.mjs 的 openRoute 同款）。 */
export async function openRoute(page, route) {
  const parent = page.locator(`[data-nav-routes~="${route}"]`).first();
  await parent.waitFor({ state: 'attached', timeout: 20000 });
  if ((await parent.isVisible()) && (await parent.getAttribute('aria-expanded')) !== 'true') {
    await parent.click();
    await settle(page);
  }
  await page.locator(`[data-app-route="${route}"]`).first().click({ timeout: 10000 });
  await page
    .locator(`[data-route-view~="${route}"]`)
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** 整页刷新后重新进入路由。表单的下拉选项是页面挂载时的快照（WS-P2-04），只有刷新才会重新加载。 */
export async function reloadRoute(page, route) {
  await page.reload();
  await ready(page);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  await openRoute(page, route);
}

/** 当前可见的抽屉（新建与详情都是同一个 DetailDrawer）。 */
export const drawer = (page) =>
  page.locator('.detail-drawer[role="dialog"]').filter({ visible: true }).last();

export const drawerTitle = async (page) =>
  squash(await drawer(page).locator('h2').first().innerText());

export const drawerText = async (page, max = 600) =>
  squash(await drawer(page).locator('.drawer-body').innerText()).slice(0, max);

export async function closeDrawer(page) {
  const handle = drawer(page);
  if ((await handle.count()) === 0) return;
  await handle.locator('.drawer-close').click({ timeout: 8000 });
  await handle.waitFor({ state: 'detached', timeout: 8000 });
}

/** 页面级（不在抽屉里的）按钮 / 输入框的 locator。带 :visible：不同控制台之间 data-testid 会撞名
 *  （c570dcb 起生产工单与采购订单共用 kt-po-create 等 7 个，WS-P3-09），隐藏路由里的同名元素不算。 */
const onPage = (page, testid) => page.locator(`${tid(testid)}:visible`);

/** 按 data-testid 点击。scope 缺省：抽屉开着且里面有这个按钮就点抽屉里的，否则点页面上可见的
 *  （工具栏的「新建」、筛选、刷新等不在抽屉里）；也可传 'page' 或一个 locator。nth 用于同名按钮。 */
export async function click(page, testid, { scope, nth = 0 } = {}) {
  if (scope)
    return (scope === 'page' ? page : scope).locator(tid(testid)).nth(nth).click({ timeout: 8000 });
  const inside = drawer(page).locator(tid(testid));
  const root = (await inside.count()) > nth ? inside : onPage(page, testid);
  return root.nth(nth).click({ timeout: 8000 });
}

/** 抽屉表单里填一个字段。select 的 how：label（精确）/ contains（包含）/ value / index；其余控件填值后失焦。 */
export async function fill(page, name, value, how = 'label') {
  const field = drawer(page).locator(`[name="${name}"]`).first();
  await field.waitFor({ state: 'visible', timeout: 8000 });
  if ((await field.evaluate((element) => element.tagName.toLowerCase())) !== 'select') {
    await field.fill('');
    await field.fill(String(value));
    await field.press('Tab').catch(() => undefined);
    return field;
  }
  if (how === 'value') await field.selectOption({ value });
  else if (how === 'index') await field.selectOption({ index: Number(value) });
  else if (how === 'contains') {
    const index = (await options(page, name)).findIndex((option) => option.label.includes(value));
    if (index < 0) throw new Error(`no option of ${name} contains "${value}"`);
    await field.selectOption({ index });
  } else await field.selectOption({ label: value });
  return field;
}

/** 抽屉里某个 select 的选项：[{ label, value, selected }]。页内函数须自包含，不能引用模块级标识。 */
export const options = (page, name) =>
  drawer(page)
    .locator(`select[name="${name}"]`)
    .first()
    .evaluateAll((selects) =>
      [...selects[0].options].map((option) => ({
        label: (option.textContent ?? '').replace(/\s+/gu, ' ').trim(),
        value: option.value,
        selected: option.selected,
      })),
    );

/** 抽屉表单里以 suffix 结尾的字段名，按文档顺序（如 r3:component、o2:operationCode）。
 *  行前缀的序号来自页面级计数器，同一页面第二次打开表单时不一定从 2 / 1 开始，不要写死。 */
export const fieldNames = (page, suffix) =>
  drawer(page)
    .locator(`[name$="${suffix}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('name')));

/** 抽屉里当前值是空串的必填下拉（WS-P2-06 的观测点）。 */
export const blankRequiredSelects = (page) =>
  drawer(page)
    .locator('select[required]')
    .evaluateAll((selects) =>
      selects.filter((select) => select.value === '').map((select) => select.getAttribute('name')),
    );

/** 抽屉表单里通不过浏览器原生校验的控件。 */
export const invalidControls = (page) =>
  drawer(page)
    .locator('form.form-section')
    .first()
    .evaluate((form) =>
      [...form.elements]
        .filter((control) => control.willValidate && !control.validity.valid)
        .map((control) => ({
          name: control.getAttribute('name'),
          message: control.validationMessage,
        })),
    )
    .catch(() => []);

const matcher = (match) => (request) => {
  if (request.method() !== match.method) return false;
  try {
    return match.path.test(new URL(request.url()).pathname);
  } catch {
    return false;
  }
};

const describe = (request, blocked) => ({
  sent: request !== null,
  method: request?.method() ?? '',
  path: request ? new URL(request.url()).pathname : '',
  status: 0,
  ok: false,
  body: null,
  error: '',
  blocked,
});

const finish = async (request, blocked) => {
  if (!request) return describe(null, blocked);
  const response = await Promise.race([request.response(), delay(30000).then(() => null)]);
  const result = describe(request, blocked);
  if (!response) {
    result.error = 'no response within 30s';
    return result;
  }
  result.status = response.status();
  result.ok = response.ok();
  result.body = await response.json().catch(() => null);
  result.error = squash(result.body?.error?.message ?? '');
  return result;
};

/** 触发一个操作并等它发出的写请求。界面没发请求时 sent=false，并带回被原生校验拦下的控件。 */
async function sendAndWait(page, trigger, match) {
  const started = page.waitForRequest(matcher(match), { timeout: 6000 }).catch(() => null);
  await trigger();
  const request = await started;
  return finish(request, request ? undefined : await invalidControls(page));
}

/** 只点抽屉表单的提交按钮，不等响应（配合 countRequests 使用）。clicks=2 即双击。 */
export const clickSubmit = (page, label, clicks = 1) => {
  const button = drawer(page)
    .locator('form.form-section button[type="submit"]')
    .filter({ hasText: label })
    .first();
  return clicks === 1
    ? button.click({ timeout: 8000 })
    : button.click({ timeout: 8000, clickCount: clicks, delay: 40 });
};

/** 点抽屉表单的提交按钮并等写响应。 */
export const submit = (page, label, match) =>
  sendAndWait(page, () => clickSubmit(page, label), match);

/** 页面上可见的确认对话框（role=alertdialog 或已打开的 dialog）。当前各控制台都不弹确认框。 */
export async function confirmDialog(page) {
  const dialog = page
    .locator('[role="alertdialog"], dialog[open]')
    .filter({ visible: true })
    .last();
  await dialog.waitFor({ state: 'visible', timeout: 600 }).catch(() => undefined);
  if ((await dialog.count()) === 0) return null;
  return {
    text: squash(await dialog.innerText()).slice(0, 200),
    button: dialog.locator('button.primary, button[class*="primary"]').first(),
  };
}

/** 点一个动作按钮并等写响应；若弹出确认对话框则记录文字并点确认。 */
export async function act(page, testid, match, { scope } = {}) {
  const root = scope === 'page' ? page : (scope ?? drawer(page));
  const started = page.waitForRequest(matcher(match), { timeout: 6000 }).catch(() => null);
  await root.locator(tid(testid)).first().click({ timeout: 8000 });
  const dialog = await confirmDialog(page);
  let confirm;
  if (dialog) {
    confirm = dialog.text;
    await dialog.button.click({ timeout: 5000 });
  }
  return { ...(await finish(await started, undefined)), confirm };
}

/** 触发后 windowMs 内匹配的写请求个数（防重复提交的检查）。 */
export async function countRequests(page, trigger, match, windowMs = 3000) {
  const found = [];
  const record = (request) => {
    if (matcher(match)(request)) found.push(request);
  };
  page.on('request', record);
  await trigger();
  await delay(windowMs);
  page.off('request', record);
  const statuses = [];
  for (const request of found)
    statuses.push((await request.response().catch(() => null))?.status() ?? 0);
  return statuses;
}

// ── 列表行 ──────────────────────────────────────────────────────────────────
const rowLocator = (page, openTestid, text) => {
  const rows = page.locator(`tr[data-row-id]:has(${tid(openTestid)}):visible`);
  return text === undefined ? rows : rows.filter({ hasText: text });
};

/** 带某个「查看」按钮 testid 的全部列表行：[{ id, text }]。 */
export const rows = (page, openTestid) =>
  rowLocator(page, openTestid).evaluateAll((elements) =>
    elements.map((row) => ({
      id: row.getAttribute('data-row-id'),
      text: (row.innerText || '').replace(/\s+/gu, ' ').trim(),
    })),
  );

/** 等包含指定文字的行出现（或 gone=true 时消失），返回该行文字。超时返回 null。 */
export async function waitRow(page, openTestid, text, { gone = false, timeout = 10000 } = {}) {
  const target = rowLocator(page, openTestid, text).first();
  const outcome = await target
    .waitFor({ state: gone ? 'detached' : 'visible', timeout })
    .then(() => true)
    .catch(() => false);
  if (!outcome) return null;
  return gone ? '' : squash(await target.innerText());
}

/** 某一行的 locator：带「查看」按钮 testid 且包含指定文字的第一行。 */
export const row = (page, openTestid, text) => rowLocator(page, openTestid, text).first();

const openHandle = async (page, button) => {
  await button.scrollIntoViewIfNeeded({ timeout: 10000 });
  await button.click({ timeout: 10000 });
  await drawer(page).waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  return drawerText(page, 200);
};

/** 点某一行的「查看」，等抽屉出现，返回抽屉正文开头。 */
export const openRow = (page, openTestid, text) =>
  openHandle(page, row(page, openTestid, text).locator(tid(openTestid)));

/** 按 data-row-id 打开某一行的「查看」（行文字无法区分时用）。 */
export const openRowById = (page, openTestid, rowId) =>
  openHandle(page, page.locator(`tr[data-row-id="${rowId}"] ${tid(openTestid)}`).first());

/** 等包含 text 的那一行里出现符合 pattern 的状态文字（同页其它行可能有相同状态，所以按行定位），返回该行文字。 */
export async function waitRowMatch(page, openTestid, text, pattern, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  let current = '';
  while (Date.now() < deadline) {
    current = (
      await row(page, openTestid, text)
        .innerText()
        .catch(() => '')
    ).replace(/\s+/gu, ' ');
    if (pattern.test(current)) return current.trim();
    await page.waitForTimeout(400);
  }
  return null;
}

/** 抽屉里某个控件的当前值。 */
export const value = (page, name) =>
  drawer(page).locator(`[name="${name}"]`).first().inputValue({ timeout: 8000 });

/** 搜索框里输入；enter=true 时按回车（制造域三个控制台的搜索是回车触发）。 */
export async function search(page, testid, text, { enter = false } = {}) {
  const box = onPage(page, testid).first();
  await box.fill('');
  await box.fill(text);
  if (enter) await box.press('Enter');
  await page.waitForTimeout(500);
}

// ── 抽屉里的状态与错误 ──────────────────────────────────────────────────────
/** 抽屉里（selector 缺省取第一个状态徽章）的状态文字。 */
export const badge = async (page, selector = '.status-badge') =>
  drawer(page)
    .locator(selector)
    .first()
    .innerText()
    .then(squash)
    .catch(() => '');

/** 等抽屉里出现包含指定文字的状态徽章。 */
export const waitBadge = async (page, selector, text, timeout = 8000) =>
  drawer(page)
    .locator(selector)
    .filter({ hasText: text })
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

/** 抽屉里可见的错误文字（console-error / 非空 form-error / role=alert），用「 | 」连接。 */
export async function visibleError(page) {
  const handle = drawer(page);
  const scope = (await handle.count()) > 0 ? handle : page;
  return scope
    .locator('.console-error, .form-error, [role="alert"], .data-table-error')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (node.textContent || '').trim() !== '';
        })
        .map((node) => (node.textContent || '').replace(/\s+/gu, ' ').trim())
        .join(' | '),
    );
}

/** 第一个可见错误的位置：是否落在视口内（WS-P2-10 的观测点）。没有可见错误时返回 null。 */
export const errorPosition = (page) =>
  page.evaluate(() => {
    const node = [
      ...globalThis.document.querySelectorAll('.console-error, .form-error, [role="alert"]'),
    ].find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() !== '';
    });
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      text: (node.textContent || '').trim(),
      top: Math.round(rect.top),
      inViewport: rect.bottom > 0 && rect.top < globalThis.window.innerHeight,
    };
  });

/** 写成功后页面上可见的成功类提示文字（toast / role=status）。没有则返回空串。 */
export async function successNotice(page) {
  await page.waitForTimeout(400);
  return page
    .locator('[role="status"], .toast, .console-success, .commercial-status')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            !node.classList.contains('empty-state') &&
            !node.classList.contains('data-table-loading') &&
            (node.textContent || '').trim() !== ''
          );
        })
        .map((node) => (node.textContent || '').replace(/\s+/gu, ' ').trim())
        .join(' | '),
    );
}

// ── 佐证读取 ────────────────────────────────────────────────────────────────
/** 以当前登录会话只读访问接口（GET）。 */
export const apiGet = (page, path) =>
  page.evaluate(async (target) => {
    const response = await fetch(target);
    return { status: response.status, body: await response.json().catch(() => null) };
  }, path);

/** 令牌登录的只读 / 前置数据客户端（与 scripts/seed_p1_demo.mjs 同款）。口令与令牌不落日志。 */
export function createTokenApi(base, account) {
  let token = '';
  const call = async (path, body) => {
    if (!token) {
      const response = await fetch(`${base}/api/v1/auth/token-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: account.login, password: account.password }),
      });
      if (response.status !== 200)
        throw new Error(`token-login as ${account.login} failed (${response.status})`);
      token = (await response.json()).token;
    }
    const response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json', 'idempotency-key': randomUUID() } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.json().catch(() => null),
    };
  };
  return { get: (path) => call(path), post: (path, body) => call(path, body) };
}

// ── 杂项 ────────────────────────────────────────────────────────────────────
export const hasCjk = (text) => /[\u3400-\u9fff]/u.test(String(text ?? ''));

/** 写结果进报告前的摘要（不含口令；只保留错误消息，不保留整个响应体）。 */
export const brief = (result) =>
  result === null || result === undefined
    ? null
    : {
        sent: result.sent,
        request: result.sent ? `${result.method} ${result.path}` : '(未发出请求)',
        status: result.status || null,
        ok: result.ok === true,
        error: result.error || null,
        blocked: result.blocked?.length > 0 ? result.blocked : undefined,
        confirm: result.confirm,
      };

export const screenshot = async (page, directory, name) => {
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path, fullPage: false }).catch(() => undefined);
  return path;
};
