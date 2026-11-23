# PROC-UX 供应链域控制台交互增强证据（2026-11-23）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + PROC-UX 供应链域 UX 重构指令；执行中
> 经主协调追加通知修订边界（`console-entry.ts` 允许纯追加、共享文件追加纪律）并继续。
> 停点：**PROC-UX-CP**（不推送、不部署）。

## 0. 范围与交付形态

四页 Preact 控制台（U3-PROC-1..4 交付物）的**交互体验增强**，非样式迁移：零新增路由认领、
零后端写路径、零 schema 变更；仅供应商/询价/采购订单三页改 API 无关的呈现层，收货页新增
一条 additive 只读数据链（既有 legacy 质检查询/追溯/库存视图端点的并行读取）。

| 页面     | 增强                                                                                                                                                                                                             | 交付文件                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 供应商   | 资质状态四色徽章（列表列 + 抽屉，PENDING 为派生态）+ 待准入物料清单 + 报价历史对比（同一物料多供应商单价并排，有效最低价「最优」高亮、本供应商/已失效标记）                                                      | `supplier-console.tsx` / `supplier-console-detail.tsx`（新）/ `supplier-ports.ts`            |
| 询价     | 报价对比矩阵（行项×供应商 DataTable，单元格单价/MOQ/交期，有效最低价「推荐」标记、并列同标、失效报价排除+警示）+ 截止倒计时徽章（列表「报价截止」列 + 抽屉，仅 ISSUED；剩余/临期 warning/今日/逾期 danger 四级） | `rfq-console.tsx` / `rfq-console-detail.tsx`（新）/ `rfq-ports.ts`                           |
| 采购订单 | 收货进度条（列表新列可排序 + 抽屉整单/逐行，Σ已收/Σ订购，草稿呈「未签发」）+ 状态流转图（DRAFT→ISSUED→PARTIALLY_RECEIVED→RECEIVED 四节点步进，当前 aria-current、跳过节点虚线、CANCELLED 全部未到达）            | `po-console.tsx` / `po-detail.tsx`                                                           |
| 收货     | 批次追踪时间线（收货→质检→入库，节点显示状态/时间/结果/操作人）——**方案 3 客户端组合**，见 §3                                                                                                                    | `gr-console.tsx` / `gr-console-detail.tsx`（新）/ `gr-ports.ts` / `console-entry.ts`（追加） |

样式纪律：**零新增 CSS 文件**（与 COM/CRM/GOV 姊妹批次不同，本批全部复用既有原语
`status-badge`/`data-table`/`console-summary`/`timeline-item` + 取自 kt tokens 的内联
style，仅用于无既有类的几何属性：进度条轨道/填充、流转图节点/连线）。已核实 Preact 11
经 CSSOM（`style[key]=`）应用样式、生产 CSP `style-src 'self'` 不拦截 CSSOM 注入。
G1/G5 纪律：四个 detail 新文件 270–450 行、页面文件 ≤536 行，全部低于 800/200。

## 1. 供应商管理

- **资质状态徽章（四色）**：`QualificationBadges` 按 APPROVED（success）/CONDITIONAL
  （info）/REJECTED（danger）/PENDING（neutral）呈非零计数，固定顺序，`title` 提供文字
  语义（不以颜色为唯一信号）。**PENDING 为派生态**：`supplier_item_qualifications.status`
  schema 约束仅三值、无存储「审核中」，故以「已发布物料版本中尚无该供应商准入记录」计数
  （`pendingItemChoices` = itemVersionChoices 减已准入版本）；列表列 `field` 保持 legacy
  APPROVED 计数口径（排序不变式）。抽屉另有 `PendingQualifications` 待准入物料清单
  （前 8 项 + 溢出提示）。
