# Wave2 生产部署终录（A1 迁移0073 + D5 迁移0074 → f742143）— 2026-11-19

> 系统管理优化计划 Wave2 收官归档：迁移执行 + 应用发布全链在生产完成。
> Wave1 部署记录见 [wave1-deployment-2026-11-18.md](wave1-deployment-2026-11-18.md)；
> 迁移方案与演练见 [wave2-migration-runbook-2026-11-18.md](../deployment/wave2-migration-runbook-2026-11-18.md)。

## 1. 成功 Run

| Run                         | 入口                                                                                             | 结论                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **44362962206**（apply #7） | apply-migrations.yml（控制件 01d1e62；候选 f742143）                                             | ✅ success——0073/0074 经五门证据机器实测后由 release_orchestrator 单飞执行：execute COMPLETED、postcheck FULLY_MATCHED=**74**、drain `in_flight=0`/`legacy_undelivered_observed=164`（双记录如实披露）、approver=emvia、迁移后 API 按设计保持停止 |
| **44374541682**（recover）  | recover-application-images.yml（控制件 a0dedaa；四输入 f742143/9eee2e25…/1f4bf50d…/44337781449） | ✅ 全绿（validate/verify/deploy）——交接态守卫三分支放行 → backup 停止态取恢复配方/dump → switch 新镜像 → 内网/公网探针 → DEPLOYED → **advance_image_evidence 首次真正推进**                                                                       |

生产终态实测：`/health` 200 ok、`/ready` 200 ready、`/version`==`f742143c3bdf227d231f566d61c96f3df89df6fc`（builtAt application-44374541682-1）；`deployment.json`=PASS、migration_execution=NOT_INVOKED（recover 侧）、recovery_images=RETAINED。**TD-REL-004 关闭证据**：switch 通过 DEPLOYED 后 advance_image_evidence（bundle.tar.gz 双名兼容）无异常返回——主机 `image_compatibility.json` 已推进至 f742143。

## 2. /health 时间线（2026-11-18 UTC）

17:50:36 apply#7 done（API 受控停机，502）→ 18:06 recover① fail（precheck 要求容器健康——交接态缺口一）→ 18:40 recover② fail（同点：sh 独立预检调用未带守卫——缺口二，同根因）→ 19:07:56 **recover③ success（502→200）** → 19:09:08 复核 200。**停机 78 分钟**，其中约 60 分钟为两轮缺口修复的 CI+verify 周期。

## 3. 通往成功的修复链（控制件前向提交，候选 f742143 自始未变）

- apply 轮：83b5911（workflow 化）→ 777dd39（staged 布局 is_file 目录 bug）→ 93e6ea9（names 绑定+CLI 冒烟）→ 05827c6（psql 行列表 join）→ 16c36cf（失败恢复 API 语义）→ f1a608e（version 体比对+exit 1+drain 死信明细）→ 01d1e62（**drain 门禁 7 天在途界修正**——恒 1 假象根因：标量和被 `count(*) FROM (…)` 包装恒 1；in_flight/legacy 双记录）
- recover 轮：cc4c87a（application_release precheck 交接分支）→ **a0dedaa**（production_preflight `--candidate-sha` 三条件守卫 + sh 传参 + version probe 对齐；**17 处调用点类级审计**——活跃执行路径全为有参守卫，退役 deploy-production.yml 不动）

三次裁定经过（一句话浓缩）：裁定4 修正 drain 门禁语义为 7 天在途界并授权 run#7（成功）；裁定5 补齐 apply→recover 交接态预检分支（recover① 失败根因）并预授权连跑；裁定6 追认 sh 调用点续修并要求类级收口（audit 全格）。

## 4. 保全清单与清理命令（供所有者选择性执行；清理前建议核对本文档）

- **staged 目录 ×7**（主机 `/tmp/`）：`wave2-44345815689-1`、`wave2-44349676349-1`、`wave2-44352226506-1`、`wave2-44354803928-1`、`wave2-44357426101-1`、`wave2-44359813902-1`、`wave2-44362962206-1`
  清理：`ssh <host> 'rm -rf /tmp/wave2-44345815689-1 /tmp/wave2-44349676349-1 /tmp/wave2-44352226506-1 /tmp/wave2-44354803928-1 /tmp/wave2-44357426101-1 /tmp/wave2-44359813902-1 /tmp/wave2-44362962206-1'`（即 `rm -rf /tmp/wave2-44*`）
- **恢复点 dump ×7+**（`/data/kingturf-erp/.release-backups/`）：apply 轮前置 `wave2-pre-*`（最新 `4cb7f37a…`）+ 门禁 `wave2-2026*`（`3f207bb8/599696d2/02e9fc20/a506b937…`）+ recover 轮 `application-443*`。**发布链已验证完成——按现行契约这些 dump 保全不自动清理，退役需另批**（PRODUCTION_PARK_HOST「Retirement requires separate authorization」）。
- 主机 `.release-image-recovery/` 各 run bundle（含 44374541682 成功现场）与 `.release-migration-evidence/`（已推进至 f742143）——契约保全，勿动。

## 5. 遗留开放项

- **TD-REL-006**（P2 开放）：164 条种子期 outbox 死信（明细=run 44359813902 artifact），后置经 operations dead-letter API 清理；
- **TD-REL-007**（P2 新登记）：apply_migrations 主机流缺本地真实演练夹具——本轮三个预检级 bug（is_file/names/join）均可被「伪完整主机环境冒烟」拦截，后继补 rehearsal harness；
- 本地残留：`.test-results/playwright-root-oct26`（root 属主）、`~/pw-libs/`、`/tmp` 一次性件（主协调已裁定维持现状）。
