#!/usr/bin/env node
// 写流程冒烟（TD-TEST-024，在 Playwright 容器内执行）：以合成账号从浏览器界面完成新建、发布、状态流转
// 等写操作，逐流程断言界面上可见的结果，并按缺陷目录逐项记录是否复现。只写测试，不改产品代码。
// 用法：node scripts/e2e-local/write-smoke.mjs [--flows lead,customer,...] [--out 目录] [--list]
//       通常经 node scripts/e2e-local/e2e-local.mjs write-smoke [--flows ...] 调用。
// 说明见 docs/engineering/local-e2e-browser-harness.md「写流程冒烟」一节。
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFECT_LIST, DEFECTS } from './write-smoke-catalog.mjs';
import {
  creditFlow,
  customerFlow,
  leadFlow,
  manufacturingFlow,
  procurementFlow,
  quoteFlow,
} from './write-smoke-flows.mjs';
import {
  blankRequiredSelects,
  closeDrawer,
  createTokenApi,
  login,
  screenshot,
  successNotice,
} from './write-smoke-kit.mjs';

const FLOWS = Object.freeze({
  lead: { title: '线索：新建 → 列表 → 认领 → 变更状态 → 改派', run: leadFlow },
  customer: { title: '客户：新建 → 列表 → 添加联系人 → 添加活动', run: customerFlow },
  procurement: {
    title: '供应链：供应商（含准入）→ 询价 → 采购订单 → 登记收货',
    run: procurementFlow,
  },
  manufacturing: {
    title: '制造：物料 / BOM / 工艺路线 新建草稿 → 发布',
    run: manufacturingFlow,
  },
  credit: {
    title: '信用审查：设置额度 → 发起评估 → 审批人批准 / 拒绝',
    run: creditFlow,
  },
  quote: { title: '报价：新建（过销售政策）→ 批准 → 签发', run: quoteFlow },
});
const VIEWPORT = { viewport: { width: 1440, height: 900 } };
const RESOURCE_ERROR = /^Failed to load resource\b/u;
const STATE_LABEL = {
  reproduced: '已复现',
  clean: '未复现',
  inconclusive: '未能判定',
  error: '未能判定',
};

/** 步骤内部用它声明「前提不成立，无法继续」；不算失败，也不算通过。 */
class Skipped extends Error {}
/** 必须步骤抛错后中止本流程的其余步骤；流程之间互不影响。 */
class Aborted extends Error {}

const describe = (error) =>
  String(error?.message ?? error)
    .replace(/\s+/gu, ' ')
    .slice(0, 400);
const count = (items, check) => items.filter(check).length;

/** 证据进报告前转成纯 JSON（丢掉 locator 之类的对象，防循环引用）。 */
const plain = (evidence) => {
  const seen = new WeakSet();
  try {
    return JSON.parse(
      JSON.stringify(evidence, (key, item) => {
        if (typeof item !== 'object' || item === null)
          return typeof item === 'function' ? undefined : item;
        if (item.type === 'locator') return '[locator]';
        if (seen.has(item)) return undefined;
        seen.add(item);
        return item;
      }),
    );
  } catch {
    return { unpresentable: true };
  }
};

/**
 * 运行器：流程 / 必须步骤 / 检查项 / 前置数据 / 会话切换，以及报告的收集。
 * 报告里的三种步骤：must（流程自身的结果）、probe（缺陷检查项）、fixture（明确标注的接口前置数据）。
 */
