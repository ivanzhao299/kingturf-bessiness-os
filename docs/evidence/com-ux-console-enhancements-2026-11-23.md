# COM-UX 商机域控制台交互增强证据（2026-11-23）

> 授权链：项目所有者第 4–7 次人裁 + 主协调全权 + 并行会话政策（COM-UX 批指令 + 2026-11-23
> 共享文件规则更新）。U3-COM 七子批已迁移的控制台在**不改 API 合同**前提下的 UX 深度优化。
> 功能提交 **83a2852**（20 文件，+4,818/−250）；七个 Fastify 路由文件与 `console-entry.ts`、
> `bootstrap.ts` 逐字未动。

## 1. 交付物（五页交互 + 三共享原语模块 + 独立样式）

| 页面           | 新交互                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 数据面（全部既有 ports，零 API 变更）                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 商机看板       | 默认**管道视图**：5 列（初步接洽/需求确认/方案报价/赢单/已关闭）分列看板；列头数量 + 分币种金额汇总（BigInt 定点十进制求和，金额受限单独计数）；卡片**按钮与把手拖拽**双路径切换阶段——落点列顶部弹移动确认卡（依据必填、失败保留输入、成功后 role=status 播报并还焦新列卡片）；流转目标镜像 domain `OPPORTUNITY_TRANSITIONS`（OPEN→QUALIFIED/LOST/CANCELLED 等，终态无目标，服务端仍为权威校验）；原 DataTable 主列表保留为**列表视图**（页头视图切换） | `items`/`transitionOpportunity` 既有端口；新增 `opportunity-list-pipeline.tsx`                                                                                                     |
| 报价管理       | 详情抽屉**水平版本时间线**：同一 quoteId 的修订按版本排列，节点（原生 button，`aria-current` 标当前）显示状态/日期（签发 > 最近审批 > 未签发）/毛利/较上一版差额（总额 %、毛利率 pp，分行渲染）；点击节点切换查看版本。**毛利可视化**：列表毛利列与详情各附毛利率仪表条（role=img 文字替代），红线 = 报价绑定政策版本的 `minimumMarginBasisPoints`，预警线 = 红线 + 500bp，政策不可解析回退默认 20% 并如实标注「默认」                                  | `snapshot.quotes/policies` 既有快照；新增 `quote-console-timeline.tsx`                                                                                                             |
| 成本矩阵       | 列表行**多选（≤4 模型）→ 因子对比表**：行 = 因子 + 单位（单位不同不比价、分行呈现），列 = 各模型的含税单价 + 取价来源（类型短名 · 来源名 · 生效日）；同因子同单位内已录价 ≥2 才标「最优」（最低价），合计仅在因子集与取价完整度一致时标「最低」；详情加载失败列就地呈现原因；加载/失败/空三态齐备                                                                                                                                                       | `querySummaries`/`loadMatrix` 既有端口；新增 `cost-matrix-console-compare.tsx`（表单拆出 `cost-matrix-console-forms.tsx`，主文件回落 776 行 ≤800）                                 |
| 信用审查       | 页面级**审批流程图**：发起评估 → 信用评估 → 信用审批 → 批准/拒绝/过期分支（前两环节为说明性静态节点；审批与结论节点点选即应用状态筛选，与筛选条同一状态源）。抽屉**逐步骤办理进度**（提交时间/敞口快照/审批结论+时间，待审批环节就地承载批准/拒绝操作）+ **额度占用率条**（敞口/额度事实比例，超限如实标注，不引入政策阈值）                                                                                                                            | 决定行既有字段（created_at/decided_at/valid_until/exposure/limit）；新增 `credit-console-flow.tsx`；`approval_required` 布尔直读（既有 `recordText` 端口不透传布尔——测试真红捕获） |
| 方案管理 / CTR | **字段级红绿差异**：变更行灰底 + 字段名圆点，当前值绿底 / 上一版值红底划除，文案契约「当前值（上一版：旧值）」逐字保留；**对比基准可改选**任一更早版本（默认上一版）；工程假设按成员标增（+）/删（−，划除）；列表新增「较上一版」变更数列（首个版本如实标注）；差异原语两页共用                                                                                                                                                                         | 既有版本行内存比对；新增 `solution-console-diff.tsx`（solution-console.tsx 与 ctr-console.tsx 接入）                                                                               |
| 共享           | `commercial-ux.css`（1,163 行，仅 kt tokens，com-\* 命名空间，五页共用；窄屏页头换行仅在商机域控制台页内覆盖；prefers-reduced-motion 降级）                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                  |

