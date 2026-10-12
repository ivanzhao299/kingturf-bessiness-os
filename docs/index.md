# docs/index.md（全部文档索引）

> **作用**：docs/ 下每个 Markdown 文件都在本索引中，且每个链接可解析（校验：`node scripts/analysis/doc-lint.mjs`）。
> **状态标注**：`常驻`＝长期保留；`归并待定 D4`＝阶段 2b 文档归并（人工决策 D4）前原位保留，勿删勿改。
> **新鲜度**：本索引校验日期 2026-10-12（基线 `779dea3`）。新增文档必须同步登记到本索引，否则 doc-lint 失败。

## 常驻入口（根与 docs 顶层）

| 文档                                                                             | 职责                                                           | 状态           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------- |
| [AGENTS.md](../AGENTS.md)                                                        | 智能体入口地图（≤100 行）                                      | 常驻           |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                            | 领域与包分层、依赖方向规则与验证点                             | 常驻           |
| [README.md](../README.md)                                                        | 项目简介与本地起步                                             | 常驻           |
| [CI.md](CI.md)                                                                   | 框架判定（非 Tauri）与 CI 决策记录                             | 常驻           |
| [RELIABILITY.md](RELIABILITY.md)                                                 | 可靠性机制与发布链路 runbook（逐步对应 deploy-production.yml） | 常驻           |
| [QUALITY_SCORE.md](QUALITY_SCORE.md)                                             | 按域质量评分（可复算依据）                                     | 常驻           |
| [design-docs/core-beliefs.md](design-docs/core-beliefs.md)                       | 核心信念（争议裁决依据）                                       | 常驻           |
| [exec-plans/active/harness-migration.md](exec-plans/active/harness-migration.md) | 进行中：harness 改造计划（含 §0.5 执行契约与进度日志）         | 常驻           |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)               | 技术债台账（30 条）                                            | 常驻           |
| [HARNESS-RULES.md](HARNESS-RULES.md)                                             | 施工规则（竣工验收后按其 §14 归档）                            | 常驻（施工期） |
| [WORKSPACE_ROUTE_ISOLATION.md](WORKSPACE_ROUTE_ISOLATION.md)                     | 工作区路由隔离说明（2026-09-06）                               | 归并待定 D4    |

## docs/adr（架构决策记录，10 篇）

> 决策记录性质偏向常驻；是否按主题合并进 ARCHITECTURE.md 由 D4 裁决。

| 文档                                                                                                | 状态        |
| --------------------------------------------------------------------------------------------------- | ----------- |
| [0001-typescript-monorepo-stack](adr/0001-typescript-monorepo-stack.md)                             | 归并待定 D4 |
| [0002-postgresql-access-and-migrations](adr/0002-postgresql-access-and-migrations.md)               | 归并待定 D4 |
| [0003-opaque-session-authentication](adr/0003-opaque-session-authentication.md)                     | 归并待定 D4 |
| [0004-rbac-and-data-scope](adr/0004-rbac-and-data-scope.md)                                         | 归并待定 D4 |
| [0005-versioned-platform-engines](adr/0005-versioned-platform-engines.md)                           | 归并待定 D4 |
| [0006-transactional-outbox-and-local-adapters](adr/0006-transactional-outbox-and-local-adapters.md) | 归并待定 D4 |
| [0007-immutable-business-object-schemas](adr/0007-immutable-business-object-schemas.md)             | 归并待定 D4 |
| [0008-p1-crm-compatibility-and-patterns](adr/0008-p1-crm-compatibility-and-patterns.md)             | 归并待定 D4 |
| [0009-commercial-revision-graph](adr/0009-commercial-revision-graph.md)                             | 归并待定 D4 |
| [0010-immutable-quote-to-cash-ledger](adr/0010-immutable-quote-to-cash-ledger.md)                   | 归并待定 D4 |

## docs/agent-memory（智能体记忆库，13 篇）

> 历史会话记忆与交接状态；保留/归档由 D4 裁决。