function createRun({ browser, base, creds, shots, world }) {
  const report = {
    version: 1,
    startedAt: new Date().toISOString(),
    base,
    flows: [],
    defects: [],
    probed: {},
    feedback: {
      // 视口自证（TD-TEST-026 的教训）：首次进入页面时量取 window.innerWidth/innerHeight 写进报告。
      viewport: null,
      formsObserved: 0,
      okWrites: 0,
      irreversibleWrites: 0,
      successNotices: [],
      confirms: [],
      nativeDialogs: [],
      serverErrors: [],
      blankSelects: [],
    },
  };
  let page = null;
  let flow = null;

  const watch = (target) => {
    target.on('pageerror', (error) => {
      if (flow) flow.problems.push(`pageerror: ${String(error).slice(0, 300)}`);
    });
    target.on('console', (message) => {
      const text = message.text();
      if (flow && message.type() === 'error' && !RESOURCE_ERROR.test(text))
        flow.problems.push(`console.error: ${text.slice(0, 300)}`);
    });
    target.on('dialog', (dialog) => {
      report.feedback.nativeDialogs.push(dialog.message().slice(0, 200));
      void dialog.accept();
    });
  };
  /** 视口自证：只在首次登录后的页面量一次；量不到时报告里为 null（判定无效）。 */
  const recordViewport = async () => {
    if (report.feedback.viewport) return;
    report.feedback.viewport = await page
      .evaluate(() => ({
        innerWidth: globalThis.window.innerWidth,
        innerHeight: globalThis.window.innerHeight,
      }))
      .catch(() => null);
  };
  /** 记一次复现。步骤内的调用只登记是哪一步（stepIndex），步骤名、证据与截图在收尾时回填——
   *  同一步骤里顺带记下的其它缺陷（例如「返回 500」）因此也能对上截图。 */
  const reproduce = (defect, record, note) => {
    report.probed[defect.id] = 'reproduced';
    let entry = report.defects.find((item) => item.id === defect.id);
    if (!entry) {
      entry = { ...defect, occurrences: [] };
      report.defects.push(entry);
    }
    entry.occurrences.push({
      flow: flow?.id ?? '(汇总)',
      stepIndex: flow ? flow.steps.length - 1 : -1,
      note: record ? '' : (note ?? ''),
    });
  };
  const shoot = (record, tag) => {
    const name = `${flow.id}__${String(flow.steps.length).padStart(2, '0')}-${tag}`;
    record.screenshot = `${shots}/${name}.png`;
    return screenshot(page, shots, name);
  };
  /** 步骤的公共骨架：登记记录 → 执行 → 落证据 → 失败时截图并归到缺陷目录。 */
  const perform = async (record, body, defect, onFailure) => {
    const evidence = {};
    let thrown = null;
    let ok = false;
    try {
      ok = (await body(evidence)) === true;
    } catch (error) {
      thrown = error;
    }
    record.evidence = plain(evidence);
    if (thrown) record.evidence.error = describe(thrown);
    if (thrown) record.status = 'error';
    if (thrown instanceof Skipped) {
      record.status = 'skipped';
      return false;
    }
    if (ok) {
      if (defect) report.probed[defect.id] ??= 'clean';
      return true;
    }
    await shoot(record, defect?.id ?? onFailure).catch(() => undefined);
    if (!thrown) {
      record.status = 'reproduced';
      if (defect) reproduce(defect, record);
    }
    return false;
  };

  return {
    report,
    world,
    get page() {
      return page;
    },
    async flow(id, body) {
      flow = {
        id,
        title: FLOWS[id].title,
        status: 'passed',
        steps: [],
        facts: [],
        problems: [],
        aborted: null,
        startedAt: new Date().toISOString(),
      };
      report.flows.push(flow);
      // 上一个流程若中途出错，抽屉可能还开着（遮罩会挡住侧栏），先关掉再开始。
      await closeDrawer(page).catch(() => undefined);
      try {
        await body();
      } catch (error) {
        if (!(error instanceof Skipped)) flow.aborted = describe(error);
      }
      flow.finishedAt = new Date().toISOString();
      if (flow.steps.some((step) => step.kind === 'must' && step.status !== 'passed'))
        flow.status = 'failed';
    },
    /** 流程自身的结果。返回 false 或抛错即失败；defect 用于把失败归到缺陷目录的某一条。 */
    async must(name, body, { defect, skipIf } = {}) {
      const record = { kind: 'must', name, status: 'passed', evidence: {} };
      flow.steps.push(record);
      if (skipIf?.() === true) {
        record.status = 'skipped';
        record.evidence.reason = '上游步骤没有完成，本步骤未执行';
        return false;
      }
      const ok = await perform(record, body, defect, 'must');
      // 必须步骤不成立就是失败（perform 里的 reproduced 是检查项的说法）；出错则中止本流程。
      if (!ok && record.status === 'reproduced') record.status = 'failed';
      if (!ok && record.status === 'error') throw new Aborted(record.evidence.error);
      return ok;
    },
    /** 检查项：断言正确行为。返回 false 即对应缺陷已复现（留截图与现场）；抛错记为未能判定。 */
    async probe(defect, name, body) {
      const record = {
        kind: 'probe',
        name,
        defect: defect.id,
        severity: defect.severity,
        status: 'clean',
        evidence: {},
      };
      flow.steps.push(record);
      const ok = await perform(record, body, defect, defect.id);
      // perform 只在「断言不成立」时写 reproduced；前提不成立或执行出错都不算复现。
      if (!ok && record.status !== 'error')
        record.status = record.status === 'skipped' ? 'inconclusive' : 'reproduced';
      if (record.status === 'error') report.probed[defect.id] ??= 'error';
      return ok;
    },
    /** 前置数据（不是流程结果，也不算通过或失败），报告里单独标注。 */
    async fixture(name, body) {
      const record = { kind: 'fixture', name, status: 'done', evidence: {} };
      flow.steps.push(record);
      const evidence = {};
      try {
        await body(evidence);
      } catch (error) {
        record.status = 'failed';
        evidence.error = describe(error);
      }
      record.evidence = plain(evidence);
    },
    /** 等一个写请求的结果，并顺手采集成功提示 / 确认框 / 服务端错误（供汇总检查项使用）。 */
    async write(pending, { irreversible = false } = {}) {
      const result = await pending;
      const { feedback } = report;
      if (irreversible) feedback.irreversibleWrites += 1;
      if (result.confirm) feedback.confirms.push({ flow: flow?.id, text: result.confirm });
      if (result.ok === true) {
        feedback.okWrites += 1;
        const notice = await successNotice(page);
        if (notice !== '') feedback.successNotices.push({ flow: flow?.id, notice });
      } else if (result.sent)
        feedback.serverErrors.push({
          flow: flow?.id,
          request: `${result.method} ${result.path}`,
          status: result.status,
        });
      return result;
    },
    /** 现场截图：步骤里要先清理（关抽屉、切页面）再返回时，在清理之前调用，证据才留得住。 */
    async shot(tag = 'scene') {
      const record = flow.steps.at(-1);
      const name = `${flow.id}__${String(flow.steps.length).padStart(2, '0')}-${tag}`;
      const file = `${shots}/${name}.png`;
      (record.sceneShots ??= []).push(file);
      await screenshot(page, shots, name);
      return file;
    },
    /** 记下某个表单里「必填却默认空选」的下拉（WS-P2-06 的观测点）。 */
    async observeBlankSelects(form) {
      const fields = await blankRequiredSelects(page);
      const { feedback } = report;
      feedback.formsObserved += 1;
      if (fields.length === 0) return;
      feedback.blankSelects.push({ flow: flow?.id, form, fields });
      if (feedback.blankSelects.length === 1)
        report.feedback.blankSelectShot = await screenshot(page, shots, 'global__WS-P2-06');
    },
    /** 切到另一个合成账号（新的浏览器上下文）执行 body；结束后回到原账号的页面。 */
    async session(key, body) {
      const context = await browser.newContext(VIEWPORT);
      const previous = page;
      const sessionPage = await context.newPage();
      watch(sessionPage);
      page = sessionPage;
      try {
        await login(page, base, creds[key]);
        await recordViewport();
        await body();
      } finally {
        await context.close();
        page = previous;
      }
    },
    reproduce: (defect, note) => reproduce(defect, null, note),
    fact: (key, value) => {
      flow.facts.push({ key, value });
    },
    skip: (reason) => {
      throw new Skipped(reason);
    },
  };
}

