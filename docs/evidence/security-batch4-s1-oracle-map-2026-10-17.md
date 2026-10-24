# S1 严格响应头期望逐处变更清单（2026-10-17）

完成补记：独立test提交59f9dfa业务源码不变，实际干净HEAD完整CI真实0/180503.567ms（API118/17114、Web13/266）；首失败及下段“待重跑”为历史时点。源码/证据/部署边界及回滚见[S1完成证据](security-batch4-s1-headers-2026-10-17.md)。

依据：人工批次4测试纪律及D1 S1（TD-SEC-004）授权，旧API无安全三头→统一追加三头。严格整响应比较原本只期望`x-correlation-id`，现在仍严格`toEqual`，但期望另外包含`x-content-type-options: nosniff`、`x-frame-options: SAMEORIGIN`、`referrer-policy: strict-origin-when-cross-origin`。状态、正文、错误顺序、权限、repository调用及请求/会话/签名夹具不改。每行均采用此“旧→新→D1 S1依据”，行号为修改前固定业务提交`b02ad55`的原位置。

第一次完整源码HEAD CI真实退出1/182202.688ms：API65失败文件/6994失败、53通过文件/10120通过，共118/17114；Web266绿。不是业务算法退化或被忽略的失败，失败原因是获批新增响应头与旧严格oracle冲突。日志`/tmp/kingturf-batch4-s1-b02ad55-head-ci-2026-10-17.log`保留，后继独立test提交只同步这些已消失的“仅关联ID头”旧期望，不退回实现/弱化断言。

只读AST与独立reviewer均盘出：74个含statusCode/body/headers的响应期望对象+2个直接头期望，共76处/65文件；另24个同形关联ID请求头节点不改。文本72候选不等于需改72。`scripts/analysis/security-header-oracle-check.mjs`先精确识别这两种上下文并生成补丁，再逐文件移除仅这三新增字面量字段，完整AST与b02ad55旧测试相等；编码器void全遍历并有三类差异自检，不靠只数断言。`--patch`仅输出补丁、不直接写文件，主代理逐一apply_patch；默认模式只读验证并输出清单。

| 旧测试文件（apps/api/test）                        | 修改前行号           | 期望类别                          | 依据               |
| -------------------------------------------------- | -------------------- | --------------------------------- | ------------------ |
| audit-route-contract.test.ts                       | 71                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| auth-route-contract.test.ts                        | 42、57、91、103、123 | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| capa-action-route-contract.test.ts                 | 118                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| capa-create-route-contract.test.ts                 | 92                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| capa-lifecycle-route-contract.test.ts              | 115                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| collection-route-contract.test.ts                  | 91                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| commercial-definition-contract.test.ts             | 167                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| commercial-evaluation-contract.test.ts             | 129                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| commercial-nested-read-contract.test.ts            | 84                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| commercial-view-route-contract.test.ts             | 156                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| complaint-batch-route-contract.test.ts             | 86                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| complaint-create-route-contract.test.ts            | 110                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| complaint-read-route-contract.test.ts              | 65                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| complaint-sla-route-contract.test.ts               | 82                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| complaint-transition-route-contract.test.ts        | 94                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| cost-matrix-base-contract.test.ts                  | 153                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| cost-matrix-calculation-contract.test.ts           | 90                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| cost-matrix-factor-contract.test.ts                | 123                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| ctr-route-contract.test.ts                         | 151                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-360-route-contract.test.ts                | 144                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-activity-route-contract.test.ts           | 92                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-base-route-contract.test.ts               | 75                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-contact-route-contract.test.ts            | 97                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-lifecycle-route-contract.test.ts          | 72                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| customer-ownership-route-contract.test.ts          | 96                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| iam-route-contract.test.ts                         | 58、111、222         | 直接严格headers；严格响应envelope | D1 S1 / TD-SEC-004 |
| identity-access-route-contract.test.ts             | 52、77、172、216     | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| identity-provision-route.test.ts                   | 40、53、79           | 严格响应envelope；直接严格headers | D1 S1 / TD-SEC-004 |
| lead-base-route-contract.test.ts                   | 140                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| lead-claim-route-contract.test.ts                  | 75                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| lead-command-route-contract.test.ts                | 95                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| master-category-route-contract.test.ts             | 108                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| master-entry-route-contract.test.ts                | 119                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| ncr-create-route-contract.test.ts                  | 92                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| ncr-transition-route-contract.test.ts              | 93                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| number-allocation-route-contract.test.ts           | 94                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| number-definition-route-contract.test.ts           | 126                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| opportunity-route-contract.test.ts                 | 73                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-command-route-contract.test.ts          | 92                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-cost-calculation-route-contract.test.ts | 97                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-cost-decision-route-contract.test.ts    | 94                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-cost-policy-route-contract.test.ts      | 118                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-create-route-contract.test.ts           | 109                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-material-route-contract.test.ts         | 104                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-output-route-contract.test.ts           | 110                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-read-route-contract.test.ts             | 114                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| production-report-route-contract.test.ts           | 115                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-ar-post-route-contract.test.ts                 | 136                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-bank-payment-intake-route-contract.test.ts     | 135                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-base-read-route-contract.test.ts               | 93                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-contract-create-route-contract.test.ts         | 129                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-contract-sign-route-contract.test.ts           | 118                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-credit-approval-route-contract.test.ts         | 103                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-credit-write-route-contract.test.ts            | 148                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-operational-read-route-contract.test.ts        | 84                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-reconciliation-run-route-contract.test.ts      | 117                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| qtc-sales-order-create-route-contract.test.ts      | 155                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| quote-command-contract.test.ts                     | 90                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| quote-write-contract.test.ts                       | 119                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| rule-definition-route-contract.test.ts             | 113                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| rule-evaluation-route-contract.test.ts             | 92                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| technical-solution-route-contract.test.ts          | 108                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| website-lead-ingest-route-contract.test.ts         | 23                   | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| workflow-definition-route-contract.test.ts         | 107                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |
| workflow-runtime-route-contract.test.ts            | 112                  | 严格响应envelope                  | D1 S1 / TD-SEC-004 |

修复后的API/web全量、源码后继提交完整CI与最终证据HEAD完整CI将在实际执行后记入后继S1完成证据，不预填绿色。本清单随独立test提交版本化，业务代码维持b02ad55不变；回滚test提交必须与S1新增响应头是否仍存在一并判断，不孤立恢复旧oracle。授权依据见[R7](../tasks/harness-batch4-authorization-2026-10-17.md)。
