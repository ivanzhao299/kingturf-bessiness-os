# docs/index.md（全部文档索引）

> **作用**：docs/ 下每个 Markdown 文件都在本索引中，且每个链接可解析（校验：`node scripts/analysis/doc-lint.mjs`）。
> **状态标注**（D4 已裁决，2026-10-12，方案 A 轻触式）：`常驻`＝长期保留并随代码更新（全库共 51 项）；`已归档-只读`＝完成记录/历史快照，原位保留、不再更新、勿删（R5，全库共 54 项）；物理归档（git mv 到 archive/）暂不执行，若未来出现检索痛点再升级。
> **新鲜度**：常驻文档最近核验 2026-10-12（基线 `779dea3`）；归档文档标注原始日期。新增文档必须同步登记到本索引，否则 doc-lint 失败。

## 常驻入口（根与 docs 顶层）

| 文档                                                                             | 职责                                                                                                                                                              | 状态                    |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [AGENTS.md](../AGENTS.md)                                                        | 智能体入口地图（≤100 行）                                                                                                                                         | 常驻                    |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                            | 领域与包分层、依赖方向规则与验证点                                                                                                                                | 常驻                    |
| [README.md](../README.md)                                                        | 项目简介与本地起步                                                                                                                                                | 常驻                    |
| [CI.md](CI.md)                                                                   | 框架判定（非 Tauri）与 CI 决策记录                                                                                                                                | 常驻                    |
| [GATES.md](GATES.md)                                                             | 门禁清单（11 项 CI 链 + 2 个本地 hook + 豁免机制）                                                                                                                | 常驻                    |
| [RELIABILITY.md](RELIABILITY.md)                                                 | 可靠性机制与发布链路 runbook（逐步对应 deploy-production.yml）                                                                                                    | 常驻                    |
| [QUALITY_SCORE.md](QUALITY_SCORE.md)                                             | 按域质量评分（可复算依据）                                                                                                                                        | 常驻                    |
| [design-docs/core-beliefs.md](design-docs/core-beliefs.md)                       | 核心信念（争议裁决依据）                                                                                                                                          | 常驻                    |
| [exec-plans/active/harness-migration.md](exec-plans/active/harness-migration.md) | 3c④源码6ade731稳定干净全CI0/182166.585ms；12/21主视图已迁，原70/457/114、11目标红绿及旧新展开11/组合19齐，完成docs另全CI后续⑤；保护区/Playwright补跑/整批验收保持 | 常驻                    |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)               | 技术债台账（现39项，含TD-TEST-006工具可靠性及TD-WEB-004仅登记；旧38/37历史保持）                                                                                  | 常驻                    |
| [local-acceptance-cleanup.md](local-acceptance-cleanup.md)                       | `.local-acceptance/` 本地产物清理边界与手动脚本说明                                                                                                               | 常驻                    |
| [HARNESS-RULES.md](HARNESS-RULES.md)                                             | 施工规则（竣工验收后按其 §14 归档）                                                                                                                               | 常驻（施工期）          |
| [WORKSPACE_ROUTE_ISOLATION.md](WORKSPACE_ROUTE_ISOLATION.md)                     | 工作区路由隔离说明（2026-09-06）                                                                                                                                  | 已归档-只读（事件复盘） |

## docs/adr（架构决策记录，10 篇）

[3c⑤资金风险候选证据](evidence/frontend-3c5-finance-risk-2026-10-16.md)：9新TS/15helper实际逆展开/70公开457链/八目标红绿及旧新16、组合24只读齐；早cashRiskSummary/快照与live读取/共享risk槽/原权限耦合保持，提交后实际干净HEAD全CI待跑。

[3c④订单履约完成证据](evidence/frontend-3c4-fulfillment-2026-10-16.md)：源码6ade731稳定干净实际HEAD完整CI0/182166.585ms；12模块/21逆展开及原type-predicate/70绑定457链/11目标红绿、旧新展开11与组合19齐。双生产面板/风险槽/旧权限耦合不改，首红与补展开史保持，完成docs另全CI后续⑤。

[3c③信用与合同完成证据](evidence/frontend-3c3-agreements-2026-10-16.md)：源码e401d27稳定干净实际HEAD完整CI0/182693.526ms；四新模块/完整逆展开/70绑定457断言/三目标红绿及旧新9、组合15只读探针齐。TD-WEB-004仅登记不修，文档操作与Playwright不计覆盖；完成状态docs检查点另全CI后续④。