/** 收尾：① 把步骤内记下的复现回填上步骤名、证据与截图；② 汇总跨流程的三条检查项
 *  （必填下拉空选、无成功提示、无确认框）。没有观测到样本的保持「未检查」。 */
function finalize(report) {
  const { feedback } = report;
  for (const defect of report.defects)
    for (const occurrence of defect.occurrences) {
      if (!('stepIndex' in occurrence)) continue;
      const record = report.flows.find((item) => item.id === occurrence.flow)?.steps[
        occurrence.stepIndex
      ];
      occurrence.step = [record?.name, occurrence.note].filter(Boolean).join(' — ');
      occurrence.evidence = record?.evidence ?? {};
      occurrence.screenshots = [
        ...(record?.sceneShots ?? []),
        ...(record?.screenshot ? [record.screenshot] : []),
      ];
      delete occurrence.stepIndex;
      delete occurrence.note;
    }
  const verdict = (defect, reproduced, evidence, shot) => {
    report.probed[defect.id] = reproduced ? 'reproduced' : 'clean';
    if (reproduced)
      report.defects.push({
        ...defect,
        occurrences: [{ flow: '(汇总)', step: '', evidence, screenshots: shot ? [shot] : [] }],
      });
  };
  if (feedback.formsObserved > 0)
    verdict(
      DEFECTS.blankRequiredSelect,
      feedback.blankSelects.length > 0,
      {
        forms: feedback.blankSelects.map(
          (item) => `${item.flow} / ${item.form}：${item.fields.join('、')}`,
        ),
      },
      feedback.blankSelectShot,
    );
  if (feedback.okWrites > 0)
    verdict(DEFECTS.noSuccessNotice, feedback.successNotices.length === 0, {
      okWrites: feedback.okWrites,
      notices: feedback.successNotices,
    });
  if (feedback.irreversibleWrites > 0)
    verdict(
      DEFECTS.noConfirmDialog,
      feedback.confirms.length === 0 && feedback.nativeDialogs.length === 0,
      {
        irreversibleWrites: feedback.irreversibleWrites,
        confirms: feedback.confirms,
        nativeDialogs: feedback.nativeDialogs,
      },
    );
}

