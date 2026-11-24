# U3-MFG-4 工单管理控制台 + Fastify production-orders 端点组证据（2026-11-24）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + U3-MFG 指令（MFG-4 工单管理子批；
> MFG-3-CP 已复核通过；隔离工作协议——独立 worktree 分支
> `mfg/mfg-4-production-orders`、专用一次性 PG 容器 kingturf-pg-mfg4
> （kingturf_test_mfg4），不触主工作树与其暂存区）。vanilla「生产工单与车间执行」
> 卡片退役沿用裁定 17 语义；**工序报工 / 领退料 / 成品卷入库三张表单不在本批端点
> 范围（MFG-5 报工入库），保留 vanilla 原函数（180 行逐字节机械比对相等），经宿主
> 挂进控制台详情抽屉**——直接删卡片会让这三项能力在 MFG-5 之前从界面消失，故按
> MFG-1 先例只退役已迁移部分。f3 冻结场景按已批 re-pin 先例适配。
> 分支已按主协调通知 rebase 到 `4c2a7ca`（PROC-2 子路由化 + TD-UI-009 修复之后），
> 两个提交与该批文件零交集、rebase 干净。

## 0. 发布写路径勘探（指令要求先查清）

legacy **已有**工单全部写路径：仓储 `create / transition / transactMaterial /
reportOperation / createOutput`（production-repositories.ts）+ legacy 路由
production-order-create.ts / production-order-commands.ts / production-material.ts /
production-report.ts / production-output.ts。状态机权威在 DB 触发器
validate_production_order_event（迁移 0042）：DRAFT→RELEASED|CANCELLED、
RELEASED→IN_PROGRESS|CANCELLED、IN_PROGRESS→COMPLETED|CANCELLED、COMPLETED→CLOSED、
终态不可变。legacy 五个命令动作（release/start/complete/close/cancel）= 目标状态 +
能力键的固定映射（production-order-commands.ts 的 commands 表）；vanilla 界面只暴露
前四个（无「取消」），另有报工 / 领退料 / 成品卷入库三张表单。**指令 B 段的「分配 /
异常上报」在 legacy 中不存在**（无对应写路径与界面入口），按「不发明新写语义」未实现。

## 1. Fastify production-orders 端点组（registry 认领 +4，累计 72 路径/19 文件不含 registry）

| 端点                                                   | 守恒语义                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/v1/production-orders                          | 视图轨迁移：listProductionOrderPage（additive keyset，排序键 (created_at DESC, id DESC)——id 为并列行的确定性次序，legacy 对同一 created_at 行序本就未定义）+ state 筛选与 query 关键字（工单号/SKU/名称 strpos 子串）additive；**无查询参数时与 legacy list 走同一条 SQL（逐字节），响应解析后逐键一致且无 nextCursor 键**；显式 limit（1..100）才附 nextCursor（末行工单 id，不透明令牌）；looseObject 透传                   |
| GET /api/v1/production-orders/:productionOrderId       | additive 只读 findProductionOrder：根行（list 同投影）+ **工序进度**（每道工序的良品/废品/工时/报工次数与 completed 布尔——口径同完工门禁：累计良品 ≥ 计划数量）+ **报工时间线**（按工序号）+ **物料需求与分配状态**（需求公式同制造成本模块：BOM 行量 × (1+损耗) × 计划数 / 产出量，对净领用量（领−退）给 NOT_ISSUED/PARTIAL/ISSUED/OVER_ISSUED 四态；**bom:read 门控，未授权不查询**）；404 信封含 correlationId；非 uuid 400 |
| POST /api/v1/production-orders                         | legacy productionOrderCreateRoutes 同解析链（allow 八字段 → stableCode/uuid/decimal/calendarDate → 201 + mutationDto(production:read)）；负例消息逐字一致                                                                                                                                                                                                                                                                      |
| PUT /api/v1/production-orders/:productionOrderId/state | 统一动作端点：action ∈ release/start/complete/close/cancel，逐一分派 legacy transition 同链（动作→目标状态→能力键与 legacy commands 表逐一对应；前态约束权威在 DB 触发器）；legacy POST /:id/<command> 轨逐字不动（双轨并行）；**零新写语义**                                                                                                                                                                                  |

