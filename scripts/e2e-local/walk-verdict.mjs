// TD-TEST-040：同一判定用于浏览器走查和离线报告复核。缺失证据不能视为通过。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function listProblems(value, label) {
  if (!Array.isArray(value)) return [`${label}: missing evidence`];
  return value.length === 0 ? [] : [`${label}: ${value.length} issue(s)`];
}

export function drawerProblems(drawer, tabs) {
  const problems = [];
  if ('error' in drawer) problems.push(`probe error: ${drawer.error}`);
  const geo = drawer.geo;
  if (
    !geo ||
    geo.position !== 'fixed' ||
    geo.top !== 0 ||
    geo.rightGap !== 0 ||
    !(geo.width > 0 && geo.width <= geo.viewportWidth) ||
    geo.height !== geo.viewportHeight
  )
    problems.push('drawer geometry');
  if (drawer.overlay !== true) problems.push('drawer overlay');
  if (drawer.modal !== true) problems.push('modal dialog');
  if (drawer.focusInitial !== true) problems.push('initial focus');
  if (
    !Array.isArray(drawer.tabs) ||
    drawer.tabs.length !== tabs ||
    !drawer.tabs.every((value) => value === true)
  )
    problems.push('Tab focus trap');
  if (drawer.wrapForward !== true || drawer.wrapBackward !== true)
    problems.push('Tab boundary wrap');
  if (drawer.closed !== true) problems.push('Escape close');
  if (!Number.isFinite(drawer.focusRestoredMs) || drawer.focusRestoredMs < 0)
    problems.push('focus restoration');
  if (!(drawer.roots > 0)) problems.push('drawer audit root');
  problems.push(...listProblems(drawer.issues, 'drawer layout'));
  return problems;
}

export function filterProblems(filter) {
  const problems = [];
  if ('error' in filter) problems.push(`probe error: ${filter.error}`);
  if (filter.kind !== 'status-filter') problems.push('status filter evidence');
  if (filter.selected !== true) problems.push('filter not selected');
  if (filter.restored !== true) problems.push('filter not restored');
  if (filter.listReady !== true) problems.push('filtered list not ready');
  for (const [label, response, state] of [
    ['filter', filter.response, 'OPEN'],
    ['restore', filter.resetResponse, ''],
  ]) {
    if (
      !response ||
      response.method !== 'GET' ||
      response.state !== state ||
      !(response.status >= 200 && response.status < 300)
    )
      problems.push(`${label} read response`);
  }
  problems.push(...listProblems(filter.issues, 'filter layout'));
  return problems;
}

export function routeProblems(row, tabs) {
  const problems = [];
  if (row.reached !== true) problems.push('route not reached');
  if ('error' in row) problems.push(`route error: ${row.error}`);
  if (row.skipped) problems.push(`route skipped: ${row.skipped}`);
  problems.push(...listProblems(row.errors, 'console/page errors'));
  problems.push(...listProblems(row.net, 'HTTP errors'));
  if (!(row.audit?.roots > 0)) problems.push('page audit root');
  problems.push(...listProblems(row.audit?.issues, 'page layout'));
  if (
    !Array.isArray(row.triggerPlan) ||
    !Array.isArray(row.drawers) ||
    !Array.isArray(row.filters)
  ) {
    problems.push('interaction plan/results missing');
    return problems;
  }
  for (const trigger of row.triggerPlan) {
    if (!['drawer', 'status-filter'].includes(trigger.kind)) {
      problems.push(`unknown interaction ${trigger.key}`);
      continue;
    }
    const results = trigger.kind === 'drawer' ? row.drawers : row.filters;
    if (results.filter((result) => result.key === trigger.key).length !== 1)
      problems.push(`unchecked/duplicate interaction ${trigger.key}`);
  }
  for (const [kind, results, check] of [
    ['drawer', row.drawers, (drawer) => drawerProblems(drawer, tabs)],
    ['status-filter', row.filters, filterProblems],
  ]) {
    for (const result of results) {
      if (!row.triggerPlan.some((trigger) => trigger.key === result.key && trigger.kind === kind))
        problems.push(`unplanned interaction ${result.key}`);
      problems.push(...check(result).map((problem) => `${result.tag}: ${problem}`));
    }
  }
  return problems;
}

export function evaluateReport(report) {
  const problems = [];
  if (!Number.isSafeInteger(report.tabs) || report.tabs < 0) problems.push('invalid Tab count');
  for (const key of ['errors', 'net', 'notice'])
    problems.push(...listProblems(report.firstPaint?.[key], `first paint ${key}`));
  if (!Array.isArray(report.routes) || report.routes.length === 0)
    problems.push('no route results');
  const routes = (report.routes ?? []).map((row) => {
    const failures = routeProblems(row, report.tabs);
    return { ...row, ok: failures.length === 0, problems: failures };
  });
  const drawers = routes.flatMap((row) => row.drawers ?? []);
  const filters = routes.flatMap((row) => row.filters ?? []);
  const summary = {
    requested: routes.length,
    reached: routes.filter((row) => row.reached === true).length,
    passed: routes.filter((row) => row.ok).length,
    failed: routes.filter((row) => !row.ok).length,
    skipped: routes.filter((row) => row.skipped).length,
    drawers: drawers.length,
    drawerErrors: drawers.filter((drawer) => 'error' in drawer).length,
    filters: filters.length,
    filterErrors: filters.filter((filter) => 'error' in filter).length,
  };
  return {
    ...report,
    routes,
    problems,
    summary,
    exitCode: problems.length === 0 && summary.failed === 0 ? 0 : 1,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = evaluateReport(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(
    JSON.stringify(
      {
        summary: result.summary,
        problems: result.problems,
        routes: result.routes.map(({ route, ok, problems }) => ({ route, ok, problems })),
      },
      null,
      2,
    ),
  );
  process.exitCode = result.exitCode;
}
