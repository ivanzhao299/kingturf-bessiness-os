// 写流程冒烟的六个流程：线索 / 客户 / 供应链 / 制造 / 信用 / 报价（TD-TEST-024）。每个流程由若干
// 「必须步骤」（流程自身的结果，失败即流程失败）与若干「检查项」组成；检查项断言的是正确行为，
// 不成立即记为对应缺陷已复现（缺陷见 write-smoke-catalog.mjs）。
// 写操作全部经界面触发。遇到已登记的缺陷时用变通办法把链条继续走完，并在证据里写明用了什么变通。
import { DEFECTS } from './write-smoke-catalog.mjs';
import {
  act,
  apiGet,
  badge,
  brief,
  click,
  clickSubmit,
  closeDrawer,
  countRequests,
  drawer,
  drawerText,
  drawerTitle,
  errorPosition,
  fieldNames,
  fill,
  hasCjk,
  openRow,
  openRowById,
  openRoute,
  options,
  reloadRoute,
  row,
  rows,
  search,
  submit,
  value,
  visibleError,
  waitBadge,
  waitRow,
  waitRowMatch,
} from './write-smoke-kit.mjs';

// 审批人账号的显示名（scripts/e2e-local/bootstrap.mjs SYNTHETIC_ACCOUNTS 里的常量）。
const APPROVER_NAME = '本地 e2e 信用审批';
const UUID_IN_PRODUCT = /产品 [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/u;
const DRAFT = /草稿 · 第 1 版/u;
const PUBLISHED = /已发布 · 第 1 版/u;

const post = (path) => ({ method: 'POST', path });
const put = (path) => ({ method: 'PUT', path });
const squash = (text) =>
  String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim();

/** 检查项先于必须步骤、且两者共用同一个表单时用：检查项若没能把表单打开，这里补开并填好。 */
async function ensureForm(t, openTestid, filler) {
  if ((await drawer(t.page).count()) > 0) return;
  await click(t.page, openTestid);
  await filler();
}

/** 同上，针对详情抽屉：抽屉没开着就按文字重新打开那一行。 */
async function ensureDrawer(t, openTestid, text) {
  if ((await drawer(t.page).count()) > 0) return;
  await openRow(t.page, openTestid, text);
}

/** 断言结果涉及抽屉里的内容、而步骤末尾又要关抽屉时用：不成立就先把现场拍下来再关。 */
async function closeAfter(t, ok) {
  if (ok !== true) await t.shot();
  await closeDrawer(t.page);
  return ok;
}

// ── 线索 ────────────────────────────────────────────────────────────────────
export async function leadFlow(t) {
  const { page, world } = t;
  const title = `E2E写流程冒烟线索-${world.stamp}`;
  world.lead.title = title;

  await t.must('新建线索：提交后抽屉关闭，公海列表出现该线索（公海 / 待认领）', async (e) => {
    await openRoute(page, 'leads');
    await click(page, 'kt-lead-create');
    e.drawer = await drawerTitle(page);
    await t.observeBlankSelects('新建线索');
    await fill(page, 'title', title);
    await fill(page, 'source', '展会');
    const response = await t.write(submit(page, '创建线索', post(/^\/api\/v1\/leads$/u)));
    e.request = brief(response);
    e.row = await waitRow(page, 'kt-lead-open', title);
    e.drawerClosed = (await drawer(page).count()) === 0;
    world.lead.id = response?.body?.id ?? null;
    return (
      response?.ok === true &&
      e.drawerClosed === true &&
      /公海/u.test(e.row ?? '') &&
      /待认领/u.test(e.row ?? '')
    );
  });

  await t.probe(DEFECTS.duplicateSubmit, '双击「创建线索」只应创建一条线索', async (e) => {
    const again = `${title}-双击`;
    await click(page, 'kt-lead-create');
    await fill(page, 'title', again);
    await fill(page, 'source', '网站');
    e.statuses = await countRequests(
      page,
      () => clickSubmit(page, '创建线索', 2),
      post(/^\/api\/v1\/leads$/u),
    );
    await closeDrawer(page);
    const list = await apiGet(page, '/api/v1/leads/pool');
    e.created = list.body?.items?.filter((lead) => lead.title === again).length ?? null;
    return e.statuses.length <= 1 && e.created === 1;
  });

  await t.must('认领：详情抽屉里状态由「公海」变为「已认领」，负责人变为当前账号', async (e) => {
    await search(page, 'kt-lead-search', title);
    await openRow(page, 'kt-lead-open', title);
    e.before = await badge(page);
    const response = await t.write(
      act(page, 'kt-lead-claim', post(/\/api\/v1\/leads\/[^/]+\/claim$/u)),
    );
    e.request = brief(response);
    e.claimed = await waitBadge(page, '.status-badge', '已认领');
    e.after = await badge(page);
    e.ownerShown = (await drawerText(page)).includes('本地 e2e 管理员');
    return e.before === '公海' && response?.ok === true && e.claimed && e.ownerShown;
  });

  await t.must('变更状态：已认领 → 已确认（填写变更原因）', async (e) => {
    await click(page, 'kt-lead-transition');
    await t.observeBlankSelects('变更线索状态');
    await fill(page, 'status', '已确认');
    await fill(page, 'reason', `E2E 写流程冒烟 ${world.stamp}：确认有效`);
    const response = await t.write(
      submit(page, '确认变更', post(/\/api\/v1\/leads\/[^/]+\/transition$/u)),
    );
    e.request = brief(response);
    e.changed = await waitBadge(page, '.status-badge', '已确认');
    e.after = await badge(page);
    return response?.ok === true && e.changed && e.after === '已确认';
  });

  await t.must('改派：负责人变为另一账号（填写分配原因）', async (e) => {
    await click(page, 'kt-lead-assign');
    await fill(page, 'assigneeId', APPROVER_NAME);
    world.lead.assigneeId = (await options(page, 'assigneeId')).find(
      (option) => option.selected,
    )?.value;
    await fill(page, 'reason', `E2E 写流程冒烟 ${world.stamp}：改派`);
    const response = await t.write(
      submit(page, '确认分配', post(/\/api\/v1\/leads\/[^/]+\/reassign$/u)),
    );
    e.request = brief(response);
    e.ownerShown = (await drawerText(page)).includes(APPROVER_NAME);
    return response?.ok === true && e.ownerShown;
  });

  await t.must('接口佐证：线索状态 QUALIFIED，负责人为改派目标', async (e) => {
    const list = await apiGet(page, '/api/v1/leads');
    const lead = list.body?.items?.find((item) => item.id === world.lead.id);
    e.lead = lead && { status: lead.status, ownerId: lead.ownerId };
    return lead?.status === 'QUALIFIED' && lead.ownerId === world.lead.assigneeId;
  });
}

// ── 客户 ────────────────────────────────────────────────────────────────────
/** 经界面新建一个客户，结果写入 world.customer。客户流程与信用流程共用。 */
async function createCustomer(t, number, name) {
  const { page, world } = t;
  await click(page, 'kt-customer-create');
  await fill(page, 'name', name);
  await fill(page, 'customerNumber', number);
  const response = await t.write(submit(page, '创建客户', post(/^\/api\/v1\/customers$/u)));
  const text = await waitRow(page, 'kt-customer-open', number);
  if (response?.ok === true) world.customer = { id: response.body?.id ?? null, number, name };
  return { response, text };
}

export async function customerFlow(t) {
  const { page, world } = t;
  const number = `E2E-WS-${world.stamp}-CUST`;
  const name = `E2E写流程冒烟客户-${world.stamp}`;

  await t.must('新建客户：提交后列表出现该客户（潜在客户）', async (e) => {
    await openRoute(page, 'customers');
    const created = await createCustomer(t, number, name);
    e.request = brief(created.response);
    e.row = created.text;
    return (
      created.response?.ok === true &&
      /潜在客户/u.test(created.text ?? '') &&
      (created.text ?? '').includes(name)
    );
  });

  await t.probe(
    DEFECTS.silentCreateFailure,
    '客户编号重复时，界面应给出可读的失败原因',
    async (e) => {
      await click(page, 'kt-customer-create');
      await fill(page, 'name', `E2E重复编号客户-${world.stamp}`);
      await fill(page, 'customerNumber', number);
      const response = await t.write(submit(page, '创建客户', post(/^\/api\/v1\/customers$/u)));
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      if ((response?.status ?? 0) >= 500)
        t.reproduce(DEFECTS.serverErrorForUserInput, '客户编号重复');
      return closeAfter(t, response?.ok !== true && hasCjk(e.visibleError));
    },
  );

  await t.probe(
    DEFECTS.unlocalizedError,
    '联系人只填姓名保存时，界面应显示中文的失败原因',
    async (e) => {
      await search(page, 'kt-customer-search', number);
      await openRow(page, 'kt-customer-open', number);
      await click(page, 'kt-customer-add-contact');
      await t.observeBlankSelects('添加联系人');
      await fill(page, 'name', '张工');
      await fill(page, 'primary', '否');
      const response = await t.write(
        submit(page, '保存联系人', post(/\/api\/v1\/customers\/[^/]+\/contacts$/u)),
      );
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      return response?.ok !== true && hasCjk(e.visibleError);
    },
  );

  await t.must('添加联系人：补齐联系方式后保存，出现联系人卡片，联系人计数 0 → 1', async (e) => {
    await fill(page, 'title', '采购经理');
    await fill(page, 'email', 'zhang.gong@example.test');
    await fill(page, 'phone', '+8613800000001');
    const response = await t.write(
      submit(page, '保存联系人', post(/\/api\/v1\/customers\/[^/]+\/contacts$/u)),
    );
    e.request = brief(response);
    await drawer(page)
      .locator('[data-testid="kt-customer-contact"]')
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => undefined);
    e.contacts = await drawer(page).locator('[data-testid="kt-customer-contact"]').count();
    e.facts = squash(await drawer(page).locator('[data-testid="kt-customer-facts"]').innerText());
    return response?.ok === true && e.contacts === 1 && /联系人 1/u.test(e.facts);
  });

  await t.must('添加活动：保存后活动时间线出现该条记录', async (e) => {
    const summary = `E2E写流程冒烟：电话回访-${world.stamp}`;
    await click(page, 'kt-customer-add-activity');
    await t.observeBlankSelects('添加活动');
    await fill(page, 'activityType', '电话');
    await fill(page, 'summary', summary);
    const response = await t.write(
      submit(page, '保存活动', post(/\/api\/v1\/customers\/[^/]+\/activities$/u)),
    );
    e.request = brief(response);
    e.activities = await drawer(page).locator('[data-testid="kt-customer-activity"]').count();
    e.timeline = squash(
      await drawer(page).locator('[data-testid="kt-customer-activities"]').innerText(),
    );
    return response?.ok === true && e.activities === 1 && e.timeline.includes(summary);
  });
}

