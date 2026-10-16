# routes结构覆盖修复：原规则基线（2026-10-16）

原型试扫（尚未改门禁）：116文件parse诊断0；AST最大深度分布2层1、3层93、4层20、5层1、6层1。唯一6层为authorization.ts的dispatchAuthorizationRoutes中atomicCapability多层三元：外层函数1＋四层三元fallback＋叶子request.method三元1。不能删该候选、改业务或悄悄改三元计数以过门禁。候选处置为仅此文件、仅当前内容SHA256钉死、且maxDepth不得超过6的一条限期信息豁免，挂TD-GATE-003子项，明确到期日2026-10-23（Asia/Singapore，当日00:00起强制失败），与“批次2最终验收前”取先；仅留待后续独立授权authorization去嵌套或裁决，不授权本批业务修改；日期到期/任意内容变化/新增更深样本恢复强制失败，须有确定性边界测试。阈值仍5，31旧豁免逐条不变，新总数预期32＝9G1＋22旧G2＋1精确AST存量，待协调复核，不当作已批准实现或问题已关闭。

授权c75dd7b，生产/门禁基线7e94bbe。此工件在B实现前用原structure-gate导出的sizeViolations/nestingViolations/sqlRawInputViolations逐一试扫真实routes；未改变源码或原规则。与协调独立结果一致：116文件，G1=0、G2=93、G3=0，maxIndent=10。原正常runChecks为0强制违规/31信息豁免，原因是walk跳过routes；G4原独立扫描保持。下面G2是每行前导空格÷2向下取整的**格式缩进**，不是控制流或函数嵌套，不能把93一概称业务复杂度超限。

复算：在7e94bbe/c75dd7b导入structure-gate.mjs，读取apps/api/src/routes各.ts内容并分别调用上述三个导出函数；lines采用split换行含末空段，maxIndent按原nestingViolations循环算法（空行跳过）。不包含测试，不读取prompt-history或环境秘密。所有G3使用原白名单/可信根，尚无合法SQL表达冲突，后续若有须停B报告，不扩白名单。

## 逐文件原规则试扫