仓储 additive：`listProductionOrderPage`（筛选值/游标/limit 全部 values.push 参数化；
无过滤/游标/窗口时与 legacy list 同一条 SQL——机械验证相等）+ `findProductionOrder`
（根行 + 三聚合，聚合按 parts 门控）。`PRODUCTION_ORDER_PROJECTION` 提取为模块常量供
legacy list / 分页 / 详情根行三处复用（**SQL 与提取前 1407 字节机械验证相等**；
structure-gate G3 白名单按 ITEM/BOM/ROUTING 先例登记）。

**读方法落在新建的 production-read-repositories.ts**（指令原文写 manufacturing-read-
repositories.ts）：工单端点的依赖是 `dependencies.production`，读方法必须挂在生产仓储
链上，否则路由同时编排 manufacturing/production 两仓（service-boundary S3 拦截）；
`PostgresProductionRepository` 继承 `PostgresProductionReadRepository`，沿
manufacturing/procurement 拆分先例。

**真库实跑纠偏（TD-TEST-022 教训兑现）**：legacy 投影里的数量列是 JSON 数字
（to_jsonb(numeric)），本批首版照上一批惯例写成 z.string()——替身契约测试全绿、
真库集成首跑即红。已全链改为 z.number() 并在契约测试夹具钉定数字形态。另：桥轨
wire 文本的 JSON 键序与 legacy 不同（zod 序列化器按 schema 键序输出、未声明键在后），
解析后逐键一致；同法核验已合并的 manufacturing-routings 亦然——自 U3-COM-2 起全部
桥轨端点的既有性质，JSON 键序无语义，非本批引入。

## 2. Preact 工单控制台（隔离协议：全部新文件在分支 worktree 内）

- `production-order-console.tsx`（页面工厂）+ `production-order-actions.ts`
  （装载 `createProductionOrderLoaders` / 变更 `createProductionOrderMutations` 两工厂，
  io 注入，请求序号守卫）+ `production-order-detail.tsx`（详情抽屉，分区组件化——
  G5 ≤200 行经结构门禁抓出后拆分）+ `production-order-forms.tsx`（新建/流转抽屉）+
  `production-order-host.ts`（宿主独立成文件，bom-host 范式，**未向 console-entry.ts
  追加**）+ `production-order-ports.ts` / `production-order-state.ts` +
  `production-order-console.css`（全部 kt tokens 取值；进度条/竖向步骤复用
  commercial-ux.css 的 .com-meter*/.com-flow*）。
- **顶部状态汇总卡（兼作筛选）**：六状态计数卡（点选即按状态过滤、再点回全部）+
  「共 N 张工单 · 累计报工 N 条 · 成品卷 N 卷」总览行。
- **主表 DataTable**：工单号（独占元素 kt-po-number + 来源编号次行）/ 产品（SKU +
  名称）/ 计划数量 / **完工进度**（已完成数 / 计划数 + aria progressbar 进度条；
  完成数 = 各工序累计良品（封顶计划数量）的最小值——与 DB 完工门禁的数量条件同口径）
  / 状态徽章 / 交期 / 行级操作（查看 + 下一步动作：下达工单/开始生产/完工确认/
  关闭工单，按状态与能力键显示）。