// ── 供应链：供应商 → 准入 → 询价 → 采购订单 → 收货 ──────────────────────────
// 采购域自 4c2a7ca 起是概览加四条子路由，每个控制台独占一条（PROC-2）。
const PROCUREMENT = Object.freeze({
  suppliers: 'procurement/suppliers',
  rfqs: 'procurement/rfqs',
  orders: 'procurement/purchase-orders',
  receipts: 'procurement/goods-receipts',
});

export async function procurementFlow(t) {
  const { page, world } = t;
  const stamp = world.stamp;
  const day = world.day;
  const supplier = { number: `SUP-E2EWS-${stamp}`, name: `E2E写流程冒烟供应商-${stamp}` };
  const rfqNumber = `RFQ-E2EWS-${stamp}`;
  // 订单 / 收货单的编号互不为对方的前缀加后缀，列表按子串定位行时不会串行。
  const order = {
    number: `PO-E2EWS-${stamp}`,
    spare: `PO-E2EWS2-${stamp}`,
    decimal: `PO-E2EWS3-${stamp}`,
  };
  const receipt = (suffix) => `GR-E2EWS${suffix}-${stamp}`;
  const yarn = 'RM-KT-YARN-12000';
  const backing = 'RM-KT-BACKING-PP';
  world.supplier.number = supplier.number;
  world.order.number = order.number;

  const fillSupplier = async (rating) => {
    await fill(page, 'supplierNumber', supplier.number);
    await fill(page, 'name', supplier.name);
    await fill(page, 'paymentTermsDays', '30');
    await fill(page, 'qualityRating', rating);
    await fill(page, 'contactName', '李采购');
    await fill(page, 'contactPhone', '0532-00001111');
  };
  const saveSupplier = () => submit(page, '保存供应商', post(/^\/api\/v1\/suppliers$/u));
  const fillOrder = async (number, item, quantity, price) => {
    await fill(page, 'poNumber', number);
    await fill(page, 'supplierId', supplier.number, 'contains');
    await fill(page, 'itemVersionId', item, 'contains');
    await fill(page, 'quantity', quantity);
    await fill(page, 'unitPrice', price);
    await fill(page, 'requiredAt', day(30));
  };
  const issueOrder = () => submit(page, '签发采购订单', post(/^\/api\/v1\/purchase-orders$/u));
  const fillReceipt = async (suffix, quantity) => {
    await fill(page, 'orderLine', order.number, 'contains');
    await fill(page, 'receiptNumber', receipt(suffix));
    await fill(page, 'sourceReference', `DN-E2EWS${suffix}-${stamp}`);
    await fill(page, 'lotNumber', `LOT-E2EWS${suffix}-${stamp}`);
    await fill(page, 'locationCode', '0', 'index');
    await fill(page, 'quantity', quantity);
    await fill(page, 'manufacturedAt', day(-20));
  };
  const postReceipt = () => submit(page, '过账收货', post(/^\/api\/v1\/goods-receipts$/u));

  await t.probe(
    DEFECTS.testidCollision,
    '采购订单与生产工单两个控制台不应共用 data-testid',
    async (e) => {
      await openRoute(page, PROCUREMENT.orders);
      // 同一个 data-testid 出现在不止一个控制台根节点（kt-po-page）里，即为撞名；按行重复出现的属正常。
      e.shared = await page.evaluate(() => {
        const roots = [...globalThis.document.querySelectorAll('[data-testid="kt-po-page"]')];
        const keys = [
          'kt-po-create',
          'kt-po-open',
          'kt-po-page',
          'kt-po-progress',
          'kt-po-refresh',
          'kt-po-search',
          'kt-po-submit-error',
        ];
        return {
          consoles: roots.length,
          shared: keys.filter(
            (key) =>
              roots.filter((root) => root.querySelector(`[data-testid="${key}"]`)).length > 1,
          ),
        };
      });
      return e.shared.shared.length === 0;
    },
  );

  await t.probe(
    DEFECTS.silentCreateFailure,
    '供应商质量评分越界（500）时，界面应给出可读的失败原因',
    async (e) => {
      // 先进过订单页与收货页、再去建供应商：表单下拉是页面挂载时的快照（WS-P2-04），
      // 只有「目标页先访问过」这个顺序才测得到它。
      await openRoute(page, PROCUREMENT.orders);
      await openRoute(page, PROCUREMENT.receipts);
      await openRoute(page, PROCUREMENT.suppliers);
      await click(page, 'kt-supplier-create');
      await t.observeBlankSelects('新建供应商');
      await fillSupplier('500');
      const response = await t.write(saveSupplier());
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      return response?.ok !== true && hasCjk(e.visibleError);
    },
  );

  await t.must('新建供应商：改为合法评分后保存，列表出现该供应商（已启用）', async (e) => {
    await ensureForm(t, 'kt-supplier-create', () => fillSupplier('88'));
    await fill(page, 'qualityRating', '88');
    const response = await t.write(saveSupplier());
    e.request = brief(response);
    e.row = await waitRow(page, 'kt-supplier-open', supplier.number);
    world.supplier.id = response?.body?.id ?? null;
    return response?.ok === true && /已启用/u.test(e.row ?? '');
  });

  await t.probe(DEFECTS.rawEnumLabel, '供应商状态筛选按钮应显示中文标签', async (e) => {
    e.labels = await page
      .locator('[data-testid^="kt-supplier-filter-"]')
      .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));
    return e.labels.every((label) => !/^[A-Z_]+$/u.test(label));
  });

  await t.must('物料准入审核（批准）：提交后列表里该供应商显示「已批准 1」', async (e) => {
    await search(page, 'kt-supplier-search', supplier.number);
    await openRow(page, 'kt-supplier-open', supplier.number);
    await click(page, 'kt-supplier-qualify');
    await t.observeBlankSelects('供应商物料准入审核');
    await fill(page, 'action', 'approve', 'value');
    await fill(page, 'itemVersionId', yarn, 'contains');
    await fill(page, 'validFrom', day(-1));
    await fill(page, 'validTo', day(365));
    await fill(page, 'minimumOrderQuantity', '100');
    await fill(page, 'leadTimeDays', '14');
    await fill(page, 'evidenceReference', `E2E-EVID-${stamp}`);
    const response = await t.write(
      submit(page, '提交审核', put(/\/api\/v1\/suppliers\/[^/]+\/qualification$/u)),
    );
    e.request = brief(response);
    e.row = await waitRowMatch(page, 'kt-supplier-open', supplier.number, /已批准 1/u);
    return response?.ok === true && (e.row ?? '').includes(supplier.number);
  });

  await t.probe(
    DEFECTS.staleDetailDrawer,
    '准入审核后，开着的详情抽屉应显示已批准的资质记录',
    async (e) => {
      e.drawer = await drawerText(page, 400);
      return closeAfter(t, !e.drawer.includes('尚无物料准入记录'));
    },
  );

  await t.must('新建并发出询价单：提交后询价列表出现该询价（已签发）', async (e) => {
    await openRoute(page, PROCUREMENT.rfqs);
    await click(page, 'kt-rfq-create');
    await t.observeBlankSelects('创建采购询价');
    await fill(page, 'rfqNumber', rfqNumber);
    await fill(page, 'itemVersionId', yarn, 'contains');
    await fill(page, 'quantity', '1000');
    await fill(page, 'requiredAt', day(30));
    await fill(page, 'responseDue', day(14));
    const response = await t.write(
      submit(page, '发出询价单', post(/^\/api\/v1\/procurement-rfqs$/u)),
    );
    e.request = brief(response);
    e.row = await waitRow(page, 'kt-rfq-open', rfqNumber);
    world.rfqId = response?.body?.id ?? null;
    return response?.ok === true && /已签发/u.test(e.row ?? '');
  });

  await t.probe(DEFECTS.countdownWording, '询价列表不应把币种与倒计时连写', async (e) => {
    e.row = squash(await row(page, 'kt-rfq-open', rfqNumber).innerText());
    return !/CNY(剩|已逾期|今日)/u.test(e.row);
  });

  await t.probe(
    DEFECTS.rfqCloseServerError,
    '关闭询价：已签发的询价应能关闭为「已取消」',
    async (e) => {
      await openRow(page, 'kt-rfq-open', rfqNumber);
      const response = await t.write(
        act(page, 'kt-rfq-close', put(/\/api\/v1\/procurement-rfqs\/[^/]+\/state$/u)),
        { irreversible: true },
      );
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      if (response?.ok !== true) await t.shot();
      await closeDrawer(page);
      e.row = response?.ok === true ? await waitRow(page, 'kt-rfq-open', '已取消') : null;
      if (e.visibleError !== '' && !hasCjk(e.visibleError))
        t.reproduce(DEFECTS.unlocalizedError, '关闭询价失败提示');
      return response?.ok === true && (e.row ?? '').includes(rfqNumber);
    },
  );

  await t.probe(
    DEFECTS.mountTimeChoices,
    '回到「采购订单」页新建订单时，应能选到刚建的供应商',
    async (e) => {
      await openRoute(page, PROCUREMENT.orders);
      await click(page, 'kt-po-create');
      e.options = (await options(page, 'supplierId')).map((option) => option.label);
      return closeAfter(
        t,
        e.options.some((label) => label.includes(supplier.number)),
      );
    },
  );

  await t.probe(
    DEFECTS.silentCreateFailure,
    '向尚未准入该物料的供应商下订单时，界面应给出可读的失败原因',
    async (e) => {
      // 变通：整页刷新后订单页才重新加载供应商选项（WS-P2-04）。
      await reloadRoute(page, PROCUREMENT.orders);
      t.fact('整页刷新后重新进入采购订单页');
      await click(page, 'kt-po-create');
      await t.observeBlankSelects('创建采购订单');
      await fillOrder(order.number, backing, '800', '53');
      const response = await t.write(issueOrder());
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      return response?.ok !== true && hasCjk(e.visibleError);
    },
  );

  await t.probe(
    DEFECTS.integerOnlyNumbers,
    '创建采购订单「含税单价」应能填小数（52.5）',
    async (e) => {
      await ensureForm(t, 'kt-po-create', () => fillOrder(order.decimal, yarn, '10', '52.5'));
      await fillOrder(order.decimal, yarn, '10', '52.5');
      const response = await t.write(issueOrder());
      e.request = brief(response);
      e.blocked = response?.blocked;
      return response?.sent === true;
    },
  );

  await t.must(
    '创建并签发采购订单：提交后订单列表出现该订单（已签发，金额 800 × 53，收货进度 0%）',
    async (e) => {
      // 上一个检查项留着的表单先关掉。再访问一次收货页：整页刷新后各子路由都还没挂载过，
      // 而「签发订单后回到收货页」那条检查项要落在「先看过目标页」的前提下才测得到（WS-P2-04）。
      await closeDrawer(page);
      await openRoute(page, PROCUREMENT.receipts);
      await openRoute(page, PROCUREMENT.orders);
      await click(page, 'kt-po-create');
      await fillOrder(order.number, yarn, '800', '53');
      const response = await t.write(issueOrder());
      e.request = brief(response);
      e.row = await waitRow(page, 'kt-po-open', order.number);
      world.order.id = response?.body?.id ?? null;
      return (
        response?.ok === true &&
        /已签发/u.test(e.row ?? '') &&
        (e.row ?? '').includes('42400') &&
        (e.row ?? '').includes('0%')
      );
    },
  );

  await t.probe(
    DEFECTS.mountTimeChoices,
    '回到「收货管理」页登记收货时，应能选到刚签发的订单行',
    async (e) => {
      await openRoute(page, PROCUREMENT.receipts);
      await click(page, 'kt-gr-create');
      e.options = (await options(page, 'orderLine')).map((option) => option.label);
      return closeAfter(
        t,
        e.options.some((label) => label.includes(order.number)),
      );
    },
  );

  await t.probe(
    DEFECTS.silentCreateFailure,
    '收货数量超过未收量时，界面应给出可读的失败原因',
    async (e) => {
      // 变通：整页刷新后收货表单才看得到刚签发的订单行（WS-P2-04）。
      await reloadRoute(page, PROCUREMENT.receipts);
      t.fact('整页刷新后重新进入收货管理页');
      await click(page, 'kt-gr-create');
      await t.observeBlankSelects('登记采购收货');
      await fillReceipt('', '2000');
      const response = await t.write(postReceipt());
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      return response?.ok !== true && hasCjk(e.visibleError);
    },
  );

  await t.must('登记收货（部分收货 300 / 800）：过账后收货列表出现该收货单', async (e) => {
    await ensureForm(t, 'kt-gr-create', () => fillReceipt('', '300'));
    await fill(page, 'quantity', '300');
    const response = await t.write(postReceipt());
    e.request = brief(response);
    e.row = await waitRow(page, 'kt-gr-open', receipt(''));
    return response?.ok === true && (e.row ?? '').includes(receipt(''));
  });

  await t.probe(
    DEFECTS.siblingListStale,
    '登记收货后，回到「采购订单」页应看到该订单已是「部分收货」',
    async (e) => {
      await openRoute(page, PROCUREMENT.orders);
      await search(page, 'kt-po-search', order.number);
      for (let waited = 0; waited < 6 && !/部分收货/u.test(e.row ?? ''); waited += 1) {
        await page.waitForTimeout(1000);
        e.row = (await rows(page, 'kt-po-open'))[0]?.text ?? null;
      }
      const list = await apiGet(page, '/api/v1/purchase-orders');
      e.apiStatus = list.body?.items?.find((item) => item.id === world.order.id)?.status ?? null;
      return /部分收货/u.test(e.row ?? '');
    },
  );

  await t.must('点订单区的「刷新」后，订单列表显示「部分收货 · 38%」', async (e) => {
    await click(page, 'kt-po-refresh');
    e.row = await waitRowMatch(page, 'kt-po-open', order.number, /部分收货/u);
    return (e.row ?? '').includes(order.number) && (e.row ?? '').includes('38%');
  });

  await t.must(
    '登记收货（余量 500）：过账后回到订单页（点「刷新」），订单显示「已收货 · 100%」',
    async (e) => {
      await openRoute(page, PROCUREMENT.receipts);
      await click(page, 'kt-gr-create');
      await fillReceipt('2', '500');
      const response = await t.write(postReceipt());
      e.request = brief(response);
      e.receiptRow = await waitRow(page, 'kt-gr-open', receipt('2'));
      await openRoute(page, PROCUREMENT.orders);
      await search(page, 'kt-po-search', order.number);
      await click(page, 'kt-po-refresh');
      e.orderRow = await waitRowMatch(page, 'kt-po-open', order.number, /已收货/u);
      return (
        response?.ok === true &&
        !!e.receiptRow &&
        (e.orderRow ?? '').includes(order.number) &&
        (e.orderRow ?? '').includes('100%')
      );
    },
  );

  await t.must('再创建并签发一张订单（供取消检查使用）', async (e) => {
    await search(page, 'kt-po-search', '');
    await click(page, 'kt-po-create');
    await fillOrder(order.spare, yarn, '200', '13');
    const response = await t.write(issueOrder());
    e.request = brief(response);
    e.row = await waitRow(page, 'kt-po-open', order.spare);
    return response?.ok === true && /已签发/u.test(e.row ?? '');
  });

  await t.probe(
    DEFECTS.staleDetailDrawer,
    '取消订单后，开着的详情抽屉应显示「已取消」且不再有「取消订单」按钮',
    async (e) => {
      await openRow(page, 'kt-po-open', order.spare);
      const response = await t.write(
        act(page, 'kt-po-cancel', put(/\/api\/v1\/purchase-orders\/[^/]+\/state$/u)),
        { irreversible: true },
      );
      e.request = brief(response);
      e.drawerBadge = await badge(page, '[data-testid="kt-po-detail"] .status-badge');
      e.cancelButtonLeft = (await drawer(page).locator('[data-testid="kt-po-cancel"]').count()) > 0;
      e.listRow = await waitRow(page, 'kt-po-open', '已取消');
      return closeAfter(
        t,
        response?.ok === true &&
          e.drawerBadge === '已取消' &&
          e.cancelButtonLeft === false &&
          (e.listRow ?? '').includes(order.spare),
      );
    },
  );

  await t.must(
    '接口佐证：订单已收货（800 / 800）、询价已签发或已取消、供应商有已批准的准入',
    async (e) => {
      const orders = (await apiGet(page, '/api/v1/purchase-orders')).body?.items ?? [];
      const found = orders.find((item) => item.id === world.order.id);
      e.order = found && {
        status: found.status,
        received: (found.lines ?? []).map(
          (line) => line.receivedQuantity ?? line.received_quantity,
        ),
      };
      const rfqs = (await apiGet(page, '/api/v1/procurement-rfqs')).body?.items ?? [];
      e.rfqStatus = rfqs.find((item) => item.rfq_number === rfqNumber)?.status ?? null;
      const suppliers = (await apiGet(page, '/api/v1/suppliers')).body?.items ?? [];
      e.qualifications =
        suppliers
          .find((item) => item.id === world.supplier.id)
          ?.qualifications?.map((item) => item.status) ?? [];
      return (
        e.order?.status === 'RECEIVED' &&
        Number(e.order.received[0]) === 800 &&
        ['ISSUED', 'CANCELLED'].includes(e.rfqStatus) &&
        e.qualifications.includes('APPROVED')
      );
    },
  );
}