- **报价历史对比**：`QuoteComparison` 以所选供应商报价过的物料版本为行，聚合
  `/api/v1/supplier-quotes` 视图全部供应商同物料报价；每物料一张 DataTable，有效报价按
  单价升序在前，**有效最低价标记「最优」（success，并列同标）**；已失效报价
  （valid_until < 当日 UTC）按收价时间降序在后、警示「已失效」且不参与最优；本供应商行
  标「本供应商」。列示单价/MOQ 去除 numeric(24,6) 尾随零。
- **时间源**：`now` 可选端口（缺省系统时间），测试注入固定时钟（2026-11-23T10:00Z）。

## 2. 询价管理

- **报价对比矩阵**：`QuoteComparison` 重构为行项 × 供应商 DataTable（原纵向嵌套列表退役
  ——该区为 U3-PROC-2 本批新增呈现，无 e2e 文案契约）。单元格 `单价 X · MOQ Y · 交期 Z`；
  该行有效报价中单价最低者标「推荐」（并列同标；全部失效无推荐）；已失效报价标「已失效」
  且不参与推荐；缺行报价呈「—」。供应商列可按单价排序（`Number.MAX_SAFE_INTEGER` 沉底）。
  抽屉内横向滚动承载多供应商列。
- **截止倒计时**：`countdownOf` 按 **UTC 日历日差**计（与列示的 ISO 前 10 位截止日期同
  口径，避免文本与天数错位一日）：剩 N 天（>3 info / ≤3 warning）、今日截止（warning）、
  已逾期 N 天（**danger** 语义红）。仅 ISSUED 呈示（草稿未发出、关闭/已转采购不再计时）；
  不可解析截止时间不呈徽章。

## 3. 采购订单

- **收货进度**：`receiptProgressOf`（Σ receivedQuantity / Σ quantity，行项缺失收量按 0）
  驱动三处呈现：列表「收货进度」新列（可排序，`ProgressBar` 原语：`role="progressbar"`
  - aria-valuenow/min/max + `data-percent`；草稿行呈「未签发」不呈条）；抽屉
    `ReceiptProgressBars` 整单 + 逐行两粒度（部分收货夹具 3000/6000 → 整单 50%、行 40%/100%）。
- **状态流转图**：`StatusFlow` 四节点横向步进——已过节点实心 ✓、当前节点实心 ● 且
  `aria-current="step"`、**整单一次收齐（直接 RECEIVED）时 PARTIALLY_RECEIVED 标虚线
  skipped（未曾处于该态）**、未到节点空心 ○、CANCELLED/未知态全部 upcoming（连接线全部
  待流转色）；下方等宽标签列（草稿/已签发/部分收货/已收货）；`data-status`/`data-step`/
  `data-state`/`data-connector` 供测试与后续样式钩挂。

## 4. 收货管理：批次追踪时间线（含一次 FAIL→停止→裁定适配）

### 4.1 首实现被护栏拦截（FAIL→停止+报告）

首版按「API additive trace」实现：`GET /api/v1/goods-receipts/:id` 追加 `trace` 字段，
路由内组合 quality/procurement/employees 三仓数据（收货/质检/入库三节点 + 权限分层 +
操作人显示名解析），定向测试 15/15 全绿。**隔离全链 ci:local 在 service:check 处退出 1**：

```
S3 apps/api/src/routes/fastify/goods-receipts.ts:426 Runtime entry/helper orchestrates
   employees, procurement. Move genuine cross-repository business orchestration into an
   explicit service. （1 violations）
```

S3（`docs/engineering/service-boundary-guard.md`）禁止单 HTTP 入口可达两个仓储；本仓库
当前**不存在 services 层**（ADR-0012 明确不创建空层）。合规落位的三种途径
（仓储内 SQL 聚合 / 新建 explicit service / Web 端组合）全部超出本批文件边界（仅四个
Fastify 路由文件）。按强化简报 ①「FAIL→停止+报告」，该首版**封存**于本地分支
`procux-gr-trace-candidate`（提交 `0441f1a`，基于 1adf56e，[未测试] 标注，未推送），
主工作树原样还原。

### 4.2 恢复：方案 3（客户端组合，协调追加授权后）