3c②现时：实施与独立复核完成，源码/工具两HEAD全CI0；台账现38项（TD-TEST-006按测试工具边界关闭，旧37历史不改），原Playwright全补跑和3f后整批验收边界保持，完成证据如下。

[3c①线索方案完成证据](evidence/frontend-3c1-sales-2026-10-16.md)：a34df41稳定干净全CI0/167522.718ms，三视图守恒/70绑定457断言/114/真实变异/旧新CDP10与首失败史、共享残留归宿和回滚齐。

[3c②成本政策报价完成证据](evidence/frontend-3c2-pricing-2026-10-16.md)：源码9429a31与独立工具3f3aae7干净HEAD全CI0；12模块/逆展开/70绑定457断言/11目标红绿及两次无trace13齐，旧失败史/有限竞态保留，现归并docs检查点另全CI后续3c③。

[能力门禁静态TS读源修正](evidence/frontend-capability-runtime-graph-2026-10-16.md)：用户授权47a8ee5；入口静态图/原39-19逐文件规则/边界自测及实际新源负向，独立于3b业务候选。

[3b CRM域完成证据](evidence/frontend-3b-crm-2026-10-16.md)：源码487d698干净HEAD完整CI0，controller/records/shell及必要共享模块守恒、70公开绑定/457断言/实际读源变异/CDP与回滚；失败史及旧候选时点保留。

[3a唯一现时检查点](evidence/frontend-3a-checkpoint-2026-10-16.md)：五公共模块/两必要纯类型的现时SHA-CI-回滚总表、全部读取映射/变异与CDP边界；历史小步措辞以本页为准。

[3a navigation](evidence/frontend-3a-navigation-2026-10-16.md)：十声明/完整函数/同一卸载WeakMap及70公开绑定守恒、utility读源映射/真实红绿、七场景CDP。

[3a商业HTTP工厂](evidence/frontend-3a-commercial-http-2026-10-16.md)：完整116行箭头工厂/必要类型/facade守恒，分页源码读取映射与真实变异红绿、web114/预算/分步回滚。

[3a CRM HTTP工厂](evidence/frontend-3a-crm-http-2026-10-16.md)：shared工厂及必要纯类型前置，原公开facade与完整源码逐字守恒；原测试零适配、格式对拍失败/路径纠正保留，逐步验证与回滚。

[3a locale小步](evidence/frontend-3a-locale-2026-10-16.md)：两张纯文案表/完整函数逐字移动、治理查询保持、原web114/预算/七场景CDP及独立回滚；form前步86e7026完整CI已过。

[3a公共form小步](evidence/frontend-3a-form-2026-10-16.md)：完整函数/类型逐字守恒、测试切片绑定与真实变异红绿、旧新表单CDP探头及独立回滚；不等同整批完成。

[新web C3最小AST护栏](evidence/frontend-c3-guard-2026-10-16.md)：四新目录及routes子目录真实CLI 29对照、38自测，旧31/G3/G4/其他路径保持；尚未迁移3a，函数200仍独立完整函数计量。

[CDP六场景/五类确定性探头基线](evidence/frontend-cdp-harness-2026-10-16.md)：合成stub/静态白名单隔离、真实click/fill、设备/路由/可见文本/文档溢出、hold竞态及两个真实负向；仅三个业务route，非Playwright/真实API/21视图全覆盖；保留失败史与补跑地图。

[Windows Chrome CDP通道预检](evidence/windows-chrome-cdp-preflight-2026-10-16.md)：ad0435e裁定/02d93f4续派，owned loopback、版本、WSL preview真实DOM/资源200及清理通过；五类harness/Playwright尚未执行，阶段5前真实补跑义务保持。

前端批次3前置地图/历史阻断：[冻结源码断言与Chrome环境](evidence/frontend-batch3-preflight-blockers-2026-10-16.md)（保留历史；ad0435e新裁定允许Windows Chrome CDP临时通道，先连通预检，执行边界见计划§7；Playwright配置/九spec冻结，阶段5前真实补跑）。

E1先行固定证据：[authorization守恒候选/773例旧新探针](evidence/e1-authorization-conservation-2026-10-16.md)（授权310c1e2；先完成E1完整验证，再前端前置地图/冲突停报）。

双线B原规则基线与AST候选：[routes结构扫描基线](evidence/routes-structure-baseline-2026-10-16.md)（授权c75dd7b；116文件原G1/G2/G3、31旧豁免及AST候选逐文件数据；实施前审查材料）。

2e工程护栏说明：[Service边界护栏与库存](engineering/service-boundary-guard.md)（工程历史快照保留；2e已人工验收，源码基线c4ab493、验收5e94439＋924fca9，按护栏＋零迁移证据结案、不扩同仓；2f/3/4/5未授权；静态能力边界不扩大）。