// ── 制造：物料 / BOM / 工艺路线（新建草稿 → 发布）────────────────────────────
export async function manufacturingFlow(t) {
  const { page, world } = t;
  const stamp = world.stamp;
  const sku = `RM-E2EWS-${stamp}`;
  const bom = { code: `BOM-E2EWS-${stamp}`, decimal: `BOM-E2EWS3-${stamp}` };
  const routing = { code: `RT-E2EWS-${stamp}`, decimal: `RT-E2EWS3-${stamp}` };
  const product = 'FG-KT-PRO-50';
  const yarn = 'RM-KT-YARN-12000';
  const altYarn = 'RM-KT-YARN-11000';
  const backing = 'RM-KT-BACKING-PP';
  world.item = { sku };
  world.bom = { code: bom.code };
  world.routing = { code: routing.code };

  const saveItem = () => submit(page, '保存草稿', post(/^\/api\/v1\/manufacturing-items$/u));
  const saveBom = () => submit(page, '保存 BOM 草稿', post(/^\/api\/v1\/manufacturing-boms$/u));
  const saveRouting = () =>
    submit(page, '保存路线草稿', post(/^\/api\/v1\/manufacturing-routings$/u));
  const fillItem = async (code) => {
    await fill(page, 'sku', code);
    await fill(page, 'name', `E2E写流程冒烟物料-${stamp}`);
    await fill(page, 'baseUnitCode', 'KG');
  };
  const fillBom = async (code) => {
    await fill(page, 'code', code);
    await fill(page, 'name', `E2E写流程冒烟BOM-${stamp}`);
    await fill(page, 'product', product, 'contains');
    await fill(page, 'component', yarn, 'contains');
    await fill(page, 'quantity', '5');
    await fill(page, 'scrap', '100');
  };
  // 组件行 / 工序行的字段前缀（rN: / oN:）里的序号来自页面级计数器：同一页面第二次打开表单时，
  // 新增的行不一定是 r2、首行也不一定是 o1。所以一律从当前表单里读前缀，不写死。
  const rowPrefixes = async (suffix, pattern) =>
    (await fieldNames(page, suffix))
      .filter((name) => pattern.test(name))
      .map((name) => name.slice(0, name.indexOf(':') + 1));
  const componentRows = () => rowPrefixes(':component', /^r\d+:/u);
  const operationRows = () => rowPrefixes(':operationCode', /^o\d+:/u);
  /** 取一个行前缀：缺省取最后一行（新增的行），first=true 取第一行。取不到时给出明确的错。 */
  const need = async (rows, { first = false } = {}) => {
    const all = await rows();
    const prefix = first ? all[0] : all.at(-1);
    if (!prefix) throw new Error(`表单里找不到带行前缀的字段（${first ? '首行' : '新增行'}）`);
    return prefix;
  };
  const fillComponentRow = async (prefix) => {
    await fill(page, `${prefix}component`, backing, 'contains');
    await fill(page, `${prefix}quantity`, '2');
    await fill(page, `${prefix}scrap`, '0');
    await fill(page, `${prefix}substitute`, altYarn, 'contains');
  };
  const addSecondComponent = async () => {
    await click(page, 'kt-bom-row-add');
    await fillComponentRow(await need(componentRows));
  };
  const bomTreeLines = () =>
    drawer(page).locator('[data-testid="kt-bom-tree"] li.bom-tree-line').count();
  const fillRouting = async (code) => {
    await fill(page, 'code', code);
    await fill(page, 'name', `E2E写流程冒烟工艺路线-${stamp}`);
    await fill(page, 'product', product, 'contains');
    const prefix = await need(operationRows, { first: true });
    await fill(page, `${prefix}operationCode`, 'OP-E2EWS-TUFT');
    await fill(page, `${prefix}name`, 'E2E 草簇织造');
    await fill(page, `${prefix}workCenterCode`, 'WC-E2EWS-TUFT');
    return prefix;
  };
  const addSecondOperation = async () => {
    await click(page, 'kt-routing-op-add');
    const prefix = await need(operationRows);
    await fill(page, `${prefix}operationCode`, 'OP-E2EWS-COAT');
    await fill(page, `${prefix}name`, 'E2E 涂胶定型');
    await fill(page, `${prefix}workCenterCode`, 'WC-E2EWS-COAT');
    await fill(page, `${prefix}setupMinutes`, '30');
    await fill(page, `${prefix}runMinutesPerUnit`, '2');
  };
  const operationCodes = () =>
    drawer(page)
      .locator('[name^="o"][name$=":operationCode"]')
      .evaluateAll((nodes) => nodes.map((node) => node.value));
  const stepNames = () =>
    drawer(page)
      .locator('[data-testid="kt-routing-steps"] .routing-step-head strong')
      .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));

  await t.probe(DEFECTS.unlocalizedError, 'SKU 填小写时，界面应显示中文的失败原因', async (e) => {
    // MFG-3B：三个控制台各占一条制造主数据子路由，物料段在 #/manufacturing/items。
    await openRoute(page, 'manufacturing/items');
    await click(page, 'kt-item-create');
    await fillItem(sku.toLowerCase());
    const response = await t.write(saveItem());
    e.request = brief(response);
    e.visibleError = await visibleError(page);
    return response?.ok !== true && hasCjk(e.visibleError);
  });

  await t.must(
    '新建物料（草稿）：保存后列表出现该物料（草稿 · 第 1 版，行内有「发布版本」）',
    async (e) => {
      await ensureForm(t, 'kt-item-create', () => fillItem(sku));
      await fillItem(sku);
      await click(page, 'kt-item-spec-preset');
      const spec = await drawer(page)
        .locator('[name^="spec:"][name$=":value"]')
        .first()
        .getAttribute('name');
      await fill(page, spec, '13500');
      const response = await t.write(saveItem());
      e.request = brief(response);
      e.row = await waitRow(page, 'kt-item-open', sku);
      e.publishButton =
        (await row(page, 'kt-item-open', sku).locator('[data-testid="kt-item-publish"]').count()) >
        0;
      world.item.id = response?.body?.id ?? null;
      return response?.ok === true && DRAFT.test(e.row ?? '') && e.publishButton;
    },
  );

  await t.must('发布物料：点行内「发布版本」后，该行变为「已发布 · 第 1 版」', async (e) => {
    const response = await t.write(
      act(
        page,
        'kt-item-publish',
        post(/\/api\/v1\/manufacturing-item-versions\/[^/]+\/publish$/u),
        { scope: row(page, 'kt-item-open', sku) },
      ),
      { irreversible: true },
    );
    e.request = brief(response);
    e.row = await waitRowMatch(page, 'kt-item-open', sku, PUBLISHED);
    e.publishButtonLeft =
      (await row(page, 'kt-item-open', sku).locator('[data-testid="kt-item-publish"]').count()) > 0;
    return response?.ok === true && (e.row ?? '').includes(sku) && !e.publishButtonLeft;
  });

  // MFG-3B：BOM 段在 #/manufacturing/boms（与物料、工艺路线不同页）。下面三个检查项与「新建 BOM
  // 草稿」共用同一个表单，靠「抽屉是否开着」衔接，所以进路由放在它们之前；进路由只隐藏旧路由的
  // 宿主、不会关掉其中的抽屉，而 kit 的抽屉定位只认可见的，先把上一段留下的抽屉关掉再切。
  await closeDrawer(page);
  await openRoute(page, 'manufacturing/boms');

  await t.probe(
    DEFECTS.mountTimeChoices,
    '刚发布的物料应能立即在「新建 BOM」的成品 / 组件版本下拉里选到',
    async (e) => {
      await click(page, 'kt-bom-create');
      e.options = (await options(page, 'product')).map((option) => option.label);
      return closeAfter(
        t,
        e.options.some((label) => label.includes(sku)),
      );
    },
  );

  await t.probe(
    DEFECTS.noDefaultsOnExtraRows,
    'BOM 第二个组件行应有与首行一致的默认值',
    async (e) => {
      await click(page, 'kt-bom-create');
      await t.observeBlankSelects('新建标准 BOM');
      // 「与首行一致的默认值」指首行打开时的默认值（1 / 0），要在填表之前读：下面的 fillBom 会把首行改成
      // 5 / 100，之后再拿首行的当前值去比，量到的是「新行有没有照抄上一行填过的数」，不是默认值——
      // 第二行已经带上 1 / 0 时仍会被判成复现（WF-C 在真浏览器上实测到这一点）。
      e.defaults = { quantity: await value(page, 'quantity'), scrap: await value(page, 'scrap') };
      await fillBom(bom.decimal);
      await click(page, 'kt-bom-row-add');
      const second = await need(componentRows);
      e.row1 = { quantity: await value(page, 'quantity'), scrap: await value(page, 'scrap') };
      e.row2 = {
        quantity: await value(page, `${second}quantity`),
        scrap: await value(page, `${second}scrap`),
      };
      return (
        e.defaults.quantity !== '' &&
        e.defaults.scrap !== '' &&
        e.row2.quantity === e.defaults.quantity &&
        e.row2.scrap === e.defaults.scrap
      );
    },
  );

  await t.probe(
    DEFECTS.integerOnlyNumbers,
    '新建标准 BOM「单位用量」应能填小数（1.05）',
    async (e) => {
      await fillComponentRow(await need(componentRows));
      await fill(page, 'quantity', '1.05');
      const response = await t.write(saveBom());
      e.request = brief(response);
      e.blocked = response?.blocked;
      return response?.sent === true;
    },
  );

  await t.must(
    '新建 BOM 草稿（两个组件行，第二行带替代料）：列表出现该 BOM（草稿 · 第 1 版，2 行）',
    async (e) => {
      // 上一个检查项若被拦下，表单还开着（已两行）；若请求已发出，表单已关。两种情况都收敛到两行。
      if ((await drawer(page).count()) === 0) await click(page, 'kt-bom-create');
      await fillBom(bom.code);
      if ((await componentRows()).length === 0) await addSecondComponent();
      const response = await t.write(saveBom());
      e.request = brief(response);
      e.row = await waitRow(page, 'kt-bom-open', bom.code);
      world.bom.rootId = response?.body?.bomId ?? null;
      return response?.ok === true && DRAFT.test(e.row ?? '') && /2 行/u.test(e.row ?? '');
    },
  );

  await t.probe(
    DEFECTS.uuidProductColumn,
    'BOM 列表的「产品」列应显示产品编码 / 名称',
    async (e) => {
      e.row = squash(await row(page, 'kt-bom-open', bom.code).innerText());
      return !UUID_IN_PRODUCT.test(e.row);
    },
  );

  await t.probe(DEFECTS.draftBomTreeEmpty, '草稿 BOM 的详情抽屉应显示组件层级', async (e) => {
    await openRow(page, 'kt-bom-open', bom.code);
    await drawer(page)
      .locator('[data-testid="kt-bom-tree"]')
      .waitFor({ timeout: 8000 })
      .catch(() => undefined);
    await page.waitForTimeout(500);
    e.treeLines = await bomTreeLines();
    const detail = await apiGet(page, `/api/v1/manufacturing-boms/${world.bom.rootId}`);
    e.apiDraftLines = detail.body?.versions?.[0]?.lines?.length ?? null;
    return e.treeLines > 0;
  });

  await t.must(
    '发布 BOM（详情内「发布」）：版本徽章变为已发布，组件层级显示两行，其中一行带替代料',
    async (e) => {
      await ensureDrawer(t, 'kt-bom-open', bom.code);
      const response = await t.write(
        act(page, 'kt-bom-publish-version', put(/\/api\/v1\/manufacturing-boms\/[^/]+\/publish$/u)),
        { irreversible: true },
      );
      e.request = brief(response);
      // BOM 的版本条目是纯文字（v1 草稿 / v1 已发布），不是状态徽章组件。
      e.published = await waitBadge(page, '[data-testid="kt-bom-version"]', '已发布');
      await page.waitForTimeout(500);
      e.treeLines = await bomTreeLines();
      e.substitutes = await drawer(page).locator('[data-testid="kt-bom-substitute"]').count();
      return closeAfter(
        t,
        response?.ok === true && e.published && e.treeLines === 2 && e.substitutes === 1,
      );
    },
  );

  // MFG-3B：工艺路线段在 #/manufacturing/routings。切法与上面的 BOM 段相同。
  await closeDrawer(page);
  await openRoute(page, 'manufacturing/routings');

  await t.probe(
    DEFECTS.integerOnlyNumbers,
    '创建标准工艺路线「单件工时（分钟）」保持默认值 0.8 应能保存',
    async (e) => {
      await click(page, 'kt-routing-create');
      await t.observeBlankSelects('创建标准工艺路线');
      await fillRouting(routing.decimal);
      const first = await need(operationRows, { first: true });
      e.defaultRunMinutes = await value(page, `${first}runMinutesPerUnit`);
      const response = await t.write(saveRouting());
      e.request = brief(response);
      e.blocked = response?.blocked;
      return response?.sent === true;
    },
  );

  await t.must(
    '新建工艺路线草稿（两道工序，上移 / 下移调整顺序）：列表出现该路线（草稿 · 第 1 版，2 步）',
    async (e) => {
      // 同 BOM：表单可能由上一个检查项留着，这里收敛到「两道工序、首行单件工时为 1」。
      if ((await drawer(page).count()) === 0) await click(page, 'kt-routing-create');
      const first = await fillRouting(routing.code);
      await fill(page, `${first}runMinutesPerUnit`, '1');
      if ((await operationRows()).length < 2) await addSecondOperation();
      await click(page, 'kt-routing-op-up', { nth: 1 });
      e.afterMoveUp = await operationCodes();
      await click(page, 'kt-routing-op-down', { nth: 0 });
      e.afterMoveDown = await operationCodes();
      e.movesWork = e.afterMoveUp[0] === 'OP-E2EWS-COAT' && e.afterMoveDown[0] === 'OP-E2EWS-TUFT';
      const response = await t.write(saveRouting());
      e.request = brief(response);
      e.row = await waitRow(page, 'kt-routing-open', routing.code);
      world.routing.rootId = response?.body?.routingId ?? null;
      return (
        response?.ok === true && e.movesWork && DRAFT.test(e.row ?? '') && /2 步/u.test(e.row ?? '')
      );
    },
  );

  await t.probe(
    DEFECTS.uuidProductColumn,
    '工艺路线列表的「产品」列应显示产品编码 / 名称',
    async (e) => {
      e.row = squash(await row(page, 'kt-routing-open', routing.code).innerText());
      return !UUID_IN_PRODUCT.test(e.row);
    },
  );

  await t.must('发布工艺路线：版本徽章变为已发布，顺序步骤显示两道工序（顺序正确）', async (e) => {
    await openRow(page, 'kt-routing-open', routing.code);
    e.stepsBeforePublish = await stepNames();
    const response = await t.write(
      act(
        page,
        'kt-routing-publish-version',
        put(/\/api\/v1\/manufacturing-routings\/[^/]+\/publish$/u),
      ),
      { irreversible: true },
    );
    e.request = brief(response);
    e.published = await waitBadge(
      page,
      '[data-testid="kt-routing-versions"] .status-badge',
      '已发布',
    );
    e.steps = await stepNames();
    return closeAfter(
      t,
      response?.ok === true && e.published && e.steps.join(',') === 'E2E 草簇织造,E2E 涂胶定型',
    );
  });

  await t.must(
    '接口佐证：物料 / BOM / 工艺路线均为 PUBLISHED，BOM 两行、路线两道工序',
    async (e) => {
      const item = (await apiGet(page, '/api/v1/manufacturing-items')).body?.items?.find(
        (entry) => entry.sku === sku,
      );
      const bomVersion = (await apiGet(page, '/api/v1/manufacturing-boms')).body?.items?.find(
        (entry) => entry.code === bom.code,
      );
      const routingVersion = (
        await apiGet(page, '/api/v1/manufacturing-routings')
      ).body?.items?.find((entry) => entry.code === routing.code);
      e.states = {
        item: item?.status ?? null,
        bom: bomVersion?.status ?? null,
        bomLines: bomVersion?.lines?.length ?? null,
        routing: routingVersion?.status ?? null,
        routingOperations: routingVersion?.operations?.length ?? null,
      };
      return (
        e.states.item === 'PUBLISHED' &&
        e.states.bom === 'PUBLISHED' &&
        e.states.bomLines === 2 &&
        e.states.routing === 'PUBLISHED' &&
        e.states.routingOperations === 2
      );
    },
  );
}

