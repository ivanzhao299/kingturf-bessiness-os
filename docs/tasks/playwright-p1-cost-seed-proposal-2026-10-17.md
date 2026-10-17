# P1关单实际成本种子最小待裁方案（2026-10-17，仅文档）

## 事实与授权边界

TD-TEST-011：完整原seed完成生产后直接关单，实际500/P0001/require_approved_cost_before_close；0048迁移:62–67要求APPROVED cost run，50–57不许计算者自批。`apps/api/test/production-postgres.integration.test.ts:224–286`现有顺序为COMPLETED→createPolicy→calculate→异人approve→CLOSED。seed:1165–1174有关单却无policy/run/approve步骤，不能靠改认证URL或环境变量满足。

本方案**未获实施授权、未写seed业务步骤、未跑验证**。仅为人类审查具体最小增量，不重开已批准的三份会话请求/oracle、回环通道、机器URL；当前仍C7停后继A/B。实施如获准只限本地guard owned随机schema的演示准备，不触生产/业务源码/SQL/迁移/触发器/PW配置/断言。

## 候选插入点与流程

在原 `if (productionOrder.state === 'COMPLETED')` 关单请求之前插入一段准备；原close请求及其reason/evidence/idempotencyKey、后续return demo与所有P1/其他业务断言原样保留。

1. 用原admin身份读取并复用稳定sourceReference的policy；不存在才POST `/api/v1/production-cost-policies`。版本、币种、费率和两条BOM主组件绑定必须一致；同稳定标识但参数冲突立即停，不自动覆盖/递增版本掩盖冲突。
2. 读取该同tenant/order的cost run，已有APPROVED直接复用；没有才由原admin POST `/api/v1/production-cost-runs`计算。该步骤只能在实际COMPLETED状态执行，不改状态欺骗。已有CALCULATED进入下一步；已有REJECTED/绑定到其它policy或意外重复状态停报，不自动删除重算/改SQL。
3. 使用**现有不同employee的approver**身份 POST `/api/v1/production-cost-runs/:id/approve`；原admin只算不批。审批应带固定测试reason、结构化evidence和稳定idempotencyKey，随后GET确认APPROVED；重复执行复用批准结果，不重复事件。`manufacturing-cost:policy/read/calculate`与`manufacturing-cost:approve/read`分别按既有API要求核验，身份均为本轮合成，不新增生产账号/放宽职责分离。
4. 继续原close，不绕trigger/直接INSERT批准状态或跳过关单。复用API原幂等，不把单次seed成功当幂等已证；须同一owned schema重复执行，确认policy/run/event无重复与原断言保持。

## 具体候选测试费率与稳定标识（均非真实业务定价）

以下是待批准的合成数据，沿seed现有KT-P1/WO-KT编号风格；不读取生产/UAT记录，也不把它们写成既有seed已包含的费率。

| 字段                                                               | 候选值/依据                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| policy                                                             | version=1、currency=CNY、effectiveFrom=2026-01-01，不设effectiveTo；sourceReference=`KT-P1-ACTUAL-COST-V1`，日期沿seed已发布BOM/工艺有效期                                                                                       |
| laborRatePerHour / machineRatePerHour / overheadRatePerMachineHour | `60` / `120` / `30`，复用现有本地production PG测试:235–237的合成费率；不是本seed原有费率，也不是生产定价                                                                                                                         |
| yarn material                                                      | 当前seed已发布`yarn.id`（SKU RM-KT-YARN-12000）、unitCost=`12.5`/KG（seed:800/822供应商报价/采购价），sourceReference=`RM-KT-YARN-12000-P1-RATE-V1`                                                                              |
| backing material                                                   | 当前seed已发布`backing.id`（SKU RM-KT-BACKING-PP）、unitCost=`5`/M2，sourceReference=`RM-KT-BACKING-PP-P1-RATE-V1`；**新增合成候选值**，原seed无backing单价；数值借本地PG测试材料标准成本5作最小测试默认，绝不声称同物料既有报价 |
| BOM覆盖                                                            | 必须覆盖seed:680–686已发布BOM两个主组件yarn/backing；替代草纱不冒作主料，新要求若需其费率另停报，不改BOM或补0价绕missing-rates guard                                                                                             |
| run / calculation key                                              | runNumber=`COST-WO-KT-2026-001`、body idempotencyKey=`WO-KT-2026-001-COST-CALC`，绑定原productionOrder.id和选定policy.id                                                                                                         |
| approval                                                           | 原不同身份approver，body idempotencyKey=`WO-KT-2026-001-COST-APPROVE`，reason为“P1本地演示实际成本独立审核”，evidence只含固定测试标签/本轮run引用，不放认证材料                                                                  |

接口形状事实来自`production-cost-policy.ts:43–105`、`production-cost-calculation.ts:37–80`、`production-cost-decisions.ts:46–90`；policy materialRates非空且主BOM必须有完整费率，run唯一同tenant/order/编号/idempotency（0048:13–28），不是所有API都有通用幂等header，须沿各自原合同处理。

## 假设、验收与停止条件

**未实跑假设**：两主料费率和上述本地费率可满足既有核算前置，现有两身份在owned fixture中有对应权限；新增成本记录不会改变被冻结的P1非成本业务投影。现有PG测试只证明它自己的材料/工单场景，不证明本P1全链或重复执行可行。

如获准：先独立业务seed范围登记/R7与一小步提交，只加上述准备、原close与其它字节/断言保持；真实扰动绑定（缺主料费率/算者自批等）必须失败，恢复后原完整seed及重复执行绿。仍用guard/host marker/同实例容器只读检查、合成身份与安全日志、Owned精确清理，API/Web完整门禁与最后稳定干净HEAD全CI。不得为绿绕trigger、直接写approved、改SQL/业务源码/固定断言；新业务语义或其它seed阻断C7停报。

之后才能沿已授A8→B2逐spec/逐文件变异及全部绿后的第二轮；C不跑、三次终验/覆盖率/一般阶段5未授权。本文不构成该实施已发生或整体Harness已完成。