**无障碍与状态覆盖**：全部新图表 `role=img` + `aria-label` 文字替代；红绿不以颜色为唯一信号（文字标签/圆点/划除/± 前缀并存）；筛选控件补 `aria-label`（原先仅 placeholder）；拖拽有按钮等价路径（把手 mousedown 才可拖，正文拖动被阻止）；移动确认卡卸载时焦点归还来源卡片；加载/空/错/受限金额/首个版本等边界态全渲染。

## 2. 行为守恒

- **API 合同零变更**：七个 Fastify 路由文件（commercial-opportunities/quotes/cost-matrices/credit-review/technical-solutions/ctr/sales-policies）git 零差异；全部交互消费既有 ports；写路径（transition/PUT state/因子写入）载荷与原实现逐字段同构。
- 阶段流转目标在 UI 镜像 domain 规则仅用于**呈现合法目标**；服务端 `assertOpportunityTransition` 仍是权威校验（非法目标本就到不了提交）。
- 文案契约保持：页头「商机阶段看板」、列表 caption、`当前值（上一版：旧值）`、毛利 `金额（x%）` 形态、`收货 GR-…` 等 e2e 断言面逐字未动。
- 既有行为测试全部保留并通过（opportunity 7 / quote 10 / cost-matrix 7 / ctr 9 / solution 9 / policy 7 / handoff 3 / bootstrap 95+），仅按新信息架构调整定位符（`kt-quote-history` → `kt-quote-timeline`）与默认视图断言。

## 3. 测试

- 新增 **50** 白盒行为例：管道 12（含十进制求和/域规则镜像/拖拽把手语义/失败保留输入/焦点管理/空态权限门）、时间线+毛利 8（阈值口径/政策解析回退/节点切换/差额/受限毛利）、因子对比 7（最优判定/单位分行/合计可比性守卫/上限/失败列/空态）、信用流程 6（统计筛选联动/步骤时间戳/占用率/权限门/批准流）、版本差异 9（纯函数 3 + 方案 4 + CTR 2）。web 全量 **611/611**。
- 真实浏览器目检（仓库外临时配置 + Playwright 自带 Chromium + 合成会话/形状级模拟接口，`tests/e2e/fixtures/browser-session` 同源夹具；**非黑盒证明，仅布局/交互目检**）：15 场景截图复核（桌面 1440/1024/移动 390 × 五页 + 拖拽确认卡 + 时间线稳态 + 对比表 + 流程筛选联动 + 基准切换）。目检驱动 3 处修正：①窄屏页头换行（原页头原语不换行 flex，操作区加宽后标题竖排）；②信用流程前两环节改静态（原先与筛选条同时高亮读作两个活动步骤）；③时间线差额分行（原在「毛利率」词中断行）。

## 4. 门禁回执

| 门禁                                                                          | 结果                                                                                                                                |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| web vitest（独立 worktree 干净 HEAD 83a2852）                                 | 611/611                                                                                                                             |
| tsc / eslint（改动文件）                                                      | 0 / 0                                                                                                                               |
| prettier                                                                      | 通过                                                                                                                                |
| structure-gate                                                                | 强制违规 0（白名单 29 条存量）                                                                                                      |
| service-boundary                                                              | 0 违规（213 files / 32 ports / 241 routes）                                                                                         |
| web build                                                                     | 登录关键路径 JS 11751B gzip（≤12000 预算）；console-css 守卫过                                                                      |
| pnpm ci:local（NODE_ENV=test，专用库 kingturf_comux_test，worktree @83a2852） | 见 §5                                                                                                                               |
| e2e P1（黑盒）                                                                | **未执行——KINGTURF_ADMIN_PASSWORD 不可得**（U3-COM-1 §2 / U3-PROC-1..4 同款缺口）；文案契约静态核对兼容 + §3 合成夹具目检为补偿验证 |