- **详情抽屉**：概要（徽章/产品/计划/日期/来源）、**状态轨迹**（五节点横向步进，
  已到达/当前/未到达三态 + CANCELLED 旁支）、工序进度（竖向步骤：良品/计划、废品、
  报工次数、人工/设备分钟、每步进度条与完成徽章）、物料需求与分配（需求/已领 +
  四态徽章；**仅在详情响应带 materialRequirements 键时渲染，不以「暂无」冒充
  「无权限」**）、物料台账、报工记录时间线、成品序列、事件台账、车间执行入口。
  详情未到达前回退列表行就地推算（与 legacy 卡片同算法），加载失败不阻塞抽屉。
- **新建抽屉**：八字段与 vanilla「建立生产工单」表单一致（成品限已发布物料版本、
  工艺版本沿用全部路线、mrpProposalId 留空以 undefined 占位——JSON 丢弃该键，
  与 legacy 同式）；**载荷与 vanilla 逐字节一致**（组件测试 JSON 对拍钉定）。
- **流转抽屉**：当前/流转后双徽章 + 理由/证据编号两字段；载荷与 vanilla 流转表单
  同形（reason / evidence.reference / idempotencyKey=`工单号-动作-EV`），经 PUT
  /:id/state。
- **车间执行桥接**：appendProductionReport / appendProductionMaterial /
  appendProductionOutput 三函数**逐字节未动**（机械比对 180 行 7140 字节相等），
  由宿主把既有按钮挂进详情抽屉容器；挂载经 ref 回调（mini-DOM 下 useEffect 不
  触发——探针确证，ref 回调触发；浏览器与测试 DOM 语义一致），容器以「行 id +
  证据计数」为 key——提交刷新后重挂，按钮拿到最新报工/物料数据；表单提交后的
  整站重载收敛为一次（控制台 sync 内完成 status 行更新 + 快照刷新 + 详情重读）。
- 默认视图沿用路由加载的全量快照并按 **legacy 卡片的作业队列排序**（进行中 →
  已放行 → 已完成 → 草稿 → 已关闭）；状态/关键字生效时切换为服务端分页（工单 id
  keyset，页窗口 50）。
- e2e 契约：工单号独占文本元素（kt-po-number）；详情证据各条目独占文本元素
  （kt-po-material-entry / kt-po-report / kt-po-roll / kt-po-event）。

## 3. 退役（裁定 17 语义）

- `production-orders-view.ts`（196 行）删除——卡片视图、汇总与流程呈现全部由控制台
  承载，引用清零。
- `production-actions.ts` 仅移除已迁移的 `appendProductionTransition`（流转由 PUT
  state 承载）；三张执行表单保留（见 §2）。
- `workspace-fulfillment.ts` 改挂控制台宿主；**production-workbench 面板及其
  data-testid、路由标记（.production-workbench → production-orders）保持不变**。
- `style.css` 移除 `.production-flow` / `.production-operation` / `.production-
evidence-grid` 规则；`.production-actions`（执行按钮行）、`.production-order-card`
  `.production-summary` `.production-order-grid` 等由成本/发货 vanilla 视图继续使用，
  保留（规则 4 例外——同 file 内多处共享）。
- `fulfillment-actions-behavior.test.ts`：流转四例随函数退役（载荷 oracle 迁往组件
  测试），其余 11 例（报工/领退料/成品卷入库/发货）未动。

## 4. 测试

- fastify inject `production-orders.test.ts` **25/25**：默认全量（无 nextCursor 键）、
  state/query/cursor/limit 透传、七类查询负例、字段裁剪、详情 200/404/400 + bom:read
  门控、POST 入参 oracle（trim/stableCode/decimal 去尾零/mrpProposalId hasOwn）+
  六负例消息逐字、mutation 投影、PUT state 五动作逐一与 legacy transition 实参对拍 +
  负例（未知动作/未知字段/缺理由/DomainError 映射/能力缺失 403）、依赖缺失 503、
  未认领方法落回 null；**parity 组**：GET 列表与 POST 创建新旧轨逐键一致 + 五个流转
  与 legacy POST /:id/<command> 逐字节一致。