> D4 裁决：常驻原位。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR。

| 文档                                                                                                | 状态 |
| --------------------------------------------------------------------------------------------------- | ---- |
| [0001-typescript-monorepo-stack](adr/0001-typescript-monorepo-stack.md)                             | 常驻 |
| [0002-postgresql-access-and-migrations](adr/0002-postgresql-access-and-migrations.md)               | 常驻 |
| [0003-opaque-session-authentication](adr/0003-opaque-session-authentication.md)                     | 常驻 |
| [0004-rbac-and-data-scope](adr/0004-rbac-and-data-scope.md)                                         | 常驻 |
| [0005-versioned-platform-engines](adr/0005-versioned-platform-engines.md)                           | 常驻 |
| [0006-transactional-outbox-and-local-adapters](adr/0006-transactional-outbox-and-local-adapters.md) | 常驻 |
| [0007-immutable-business-object-schemas](adr/0007-immutable-business-object-schemas.md)             | 常驻 |
| [0008-p1-crm-compatibility-and-patterns](adr/0008-p1-crm-compatibility-and-patterns.md)             | 常驻 |
| [0009-commercial-revision-graph](adr/0009-commercial-revision-graph.md)                             | 常驻 |
| [0010-immutable-quote-to-cash-ledger](adr/0010-immutable-quote-to-cash-ledger.md)                   | 常驻 |

## docs/agent-memory（智能体记忆库，13 篇）

> D4 裁决：**保留为常驻**。Studio/Codex 工作流的活跃工作记忆（takeover-status 最近更新 2026-10-08），维持其只追加约定；与 exec-plans 体系并行。**历史记忆仅作过程记录——当前事实以 `AGENTS.md`、`ARCHITECTURE.md`、`docs/CI.md`、`docs/RELIABILITY.md` 与 `exec-plans/active/` 为准**，避免旧分支状态误导后续会话。

| 文档                                                                                             | 状态 |
| ------------------------------------------------------------------------------------------------ | ---- |
| [2026-08-17-studio-long-task-heartbeat](agent-memory/2026-08-17-studio-long-task-heartbeat.md)   | 常驻 |
| [2026-08-18-l02-ctr-solution-foundation](agent-memory/2026-08-18-l02-ctr-solution-foundation.md) | 常驻 |
| [CANONICAL_EXECUTION_BASELINE](agent-memory/CANONICAL_EXECUTION_BASELINE.md)                     | 常驻 |
| [README](agent-memory/README.md)                                                                 | 常驻 |
| [decisions](agent-memory/decisions.md)                                                           | 常驻 |
| [evidence](agent-memory/evidence.md)                                                             | 常驻 |
| [execution-boundary](agent-memory/execution-boundary.md)                                         | 常驻 |
| [handoff](agent-memory/handoff.md)                                                               | 常驻 |
| [project-issue-matrix](agent-memory/project-issue-matrix.md)                                     | 常驻 |
| [project-state](agent-memory/project-state.md)                                                   | 常驻 |
| [sessions](agent-memory/sessions.md)                                                             | 常驻 |
| [takeover-status](agent-memory/takeover-status.md)                                               | 常驻 |
| [task-sequence](agent-memory/task-sequence.md)                                                   | 常驻 |

## docs/deployment（部署运维，2 篇）

> D4 裁决：常驻。PRODUCTION_PARK_HOST 为生产主机细节 runbook（RELIABILITY.md 引用）；FEISHU 同步为在用流程（最近更新 2026-08-24）。

| 文档                                                               | 状态 |
| ------------------------------------------------------------------ | ---- |
| [FEISHU_CODEX_THREAD_SYNC](deployment/FEISHU_CODEX_THREAD_SYNC.md) | 常驻 |
| [PRODUCTION_PARK_HOST](deployment/PRODUCTION_PARK_HOST.md)         | 常驻 |

## docs/engineering（工程规格，22 篇：常驻 13 + 已归档 9）

> D4 裁决：活跃规格（蓝图/总计划/角色目录/身份授权/基座运营/能力矩阵/成本闭环/业务文档/L19-L20 规格/回归预防等 13 篇）常驻；KT-UI-PROD 系列（9 篇，编号无 04/05）为前端产品化完成记录，已归档-只读（README 仍引用 08/09，原位保留保证链接可达）。

