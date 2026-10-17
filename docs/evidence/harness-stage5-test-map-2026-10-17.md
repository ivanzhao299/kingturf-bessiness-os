# 阶段5现状测试地图与补齐清单

## 后继实际补测：domain边界与C安全注入

基线a25e4c4后新增`safety-boundaries.test.ts`，原三个文件14项不改，新6项真实调用生产实现，验证业务schema闭集/relationship版本/重复键与UTF-8上限、字段授权默认拒绝、精确版本锁定、有效期/稳定码，以及规则各操作符/缺输入默认拒绝/深度及trace上限。首次20/20绿但新测试原lint有4处机械错误（数字模板2、void表达式2），修为String与独立void调用后原eslint/tsc/20项均实际0，不降规则。

单包原Vitest3.2.6/v8按冻结同一all/include/exclude运行，4文件20项/482ms/exit0，独立报告`coverage/domain-boundaries-a25e4c4-first/coverage-final.json`；复用同行max算法得到629/671（约93.74%，比冻结B_d多133覆盖行，分母不变）。这只是当前工作区单包定向测量，不是新六包B、不覆盖整体/仓储缺口或当前HEAD完整CI，固定B不更新。

C安全注入实做于`packages/domain/src/index.ts`字段权限分支，临时diff如下（非测试数据或字典扰动）：

```diff
 if (grant.fields !== null && requestedFields.some((field) => !grant.fields?.includes(field))) {
-  throw new DomainError('forbidden', 'Field permission denied');
+  return context;
 }
```

指定`vitest run src/safety-boundaries.test.ts`真实exit1：具名`denies missing grants, empty scopes and forbidden fields, never widening a grant`报expected function to throw，1败5过；实际破坏的是未授权email字段被放行。日志`/tmp/kingturf-stage5-c-security-field-permission-red-2026-10-17.log`。等进程close后用apply_patch完整还原，再原包全20项真实exit0、eslint/tsc0，日志`/tmp/kingturf-stage5-c-security-field-permission-restored-2026-10-17.log`。恢复前后源码SHA256均`bae4a67463e8efa52b7e1e34c7b887f1503d2d4202579c435ce9206f997712c7`，`git diff --exit-code -- packages/domain/src/index.ts`真实0；无永久产品改动。本例只计C安全一项，PG/Web两项和最终三连CI仍欠，不把单例充≥3完成。

## 时点与口径

盘点基线28215b0（授权docs，产品仍5230625/4259d96），主执行者加两路独立只读盘点；未以文件名/断言数量推断SQL覆盖率。28215b0完整ci:local真实0/209252ms、首尾HEAD相同/树空，日志 `/tmp/kingturf-stage5-r7-28215b0-ci-2026-10-17.log`。API126/17242、Web14/313为该执行链；后继新增测试另记。此不是线D最终状态三连跑之一。

搜索：`rg --files apps/api/test -g '*test.ts'`，其中13个 `*postgres.integration.test.ts`；`rg -c '\b(it|test)\(' <13文件>` 为88个声明点，不是展开运行数。检查各PG文件真实构造/HTTP服务器及fixtures，mock路由、scope-sql SQL形状单测不当真实PG。Web现14个src根目录测试文件，CDP真Chrome手动证据与自动工具单测分列。

## 当前业务域 × 层次

表内文件均位于apps/api/test，未写PG代表缺少该仓储专项，不能推断从未被其它间接路径调用。Web“共享”指14单测中source合同/控制器/边界/HTTP通用层，不代表逐域真实DOM已跑。CDP列是历史实际证据包，非本阶段重跑/非CI自动。