| 文档                                                                                             | 状态        |
| ------------------------------------------------------------------------------------------------ | ----------- |
| [2026-08-17-studio-long-task-heartbeat](agent-memory/2026-08-17-studio-long-task-heartbeat.md)   | 归并待定 D4 |
| [2026-08-18-l02-ctr-solution-foundation](agent-memory/2026-08-18-l02-ctr-solution-foundation.md) | 归并待定 D4 |
| [CANONICAL_EXECUTION_BASELINE](agent-memory/CANONICAL_EXECUTION_BASELINE.md)                     | 归并待定 D4 |
| [README](agent-memory/README.md)                                                                 | 归并待定 D4 |
| [decisions](agent-memory/decisions.md)                                                           | 归并待定 D4 |
| [evidence](agent-memory/evidence.md)                                                             | 归并待定 D4 |
| [execution-boundary](agent-memory/execution-boundary.md)                                         | 归并待定 D4 |
| [handoff](agent-memory/handoff.md)                                                               | 归并待定 D4 |
| [project-issue-matrix](agent-memory/project-issue-matrix.md)                                     | 归并待定 D4 |
| [project-state](agent-memory/project-state.md)                                                   | 归并待定 D4 |
| [sessions](agent-memory/sessions.md)                                                             | 归并待定 D4 |
| [takeover-status](agent-memory/takeover-status.md)                                               | 归并待定 D4 |
| [task-sequence](agent-memory/task-sequence.md)                                                   | 归并待定 D4 |

## docs/deployment（部署运维，2 篇）

> 生产主机 runbook 与飞书同步说明；与 RELIABILITY.md 的归并关系由 D4 裁决。

| 文档                                                               | 状态        |
| ------------------------------------------------------------------ | ----------- |
| [FEISHU_CODEX_THREAD_SYNC](deployment/FEISHU_CODEX_THREAD_SYNC.md) | 归并待定 D4 |
| [PRODUCTION_PARK_HOST](deployment/PRODUCTION_PARK_HOST.md)         | 归并待定 D4 |

## docs/engineering（工程规格，22 篇）

> 产品蓝图、开发计划、各业务域规格与前端产品化系列；归并方向（按域并入 product-specs/ 或归档）由 D4 裁决。

| 文档                                                                                                                  | 状态        |
| --------------------------------------------------------------------------------------------------------------------- | ----------- |
| [ATOMIC_ROLE_AND_UAT_MATRIX](engineering/ATOMIC_ROLE_AND_UAT_MATRIX.md)                                               | 归并待定 D4 |
| [BUSINESS_DOCUMENT_COMMUNICATIONS](engineering/BUSINESS_DOCUMENT_COMMUNICATIONS.md)                                   | 归并待定 D4 |
| [COST_QUOTE_ORDER_CLOSED_LOOP](engineering/COST_QUOTE_ORDER_CLOSED_LOOP.md)                                           | 归并待定 D4 |
| [FOUNDATION_OPERATIONS](engineering/FOUNDATION_OPERATIONS.md)                                                         | 归并待定 D4 |
| [FRONTEND_CAPABILITY_PERMISSION_MATRIX](engineering/FRONTEND_CAPABILITY_PERMISSION_MATRIX.md)                         | 归并待定 D4 |
| [IDENTITY_AUTHORIZATION](engineering/IDENTITY_AUTHORIZATION.md)                                                       | 归并待定 D4 |
| [KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT](engineering/KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT.md)                     | 归并待定 D4 |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC](engineering/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC.md)                       | 归并待定 D4 |
| [KT-L20_COMPLAINT_NCR_CAPA_SPEC](engineering/KT-L20_COMPLAINT_NCR_CAPA_SPEC.md)                                       | 归并待定 D4 |
| [KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN](engineering/KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN.md) | 归并待定 D4 |
| [KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT](engineering/KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT.md)                     | 归并待定 D4 |
| [KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT](engineering/KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT.md)                         | 归并待定 D4 |
| [KT-UI-PROD-06_PROCESS_NAVIGATION](engineering/KT-UI-PROD-06_PROCESS_NAVIGATION.md)                                   | 归并待定 D4 |
| [KT-UI-PROD-07_COST_WORKBENCH](engineering/KT-UI-PROD-07_COST_WORKBENCH.md)                                           | 归并待定 D4 |
| [KT-UI-PROD-08_PRODUCT_AUDIT](engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md)                                             | 归并待定 D4 |
| [KT-UI-PROD-09_STARTUP_DELIVERY](engineering/KT-UI-PROD-09_STARTUP_DELIVERY.md)                                       | 归并待定 D4 |
| [KT-UI-PROD-10_LOGO_DOCUMENT_SEND](engineering/KT-UI-PROD-10_LOGO_DOCUMENT_SEND.md)                                   | 归并待定 D4 |
| [KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE](engineering/KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE.md)                       | 归并待定 D4 |
| [MASTER_DEVELOPMENT_PLAN](engineering/MASTER_DEVELOPMENT_PLAN.md)                                                     | 归并待定 D4 |
| [OPERATING_MODEL_AND_ROLE_CATALOG](engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md)                                   | 归并待定 D4 |
| [PRODUCT_BLUEPRINT](engineering/PRODUCT_BLUEPRINT.md)                                                                 | 归并待定 D4 |
| [REGRESSION_PREVENTION](engineering/REGRESSION_PREVENTION.md)                                                         | 归并待定 D4 |

