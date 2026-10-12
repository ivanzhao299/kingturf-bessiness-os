# CI 配置决定

> 依据 `docs/HARNESS-RULES.md` §3（框架识别与条件式 CI）与附录 C 模板建立。
> 本文档记录框架判定结论、现有 CI 盘点与后续 CI 相关决策，长期保留（§14.3）。

## 1. 框架判定

- **判定结果：其他类型（纯 Web 的 pnpm + TypeScript monorepo，非 Tauri / 非桌面应用）**
- **判定日期：2026-10-12**（基线 commit `779dea3`）
- **判定证据**（按 §3.2 机械判定表逐项核对）：

| 检查项                                                           | 结果   | 证据                                                                                  |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `src-tauri/tauri.conf.json` 存在                                 | 不命中 | 仓库根无 `src-tauri/` 目录（`ls src-tauri` → No such file or directory）              |
| `src-tauri/Cargo.toml` 依赖含 `tauri`                            | 不命中 | 全仓 `find -name 'Cargo.toml'`、`find -name '*.rs'` 零命中                            |
| 任意 `package.json` 依赖含 `@tauri-apps/cli` / `@tauri-apps/api` | 不命中 | 根及全部 8 个子包 `package.json` 与 `pnpm-lock.yaml` 大小写不敏感 grep `tauri` 零命中 |

- **实际技术形态**：
  - 前端 `apps/web`：Vite 7.3.6 构建的**无框架（vanilla TypeScript）SPA**，原生 DOM 操作，零 UI 库依赖
  - 后端 `apps/api`：Node.js 24 原生 `node:http` 服务器（`apps/api/src/server.ts`），无 express/fastify
  - 数据层：PostgreSQL 17 + 原生 `pg` 8.22.0 + 70 个手写 SQL 迁移（`packages/database/migrations/`）
  - 共享包：`packages/{types,domain,config,database,ui,testing}`
  - 运行时依赖合计仅 `pg` 一个外部包

## 2. 现有 CI 现状（存量项目必填）

| 文件                                      | 触发条件                                                | 覆盖平台         | 是否自动发布     | 备注                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                | `pull_request` + `push`（仅 main）+ `workflow_dispatch` | 仅 ubuntu-latest | 否               | 单 job `quality`：postgres:17.7-alpine3.23 service 容器 + `pnpm ci:local` 完整门禁链，15 分钟超时，permissions contents:read                                                                                                                                                                                                                                  |
| `.github/workflows/deploy-production.yml` | **仅 `workflow_dispatch`**（必填输入 `commit_sha`）     | 仅 ubuntu-latest | **否（纯手动）** | 三段式：`validate`（SHA 守卫）→ `verify`（对指定 SHA 跑 lint/typecheck/test/build，带 PG service）→ `deploy`（`environment: production`，SSH 到新加坡主机，pg_dump 恢复点 → rsync → nginx 配置校验（sha256 比对）→ `docker compose -f infra/docker/compose.production.yaml up -d --build` → `/health` `/ready` `/version` 探针，version 必须等于 commit_sha） |

**审计结论**（阶段 1 只审计、不改动）：

- 现有 CI **有效且未腐烂**：`ci.yml` 执行的 `pnpm ci:local` 与根 `package.json:29` 的脚本一致，且可在本地一条命令复现（install → format:check → frontend-capabilities → database guard → migrate → status → lint → typecheck → test → build → security:check）。
- `deploy-production.yml` 是事实上的发布链路：**无 tag 触发、无 GitHub Release、无产物上传**；发布标识 = commit SHA（`KINGTURF_RELEASE_SHA` 注入，`/version` 端点回显并部署后校验）。
- 全部 package.json `version` 为 `0.0.0` 占位，无语义化版本管理（已登记 TD-VER-001，属待人工决策 D2）。

## 3. 交互确认记录（仅 Tauri 填写）

**不适用。** §3.2 判定为「其他类型」，按 §3.4：

- 不询问 §3.3 的三个问题（是否生成 GitHub CI / 目标平台 / Release 发布方式）；
- **不生成**多平台打包与 Release 流水线；
- 基础门禁（lint / typecheck / test / build / format）按规则 §5 阶段 3 在现有链路上补强（git hooks、commitlint、覆盖率门禁等，详见 `docs/exec-plans/active/harness-migration.md`）。

> 记录：框架判定 = 其他类型，本项不适用多平台打包与 Release 流水线（2026-10-12）。

## 4. 落地说明

- 阶段 1 **未生成、未修改**任何 `.github/workflows/` 文件（规则 §5 阶段 1 禁止事项）。
- 现有 `ci.yml` / `deploy-production.yml` 保留不动；若后续阶段需要接入覆盖率上报、文档门禁等新步骤，将在对应阶段单独提交并更新本节。
- 部署链路文档（**仅 `workflow_dispatch` 指定 commit_sha → validate → verify → SSH → Docker → 探针；无 tag 触发、无 GitHub Release、无产物上传**）在阶段 2 补全到 `docs/`（规则 §5 阶段 2 子任务 9）。

## 5. 变更历史

| 日期       | 变更                                                                | 原因                                                                                  |
| ---------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2026-10-12 | 建档：落盘框架判定（其他类型/非 Tauri）与现有 CI 审计结论           | Harness 改造阶段 1 产出物（规则 §5 阶段 1 / §3.4）                                    |
| 2026-10-12 | 修正 §4 表述：「tag/dispatch」改为「仅 workflow_dispatch 指定 SHA」 | 人工审核 P2：实际 workflow 无 tag 触发，原表述会误导后续会话补出不存在的 tag 发布链路 |
