# AGENTS.md

> 本文件是**内容目录（地图）**，不是百科全书。需要细节时按下方指引跳转；改造施工期间先读 `docs/HARNESS-RULES.md`。

## 这是什么项目

KingTurf 业务操作系统：面向草坪行业外贸业务的 ERP（CRM→报价→订单→生产→发货→财务全链路），pnpm monorepo 纯 Web 架构（Vite 原生 TS SPA + Node 原生 http API + PostgreSQL 17），生产站点 erp.kingturf.cn。

## 如何开始（渐进式披露：先地图，再细节）

现时3e②：按route首次缺失源读取/已访问复用候选已完成163测试、原29及新47浏览器护栏，公开70/457断言链及默认逆AST守恒；root749/完整158/AST3/格式5、8新runtime≤139/完整106/AST5，29豁免保持。现45台账，TD-WEB-008旧抽屉候选仅登记。源码稳定干净HEAD全CI待执行；日期统一3e及解析3f尚未完成，继续至3f后整批人工验收。下段3e①为前一检查点历史。

3e①store守恒完成：源码fc14d50稳定干净实际HEAD全CI0/184438.376ms；root704/完整函数160/AST3，五runtime≤215/函数50/AST5，完整class逆展开/70公开457链/原114+六契约120/五红绿/新41及原fixture29齐；撤入口豁免31→29，44台账仅登记旧疑点。尚非真正lazy或3e完成；完成docs实际HEAD另全CI后续惰性加载/日期3e→解析3f，3f后整批人工验收。详见计划§7。

- 架构总览与依赖方向：见 `ARCHITECTURE.md`
- 设计理念与操作原则（争议裁决依据）：见 `docs/design-docs/core-beliefs.md`
- 当前执行计划与进度（3e①store守恒完成，续真正惰性加载/日期→解析3f，原Playwright补跑保持）：见 `docs/exec-plans/active/` §4.4及§7
- 已知技术债（44 条台账，含已解决历史项及仅登记的TD-WEB-004/005/006/007、TD-TEST-007、待核实TD-PERF-003）：见 `docs/exec-plans/tech-debt-tracker.md`
- CI 与发布决策（非 Tauri，仅 workflow_dispatch 部署，无 tag/Release）：见 `docs/CI.md`
- 全部文档索引：见 `docs/index.md`
- 关键决策记录：见 `docs/adr/`（10 个 ADR）

## 硬性约束（不可违反）

3c②完成：源码9429a31与独立工具3f3aae7均稳定干净HEAD全CI0；12模块/入口10972 split、逆展开/114/457/70/11目标红绿及两次无trace合并13齐，旧失败史/有限竞态保留。现仅完成证据归并，文档HEAD全CI后续3c③，见 `docs/evidence/frontend-3c2-pricing-2026-10-16.md`；3f后整批人工验收边界不变。

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
