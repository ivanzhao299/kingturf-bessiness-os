# TD-COMX-003 已取消的商机不算逾期

隔离工作树 `wave3/opp-overdue`（分支 `fix/w3-opportunity-cancelled-overdue`，基线 main `4a93003`）。2026-11-26 项目所有者裁定「已取消的商机不算逾期」属行为变更（2026-11-25 主协调在台账 TD-COMX-003 行先行登记为已裁定）；本批按 R2 单独提交修正口径。代码与测试提交 `f596213`，文档（本文件、索引与台账）随后单独提交。

## 口径现状与修正

两处口径此前各自内联同一条规则、只排除 WON 与 LOST：

- `apps/web/src/commercial/console/opportunity-list-pipeline.tsx`（原 66-69 行）`isOpportunityOverdue`——商机列表视图的逾期标记（`opportunity-list.tsx` 148-150 行）与管道看板卡片「成交日期已逾期」标签都由它驱动；
- `apps/web/src/commercial/readiness.ts`（原 54-74 行）`opportunityPipelineSummary`——`overdue` 计数被 console-entry.ts 汇总卡与 bootstrap.ts 旧导出使用。

修正方式：新建共享判定模块 `apps/web/src/commercial/opportunity-overdue.ts`（10 行），排除 WON/LOST/CANCELLED、无预计成交日期不算逾期、其余在途状态按日期早于今天判定；`readiness.ts` 的 `overdue` 改走该判定（`active` 计数不动——CANCELLED 仍计入「在途商机」，该语义不在裁定范围）；`opportunity-list-pipeline.tsx` 改为导入后再导出，保持 `./opportunity-list-pipeline` 原导入面不变。两文件内注释均标注 TD-COMX-003。商机域的「逾期」文案全部经由这两个函数（其余「逾期」命中属应收/催收/质量域，不在本任务范围），无需改文案。

## 先红后绿

新增断言先在旧实现上跑出真红（`pnpm --filter @kingturf/web exec vitest run src/bootstrap.test.ts src/commercial/console/opportunity-list.test.tsx`，输出存产物目录 `red/red-run-vitest.txt`）：

| 文件                                                               | 新断言                                                                                                                                                        | 旧实现实测             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `bootstrap.test.ts:795-823`（新用例「已取消的商机不计入逾期数」）  | CANCELLED+过期不计逾期，OPEN+过期仍计、OPEN+未到期计入 closingSoon、CANCELLED 仍计入 active（期望 `{active:3, overdue:1, closingSoon:1, customerMissing:0}`） | `overdue: 2`，断言失败 |
| `opportunity-list.test.tsx:102-108`（既有用例内补 CANCELLED 判定） | `isOpportunityOverdue({status:'CANCELLED', expectedCloseDate:'1999-01-01'}, today) === false`                                                                 | 返回 `true`，断言失败  |

2 failed / 122 passed（红跑日志中该断言报 107:7，当时替身尚未补注释行，与入库行号差一）。修正过程中有一次中间红：第一版用纯再导出（`export { isOpportunityOverdue } from '../opportunity-overdue'`）不建立模块内绑定，看板卡片 16 例报 `isOpportunityOverdue is not defined`（会话输出，未留存产物——复跑定向三文件时的 tee 覆盖了同一 `green-targeted-vitest.txt`），改为 import+export 后消除；该教训仅记录于此，入库代码注释只说明「再导出保持原导入面」。

修正后定向三文件 136/136 通过（bootstrap 116、opportunity-list、opportunity-list-pipeline 12；`green-targeted-vitest.txt`）。两个控制台测试文件里的 `pipelineSummary` 端口 double 同步补排 CANCELLED，保持与真实端口镜像一致。

## 门禁实测（2026-11-26，本会话实跑）

| 检查          | 命令                                         | 结果                                                                   |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Web 全量测试  | `pnpm --filter @kingturf/web test`           | 65 文件 1025/1025 通过                                                 |
| Web typecheck | `pnpm --filter @kingturf/web typecheck`      | 通过（tsc --noEmit 无输出）                                            |
| 格式          | `pnpm exec prettier --check`（6 个改动文件） | 全部符合                                                               |
| Web lint      | `pnpm --filter @kingturf/web lint`           | 通过                                                                   |
| Web 构建      | `pnpm --filter @kingturf/web build`          | 通过；登录入口 JS 11752 bytes，启动预算守卫与 console css guard 均通过 |