| 文档                                                                                                                  | 状态                    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [ATOMIC_ROLE_AND_UAT_MATRIX](engineering/ATOMIC_ROLE_AND_UAT_MATRIX.md)                                               | 常驻                    |
| [BUSINESS_DOCUMENT_COMMUNICATIONS](engineering/BUSINESS_DOCUMENT_COMMUNICATIONS.md)                                   | 常驻                    |
| [COST_QUOTE_ORDER_CLOSED_LOOP](engineering/COST_QUOTE_ORDER_CLOSED_LOOP.md)                                           | 常驻                    |
| [FOUNDATION_OPERATIONS](engineering/FOUNDATION_OPERATIONS.md)                                                         | 常驻                    |
| [FRONTEND_CAPABILITY_PERMISSION_MATRIX](engineering/FRONTEND_CAPABILITY_PERMISSION_MATRIX.md)                         | 常驻                    |
| [IDENTITY_AUTHORIZATION](engineering/IDENTITY_AUTHORIZATION.md)                                                       | 常驻                    |
| [KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT](engineering/KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT.md)                     | 常驻                    |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC](engineering/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC.md)                       | 常驻                    |
| [KT-L20_COMPLAINT_NCR_CAPA_SPEC](engineering/KT-L20_COMPLAINT_NCR_CAPA_SPEC.md)                                       | 常驻                    |
| [KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN](engineering/KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN.md) | 已归档-只读（完成记录） |
| [KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT](engineering/KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT.md)                     | 已归档-只读（完成记录） |
| [KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT](engineering/KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT.md)                         | 已归档-只读（完成记录） |
| [KT-UI-PROD-06_PROCESS_NAVIGATION](engineering/KT-UI-PROD-06_PROCESS_NAVIGATION.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-07_COST_WORKBENCH](engineering/KT-UI-PROD-07_COST_WORKBENCH.md)                                           | 已归档-只读（完成记录） |
| [KT-UI-PROD-08_PRODUCT_AUDIT](engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md)                                             | 已归档-只读（完成记录） |
| [KT-UI-PROD-09_STARTUP_DELIVERY](engineering/KT-UI-PROD-09_STARTUP_DELIVERY.md)                                       | 已归档-只读（完成记录） |
| [KT-UI-PROD-10_LOGO_DOCUMENT_SEND](engineering/KT-UI-PROD-10_LOGO_DOCUMENT_SEND.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE](engineering/KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE.md)                       | 已归档-只读（完成记录） |
| [MASTER_DEVELOPMENT_PLAN](engineering/MASTER_DEVELOPMENT_PLAN.md)                                                     | 常驻                    |
| [OPERATING_MODEL_AND_ROLE_CATALOG](engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md)                                   | 常驻                    |
| [PRODUCT_BLUEPRINT](engineering/PRODUCT_BLUEPRINT.md)                                                                 | 常驻                    |
| [REGRESSION_PREVENTION](engineering/REGRESSION_PREVENTION.md)                                                         | 常驻                    |

## docs/evidence（验收证据，23 篇）

> D4 裁决：已归档-只读（历史验收快照，原位保留）。

| 文档                                                                                                                       | 状态                    |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [BATCH1_INTEGRATION_REPORT_20261008](evidence/BATCH1_INTEGRATION_REPORT_20261008.md)                                       | 已归档-只读（验收快照） |
| [BATCH1_RELEASE_SAFETY_REPORT_20261008](evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md)                                 | 已归档-只读（验收快照） |
| [BATCH25_CI_GATE_RECOVERY_REPORT_20261008](evidence/BATCH25_CI_GATE_RECOVERY_REPORT_20261008.md)                           | 已归档-只读（验收快照） |
| [BATCH2_AUTH_SECURITY_REPORT_20261008](evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md)                                   | 已归档-只读（验收快照） |
| [BATCH2_PR_INTEGRATION_REPORT_20261008](evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md)                                 | 已归档-只读（验收快照） |
| [BATCH3_AUTHORIZATION_REPORT_20261008](evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md)                                   | 已归档-只读（验收快照） |
| [GITHUB_PROTECTION_AUDIT_20261008_BATCH1](evidence/GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)                             | 已归档-只读（验收快照） |
| [KT-L07_ACCEPTANCE](evidence/KT-L07_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L08_ACCEPTANCE](evidence/KT-L08_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L09_ACCEPTANCE](evidence/KT-L09_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L10_ACCEPTANCE](evidence/KT-L10_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L11_ACCEPTANCE](evidence/KT-L11_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L12_ACCEPTANCE](evidence/KT-L12_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L13_ACCEPTANCE](evidence/KT-L13_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L14_ACCEPTANCE](evidence/KT-L14_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L15_ACCEPTANCE](evidence/KT-L15_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照） |
| [KT-L17_ACTUAL_MANUFACTURING_COST_20260822](evidence/KT-L17_ACTUAL_MANUFACTURING_COST_20260822.md)                         | 已归档-只读（验收快照） |
| [KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824](evidence/KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824.md)               | 已归档-只读（验收快照） |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825](evidence/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825.md) | 已归档-只读（验收快照） |
| [KT-RG01_PRODUCTION_REACCEPTANCE_20260822](evidence/KT-RG01_PRODUCTION_REACCEPTANCE_20260822.md)                           | 已归档-只读（验收快照） |
| [KT_RBAC_ATOMIC_ROLE_UAT_20260822](evidence/KT_RBAC_ATOMIC_ROLE_UAT_20260822.md)                                           | 已归档-只读（验收快照） |
| [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010](evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010.md)   | 已归档-只读（验收快照） |
| [PROJECT_TAKEOVER_REPORT_20261008](evidence/PROJECT_TAKEOVER_REPORT_20261008.md)                                           | 已归档-只读（验收快照） |