主协调追加通知授权 `console-entry.ts` 纯追加后，采用封存提交中预写的方案 3：

- **端口**（`gr-ports.ts`）：`loadTraceSources?: () => Promise<TraceSources>`——
  `quality-inspections` / `lot-traceability` / `inventory-balances` 三条**既有 legacy 视图
  端点**并行 GET；403（无 quality:read / traceability:read / inventory:read）或读取失败
  → 该面 `null`，不拖垮收货详情。
- **组合**（`gr-console-detail.tsx`）：`buildLotTrace` 在客户端组装三节点——
  - 收货：实收数量/库位/送货单 + `received_at`（操作人显示「—」，见 4.3 降级）；
  - 质检/入库：三层递进——检验单（质检面，检验单号/状态/合格 x/y 项）→ 批次质量事件
    （追溯面，QUARANTINE 开检时间、RELEASED/REJECTED 处置时间与原因）→ 有效质量状态
    （库存面，QUARANTINE/RELEASED/REJECTED 仅状态）；三面全不可见 → 节点「无查看权限」，
    可见但无记录 → 「未开检」；REJECTED 呈 danger 语义红 + 拒收原因。
- **挂载**（`gr-console.tsx`）：打开抽屉时与 `loadDetail` 并行拉取事实面；`data-access`
  = full/status/receipt 标注可见层级。
- **接线**（`console-entry.ts`，纯追加 23 行）：`appendGoodsReceiptConsole` 内追加
  `loadTraceSources` 实现（`controller.api.get` 三端点并行，try/catch → null）。

### 4.3 如实降级（相对封存候选的能力差）

- **操作人显示名**：服务端方案经 `employees.findById` 以调用方数据范围解析显示名；Web 端
  无员工目录视图（employee:read 非采购/库存角色能力），时间线操作人统一呈「—」，
  actorId 留存节点 detail 供有权限者核查。**显示名解析回服务端需 TD-PROC-006 裁定落位**。
- **数据新鲜度**：抽屉打开时实时读取（优于 load 快照）；失败降级为不渲染时间线。

## 5. 共享文件改动（协调规则 6 专节）