// ── 信用审查：设置额度 → 发起评估 → 审批 ─────────────────────────────────────
/** 前置数据（经接口，不是界面）：界面发起评估不可用时，造 count 条「等待信用审批」的决定。 */
async function seedPendingDecisions(t, count) {
  const { world } = t;
  if (!world.api) return false;
  const quote = (await world.api.get('/api/v1/quotes')).body?.items?.find(
    (item) => item.status === 'ISSUED',
  );
  const opportunity = (await world.api.get('/api/v1/opportunities')).body?.items?.find(
    (item) => item.id === quote?.opportunityId,
  );
  const limits = (await world.api.get('/api/v1/credit-limits')).body?.items ?? [];
  const limit = limits.find(
    (item) => item.currency === 'CNY' && item.customer_id === opportunity?.customerId,
  );
  if (!quote || !opportunity || !limit) return false;
  for (let index = 0; index < count; index += 1) {
    const created = await world.api.post('/api/v1/credit-decisions', {
      customerId: opportunity.customerId,
      quoteRevisionId: quote.id,
      quoteSnapshotId: quote.issuedSnapshotId,
      creditLimitId: limit.id,
      validUntil: new Date(`${world.day(120)}T23:59:59.000Z`).toISOString(),
    });
    if (created.ok === true) world.credit.pending.push(created.body?.id);
  }
  return world.credit.pending.length > 0;
}

