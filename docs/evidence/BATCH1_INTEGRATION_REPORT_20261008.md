# BATCH1_INTEGRATION_REPORT

日期：2026-10-08，Asia/Singapore。结论：独立 PR 已创建，Hosted CI 已实际执行但未通过；没有合并或生产部署。

## A. Initial State

仓库 `/home/jinhuit/Kingturf/kingturf-bessiness-os`，remote `git@github.com:ivanzhao299/kingturf-bessiness-os.git`。起始分支 `codex/batch1-release-guardrails`，工作树干净，代码 checkpoint `61617c9608af59035117b050e24fd19f2aad8325` 与文档 checkpoint `2d5a00838496cbb6200d4189fcffe41b3123d77d` 均存在。远程 main 经 fetch 和最终 ls-remote 核对仍为 `9d89c7d6739454345b1397fe6b02c945fbe1cb99`。没有重做 Discovery 或覆盖已有修改。

与 main 的差异限于发布 workflow、校验脚本/测试、根 lint/test 接入和接管文档；没有业务源码、数据库 migration 或生产环境配置变化。原有 Batch 1 本地 362/364 与专项 38/38 是历史记录。本轮推送前实际重跑 `pnpm test:release-guardrails`，38/38 PASS。

## B. PR Safety Precheck

独立只读代理与主代理核对所有已注册 Actions workflow 和仓库脚本：当前为 CI 与 Deploy KingTurf Production 两条 workflow。CI 接受 pull_request、main push 和手动执行，只验证本地/临时服务；生产发布只接受 workflow_dispatch。feature branch push、普通 PR 与 production environment 配置均没有自动生产部署路径，因此本次推送安全。

Batch 1 候选的 validate/verify/deploy 使用一致的完整 lowercase 40 位 SHA；固定控制 commit、可信 origin/main ancestry 和锁内复核发生在获取生产 SSH 材料之前。现有正式策略接受 main 历史 commit，正常发布和历史回滚均覆盖；branch/tag 名称并非正式输入，拒绝这些输入不会禁止历史 SHA 回滚。备份命令失败必然中止配置同步/后续部署，版本标记只在健康探测与精确版本比对成功后原子更新。相关真实 shell 模拟、Git fixtures 和输入反向用例均在 38 项测试内。

生产 deploy job 使用共享 `kingturf-erp-production` concurrency group、cancel-in-progress=false；一般 CI 保留并行。未发现另一条当前自动 workflow 绕过这组校验。历史 workflow 重跑、尚未合并的 main 手动发布和人工 SSH 不受未来控制追溯保护；本轮禁止触发这些路径。所有仓库 workflow 明确 contents:read。部署失败后的实际容器/schema/config 恢复尚未生产演练，不能由 YAML/模拟通过推断可安全上线。

## C. PR and Hosted CI

- PR：[Release guardrails #31](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/31)，base main，head codex/batch1-release-guardrails。
- 推送/PR HEAD：`2d5a00838496cbb6200d4189fcffe41b3123d77d`。创建后已关联当前 Codex 任务。
- Hosted run：[CI 37770650651](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37770650651)，event=pull_request。
- quality job：113289117511，2026-10-08 11:31:52Z 至 11:33:32Z，conclusion=FAILURE。
- 最终 PR 查询：OPEN，mergeStateStatus=UNSTABLE，quality=FAILURE，远程 head 未变化。

| 实际执行项目                                      | 结果    | 证据/边界                                                          |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| frozen dependency install                         | PASS    | Hosted 日志                                                        |
| format / frontend manifest / test DB target guard | PASS    | Hosted 日志                                                        |
| PostgreSQL migrations/status                      | PASS    | 70 项 applied，临时 CI 数据库                                      |
| lint / typecheck                                  | PASS    | 8 个 workspace                                                     |
| release guardrails                                | PASS    | 38/38                                                              |
| shared package tests                              | PASS    | 82/82：config4/database61/domain14/testing1/types1/ui1             |
| Web tests                                         | FAIL    | 104/105，原有日期/DOM fixture 缺陷                                 |
| API tests                                         | NOT_RUN | Web 首次失败后 recursive test 停止；不能声称 Hosted 重现 CAPA 失败 |
| build / dependency audit                          | NOT_RUN | ci:local fail-fast，未到达后续步骤                                 |
| browser E2E / production deployment               | NOT_RUN | 本 CI 不包含；没有手动触发发布                                     |

Hosted 本次实际执行测试合计 225：224 PASS、1 FAIL。失败为 `apps/web/src/bootstrap.test.ts:1628` 的商机看板测试：固定 expectedCloseDate 已经过期，进入 `bootstrap.ts:3020` 的 classList.add 分支，而测试 RenderedElement 没有 classList。与 Batch 1 已记录的本地失败一致，业务/测试代码没有被本批修改。另一项 CAPA 历史失败在本地 API 验证记录中，Hosted 未执行它。

日志与脱敏元数据保存在忽略目录 `.local-acceptance/batch1-integration/hosted-ci.log`、`hosted-ci.json`、`pr-final.json`；上述公开 run 是可重复访问的证据，没有复制凭据或完整认证材料。

## D. GitHub Protection and Remaining Blockers

重新读取 production environment：protection_rules=[]，deployment_branch_policy=null。独立审查未找到自动部署规则。main/ruleset 缺失及默认 workflow 权限 GET403 的事实基线见 [保护审计](GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)。未修改任何 GitHub 保护规则或环境。

建议管理员要求 main PR/独立审阅/quality、禁止 force push 和删除；production 仅允许 main 并要求独立审批，限制旧 run 重跑及人工发布。应先修复测试门禁，不降低断言或将 deploy 手动 job 误设为 PR required check。

仍阻塞发布：两个历史测试、认证及聚合权限缺口、保护配置、迁移控制与备份恢复/真实岗位验收。Batch 2 认证修改独立基于 main，绝不加入此 PR。

## E. Integration Result and Follow-up

PR 已进入评审，但 Hosted CI 失败，未完成通过集成。先推进独立认证安全修复，再修复来源/嵌套权限；另设测试确定性批次恢复 quality 后才能申请合并。当前报告作为持续治理文档记录在独立 Batch 2 文档 checkpoint；没有为记录 CI 结果再次改变 Batch 1 PR head，避免混入 Batch 2 代码或制造另一次未跟踪 run。

```text
BATCH1_PR_STATUS=OPEN_PR_31
BATCH1_HEAD=2d5a00838496cbb6200d4189fcffe41b3123d77d
BATCH1_HOSTED_CI=FAIL_HISTORICAL_WEB_TEST
BATCH1_HOSTED_RUN=37770650651
BATCH1_MERGE_STATUS=NOT_MERGED
PRODUCTION_DEPLOYMENT=NO
READY_FOR_PRODUCTION_RELEASE=NO
```

## Subsequent CI gate recovery (2026-10-08)

Original2d5a008/run37770650651 failure above remains historical evidence. Independent test-only checkpoint58fe039 was normally cherry-picked; PR31 final HEAD `f7489e77cd059d37e049c70685e4025de0187cb5`, [run37790721061](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37790721061) quality SUCCESS, release38/38 and workspace331/331 (combined369). Complete build/audit executed. PR remains OPEN/unmerged; production not deployed. See Batch2.5/Batch3 reports for current integration and safety gates.
