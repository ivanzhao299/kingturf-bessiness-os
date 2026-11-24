# AGENTS.md

> 本文件是**内容目录（地图）**，不是百科全书。Harness 改造已于 2026-10-21 竣工；常驻契约见 `docs/design-docs/core-beliefs.md`、`ARCHITECTURE.md`、`docs/CI.md`、`docs/GATES.md`，施工记录见归档计划。

## 这是什么项目

KingTurf 业务操作系统：面向草坪行业外贸业务的 ERP（CRM→报价→订单→生产→发货→财务全链路），pnpm monorepo 纯 Web 架构（Vite 原生 TS SPA + Node 原生 http API + PostgreSQL 17），生产站点 erp.kingturf.cn。

## 如何开始（渐进式披露：先地图，再细节）

**PROC-2 供应链域 UX 第二批完成（2026-11-24，停 PROC-2-CP）**：采购域子路由化（TD-PROC-010，行为变更：路由结构）——`#/procurement` 改为**概览**（四张汇总卡口径与文案沿用、目标子路由对当前账号可见时可点入；两块 vanilla 台账原样保留），新增 `procurement/suppliers`（供应商与准入）/ `rfqs`（询价管理）/ `purchase-orders`（采购订单）/ `goods-receipts`（收货管理）四条子路由，各承载一个控制台，可见性按各控制台主数据源的读权限注册（`supplier:read` / `procurement:read`），侧栏「采购管理」升为独立分组；四宿主迁出 console-entry.ts（745→503 行，TD-PROC-005）。询价与供应商抽屉对比表在容器内容宽 ≤420px 改按供应商堆叠卡片（TD-PROC-008；测不到宽度时保持矩阵），并修复桌面供应商名一字一行（单元格内徽章折行，单独提交）。零 API/仓储/域层改动、零新写路径、零 packages/ui 改动、登录入口预算不变。基线 `e0babf3` 四提交（`35da63e` fix / `9af788f` refactor 纯搬移 / `6902b9e` feat / `5f1f73b` fix，21 文件），web 749（新增 26）；真浏览器自测定向量测 30/30、e2e P1 三轮 11/11（非主协调复验）；被修改的断言 2 处（改前改后见证据 §5）。新登记 TD-PROC-012、TD-TEST-025；待裁：桌面列宽、采购模板面板是否下放子路由、堆叠形态下的报价单图例。ci:local `2c4d283` EXIT=0/710s（API 17969、Web 749、演练 145 OK）。main 其后前进到 `cbb2fca`：在「main + 本批四个代码提交」上复测 30/30、e2e 三轮 11/11；代码四提交 rebase 零冲突，文档提交在台账一处冲突，按指令未自行解决、待裁。证据 `docs/evidence/proc-2-anatomy-layout-2026-11-24.md`（§8 为「制造主数据子路由化」可照做的接线步骤）。

**UX 波次真浏览器验收（2026-11-24，部署前门禁）**：五域 UX 波次首次在真实浏览器（Docker Playwright）全站走查，36 路由×桌面/移动。修复后零控制台报错、零失败请求、零页面溢出；e2e P1 以合成账号 11/11（浏览器/代理/API 同容器，仓库原配置三轮稳定）。抓出并修复：采购订单详情接口 500（P1，已随 0e76bac 上线；TD-PROC-011）、API 不记录未预期异常（TD-API-004）、表格/排序表头/主从布局等基座样式缺口（TD-UI-003）、供应链与客户域 16 条加性 SQL 无真库测试（TD-TEST-022）。只覆盖读路径与单一全权限账号（TD-TEST-024）；本地 e2e 配方入库待办（TD-TEST-023）。证据 `docs/evidence/ux-real-browser-verification-2026-11-24.md`。**已发布两次**（2026-11-24）：`d1dc0f3`（run 45306198023）与 `cbb2fca`（run 45327251031，加 MFG-3 工艺路线、侧栏与表格排版修复、CI 上限 30 分钟 TD-GATE-004），线上逐条核对见 `docs/evidence/ux-wave-release-2026-11-24.md` §3 与 §8。**线上已知缺陷**：数字输入框未写 step 时小数被浏览器原生校验拦下（采购单价、工时等；TD-UI-009，P1），待修后随下次发布。