- 真库集成 `production-read-postgres.integration.test.ts` **9/9**（两个加性只读方法
  的 SQL 均在真库执行）：无过滤=legacy list 逐字节相等；六状态筛选 + 关键字（大小写
  不敏感/中文）+ 叠加；键集走查（limit 3/2、状态+limit、不存在的游标、越界钳制）；
  坏游标/TEAM 403/租户隔离；详情根行与 legacy 逐字节相等 + 工序进度升序（夹具按
  30/10/20 乱序插入）+ 报工时间线 + 物料分配四态（PARTIAL/OVER_ISSUED/ISSUED/
  NOT_ISSUED 各一单）+ 门控关闭不触碰 BOM 表（语句级追踪）；**真实仓储直通真实
  路由**：列表/分页/四张工单详情/门控关闭/404 过响应 schema + 桥轨写路径（创建→下达
  →DB 触发器拒绝重复下达）。
- f3 冻结场景 re-pin：GET/POST production-orders 两场景钉定
  `listProductionOrderPage(作用域, {})`；311/311 全绿。
- 组件 `production-order-console.test.tsx` **13/13**（见提交说明）。
- bootstrap.test **100/100**（锚重钉 + 宿主断言）；web 全量 **759/759**；API 全量
  **18003/18003**（后台实跑，专用库）。

## 5. e2e 文案契约逐条静态核对（p1-demo.spec.ts 工单用例，改前改后）

| 断言（改前）                                        | 改后                                                                                                                    | 理由                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `production-workbench` 可见（移动用例 L124）        | 不变                                                                                                                    | 面板与 data-testid 保持                    |
| `WO-KT-2026-001 · FG-KT-PRO-50` 同一文本可见        | 行内 `kt-po-number` 独占 `WO-KT-2026-001` + 行包含 `FG-KT-PRO-50`（两元素）                                             | 卡片标题合并文本 → 列表两列                |
| `.production-operation.done` 计 3                   | 详情抽屉 `.com-flow-step[data-state="done"]` 计 3（先点行级查看）                                                       | 工序流从卡片迁入抽屉步骤视图               |
| `领料 1287.5` / `领料 10` / `退料 2` 可见           | 不变文案，定位器改为抽屉内                                                                                              | 物料台账迁入抽屉                           |
| `ROLL-KT-2026-001 · 1000.*待检隔离` 可见            | 不变文案，定位器 `kt-po-roll`（抽屉）                                                                                   | 成品序列迁入抽屉                           |
| `草稿 → 已放行 → 进行中 → 已完成 → 已关闭` 一段文本 | 状态轨迹 5 节点，`[data-state="current"]` 文本 = `已关闭`                                                               | 箭头改为 CSS ::before，不再是 DOM 文本     |
| （新增）                                            | 列表行包含 `1000 / 1000`（完工进度）与 `已关闭` 徽章；截图 production-orders-desktop + production-execution-drawer 两张 | 进度条为本批 additive 呈现；截图随结构更新 |
| （新增）                                            | 新建抽屉 plannedQuantity 填 2.5 → 原生 validity.stepMismatch 全 false（TD-UI-009 同款守卫）                             | 数字字段小数可提交                         |

真浏览器复验：本批由本会话实跑（见 §6）。

## 6. 门禁回执（隔离协议）

