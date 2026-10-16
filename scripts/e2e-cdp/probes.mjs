import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createDriver } from './driver.mjs';
export { createStubRouter } from './fixtures.mjs';
import { syntheticSessionInit } from './fixtures.mjs';

export async function runProbes({ send, router, runId, report, expectDialog }) {
  const page = createDriver(send);
  const passed = [];
  const check = async (name, work) => {
    await work();
    passed.push(name);
    report('probe-pass', { name });
  };
  const reset = async () => {
    router.detailFailure(false);
    await send('Page.navigate', { url: 'about:blank' });
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#customers' });
    await page.waitFor(
      `!!document.querySelector('.app-shell .customer-row')`,
      'synthetic workspace',
    );
    await page.onlyRoute('customers');
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: syntheticSessionInit });
  try {
    await page.viewport(1440, 1000, false);
    await reset();
    if (process.argv.includes('--fault-hidden-target')) {
      await page.evaluate(
        `for(const node of document.querySelectorAll('[data-route-view]'))node.style.display='none'`,
      );
      await page.onlyRoute('customers');
      throw new Error('hidden route injection was not detected');
    }
    await check('synthetic-workspace-text', async () => {
      await page.text('.crm-records .customer-row .identity', 'CDP客户甲');
      await page.noOverflow();
    });
    await check('form-open-fill-cancel-confirmation', async () => {
      await page.route('overview');
      await page.evaluate(
        `(() => {const button=[...document.querySelectorAll('button')].find(n=>n.textContent==='＋ 新建客户');if(!button)throw Error('missing customer-create button');button.dataset.cdpCreate='true';})()`,
      );
      await page.click('[data-cdp-create="true"]');
      await page.text('.form-dialog[open] h2', '新建客户');
      await page.fill('.form-dialog[open] [name="name"]', 'CDP未保存客户');
      await page.fill('.form-dialog[open] [name="customerNumber"]', 'CDP-UNSAVED');
      const valuesRemain = `(() => {const form=document.querySelector('.form-dialog[open] form');return !!form&&form.elements.namedItem('name').value==='CDP未保存客户'&&form.elements.namedItem('customerNumber').value==='CDP-UNSAVED'&&form.elements.namedItem('name').required&&form.elements.namedItem('name').minLength===2&&form.elements.namedItem('customerNumber').required;})()`;
      assert.equal(await page.evaluate(valuesRemain), true, 'real filled form must remain bound');
      await Promise.all([
        expectDialog(false),
        page.click('.form-dialog[open] .dialog-actions .secondary'),
      ]);
      assert.equal(await page.evaluate(valuesRemain), true, 'declined cancel must preserve values');
      await Promise.all([
        expectDialog(true),
        page.click('.form-dialog[open] .dialog-actions .secondary'),
      ]);
      await page.waitFor(`!document.querySelector('.form-dialog')`, 'accepted cancel removes form');
      await page.onlyRoute('overview');
      await page.route('customers');
      await page.onlyRoute('customers');
      await page.noOverflow();
    });
    await check('CRM-filter-preserves-commercial-and-menu', async () => {
      await page.evaluate(
        `globalThis.__cdpIdentity={workspace:document.querySelector('.commercial-workspace'),menu:[...document.querySelectorAll('[data-app-route]')],costInput:document.querySelector('.cost-matrix-search')}`,
      );
      assert.equal(
        await page.evaluate(
          `!!globalThis.__cdpIdentity.workspace&&!!globalThis.__cdpIdentity.costInput&&globalThis.__cdpIdentity.menu.length>0`,
        ),
        true,
        'identity probe must bind real nodes',
      );
      await page.fill('[placeholder="搜索客户名称或编号"]', 'CDP客户甲');
      await page.waitFor(`document.querySelectorAll('.customer-row').length===1`, 'CRM filter');
      assert.equal(
        await page.evaluate(
          `(() => {const input=document.querySelector('[placeholder="搜索客户名称或编号"]');return document.activeElement===input&&input.selectionStart===6&&input.selectionEnd===6;})()`,
        ),
        true,
        'CRM input focus/selection was not restored',
      );
      assert.equal(
        await page.evaluate(
          `(() => {const old=globalThis.__cdpIdentity;const menu=[...document.querySelectorAll('[data-app-route]')];return old.workspace===document.querySelector('.commercial-workspace')&&old.costInput===document.querySelector('.cost-matrix-search')&&menu.length===old.menu.length&&menu.every((n,i)=>n===old.menu[i])&&document.querySelector('[placeholder="搜索客户名称或编号"]').value==='CDP客户甲';})()`,
        ),
        true,
        'unrelated DOM identity or CRM input value changed',
      );
      await page.route('costing');
      await page.route('customers');
      assert.equal(
        await page.evaluate(
          `document.querySelector('[placeholder="搜索客户名称或编号"]').value==='CDP客户甲'`,
        ),
        true,
      );
    });
    await check('desktop-mobile-route-text-overflow', async () => {
      for (const metrics of [
        [390, 844, true],
        [1440, 1000, false],
      ]) {
        await page.viewport(...metrics);
        await page.waitFor(
          `document.querySelector('.app-shell')?.classList.contains(${JSON.stringify(metrics[2] ? 'mobile' : 'desktop')})===true`,
          'live viewport shell class',
        );
        await page.noOverflow();
        await reset();
        for (const route of ['customers', 'costing', 'quotes']) {
          await page.route(route);
          await page.text(
            '[data-route-context] h1',
            { customers: '客户', costing: '成本', quotes: '报价' }[route],
          );
          await page.noOverflow();
        }
      }
    });
    await check('late-cost-never-paints-on-quotes', async () => {
      await page.route('costing');
      const hold = router.hold('cost', 'CDP慢请求');
      await page.fill('.cost-matrix-search', 'CDP慢请求');
      await Promise.race([
        hold.started,
        delay(3500).then(() => {
          throw new Error('cost hold not reached');
        }),
      ]);
      await page.route('quotes');
      await page.evaluate(
        `globalThis.__cdpPaint={running:true,frames:0,leaks:0};requestAnimationFrame(function tick(){const p=globalThis.__cdpPaint;p.frames++;for(const n of document.querySelectorAll('[data-route-view]'))if(!(n.dataset.routeView??'').split(/\\s+/).includes('quotes')&&n.getClientRects().length)p.leaks++;if(p.running)requestAnimationFrame(tick);})`,
      );
      hold.release();
      await Promise.race([
        hold.fulfilled,
        delay(3500).then(() => {
          throw new Error('cost Fetch fulfillment did not complete');
        }),
      ]);
      const framesAtFulfillment = await page.evaluate(`globalThis.__cdpPaint.frames`);
      await delay(350);
      assert.equal(
        await page.evaluate(`globalThis.__cdpPaint.frames>=${framesAtFulfillment + 2}`),
        true,
        'paint probe must observe real animation frames',
      );
      assert.equal(
        await page.evaluate(`globalThis.__cdpPaint.running=false;globalThis.__cdpPaint.leaks`),
        0,
        'non-target view painted',
      );
      assert.equal(
        await page.evaluate(`document.querySelector('.cost-matrix-search')?.value==='CDP慢请求'`),
        true,
        'late cost response must preserve search value',
      );
      await page.onlyRoute('quotes');
    });
    await check('late-customer-detail-keeps-cost-and-menu', async () => {
      await reset();
      const hold = router.hold('detail');
      await page.click('.customer-row');
      await Promise.race([
        hold.started,
        delay(3500).then(() => {
          throw new Error('detail hold not reached');
        }),
      ]);
      await page.route('costing');
      const menu = await page.evaluate(`document.querySelectorAll('[data-app-route]').length`);
      hold.release();
      await Promise.race([
        hold.fulfilled,
        delay(3500).then(() => {
          throw new Error('detail Fetch fulfillment did not complete');
        }),
      ]);
      await page.text('.crm-records .detail h2', 'CDP客户甲', { visible: false });
      await page.onlyRoute('costing');
      assert.equal(
        await page.evaluate(`document.querySelectorAll('[data-app-route]').length`),
        menu,
      );
      assert.equal(
        await page.evaluate(
          `!!document.querySelector('.cost-matrix-search')?.getClientRects().length`,
        ),
        true,
      );
    });
    await check('customer503-is-local-and-menu-remains', async () => {
      await reset();
      router.detailFailure(true);
      await page.click('.customer-row');
      await page.text('.crm-records [role="alert"]', 'CDP合成服务暂不可用');
      await page.onlyRoute('customers');
      await page.route('costing');
      await page.onlyRoute('costing');
    });
    if (process.argv.includes('--sales-views')) {
      for (const [route, title, selector, record] of [
        ['opportunities', '销售商机', '.pipeline-board .opportunity-card', 'CDP商机甲'],
        ['technical-requirements', '技术需求', '.ctr-workbench .ctr-row', 'CDP-CTR-A'],
        ['technical-solutions', '技术方案', '.solution-workbench .solution-card', 'CDP-TS-A'],
      ])
        await check(`sales-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            await page.route(route);
            await page.text('[data-route-context] h1', title);
            await page.text(selector, record);
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--pricing-views')) {
      for (const [route, title, selector, record] of [
        [
          'costing',
          '成本核算',
          '.cost-matrix-ledger-row .cost-matrix-ledger-link',
          'CDP规格模型甲',
        ],
        ['sales-policies', '销售政策', '.policy-workbench .definition-card', 'CDP-SP-A'],
        ['quotes', '销售报价', '.quote-workbench .quote-card', 'CDP-Q-A'],
      ])
        await check(`pricing-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            await page.route(route);
            await page.text('[data-route-context] h1', title);
            await page.text(selector, record);
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--credit-contract-views')) {
      const agreementText = async (selector, expected) => {
        try {
          await page.text(selector, expected);
        } catch (error) {
          const state = await page.evaluate(
            `(() => {const node=document.querySelector(${JSON.stringify(selector)});return {selector:${JSON.stringify(selector)},present:!!node,matches:!!node?.textContent.includes(${JSON.stringify(expected)}),visible:!!node?.getClientRects().length,hash:location.hash};})()`,
          );
          throw new Error(`${error.message}; agreement target ${JSON.stringify(state)}`);
        }
      };
      for (const [route, title, selector, record] of [
        ['credit-review', '信用审查', '.credit-workbench .qtc-card', '信用已批准'],
        ['contracts', '合同管理', '.contract-workbench .qtc-card', 'CDP-C-A'],
      ])
        await check(`credit-contract-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            await page.route(route);
            await agreementText('[data-route-context] h1', title);
            await agreementText(selector, record);
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--fulfillment-views')) {
      for (const [route, title, selector, record] of [
        ['sales-orders', '销售订单', '.order-workbench .qtc-card', 'CDP-SO-A'],
        ['order-360', '订单全景', '.order-360-list > .order-360-card', 'CDP-SO-A'],
        [
          'production-orders',
          '生产执行',
          '[data-testid="production-workbench"] .production-order-card',
          'CDP-PROD-A',
        ],
        ['shipments', '发货与签收', '.shipment-workbench .production-order-card', 'CDP-SHIP-A'],
      ])
        await check(`fulfillment-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            await page.route(route);
            await page.text('[data-route-context] h1', title);
            await page.text(selector, record);
            if (route === 'production-orders')
              await page.text(
                '[data-testid="manufacturing-cost-workbench"] .production-order-card',
                'CDP-COST-A',
              );
            if (route === 'order-360') {
              const toggle = '.order-360-list > .order-360-card > button';
              await page.click(toggle);
              await page.text('.order-360-detail .order-360-timeline li', '2026-10-16');
              await page.noOverflow();
              await page.click(toggle);
            }
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--finance-risk-views')) {
      for (const [route, title, selector, record] of [
        ['receivables', '应收账款', '.ar-workbench .qtc-card', 'CDP-AR-A'],
        ['collections', '催收与法务', '.collection-case-card', 'CDP-COL-A'],
        ['payments', '收款与核销', '.payment-workbench .qtc-card', 'CDP-BANK-A'],
        ['commissions', '销售佣金', '.commission-card', 'CDP-SO-A'],
        ['business-risks', '业务风险', '.risk-card', 'CDP-SO-A'],
      ])
        await check(`finance-risk-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            await page.route(route);
            await page.text('[data-route-context] h1', title);
            await page.text(selector, record);
            if (route === 'payments')
              await page.text('.payment-workbench > .version-pin', 'CDP-RECON-A');
            if (route === 'commissions') {
              await page.text('.commission-policy-card', 'CDP-COM-POLICY-A');
              await page.text('.commission-ledger li', 'CDP计提证据');
            }
            if (route === 'business-risks') {
              await page.text('.risk-task-timeline li', 'CDP风险证据');
              if (process.argv.includes('--fulfillment-views'))
                await page.text(
                  '.risk-workbench .risk-policy-controls .version-card',
                  'CDP-RISK-POLICY-A',
                );
            }
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--operations-views')) {
      for (const [route, title, cards] of [
        [
          'manufacturing-master',
          '制造主数据',
          [
            ['.manufacturing-card:nth-child(1) .manufacturing-version', 'CDP-FG-A'],
            ['.manufacturing-card:nth-child(2) .manufacturing-version', 'CDP-BOM-A'],
            ['.manufacturing-card:nth-child(3) .manufacturing-version', 'CDP-RT-A'],
          ],
        ],
        [
          'procurement',
          '采购管理',
          [
            ['.supplier-register .procurement-card', 'CDP-SUP-A'],
            ['.sourcing-register .procurement-card:not(.quote-card)', 'CDP-RFQ-A'],
            ['.sourcing-register .quote-card', 'CDP-SQ-A'],
            ['.purchase-order-card', 'CDP-PO-A'],
            ['.purchase-register', 'CDP-GR-A'],
            ['.inventory-balance-card', 'CDP-LOT-A'],
          ],
        ],
        [
          'material-planning',
          '物料计划',
          [
            ['.mrp-policy-card', 'CDP-FG-A'],
            ['.mrp-run-card h3', 'CDP-MRP-A'],
            ['.mrp-proposal-card', 'CDP-FG-A'],
          ],
        ],
        [
          'quality-inspection',
          '质量检验',
          [
            ['.quality-plan-card', 'CDP-QP-A'],
            ['.quality-plan-card', '最终检验'],
            ['.quality-inspection-card', 'CDP-QI-A'],
            ['.traceability-card', 'CDP-LOT-A'],
            ['.complaint-ledger tbody tr', 'CDP-COMPLAINT-A'],
          ],
        ],
      ])
        await check(`operations-view-${route}-desktop-mobile`, async () => {
          for (const metrics of [
            [390, 844, true],
            [1440, 1000, false],
          ]) {
            await page.viewport(...metrics);
            try {
              await page.route(route);
            } catch (error) {
              if (process.argv.includes('--trace-operations-failure'))
                console.log(
                  JSON.stringify({
                    kind: 'operations-navigation-failure',
                    route,
                    metrics,
                    state: await page.evaluate(`(() => {
                    const node=globalThis.__cdpClickTarget;
                    const rect=node?.getBoundingClientRect();
                    const x=rect?rect.x+rect.width/2:0,y=rect?rect.y+rect.height/2:0;
                    const hit=document.elementFromPoint(x,y);
                    return {hash:location.hash,innerWidth,innerHeight,scrollX,scrollY,
                      target:node?{tag:node.tagName,route:node.dataset.appRoute,parent:node.dataset.navRoutes,connected:node.isConnected,expanded:node.getAttribute('aria-expanded'),rect:rect?.toJSON()}:null,
                      hit:hit?{tag:hit.tagName,className:hit.className,route:hit.closest('[data-app-route]')?.dataset.appRoute,parent:hit.closest('.nav-parent')?.dataset.navRoutes}:null,
                      groups:[...document.querySelectorAll('.sidebar .nav-children')].map(group=>({routes:[...group.querySelectorAll('[data-app-route]')].map(n=>n.dataset.appRoute),rect:group.getBoundingClientRect().toJSON(),scrollTop:group.scrollTop,scrollHeight:group.scrollHeight,overflow:getComputedStyle(group).overflow,maxHeight:getComputedStyle(group).maxHeight})),
                      animations:document.getAnimations().map(a=>({state:a.playState,pending:a.pending,transition:a.transitionProperty,target:a.effect?.target?.className}))};
                  })()`),
                  }),
                );
              throw error;
            }
            await page.text('[data-route-context] h1', title);
            for (const [selector, record] of cards) await page.text(selector, record);
            await page.noOverflow();
          }
        });
    }
    if (process.argv.includes('--dashboard-view'))
      await check('dashboard-read-view-desktop-mobile', async () => {
        for (const metrics of [
          [390, 844, true],
          [1440, 1000, false],
        ]) {
          await page.viewport(...metrics);
          await page.route('overview');
          await page.text('.executive-dashboard h2', '管理驾驶舱');
          await page.text('.executive-dashboard .metric-bookedRevenue', '25000');
          await page.text('.executive-dashboard .dashboard-list:first-child', 'CDP-DASH-SO-A');
          await page.text('.executive-dashboard .dashboard-list:last-child', '45 分');
          await page.noOverflow();
        }
      });
    if (process.argv.includes('--register-tools')) {
      const { runRegisterProbes } = await import('./register-probes.mjs');
      await runRegisterProbes({ page, send, router, check });
    }
    if (process.argv.includes('--document-editor')) {
      const { runDocumentEditorProbes } = await import('./document-editor-probes.mjs');
      try {
        await runDocumentEditorProbes({ page, send, router, check });
      } catch (error) {
        report('document-editor-failure', {
          state: await page.evaluate(`(() => {
            const node=globalThis.__cdpClickTarget,rect=node?.getBoundingClientRect(),x=rect?rect.x+rect.width/2:0,y=rect?rect.y+rect.height/2:0,hit=document.elementFromPoint(x,y);
            const describe=n=>n?{tag:n.tagName,className:n.className,version:n.dataset.cdpDocumentVersion??null,rect:n.getBoundingClientRect().toJSON(),display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility,scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight}:null;
            return {innerWidth,innerHeight,target:describe(node),hit:describe(hit),workspace:describe(document.querySelector('.business-document-dialog[open] .business-document-workspace')),history:describe(document.querySelector('.business-document-dialog[open] .business-document-history')),ancestors:(()=>{const out=[];for(let parent=node?.parentElement;parent;parent=parent.parentElement)out.push(describe(parent));return out;})()};
          })()`),
        });
        throw error;
      }
    }
    if (process.argv.includes('--governance-view')) {
      const { runGovernanceProbes } = await import('./governance-probes.mjs');
      await runGovernanceProbes({ page, send, router, check });
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`/tmp/${runId}-probes.png`, Buffer.from(screenshot.data, 'base64'));
    return {
      cases: passed.length,
      categories: page.counts,
      requests: router.counts(),
      screenshot: `/tmp/${runId}-probes.png`,
      notCovered: [
        'SQL',
        'real API',
        'real-account security matrix',
        'Playwright specs',
        'all 21 business views',
      ],
    };
  } finally {
    router.releaseAll();
  }
}