| routes相对文件                        | split行数 | 原maxIndent | G1数量 | G2数量 | G3数量 |
| ------------------------------------- | --------- | ----------- | ------ | ------ | ------ |
| audit-reads.ts                        | 80        | 7           | 0      | 1      | 0      |
| auth.ts                               | 118       | 9           | 0      | 1      | 0      |
| authorization.ts                      | 272       | 7           | 0      | 1      | 0      |
| business-document-activity.ts         | 57        | 5           | 0      | 0      | 0      |
| business-document-bindings.ts         | 69        | 7           | 0      | 1      | 0      |
| business-document-connector.ts        | 91        | 6           | 0      | 1      | 0      |
| business-document-create.ts           | 86        | 9           | 0      | 1      | 0      |
| business-document-reads.ts            | 218       | 7           | 0      | 1      | 0      |
| business-document-review.ts           | 59        | 6           | 0      | 1      | 0      |
| business-document-send.ts             | 88        | 7           | 0      | 1      | 0      |
| business-document-translation.ts      | 61        | 7           | 0      | 1      | 0      |
| business-document-version.ts          | 59        | 6           | 0      | 1      | 0      |
| capa-actions.ts                       | 127       | 7           | 0      | 1      | 0      |
| capa-create.ts                        | 94        | 7           | 0      | 1      | 0      |
| capa-lifecycle.ts                     | 130       | 7           | 0      | 1      | 0      |
| collection.ts                         | 425       | 8           | 0      | 1      | 0      |
| commercial-definitions.ts             | 140       | 6           | 0      | 1      | 0      |
| commercial-evaluations.ts             | 126       | 7           | 0      | 1      | 0      |
| commercial-nested-reads.ts            | 73        | 7           | 0      | 1      | 0      |
| commercial-views.ts                   | 46        | 7           | 0      | 1      | 0      |
| commission-accrue.ts                  | 95        | 6           | 0      | 1      | 0      |
| commission-commands.ts                | 105       | 7           | 0      | 1      | 0      |
| commission-policy-publish.ts          | 74        | 5           | 0      | 0      | 0      |
| commission-policy-writes.ts           | 204       | 6           | 0      | 1      | 0      |
| commission-reads.ts                   | 72        | 8           | 0      | 1      | 0      |
| complaint-batch-triage.ts             | 87        | 5           | 0      | 0      | 0      |
| complaint-create.ts                   | 117       | 7           | 0      | 1      | 0      |
| complaint-reads.ts                    | 118       | 8           | 0      | 1      | 0      |
| complaint-sla.ts                      | 124       | 8           | 0      | 1      | 0      |
| complaint-transitions.ts              | 79        | 7           | 0      | 1      | 0      |
| cost-matrix-base.ts                   | 173       | 7           | 0      | 1      | 0      |
| cost-matrix-calculations.ts           | 115       | 7           | 0      | 1      | 0      |
| cost-matrix-factors.ts                | 147       | 6           | 0      | 1      | 0      |
| ctr.ts                                | 226       | 6           | 0      | 1      | 0      |
| customer-360.ts                       | 142       | 6           | 0      | 1      | 0      |
| customer-activities.ts                | 92        | 8           | 0      | 1      | 0      |
| customer-base.ts                      | 120       | 8           | 0      | 1      | 0      |
| customer-contacts.ts                  | 82        | 6           | 0      | 1      | 0      |
| customer-lifecycle.ts                 | 70        | 6           | 0      | 1      | 0      |
| customer-ownership.ts                 | 78        | 6           | 0      | 1      | 0      |
| dashboard.ts                          | 102       | 8           | 0      | 1      | 0      |
| foundation.ts                         | 618       | 8           | 0      | 1      | 0      |
| identity-access.ts                    | 102       | 6           | 0      | 1      | 0      |
| identity-provision.ts                 | 55        | 5           | 0      | 0      | 0      |
| lead-base.ts                          | 128       | 8           | 0      | 1      | 0      |
| lead-claim.ts                         | 72        | 6           | 0      | 1      | 0      |
| lead-commands.ts                      | 180       | 5           | 0      | 0      | 0      |
| manufacturing-bom-create.ts           | 149       | 10          | 0      | 1      | 0      |
| manufacturing-item-create.ts          | 98        | 6           | 0      | 1      | 0      |
| manufacturing-publish.ts              | 82        | 6           | 0      | 1      | 0      |
| manufacturing-reads.ts                | 69        | 8           | 0      | 1      | 0      |
| manufacturing-routing-create.ts       | 135       | 8           | 0      | 1      | 0      |
| master-data-categories.ts             | 155       | 8           | 0      | 1      | 0      |
| master-data-entries.ts                | 184       | 6           | 0      | 1      | 0      |
| mrp-demand-create.ts                  | 91        | 6           | 0      | 1      | 0      |
| mrp-policy-create.ts                  | 107       | 6           | 0      | 1      | 0      |
| mrp-proposal-commands.ts              | 103       | 6           | 0      | 1      | 0      |
| mrp-reads.ts                          | 69        | 8           | 0      | 1      | 0      |
| mrp-run-create.ts                     | 79        | 6           | 0      | 1      | 0      |
| ncr-create.ts                         | 97        | 10          | 0      | 1      | 0      |
| ncr-transitions.ts                    | 122       | 7           | 0      | 1      | 0      |
| number-allocation.ts                  | 39        | 5           | 0      | 0      | 0      |
| number-definitions.ts                 | 171       | 6           | 0      | 1      | 0      |
| opportunities.ts                      | 248       | 10          | 0      | 1      | 0      |
| order-360.ts                          | 209       | 6           | 0      | 1      | 0      |
| procurement-issue.ts                  | 77        | 5           | 0      | 0      | 0      |
| procurement-location-create.ts        | 84        | 5           | 0      | 0      | 0      |
| procurement-movement-create.ts        | 110       | 6           | 0      | 1      | 0      |
| procurement-purchase-order-create.ts  | 110       | 7           | 0      | 1      | 0      |
| procurement-reads.ts                  | 73        | 8           | 0      | 1      | 0      |
| procurement-receipt-create.ts         | 128       | 7           | 0      | 1      | 0      |
| procurement-rfq-create.ts             | 100       | 6           | 0      | 1      | 0      |
| procurement-supplier-create.ts        | 107       | 9           | 0      | 1      | 0      |
| procurement-supplier-qualification.ts | 112       | 7           | 0      | 1      | 0      |
| procurement-supplier-quote-create.ts  | 116       | 7           | 0      | 1      | 0      |
| production-cost-calculation.ts        | 86        | 6           | 0      | 1      | 0      |
| production-cost-decisions.ts          | 98        | 6           | 0      | 1      | 0      |
| production-cost-policy.ts             | 121       | 7           | 0      | 1      | 0      |
| production-material.ts                | 103       | 6           | 0      | 1      | 0      |
| production-order-commands.ts          | 120       | 6           | 0      | 1      | 0      |
| production-order-create.ts            | 98        | 6           | 0      | 1      | 0      |
| production-output.ts                  | 102       | 6           | 0      | 1      | 0      |
| production-reads.ts                   | 110       | 8           | 0      | 1      | 0      |
| production-report.ts                  | 104       | 6           | 0      | 1      | 0      |
| qtc-ar-post.ts                        | 92        | 7           | 0      | 1      | 0      |
| qtc-bank-payment-intake.ts            | 85        | 5           | 0      | 0      | 0      |
| qtc-base-reads.ts                     | 77        | 8           | 0      | 1      | 0      |
| qtc-contract-create.ts                | 81        | 5           | 0      | 0      | 0      |
| qtc-contract-sign.ts                  | 86        | 6           | 0      | 1      | 0      |
| qtc-credit-approval.ts                | 78        | 5           | 0      | 0      | 0      |
| qtc-credit-writes.ts                  | 139       | 5           | 0      | 0      | 0      |
| qtc-operational-reads.ts              | 103       | 8           | 0      | 1      | 0      |
| qtc-reconciliation-run.ts             | 68        | 5           | 0      | 0      | 0      |
| qtc-sales-order-create.ts             | 123       | 6           | 0      | 1      | 0      |
| quality-disposition.ts                | 97        | 6           | 0      | 1      | 0      |
| quality-inspection-open.ts            | 96        | 6           | 0      | 1      | 0      |
| quality-inspection-transitions.ts     | 111       | 6           | 0      | 1      | 0      |
| quality-plan-create.ts                | 147       | 5           | 0      | 0      | 0      |
| quality-plan-publish.ts               | 68        | 5           | 0      | 0      | 0      |
| quality-reads.ts                      | 146       | 8           | 0      | 1      | 0      |
| quality-result-record.ts              | 120       | 9           | 0      | 1      | 0      |
| quote-commands.ts                     | 106       | 6           | 0      | 1      | 0      |
| quote-writes.ts                       | 136       | 6           | 0      | 1      | 0      |
| risk-evaluation-create.ts             | 92        | 5           | 0      | 0      | 0      |
| risk-policy-create.ts                 | 113       | 6           | 0      | 1      | 0      |
| risk-policy-publish.ts                | 72        | 5           | 0      | 0      | 0      |
| risk-policy-revision.ts               | 114       | 6           | 0      | 1      | 0      |
| risk-reads.ts                         | 111       | 8           | 0      | 1      | 0      |
| risk-task-commands.ts                 | 96        | 5           | 0      | 0      | 0      |
| rule-definitions.ts                   | 155       | 6           | 0      | 1      | 0      |
| rule-evaluation.ts                    | 52        | 5           | 0      | 0      | 0      |
| technical-solutions.ts                | 107       | 6           | 0      | 1      | 0      |
| types.ts                              | 50        | 3           | 0      | 0      | 0      |
| website-lead-ingest.ts                | 45        | 5           | 0      | 0      | 0      |
| workflow-definitions.ts               | 150       | 5           | 0      | 0      | 0      |
| workflow-runtime.ts                   | 140       | 5           | 0      | 0      | 0      |

