// 写流程冒烟的缺陷目录（TD-TEST-024）。每条对应 write-smoke 里的一个检查项：检查项断言的是
// 「正确行为」，不成立即记为该缺陷已复现，并留存截图与现场。分级口径：P1 数据写错 / 写路径坏了 / 功能不可用；P2 用户一眼能看到的交互或呈现缺陷；
// P3 细小问题。
// 首次登记于 8b3f24d（2026-11-24），此后随 main 前进复测：4c2a7ca（采购子路由化、TD-UI-009 修复后）
// 与 c570dcb（合入生产工单控制台后）各一轮，最后在 main 3ba2e9e（工单标识改名 kt-wo- 之后）收口：
// WS-P2-07 未复现（已修复），WS-P2-03 随子路由化不再出现（条目保留作回归检查），
// WS-P3-09 自 c570dcb 出现、1cabe3f 修复（条目保留作回归检查）。
// tracking：已另有台账编号的条目，报告里单列一组供对账，不算本批新发现。
// fixedIn（TD-TEST-029）：该缺陷修复提交的完整 40 位 SHA（必须在 main 历史上）。有此字段的条目
// 是已修复缺陷的回归检查，cause 一律写成「修复前是这样，已于某提交修复」；没有单独修复提交、
// 只靠检查项守着的条目不写此字段，cause 保持描述现状（哪些算「已被别的提交修复」以台账与
// WF-A / WF-B / WF-C 三份证据文档为准——例如 WS-P2-03 随子路由化不再复现，但没有针对它的修复提交）。

const defect = (id, severity, title, repro, cause, extra = {}) => ({
  id,
  severity,
  title,
  repro,
  cause,
  ...(extra.tracking ? { tracking: extra.tracking } : {}),
  ...(extra.fixedIn ? { fixedIn: extra.fixedIn } : {}),
});

