import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import {
  diagnosticRequestAllowed,
  safeDiagnostic,
  safeDiagnosticResult,
} from './p1-diagnostics-contract.mjs';

// Independent read-only observations. Never imports or changes the original P1 spec/oracle.
export async function runP1Diagnostics(command, signal, report) {
  const started = performance.now();
  assert(
    !process.env.DEBUG && !process.env.PWDEBUG,
    'private diagnostics requires debug logging off',
  );
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    env: {
      ...process.env,
      TMPDIR: '/tmp',
      XDG_CACHE_HOME: '/tmp/cache',
      XDG_CONFIG_HOME: '/tmp/config',
      XDG_DATA_HOME: '/tmp/data',
      XDG_STATE_HOME: '/tmp/state',
      XDG_RUNTIME_DIR: '/tmp/runtime',
      CHROME_LOG_FILE: '/tmp/kingturf-private/chrome.log',
    },
  });
  const cancel = () => {
    void browser.close().catch(() => {
      /* Final close remains mandatory. */
    });
  };
  signal.addEventListener('abort', cancel, { once: true });
  const observed = [];
  let unexpectedWrites = 0;
  const emit = (id, values) => {
    signal.throwIfAborted();
    assert.equal(unexpectedWrites, 0, 'read-only diagnostic rejected an unexpected write');
    assert(!observed.includes(id), 'duplicate diagnostic');
    report('p1-diagnostic', {
      kind: command.kind,
      label: command.label,
      id,
      values: safeDiagnostic(id, values),
    });
    observed.push(id);
  };
  try {
    signal.throwIfAborted();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
    });
    await context.routeWebSocket('**/*', (socket) => {
      unexpectedWrites++;
      socket.close();
    });
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (diagnosticRequestAllowed(request.url(), request.method())) await route.continue();
      else {
        unexpectedWrites++;
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    await page.getByPlaceholder('账号').fill(command.user.login);
    await page.getByPlaceholder('密码').fill(command.user.password);
    const loggedIn = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    assert((await loggedIn).ok(), 'diagnostic login failed');
    await page.locator('.app-shell').waitFor();
    const openRoute = async (route) => {
      signal.throwIfAborted();
      const parent = page.locator(`[data-nav-routes~="${route}"]`);
      await parent.waitFor({ state: 'attached' });
      if ((await parent.isVisible()) && (await parent.getAttribute('aria-expanded')) !== 'true')
        await parent.click();
      await page.locator(`[data-app-route="${route}"]`).click();
      await page
        .locator(
          `.commercial-workspace > [data-route-view~="${route}"][data-commercial-data-state="ready"]`,
        )
        .first()
        .waitFor();
    };
    const contains = async (locator, expected) =>
      (await locator.allTextContents()).some((text) => text.includes(expected));
    const countVisible = async (locator) => {
      let count = 0;
      for (const element of await locator.all()) if (await element.isVisible()) count++;
      return count;
    };

    await openRoute('credit-review');
    const credit = page.locator('.credit-workbench .qtc-card').filter({ hasText: '申请 ¥950,000' });
    const approved = credit.filter({ hasText: '信用已批准' }),
      rejected = credit.filter({ hasText: '信用已拒绝' }),
      expired = credit.filter({ hasText: '信用已过期' });
    emit('credit', {
      cards: await credit.count(),
      approvedCards: await approved.count(),
      rejectedCards: await rejected.count(),
      expiredCards: await expired.count(),
      approvedExposure0: await contains(approved, '敞口 ¥0'),
      rejectedExposure450000: await contains(rejected, '敞口 ¥450,000'),
      rejectedExposure0: await contains(rejected, '敞口 ¥0'),
      expiredExposure450000: await contains(expired, '敞口 ¥450,000'),
      expiredExposure0: await contains(expired, '敞口 ¥0'),
      limits5000000: await credit.filter({ hasText: '额度 ¥5,000,000' }).count(),
    });

    await openRoute('production-orders');
    const production = page.locator('.production-workbench'),
      exactProduction = page.getByTestId('production-workbench');
    emit('production', {
      workbenches: await production.count(),
      visibleWorkbenches: await countVisible(production),
      exactTestIds: await exactProduction.count(),
      visibleTestIds: await countVisible(exactProduction),
    });

    await openRoute('order-360');
    const order = page.locator('.order-360-workbench'),
      cards = order.locator('.order-360-card').filter({ hasText: 'SO-KT-P1-DEMO' });
    const before = {
      cardsBeforeOpen: await cards.count(),
      rawReleased: await cards.getByText('¥950,000 · RELEASED', { exact: true }).count(),
      localizedReleased: await cards.getByText('¥950,000 · 已放行', { exact: true }).count(),
    };
    const opener = cards.getByRole('button', { name: '查看全链路证据', exact: true });
    const openButtons = await opener.count();
    if (openButtons === 1) {
      await opener.click();
      await order.locator('.order-360-detail .order-360-card').waitFor();
    }
    const detail = order.locator('.order-360-detail .order-360-card');
    let requiredEventCodes = 0;
    for (const code of [
      'OPPORTUNITY_CREATED',
      'QUOTE_ISSUED',
      'CREDIT_DECIDED',
      'CONTRACT_SIGNED',
      'ORDER_RELEASED',
      'AR_POSTED',
      'PAYMENT_RECEIVED',
      'COMMISSION_CLAWED_BACK',
      'RISK_EVALUATED',
      'RISK_TASK_CLOSED',
    ])
      if ((await detail.locator(`[title="事件编码：${code}"]`).count()) > 0) requiredEventCodes++;
    emit('order360', {
      ...before,
      openButtons,
      detailsAfterOpen: await detail.count(),
      originalCountPhrase: await contains(detail, '应收 1 · 回款 2 · 佣金 1 · 风险 1 · 证据 18'),
      timelineEntries: await detail.locator('.order-360-timeline li').count(),
      requiredEventCodes,
    });

    await openRoute('commissions');
    const commission = page.locator('.commission-workbench');
    emit('commission', {
      originalPolicyPins: await commission
        .locator('.version-pin')
        .filter({ hasText: 'COM-KT-P1-2026 V1' })
        .count(),
      localizedPolicyPins: await commission
        .locator('.version-pin')
        .filter({ hasText: 'COM-KT-P1-2026 第 1 版' })
        .count(),
      amount28500: await commission
        .locator('.commission-card')
        .filter({ hasText: 'SO-KT-P1-DEMO' })
        .getByText('¥28,500', { exact: true })
        .count(),
    });

    await openRoute('business-risks');
    const risk = page.locator('.risk-workbench .risk-card').filter({ hasText: 'SO-KT-P1-DEMO' });
    emit('risk', {
      rawSeverity45: await risk.getByText('HIGH 风险 · 45 分', { exact: true }).count(),
      localizedSeverity45: await risk.getByText('高风险 · 45 分', { exact: true }).count(),
      rawClosed: await risk.getByText('CLOSED', { exact: true }).count(),
      localizedClosed: await risk.getByText('已关闭', { exact: true }).count(),
      rawMarginRule: await contains(risk, 'LOW_MARGIN：实际 2410 / 门槛 2500'),
      localizedMarginRule: await contains(risk, '毛利率低于政策门槛：实际 2410 / 门槛 2500'),
    });

    await openRoute('overview');
    const dashboard = page.locator('.executive-dashboard');
    const numericValueIs = async (key, expected) => {
      const texts = await dashboard.locator(`.metric-${key} .metric-value`).allTextContents();
      if (texts.length !== 1) return false;
      const match = texts[0].match(/[+-]?\d[\d,]*(?:\.\d+)?/u)?.[0];
      return match !== undefined && Number(match.replaceAll(',', '')) === expected;
    };
    emit('dashboard', {
      oldBookedText: await contains(dashboard.locator('.metric-bookedRevenue'), 'CNY 2058608'),
      originalBookedNumber: await numericValueIs('bookedRevenue', 2058608),
      bookedUnitCny: await contains(
        dashboard.locator('.metric-bookedRevenue .metric-value'),
        'CNY',
      ),
      originalGrossMargin: await numericValueIs('grossMargin', 585399),
      originalCash: await numericValueIs('cashCollected', 1550000),
      originalReceivable: await numericValueIs('openReceivable', 508608),
    });

    await openRoute('manufacturing-master');
    const manufacturing = page.locator('.manufacturing-workbench');
    emit('manufacturing', {
      oldPublishedV1: await manufacturing.getByText('PUBLISHED · V1').count(),
      localizedPublishedV1: await manufacturing
        .getByText('已发布 · 第 1 版', { exact: true })
        .count(),
      versions: await manufacturing.locator('.manufacturing-version').count(),
    });
    assert.equal(unexpectedWrites, 0, 'read-only diagnostic rejected an unexpected write');
  } finally {
    signal.removeEventListener('abort', cancel);
    await browser.close();
  }
  signal.throwIfAborted();
  return safeDiagnosticResult(
    {
      exit: 0,
      complete: true,
      browserClosed: true,
      elapsedMs: Math.round(performance.now() - started),
      observed,
    },
    observed,
  );
}
