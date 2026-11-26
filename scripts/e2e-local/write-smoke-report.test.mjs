// 写流程冒烟报告分组的单元测试（TD-TEST-029）。printSummary 只读 report 对象输出文本，
// 不连数据库、不起浏览器；目录条目的 fixedIn 格式（40 位小写十六进制）与 tracking 标记
// 也在这里钉住——目录手改时短号混入会在这里红。「在 main 历史上」不在此测：CI 浅克隆
// （checkout 默认 depth=1）没有历史提交对象，merge-base 断言必红；该核对由任务书的探针
// 在完整检出上做（产物目录 verify-fixed-in.mjs），不随 pnpm test 运行。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFECT_LIST, DEFECTS } from './write-smoke-catalog.mjs';
import { printSummary } from './write-smoke.mjs';

const makeFlow = (id, { status = 'passed', aborted = null } = {}) => ({
  id,
  title: `${id} 流程`,
  status,
  steps: [],
  facts: [],
  problems: [],
  aborted,
  startedAt: '2026-11-26T00:00:00.000Z',
  finishedAt: '2026-11-26T00:01:00.000Z',
});

const makeReport = (probed, { flows = [], defects = [] } = {}) => ({
  version: 1,
  base: 'http://127.0.0.1:4198',
  flows,
  defects,
  probed,
  feedback: { viewport: { innerWidth: 1440, innerHeight: 900 } },
});

/** 把 console.log 换成收集器跑 printSummary，返回 { 退出码, 全文, 某分组下的条目行 }。 */
const runSummary = (report) => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  let code;
  try {
    code = printSummary(report);
  } finally {
    console.log = original;
  }
  const text = lines.join('\n');
  const groupLines = (title) => {
    // 标题可能带后缀（如「未检查的条目（另有 1 条已另有台账、归对账组）」），按前缀匹配。
    const start = lines.findIndex((line) => line === title || line.startsWith(`${title}（`));
    assert.notEqual(start, -1, `摘要里没有分组「${title}」`);
    const picked = [];
    for (let i = start + 1; i < lines.length && lines[i].startsWith('  WS-'); i += 1)
      picked.push(lines[i]);
    return picked;
  };
  return { code, text, groupLines };
};

const allClean = () => Object.fromEntries(DEFECT_LIST.map((defect) => [defect.id, 'clean']));
/** 从 probed 里省掉若干条目，模拟没跑到或没执行的检查项。 */
const without = (probed, ids) =>
  Object.fromEntries(Object.entries(probed).filter(([id]) => !ids.includes(id)));

test('目录条目的 fixedIn 都是 40 位小写十六进制；WS-P2-03 无单独修复提交', () => {
  const withFixedIn = DEFECT_LIST.filter((defect) => defect.fixedIn);
  assert.equal(withFixedIn.length, DEFECT_LIST.length - 1, '除 WS-P2-03 外都应带 fixedIn');
  for (const defect of withFixedIn)
    assert.match(
      defect.fixedIn,
      /^[0-9a-f]{40}$/u,
      `${defect.id} 的 fixedIn 不是 40 位小写十六进制`,
    );
  assert.equal(DEFECTS.siblingListStale.fixedIn, undefined);
  assert.equal(DEFECTS.integerOnlyNumbers.tracking?.tracker, 'TD-UI-009');
});

test('全量 clean：未复现 24 项分成「已修复回归检查 23 + 基线即未复现 1」，无未检查组', () => {
  const { code, text, groupLines } = runSummary(makeReport(allClean()));
  assert.equal(code, 0);
  const fixed = groupLines('已修复、留作回归检查（未复现）');
  const baseline = groupLines('基线即未复现、无修复提交');
  assert.equal(fixed.length, 23);
  assert.equal(baseline.length, 1);
  assert.match(baseline[0], /WS-P2-03/);
  assert.ok(!text.includes('未检查的条目'), '全量运行不该出现未检查组');
  assert.ok(
    text.includes(
      '未复现 24 项：已修复、留作回归检查（有 fixedIn）23 项；基线即未复现、无修复提交 1 项；未检查 0 项',
    ),
  );
  for (const defect of DEFECT_LIST) assert.ok(text.includes(defect.id), `${defect.id} 未在摘要里`);
});

test('只跑 lead：3 条 clean 进已修复组，其余进未检查组，24 条都可见', () => {
  const probed = {};
  probed['WS-P1-04'] = 'clean';
  probed['WS-P2-06'] = 'clean';
  probed['WS-P3-01'] = 'clean';
  const { code, text, groupLines } = runSummary(makeReport(probed, { flows: [makeFlow('lead')] }));
  assert.equal(code, 0);
  for (const defect of DEFECT_LIST) assert.ok(text.includes(defect.id), `${defect.id} 未在摘要里`);
  const unchecked = groupLines('未检查的条目');
  // 24 - 3（lead 跑过）- 1（WS-P2-07 另有台账、未检查时也归对账组）= 20。
  assert.equal(unchecked.length, 20);
  assert.match(unchecked[0], /WS-P1-01/);
  assert.ok(text.includes('；未检查 21 项'));
  assert.match(groupLines('已另有台账的条目（对账用）')[0], /WS-P2-07.*未检查/u);
});

test('流程中止：未执行的检查项仍在摘要里出现且计为未检查，流程失败退出码 1', () => {
  const probed = without(allClean(), ['WS-P2-05', 'WS-P2-10', 'WS-P3-04']);
  const { text, groupLines } = runSummary(
    makeReport(probed, { flows: [makeFlow('quote', { status: 'failed', aborted: '抽屉超时' })] }),
  );
  for (const defect of DEFECT_LIST) assert.ok(text.includes(defect.id), `${defect.id} 未在摘要里`);
  const unchecked = groupLines('未检查的条目');
  assert.equal(unchecked.length, 3);
  for (const id of ['WS-P2-05', 'WS-P2-10', 'WS-P3-04'])
    assert.ok(
      unchecked.some((line) => line.includes(id)),
      `${id} 不在未检查组里`,
    );
  assert.ok(text.includes('；未检查 3 项'));
  assert.ok(text.includes('退出码 1'));
});

test('旧提交上 WS-P2-07 复现：归「已另有台账」组计 1 项，不与 tracking 分组混淆', () => {
  const probed = { ...allClean(), 'WS-P2-07': 'reproduced' };
  const { code, text, groupLines } = runSummary(
    makeReport(probed, {
      defects: [{ ...DEFECTS.integerOnlyNumbers, occurrences: [{ flow: 'quote' }] }],
    }),
  );
  assert.equal(code, 1);
  const tracked = groupLines('已另有台账的条目（对账用）');
  assert.equal(tracked.length, 1);
  assert.match(tracked[0], /WS-P2-07/);
  assert.match(tracked[0], /已复现/);
  assert.ok(!text.includes('复现或未能判定的条目'), 'tracking 条目不该再出现在普通复现组');
  assert.ok(text.includes('其中另有台账 1 项不计入本批新发现'));
});
