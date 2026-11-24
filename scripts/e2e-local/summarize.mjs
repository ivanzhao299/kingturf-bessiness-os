#!/usr/bin/env node
// 走查报告汇总（在宿主机执行，零依赖）：把 walk.mjs 写出的 report.json 压成一张逐路由表，
// 并单独列出未到达的路由、接口 ≥400 响应、控制台/页面异常、抽屉焦点不合规项。可一次传入多份报告。
// 用法：node scripts/e2e-local/summarize.mjs <report.json> [...]
import { readFileSync } from 'node:fs';

const count = (items) => {
  const result = new Map();
  for (const item of items) result.set(item, (result.get(item) ?? 0) + 1);
  return Object.fromEntries(result);
};
const kindCounts = (issues) => count(issues.map((issue) => issue.kind));
const json = (value) => JSON.stringify(value);
const tableLine = (cells) =>
  cells
    .map(([text, width], index) => (index === cells.length - 1 ? text : String(text).padEnd(width)))
    .join(' ');

// 抽屉焦点契约：打开时焦点进入对话框、连按 Tab 仍留在对话框内、Esc 关闭、关闭后焦点回到触发器。
const focusBad = (drawers) =>
  drawers.filter(
    (drawer) =>
      !('error' in drawer) && !(drawer.focusInitial && drawer.tabs.every(Boolean) && drawer.closed),
  );
const notRestored = (drawers) =>
  drawers.filter((drawer) => !('error' in drawer) && drawer.focusRestoredMs === null);
const drawerErrors = (drawers) => drawers.filter((drawer) => 'error' in drawer);

const COLUMNS = [
  ['route', 26, (row) => row.route],
  ['ok', 4, (row) => (row.skipped ? 'SKIP' : row.ok ? 'ok' : 'ERR')],
  ['ready', 6, (row) => row.readyMs ?? '-'],
  ['err', 4, (row) => row.errors.length],
  ['net', 4, (row) => row.net.length],
  ['page-issue-kinds', 40, (row) => json(kindCounts(row.audit?.issues ?? []))],
  ['drw', 4, (row) => row.drawers?.length ?? 0],
  ['focusBad', 9, (row) => focusBad(row.drawers ?? []).length],
  ['notRestored', 12, (row) => notRestored(row.drawers ?? []).length],
  ['drawerErr', 10, (row) => drawerErrors(row.drawers ?? []).length],
  [
    'drawer-issue-kinds',
    34,
    (row) => json(kindCounts((row.drawers ?? []).flatMap((drawer) => drawer.issues ?? []))),
  ],
  ['dangerBg', 20, (row) => row.audit?.dangerBadgeBg ?? ''],
  ['hScroll', 0, (row) => row.audit?.pageHScroll ?? '-'],
];

function section(title, entries) {
  console.log(`\n${title}`);
  if (entries.length === 0) console.log('   (none)');
  for (const entry of entries) console.log(`   ${entry}`);
}

function summarize(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const size = report.viewportSize;
  console.log(`== ${file}`);
  console.log(
    `viewport=${report.viewport} ${size.width}x${size.height} shell=${report.timeToShellMs}ms ` +
      `reached=${report.summary.reached}/${report.routes.length} failed=${report.summary.failed} ` +
      `skipped=${report.summary.skipped}`,
  );
  console.log(
    `first paint: errors=${json(report.firstPaint.errors)} api>=400=${json(report.firstPaint.net)} ` +
      `notice=${json(report.firstPaint.notice)}`,
  );
  console.log(tableLine(COLUMNS.map(([title, width]) => [title, width])));
  for (const row of report.routes)
    console.log(tableLine(COLUMNS.map(([, width, cell]) => [cell(row), width])));

  const pageIssues = report.routes.flatMap((row) => row.audit?.issues ?? []);
  console.log(`\nissue kinds (pages): ${json(kindCounts(pageIssues))}`);

  section(
    'routes not reached:',
    report.routes
      .filter((row) => row.ok === false)
      .map((row) => `${row.route.padEnd(26)} ${row.error ?? row.skipped}`),
  );
  const api = new Map();
  const consoleErrors = new Map();
  for (const row of report.routes) {
    for (const entry of row.net)
      api.set(
        `${row.route.padEnd(26)} ${entry}`,
        (api.get(`${row.route.padEnd(26)} ${entry}`) ?? 0) + 1,
      );
    for (const entry of row.errors)
      consoleErrors.set(
        `${row.route.padEnd(26)} ${entry.slice(0, 120)}`,
        (consoleErrors.get(`${row.route.padEnd(26)} ${entry.slice(0, 120)}`) ?? 0) + 1,
      );
  }
  section(
    'API >=400 responses:',
    [...api].map(([entry, times]) => `${entry}  x${times}`),
  );
  section(
    'console/page errors:',
    [...consoleErrors].map(([entry, times]) => `${entry}  x${times}`),
  );
  const drawers = [];
  for (const row of report.routes)
    for (const drawer of row.drawers ?? []) {
      if ('error' in drawer) drawers.push(`${row.route} ${drawer.tag}: ${drawer.error}`);
      else if (drawer.focusRestoredMs === null)
        drawers.push(`${row.route} ${drawer.tag}: focus not restored`);
      else if (!(drawer.focusInitial && drawer.tabs.every(Boolean) && drawer.closed))
        drawers.push(
          `${row.route} ${drawer.tag}: focusInitial=${drawer.focusInitial} tabs=${json(drawer.tabs)} closed=${drawer.closed}`,
        );
      else if (drawer.geo.position !== 'fixed')
        drawers.push(`${row.route} ${drawer.tag}: drawer position is ${drawer.geo.position}`);
    }
  section('drawer problems:', drawers);
  console.log('');
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/e2e-local/summarize.mjs <report.json> [...]');
  process.exitCode = 1;
}
for (const file of files) summarize(file);
