# Wave1 生产部署记录（A2+M1a+B1+B2+B4 → 01ef0e1）— 2026-11-18

> 执行会话产出；主协调全权授权下验收。本文件为 CP3c 收尾归档：部署成功的完整证据、
> 失败尾步的根因与无锁死论证、处置决定。验证与发布材料见
> [wave1 验证证据](wave1-verification-2026-11-18.md)。

## 1. 发布 run 与各步状态

- Run：https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/44318126044
  （recover-application-images.yml；控制脚本 = `RELEASE_CONTROL_SHA 0bfa3127…` 即 M4b 补丁版）
- 输入四元组：commit_sha `01ef0e1fd34c724b21cfd470a41161687020ec5c`、
  api_digest `sha256:0745dbbd…6492`、web_digest `sha256:cba4f5fb…b472`、images_run_id `44280357780`
  （镜像与 bundle 与前两次失败 run 完全一致，仅控制脚本更新）。
- 步骤：**validate success → verify success（候选 SHA 完整 ci:local）→ deploy：发布链全部完成，
  仅证据推进尾步失败**（见 §3），deploy job 结论为 failure——验收结论与 run 状态标签的区分如实归档：
  部署目标（应用切换+探针+恢复点+marker）全部达成。

时间线（deploy step 日志）：preflight PASS/FULLY_MATCHED @14:04:09 → backup（停 API、联合备份、
隔离还原演练）→ switch（应用切换、内网/公网探针、marker 晋级、checkpoint `DEPLOYED`）→
尾步 `advance_image_evidence` 抛错 @14:05:16 → main 以通用文案终止（`from None` 吞第一异常）。
`application-state.json` 终态 `DEPLOYED`（不在自动恢复清单，正确地未触发回滚）。

## 2. 生产验收实测（公网 HTTPS）

- `GET /health` → 200 `{"status":"ok"}`
- `GET /ready` → 200 `{"status":"ready"}`
- `GET /version` → 200 `{"sha":"01ef0e1fd34c724b21cfd470a41161687020ec5c","environment":"production","builtAt":"application-44318126044-1"}`
  —— **等于发布 SHA**；`.release-sha` marker 已原子晋级。
- 恢复点：backup 阶段（shell 严格串行 precheck→import→backup→switch）创建
  `.release-backups/application-44318126044-1.*`（dump+attachments+config，0600）并在隔离
  无网络 tmpfs PostgreSQL 完成还原核验（`isolated_restore=PASS` 路径必然经过）；主机 bundle
  `.release-image-recovery/44318126044-1/` 留存 before.json/backup-report.json/transport.json 等。
- Wave1 行为变更（A2 权限目录收敛、M1a 保留角色编码、B1 治理子路由、B2 分页契约、B4 守卫）
  随镜像上线生效；生产 schema 保持 72（本波零迁移）。

## 3. 失败尾步根因（M4b 补丁缺陷，已定位）

`application_release.py advance_image_evidence` 读取 `bundle/'recovery-bundle.tar.gz'`（runner
侧名字），而主机 bundle 布局中该文件经 `scripts/recover_application_images.sh:19` rsync 改名为
**`bundle.tar.gz`** → `'Recovery bundle archive missing for evidence advancement'` → 发布完成后报错。
单元测试夹具与实现同源使用 runner 侧名字，未覆盖主机布局——测试设计与实现同源出错。

**后果**：主机 `.release-migration-evidence/image_compatibility.json` 未推进，仍为 45605d37 时代内容。

**无锁死论证**：

- 01ef0e1 同候选重跑：走 M4b 新候选分支（FULLY_MATCHED + 授权 smoke PASS 放行）——通；
- 更新候选（如 Wave2）：同上新候选分支——通；
- 回滚 45605d37：其 `images_built_at` 与候选不符亦走新候选分支；若主机证据被（未来）推进到
  某候选后重跑该候选则走字节严格分支——两分支均可达，无死锁。
- 不为对齐 run 状态标签而重放生产发布（无用户/数据价值，且会产生新恢复点与停服窗口）。

**处置**：一行修复（读 `bundle.tar.gz`，兼容两名）+ 主机布局夹具红→绿，并入 Wave2 准备批
（与 `len(expected)==72→74` 同批生效，届时主机证据直接推进到 Wave2 SHA）；登记 TD-REL-004。

## 4. Wave1 验收结论

| 项                                                        | 结果                         |
| --------------------------------------------------------- | ---------------------------- |
| 应用切换（API/Web `--pull never`，仅现存镜像）            | ✅                           |
| `/health` `/ready` `/version`==发布 SHA + 公网 HTTPS 探针 | ✅                           |
| pg_dump 恢复点 + 隔离还原演练                             | ✅                           |
| marker 晋级（DEPLOYED）                                   | ✅                           |
| 迁移零调用、schema 72 不变（FULLY_MATCHED）               | ✅                           |
| 证据推进尾步                                              | ❌ TD-REL-004，随 Wave2 修复 |

验收：**通过**（2026-11-18，主协调复核）。
