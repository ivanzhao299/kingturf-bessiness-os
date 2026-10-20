# 终验 D：隔离 PostgreSQL 影响核验（2026-10-20）

授权：[终验R7](../tasks/harness-final-acceptance-authorization-2026-10-20.md)。仅owned合成schema内数据/测试，不改产品SQL、helper、权限或期待，不访问生产。新增 `apps/api/test/harness-final-decision-postgres.integration.test.ts`；复用guarded ownedPostgres，每例finally完整关闭/drop后再用独立连接参数化查pg_namespace确认不存在。主执行者唯一PG执行者，B完整CI已结束后才开始，无PG/浏览器并发。

API探针走真实buildApp.dispatch与真实仓储/PG，但**注入固定合成AuthorizationContext，不运行真实认证、HTTP网络或浏览器**，固定非秘密Bearer仅满足载体形状；未创建或导出认证材料。SEC两项直接仓储/SQL层，对生产HTTP可达性/真实授权分布/可利用性不作结论。

## 实际命令与失败史

`NODE_ENV=test pnpm --filter @kingturf/api exec vitest run test/harness-final-decision-postgres.integration.test.ts`，连接由guard回环测试库私有环境传入、不打印：

- 首次实际exit1/null/12880ms，2过2败；BOUND004/SEC006在新合成夹具空initial_snapshot被既有0055非空约束阻断，尚未抵达目标分支。日志 `/tmp/kingturf-final-d-probes-2026-10-20.log`。不是产品新回归，不算目标负例证据。
- 仅把本次新夹具快照改为非空合成source对象，生产/既有测试/所有目标断言保持；后继实际exit0/null/13197ms，4/4过，Vitest11180ms。日志 `/tmp/kingturf-final-d-probes-valid-fixture-2026-10-20.log`。每例独立schema清理断言已实际执行。
- strict ESLint与API typecheck实际0。独立只读审先指出相同空快照阻塞，最终对照源码/两份日志无必要阻断；明确“未写”只限所查factor及审计，BOUND004不重复只限投诉event/所查audit/batch，未直接计数outbox，不称全部事件流无写。实际HEAD完整CI后补，不拿定向四项替代全回归。

## 已证影响与未证范围

| 项目              | 实际验证                                                                                                                                                                                                                             | 不得外推                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| BOUND003          | 合法2月28日POST201；2月30日POST/PATCH均500；同参数直接repo PG22008；最终仅合法因子且原日期未变，factor-added审计1                                                                                                                    | 不是PG成功存入非法日期；其它helper调用点尚未逐条实跑                 |
| BOUND004          | 同逻辑UUID大小写双行进入真实批次，200/1成功1conflict；状态TRIAGED/sequence2、事件2（含原初始1）；exact replay相同结果，无重复事件/审计；同key反转大小写顺序409，全大写重复输入400；batch行1/triaged与batch审计各1，派生key绑定原小写 | 不证明数据损坏或权限扩大；新的规范化会影响canonical/replay，不能顺修 |
| SEC006 / 新SEC008 | COMPANY空anchor下complaint list/get及dashboard正控成功；匹配TEAM显式anchor下两域真实SQLSTATE42703；COMPANY+TEAM同anchor也42703                                                                                                       | 属缺列可用性错误，不是“TEAM已越权”；未跑生产/真实HTTP身份            |
| SEC007            | 有效actor组织时skip/validate均1；员工仍active而其TEAM组织inactive时1/0，直接通知repo创建成功；员工inactive两者0，恢复组织后1/1                                                                                                       | 只证明仓储谓词层差异，不能宣称真实认证/HTTP已可利用，外层仍可能拦截  |

SEC006旧语义债P2与新缺列可用性债区分登记：后者TD-SEC-008/P1待人类行为决策，产品不改；Dashboard同形态不可遗漏。触发条件以代码为准：anchor.organizationId truthy且scopes.includes(anchor.scope)，不机械限定TEAM类；TEAM只是本次实测样本。TRUE OR EXISTS仍解析列，不能用宽scope短路推断无错。

后继分别形成一页决策卡（至少两选项/建议/所需授权/空的人类决定），无预填批准。当前无业务修复或生产安全结论；原BOUND003/004及SEC006/007保留开放，已证/未证范围按本记录更新。
