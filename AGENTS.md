# AGENTS.md

> 本文件是**内容目录（地图）**，不是百科全书。需要细节时按下方指引跳转；改造施工期间先读 `docs/HARNESS-RULES.md`。

## 这是什么项目

KingTurf 业务操作系统：面向草坪行业外贸业务的 ERP（CRM→报价→订单→生产→发货→财务全链路），pnpm monorepo 纯 Web 架构（Vite 原生 TS SPA + Node 原生 http API + PostgreSQL 17），生产站点 erp.kingturf.cn。

## 如何开始（渐进式披露：先地图，再细节）

- 架构总览与依赖方向：见 `ARCHITECTURE.md`
- 设计理念与操作原则（争议裁决依据）：见 `docs/design-docs/core-beliefs.md`
- 当前执行计划与进度（2b已人工验收；commission11/11整域已协调确认，dashboard1/1整域已协调确认，manufacturing571旧护栏5d13637/候选5297b43已协调通过，①三GET8f09c64/e6c14c7已协调确认，②item create c1f6cb8/7f46e59已协调确认，③BOM fff522b/1baafb0已协调确认，④routing69d45b0/6170829已协调确认，⑤publish源码4eefe79已提取，manufacturing整域9/9已协调确认（4eefe79/241e8c5），第四域mrp930旧护栏4b6d629/候选dce3730已协调通过，①三GET670e860/7a64a69已协调确认，②policy d2f99e6/b56ab13已协调确认，③demand a9cc216/0dd97b3已协调确认，④run1378858/febd410已协调确认，⑤proposal源码71dc7f2已提取、MRP整域10/10已协调确认（71dc7f2/bb114ff），第五域procurement1762旧护栏62ae106/候选7f085e0已协调通过、①七GET ac5e830/8340c8d已协调确认，②supplier01721fa/e25bee5已协调确认，③qualification ad13078/bc42ce0已协调确认，④RFQ b91ec58/551619a已协调确认，⑤quote24102f2/c54b496已协调确认，⑥PO316272b/97e6a2f已协调确认，⑦issue73c4c78/f3219f7已协调确认，⑧location ed7067f/3ed9dfd已协调确认，⑨receipt18f1641/a2e9a15已协调确认，⑩movement源码2734a12已提取，采购17/17整域已协调确认（2734a12/4c9bc84/0eccaf6）；第六域risk1099旧护栏f398137/候选d1644cc已协调通过，①两GET ea7b123/27530cc已协调确认，②policy create 2f87db3/50eb2e3已协调确认，③revision4789b8d/d7b9627已协调确认，④publish d5a11ed/b17dd12已协调确认，⑤evaluate5b320af/d9651b4已协调确认，⑥task92b3df4／证据f6a2e3b／索引f1a6bf5整域9/9已协调确认；2c现7/8域协调完成，第七域order-360固定751／候选bc384f7-cc4ee7f已协调通过，单GET41240aa／证据89c3987整域1/1已协调确认；第八域quality1310／候选ddb7853-6e8587a已协调通过，①三GET35a8a78/d77d305已协调通过，②plan create0e67024/35ee0d0已协调通过，③plan publish5bbb84b/82d5875已协调通过，④inspection open702ff4b/2bd59d1已协调通过，⑤transitions1694538/d319a4f已协调通过，⑥仅results提取授权、待实施9/12（§4.2.17））：见 `docs/exec-plans/active/` §4.2.17
- 已知技术债（36 条台账，含已解决历史项）：见 `docs/exec-plans/tech-debt-tracker.md`
- CI 与发布决策（非 Tauri，仅 workflow_dispatch 部署，无 tag/Release）：见 `docs/CI.md`
- 全部文档索引：见 `docs/index.md`
- 关键决策记录：见 `docs/adr/`（10 个 ADR）

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