| 门禁                            | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| worktree / DB                   | `/tmp/mfg4-wt`（分支 mfg/mfg-4-production-orders，rebase @4c2a7ca）；PG 容器 kingturf-pg-mfg4（kingturf_test_mfg4，一次性）；未触主工作树任何已跟踪文件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| API typecheck / lint / prettier | 0 / 0 / 通过（worktree 内实跑；server-fastify.ts 两条既有 unused-disable 警告与本批无关）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| API 全量测试                    | **18003/18003**（181 文件，后台实跑 EXIT=0）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Web typecheck / lint / prettier | 0 / 0（本批 touched 文件）/ 通过（worktree 内实跑）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Web 全量测试                    | **759/759**（50 文件；组件 +13、bootstrap 重钉后 100）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| structure-gate                  | 强制违规 0（PRODUCTION_ORDER_PROJECTION 入 G3 白名单；详情抽屉首版 G5 209 行经门禁抓出后拆分区组件，未经红提交）；service-boundary 0 违规；structure-gate 自测 39/39（API 快照干净 worktree 实跑）                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 投影机械验证                    | PRODUCTION_ORDER_PROJECTION 与提取前 legacy list SQL **1407 字节逐字节相等**；分页默认路径与 legacy list 同一条 SQL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 真库门禁目标                    | NODE_ENV=test + 127.0.0.1:5439 + 库名含 test 段（guard 校验通过）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| e2e P1                          | 本批实跑（e2e-local 配方，同容器栈 + 演示数据），回执见 §7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| pnpm ci:local                   | **EXIT=0 全链**（干净提交快照 **6335c28**；隔离 worktree /tmp/mfg4-ci-snap + 专用容器 kingturf-pg-mfg4；日志 /tmp/mfg4-ci-1.log，coverage-result head 字段记录 `6335c28…` 机械确证）：API **18003/18003**（181 文件；基线 17936 → 本批 +67）、Web **759/759**（50 文件）、**Python 发布演练 145 例 OK**、coverage overall 57911/70817・domain 630/672・仓储 11064/12985・**deficits 空**、登录预算 JS **11751B**、structure-gate/service 0 违规、audit 无已知漏洞。其上两笔提交（3067496 walk 视口修复、c56882c spec 作用域修正）各自过 eslint/typecheck 并由真浏览器走查与 e2e P1 实跑覆盖；含 docs 的最终 HEAD ci:local 于 docs 提交后实跑（见 §7 末行与 CP 报告） |     |

## 7. 真浏览器验证（e2e-local 配方实跑）

- 栈：容器 `e2e-harness-mfg4`（浏览器 + 预览 + API 同容器），专用库
  kingturf_test_mfg4_e2e（自建自清），合成全权限账号 admin / credit.approver，
  演示数据 scripts/seed_p1_demo.mjs。产物目录 /tmp/mfg4-e2e-local（另一会话的
  e2e-harness-mwua4mdw 栈仍在运行，经独立 E2E_LOCAL_OUT 并行，未触碰）。
- **walk 桌面（1440×900）与移动（390×844）各 40/40 路由全过、EXIT=0**：零
  pageerror、零 console.error、零 ≥400 接口、零页面横向溢出、零布局缺陷、零默认
  外观按钮；production-orders 路由 ready≈580ms；详情抽屉两视口均初焦入对话框、
  Tab 四步全在对话框内、Esc 关闭、~20ms 还焦（移动端抽屉自适应 351px 宽）。
- **亲自目检四张截图**（列表桌面/手机、抽屉桌面/手机）：
  - 桌面列表：六张状态汇总卡（计数带语义色 + 提示语）、「共 2 张工单 · 累计报工
    3 条 · 成品卷 1 卷」、搜索条、主表两行（RETURN-DEMO 进行中：0/10 空进度条 +
    查看/完工确认；WO-KT-2026-001 已关闭：1000/1000 满进度条 + 查看），作业队列
    排序正确；无一字一行、无默认灰钮、日期单行、无截断。
  - 桌面抽屉：浮层盖页（overlay 变暗），状态轨迹五节点（进行中高亮），工序进度
    0/10 + 三道工序竖向步骤（簇绒/背胶/裁切包装，各带良品/计划/废品/报工次数、
    人工/设备分钟、进度条与「未开始」徽章），页脚「下一步：待报工、成品入库并
    完工确认」+ 主色完工确认钮。
  - 手机列表：外壳收成顶部页签，汇总卡折两列，主表置于可横向滚动容器内（页面
    本身零溢出）。
  - 手机抽屉：351px 浮层，标题/轨迹徽章/步骤列表/页脚全部正常换行，无挤压。
