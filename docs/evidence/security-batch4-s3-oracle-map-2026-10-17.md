# S3 CSP严格期望逐处映射（D1）

基线74c78c3（S2最终）→业务762e393新增默认Report-Only。旧API测试122文件完整AST核验，其中68文件81个已有S1三固定头对象仅追加独立字面量 `content-security-policy-report-only`，policy逐字沿S3设计，不从生产helper计算。包括S1 65文件76节点、app共享正向对象1、helper严格对象1、S2三个头对象3（含429完整响应）。其余旧状态/body/correlation/receiver/请求/会话/签名夹具与断言链不变，无新增import；不弱化toEqual。实际行号为基线一基行，不是当前格式化后行。

只读证明 `scripts/analysis/csp-oracle-check.mjs --baseline 74c78c3 --target working-tree` 对每个基线API测试逆去唯一获批CSP字段后比较完整AST（含后续兄弟节点）；也支持显式目标SHA。`--apply`是主代理在执行端内存定位的批量机械追加，先检查所有基线字节，stdout仅路径/计数/布尔。禁止旧 `--patch` 正文输出：初版工具一次误输出过大补丁文本，已向用户说明并收紧，未读真实.env/生产值，不复述fixture内容或擅自轮换凭据。生成内容不再通过stdout/JSON/大上下文apply_patch传播。S1原工具/65-76历史固定SHA证明不回写，其默认working-tree模式不适用于S3。

旧→新统一规则：下表每个原有S1三头对象新增上述一字段，值固定为[先行设计](../tasks/harness-batch4-s3-design-2026-10-17.md)的公共policy；D1 S3要求API Report-Only，额外头是获批新行为，非重构期望解冻其它业务。新API9/config6不计入这些旧oracle追加数量。最初9新API旧实现真红、接线后7绿2夹具误判修正→9绿历史保留，源码未为夹具改行为。

