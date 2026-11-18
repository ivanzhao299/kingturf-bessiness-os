# Wave1 合并验证与 CP3 发布材料 — 2026-11-18

> 执行会话（系统管理优化 M1a→M4）产出。范围：Wave1（A2+B1+B2+B4）干净 HEAD 门禁、
> `e2e:p1` 实跑、发布材料（只读准备，未执行任何远程操作）。授权与计划见
> [执行计划](../tasks/system-admin-optimization-plan-2026-11-18.md) §5/§8。

## 1. Wave1 提交链（main，本地未推送）

| 提交               | 内容                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| 1583197            | feat(api): restrict permission catalog writes to system administration（A2）         |
| dc7b74d            | feat(api): reserve system administration role codes from tenant creation（M1a）      |
| 14ea098            | feat(web): split governance into sub-routes with overview compatibility（B1+B3+C4）  |
| 3bcb508            | feat(api): adopt cursor pagination contract for governance list endpoints（B2 后端） |
| 3c2dc50            | feat(web): paginated governance tables, search and fixed audit export（B2 前端）     |
| 1609254            | fix(web): guard optimistic version fallback and label scope grants（B4 补齐）        |
| （本证据文件提交） | docs(evidence): wave1 verification and CP3 release materials                         |

发布候选 SHA = 含本文件的最终 HEAD（精确值见 CP3 报告；dispatch 输入以当时 `git rev-parse HEAD` 为准）。

## 2. 干净 HEAD 完整门禁（pnpm ci:local 实跑）

| #   | 时间                         | 耗时  | exit                               |
| --- | ---------------------------- | ----- | ---------------------------------- |
| 1   | 2026-11-18 B4 提交后         | 8m54s | **0**（log：/tmp/ci-b4.log）       |
| 2   | 2026-11-18 本地 e2e 栈拆除后 | 9m6s  | **0**（log：/tmp/ci-m4-run2b.log） |

两轮均含 14 步全链（format/doc/structure/service/capabilities/db-guard/migrate/status/lint/
typecheck/test:coverage/build/security）。API 17,758 + web 444 测试全绿；无新增结构违规。

## 3. pnpm e2e:p1 实跑（Playwright，单 worker，真实浏览器渲染）

- 结果：**11 passed / 0 failed（25.0s）**，覆盖登录→商机看板→信用审查三态→订单/AR/核销→
  移动端 390×844→Order360→佣金→风险→KPI→制造 BOM→采购/MRP→生产执行全链演示断言。
- 环境预检与搭建（全部本地、无远程操作）：
  1. `kingturf_dev` 迁移至 72 schema；一次性 SQL 种子 `admin`/`credit.approver`
     （同 `scripts/e2e-docker/fixture.mjs` 模式，scrypt 哈希，全能力角色，本地口令，不入仓库）；
  2. API（:3000）+ `vite preview`（:4173）本地启动，`/ready`、token-login、preview 代理全 200；
  3. `pnpm demo:seed` 后实跑 spec。
- **偏差（如实记录）**：
  - a) 本 WSL 无 `/opt/google/chrome` 且无 sudo，仓库 `playwright.config.ts` 钉定
    `channel:'chrome'` 无法满足；Windows 侧真实 Chrome（157）经验证仅支持库级
    `connectOverCDP`（test runner 的 `connectOptions` 走 Playwright 私有协议，不适用）。
    实跑采用**仓库外**临时配置 `/tmp/pw-e2e-local.config.ts`（同参、去 channel）+
    Playwright 自带 Chromium（Chrome for Testing 151，缺失的 libnspr4/libnss3/libasound
    以用户目录解包 deb + LD_LIBRARY_PATH 供给，免 sudo）。仓库 e2e 配置零改动。
  - b) 会话代理环境变量（HTTP(S)\_PROXY=127.0.0.1:8888）会劫持 Playwright 连接，实跑命令
    显式 `env -u` 解除；CI/GitHub Actions 无此变量，不影响发布链。
  - c) `.test-results/playwright` 为 10 月 root 属主残留导致 EACCES：已整体改名保留为
    `.test-results/playwright-root-oct26`（未删除任何历史产物），新建用户属主目录。
  - d) 首次后台 ci:local 与本地 e2e 栈端口互相干扰（session-network 网关用例挂起），
    拆栈后第 2 轮干净通过——结论：跑全链门禁前需停本地 dev/preview 栈。

## 4. CP3 发布材料（只读准备；执行须待主协调放行）

### 4.1 workflow 输入契约（以当前 yml 为准）

**release-images.yml**（构建+推 GHCR，dispatch 于 main）：

- `commit_sha`（必填）：40 位小写 hex，须在 `origin/main` 历史内（workflow 自校验
  `git merge-base --is-ancestor`）。
- 产物：`ghcr.io/ivanzhao299/kingturf-erp-{api,web}:<sha>`；job outputs `api_digest`/
  `web_digest`（sha256 根 digest，写入 step summary）。

**recover-application-images.yml**（生产应用-only 发布唯一入口）：

- `commit_sha`（必填）：同上规则；
- `api_digest`/`web_digest`（必填）：**已获批准的 GHCR 根 digest**（对 release-images
  run 产物核验后取用）；
- `images_run_id`（必填）：产出上述镜像的成功 release-images run ID（Actions 页/`gh run
list --workflow release-images.yml` 获取）。
- workflow 固定 `github.workflow_sha` 为控制脚本版本；validate→verify（完整 ci:local 同款
  于候选 SHA）→ 生产 job（production 审批+`kingturf-erp-production` 并发锁）。

### 4.2 发布步骤清单（应用-only，按 PRODUCTION_PARK_HOST.md）

1. 主协调放行后 `git push origin main`（推送 Wave1 提交链，含发布候选 SHA）；
2. dispatch **release-images**（输入候选 SHA）→ 等待成功，记录 run ID 与 api/web digest；
3. 核对 digest 与 tag（workflow 内建交叉校验已含；人工复核 step summary）；
4. dispatch **recover-application-images**（四输入：SHA、api_digest、web_digest、run ID）；
   production 环境审批通过后执行：停服前 **pg_dump 恢复点** → 只读 72-schema 全等校验
   （FULLY_MATCHED，本波 schema 未动）→ 镜像导入/核验 → 应用切换（API/Web `--pull never`）；
5. 探针验收：`/health` `/ready` `/version`（必须 == 发布 SHA）+ 公网 HTTPS 探针全绿。

### 4.3 回滚预案（Wave1 无迁移参与）

- 按历史 main SHA 重新 dispatch recover-application-images（workflow 支持回滚发布旧应用
  SHA，控制脚本取当前 workflow 版本）；schema 未动，旧应用启动元数据校验必然通过；
- 不涉及反向迁移；恢复点 dump 与既有 bundle 按现行契约保全、不清理。

### 4.4 pg_dump 恢复点确认项

- [ ] 发布 run 在同步任何配置/应用前创建 `.release-backups/` 自定义格式 dump（workflow 内建）；
- [ ] dump 与前后 SHA 元数据成对记录；
- [ ] 失败不清理：candidate 未过探针时，恢复点与 rollback 镜像保留（现行契约）。

## 5. 本地验证遗留物说明

- `~/pw-libs/`（解包的三个系统库 deb）与 `/tmp/pw-e2e-*.config.ts`、`/tmp/provision-e2e-admin.mjs`
  为一次性本地工具，不入仓库；`kingturf_dev` 中的种子账号仅供本地 e2e。
- `.test-results/playwright-root-oct26` 保留待主协调处置（root 属主历史产物，未删）。