## docs/tasks（历史任务档案，23 篇：常驻 2 + 已归档 21）

> D4 裁决：ROADMAP 与 KINGTURF_V2_LONG_TASK_PLAN 常驻（活跃规划，目标 2027-06-30）；JTF-P0/P1 任务档案已归档-只读。

| 文档                                                                          | 状态                    |
| ----------------------------------------------------------------------------- | ----------------------- |
| [JTF-P0-E01-REPOSITORY-BOOTSTRAP](tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)   | 已归档-只读（任务档案） |
| [JTF-P0-E02-CONFIGURATION](tasks/JTF-P0-E02-CONFIGURATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E03-DATABASE-FOUNDATION](tasks/JTF-P0-E03-DATABASE-FOUNDATION.md)     | 已归档-只读（任务档案） |
| [JTF-P0-E04-ORGANIZATION-EMPLOYEE](tasks/JTF-P0-E04-ORGANIZATION-EMPLOYEE.md) | 已归档-只读（任务档案） |
| [JTF-P0-E05-AUTHENTICATION](tasks/JTF-P0-E05-AUTHENTICATION.md)               | 已归档-只读（任务档案） |
| [JTF-P0-E06-AUTHORIZATION](tasks/JTF-P0-E06-AUTHORIZATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E07-MASTER-DATA](tasks/JTF-P0-E07-MASTER-DATA.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E08-NUMBERING](tasks/JTF-P0-E08-NUMBERING.md)                         | 已归档-只读（任务档案） |
| [JTF-P0-E09-AUDIT](tasks/JTF-P0-E09-AUDIT.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E10-WORKFLOW](tasks/JTF-P0-E10-WORKFLOW.md)                           | 已归档-只读（任务档案） |
| [JTF-P0-E11-RULES](tasks/JTF-P0-E11-RULES.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E12-NOTIFICATIONS](tasks/JTF-P0-E12-NOTIFICATIONS.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E13-ATTACHMENTS](tasks/JTF-P0-E13-ATTACHMENTS.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E14-EVENTS](tasks/JTF-P0-E14-EVENTS.md)                               | 已归档-只读（任务档案） |
| [JTF-P0-E15-BUSINESS-OBJECTS](tasks/JTF-P0-E15-BUSINESS-OBJECTS.md)           | 已归档-只读（任务档案） |
| [JTF-P0-E16-OBSERVABILITY](tasks/JTF-P0-E16-OBSERVABILITY.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E17-QUALITY](tasks/JTF-P0-E17-QUALITY.md)                             | 已归档-只读（任务档案） |
| [JTF-P1-E01-E04-SALES-TO-CASH](tasks/JTF-P1-E01-E04-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E05-E10-SALES-TO-CASH](tasks/JTF-P1-E05-E10-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E11-E17-QUOTE-TO-CASH](tasks/JTF-P1-E11-E17-QUOTE-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E18-E21-CLOSURE](tasks/JTF-P1-E18-E21-CLOSURE.md)                     | 已归档-只读（任务档案） |
| [KINGTURF_V2_LONG_TASK_PLAN](tasks/KINGTURF_V2_LONG_TASK_PLAN.md)             | 常驻                    |
| [ROADMAP](tasks/ROADMAP.md)                                                   | 常驻                    |

## exec-plans/completed/

（暂无已归档计划；harness 改造竣工后首个归档件为 HARNESS-RULES 拆解产物。）