## docs/evidence（验收证据，23 篇）

> 历史验收快照，只读性质；阶段 2b 大概率整体移入归档（由 D4 确认）。

| 文档                                                                                                                       | 状态        |
| -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [BATCH1_INTEGRATION_REPORT_20261008](evidence/BATCH1_INTEGRATION_REPORT_20261008.md)                                       | 归并待定 D4 |
| [BATCH1_RELEASE_SAFETY_REPORT_20261008](evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md)                                 | 归并待定 D4 |
| [BATCH25_CI_GATE_RECOVERY_REPORT_20261008](evidence/BATCH25_CI_GATE_RECOVERY_REPORT_20261008.md)                           | 归并待定 D4 |
| [BATCH2_AUTH_SECURITY_REPORT_20261008](evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md)                                   | 归并待定 D4 |
| [BATCH2_PR_INTEGRATION_REPORT_20261008](evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md)                                 | 归并待定 D4 |
| [BATCH3_AUTHORIZATION_REPORT_20261008](evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md)                                   | 归并待定 D4 |
| [GITHUB_PROTECTION_AUDIT_20261008_BATCH1](evidence/GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)                             | 归并待定 D4 |
| [KT-L07_ACCEPTANCE](evidence/KT-L07_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L08_ACCEPTANCE](evidence/KT-L08_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L09_ACCEPTANCE](evidence/KT-L09_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L10_ACCEPTANCE](evidence/KT-L10_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L11_ACCEPTANCE](evidence/KT-L11_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L12_ACCEPTANCE](evidence/KT-L12_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L13_ACCEPTANCE](evidence/KT-L13_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L14_ACCEPTANCE](evidence/KT-L14_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L15_ACCEPTANCE](evidence/KT-L15_ACCEPTANCE.md)                                                                         | 归并待定 D4 |
| [KT-L17_ACTUAL_MANUFACTURING_COST_20260822](evidence/KT-L17_ACTUAL_MANUFACTURING_COST_20260822.md)                         | 归并待定 D4 |
| [KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824](evidence/KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824.md)               | 归并待定 D4 |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825](evidence/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825.md) | 归并待定 D4 |
| [KT-RG01_PRODUCTION_REACCEPTANCE_20260822](evidence/KT-RG01_PRODUCTION_REACCEPTANCE_20260822.md)                           | 归并待定 D4 |
| [KT_RBAC_ATOMIC_ROLE_UAT_20260822](evidence/KT_RBAC_ATOMIC_ROLE_UAT_20260822.md)                                           | 归并待定 D4 |
| [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010](evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010.md)   | 归并待定 D4 |
| [PROJECT_TAKEOVER_REPORT_20261008](evidence/PROJECT_TAKEOVER_REPORT_20261008.md)                                           | 归并待定 D4 |

