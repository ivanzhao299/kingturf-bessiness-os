# Batch8 非生产集成交付

本批从 Batch7 `42edc878aa8a754713f2b857db4e835e3ebe6999` 开始，未修改正式业务代码、数据库迁移或 A1—A5 规则。

## 本批交付

- [累计兼容性与岗位前置](batch8-integration-uat.md)
- [累计安全回归](batch8-security-review.md)
- [性能与恢复基线](batch8-perf-restore.md)

## 实际结果

- Batch7 bundle SHA256 校验通过；此前独立恢复验证仍有效。
- 安全专项 59/59 通过，覆盖风险重放、佣金事件、文档历史回执、跨组织和撤权行为。
- 数据库恢复演练达到 `PARTIAL_DATABASE_ONLY`：71 个迁移和 0071 checksum 恢复一致；附件、配置和完整业务数据未演练。
- pgbench 仅形成数据库容量基线：904.57 TPS、平均 4.422 ms、0 失败；不代表正式 SLA。
- 十岗位仍为既有自动化前置，未完成统一岗位 HTTP/浏览器执行；真实员工验收未发生。

## 远程候选边界

远程 main 仍为 `b1ef7a9e7fdbfc0341f29f1cb612504ff47cd41b`，开放 PR 为 0，最近远程 CI/部署针对 main 成功，分支保护因 API 401 未核实。建议远程验证分支使用 `codex/kt-v1-batch8`，精确候选 SHA 以本批最终提交为准；推送、PR、合并和部署均未授权。

五项业务规则继续 `AWAITING_APPROVAL`，正式成本、出库、BOM 冻结和利润代码不得实施。`PILOT_READINESS=NO_GO`。