export const DEFECTS = Object.freeze({
  // ── P1 ────────────────────────────────────────────────────────────────────
  creditEvaluateUnusable: defect(
    'WS-P1-01',
    'P1',
    '信用审查「发起信用评估」不可用：点「执行信用评估」不发请求、无任何提示',
    [
      '信用审查 → ＋ 发起信用评估',
      '已签发报价、信用额度版本、信用决定有效期至三项都选好',
      '点「执行信用评估」',
      '期望：发出 POST /api/v1/credit-decisions，列表新增一行「等待信用审批」',
      '实际：没有发出任何请求，抽屉原样留着，界面上没有报错',
    ],
    '修复前：credit-console.tsx 的 runEvaluate 要求 quote.customerId 是字符串，否则抛「报价未关联有效客户」；' +
      '而报价视图 SELECT（commercial-repositories.ts QUOTES_VIEW_SELECT）不含任何客户字段；' +
      '抛出的错误只写进 submitError，评估抽屉不渲染它。' +
      '已于 551952a 修复：报价视图投影补选所属商机的 customerId，评估请求可正常发出（台账 TD-WF-001）',
    { fixedIn: '551952a70545a0887adf4f5d7ffae4ede021d5f5' },
  ),
  creditDecisionUnusable: defect(
    'WS-P1-02',
    'P1',
    '信用审查「批准信用 / 拒绝信用」不可用：PUT 缺 idempotency-key，接口 400',
    [
      '以审批人账号打开一条「等待信用审批」的信用决定',
      '点「批准信用」，填写审批理由，点「确认批准」',
      '期望：PUT /api/v1/credit-decisions/:id/state 成功，状态变「信用已批准」',
      '实际：接口 400「Idempotency-Key is required」，抽屉里显示这行英文，状态不变',
    ],
    '修复前：shared/commercial-http.ts 的 submit 只在 POST 时附带 idempotency-key；信用决定走 PUT，' +
      '而 credit-review 路由强制要求该请求头。' +
      '已于 dcdb19b 修复：商业写请求（POST / PUT / PATCH）一律带 idempotency-key 请求头（台账 TD-WF-002）',
    { fixedIn: 'dcdb19b352087336597f7da7d293dccf62c238d0' },
  ),
  rfqCloseServerError: defect(
    'WS-P1-03',
    'P1',
    '询价「关闭询价」接口 500：已签发询价无法关闭',
    [
      '采购管理 → 询价管理 → 打开一张「已签发」询价 → 点「关闭询价」',
      '期望：询价变「已取消」',
      '实际：PUT /api/v1/procurement-rfqs/:id/state 返回 500，抽屉显示「Internal server error」',
    ],
    '修复前：closeRfq（procurement-repositories.ts）对 DRAFT/ISSUED 询价执行 UPDATE，但迁移 0038 的触发器 ' +
      'guard_rfq_update 规定「非草稿询价不可更新」（RAISE EXCEPTION）；接口没有把这个数据库异常翻译成 4xx。' +
      '界面上询价只能「创建即签发」，所以这个按钮在实际使用中必然失败。' +
      '已于 891df58 修复：迁移 0076 只重定义 guard_rfq_update，已签发询价允许仅状态迁移到 CANCELLED，' +
      '守卫拒绝在端点映射 409 + 中文提示（台账 TD-WF-003）',
    { fixedIn: '891df581b7d2d795328b0083a963db788c12e157' },
  ),
  duplicateSubmit: defect(
    'WS-P1-04',
    'P1',
    '提交按钮没有防重复：双击「创建线索」写入两条线索',
    [
      '销售线索 → ＋ 新建线索，填好标题与来源',
      '快速双击「创建线索」',
      '期望：只创建一条',
      '实际：发出两次 POST /api/v1/leads，均 201，列表与接口里出现两条同名线索',
    ],
    '修复前：packages/ui FormSection 的提交按钮在请求期间不置灰，每次点击各用一个新幂等键。' +
      '有唯一编号的对象（客户、供应商、订单等）第二次请求会撞唯一约束并表现为静默的 500；' +
      '没有唯一约束的对象（线索、联系人、活动）直接产生重复记录。' +
      '已于 d10a353 修复：FormSection 用同步重入标志拦下提交未结算期间的再次提交；' +
      '四个表单丢弃 onSubmit Promise 致守卫在这些表单上不生效，由 f5a6919 交还 Promise（台账 TD-WF-004）',
    { fixedIn: 'd10a3537abf92dff415f1e344dba11342879d49d' },
  ),

  // ── P2 ────────────────────────────────────────────────────────────────────
  silentCreateFailure: defect(
    'WS-P2-01',
    'P2',
    '新建抽屉里服务端拒绝后界面没有任何提示',
    [
      '在新建抽屉里填入服务端会拒绝的数据（例：质量评分 500；未准入供应商的订单；超量收货；重复的客户编号）',
      '点提交',
      '期望：抽屉里出现可读的失败原因',
      '实际：接口已返回 400 / 409 / 500，抽屉原样留着，页面上没有任何错误文字',
    ],
    '修复前：各控制台的 fail() 把错误写进 submitError，而 kt-*-submit-error 只在详情抽屉里渲染，' +
      '新建抽屉没有错误位。' +
      '已于 8bcd469 修复：FormSection 新增 error 属性（c86217b），29 处新建与行内表单接入，' +
      '失败原因显示在表单自己的提示区（台账 TD-WF-005）',
    { fixedIn: '8bcd4695db700ca8e27bebc2e84770a67590c92a' },
  ),
  unlocalizedError: defect(
    'WS-P2-02',
    'P2',
    '错误提示直接显示接口英文原文，未本地化',
    [
      '触发一次服务端校验失败（例：联系人只填姓名就保存；物料 SKU 填小写；关闭已签发询价）',
      '期望：中文说明',
      '实际：显示「Contact email or phone is required」「Code must be 1-64 uppercase letters…」' +
        '「Internal server error」等英文原文',
    ],
    '修复前：控制台把 error.message（接口返回的 message）原样写入 .console-error。' +
      '已于 c1a20d3 修复：新增 apps/web/src/shared/api-error-message.ts，服务端常见拒绝原因转成中文再显示；' +
      '信用控制台的一处由 a2d3ae5 补接（台账 TD-WF-006）',
    { fixedIn: 'c1a20d31cc700c7819b3e760f3f733bed8699324' },
  ),
  siblingListStale: defect(
    'WS-P2-03',
    'P2',
    '登记收货后订单列表不及时更新（8b3f24d 复现；4c2a7ca 采购子路由化后未复现）',
    [
      '8b3f24d（四个控制台同屏时）：对已签发订单登记收货并过账',
      '实际：同屏的采购订单列表仍停在「已签发 · 0%」，接口已是部分收货；点订单区的「刷新」才更新',
      '4c2a7ca 起（四个控制台各占一条子路由）：登记收货后回到「采购订单」页，列表已是「部分收货 · 38%」',
    ],
    '8b3f24d 上收货控制台写完只刷新自己的数据，不通知同页的订单控制台；拆成子路由后回到订单页时读到的是最新数据',
  ),
  mountTimeChoices: defect(
    'WS-P2-04',
    'P2',
    '表单下拉选项是页面挂载时的快照：新建的对象在别的表单里选不到',
    [
      '先进过「采购订单」页 → 到「供应商与准入」新建供应商 → 回到「采购订单」点新建：供应商下拉里没有它',
      '先进过「收货管理」页 → 在「采购订单」签发订单 → 回到「收货管理」点登记：采购订单行下拉里没有它',
      '制造主数据：在「物料管理」发布物料后到「BOM 管理」点「新建 BOM」：成品 / 组件版本下拉里没有它',
      '整页刷新后才出现；切换路由无效。没先进过目标页时不会遇到（目标页在对象建好之后才首次挂载）',
    ],
    '修复前：各宿主在挂载时一次性算出 supplierChoices / itemVersionChoices / openOrderLineChoices，' +
      '之后不再更新。' +
      '已于 c6654fa 修复：表单下拉选项改为读取时按最新视图计算（六个采购制造宿主与信用宿主，' +
      '台账 TD-WF-007；信用额度与线索负责人的客户下拉除外，见 TD-WF-015）',
    { fixedIn: 'c6654fa30c298acb2a678067da95cbe39956620b' },
  ),
  staleDetailDrawer: defect(
    'WS-P2-05',
    'P2',
    '详情抽屉在写操作后不刷新：仍是旧状态、旧按钮还在',
    [
      '打开一张已签发订单点「取消订单」：列表行已变「已取消」，抽屉仍显示「已签发」且「取消订单」按钮还在',
      '再点一次这个残留按钮：接口 404，抽屉显示「Open purchase order not found」',
      '供应商准入审核后抽屉仍显示「尚无物料准入记录」',
      '报价批准 / 签发后抽屉顶部仍是旧状态，同一抽屉里的版本时间线却已是新状态',
    ],
    '修复前：runState / runQualify / runCommand 刷新了列表，但没有用新数据替换选中的那一行（selected）。' +
      '已于 322716c 修复：写后刷新列表时用最新行替换抽屉里的记录，记录已不在列表则关闭抽屉；' +
      '采购订单与询价另重读详情，迟到响应不串位（台账 TD-WF-008）',
    { fixedIn: '322716ca730ca69d5e1b1f8b523088b69c4a837b' },
  ),
  blankRequiredSelect: defect(
    'WS-P2-06',
    'P2',
    '必填下拉框默认是空选，第一次提交被浏览器原生校验拦下',
    [
      '打开任一带必填下拉的表单（线索来源、设为主联系人、活动类型、采购物料、供应商、采购订单行…）',
      '不碰下拉框，直接提交',
      '实际：下拉框显示为空白，弹出浏览器原生提示（语言随浏览器，本环境为英文 "Please select an item in the list."）',
    ],
    '修复前：FormSection 对没有显式默认值的 select 以空串作为受控值并保留原生 required，' +
      '没有任何选项被选中时首次提交被浏览器拦下，「否 / 是」这类布尔项尤其应当有默认值。' +
      '已于 9591547 修复：必填下拉不再带原生 required（保留 aria-required），' +
      '空选提交由表单给出「请选择X」中文提示（台账 TD-WF-009）',
    { fixedIn: '95915471a93d75dd5b5ecff55319624458bf3cfd' },
  ),
  integerOnlyNumbers: defect(
    'WS-P2-07',
    'P2',
    '数字字段未设 step：小数被浏览器原生校验拦下、请求不发出（TD-UI-009；main b32402f 已修复）',
    [
      '同类现象，每行一个「表单「字段」」，根因相同：',
      '创建采购订单「含税单价」（52.5）',
      '新建销售报价「草坪销售单价（元/㎡）」（108.5）',
      '新建标准 BOM「单位用量」（1.05）',
      '创建标准工艺路线「单件工时（分钟）」（默认值 0.8，不改也会被拦）',
      '设置客户信用额度「信用额度」（250000.5；探查时所见，未列为检查项）',
      '表现一致：浏览器原生提示 "The two nearest valid values are …"，请求不会发出',
    ],
    '修复前：FormSection 与旧版 openForm 对没写 step 的数字字段不输出 step，浏览器按步长 1 校验。' +
      '已于 b32402f 修复：未指定 step 的数字字段输出 step="any"，接口载荷不变（台账 TD-UI-009）',
    { tracking: { tracker: 'TD-UI-009' }, fixedIn: 'b32402ffb405cf74dc73a375a675047f4a54ff1f' },
  ),
  uuidProductColumn: defect(
    'WS-P2-08',
    'P2',
    'BOM 与工艺路线列表的「产品」列显示裸 UUID',
    [
      '制造主数据 → 「BOM 管理」「工艺路线」两页，看「产品」列',
      '实际：显示「产品 cf66d213-5cb3-441f-a8b4-2e064337900f」，而不是产品编码与名称',
    ],
    '修复前：bom-console.tsx 与 routing-console.tsx 把 productItemId 直接渲染进「产品」列。' +
      '已于 184290c 修复：宿主把 productItemId 解析成「SKU · 名称」（解析不到退回 id），排序改按显示文字' +
      '（台账 TD-WF-010）',
    { fixedIn: '184290c5ba8aa6c6e76b6aa038d7e19e7d6c5b2d' },
  ),
  draftBomTreeEmpty: defect(
    'WS-P2-09',
    'P2',
    '草稿 BOM 的详情抽屉「组件层级」为空，发布前无法核对行项',
    [
      '新建一张两行组件的 BOM 草稿 → 列表显示「2 行」 → 点「查看」',
      '期望：看到两个组件',
      '实际：「组件层级」下是空的；发布之后才显示',
    ],
    '修复前：详情抽屉只读接口顶层的 tree（只反映已发布版本），草稿行项在 versions[].lines 里；' +
      '同款的工艺路线抽屉对草稿是显示工序的。' +
      '已于 4209326 修复：没有任何已发布版本时，接口的组件树以最新草稿版本为根（台账 TD-WF-011；' +
      '「已发布 + 更新草稿并存」的路径见 TD-WEB-017）',
    { fixedIn: '4209326810e161c2e7a9d3aed4fb6c5dc00c1871' },
  ),
  errorOffScreen: defect(
    'WS-P2-10',
    'P2',
    '错误提示渲染在抽屉顶部且不滚动到可见位置：长表单提交失败时看不到',
    [
      '销售报价 → ＋ 新建报价，填入会让毛利率低于红线的数字（例：草坪 1000 × 108）',
      '点最下方的「校验并创建报价」',
      '实际：提示「销售政策未通过：毛利率低于 22% 红线」在抽屉顶部，位于视口上方，用户看到的仍是「点了没反应」',
    ],
    '修复前：错误位在 .drawer-body 顶部，提交后不滚动、不聚焦。' +
      '已于 2ae9e7c 修复：提示出现时滚进可视区并把键盘焦点移过去（tabindex=-1，不进入 Tab 序列），' +
      '提交成功时不动（台账 TD-WF-012）',
    { fixedIn: '2ae9e7c7f15b31ceebf5eaaa25e6b31f644d6517' },
  ),
  serverErrorForUserInput: defect(
    'WS-P2-11',
    'P2',
    '用户可纠正的输入错误返回 500，而不是带说明的 4xx',
    [
      '用已存在的客户编号再建一个客户：POST /api/v1/customers 返回 500「Internal server error」',
      '（补上幂等键后）评估人批准自己的信用决定：返回 500「Internal server error」',
    ],
    '修复前：唯一约束冲突与数据库触发器异常没有被映射成 409 / 403，统一落到 500。' +
      '已于 b16784c 修复：重复客户编号 → 409「客户编号已存在」、评估人自批 → 403；' +
      '名称重复与 legacy 审批轨自批由 77c7339 补齐（台账 TD-WF-013）',
    { fixedIn: 'b16784cb33414416c067fbe586fcb16daeb1846d' },
  ),

  // ── P3 ────────────────────────────────────────────────────────────────────
  noSuccessNotice: defect(
    'WS-P3-01',
    'P3',
    '所有写操作都没有成功提示',
    [
      '完成任一写操作（新建、发布、认领、取消…）',
      '实际：没有 toast 或状态提示，唯一的反馈是抽屉关闭 / 列表变化；在「草稿」筛选下发布物料后，那一行直接消失、列表变空',
    ],
    '修复前：基座没有成功提示，写操作唯一的反馈是抽屉关闭 / 列表变化。' +
      '已于 9e0bc5a 修复：写成功后的状态行（role=status），供应商 / 采购订单 / 询价 / 收货 / 物料 / BOM / ' +
      '工艺路线 / 报价 / 信用 / 线索 / 客户十一个控制台的写动作接入（台账 TD-WF-014 之一）',
    { fixedIn: '9e0bc5a02be637eb90813af18ad27ec01cd69dda' },
  ),
  noConfirmDialog: defect(
    'WS-P3-02',
    'P3',
    '不可逆操作没有确认对话框',
    ['发布物料 / BOM / 工艺路线、取消订单、关闭询价、签发报价、认领线索：单击即生效'],
    '修复前：各控制台直接在 onClick 里发起写请求。' +
      '已于 6b1e757（packages/ui ConfirmDialog）与 df60062（发布 / 取消 / 关闭 / 签发接入，破坏性动作初焦在取消）' +
      '修复（台账 TD-WF-014 之一）',
    { fixedIn: 'df600623854b1412ef2134d16896f05f6fd498fd' },
  ),
  rawEnumLabel: defect(
    'WS-P3-03',
    'P3',
    '供应商状态筛选按钮显示枚举原文 ON_HOLD',
    ['采购管理 → 供应商与准入 → 筛选按钮依次为 全部 / 已启用 / ON_HOLD / 已停用'],
    '修复前：supplier-console.tsx 的 STATUS_LABELS 没有 ON_HOLD 的中文标签。' +
      '已于 012a9c6 修复：ON_HOLD 读作「暂停」（筛选按钮、列表列、抽屉徽章；台账 TD-WF-014 之一）',
    { fixedIn: '012a9c674332bf27b65a09e4c5a2985d89edc32b' },
  ),
  focusLostInDrawer: defect(
    'WS-P3-04',
    'P3',
    '打开行内表单后键盘焦点掉到页面主体，Esc 无法再关闭抽屉',
    [
      '打开报价详情（焦点在关闭按钮上，Esc 可关闭）→ 点「创建报价修订」',
      '实际：焦点落到 body，按 Esc 抽屉和表单都不关闭',
    ],
    '修复前：被点击的按钮随表单打开而移除，焦点没有移入新表单；Esc 只在焦点位于对话框内时生效。' +
      '已于 9140b9d 修复：FocusAnchor 在行内表单开合或按钮被移除后把键盘焦点带回抽屉 / 行；' +
      '真浏览器抓到的越界回归由 23861af 修复（台账 TD-WF-014 之一）',
    { fixedIn: '9140b9ddc1983f6cf7e6d9154a34c8a7e769493b' },
  ),
  awkwardConfirmText: defect(
    'WS-P3-05',
    'P3',
    '拒绝信用的确认勾选文案是「我确认要确认拒绝」',
    ['信用决定 → 拒绝信用：表单里的勾选项写着「我确认要确认拒绝」'],
    '修复前：FormSection 用「我确认要」+ 提交按钮文字拼文案。' +
      '已于 746ae5c 修复：提交按钮改「拒绝这条信用决定」，勾选项读作通顺一句（台账 TD-WF-014 之一）',
    { fixedIn: '746ae5c8bb2b406db8db8881c883c4a10e98c4d6' },
  ),
  noDefaultsOnExtraRows: defect(
    'WS-P3-06',
    'P3',
    'BOM 组件行 / 工艺路线工序行从第 2 行起没有默认值',
    [
      '新建 BOM → ＋ 添加组件行：第 1 行单位用量 / 损耗默认 1 / 0，第 2 行为空',
      '新建工艺路线 → ＋ 添加工序：第 1 行准备 / 单件工时默认 60 / 0.8，第 2 行为空',
    ],
    '修复前：FormSection 的值状态只在挂载时初始化，「＋ 添加行」追加的字段取不到字段配置的默认值。' +
      '已于 5b9de63 修复：挂载后才出现的字段取配置默认值（渲染 / 校验 / 提交一致；台账 TD-WF-014 之一）；' +
      '本检查项的比较口径由 3fae094 同步改为首行默认值',
    { fixedIn: '5b9de6343edba8278f0b863ce50ad21078324936' },
  ),
  countdownWording: defect(
    'WS-P3-07',
    'P3',
    '询价列表把币种与倒计时连在一起显示',
    ['询价管理列表的「报价截止」列显示「2026-12-01 · CNY剩 7 天」「CNY已逾期 84 天」'],
    '修复前：rfq-console.tsx 的「报价截止」列把币种与倒计时连写。' +
      '已于 37cfd50 修复：币种与倒计时以「 · 」分隔（台账 TD-WF-014 之一）',
    { fixedIn: '37cfd50459db656df9d33d5ad28b0af53b682a31' },
  ),
  creditIdentifiedById: defect(
    'WS-P3-08',
    'P3',
    '信用决定只用报价版本 ID 的前 8 位标识，不显示客户或报价编号',
    ['信用审查列表的「关联报价」列与详情抽屉标题都是「5e93c116」这样的 ID 片段'],
    '修复前：credit-console.tsx 用 quoteVersionId.slice(0, 8) 标识信用决定。' +
      '已于 b62fbff 修复：以「客户 · 报价 编号 · 第 N 版」标识（列表列、抽屉标题与检索口径；' +
      '台账 TD-WF-014 之一）',
    { fixedIn: 'b62fbffd274c269de045f398d0f0ef88b48e482e' },
  ),
  testidCollision: defect(
    'WS-P3-09',
    'P3',
    '生产工单控制台与采购订单控制台的 data-testid 撞名（c570dcb 出现；main 1cabe3f 已把工单侧改名 kt-wo-）',
    [
      '生产工单的 po 是 production order，采购订单的 po 是 purchase order，c570dcb 上两个控制台都用 kt-po- 前缀',
      '源码里曾共 7 个撞名；页面上实测同时出现在两个控制台里的有 kt-po-create、kt-po-open、kt-po-refresh、kt-po-search',
      '用户看不到 data-testid；不限定范围的自动化会定位到隐藏路由里的同名元素',
      '本冒烟在 c570dcb 上第一次跑时，「创建并签发采购订单」就落在了隐藏的「＋ 新建生产工单」上而超时',
      '仓库自己的 p1-demo.spec 按行 / 抽屉限定范围，不受影响；本冒烟已改为只在可见元素里定位',
      'main 1cabe3f 把工单侧 89 处标识改成 kt-wo-*，撞名解除；本条目保留作回归检查',
    ],
    '修复前：production-order-console.tsx 等新文件沿用了 kt-po- 前缀，与采购订单控制台撞名。' +
      '已于 1cabe3f 修复：工单侧 89 处标识改成 kt-wo-*；本条目保留作回归检查',
    { fixedIn: '1cabe3f4cc2b5ad14b2e1440e08ac184e1ec58a6' },
  ),
});

/** 缺陷目录的顺序表（报告按此顺序输出）。 */
export const DEFECT_LIST = Object.freeze(Object.values(DEFECTS));