**U3-MFG-3 工艺路线管理子批完成（2026-11-24，隔离工作协议首批）**：manufacturing-routings 域四端点（GET 列表 additive 复合键集分页+筛选（默认无参=legacy 全量逐字节一致）/GET 详情 additive（根行+产品+全部版本，**工序 sequence 升序**——顺序步骤视图数据源）/POST 创建 legacy 同链/PUT publish 分派 legacy publish('routing') 同链——发布写路径已存在零新写语义，registry 累计 68 路径/18 文件）+ 工艺路线 Preact 控制台（治理同款主从布局：左产品类型树/右 DataTable、详情抽屉**顺序步骤视图**竖向步进条、新建抽屉**工序编辑器**（增删/上移下移/sequence 依行序重排）——单工序载荷与 vanilla 逐字节一致、工序行字段带行前缀防 FormSection 同名互覆）挂 manufacturing-workbench 面板内；vanilla 路线卡+表单退役（裁定 17）——**manufacturing-cards/manufacturing-forms/behavior 测试三文件删除、style.css manufacturing 规则清空**；宿主独立 console/routing-host.ts（bom-host 范式）；ROUTING_VERSION_PROJECTION 与提取前 303 字节机械验证相等；f3 re-pin 311/311；PG 集成 21/21；ci:local 于干净提交快照隔离 worktree 实跑（专用 PG 5436）；e2e P1 口令不可得未实跑（文案契约静态核对：三编码独占/徽章 6 处/无草稿无发布文案）；packages/ui FormSection 同名互覆提案登记（未改动）。证据 `docs/evidence/u3-mfg-3-routing-console-2026-11-24.md`。

**U3-MFG-2 BOM 管理子批完成（2026-11-23）**：manufacturing-boms 域四端点（GET 列表 additive 复合键集分页+筛选（默认无参=legacy 全量逐字节一致）/GET 详情 additive（产品+版本行项+**组件层级树**——深度 3、环守卫、替代料换算系数）/POST 创建 legacy 同链/PUT publish 分派 legacy publish('bom') 同链——零新写路径语义，registry 累计 64 路径/17 文件）+ BOM Preact 控制台（治理同款主从布局：左产品类型树（成品/半成品，经 productTypeOf 预聚）/右 DataTable、行级查看+草稿发布、详情抽屉**组件层级树折叠+替代料标记+版本对比三类差异高亮**（前端基于详情行项计算，不新增读端点）、新建抽屉多组件行——单行载荷与 vanilla 逐字节一致）挂 manufacturing-workbench 面板内；vanilla BOM 卡+创建标准 BOM 表单退役（裁定 17），工艺路线一卡保留待 MFG-3；结构修复 b6e20a1（BOM 宿主/动作工厂拆分，G1/G5 不豁免）；TD-MFG-001 域级证明（同码第二版无法经 createBom 建立）入 PG 集成；ci:local 干净快照 b6e20a1 隔离 worktree 实跑 EXIT=0（归属机械确证：reflog+coverage head）；e2e P1 口令不可得未实跑（文案契约静态钉定）。证据 `docs/evidence/u3-mfg-2-bom-console-2026-11-23.md`。

**U3-MFG-1 物料管理子批完成（2026-11-23，生产域启动）**：manufacturing-items 域三端点（GET 列表 additive 复合键集分页+筛选（默认无参=legacy 全量逐字节一致）/GET 详情 additive（关联 BOM/引用/工艺路线/最近工单按 bom:read/routing:read/production:read 读权限门控）/POST 创建 legacy 同链，registry 累计 60 路径/16 文件）+ 物料 Preact 控制台（治理同款主从布局：左分类树/右 DataTable、行级查看+草稿发布、详情抽屉聚合版本历史与关联对象、新建抽屉规格参数按类型动态预设——创建载荷与 vanilla 逐字节一致）挂 manufacturing-workbench 面板内；vanilla 物料卡片+创建物料版本表单退役（裁定 17），BOM/工艺路线两卡 vanilla 保留待 MFG-2/3；**零新写路径**；TD-MFG-001（新建版本端点缺失）/002（规格参数无目录）已登记；e2e P1 口令不可得未实跑（文案契约静态钉定）；ci:local 于干净提交快照隔离 worktree 实跑（同树存在并行会话，回执见证据文档）。证据 `docs/evidence/u3-mfg-1-item-console-2026-11-23.md`。