`pnpm ci:local` 与 API 侧测试本会话未跑，由主协调的暂存后门禁与审查覆盖（第一提交门禁与审查已通过）。

## 真浏览器走查与定向截图

栈：`scripts/e2e-local/e2e-local.mjs up`（容器 `e2e-harness-oppoverdue`，专用库 `kingturf_test_e2e_a1709355`，演示数据灌入后即拆）。全部重任务经 heavy 闸执行，产物在仓库之外 `/home/jinhuit/Kingturf/kingturf-coord/wave3/opp-overdue-artifacts/e2e/`。

**造数**（P1 演示数据只有一条 OPEN 商机，无已取消形态，按任务书用接口在专用库造一条）：token-login 取合成 admin 令牌 → `POST /api/v1/opportunities`（挂演示客户 KT-P1-DEMO-001，`expectedCloseDate='2026-08-01'` 为过去日期——创建端点只做字符串校验不拒绝过去日期）→ `PATCH /api/v1/opportunities/:id` `{status:'CANCELLED', reason:'TD-COMX-003 定向验证：已取消商机不算逾期', expectedVersion:1}`。脚本 `e2e/seed-cancelled-overdue.mjs`（幂等，按名称查找），输出 `created id=912108f4-bb63-4a82-b881-fbb10c1542ba` → `final status=CANCELLED expectedCloseDate=2026-08-01`（会话 stdout，未留存产物；终态由下文 `e2e-shot-result.json` 与两张截图证实，截图页面即该名称的记录）。

首次造数用 `customerId:null` 被 500 拒绝，根因是 `opportunities` 表 `CHECK(customer_id IS NOT NULL OR lead_id IS NOT NULL)`（`packages/database/migrations/0021_commercial_sales_to_cash.sql:24`），legacy 端点把约束冲突映射为 `internal_error` 而非 4xx——既有行为：控制台新建表单的「暂不关联客户」选项必然触发（`apps/web/src/commercial/console/opportunity-list.tsx:244`、285-286；校验放行见 `apps/api/src/routes/opportunities.ts:120-121`）。超出本批范围未修，仅在本证据与台账小节记录、未立 TD 行，待主协调按 R4 登记（TD-PROC-015 已有同形态先例）。

**走查**（`walk --routes opportunities`）：

| 视口             | 结果     | ready | 控制台报错 | ≥400 | 布局问题 | 抽屉焦点 |
| ---------------- | -------- | ----- | ---------- | ---- | -------- | -------- |
| desktop 1440×900 | 1/1 可达 | 794ms | 0          | 0    | 0        | 0        |
| mobile 390×844@2 | 1/1 可达 | 656ms | 0          | 0    | 0        | 0        |

报告在任务书指定路径 `e2e/walk/desktop/report.json` 与 `e2e/walk/mobile/report.json`，`summarize.mjs` 复核全零（汇总输出已补存为 `e2e/walk/{desktop,mobile}/summarize.txt`，由留存的 report.json 生成；登录前预期 401 会话探测按 walk 配方剔除）。

**定向截图**（`e2e/shot-cancelled-overdue.mjs`，真 Chromium 登录后断言并截图，EXIT=0）：

- 管道视图：已取消卡片（预计成交 2026-08-01）逾期标记 0 个、「已取消」标签保留；截图 `e2e/shots/pipeline-cancelled-no-overdue.png`；
- 列表视图：同一行 `data-overdue="false"`、无「成交日期已逾期」文案；截图 `e2e/shots/list-cancelled-no-overdue.png`；
- 汇总卡「在途商机 2 / 已逾期 0 / 30 天内预计成交 0 / 未关联客户 0」——已取消+过期商机计入在途、不计入逾期，与裁定及钉死的测试一致；
- 登录后 `consoleErrors=[]`、`badResponses=[]`。

拆栈 `down`：容器已删、专用库已删、口令文件随拆栈删除。本会话未跑：`pnpm ci:local`、API 侧测试、e2e P1——Web 侧测试与构建见上文门禁实测表，走查仅覆盖 `opportunities` 路由。
