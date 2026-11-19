# A1 审计：SQL/DataScope 仓储层 — 2026-11-19

基准：OWASP ASVS V5（注入）/V4.3（对象级访问控制一致性）/V7（审计）。方法：全量通读 scope-sql.ts/audit-outbox.ts/24 个仓储，逐调用点核对参数偏移，实测边界行为。

## 结论：无 P0；注入防护达行业水准之上（零字符串值拼接，动态片段全部封闭字面量/DB ENUM，ASVS V5.3.4 满足且可证）

## 台账复核（两项过期）

| 台账项           | 登记状态  | 实际                                                    | 处置     |
| ---------------- | --------- | ------------------------------------------------------- | -------- |
| TD-SEC-008       | P1 待人裁 | 已修复（f7397a4 2026-10-26，锚点经 organizations 校验） | **关闭** |
| TD-RISK-001      | P2 未修复 | 已修复（cc6905e，动态偏移推导；30+ 调用点复核对齐）     | **关闭** |
| TD-SEC-006       | P2 待决策 | **仍开放**（见 P1-1）                                   | 确认     |
| TD-SEC-007       | P2 待决策 | **仍开放**（见 P2-1）                                   | 确认     |
| TD-BOUND-003/004 | 待核实    | 实测确证开放（P3-1/2）                                  | 确认     |
| TD-PERF-002      | 已判定    | 七处逐行写循环仍在（P3-3）                              | 确认     |

## 发现

- **P1-1**：complaint/dashboard 用 `relationshipOnly` 锚点分支（scope-sql.ts:206 vs :207），TEAM 无 `depth<=1`——同租户横向越读至锚点全子树。修复：补 depth 或切缺省分支+10 个对拍更新，0.5-1 天（行为变更需批准）。
- **P2-1**：通知收件人 `actorOrganizationValidation:'skip'`（notification-repositories.ts:42）省略 actor_org/authorized_org 两 JOIN——组织失效后授权滞留。修复：改 validate+负例，0.5 天。
- **P2-2**：四处写路径业务写与审计非同事务（business-document updateBindings:230-257；commercial createCostMatrix/addFactor/updateFactor:286-447）。修复：套 db.transaction 模式，0.5 天，低风险。
- **P2-3**：谓词形状跨域矩阵（员工 validate/通知 skip/complaint relationshipOnly/CRM typed+无主池）——同 scope 四种形状。短期 ARCHITECTURE 增域×选项矩阵决策表（0.5 天）；中期收敛 ≤2 形状（2-3 天）。
- **P3-1**：calendarDate 放行 JS 滚动日期（app-values.ts:103-107，实测 2026-02-30 ACCEPT→PG 500）。修复：回验 toISOString 一致，15 分钟。
- **P3-2**：UUID 不归一大小写（app-values.ts:140），batch 去重可绕（影响有界：expectedVersion 拒第二项；幂等键分裂）。修复：uuid() toLowerCase，15 分钟。
- **P3-3**：N+1 七处（通知/采购三处/BOM/质检/成本报价/收债），全部事务内，纯性能。随 U3 波次清偿。
- **P3-4**：无 RLS——纵深靠复合租户 FK（0010）+租户触发器+CHECK 围栏。登记 ADR 决策：短期文档化理由，中期对 4 张高价值表评估 RLS。
- **P3-5**：qtc `replaceAll('c.','cu.')` 别名改写脆弱；dataScopeSql 简单变体无生产调用方（建议降级测试工具）；dashboard 空结果合成兜底注意审计语义。

## 五个专项核查（全过）

①参数化完整性含动态白名单（无绕过）②谓词一致性（见 P1-1/P2-1/P2-3）③事务边界（总体优秀，仅 P2-2 四处例外；attachment 跨存储 saga 正确）④outbox 双写覆盖（缺口仅 P2-2）⑤迁移安全配置（69 索引/47 触发器构成 DB 不变量层，超典型基线；无 RLS 见 P3-4）。

## 资产判定（保留并推广）

谓词单点收敛（4 出口+11 对拍）、注入纪律、outbox 工程（SKIP LOCKED+lease+claim 围栏双保险）、幂等与乐观并发（canonical_hash+advisory lock+expectedVersion）、website-lead HMAC 入口、order-360 逐源授权。