| 基线测试路径                                                     | 基线对象起始行        | 节点数 |
| ---------------------------------------------------------------- | --------------------- | ------ |
| apps/api/test/app.test.ts                                        | 489                   | 1      |
| apps/api/test/audit-route-contract.test.ts                       | 71                    | 1      |
| apps/api/test/auth-route-contract.test.ts                        | 42、62、104、122、150 | 5      |
| apps/api/test/capa-action-route-contract.test.ts                 | 118                   | 1      |
| apps/api/test/capa-create-route-contract.test.ts                 | 92                    | 1      |
| apps/api/test/capa-lifecycle-route-contract.test.ts              | 115                   | 1      |
| apps/api/test/collection-route-contract.test.ts                  | 91                    | 1      |
| apps/api/test/commercial-definition-contract.test.ts             | 167                   | 1      |
| apps/api/test/commercial-evaluation-contract.test.ts             | 129                   | 1      |
| apps/api/test/commercial-nested-read-contract.test.ts            | 84                    | 1      |
| apps/api/test/commercial-view-route-contract.test.ts             | 156                   | 1      |
| apps/api/test/complaint-batch-route-contract.test.ts             | 86                    | 1      |
| apps/api/test/complaint-create-route-contract.test.ts            | 110                   | 1      |
| apps/api/test/complaint-read-route-contract.test.ts              | 65                    | 1      |
| apps/api/test/complaint-sla-route-contract.test.ts               | 82                    | 1      |
| apps/api/test/complaint-transition-route-contract.test.ts        | 94                    | 1      |
| apps/api/test/cost-matrix-base-contract.test.ts                  | 153                   | 1      |
| apps/api/test/cost-matrix-calculation-contract.test.ts           | 90                    | 1      |
| apps/api/test/cost-matrix-factor-contract.test.ts                | 123                   | 1      |
| apps/api/test/ctr-route-contract.test.ts                         | 151                   | 1      |
| apps/api/test/customer-360-route-contract.test.ts                | 144                   | 1      |
| apps/api/test/customer-activity-route-contract.test.ts           | 92                    | 1      |
| apps/api/test/customer-base-route-contract.test.ts               | 75                    | 1      |
| apps/api/test/customer-contact-route-contract.test.ts            | 97                    | 1      |
| apps/api/test/customer-lifecycle-route-contract.test.ts          | 72                    | 1      |
| apps/api/test/customer-ownership-route-contract.test.ts          | 96                    | 1      |
| apps/api/test/iam-route-contract.test.ts                         | 58、116、232          | 3      |
| apps/api/test/identity-access-route-contract.test.ts             | 52、82、182、231      | 4      |
| apps/api/test/identity-provision-route.test.ts                   | 40、58、89            | 3      |
| apps/api/test/lead-base-route-contract.test.ts                   | 140                   | 1      |
| apps/api/test/lead-claim-route-contract.test.ts                  | 75                    | 1      |
| apps/api/test/lead-command-route-contract.test.ts                | 95                    | 1      |
| apps/api/test/login-rate-limit-http.test.ts                      | 54、112、160          | 3      |
| apps/api/test/master-category-route-contract.test.ts             | 108                   | 1      |
| apps/api/test/master-entry-route-contract.test.ts                | 119                   | 1      |
| apps/api/test/ncr-create-route-contract.test.ts                  | 92                    | 1      |
| apps/api/test/ncr-transition-route-contract.test.ts              | 93                    | 1      |
| apps/api/test/number-allocation-route-contract.test.ts           | 94                    | 1      |
| apps/api/test/number-definition-route-contract.test.ts           | 126                   | 1      |
| apps/api/test/opportunity-route-contract.test.ts                 | 73                    | 1      |
| apps/api/test/production-command-route-contract.test.ts          | 92                    | 1      |
| apps/api/test/production-cost-calculation-route-contract.test.ts | 97                    | 1      |
| apps/api/test/production-cost-decision-route-contract.test.ts    | 94                    | 1      |
| apps/api/test/production-cost-policy-route-contract.test.ts      | 118                   | 1      |
| apps/api/test/production-create-route-contract.test.ts           | 109                   | 1      |
| apps/api/test/production-material-route-contract.test.ts         | 104                   | 1      |
| apps/api/test/production-output-route-contract.test.ts           | 110                   | 1      |
| apps/api/test/production-read-route-contract.test.ts             | 114                   | 1      |
| apps/api/test/production-report-route-contract.test.ts           | 115                   | 1      |
| apps/api/test/qtc-ar-post-route-contract.test.ts                 | 136                   | 1      |
| apps/api/test/qtc-bank-payment-intake-route-contract.test.ts     | 135                   | 1      |
| apps/api/test/qtc-base-read-route-contract.test.ts               | 93                    | 1      |
| apps/api/test/qtc-contract-create-route-contract.test.ts         | 129                   | 1      |
| apps/api/test/qtc-contract-sign-route-contract.test.ts           | 118                   | 1      |
| apps/api/test/qtc-credit-approval-route-contract.test.ts         | 103                   | 1      |
| apps/api/test/qtc-credit-write-route-contract.test.ts            | 148                   | 1      |
| apps/api/test/qtc-operational-read-route-contract.test.ts        | 84                    | 1      |
| apps/api/test/qtc-reconciliation-run-route-contract.test.ts      | 117                   | 1      |
| apps/api/test/qtc-sales-order-create-route-contract.test.ts      | 155                   | 1      |
| apps/api/test/quote-command-contract.test.ts                     | 90                    | 1      |
| apps/api/test/quote-write-contract.test.ts                       | 119                   | 1      |
| apps/api/test/rule-definition-route-contract.test.ts             | 113                   | 1      |
| apps/api/test/rule-evaluation-route-contract.test.ts             | 92                    | 1      |
| apps/api/test/security-headers.test.ts                           | 23                    | 1      |
| apps/api/test/technical-solution-route-contract.test.ts          | 108                   | 1      |
| apps/api/test/website-lead-ingest-route-contract.test.ts         | 23                    | 1      |
| apps/api/test/workflow-definition-route-contract.test.ts         | 107                   | 1      |
| apps/api/test/workflow-runtime-route-contract.test.ts            | 112                   | 1      |

证明日志：`/tmp/kingturf-batch4-s3-oracle-proof-2026-10-17.json`（仅元数据）。真实负向：临时把helper旧Object.keys断言加一项，完整证明exit1（`/tmp/kingturf-batch4-s3-oracle-mutant-red-2026-10-17.log`），恢复后122文件/68-81证明0，变异不入库。API定向4文件70检查绿，config29绿；首次格式检查错误地显式传.env.example触发无parser exit2，排除该不支持格式后0，未改.env原内容。本工具/期望独立提交后，实际干净HEAD完整CI与最终完成docs HEAD复验另行记录；此表不是生产/浏览器策略生效证明。回滚该期望提交须与762e393 CSP行为配套，保S1/S2原链。