## 5. ci:local 运行记录（如实）

- 首轮（13:37）python 发布演练段失败（`phase12c_drill_template70 does not exist` ×5 + 1 fail）：与并行会话 ci:local **并发冲突**——演练模板库为实例级固定名（`release_migration_drill_test.Drill.setUpClass` DROP/CREATE 同名模板），PROC-UX 会话的 ci:local（/tmp/procux-ci-wt，13:39 起）与我 13:37 的运行互相删除模板。该段不触碰本批任何代码。
- 第二轮（14:32 起）：python 发布演练段已通过（Ran 138 tests, OK，证实首败为并发冲突）；vitest 段进行中被主协调的 CI 排程指令取消，未跑完。
- **本会话未取得自己的完整 EXIT=0 回执。** 功能提交 `83a2852` 的全链验证来自后续包含它的绿色运行：GOV-UX 第三轮 ci:local 在 `92fd450` 上 EXIT=0（774133ms；`92fd450` 的直接父提交即 `83a2852`，该运行只多出治理域的改动）；MFG-1 的干净快照 ci:local 在 `d3fec40` 上 EXIT=0（`83a2852` 为其祖先）。两次运行均覆盖本批全部代码。

### 5.1 复核结论（主协调，2026-11-23）

- 代码复核通过：`83a2852` 的 20 个文件全部在 `apps/web/src/commercial/console/` 内，零共享文件；`bootstrap.ts`、`packages/ui`、`.github` 未动。
- 本会话 CP 自报的「`pkill` 误杀 GOV-UX 的 CI」经核实**不成立**：GOV-UX 第三轮日志末次写入 14:38:53.030 且为 `EXIT=0`，该 `pkill` 完成于 14:38:53.795；其命令行自身含匹配串，杀掉的是自己的 shell。
- 本文档、index 条目与台账段由主协调依据会话留在 `/tmp/com-ux/docs-draft/` 的稿件落盘，仅将「CI 结论」改为与上述事实一致；其余内容为会话原稿。

## 6. 共享文件改动

**无。** `console-entry.ts`（规则更新后允许纯追加）本批无需改动——五页挂载宿主已在 U3-COM 批接好，新增模块全部由既有页面文件直接 import；`mount.tsx`/`registry.ts`/`bootstrap.ts`/`bootstrap.test.ts`/`style.css`/`structure-gate.mjs` 未触碰。

## 7. 登记与边界

- **TD-COMX-001（开放，待数据面裁定）真「多供应商」报价比价**：`cost_specification_factors` 每因子仅绑定单一取价来源（source_type + source_item_version_id + price_source_name）；本批「并排」= 同因子跨模型的来源对比。跨供应商多报价横向比价需 supplier-quotes 端点迁移/认领 + 宿主端口接线（registry.ts / console-entry.ts 均在本批边界外）。
- **TD-COMX-002（开放，基座缺陷，packages/ui 边界外）**：`StatusBadge` 的 `danger` tone 在 `packages/ui/src/components.css` 无对应规则（仅 `data-tone='error'`），danger 徽章实际回落灰色系；本批自有 `.com-tag[data-tone='danger']` 不受影响。基座修复需另批（ADR-0014 治理范围）。
- **TD-COMX-003（开放，口径待裁，R5 存疑不擅改）**：商机「已逾期」口径含 CANCELLED（`isOpportunityOverdue`/`opportunityPipelineSummary` 仅排除 WON/LOST，vanilla 与 U3-COM-1 以来如此）——已关闭列中已取消卡片仍显示「成交日期已逾期」。本批逐字保持既有口径；是否将 CANCELLED 排除出逾期属行为变更（R2），待主协调裁定后单独登记提交。
- 未 dispatch workflow；未触 `.github/workflows/`。本会话未执行 push；功能提交 `83a2852` 于 14:27:28 被 CRM-UX 会话的推送带上远端（共用分支的固有行为，主协调已定性为不违规）。