## 原正常全仓信息豁免逐条（31）

| 规则 | 文件                                           | 原行数或maxIndent |
| ---- | ---------------------------------------------- | ----------------- |
| G1   | apps/api/src/app.ts                            | 4129              |
| G2   | apps/api/src/app.ts                            | 10                |
| G2   | apps/api/src/business-document-repositories.ts | 7                 |
| G2   | apps/api/src/collection-repositories.ts        | 8                 |
| G1   | apps/api/src/commercial-repositories.ts        | 2047              |
| G2   | apps/api/src/commercial-repositories.ts        | 7                 |
| G2   | apps/api/src/commission-repositories.ts        | 6                 |
| G1   | apps/api/src/complaint-repositories.ts         | 1340              |
| G2   | apps/api/src/complaint-repositories.ts         | 6                 |
| G2   | apps/api/src/contract-document-repositories.ts | 6                 |
| G1   | apps/api/src/crm-repositories.ts               | 873               |
| G2   | apps/api/src/crm-repositories.ts               | 6                 |
| G2   | apps/api/src/manufacturing-repositories.ts     | 7                 |
| G2   | apps/api/src/mrp-repositories.ts               | 6                 |
| G2   | apps/api/src/order-360-repositories.ts         | 6                 |
| G1   | apps/api/src/platform-repositories.ts          | 1189              |
| G2   | apps/api/src/platform-repositories.ts          | 6                 |
| G2   | apps/api/src/procurement-repositories.ts       | 7                 |
| G2   | apps/api/src/production-cost-repositories.ts   | 6                 |
| G2   | apps/api/src/production-repositories.ts        | 6                 |
| G1   | apps/api/src/qtc-repositories.ts               | 931               |
| G2   | apps/api/src/qtc-repositories.ts               | 8                 |
| G2   | apps/api/src/quality-repositories.ts           | 6                 |
| G1   | apps/api/src/repositories.ts                   | 869               |
| G2   | apps/api/src/repositories.ts                   | 6                 |
| G2   | apps/api/src/risk-repositories.ts              | 8                 |
| G2   | apps/api/src/shipment-repositories.ts          | 6                 |
| G1   | apps/web/src/bootstrap.ts                      | 16082             |
| G2   | apps/web/src/bootstrap.ts                      | 14                |
| G1   | packages/domain/src/index.ts                   | 1032              |
| G2   | packages/domain/src/index.ts                   | 6                 |