| 文件                                                                                                          | 改动                                                                                                                                                    | 性质                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/commercial/console-entry.ts`                                                                    | ①`appendGoodsReceiptConsole` 注释块追加 1 行（PROC-UX 说明）；②ports 字面量内追加 `loadTraceSources` 实现（22 行，位于 `loadDetail` 与 `refresh` 之间） | 纯追加，无重排/无他人行改写；文件 745 行（G1 ≤800 内）；提交时文件 clean（三并行会话改动已在 d3fec40/a397cb0/83a2852/d3fec40 入库） |
| `apps/web/src/bootstrap.ts` / `routes/fastify/registry.ts` / `style.css` / `structure-gate.mjs` / `mount.tsx` | 未触碰                                                                                                                                                  | —                                                                                                                                   |
| `docs/exec-plans/tech-debt-tracker.md`、`docs/index.md`                                                       | **已写入登记内容但未随本批提交**：两文件在收口时点混有并行会话未提交改动（协调规则 5），登记文本见 §8，由主协调并入                                     | 遵守规则 5                                                                                                                          |

## 6. 测试

- 组件（vitest + 零依赖 Preact DOM double）：四文件 **46 例全绿**
  （supplier 12 / rfq 12 / po 12 / gr 10；原 29 例行为面逐条保持——载荷 oracle、权限门、
  筛选检索、详情呈现、刷新错误面全部未动），新增覆盖：四色徽章计数/色调/派生 PENDING/
  溢出截断；报价对比最优/并列/失效排除/缺行/本供应商/图例；矩阵推荐/排序/单元格细则；
  倒计时分级/草稿不呈/不可解析回退；进度条 aria/草稿未签发/整单逐行/超收封顶文本；
  流转图 done/current/skipped/upcoming/连接线/CANCELLED；时间线三节点/三面全不可见/
  仅库存状态/进行中与拒收+danger/未开检/事实面读取失败降级。
- `bootstrap.test.ts` 96 例全绿（procurement 四控制台宿主断言不受影响）。
- API：**零改动**（goods-receipts 路由与 inject 测试保持 HEAD 原样 5 例；封存候选的
  additive trace 不在本批）。
- 行为守恒：所有写路径载荷、权限门、文案契约（`收货 GR-…`/`PO-… · 已收货` 首列）逐字节
  未动；新增呈现均为 additive 只读。

## 7. 门禁回执

| 门禁                            | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 定向 eslint / tsc / prettier    | 0 / 0 / 通过（全部改动文件，两轮实现分别验证）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| service:check                   | **0 违规**（首版候选 1 违规 → 停止 → 方案 3 后复验通过）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| structure:check                 | 强制违规 0（隔离树验证；主树时点 1 违规为 GOV-UX 在途 `audit-page.tsx` G5，与本批无关）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 隔离全链 `pnpm ci:local` 第一轮 | **EXIT=0 / 1159s**，干净已提交快照 `7f2e158`（三页改动，专用空库 kingturf_test_procux 全量迁移；14 步含覆盖率三目标 + 不下降、API/Web 全量、登录预算 JS 11752≤12000、console-css 守卫、audit/security）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 隔离全链 `pnpm ci:local` 第二轮 | **EXIT=0 / 780s**，干净已提交快照 `ec6faef`（= 提交时点 main HEAD `d3fec40` + 本批全部 16 个代码文件，含收货时间线方案 3 与 console-entry 追加；专用重建空库。首次尝试失败一次：同库二次运行时 Python 发布演练 release_migration_drill_test 报 `relation "inventory_movements" does not exist`——演练对库迁移状态有假设，与本批改动无关，重建空库后通过。API 17916/17916、Web 673/673、覆盖率三目标达标、登录预算 JS 11751）。按协调 CI 排程规则，最终独占 ci:local 待主协调通知后另跑                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 隔离方式说明                    | 共享工作树有四个并行会话在途改动，全链在 `git worktree`（`/tmp/procux-ci-wt`，基线=最新 main HEAD + 仅本批文件）+ 专用库 `kingturf_test_procux` 执行；快照先落本地验证分支（覆盖率门禁要求干净已提交树），绿后同内容提交 main                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| e2e P1（黑盒）                  | **实跑通过——本批为五会话中首个完成本地隔离 e2e 的批次**。环境：专用库自举合成全权限账号（193 能力，建模于 scripts/e2e-docker/fixture.mjs seedUser）+ worktree 构建产物 preview + API（端口 3917/4178，避开 3000/4173 session-network 用例）+ Docker 官方 Playwright 镜像（v1.62.1-noble，host-gateway + 容器内 localhost relay——`__Host-` cookie 需可信源 127.0.0.1）。`p1-demo.spec.ts` 11 例：**9 过**（采购域用例 3.0s，全套 42.0s）；2 败为 business-risks/overview 导航项对合成账号不可见（路由显隐权限解析，非本批域；procurement/credit/orders/quality 全部通过）。浏览器走查：三页列表 + 详情抽屉（桌面 1440×900 + 移动 390×844）截图成功，「收货进度 100%」列等真实渲染确认。**发现并登记 TD-PROC-007**：抽屉打开时未捕获 `TypeError: t.querySelectorAll(...).filter is not a function`（每次一次；组件测试 DOM double 为数组、真实 DOM 为 NodeList 的语义差异为高概率根因类别；静态 grep 生产代码无裸链——需 sourcemap 栈定位；抽屉内容完整渲染、e2e 断言不受影响，非阻断）。走查完成后本地栈已按端口（3917/4178/4179）核验拆净 |

## 8. 台账登记（已写入 tracker 工作树，随协调并入）

- **TD-PROC-004（P3，新）**：`packages/ui/src/components.css` 缺 `.status-badge
[data-tone='danger']` 规则（类型含 danger、CSS 仅 error）→ REJECTED/逾期等 danger
  语义实际渲染灰色、与 neutral 撞色。本批三处（gr/rfq/supplier detail）以 token 内联
  回退（`--kt-color-danger-soft/-danger`）；修复=补一条 CSS 规则（packages/ui 边界，
  另批），回退可删。
- **TD-PROC-005（P3，新）**：`commercial/console-entry.ts` 745 行（G1 800）为五会话共用
  增长点，建议后续 UI 批次按域拆分宿主工厂（纯机械搬迁）。
- **TD-PROC-006（P3，登记处置）**：收货批次追踪服务端编排（employees+procurement+quality
  三仓）被 service-boundary S3 拒绝；本批以客户端组合交付时间线（操作人显示名解析缺失
  呈「—」）。如需服务端 trace（含显示名），落位二选一待主协调裁定：①仓储内 SQL 聚合
  （护栏文档认可口径，动 procurement-read-repositories）；②新建 explicit service 层
  （当前无该层）。完整候选封存于本地分支 `procux-gr-trace-candidate`（`0441f1a`），
  未推送、未并入 main。
- **TD-PROC-007（P2/P3 待核，新）**：真实浏览器打开供应商/询价/采购订单详情抽屉时各抛
  一次未捕获 `TypeError: t.querySelectorAll(...).filter is not a function`（收货抽屉未
  触发；未捕获但非阻断——抽屉内容完整渲染、e2e 采购断言全过）。静态 grep 生产代码无
  `querySelectorAll(...).filter` 裸链（shared/register-\* 等均正确 Array.from 包裹）；
  高概率根因类别为组件测试 DOM double（数组）与真实 DOM（NodeList）语义差异经某共享
  模块泄漏，需 debug sourcemap 栈定位（本批已产出 `dist-debug` 构建路径未走完——debug
  构建下登录链不通，另查）。已核与本批改动无功能影响的证据：走查文本快照完整 + e2e 9 过。
- **TD-PROC-002/003 保持**；TD-PROC-001 不涉及（无写路径改动）。

## 9. 边界与后续

- 未 dispatch workflow；未触 `.github/workflows/`；未 push（PROC-UX-CP 停点，待主协调复核）。
- 临时验证资产清理清单：worktree `/tmp/procux-ci-wt`、分支 `procux-verify`/`procux-verify2`
  （本地）、一次性库 `kingturf_test_procux`、`/tmp/procux-e2e/*`——CP 复核通过后清理
  （候选分支 procux-gr-trace-candidate 保留至 TD-PROC-006 裁定）。
- 姊妹批次参照：COM-UX/CRM-UX/GOV-UX 各自 CSS 文件（commercial-ux.css 等）与徽章 tone
  缺陷同源（TD-PROC-004 若在 packages/ui 修复则全站受益）。

## 10. 主协调复核（2026-11-24）

本节是复核结论。§0–§9 原文保留不改，其中与事实不符之处在此更正。

**提交与门禁。** `d45cd3f` 共 17 个文件：16 个域内文件，加 `apps/web/src/commercial/console-entry.ts` 一处（+22/−1，删掉的那一行是注释）。16 个代码文件与第二轮 ci:local 的干净快照 `ec6faef` 逐字节一致。第二轮回执由日志 `/tmp/procux-ci.log` 坐实：`CI_EXIT=0 DURATION_S=780 BASE=ec6faef…`，API 17916/17916、Web 673/673、structure-gate 强制违规 0、登录入口 JS 11751B、audit 无已知漏洞。第一轮（`7f2e158`）的日志已被第二轮的同名文件覆盖，无法独立复核，按 §7 自述。提交标的 `[未测试]` 与事实不符：未被该回执覆盖的只有本文档这一 docs 增量。不改写历史，在此更正。

**e2e P1。** 9/11 由 `/tmp/procux-e2e/results/.last-run.json` 坐实，失败恰为两例。两例都停在 `openRoute()` 的导航断言，尚未触及页面内容：

| 用例                                                                | 现象（取自 error-context.md）                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| shows explainable risk findings and the closed responsibility trail | `[data-app-route="business-risks"]` 按钮存在（`title="业务风险"`），点击后 `aria-current` 在 5 秒内 14 次轮询均为 `false` |
| shows server-calculated executive KPIs …                            | `[data-nav-routes~="opportunities"]` 未挂载；页面快照为「登录成功，正在并行加载业务数据…」                                |

§7 把两败归因为「合成账号路由显隐权限解析」。第一例与该说法相符。第二例的现场是工作台尚在准备数据，也可能是首屏加载超过了 5 秒，**成因待核实**。两例与 TD-TEST-016 记录的历史现象同类，不属本批改动的域，已交真浏览器验收会话（UX-VERIFY）用现成 trace 做根因。

**真浏览器截图复核。** 直接查看 `/tmp/procux-e2e/shots` 的截图，发现三处 §7「走查成功」没有写出的缺陷：

1. `04-supplier-drawer.png`、`09-mobile-rfq-drawer.png`：抽屉里的报价对比表被压进窄宽度，供应商名和行项描述一字一行。登记 TD-PROC-008。
2. `01-suppliers-list.png`、`07-mobile-suppliers.png`：供应商主列表比容器宽，「操作」列被截断；移动端名称列一字一行，表头截断。登记 TD-PROC-009。
3. `04`、`06` 的背景：`#/procurement` 仍是「供应商与准入 / 询价管理 / 采购订单 / 收货管理」四段竖排，下方接 vanilla 的「供应商报价」「批次库存台账」两卡。本批做的是段内增强，页面解剖没有变。登记 TD-PROC-010，另批做子路由化。

采购订单的列表、进度条、状态流转图与详情抽屉（`03`、`06`）渲染正常。

**TD-PROC-007 根因更正。** §8 的推测（测试 DOM double 经共享模块泄漏）不成立。根因在 `packages/ui/src/detail-drawer.tsx`：

```ts
const nodes = finder.querySelectorAll(FOCUSABLE_SELECTOR) as readonly Focusable[];
return nodes.filter(…);
```

类型断言把 NodeList 当成了数组。单行和跨行 grep 都搜不到，是因为断言夹在调用与 `.filter` 之间。影响不止采购域：全站每个抽屉打开时 `useEffect` 抛错，初始焦点进不了抽屉，清理函数没有登记，关闭后焦点不归还；在抽屉内每次按 Tab，`onKeyDown` 抛错，焦点圈不住。单测看不到，是因为自研 mini-DOM 的 `querySelectorAll` 返回数组。主协调已修复（`27e9224`）：用 `Array.from` 取数组，并加回归用例把返回值包成 NodeList 形状。旧源码上报 `TypeError: nodes.filter is not a function`，修复后通过。

**裁定。**

| 编号        | 裁定                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-PROC-004 | 已修复。`d387f25` 把 `components.css` 中类型里不存在的 `data-tone='error'` 改为 `danger`，并加守卫测试；本批三处内联回退由 `12e4a07` 删除                     |
| TD-PROC-005 | 宿主函数独立成 `<域>-host.ts`，以 MFG-2 `b6e20a1` 的 `bom-host.ts` 为范式；`console-entry.ts` 按域整体拆分另批                                                |
| TD-PROC-006 | 维持客户端组合。操作人显示名缺口另批走方案①（仓储内只读聚合 + 加性端点）；方案②（新建 service 层）不采纳。候选分支 `procux-gr-trace-candidate` 保留至该批开工 |
| TD-PROC-007 | 已修复，见上                                                                                                                                                  |

**临时资产。** worktree `/tmp/procux-ci-wt` 与专用库 `kingturf_test_procux` 已不存在。`/tmp/procux-e2e/` 含可复用的 e2e 配方脚本和两败的 trace，保留至配方沉淀入库后清理。