**U3-PROC 供应链域全栈迁移收官（2026-11-23）**：供应链域四子批（供应商/询价/采购单/收货，U3-PROC-1..4）已迁移至 Preact 控制台 + Fastify 端点（82be13f→0e76bac 共 8 提交，registry 累计 57 端点/16 文件），经主协调逐批复核通过并已推送。供应商/询价/采购单/收货四控制台全部挂载（procurement-workbench 面板内）；supplier 卡片/RFQ 卡片+新建询价表单/PO 卡片+创建签发表单+采购合同文档工作流/收货卡片+登记收货表单均已退役（裁定 17 语义）；新增写路径仅 closeRfq/cancelPurchaseOrder/close 三处（指令明授，R2 登记）。vanilla 残余如实登记：sourcing-register 报价卡片+登记报价表单（supplier-quotes 域未迁移）、inventory-register 库存只读呈现——不在迁移范围待后续裁定；TD-PROC-001（部分收货触发器冲突）/002（供应商停用写路径缺失）/003（独立审批层缺失）已登记。每子批 ci:local EXIT=0；e2e P1 口令不可得未实跑（文案契约逐子批静态核对）。各子批证据见 `docs/evidence/u3-proc-{1..4}-*.md`，收官段见 `docs/exec-plans/tech-debt-tracker.md` 顶部与 `docs/index.md`。U3 生产域（manufacturing+production）待续。

**U3-CRM 客户域全栈迁移收官（2026-11-21）**：客户域四子批（线索/客户/联系人/活动，U3-CRM-1..4）已迁移至 Preact 控制台 + Fastify 端点（a1279b5→1e8b4b6 共 10 提交，registry 累计 42 端点/12 文件），经主协调逐批复核通过。线索 vanilla 视图已退役；数据面 /api/v1/customers\* 生产已走 Fastify 桥；**客户路由 Preact 控制台（含 CRM-3 联系人表单/CRM-4 活动时间线增强）已交付待挂载接线（TD-UI-002，现路由仍渲染 vanilla 视图，接线待主协调另批授权）**。每子批 e2e P1 11/11 零 500、ci:local EXIT=0。各子批证据见 `docs/evidence/u3-crm-{1..4}-*.md`，收官段见 `docs/exec-plans/tech-debt-tracker.md` 顶部与 `docs/index.md`。

**U3-COM 商机域全栈迁移收官（2026-11-21）**：commercial 域七个业务视图（商机/方案/报价/成本矩阵/技术需求/销售政策/信用审查）已迁移至 Preact 控制台 + Fastify 端点（U3-COM-1..7，0ff66bd→3cd897b 共 17 提交，registry 27 路径，已上生产 3cd897b run 44870441719）。七个 vanilla workbench 退役约 1,700 行；行为守恒 parity/契约全绿；e2e P1 11/11 零 500。各子批证据见 `docs/evidence/u3-com-{1..7}-*.md`，收官段见 `docs/exec-plans/tech-debt-tracker.md` 顶部与 `docs/index.md`。

最新839d5ce窄R7→ef908ad同期采集独立API/新增12纯测及合49工具绿；未接runner/未激活、未再次P1，Windows取消只报未确认、不充实测清理。详见 `docs/evidence/harness-final-network-diagnostics-2026-10-20.md`；真实激活/复现与原生Windows精确清理方案另裁。最后材料HEAD全CI实际运行后交接，P1还原全11/两完整轮仍欠、不终验/竣工/§14。