## docs/tasks（历史任务档案，23 篇）

> 平台基座（P0）与业务闭环（P1）任务档案；完成后应移入 exec-plans/completed/ 风格归档，由 D4 确认。

| 文档                                                                          | 状态        |
| ----------------------------------------------------------------------------- | ----------- |
| [JTF-P0-E01-REPOSITORY-BOOTSTRAP](tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)   | 归并待定 D4 |
| [JTF-P0-E02-CONFIGURATION](tasks/JTF-P0-E02-CONFIGURATION.md)                 | 归并待定 D4 |
| [JTF-P0-E03-DATABASE-FOUNDATION](tasks/JTF-P0-E03-DATABASE-FOUNDATION.md)     | 归并待定 D4 |
| [JTF-P0-E04-ORGANIZATION-EMPLOYEE](tasks/JTF-P0-E04-ORGANIZATION-EMPLOYEE.md) | 归并待定 D4 |
| [JTF-P0-E05-AUTHENTICATION](tasks/JTF-P0-E05-AUTHENTICATION.md)               | 归并待定 D4 |
| [JTF-P0-E06-AUTHORIZATION](tasks/JTF-P0-E06-AUTHORIZATION.md)                 | 归并待定 D4 |
| [JTF-P0-E07-MASTER-DATA](tasks/JTF-P0-E07-MASTER-DATA.md)                     | 归并待定 D4 |
| [JTF-P0-E08-NUMBERING](tasks/JTF-P0-E08-NUMBERING.md)                         | 归并待定 D4 |
| [JTF-P0-E09-AUDIT](tasks/JTF-P0-E09-AUDIT.md)                                 | 归并待定 D4 |
| [JTF-P0-E10-WORKFLOW](tasks/JTF-P0-E10-WORKFLOW.md)                           | 归并待定 D4 |
| [JTF-P0-E11-RULES](tasks/JTF-P0-E11-RULES.md)                                 | 归并待定 D4 |
| [JTF-P0-E12-NOTIFICATIONS](tasks/JTF-P0-E12-NOTIFICATIONS.md)                 | 归并待定 D4 |
| [JTF-P0-E13-ATTACHMENTS](tasks/JTF-P0-E13-ATTACHMENTS.md)                     | 归并待定 D4 |
| [JTF-P0-E14-EVENTS](tasks/JTF-P0-E14-EVENTS.md)                               | 归并待定 D4 |
| [JTF-P0-E15-BUSINESS-OBJECTS](tasks/JTF-P0-E15-BUSINESS-OBJECTS.md)           | 归并待定 D4 |
| [JTF-P0-E16-OBSERVABILITY](tasks/JTF-P0-E16-OBSERVABILITY.md)                 | 归并待定 D4 |
| [JTF-P0-E17-QUALITY](tasks/JTF-P0-E17-QUALITY.md)                             | 归并待定 D4 |
| [JTF-P1-E01-E04-SALES-TO-CASH](tasks/JTF-P1-E01-E04-SALES-TO-CASH.md)         | 归并待定 D4 |
| [JTF-P1-E05-E10-SALES-TO-CASH](tasks/JTF-P1-E05-E10-SALES-TO-CASH.md)         | 归并待定 D4 |
| [JTF-P1-E11-E17-QUOTE-TO-CASH](tasks/JTF-P1-E11-E17-QUOTE-TO-CASH.md)         | 归并待定 D4 |
| [JTF-P1-E18-E21-CLOSURE](tasks/JTF-P1-E18-E21-CLOSURE.md)                     | 归并待定 D4 |
| [KINGTURF_V2_LONG_TASK_PLAN](tasks/KINGTURF_V2_LONG_TASK_PLAN.md)             | 归并待定 D4 |
| [ROADMAP](tasks/ROADMAP.md)                                                   | 归并待定 D4 |

## exec-plans/completed/

（暂无已归档计划；harness 改造竣工后首个归档件为 HARNESS-RULES 拆解产物。）