| 业务域                                    | mock/单元契约入口                                                                                                  | 真实PG路径与缺口                                                                                             | Web/CDP边界                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 组织/员工/通用仓储                        | repositories、scope-sql、app                                                                                       | postgres.integration；组织/员工/隔离已有执行                                                                 | 共享/bootstrap；治理CDP历史                                            |
| auth/IAM/会话                             | auth-route、authorization-routes、iam/identity-access、browser-session-api、session-proof、login-rate-limit(-http) | auth-http-postgres、authorization-http-postgres；跨实例撤销已有                                              | browser-session/session/http/login-flow；S4真实Chrome26手动            |
| Foundation事件/通知/附件/对象             | foundation-api、event/helper与notification/attachment/business-object                                              | foundation-postgres；事务证据已有，细分失败矩阵以覆盖首测决定                                                | 共享；治理CDP历史                                                      |
| CRM/网站线索                              | lead/customer各route-contract、website-lead-ingest、scope-sql-crm                                                  | crm-postgres、website-lead-ingest-postgres、authorization-http-postgres                                      | crm-selection/边界/共享；CRM CDP历史                                   |
| 商业机会/需求/方案/成本矩阵/销售政策/报价 | opportunity/ctr/technical-solution/cost-matrix/quote/commercial各contract                                          | commercial-postgres与授权PG；不是全部价格来源/异常SQL完备证明                                                | commercial-store/loading/route-data；销售/定价CDP历史                  |
| QTC信用/合同/订单/应收/付款/核销          | qtc-\*与root-capture（335旧护栏）                                                                                  | qtc-postgres、授权PG、released-order-http fixture间接                                                        | 共享；履约/财务CDP历史，PW部分待裁                                     |
| 催收/法务                                 | collection-route-contract                                                                                          | collection-postgres及授权PG                                                                                  | 共享；财务风险CDP历史                                                  |
| 佣金                                      | commission-route-contract、scope-sql-commission                                                                    | released-order-http:192实际accrue、授权PG:507范围读取；缺专项PG重放/事务证据                                 | 共享；财务风险CDP历史                                                  |
| 风险                                      | risk-route-contract、scope-sql-risk                                                                                | released-order-http:209真实评估、授权PG:456/507字段/范围；缺专项重放/任务状态SQL                             | 共享；财务风险CDP历史                                                  |
| 经营看板                                  | dashboard-route-contract、scope-sql-dashboard                                                                      | 13 PG文件中未找到dashboard实际查询；补专项                                                                   | 共享；财务风险CDP历史                                                  |
| 制造主数据                                | manufacturing-route-contract                                                                                       | production PG仅直接插入制造种子，不等于制造仓储CRUD；补专项                                                  | 共享；运营CDP历史                                                      |
| 采购/库存                                 | procurement-route-contract                                                                                         | 13 PG文件中按suppliers/rfqs/purchase-orders/goods-receipts/inventory未找到；补专项                           | 共享；运营CDP历史                                                      |
| MRP                                       | mrp-route-contract                                                                                                 | 13 PG文件搜索mrp-/MRP未找到实际仓储调用；补专项                                                              | 共享；运营CDP历史                                                      |
| 生产执行/实际成本                         | production-_、production-cost-_                                                                                    | production-postgres已在，production-startup PG只验证启动只读；成本政策/计算等专项SQL缺口需补，不再称“零测试” | 共享；运营CDP历史/P1种子真实路径不抵自动PG                             |
| 质量/不合格/CAPA                          | quality/ncr/capa各route-contract                                                                                   | 质量HTTP合同大量已补，但生产种子或下游查询不等于质量仓储专项；需补核心SQL/事务                               | 共享；运营CDP历史                                                      |
| 发货                                      | shipment-repositories（mock Db）、app                                                                              | 现13 PG中专项未见，生产/P1种子不冒称全矩阵                                                                   | 共享；履约CDP历史                                                      |
| Order360                                  | order-360-route-contract、scope-sql-order-360                                                                      | 授权PG可间接读取；缺专项汇总SQL完整证据，首测与缺口补齐                                                      | 共享；履约CDP历史                                                      |
| 在线业务文档/合同文档/OCR/电子签          | business-document-route-contract固定882、contract-document-api                                                     | 旧“任何层0引用”已过时；仍需确认/补真实仓储版本/发送事务路径                                                  | business-document-content/document-send/共享；编辑器CDP历史，PW文档7过 |
| 平台主数据/号码/规则/审计                 | master/number/rule/audit各contract、scope-sql-platform                                                             | platform-postgres与授权PG；业务规则/号码有实际路径                                                           | 共享；治理CDP历史                                                      |