2026-10-20最新同596a927干净HEAD串行A8原26例及runtime原1例全过，Source原19生产器与精确owned回收均过；MRP五处已获批/实施且原11曾一次全绿，完整认证负例1败10过，但精确还原7/11再遇TCP建连超时。TD018仍开放，本机转发只读专项已新授，配置修改另批。见 `docs/evidence/harness-final-browser-evidence-2026-10-20.md` 与 `docs/tasks/harness-final-network-environment-authorization-2026-10-20.md`。P1还原全绿/同状态两完整轮未成，最终新HEAD全CI另实跑，非终验/竣工；下方待裁均保留原时点历史。

最新检查点b8abc83已干净HEAD完整CI0；Source生命周期与MRP五期待仍待人裁，候选已可恢复封存，P链未完成/不能终验。先看 `docs/evidence/harness-final-blocked-checkpoint-2026-10-20.md`；最终新文档HEAD另完整验证，§14不执行。下方此前检查点保历史。

2026-10-20终验收口以 `docs/tasks/harness-final-acceptance-authorization-2026-10-20.md` 为准：37a7bb9阶段5主体已验，非终验/竣工；当前P/B/D与62项DoD去向见 `docs/evidence/harness-final-closeout-preparation-2026-10-20.md`。G5完整函数已机械验证/四有限表，原29不续期；七A绿仍非A8整轮，MRP/Source待裁不冒绿；新SEC008/P1只登记，C生产禁跑，§14只准备。下方旧计数/停点保留历史，以计划§0/7和最新直接人裁落盘为准。

阶段5已由人类正式授权，基线5230625/批次1–4已验收；授权范围/停止边界见 `docs/tasks/harness-stage5-authorization-2026-10-17.md`。先P浏览器裁断与A真实测试地图，再六域PG/覆盖率三目标/≥3注入/三连CI/P1核账/收官准备；只准备§14，不执行归档、不宣称竣工。浏览器上报不阻塞独立线；C生产不跑，源码仅线C临时注入后完整还原。下方所有旧待验收/阶段5未启均历史。

Docker Playwright独立首轮已覆盖A8/B2：A六文件全绿、成本1过1败/Workspace3过1败仍待各自裁定；B runtime原1例真红还原绿，P1原完整11败、部分定位前两例overview看板隐藏，候选已封存还原，见 `docs/tasks/playwright-p1-replay-blocker-2026-10-17.md`。TD-TEST-016/018分别为可见性待裁/连接超时待核，台账58；第二轮未开/C生产禁，最后稳定干净HEAD全CI必跑。下方旧计数/停点均历史。

Workspace已授auth/单void候选2过2败，仅可复现检查点、全文件变异/还原绿未完成；旧首次成本gate/360字段记TD-TEST-014/54项，等待点新批准未实施、字段另待裁。见 `docs/tasks/playwright-workspace-fixture-rulings-2026-10-17.md`；其它3A/2B未跑、成本TD-TEST-013待裁、第二轮/C禁，最终HEAD全CI仍必跑。下方旧计数/未执行为历史。

order会话fixture已真红→还原原1例绿，15expect/viewport后操作字节同；当前login2/doc7/order1过、cost1过1败待裁，余4A/2B未跑、C禁/无第二轮，见 `docs/evidence/playwright-docker-spec-replay-2026-10-17.md`。最后HEAD全CI仍必跑；workspace单void人类新批准待独立R7，不扩业务字段/成本提示。下方旧状态保历史。

文档发送后继：会话适配旧token真红→还原7过，人类ba294ae只授8处旧lint机械兼容，47expect参数/擦除JS（唯一未用void例外）同，最终7过/lint0；旧额外tsc仍2，不关TD-TEST-012。证据 `docs/evidence/playwright-docker-spec-replay-2026-10-17.md` 含一次过早恢复端口拒绝/后严格串行历史。成本TD-TEST-013待裁，余5A/2B未跑、第二轮/C禁，最后HEAD全CI必跑；下方旧时点不覆盖本状态。

当前成本提示C7：f3882a3完整CI真实0/201874.74ms后，成本仅auth候选1过1败，原末提示不可见而前跳转/dialog/预选过。见 `docs/tasks/playwright-cost-handoff-blocker-2026-10-17.md`；TD-TEST-013/现53项，只登记不修业务/期望，临时cost候选精确还原未算完成；login2过、其它6A/2B未跑、C禁/未第二轮。最后文档HEAD全CI后交人裁，独立首轮原授权不永久冻结；下方均历史。

