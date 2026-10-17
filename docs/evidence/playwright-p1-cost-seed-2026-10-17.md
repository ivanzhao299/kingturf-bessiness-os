# P1 本地成本种子最小补齐证据（2026-10-17）

## 范围与不变量

基线 `bea9a76`；[人类增量R7](../tasks/playwright-p1-cost-seed-authorization-2026-10-17.md)批准[具体费率/标识方案](../tasks/playwright-p1-cost-seed-proposal-2026-10-17.md)。仅在原close之前新增 `ensureP1ActualCost`：本地HTTP回环、既有admin创建/核对政策并计算、既有另一employee approver批准，GET重读确认后继续原close。政策CNY/version1/2026-01-01，小时费率60/120/30，主BOM yarn12.5/backing5；固定sourceReference/runNumber/幂等键与提案一致。已有政策和运行记录严格核绑定/参数/状态，冲突停，不覆写/删除重算。CLOSED重跑仅核对既有已批准记录。

实际字节逆检查：从工作文件移除新增注释/helper/调用块，与 `bea9a76:scripts/seed_p1_demo.mjs` 完整相等（onlyApprovedPreparationInserted=true、originalCloseAndAllOtherBytesIdentical=true）。原close及所有其它业务步骤/断言零改；无产品源码、SQL、触发器、迁移、两份PW配置或spec改变。

费率的Number比较只用于这些已批简单合成数值，不声称通用精确金额验证。seed自己的回环断言不是数据库安全证明；下列验证均经原host guard/随机owned schema/宿主marker→容器READ ONLY同database/schema/instance/marker核证后才初始化和执行，见[通道证据](playwright-docker-loopback-2026-10-17.md)。机密仅内存env/stdin，不输出密码/token/proof/Cookie/DSN/SQL参数。

## 真实完整种子、变异与还原

统一入口：`NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs seed-repeat`；变异红用seed-full。preflight增加重复模式，完整原seed同schema连续两次；每次从PG只读核固定政策/运行/事件/订单计数，而不是假装重复POST即幂等。

| 实际运行              | 结果（日志均在/tmp/，前缀kingturf-docker-cost-seed-，后缀-2026-10-17.log）                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| first-repeat          | host0/8151ms；完整seed两次0/2919ms、0/843ms                                                                                  |
| missing-rate-red      | 真实源只删除backing主料费率；POST production-cost-runs500，seed1/2739ms、host1/7257ms                                        |
| rate-restored         | 立即还原费率；host0/8516ms，两次seed0/2924ms、0/785ms                                                                        |
| self-approval-red     | 真实源只把新增成本approve的approver换为admin；POST production-cost-runs/:synthetic-id/approve500，seed1/3316ms、host1/8801ms |
| final-restored-repeat | 立即还原异人；host0/8719ms，两次seed0/3109ms、0/810ms                                                                        |

每次绿色的两遍计数完全相同：policies1、rates2、runs1、events2（CALCULATED1/APPROVED1）、审批人与计算人不同true、原订单CLOSED1。每次包括红色均owned-cleanup schemaGone/containerGone/previewGone=true；变异未入库。红色外层验证器按实际child/host为1返回0，不把真实失败写成工具绿；保留HTTP500史，不声称本轮从未失败。

这证明隔离本地顺序重复，不证明并发、崩溃恢复或真实业务金额正确。计数不能单独证明跨记录绑定，须与seed的API GET字段绑定断言合看。

独立只读复核未发现阻断：API字段/GET snake_case、政策材料绑定与0048 BOM覆盖/算批分离/关闭约束一致；原close及后续diff零改。复核不执行测试/PG/构建，无外部写入。

## 状态、回滚与后继

TD-TEST-011最小本地种子前置已实施并定向验证；台账仍51项，历史生产关单500保留于[原失败证据](playwright-docker-seed-auth-2026-10-17.md)。本证据不是A8/B2逐spec补跑，不抵原延期义务，不是S4整批人工验收或一般阶段5完成。C2生产spec从未执行/修改。

本小步独立提交，父 `bea9a76` 为回滚点；代码/环境计数工具与本文/索引/进度一起回滚，先核相邻依赖，不执行未经确认的revert。定向验证如上；提交后同一稳定干净HEAD完整 `pnpm ci:local` 实际执行，结果另据日志记录，未预填绿。之后续既授fixture/会话oracle逐文件真变异、A8逐个→B2逐个，全部绿后同配置第二轮；未知非S4问题C7停报，配置/业务断言/SQL/生产保护保持。