- **e2e P1：11/11 全过（E2E_EXIT=0，33.3s）**——浏览器/代理/API 同容器、仓库
  原配置。首轮 10/11：`领料 10 / 退料 2` 断言失败——这两条属
  WO-KT-2026-RETURN-DEMO 的领退料演示数据，旧 spec 作用域是整张工作台（多卡并
  存），按工单拆到各自抽屉后（c56882c）11/11。
- **走查工具视口缺陷（本批发现并修复，3067496）**：walk.mjs 把 {width,height}
  直接当 newContext 选项传（缺 viewport 键），Playwright 静默回落默认 1280×720
  ——首轮走查两档视口均未生效（报告 innerWidth 1280 实证）。修复后两轮走查在
  真实视口下重跑，上表数字均为修复后结果；桌面 1440 档此前从未真正跑过。
- 含 docs 的最终 HEAD ci:local 于 docs 提交后在隔离 worktree 实跑：⟦最终回执待
  docs 提交后填入 CP 报告⟧。

## 8. 已知偏差与遗留（如实）

1. **读仓储文件位置偏离指令原文**：指令写「仓储加性方法放 manufacturing-read-
   repositories.ts」；因工单依赖是 `dependencies.production`，放制造仓储会迫使路由
   跨两仓编排（service-boundary S3）或制造仓储长出非制造方法——故独立成
   production-read-repositories.ts 并让生产仓储继承，拆分形态与指令的「超出 G1 拆
   文件」意图一致。
2. **指令 B 段的「分配 / 异常上报」未实现**：legacy 工单域不存在这两种写路径或界面
   入口（状态机只有五动作；异常审批属发货域 EXCEPTION_PENDING，非工单域）。按「以
   legacy 实际支持的为准；需要新写语义就停下报告」未发明；若所有者要工单级异常流，
   须另批立项。
3. **「已完成数」为 additive 呈现口径**：legacy 无工单级完成数；本批以「各工序累计
   良品（封顶计划）的最小值」呈现，与 DB 完工门禁（0042：每道工序累计良品 ≥ 计划
   数量）同口径，不构成新写语义。
4. **桥轨 wire 键序差异**（§1）为既有性质，本批证据改用「解析后逐键一致」口径——
   此前各批「逐字节一致」的表述实际成立的层面相同。
5. **scripts/e2e-cdp/probes.mjs 两处选择器指向已退役的卡片 DOM**
   （`[data-testid="production-workbench"] .production-order-card` 等，L284/287）。
   该脚本为手动 CDP 取证工具、不在任何 CI 门禁内，本批未改（R4 登记，遗留待后续
   清理或废止）。
6. e2e-local 配方容器经 host.docker.internal 访问宿主端口：本机 Docker Desktop 拒绝
   绑定网桥地址（172.17.0.1:5439 报 ports are not available），按指令预案把专用 PG
   容器改绑 0.0.0.0:5439（仅本机测试库）。
7. 浏览器验证只覆盖读路径与单一全权限合成账号（TD-TEST-024 既有边界）；写路径
   （新建/流转）由组件载荷 oracle 与真库桥轨写路径覆盖。

## 9. 边界与后续

- legacy dispatch 轨完整保留（工单 GET/POST/五命令双轨并行）；零新写语义。
- 不新增 AppRoute 子路由；未改 packages/ui；未触其它域文件。
- 未 push、未合并 main、未 dispatch workflow；容器/worktree 清理待主协调复核后按名
  执行。
- MFG-5（报工入库：工序报工 / 领退料 / 成品卷入库三张表单 + 对应端点迁移）待主协调
  指令；届时替换本次桥接保留的三函数与 fulfillment-actions-behavior 余下 11 例。