Docker PW首份login夹具已真实变异红→还原2通过，原9expect/导航后操作守恒；执行器中断非零与owned清理已核，见 `docs/evidence/playwright-docker-spec-replay-2026-10-17.md`。其它7A/2B未跑、C2禁跑、第二轮未开始；台账52（新增仅额外tsc旧诊断，不改冻结源码），提交后相关API/Web及干净HEAD全CI另跑。下方旧计数/停点保历史。

P1成本seed最小追加已按人类R7实施：仅原close前policy→calculate→现有异人approve，原其它字节守恒；缺料/自批真实红→还原后同schema完整seed两次0、计数不变。证据 `docs/evidence/playwright-p1-cost-seed-2026-10-17.md`；TD-TEST-011本地前置已验证，台账51，旧C7为历史。提交后干净HEAD全CI再续既授fixture/A8→B2/第二轮；其余业务/断言/SQL/PW配置/生产保护保持。下方旧停点均为前时点。

Docker Playwright前置当前停点：三项人裁已落R7，回环/自然Cookie/PG同一性工具与seed机器URL真红绿完成；TD-TEST-010仅环境pgcrypto可见性已修，完整冻结seed推进到生产关单缺实际成本批准（TD-TEST-011）。台账51，具体业务seed步骤待新裁定，C7停止spec适配/A8/B2/两轮；C生产不跑、两配置/spec/业务源码不改。证据 `docs/evidence/playwright-docker-seed-auth-2026-10-17.md`；最后HEAD完整CI后交协调，非一般阶段5/覆盖率/收官。下方为历史时点。

批次4当前交验：S1–S3已人工验收，S4实施与真实网络/CDP完成，源码f114ee0稳定干净HEAD完整CI0/192524.18ms（API17242/Web313）。唯一包 `docs/evidence/security-batch4-acceptance-2026-10-17.md` 汇总行为/适配/分层/回滚；本次只文档收口，最后文档HEAD完整CI后停协调，整体验收待交付。SEC003关闭载体实施项，SEC001只RO/强制开放；台账49，TD-TEST-006新异步失败候选待核实。评分不抬分，旧PW/Docker/阶段5未启动；下方为历史。

当前批次1/2（含E1）/3已验收64757d4；批次4 S1–S3于2e22837人工验收，六项选型已决并正式授权S4实施。设计efae93d干净HEAD完整CI0/211588.694ms已协调复核；本步仅续自然HTTP Secure Cookie预检工具，后端/config/Web未改，工具最终CI后停协调再续已授后端→前端→网络级/CDP→整批收口。影响报告420f9ba“仅报告硬停”为批准前历史。ADR0003/SQL/签名/零新依赖保持，SEC003真实完成前不关闭。原Playwright补跑、不push/部署/workflow/阶段5边界保持；S3仍仅RO、不代表生产报告通道或强制兼容。

- 架构总览与依赖方向：见 `ARCHITECTURE.md`
- 设计理念与操作原则（争议裁决依据）：见 `docs/design-docs/core-beliefs.md`
- 当前执行计划与进度：见 `docs/exec-plans/active/` §0及§7（2e22837六项已决）；S4开工R7见 `docs/tasks/harness-batch4-s4-authorization-2026-10-17.md`；原影响报告 `docs/tasks/harness-batch4-s4-session-impact-2026-10-17.md` 保留历史/库存/S1–S3证据索引
- 已知技术债（62条含历史解决项；当前逐ID去向见终验E，关联子任务不重复计数）：见 `docs/exec-plans/tech-debt-tracker.md`
- CI 与发布决策（非 Tauri，仅 workflow_dispatch 部署，无 tag/Release）：见 `docs/CI.md`
- 全部文档索引：见 `docs/index.md`
- 关键决策记录：见 `docs/adr/`（10 个 ADR）
- S4实现设计与行为表：见 `docs/tasks/harness-batch4-s4-design-2026-10-17.md`；设计已协调确认，后端业务未编码，工具前置见下项。
- S4后继当前检查点：fead2d1自然预检最终干净HEAD全CI0后续派后端/config/机器接口，见 `docs/evidence/security-batch4-s4-backend-2026-10-17.md`。真实变异/定向API232/config71/PG20绿、独立静态复核无阻断；最终提交后另稳定干净HEAD全CI再停协调。Web/PW未改、SEC003开放。上文“后端未编码/仅工具”为历史。

