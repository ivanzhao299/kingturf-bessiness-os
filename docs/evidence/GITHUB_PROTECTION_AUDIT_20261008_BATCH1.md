# GITHUB PROTECTION AUDIT

日期：2026-10-08，Asia/Singapore。仓库：`ivanzhao299/kingturf-bessiness-os`。本轮通过 GitHub API 重新查询，仅执行 GET，没有修改任何保护规则、环境、权限或部署。

| 对象                                | 本轮结果                                                         | 分类                                           |
| ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| 默认分支                            | main，远端 SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`        | CONFIRMED                                      |
| main branch                         | API 返回 `protected=false`                                       | 实际缺失                                       |
| main protection endpoint            | 404；结合 protected=false 和 effective rules=[]，未找到传统保护  | 实际缺失，非仅凭 404 判定                      |
| repository rulesets                 | []                                                               | 未由查询到的 ruleset 覆盖                      |
| main effective rules                | []                                                               | 未找到生效规则                                 |
| required checks / reviews           | 未找到对应 branch/ruleset 规则                                   | 实际缺失                                       |
| force-push / deletion protection    | 未找到对应 branch/ruleset 限制；没有尝试 force push 或删除       | 实际缺失的治理控制                             |
| production branch                   | 本轮分支查询没有 production；正式策略使用 main 历史 SHA          | 不适用；无需新增分支                           |
| production environment              | protection_rules=[]、deployment_branch_policy=null               | 没有查询到审批或分支限制                       |
| 仓库默认 workflow token permissions | API 403，提示需要 repository read 或 Actions policies permission | NOT_VERIFIED，权限不足，不能当作已缺失或已安全 |
| 仓库内 workflow 权限声明            | CI 和 production workflow 都显式 `contents: read`                | CONFIRMED 代码配置                             |
| main 最近 check runs                | `quality`、`verify`、`deploy` 历史 success；不是本轮新的 CI      | HISTORICAL；当前本地仍有 2 项测试失败          |

上述空规则不等于任何人都可写入仓库：实际用户角色、组织策略和管理员权限不在本次完整核验范围。工作流代码的 main 自检，也不能抵御有权限的人修改工作流来删除自检。

## 推荐配置与影响

1. **main**：要求 PR 和至少一名独立 reviewer；启用过期审批失效、最后一次推送的独立审批；禁止 force push 和删除；管理员 bypass 仅按已有明确的应急审批流程保留。对 workflow、release 脚本和生产 runbook 变更要求发布责任人审阅。
2. **required checks**：使用当前实际 PR CI 的 `quality` check，包含本批新增 release guard tests。不要把仅手动发布时运行的 `validate`、`verify`、`deploy` 设为 PR 必需检查，否则 PR 可能永久等待。两个历史失败未修复前不能声称 quality 当前满足门禁；保护规则落地应与门禁恢复协调，但不得弱化测试。
3. **production environment**：只允许 main branch，选择具备发布职责的独立审批人，阻止发起人自审，限制绕过保护。没有独立 release/tag 输入策略，不应顺带放开 tag 或 feature branch 部署。
4. **workflow defaults**：由有权限的管理员读取当前值，再确认默认 token 只读并按需配置允许的 Actions。仓库内显式 read 权限继续保留；不因 403 盲目修改或声称通过。
5. **旧工作流/人工路径**：限制旧发布 run 的重跑，审批时核对控制 workflow SHA；手工 SSH 和历史 workflow 未使用新增 group 的运行，不受新互斥追溯保护。所有新生产写 job 必须共享 `kingturf-erp-production` group。

潜在影响：直接 main 推送、未经复核的工作流更改和未经审批的生产 dispatch 将受阻；现有维护者的回滚操作也需要 main 工作流和审批。历史应用 SHA 仍可在 main ancestry 校验通过后申请回滚，但必须核验当前 schema 兼容性、备份和健康状态。

审批需求：仓库所有者/管理员需另行授权并选择 reviewer、bypass 与环境分支策略后执行。**本轮未申请或执行外部配置修改。** 此审计只提供具体可审阅建议。

原始脱敏查询结果保存在忽略目录 `.local-acceptance/batch1/github-protection-audit.json`。相关代码与验证见 [Batch 1 report](BATCH1_RELEASE_SAFETY_REPORT_20261008.md)。
<<<<<<< HEAD

## Latest Batch2.5 / Batch3 read-only re-audit

The table above remains the historical Batch1 snapshot. Latest GET rechecked main at9d89c7d: protected=false; repository rulesets=[]; effective main rules=[]; production protection_rules=[] and deployment_branch_policy=null. No configuration writes. Prior default Actions permission403 remains NOT_VERIFIED. Latest quality checks are independently PASS on PR31 f7489e7/run37790721061, PR32 8cbe6de/run37795523187 and PR33 ab26c6e/run37795089674; the prior gate failures were fixed in separate CI-only changes, not weakened. No merge means main has not acquired these fixes. The proposed required-quality/reviewer/no-force-delete and production independent main-only approval configuration above still requires administrator authorization. Raw latest sanitized metadata is in ignored .local-acceptance/batch3-governance/\*-protection-final.json, rulesets-final.json and effective-rules-final.json; committed summary in [Batch3 verification](BATCH3_VERIFICATION_20261008.json).
=======
>>>>>>> origin/main