实测构成为G1=9、G2=22、G3=0。SIZE_WHITELIST对已列文件无条件输出信息豁免，即使当前不足800行仍在这9条中；G2仅实际maxIndent>5输出。旧文档“7 G1＋24 G2”与此现时输出口径不一致，旧历史叙述保留，不冒称当时已测9/22。本轮不新增/移除这些豁免；实现后逐rule/path对比，数量相同仍需确认逐条一致，不以总数掩盖增减。

## B候选（实现前）

### AST候选逐文件预扫（与原maxIndent分开）

| 文件                                  | 候选AST深度 | parse诊断数 |
| ------------------------------------- | ----------- | ----------- |
| audit-reads.ts                        | 3           | 0           |
| auth.ts                               | 3           | 0           |
| authorization.ts                      | 6           | 0           |
| business-document-activity.ts         | 3           | 0           |
| business-document-bindings.ts         | 5           | 0           |
| business-document-connector.ts        | 4           | 0           |
| business-document-create.ts           | 3           | 0           |
| business-document-reads.ts            | 3           | 0           |
| business-document-review.ts           | 4           | 0           |
| business-document-send.ts             | 3           | 0           |
| business-document-translation.ts      | 3           | 0           |
| business-document-version.ts          | 3           | 0           |
| capa-actions.ts                       | 3           | 0           |
| capa-create.ts                        | 3           | 0           |
| capa-lifecycle.ts                     | 3           | 0           |
| collection.ts                         | 4           | 0           |
| commercial-definitions.ts             | 4           | 0           |
| commercial-evaluations.ts             | 3           | 0           |
| commercial-nested-reads.ts            | 3           | 0           |
| commercial-views.ts                   | 4           | 0           |
| commission-accrue.ts                  | 3           | 0           |
| commission-commands.ts                | 4           | 0           |
| commission-policy-publish.ts          | 3           | 0           |
| commission-policy-writes.ts           | 3           | 0           |
| commission-reads.ts                   | 4           | 0           |
| complaint-batch-triage.ts             | 3           | 0           |
| complaint-create.ts                   | 3           | 0           |
| complaint-reads.ts                    | 3           | 0           |
| complaint-sla.ts                      | 3           | 0           |
| complaint-transitions.ts              | 4           | 0           |
| cost-matrix-base.ts                   | 3           | 0           |
| cost-matrix-calculations.ts           | 3           | 0           |
| cost-matrix-factors.ts                | 3           | 0           |
| ctr.ts                                | 3           | 0           |
| customer-360.ts                       | 4           | 0           |
| customer-activities.ts                | 3           | 0           |
| customer-base.ts                      | 3           | 0           |
| customer-contacts.ts                  | 3           | 0           |
| customer-lifecycle.ts                 | 3           | 0           |
| customer-ownership.ts                 | 3           | 0           |
| dashboard.ts                          | 3           | 0           |
| foundation.ts                         | 4           | 0           |
| identity-access.ts                    | 3           | 0           |
| identity-provision.ts                 | 3           | 0           |
| lead-base.ts                          | 3           | 0           |
| lead-claim.ts                         | 3           | 0           |
| lead-commands.ts                      | 2           | 0           |
| manufacturing-bom-create.ts           | 4           | 0           |
| manufacturing-item-create.ts          | 3           | 0           |
| manufacturing-publish.ts              | 3           | 0           |
| manufacturing-reads.ts                | 3           | 0           |
| manufacturing-routing-create.ts       | 4           | 0           |
| master-data-categories.ts             | 3           | 0           |
| master-data-entries.ts                | 3           | 0           |
| mrp-demand-create.ts                  | 3           | 0           |
| mrp-policy-create.ts                  | 3           | 0           |
| mrp-proposal-commands.ts              | 3           | 0           |
| mrp-reads.ts                          | 3           | 0           |
| mrp-run-create.ts                     | 3           | 0           |
| ncr-create.ts                         | 3           | 0           |
| ncr-transitions.ts                    | 4           | 0           |
| number-allocation.ts                  | 3           | 0           |
| number-definitions.ts                 | 3           | 0           |
| opportunities.ts                      | 3           | 0           |
| order-360.ts                          | 4           | 0           |
| procurement-issue.ts                  | 3           | 0           |
| procurement-location-create.ts        | 3           | 0           |
| procurement-movement-create.ts        | 3           | 0           |
| procurement-purchase-order-create.ts  | 3           | 0           |
| procurement-reads.ts                  | 3           | 0           |
| procurement-receipt-create.ts         | 4           | 0           |
| procurement-rfq-create.ts             | 3           | 0           |
| procurement-supplier-create.ts        | 3           | 0           |
| procurement-supplier-qualification.ts | 3           | 0           |
| procurement-supplier-quote-create.ts  | 3           | 0           |
| production-cost-calculation.ts        | 3           | 0           |
| production-cost-decisions.ts          | 4           | 0           |
| production-cost-policy.ts             | 3           | 0           |
| production-material.ts                | 3           | 0           |
| production-order-commands.ts          | 4           | 0           |
| production-order-create.ts            | 3           | 0           |
| production-output.ts                  | 3           | 0           |
| production-reads.ts                   | 3           | 0           |
| production-report.ts                  | 3           | 0           |
| qtc-ar-post.ts                        | 3           | 0           |
| qtc-bank-payment-intake.ts            | 3           | 0           |
| qtc-base-reads.ts                     | 4           | 0           |
| qtc-contract-create.ts                | 3           | 0           |
| qtc-contract-sign.ts                  | 3           | 0           |
| qtc-credit-approval.ts                | 3           | 0           |
| qtc-credit-writes.ts                  | 3           | 0           |
| qtc-operational-reads.ts              | 4           | 0           |
| qtc-reconciliation-run.ts             | 3           | 0           |
| qtc-sales-order-create.ts             | 3           | 0           |
| quality-disposition.ts                | 3           | 0           |
| quality-inspection-open.ts            | 3           | 0           |
| quality-inspection-transitions.ts     | 3           | 0           |
| quality-plan-create.ts                | 3           | 0           |
| quality-plan-publish.ts               | 3           | 0           |
| quality-reads.ts                      | 3           | 0           |
| quality-result-record.ts              | 3           | 0           |
| quote-commands.ts                     | 3           | 0           |
| quote-writes.ts                       | 3           | 0           |
| risk-evaluation-create.ts             | 3           | 0           |
| risk-policy-create.ts                 | 3           | 0           |
| risk-policy-publish.ts                | 3           | 0           |
| risk-policy-revision.ts               | 3           | 0           |
| risk-reads.ts                         | 3           | 0           |
| risk-task-commands.ts                 | 3           | 0           |
| rule-definitions.ts                   | 3           | 0           |
| rule-evaluation.ts                    | 3           | 0           |
| technical-solutions.ts                | 3           | 0           |
| types.ts                              | 4           | 0           |
| website-lead-ingest.ts                | 3           | 0           |
| workflow-definitions.ts               | 3           | 0           |
| workflow-runtime.ts                   | 3           | 0           |

