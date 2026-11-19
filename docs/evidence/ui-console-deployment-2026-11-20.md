# UI 控制台生产部署终录（governance 九页 + 审计快赢 → 05796e5）— 2026-11-20

> UI 基座计划首批上生产归档：packages/ui Preact 基座 + governance 九子页控制台化 + A-F1 审计快赢随候选 05796e5 完成应用级发布。
> **应用级-only**：f742143..05796e5 零新迁移，schema 74 保持 FULLY_MATCHED。发布由 R1 发布执行代理经主协调逐检查点授权执行（首败→止损→主协调修复→二败→裁定9修复→条件连跑）。

## 1. 成功 Run 与生产终态

| Run                        | 入口                                                                                                                             | 结论                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **44587934364**（recover） | recover-application-images.yml（控制件 **c7f0a84**；四输入 05796e5 / api 638ef41a… / web 6bd64bb5… / images_run_id 44580687852） | ✅ 全绿（validate/verify/deploy）——precheck 严格路径 → backup 恢复点三件套 → switch 新镜像 → 内外探针 → DEPLOYED → 证据推进 |

生产终态实测（2026-11-19T18:42Z 公网 HTTPS）：`/health` 200 ok、`/ready` 200 ready、`/version`==`05796e502e5cc7d65a159625a893676aa52613e2`（builtAt application-44587934364-1）、TLS 校验通过（ssl_verify=0）。部署证据 artifact：`deployment.json`=PASS、`migration_registry`=FULLY_MATCHED、`migration_execution`=NOT_INVOKED、`recovery_images`=RETAINED；`postcheck.json` release_sha=05796e5、api/web 运行 digest 与批准值逐字一致。本次 precheck 输出**无 `version_probe: skipped` 字段**——即修复后零迁移发布走严格路径，marker 版本探针实际执行（与首败 run 的 window mode 输出形成对照）。

## 2. Run 全清单（四 run）

| Run             | Workflow                   | 候选/控制件               | 结论                                                                                                                                                                                                         |
| --------------- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 44577734835     | release-images             | 1e0b203                   | ❌ Web 镜像构建失败（见 §3 首败）                                                                                                                                                                            |
| **44580687852** | release-images             | 05796e5                   | ✅ success——api=`sha256:638ef41a6b9976ac735869e8ee99860ea0ac5b13cc10505c04a55dc6ae8f19d2` / web=`sha256:6bd64bb5e11b137eb3a5a9a97a9cf0237d275187b17753681777fe2061ec4779`（Emit immutable digests 步骤落盘） |
| 44580949290     | recover-application-images | 05796e5（控制件=05796e5） | ❌ validate/verify 绿、deploy 32 秒失败（见 §3 二败）——**零停机**                                                                                                                                            |
| **44587934364** | recover-application-images | 05796e5（控制件=c7f0a84） | ✅ 全绿 → 生产 05796e5                                                                                                                                                                                       |

发布范围 f742143..05796e5 共 40 提交：UI 基座（packages/ui 原语与 tokens）+ governance 九子页 Preact 控制台化 + A-F1 审计快赢 + 部署控制加固 + Wave2 收官与四次人裁 docs 批。

## 3. 两轮失败与修复全史

- **首败（候选 1e0b203，run 44577734835）**：`pnpm --filter @kingturf/web build` 在容器内 Rollup 无法解析 `@kingturf/ui`（`apps/web/src/ui-kit/render.tsx`）。根因：`infra/docker/Dockerfile.web-preview` 构建上下文未包含 packages/ui（install 前清单与 build 前源码均缺）；本地 ci:local 全 workspace 在场故绿，仅 Docker 隔离上下文暴露。修复=**05796e5** 补两行 COPY（主协调直接实施）：install 前 `COPY packages/ui/package.json`、build 前 `COPY packages/ui`；docker build 实测 + 完整 ci:local 后重发。
- **二败（候选 05796e5，run 44580949290）**：deploy 步骤 17:59:49Z 起、18:00:21Z 止。`handover_state()`（FULLY_MATCHED ∧ marker≠candidate）无法区分两种同形状态——「迁移交接（API 被刻意停）」与「零迁移应用级发布（API 正常运行）」；后者被误判为交接态后，`application_release.py` precheck 卡死在「Handover state expects the api container to be stopped」。失败点在 shell 脚本 precheck 行，import/backup/switch 未执行、无 checkpoint 写入 → **零停机**（生产全程 f742143 健康，公网探针持续 200）。
  - 修复=**裁定9（主协调）→ c7f0a84**：两处 `handover_state` 补第三合取项「API 容器实际 stopped（非 restarting）」（`scripts/application_release.py:65`、`scripts/production_preflight.py:91`——后者覆盖 shell 直调 `--candidate-sha` 守卫路径）；API 运行时走正常严格路径（容器健康断言 + marker 版本探针照常）。红→绿：先改测试实测红（含 window mode 误判形状复现）→ 127 python 测试全绿（新增 5 例：两处 handover_state 单元三态断言、precheck 接线断言、preflight candidate_sha 三态=运行→严格+探针/停→放宽/restarting→两路都败）；pyflakes 未装以 ast.parse 自查四文件通过；完整 ci:local exit 0。
- **失败现场保全**：主机 `.release-image-recovery/44580949290-1/`（含 precheck.jsonl 与控制件）按裁定9附注留待后续 cleanup 白名单扩展，本批不动。

## 4. SHA 链与四输入

- 候选：`05796e502e5cc7d65a159625a893676aa52613e2`（release-images run 44580687852 出双 digest）
- 控制件：`c7f0a849e96d9d29d4137f2ad205fc87b8353cbc`（fix(release): require stopped api for handover relaxation [已测试]，ci:local exit 0 后 push）
- 四输入：commit_sha=05796e5…、api_digest=sha256:638ef41a…8f19d2、web_digest=sha256:6bd64bb5…ec4779、images_run_id=44580687852
- 生产 marker 链：f742143（Wave2）→ **05796e5**（本次）；主机 `image_compatibility.json` 随 switch DEPLOYED 推进至 05796e5

## 5. 停机窗口与恢复点

- 二败 run：**零停机**（失败在 backup 停机之前，API 容器全程未动）。
- 成功 run：deploy job 18:39:25Z→18:41:20Z（115 秒）。precheck PASS 于 18:39:44Z（尚未停机）；受控停机段=backup 内 `compose stop -t 30 api` → switch `up` 新容器健康 → 内外探针，约 1 分钟级；18:41:20Z postcheck 完成即恢复服务。恢复点=`application-44587934364` 前缀的 dump/attachments/config 三件套（RETAINED，按现行契约保全不自动清理）。
- production 审批：dispatch（18:27:08Z queued）至 deploy 开始（18:39:25Z）全程 12 分钟，与 verify 10-15 分钟正常区间一致，未见 >10 分钟额外 environment 审批等待。

## 6. 附注（裁定9）

- D1 单管道 release.yml 将取代本「release-images + recover 手工缝合」接缝设计（TD-REL-008 / UI 计划 §9 D1 承接；D-CP1 后方可首次 dispatch）。
- 失败 run 主机 bundle `44580949290-1` 留待 cleanup 白名单扩展，本批不动。
- 九页验收直链（hash 路由，`https://erp.kingturf.cn/#/governance/` 后接子路径）：identity（身份与授权）、organization（组织与员工）、audit（审计中心）、master-data（主数据）、numbering（编号规则）、rules（业务规则）、workflow（工作流与待办）、notifications（通知中心）、system（业务对象与事件）。