export async function creditFlow(t) {
  const { page, world } = t;
  const number = `E2E-WS-${world.stamp}-CR`;
  const state = put(/\/api\/v1\/credit-decisions\/[^/]+\/state$/u);
  const decisionBadge = '[data-testid="kt-credit-detail"] .status-badge';
  const pendingCount = async () => {
    await click(page, 'kt-credit-filter-pending_approval');
    return (await rows(page, 'kt-credit-open')).length;
  };

  await t.must('设置客户信用额度：保存后接口里出现该额度', async (e) => {
    // 前置：要有一个客户。客户流程没跑时，在这里经界面新建一个。
    if (!world.customer) {
      await openRoute(page, 'customers');
      await createCustomer(t, number, `E2E写流程冒烟信用客户-${world.stamp}`);
    }
    // 整页刷新后进入信用审查：额度表单的客户下拉是挂载时快照（WS-P2-04），不刷新的话本流程
    // 自己新建的客户选不到，结果还会随前面跑了哪些流程而变。
    await reloadRoute(page, 'credit-review');
    await click(page, 'kt-credit-set-limit');
    await t.observeBlankSelects('设置客户信用额度');
    await fill(page, 'customerId', world.customer.name);
    await fill(page, 'amount', '300000');
    await fill(page, 'currency', '人民币');
    await fill(page, 'effectiveAt', world.day(-1));
    await fill(page, 'expiresAt', world.day(365));
    const response = await t.write(submit(page, '保存额度', post(/^\/api\/v1\/credit-limits$/u)));
    e.request = brief(response);
    const limits = (await apiGet(page, '/api/v1/credit-limits')).body?.items ?? [];
    e.saved = limits.some((item) => item.customer_id === world.customer?.id);
    return response?.ok === true && e.saved;
  });

  await t.must(
    '发起信用评估：提交后列表新增一条「等待信用审批」',
    async (e) => {
      await openRoute(page, 'credit-review');
      e.pendingBefore = await pendingCount();
      await click(page, 'kt-credit-evaluate');
      await t.observeBlankSelects('发起信用评估');
      await fill(page, 'quoteRevisionId', 'Q-KT-P1-DEMO', 'contains');
      await fill(page, 'creditLimitId', '人民币 5000000', 'contains');
      await fill(page, 'validUntil', world.day(120));
      const response = await t.write(
        submit(page, '执行信用评估', post(/^\/api\/v1\/credit-decisions$/u)),
      );
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      if (response?.ok !== true) await t.shot();
      await closeDrawer(page);
      if (response?.ok === true) world.credit.pending.push(response.body?.id);
      e.pendingAfter = await pendingCount();
      return response?.ok === true && e.pendingAfter === e.pendingBefore + 1;
    },
    { defect: DEFECTS.creditEvaluateUnusable },
  );

  await t.fixture(
    '前置数据（经接口，不是界面）：界面发起不可用时，补足两条待审批决定供审批步骤使用',
    async (e) => {
      if (world.credit.pending.length >= 2) {
        e.note = '界面发起成功，无需补造';
        return;
      }
      e.created = (await seedPendingDecisions(t, 2 - world.credit.pending.length))
        ? world.credit.pending.length
        : 0;
    },
  );

  await t.probe(
    DEFECTS.serverErrorForUserInput,
    '评估人批准自己发起的决定：应被可读地拒绝（4xx 与中文提示，职责分离）',
    async (e) => {
      if (world.credit.pending.length === 0) t.skip('没有待审批决定');
      // 前置决定是经接口造的，页面上的列表还是造之前加载的；信用审查页没有刷新按钮，整页刷新。
      await reloadRoute(page, 'credit-review');
      await click(page, 'kt-credit-filter-pending_approval');
      await openRowById(page, 'kt-credit-open', world.credit.pending[0]);
      await click(page, 'kt-credit-approve');
      await fill(page, 'reason', 'E2E 写流程冒烟：评估人自批');
      const response = await t.write(submit(page, '确认批准', state), { irreversible: true });
      e.request = brief(response);
      e.visibleError = await visibleError(page);
      await t.shot();
      await closeDrawer(page);
      if (e.visibleError !== '' && !hasCjk(e.visibleError))
        t.reproduce(DEFECTS.unlocalizedError, '信用审批失败提示');
      // 请求先被「缺幂等键」挡住时，到不了职责分离这一步：归到 WS-P1-02，本项记未能判定。
      if (/idempotency/iu.test(response?.error ?? '')) {
        t.reproduce(DEFECTS.creditDecisionUnusable, '评估人自批');
        t.skip('请求被 WS-P1-02 挡住（缺幂等键），到不了职责分离这一步');
      }
      return (
        response?.sent === true &&
        response.ok !== true &&
        (response?.status ?? 0) < 500 &&
        hasCjk(e.visibleError)
      );
    },
  );

  await t.session('approver', async () => {
    // 以下是审批人账号（第二个合成账号）的操作。
    const approverPage = t.page;

    await t.must(
      '审批人批准信用：状态变为「信用已批准」',
      async (e) => {
        if (world.credit.pending.length === 0) t.skip('没有待审批决定');
        const target = world.credit.pending[0];
        await openRoute(approverPage, 'credit-review');
        await click(approverPage, 'kt-credit-filter-pending_approval');
        await openRowById(approverPage, 'kt-credit-open', target);
        await click(approverPage, 'kt-credit-approve');
        await fill(approverPage, 'reason', 'E2E 写流程冒烟：审批人批准');
        const response = await t.write(submit(approverPage, '确认批准', state), {
          irreversible: true,
        });
        e.request = brief(response);
        e.visibleError = await visibleError(approverPage);
        e.drawerBadge = await badge(approverPage, decisionBadge);
        if (response?.ok !== true) await t.shot();
        await closeDrawer(approverPage);
        if (response?.ok === true) world.credit.pending.shift();
        await click(approverPage, 'kt-credit-filter-approved');
        e.row =
          response?.ok === true
            ? await waitRow(approverPage, 'kt-credit-open', '信用已批准')
            : null;
        return response?.ok === true && /信用已批准/u.test(e.row ?? '');
      },
      { defect: DEFECTS.creditDecisionUnusable, skipIf: () => world.credit.pending.length === 0 },
    );

    await t.probe(
      DEFECTS.creditIdentifiedById,
      '信用决定应以客户 / 报价编号标识，而不是 ID 片段',
      async (e) => {
        if (world.credit.pending.length === 0) t.skip('没有待审批决定');
        await click(approverPage, 'kt-credit-filter-pending_approval');
        await openRowById(approverPage, 'kt-credit-open', world.credit.pending[0]);
        e.title = await drawerTitle(approverPage);
        return !/· [0-9a-f]{8}$/u.test(e.title);
      },
    );

    await t.probe(DEFECTS.awkwardConfirmText, '拒绝信用的确认勾选文案应通顺', async (e) => {
      if ((await drawer(approverPage).locator('form.form-section').count()) === 0)
        await click(approverPage, 'kt-credit-reject');
      e.label = squash(await drawer(approverPage).locator('.operation-confirmation').innerText());
      return !e.label.includes('确认要确认');
    });

    await t.must(
      '审批人拒绝信用（填写理由并勾选确认）：状态变为「信用已拒绝」',
      async (e) => {
        if (world.credit.pending.length === 0) t.skip('没有待审批决定');
        await fill(approverPage, 'reason', 'E2E 写流程冒烟：审批人拒绝');
        const confirmation = drawer(approverPage).locator('[data-confirmation="true"]');
        if ((await confirmation.count()) > 0) await confirmation.check();
        // 拒绝表单的提交按钮自 TD-WF-014⑤ 起叫「拒绝这条信用决定」（原「确认拒绝」，勾选项会读作
        // 「我确认要确认拒绝」）。这里只是定位提交按钮的文字，断言不变。
        const response = await t.write(submit(approverPage, '拒绝这条信用决定', state), {
          irreversible: true,
        });
        e.request = brief(response);
        e.visibleError = await visibleError(approverPage);
        if (response?.ok !== true) await t.shot();
        await closeDrawer(approverPage);
        if (response?.ok === true) world.credit.pending.shift();
        await click(approverPage, 'kt-credit-filter-rejected');
        e.row =
          response?.ok === true
            ? await waitRow(approverPage, 'kt-credit-open', '信用已拒绝')
            : null;
        return response?.ok === true && !!e.row;
      },
      { defect: DEFECTS.creditDecisionUnusable, skipIf: () => world.credit.pending.length === 0 },
    );
  });
}