## 硬性约束（不可违反）

- 分层依赖只能单向（箭头＝"依赖于"，详见 `ARCHITECTURE.md` §1）：`apps/api → packages/{config, database, domain, types}`；`packages/domain → packages/types`；`packages/` 不得反向依赖 `apps/*`；横切逻辑必须走共享模块，禁止跨业务域复制（DataScope 谓词、审计外发、幂等查询已有收敛批次，见台账 TD-DUP 组）
- 行为守恒：重构不得改变业务行为；行为变更/bug 修复必须先登记台账、单独提交（红线 R2）
- SQL 一律参数化（`$1..$n`），禁止拼接用户输入；前端写入 innerHTML 前必须过 `sanitizeBusinessDocumentHtml`
- 认证为不透明 token（scrypt + 服务端哈希存储），不得引入 JWT 等新会话模型（ADR-0003）
- 提交单一职责、Conventional Commits；会话最后一次提交必须过 `pnpm ci:local` 并标注 `[已测试]/[未测试]`
- `prompt-history.txt` 只追加不读取，不入库（§6.3）
- 改造期间（harness 施工未竣工）：不 push 远程、不部署、不改 `.github/workflows/`；执行契约全文见 `docs/exec-plans/active/harness-migration.md` §0.5

## 常用命令

- 安装：`corepack enable && pnpm install --frozen-lockfile`（Node 24 / pnpm 10.33.4）
- 本地数据库：`docker compose --env-file .env -f infra/docker/compose.yaml up -d --wait postgres && pnpm db:migrate`
- 开发：`pnpm dev`（web http://localhost:5173 ／ api http://localhost:3000）
- 全量门禁（CI 同款，一条命令）：`pnpm ci:local`（含 13 个 PG 集成测试，需先导出 `DATABASE_URL`，见 `.env.example`；guard 会校验目标必须是回环测试库）
- 单项：`pnpm test`（同样需 DATABASE_URL）｜ `pnpm lint` ｜ `pnpm typecheck` ｜ `pnpm format:check` ｜ `pnpm build`
- E2E：`pnpm e2e:p1`（Playwright，chrome 单 worker）
- 度量与扫描：`node scripts/analysis/repo-metrics.mjs`（复杂度/重复）｜ `node scripts/analysis/audit-scan.mjs`（安全/性能）
- 文档链接校验：`node scripts/analysis/doc-lint.mjs`
- 结构门禁（复杂度阈值 ≤800/≤200/≤5，白名单存量豁免 + SQL 插值/路由校验强制）：`node scripts/analysis/structure-gate.mjs`

## 规范索引

- 架构：`ARCHITECTURE.md`
- 门禁清单（各项触发时机/失败含义/修复指引）：`docs/GATES.md`
- 可靠性与发布链路 runbook：`docs/RELIABILITY.md`
- 质量评分（按域，可复算）：`docs/QUALITY_SCORE.md`
- 施工规则（竣工后归档）：`docs/HARNESS-RULES.md`
- 历史 ADR / 工程规格 / 验收证据 / 任务档案：`docs/{adr,engineering,evidence,tasks}/`（归并策略待 D4 决策）

## 工作方式

- 改动前先读相关 `docs/`；改动后同步更新受影响文档与 `docs/index.md`
- 每阶段/子批次独立提交，通过门禁后在 `docs/exec-plans/active/harness-migration.md` §7 记录进度与回滚点
- 发现新问题登记 `tech-debt-tracker.md`，不顺手修（R4）；存疑内容标「待核实」不删（R5）
- 关键决策只认仓库落盘：对话里的决定必须写进文档才算数