/** 把报告压成一张表打到标准输出，返回退出码。 */
function printSummary(report) {
  const mustSteps = report.flows.flatMap((item) =>
    item.steps.filter((step) => step.kind === 'must'),
  );
  const passedFlows = count(report.flows, (item) => item.status === 'passed');
  const viewport = report.feedback.viewport;
  console.log(`\n== 写流程冒烟  base=${report.base}`);
  console.log(
    viewport
      ? `被测视口（页面里量得）：${viewport.innerWidth}x${viewport.innerHeight}`
      : '被测视口：未能量取（TD-TEST-026：视口未生效时本行会暴露）',
  );
  console.log(
    `流程 ${report.flows.length} 条，通过 ${passedFlows} 条；必须步骤 ${count(mustSteps, (step) => step.status === 'passed')} 通过 / ${count(mustSteps, (step) => step.status !== 'passed')} 失败或未执行`,
  );
  for (const item of report.flows) {
    const must = item.steps.filter((step) => step.kind === 'must');
    const probes = item.steps.filter((step) => step.kind === 'probe');
    const reproduced = count(probes, (step) => step.status === 'reproduced');
    console.log(
      `  ${item.status === 'passed' ? '通过' : '失败'}  ${item.id.padEnd(15)} ${item.title}  [必须 ${count(must, (step) => step.status === 'passed')}/${must.length}；检查项复现 ${reproduced} / ${probes.length}]`,
    );
    for (const step of item.steps)
      if (step.kind === 'must' && step.status !== 'passed')
        console.log(
          `        ✗ ${step.status === 'skipped' ? '未执行' : '失败'}  ${step.name}${step.evidence.error ? `  :: ${step.evidence.error}` : ''}`,
        );
    if (item.aborted) console.log(`        ⚠ 流程中止：${item.aborted}`);
    const problems = [...new Set(item.problems)];
    if (problems.length > 0)
      console.log(`        ⚠ 页面异常 ${problems.length} 条，见 report.json`);
  }
  // 已另有台账的条目单列一组：修复提交写在标题里；在被测提交上仍复现时如实显示「已复现」。
  const listCatalog = (title, pick) => {
    const entries = DEFECT_LIST.filter(pick);
    if (entries.length === 0) return;
    console.log(title);
    for (const defect of entries) {
      const state = report.probed[defect.id];
      console.log(
        `  ${defect.id}  ${(state ? STATE_LABEL[state] : '未检查').padEnd(5, '　')} ${defect.title}`,
      );
    }
  };
  listCatalog('缺陷目录', (defect) => !defect.tracking);
  listCatalog('已另有台账的条目（对账用）', (defect) => defect.tracking);
  const { defects } = report;
  const failedFlows = report.flows.length - passedFlows;
  const tracked = count(defects, (item) => item.tracking);
  const blocking = count(defects, (item) => item.severity !== 'P3');
  const code = failedFlows > 0 || blocking > 0 ? 1 : 0;
  console.log(
    `退出码 ${code}：流程失败 ${failedFlows} 条；已复现 P1 ${count(defects, (item) => item.severity === 'P1')} 项、P2 ${count(defects, (item) => item.severity === 'P2')} 项、P3 ${count(defects, (item) => item.severity === 'P3')} 项` +
      `（其中另有台账 ${tracked} 项不计入本批新发现；退出码只看被测提交上是否复现）`,
  );
  return code;
}