// ── 报价：新建（过销售政策）→ 批准 → 签发 ────────────────────────────────────
export async function quoteFlow(t) {
  const { page, world } = t;
  const stamp = world.stamp;
  const quote = {
    number: `Q-E2EWS-${stamp}`,
    rejected: `Q-E2EWS2-${stamp}`,
    decimal: `Q-E2EWS3-${stamp}`,
  };
  world.quote = { number: quote.number };
  const fillQuote = async (number, price, quantity, installPrice, servicePrice) => {
    await fill(page, 'quoteNumber', number);
    await fill(page, 'costDecisionId', 'CNY 721000', 'contains');
    await fill(page, 'policyVersionId', 'SP-KT-P1-DEMO', 'contains');
    await fill(page, 'turfQuantity', quantity);
    await fill(page, 'turfPrice', price);
    await fill(page, 'installationQuantity', quantity);
    await fill(page, 'installationPrice', installPrice);
    await fill(page, 'serviceQuantity', '1');
    await fill(page, 'servicePrice', servicePrice);
    await fill(page, 'discountPercent', '5');
    await fill(page, 'validUntil', world.day(180));
  };
  const createQuote = () => submit(page, '校验并创建报价', post(/^\/api\/v1\/quotes$/u));
  // 界面先做销售政策校验，再创建报价；未过政策时只发出前一个请求。
  const evaluatePolicy = () =>
    submit(page, '校验并创建报价', post(/\/api\/v1\/sales-policy-evaluations$/u));

  await t.probe(
    DEFECTS.integerOnlyNumbers,
    '新建销售报价「草坪销售单价（元/㎡）」应能填小数（108.5）',
    async (e) => {
      await openRoute(page, 'quotes');
      await click(page, 'kt-quote-create');
      await t.observeBlankSelects('新建销售报价');
      await fillQuote(quote.decimal, '108.5', '8050', '28', '60000');
      const response = await t.write(createQuote());
      e.request = brief(response);
      e.blocked = response?.blocked;
      return response?.sent === true;
    },
  );

  await t.probe(
    DEFECTS.errorOffScreen,
    '报价未过销售政策时，失败提示应出现在看得见的位置',
    async (e) => {
      await ensureForm(t, 'kt-quote-create', () => undefined);
      await fillQuote(quote.rejected, '108', '1000', '25', '5000');
      const response = await t.write(evaluatePolicy());
      e.request = brief(response);
      e.position = await errorPosition(page);
      return e.position !== null && e.position.inViewport === true;
    },
  );

  await t.must('新建报价（通过销售政策校验）：提交后列表出现该报价（草稿）', async (e) => {
    await ensureForm(t, 'kt-quote-create', () => undefined);
    await fillQuote(quote.number, '108', '8050', '28', '60000');
    const response = await t.write(createQuote());
    e.request = brief(response);
    e.visibleError = await visibleError(page);
    e.row = await waitRow(page, 'kt-quote-open', quote.number);
    return response?.ok === true && /草稿/u.test(e.row ?? '');
  });

  await t.must('批准报价（填写审批意见）：列表状态变为「已批准」', async (e) => {
    await search(page, 'kt-quote-search', quote.number);
    await openRow(page, 'kt-quote-open', quote.number);
    await click(page, 'kt-quote-approve');
    await fill(page, 'reason', 'E2E 写流程冒烟：批准报价');
    const response = await t.write(
      submit(page, '确认批准', post(/\/api\/v1\/quote-revisions\/[^/]+\/approve$/u)),
      { irreversible: true },
    );
    e.request = brief(response);
    e.row = await waitRowMatch(page, 'kt-quote-open', quote.number, /已批准/u);
    return response?.ok === true && (e.row ?? '').includes(quote.number);
  });

  await t.probe(
    DEFECTS.staleDetailDrawer,
    '批准报价后，开着的详情抽屉应显示「已批准」且不再有「批准报价」',
    async (e) => {
      e.drawerBadge = await badge(page);
      e.approveButtonLeft =
        (await drawer(page).locator('[data-testid="kt-quote-approve"]').count()) > 0;
      return closeAfter(t, e.drawerBadge === '已批准' && !e.approveButtonLeft);
    },
  );

  await t.must('签发报价：列表状态变为「已签发」', async (e) => {
    await openRow(page, 'kt-quote-open', quote.number);
    await click(page, 'kt-quote-issue');
    const response = await t.write(
      submit(page, '确认签发', post(/\/api\/v1\/quote-revisions\/[^/]+\/issue$/u)),
      { irreversible: true },
    );
    e.request = brief(response);
    e.row = await waitRowMatch(page, 'kt-quote-open', quote.number, /已签发/u);
    return response?.ok === true && (e.row ?? '').includes(quote.number);
  });

  await t.probe(
    DEFECTS.staleDetailDrawer,
    '签发报价后，开着的详情抽屉应显示「已签发」且不再有「签发报价」',
    async (e) => {
      e.drawerBadge = await badge(page);
      e.issueButtonLeft =
        (await drawer(page).locator('[data-testid="kt-quote-issue"]').count()) > 0;
      return closeAfter(t, e.drawerBadge === '已签发' && !e.issueButtonLeft);
    },
  );

  await t.probe(
    DEFECTS.focusLostInDrawer,
    '打开行内表单后，焦点应留在抽屉内，Esc 仍能关闭抽屉',
    async (e) => {
      // 关掉重开，让抽屉拿到签发后的最新数据（上面那条检查项若未复现，这一步本身是多余的）。
      await openRow(page, 'kt-quote-open', quote.number);
      await click(page, 'kt-quote-revise');
      e.activeElement = await page.evaluate(() => globalThis.document.activeElement?.tagName);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      e.drawerStillOpen = (await drawer(page).count()) > 0;
      return closeAfter(t, e.activeElement !== 'BODY' && !e.drawerStillOpen);
    },
  );

  await t.must('接口佐证：报价状态 ISSUED', async (e) => {
    const list = (await apiGet(page, '/api/v1/quotes')).body?.items ?? [];
    const found = list.find((item) => item.quoteNumber === quote.number);
    e.quote = found && { revision: found.revision, status: found.status };
    return found?.status === 'ISSUED';
  });
}