历史证据入口：[批次3覆盖分层](frontend-batch3-acceptance-2026-10-17.md)、[S4网络](security-batch4-s4-network-2026-10-17.md)、[浏览器首轮](playwright-docker-spec-replay-2026-10-17.md)。CDP50+29不是79唯一用例，S4的26分Node4/DOM8/协议14；不抵旧PW。

## 六域专项应验证什么（不虚构机制）

| 域            | 实现事实（apps/api/src）                                                                                      | 本阶段PG目标                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| commission    | commission-repositories:216/257/451用recordScopeSql；246/440锁/replay；104/415/527审计+outbox                 | accrue/transition、拒绝越界、重复幂等/冲突、证据落库/失败回滚                                  |
| dashboard     | dashboard-repositories:18 scope-sql进入CTE；纯只读，无幂等命令或审计写                                        | 不同owner/tenant/anchors的真实指标与钻取过滤、金额/时间/币种边界；确认查询不写，不造outbox期待 |
| manufacturing | manufacturing-repositories:15/22公司/GROUP控制，未用recordScopeSql/无幂等接口；item/BOM/routing有audit+outbox | 主数据版本/发布、替代料/工序、租户/权限、FK/事务回滚、真实审计outbox                           |
| mrp           | mrp-repositories:18/43公司/GROUP及tenant过滤；无recordScopeSql/幂等key；87/151/280固定版本证据                | run/需求/计算/提案与转换、跨租户拒绝、失败原子性及证据                                         |
| procurement   | procurement-repositories:15/23公司/GROUP与tenant过滤；无recordScopeSql/幂等key；73/486等固定版本证据          | 供应商资格→询价/报价→订单/收货→库存实际SQL、越界/过量回滚与证据                                |
| risk          | risk-repositories:179/197/386 scope与锁/replay；policy路径audit-only，evaluate/task没有outbox hook            | policy审计、评估/任务重放冲突/状态、范围过滤；无outbox的命令明确不伪造写入期待                 |

六域现测试未找到直接new这六仓储（搜索 `new Postgres(Commission|Dashboard|Manufacturing|Mrp|Procurement|Risk)Repository`），但佣金/风险已有真实HTTP间接路径；不把该否定泛化为零执行。主执行者修改具体test前还须完整读取目标源码/迁移/fixture。

## 补齐队列与其它债务

1. 六域各独立PG文件/提交，复用guard和随机owned schema、串行运行；没有的scope-sql/幂等/outbox仅如实解释。
2. 首测覆盖率后按未覆盖执行路径补业务文档/实际成本/质量/Order360/发货等真实缺口，保原冻结oracle，不能用新增mock数量冒充SQL覆盖。
3. TD-TEST-005选零新包类型断言：保DATA_SCOPES运行时精确值测试，现有Vitest expectTypeOf与tsc编译校验DataScope/Page/ErrorEnvelope代表契约，真实负向扰动证明；未实施不关闭。
4. TD-TEST-007文档提交关键词只命中CTR的旧source测试不删改，另补真实文档动作/receiver/version payload合同。
5. E回归链当前REG001、S2、S4自动API/Web都在pnpm-r-test；SEC003历史严重度P2不改称P1。REG001探针old依赖历史git对象，浅历史缺口仅静态候选，未实测不称CI已失败；后继若修不得静默减少old/current166校准或改workflow。

本地图是可复核的现状/工作清单，不是完成证据；所有缺口完成后逐项追加实际退出/耗时/注入/回滚SHA。

三份首步证据经独立只读review，无必要阻断；377/25文件范围及六域机制已交叉核验，采纳措辞收窄以不把P1历史产品意图外推所有11例因果。文档prettier/doc-lint（177篇）/diff check实际0；真实覆盖率和新增PG尚未运行，不预写B或完成状态。
