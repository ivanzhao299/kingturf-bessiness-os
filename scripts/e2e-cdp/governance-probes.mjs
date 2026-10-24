import assert from 'node:assert/strict';
import { governancePaths, governanceSurfaces } from './governance-fixtures.mjs';

export async function runGovernanceProbes({ page, send, router, check }) {
  const root = '.governance-workspace';
  const panel = (id) => `${root} [data-cdp-governance="${id}"]`;
  const snapshot = router.counts();
  assert.equal(governancePaths.length, 20);
  for (const path of governancePaths)
    assert.ok(snapshot[`governance:${path}`] > 0, 'each exact governance read was consumed');
  await check('governance-readonly-surfaces-and-metrics-desktop-mobile', async () => {
    for (const metrics of [
      [390, 844, true],
      [1440, 1000, false],
    ]) {
      await page.viewport(...metrics);
      await page.route('governance');
      await page.text(`${root} h2`, '治理工作台');
      assert.equal(
        await page.evaluate(
          `(() => {const root=document.querySelector(${JSON.stringify(root)}),surfaces=${JSON.stringify(governanceSurfaces)};if(root.querySelectorAll('.governance-card').length!==surfaces.length)return false;for(const [id,title]of surfaces){const nodes=[...root.querySelectorAll('.governance-card')].filter(card=>card.querySelector('.panel-head > div')?.textContent===title);if(nodes.length!==1)return false;nodes[0].dataset.cdpGovernance=id;}globalThis.__cdpGovernanceWorkspace=root;return root.querySelectorAll('.governance-source').length===20&&root.querySelectorAll('.governance-actions').length===0&&JSON.stringify([...root.querySelectorAll('.governance-metrics strong')].map(node=>node.textContent))===JSON.stringify(['11','49','1','3 / 0']);})()`,
        ),
        true,
      );
      await page.noOverflow();
    }
  });
  await check('governance-table-preview-fields-and-original-record-limit', async () => {
    const selector = panel('organizations');
    await page.click(`${selector} .governance-source > summary`);
    await page.text(`${selector} .table-footnote`, '当前预览前 8 条记录');
    assert.equal(
      await page.evaluate(
        `(() => {const root=document.querySelector(${JSON.stringify(selector)}),table=root.querySelector('table');return root.querySelector('details').open&&!!table&&table.getClientRects().length>0&&table.querySelectorAll('tbody > tr').length===8&&JSON.stringify([...table.querySelectorAll('thead th')].map(node=>node.textContent))===JSON.stringify(['名称','编码','启用状态','版本'])&&table.textContent.includes('CDP治理组织01')&&!table.textContent.includes('governance-org-01')&&globalThis.__cdpGovernanceWorkspace===document.querySelector('.governance-workspace');})()`,
      ),
      true,
    );
    await page.noOverflow();
  });
  const selectOutcome = async (value) => {
    const selector = `${panel('audit')} [aria-label="日志结果"]`;
    const index = ['', 'SUCCESS', 'FAILURE'].indexOf(value);
    assert.ok(index >= 0);
    await page.click(selector);
    for (const [key, code] of [
      ['Home', 36],
      ...Array.from({ length: index }, () => ['ArrowDown', 40]),
      ['Enter', 13],
    ])
      for (const type of ['rawKeyDown', 'keyUp'])
        await send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: code });
    assert.equal(
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),
      value,
    );
  };
  await check('governance-audit-local-filters-preserve-workspace-and-controls', async () => {
    const audit = panel('audit');
    const query = `${audit} [aria-label="搜索系统日志"]`;
    const note = `${audit} .audit-log-results > .table-footnote`;
    await page.click(`${audit} .governance-source > summary`);
    await page.text(note, '筛选结果 10 条');
    assert.equal(
      await page.evaluate(
        `(() => {const panel=document.querySelector(${JSON.stringify(audit)});globalThis.__cdpGovernanceAudit={panel,query:panel.querySelector('[aria-label="搜索系统日志"]'),select:panel.querySelector('[aria-label="日志结果"]'),table:panel.querySelector('table')};return !!globalThis.__cdpGovernanceAudit.query&&!!globalThis.__cdpGovernanceAudit.select&&!!globalThis.__cdpGovernanceAudit.table;})()`,
      ),
      true,
    );
    await page.fill(query, 'CDP-CORR-09');
    await page.text(note, '筛选结果 1 条');
    await selectOutcome('SUCCESS');
    await page.text(note, '筛选结果 0 条');
    await selectOutcome('FAILURE');
    await page.text(note, '筛选结果 1 条');
    await page.fill(query, '');
    await page.text(note, '筛选结果 5 条');
    await selectOutcome('');
    await page.text(note, '筛选结果 10 条');
    assert.equal(
      await page.evaluate(
        `(() => {const old=globalThis.__cdpGovernanceAudit,panel=document.querySelector(${JSON.stringify(audit)});return globalThis.__cdpGovernanceWorkspace===document.querySelector('.governance-workspace')&&old.panel===panel&&old.query===panel.querySelector('[aria-label="搜索系统日志"]')&&old.select===panel.querySelector('[aria-label="日志结果"]')&&old.table!==panel.querySelector('table')&&panel.querySelectorAll('tbody > tr').length===8;})()`,
      ),
      true,
    );
    await page.noOverflow();
  });
  await check('governance-workflow-and-notification-previews-without-network-writes', async () => {
    const workflow = panel('workflow');
    const notifications = panel('notifications');
    await page.click(`${workflow} .governance-source:nth-of-type(2) > summary`);
    await page.text(`${workflow} .governance-source:nth-of-type(2) table`, 'CDP-GOV-APPROVAL');
    await page.click(`${notifications} .governance-source:nth-of-type(3) > summary`);
    await page.text(`${notifications} .governance-source:nth-of-type(3) table`, '电子邮件');
    await page.text(`${notifications} .governance-source:nth-of-type(3) table`, '飞书私聊');
    await page.text(`${notifications} .governance-source:nth-of-type(3) table`, '已停用');
    await page.text(`${notifications} .governance-source:nth-of-type(3) table`, '已启用');
    assert.deepEqual(
      router.counts(),
      snapshot,
      'read-only previews and filters issue no new API requests',
    );
    await page.noOverflow();
  });
}