### 算法与唯一存量点处置

仅routes改为TypeScript AST显式执行嵌套，其余路径G2仍原格式缩进；G1/G3全部纳入同一个sourceFiles遍历，G4继续逐defineRoute。AST候选：词法函数（声明/表达式/箭头/method/get/set/constructor，需body）每层+1；一个if决策+1、then/else同级，else-if链共享同一分支层（else块内新if再加层）；三元每层+1；循环每层+1；switch每层+1（case不叠加）；try/catch/finally词法同级（深度取最大、不按顺序累计，finally并非互斥分支）；普通对象/数组/调用参数/类型/格式缩进及逻辑短路运算符不新增层（但继承已有深度；本指标不是圈复杂度）；嵌套回调继承已有深度，不遇函数reset，默认参数与表达式箭头体也完整遍历。外层function也计1，跨函数调用图不叠加（另有2e服务护栏，不把静态词法度量说成运行栈）。阈值仍5，不扩大为全局AST升级，不新增目录豁免；200行函数项本轮不新增强制规则，不假称已覆盖。语法错误应拒绝而非低估深度；真实样本/AST边界对照先复核后实施。A的13点另记台账/计划，不与此原基线混算。

## 实施后核证（不改上方原基线/候选快照）

原基线提交62a90cc；B工程bd48b5a已完整CI真实0/171.698秒。36结构自测真实0；routes超800/AST超5/SQL直插/缺validate真实进程均1，合法格式40空格但低词法深度0；清理后全仓0硬/32软。原31按rule:path全部保留无增删，唯一新增G2:apps/api/src/routes/authorization.ts的精确E1。G3实现/白名单和G4 validator相对7e94bbe逐字节相同；2e service39自测与护栏继续生效。协调独立8个AST/expiry检查及runChecks结果一致，非PG且不共享注入目录。

日期2026-10-23 Asia/Singapore零时由脚本机械失效（临界前/到期瞬间/内容变化/更深及异文件均有确定性对照）。如果批次2提前进入最终验收，必须先移除或另行人工裁决E1，是人工验收前置条件，不是脚本已经自动识别批次状态；本轮不授权修改authorization业务源码。旧31按批次due的历史机制保留，新增E1明确日期不能静默续期。

函数跨度另独立测量：870个有body函数节点，唯一超过200的是foundation.ts foundationRoutes:89–610＝522行，故本轮不声称函数200已有AST强制，也不修该业务体量。最初候选finally互斥文案已纠正为同级取最大；更深例外测试曾把带import模块包进函数、证据不精确，已换语法合法7层并明确parseErrors=0/maxDepth=7；本轮所有最终自测/两线稳定CI成功不掩盖这些原型修正。最终证据HEAD另全CI、干净后与A一并交人工验收，非已人工通过。