function printList() {
  console.log('流程：');
  for (const [id, definition] of Object.entries(FLOWS))
    console.log(`  ${id.padEnd(15)} ${definition.title}`);
  console.log('缺陷目录：');
  for (const defect of DEFECT_LIST) console.log(`  ${defect.id}  ${defect.title}`);
  return 0;
}

async function main() {
  const { values } = parseArgs({
    options: { flows: { type: 'string' }, out: { type: 'string' }, list: { type: 'boolean' } },
  });
  if (values.list) return printList();
  const repository = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const credentialsFile = process.env.KINGTURF_CREDS_FILE ?? '';
  assert(
    credentialsFile,
    'KINGTURF_CREDS_FILE is required (run through e2e-local.mjs write-smoke)',
  );
  const creds = JSON.parse(readFileSync(credentialsFile, 'utf8'));
  const base = process.env.KINGTURF_BASE_URL ?? 'http://127.0.0.1:4198';
  const stamp = Date.now().toString(36).toUpperCase();
  const out = resolve(
    values.out ??
      join(
        process.env.E2E_LOCAL_OUT ?? '/tmp/kingturf-e2e-local',
        'write-smoke',
        `${stamp}-${process.pid}`,
      ),
  );
  assert(
    relative(repository, out).startsWith('..'),
    `--out must be outside the repository: ${out}`,
  );
  const requested = (values.flows ?? Object.keys(FLOWS).join(','))
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  for (const name of requested) assert(name in FLOWS, `unknown flow ${name}; use --list`);
  const shots = join(out, 'shots');
  mkdirSync(shots, { recursive: true, mode: 0o700 });

  const world = {
    stamp,
    day: (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10),
    lead: {},
    supplier: {},
    order: {},
    credit: { pending: [] },
    // 令牌客户端只用于信用流程里明确标注的前置数据；没有配置接口地址时那一步记为未执行。
    api: process.env.KINGTURF_API_URL
      ? createTokenApi(process.env.KINGTURF_API_URL, creds.admin)
      : null,
  };
  const { chromium } = createRequire(join(repository, 'package.json'))('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  let code = 1;
  try {
    const run = createRun({ browser, base, creds, shots, world });
    await run.session('admin', async () => {
      for (const id of Object.keys(FLOWS).filter((key) => requested.includes(key)))
        await run.flow(id, () => FLOWS[id].run(run));
    });
    finalize(run.report);
    run.report.finishedAt = new Date().toISOString();
    const file = join(out, 'report.json');
    writeFileSync(file, JSON.stringify(run.report, null, 2), { mode: 0o600 });
    console.log(`report ${file}`);
    code = printSummary(run.report);
  } finally {
    await browser.close();
  }
  return code;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`write-smoke: ${String(error.message ?? error).slice(0, 600)}`);
    process.exitCode = 1;
  },
);
