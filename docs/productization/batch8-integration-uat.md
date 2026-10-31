# Batch8 累计集成与岗位验收前置

基线：Batch7 最终 SHA `42edc878aa8a754713f2b857db4e835e3ebe6999`。本文件只记录兼容性核对和验收前置，不批准 A1—A5 业务规则，也不修改业务代码。

## 累计集成核对

- Batch1—7 提交链连续，Batch7 以 Batch6 `040a520` 为父提交；当前累计历史相对远程 `main` `b1ef7a9e7fdbfc0341f29f1cb612504ff47cd41b` 领先 67 个提交、落后 0 个提交。
- `git diff --name-status b1ef7a9e..42edc878` 显示数据库迁移只有新增 `0071_inventory_stock_resource_guards.sql`；历史 `0001`—`0070` 未修改。Batch7 本身没有代码或迁移变更。
- 空库迁移由 Batch7 固定 SHA 的完整 CI 执行；`db:status` 报告所有迁移 checksum applied/matched。0071 的 0070 升级、负库存拒绝和 DDL 回滚由 `apps/api/test/inventory-migration-postgres.integration.test.ts` 覆盖。
- 迁移测试明确保留旧库存流水和 canonical hash；既有负库存会拒绝迁移，guard/索引/迁移注册在失败时回滚。生产数据仍需发布前只读盘点，不能由空库或合成数据代替。
- Batch6 的成本归集和 Connector CAS 没有新增 API 路由或数据库迁移；其真实 PG 测试、HTTP 安全测试和完整 CI 证据绑定于 Batch6 及 Batch7 最终候选历史。

## API、权限与历史对象

- 现有测试覆盖不透明会话、服务器端 DataScope、跨公司/跨组织拒绝、风险评价和任务重放、佣金事件、业务文档历史回执、库存并发和采购部分收货。
- API 合同和错误语义仍需远程候选执行合同快照；本地完整 CI 不等于旧客户端和生产配置兼容。
- 成本 run、审批事件、库存流水、BOM/工单历史和业务文档历史继续按不可变原则处理；A1—A5 未批准前不得创建正式修订、扣库、利润快照或版本冻结语义。

## 十岗位合成验收前置

| 岗位 | 已有自动化前置                      | 本轮可执行范围                                          | 当前状态                               |
| ---- | ----------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| 销售 | CRM、报价、合同、订单 route/PG 回归 | 以 `SALES_REP` 做公司范围读写、重复提交和越权拒绝       | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 技术 | 制造版本、BOM、MRP route/PG 回归    | 只验证版本读取、来源和跨组织拒绝；正式冻结依赖 A4       | `BLOCKED_BY_BUSINESS_DECISION`         |
| 采购 | PO、4+2+4 收货、批次和库存回归      | 合成 `BUYER` 做部分收货、重复/超量和跨公司拒绝          | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 计划 | MRP 销售订单来源和产出基数回归      | 合成 `PLANNER` 验证已释放订单来源和非法来源拒绝         | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 生产 | 7+7 库存并发、领退料、报工回归      | 合成 `PRODUCTION_OPERATOR` 验证库存非负、批次和重复领料 | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 质量 | 检验、隔离、放行和追溯回归          | 合成 `QUALITY_INSPECTOR` 验证未放行/跨组织拒绝          | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 仓库 | 现有出库/发运门禁读取回归           | 不执行正式扣库或分批发运规则，等待 A3                   | `BLOCKED_BY_BUSINESS_DECISION`         |
| 财务 | 应收、收款、核销和成本查询回归      | 只验证权限、金额读取和跨公司拒绝，不宣称实际利润        | `BLOCKED_BY_BUSINESS_DECISION`         |
| 管理 | 驾驶舱、风险和订单视图回归          | 合成 `MANAGER` 验证只读范围和敏感字段拒绝               | `AUTOMATION_INHERITED / HUMAN_PENDING` |
| 运维 | 启动、迁移、审计和安全门禁回归      | 合成 `OPS_READONLY` 做健康、版本、日志和恢复清单核对    | `BASELINE_ONLY / HUMAN_PENDING`        |

管理员 P1 浏览器回归不是十岗位验收。每个岗位仍需固定候选 SHA、隔离组织、成功/拒绝/越权/重复或撤回、独立数量/金额对账和人工签署。

## 证据边界与下一步

- `TEN_ROLE_SYNTHETIC_UAT` 当前为既有自动化前置，尚未完成一轮统一十岗位 HTTP/浏览器执行；不能标记十岗位合成全通过。
- `TEN_ROLE_HUMAN_UAT=NOT_COMPLETED`。没有真实员工、业务负责人和独立复核人签署，不得进入试运行。
- 正式性能、RPO/RTO、生产数据兼容和监控责任仍待负责人确认；本文件不虚构目标。
- 申请远程 CI 前必须在受控分支绑定精确 SHA，复跑完整 CI、PG/HTTP 权限矩阵、受影响浏览器和迁移升级；任何 checksum、权限、恢复或岗位证据失败即停止。

当前结论：`INTEGRATION_COMPATIBILITY=STATIC_AND_LOCAL_EVIDENCE`，`TEN_ROLE_SYNTHETIC_UAT=PARTIAL_AUTOMATION_INHERITED`，`TEN_ROLE_HUMAN_UAT=NOT_COMPLETED`，`PILOT_READINESS=NO_GO`。
