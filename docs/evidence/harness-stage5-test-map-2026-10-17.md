# 阶段5现状测试地图与补齐清单

## 后继实际补测：风险专项PG/共享商业图及新发现

父d51f074后新增独立`risk-postgres.integration.test.ts`与可复用`fixtures/owned-commercial-graph.ts`。每例owned helper先guard/随机schema-only迁移，再同schema,public新pool以用原扩展函数；真实AuthService/SecurityStore/PG grants及两同tenant合成身份，复用原releasedOrderFixture经生产buildApp.dispatch建图。认证材料仅内存，不返回/打印，不记录原始API响应，身份初始化错误固定化；新pool先关，再owned db/drop/admin，setup失败聚合清理。独立安全只读review无必要阻断。准确称“真实PG+进程内dispatch”，不是HTTP网络/浏览器/Cookie/代理验证；共享fixture名不充显式release路径或订单状态证据。

图中有原风险/佣金等记录，专项用独立code/key/correlation及前后差量，不伪称空表。原图创建客户无owner，补建数在**新helper**图完成后按真实version经正常ownership授权路由分配builder，同时形成assignment/history，不直接SQL伪造owner；原fixture/seed/生产源码不改。真实TEAM来自owned组织，同tenant reviewer用于SELF不可见反例。

六项：policy版本/发布/生效日唯一冲突/不可变及audit-only精确action/id；固定quote margin2631、AR950000−100000=850000，低毛利45+逾期60封顶100/CRITICAL、五trace与自动任务；宽限下LOW0无任务；既有key回放持久行并无新写（现有不同input先replay的语义保持，不虚构hash冲突）；无效refs/外租户原子无新增；任务assignee边界、ack/escalate/close序1–4、空关闭证据先于replay校验与闭态拒绝；窄scope评价现有绑定缺陷。policy只有audit、evaluate/task当前无audit/outbox写入口，不发明配对。

实际历史：新helper初tsc object→Record不兼容，在非null/非array检查后窄类型桥修正，原lint/tsc0。首guard0/单例smoke1过4skip、exit0/5727ms，不充全文件绿。首次完整六项4过2败/exit1/null/20371ms：SELF list客户未分配owner、错误把无锚TEAM也断08P01。等close后上述正常ownership补建数，SELF/实际TEAM锚点断08P01，空TEAM独立not_found；第二轮6/6、exit0/null/20245ms。再补list真实TEAM正例/无scope与reviewer SELF不可见后，最终6/6、exit0/null/20363ms（测试18550ms），start/result证明实际乱序。日志`/tmp/kingturf-stage5-risk-pg-{smoke,first,second,final}-2026-10-17.log`。独立review已核两处测试准备修正准确且不绕授权。两次patch因prettier锚点不精确原子未写，定位实际行后重施；无生产改动。

新TD-RISK-001真实确证：evaluate有四固定参数，但recordScopeSql从3拼scope，SELF/实际TEAM锚追加值与SQL占位错位，PG08P01；无锚TEAM正常not_found。该例明确现状缺陷/无写回滚，不称期望授权语义或功能正确，不顺修SQL。台账60=原58+PROC/RISK两项，F须纳入。list offset2正确、真实归属后SELF/TEAM可读，与evaluate故障区分。未覆盖每种风险severity/临期信用分支、并发与全部anchor矩阵；LOW0宽限用例适用于当前2026验收时点及固定既有图，不泛称跨任意时钟环境。TEST003此时制造/MRP/采购/风险4/6，佣金/驾驶舱及最终覆盖率/CI待。

## TEST005：共享类型策略实施（非最终验收）

父7c50c30后保留原DATA_SCOPES长度6运行时断言，并补独立固定六值/顺序；新增`packages/types/src/contracts.test.ts`4项类型合同。选择已有Vitest expectTypeOf正向类型等价/包含及tsc检查的@ts-expect-error反例，不引tsd/其它依赖、不豁免包、不改生产types。覆盖闭合DataScope/error code、PermissionKey冒号形状、Page必填nextCursor及只读数组/字段、Customer360固定unavailable tuple、Money字符串金额、递归JSON排除函数/undefined、RuleExpression判别分支/必填左右操作数。故意无效代码放不调用的函数中，仅检查其类型，不执行无效值。

执行链明确：包tsconfig include src/**/\*.ts，现有`typecheck=tsc --noEmit`；根`pnpm typecheck=pnpm -r typecheck`且ci:local原顺序先typecheck后test:coverage。Vitest普通转译/5项运行绿**不单独证明类型合同\*\*，必须连同原tsc0。首版lint2处（对不存在push的unsafe call、payload只作typeof使用）改为只读数组不可赋给可变数组的静态反例、expectTypeOf传值，原规则不变。最终原lint/tsc/5项/format均0。

负例绑定实测：只把测试中Money.amount的42暂改成合法字符串'42'，保留该行@ts-expect-error，真实`pnpm --filter @kingturf/types typecheck` exit2/TS2578 unused directive，日志`/tmp/kingturf-stage5-types-negative-sentinel-red-2026-10-17.log`。等真实close后apply_patch还原42，再原lint/tsc/两文件5项全0（278ms）/format0。这里只是测试负例哨兵自检，不计线C生产实现注入，也未修改生产模型。

纠正旧发现口径：types不是纯类型零运行时包，实际有DATA_SCOPES/FOUNDATION_CAPABILITIES/FOUNDATION_LIMITS/CRM_CAPABILITIES/COMMERCIAL_CAPABILITIES五个runtime导出；不删真实常量测试、不以纯类型排除其覆盖率。当前策略是DTO类型合同+真实运行时常量断言；不称覆盖全部DTO，不把编译readonly当运行时freeze、冒号形状当授权成功、Decimal=string当运行时decimal语法校验。TEST005实施待阶段5终验，原基线/三目标不改。

## 后继实际补测：采购/库存专项PG及新发现

父e1174d3后新增独立`procurement-postgres.integration.test.ts`，每例复用owned helper新schema、真实迁移/两租户/制造发布料→供应商→有效资格→RFQ发行→报价→采购单发行→收货地点，不mock数据库、不改生产实现。8项覆盖固定10件/2.5单价、收货及QUARANTINE lot/库存账四表、全部七list实际DTO、所有命令COMPANY/GROUP前置拒绝与租户隔离、资格版本/有效期/空发行单/唯一冲突、超收/未知行/地点及后续重复lot造成的整体回滚、六类库存移动正负方向及负余额/错物料/来源唯一/不可变、部分4→最终6收完、发行outbox后置唯一冲突回滚DRAFT/audit，以及TD-PROC-001现状缺陷与原子性刻画。创建/发行/报价/收货的事件类型、aggregate_type/id/version与audit精确绑定；无幂等参数，唯一冲突不充幂等成功。

真实guard0；首7项全绿/exit0/null/23057ms（测试20543ms），新增缺陷原子性第8项及move scope拒绝后全8绿/exit0/null/20743ms（测试19500ms）。日志`/tmp/kingturf-stage5-procurement-pg-first-2026-10-17.log`、`/tmp/kingturf-stage5-procurement-pg-final-2026-10-17.log`。均显式shuffle.tests/seed20261017，后次只读reporter逐例start/result证明实际执行乱序，不改原Vitest配置。原lint/tsc/format0。独立只读review无必要阻断，指出原company-only标题过窄，已修为COMPANY或GROUP并补同tenant GROUP写入成功/另一tenant仍不可见与成对证据；最终8/8、exit0/null/21242ms（测试20070ms），日志`/tmp/kingturf-stage5-procurement-pg-scopes-final-2026-10-17.log`。

新TD-PROC-001：首笔4后再收2仍有余额，receive会无条件写PARTIALLY_RECEIVED，而0038禁止该同态更新，真实P0001 `partially received purchase order has invalid transition`。该例明确注释为缺陷现状/回滚刻画，不是期望产品语义；失败后receipt/line/lot/movement各仍1、库存仍4、PO仍partial且该correlation audit/outbox0；最后余量6仍可收齐。仅登记，不顺修SQL/触发器/产品或绕过仓储。台账原58项基线另增第59项，F必须纳入；测试绿不关闭该债。

边界：此处通用move在QUARANTINE lot验证台账方向/余额，不等于生产ISSUE已通过质量放行；生产交易0044另要求RELEASED+BOM，质量检查闭环未纳入本专项。采购quote关联未扩成全RFQ/PO匹配校验、资格有效期不冒称lot日期边界，多并发收货等仍非穷举。TEST003目前制造/MRP/采购3/6，佣金/风险/驾驶舱专项、覆盖率三目标与最终CI仍欠。一次doc patch因表格旧行不精确而原子未写，定位实际行后重施，无源码改动。

## 后继实际补测：MRP专项PG

父31f694e后新增独立`apps/api/test/mrp-postgres.integration.test.ts`，复用guarded owned helper，真实迁移和仓储，不改生产实现。每例beforeEach新随机schema、完整重建两租户/发布BOM/策略/需求/初始run，afterEach逆序close/drop，不依赖it顺序或前例遗留数据。8项覆盖：固定BOM需求10×2×1.05=21、原料安全库存5使净需求26/倍量取整30，成品10；两提案/日期/初始流水和policy/demand/run的audit+outbox精确聚合绑定；公司/GROUP租户隔离、SELF/TEAM-only拒绝；未发布/外租户版本与唯一约束；同输入hash但独立run（不冒称幂等）；冻结批准证据/连续事件/闭态/已取消run拒新决策；computed子证据不可变；outbox冲突发生在audit后，事件与audit一并回滚；真实循环图及空horizon失败时run/snapshot/calculation/proposal/event计数不变。

首跑guard0，但outbox人工collision seed漏event_version/occurred_at，在真正transition前23502失败，实际6过1败/exit1/null/4535ms；只补固定1/now()，并新增非法事件专项后8/8、exit0/null/4220ms。独立审查指出共享图/全表计数顺序依赖，改每例独立schema，原lint/tsc/format0；真实`--sequence.shuffle --sequence.seed=20261017`全8过，exit0/null/21729ms（测试20586ms），日志`/tmp/kingturf-stage5-mrp-pg-isolated-shuffle-2026-10-17.log`。旧失败日志`/tmp/kingturf-stage5-mrp-pg-first-2026-10-17.log`保留，不以默认顺序绿掩盖问题。后继独立只读复核确认必填列和隔离均已修复，无必要阻断。

口径：source_type明确TEST_ALGORITHM/source_id合成UUID，不伪称真实订单FK链；on_hand/scheduled_receipts均0、单日期需求桶，非零库存/采购净额、隔离库存排除、多桶累计等仍是后续覆盖缺口，不称MRP全矩阵。该域只允许COMPANY/GROUP，未用recordScopeSql、无幂等参数，不发明SELF成功路径或把单号唯一当幂等。TEST003此时2/6域已补专项，其余四域/最终覆盖率/三连CI待。

乱序执行另作真实观察：显式`--sequence.shuffle.tests --sequence.seed=20261017`，JSON reporter运行8/8/exit0/21461ms，但该版本JSON无每例startTime（首次提前读取报告还出现ENOENT，非测试失败），不能从声明顺序渲染推断执行次序。随后仅增加本地只读reporter的onTestCaseReady/Result事件，不改测试/配置/产品，再真实8/8、exit0/null/21406ms；实际开始顺序可见计算→outbox回滚→scope→重复run（明显非声明顺序）。日志`/tmp/kingturf-stage5-mrp-pg-isolated-shuffle-order-2026-10-17.log`，本地reporter`/tmp/kingturf-stage5-mrp-order-reporter-2026-10-17.mjs`只输出用例名/时间/状态，不读认证材料。每例独立schema证明不只依赖默认顺序绿。

## C三类实现注入证据齐备（非最终CI）

7f8ffb7后完成第三个Web真实实现注入：`shared/api-response-parser.ts:24`临时允许缺nextCursor，而不改原测试/合成样本。diff：

```diff
- if (record.nextCursor !== null && typeof record.nextCursor !== 'string')
+ if (record.nextCursor !== undefined && record.nextCursor !== null && typeof record.nextCursor !== 'string')
```

指定原`boundary-parsers.test.ts`实际exit1：`rejects missing or malformed cursor metadata 1`（items=[]缺nextCursor）expected function to throw，1败86过/375ms。日志`/tmp/kingturf-stage5-c-web-cursor-red-2026-10-17.log`；等close后apply_patch完整还原原条件，原Web全14文件313项实际exit0/1780ms，日志`/tmp/kingturf-stage5-c-web-cursor-restored-2026-10-17.log`。该文件原/恢复SHA256均`ea8f526d982ecaa1fae4fadda15dbd4cf798c5be1d9302f3c641330da122c907`、源码diff0；全377源清单hash再次与B一致。

因此C最低三例现有：domain字段权限安全真红→原20绿；制造真实PG tenant SQL真红→还原原5绿/补强6绿；Web游标严格边界真红→原313绿。三次均临改真实生产实现、保持原测试期待、等待实际结束才还原，diff/具名失败/恢复SHA在本文；不是字典/注释/测试注入。该证据不替代A其余五域PG、覆盖率三目标、最终同状态三连CI或浏览器全套验收。

## 后继实际补测：manufacturing专项PG与C SQL注入

6095937后新增独立`manufacturing-postgres.integration.test.ts`和可复用guarded随机schema helper；真实调用制造仓储，不mock DB、不改生产实现。6项覆盖：安全schema名/精确search_path、成品及原料/替代料发布版本、BOM替代料排序及routing工序排序、创建/发布的audit+outbox事件/aggregate精确绑定、COMPANY/GROUP租户边界与SELF/TEAM-only拒绝、跨租户component FK23503/重复替代priority23505后父/版本/line/substitute/证据整体回滚、未发布替代料及空routing发布失败、outbox唯一冲突发生在audit写入之后而publication/audit一并回滚。无update/delete或幂等接口，不把单号unique当幂等；该域未用recordScopeSql，不虚构SELF成功路径。

真实运行历史：初版guard0/PG5项0/4686ms；helper上下文最初被TS推窄为COMPANY tuple导致typecheck失败，显式使用仓储Context类型后原tsc/lint0。产品fixture随后改显式FINISHED_GOOD，5项0/4017ms。独立只读review后补错误码、子表计数及两处失败原子性对称断言，5项0/4164ms；共享helper限制prefix≤30（加UUID后≤63），迁移前核current_schema精确相同，guard解析错误固定化不输出URL，新增第6项。最终原lint/tsc/format0、真实PG6/6、exit0/null/3552ms；日志`/tmp/kingturf-stage5-manufacturing-pg-final-2026-10-17.log`。schema/db/admin按逆序收尾；不泛称所有底层PG错误均已脱敏或做了独立实例探针。

精确语义保留：0036:71–75要求产品已发布、**至少一条**主料已发布，并拒绝任何未发布替代料，不把它写成所有主料必须发布。新测试验证当前明确约束，不顺修其余行为。其它五域专项仍待，不把此一域关闭TEST003全项。

C PG真实实施注入：仅items SELECT的tenant谓词临改，保留参数绑定，不是修改测试/fixture：

```diff
- WHERE v.tenant_id=$1
+ WHERE $1::uuid IS NOT NULL
```

指定制造PG全文件实际exit1/null/4134ms，`enforces company scope and keeps GROUP queries inside actor tenant`在FOREIGN-1不可见断言真红，1败4过；等close后apply_patch还原原SQL，再同5项实际exit0/null/3938ms。日志`/tmp/kingturf-stage5-c-pg-tenant-red-2026-10-17.log`和`/tmp/kingturf-stage5-c-pg-tenant-restored-2026-10-17.log`。原/恢复SHA256均`63f068d084ce830495b249875c37e4e9b8fba00ef9df7582f8cad73829be217a`，生产源码diff0；随后补强为最终6项仍绿。C目前仅安全+PG两项，Web第三项/最终CI待。

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

| 业务域                                    | mock/单元契约入口                                                                                                  | 真实PG路径与缺口                                                                                              | Web/CDP边界                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 组织/员工/通用仓储                        | repositories、scope-sql、app                                                                                       | postgres.integration；组织/员工/隔离已有执行                                                                  | 共享/bootstrap；治理CDP历史                                            |
| auth/IAM/会话                             | auth-route、authorization-routes、iam/identity-access、browser-session-api、session-proof、login-rate-limit(-http) | auth-http-postgres、authorization-http-postgres；跨实例撤销已有                                               | browser-session/session/http/login-flow；S4真实Chrome26手动            |
| Foundation事件/通知/附件/对象             | foundation-api、event/helper与notification/attachment/business-object                                              | foundation-postgres；事务证据已有，细分失败矩阵以覆盖首测决定                                                 | 共享；治理CDP历史                                                      |
| CRM/网站线索                              | lead/customer各route-contract、website-lead-ingest、scope-sql-crm                                                  | crm-postgres、website-lead-ingest-postgres、authorization-http-postgres                                       | crm-selection/边界/共享；CRM CDP历史                                   |
| 商业机会/需求/方案/成本矩阵/销售政策/报价 | opportunity/ctr/technical-solution/cost-matrix/quote/commercial各contract                                          | commercial-postgres与授权PG；不是全部价格来源/异常SQL完备证明                                                 | commercial-store/loading/route-data；销售/定价CDP历史                  |
| QTC信用/合同/订单/应收/付款/核销          | qtc-\*与root-capture（335旧护栏）                                                                                  | qtc-postgres、授权PG、released-order-http fixture间接                                                         | 共享；履约/财务CDP历史，PW部分待裁                                     |
| 催收/法务                                 | collection-route-contract                                                                                          | collection-postgres及授权PG                                                                                   | 共享；财务风险CDP历史                                                  |
| 佣金                                      | commission-route-contract、scope-sql-commission                                                                    | released-order-http:192实际accrue、授权PG:507范围读取；缺专项PG重放/事务证据                                  | 共享；财务风险CDP历史                                                  |
| 风险                                      | risk-route-contract、scope-sql-risk                                                                                | 新risk-postgres专项6项真实PG绿，固定评分/状态/租户/回滚；TD-RISK-001只登记不修（详见本文）                    | 共享；财务风险CDP历史                                                  |
| 经营看板                                  | dashboard-route-contract、scope-sql-dashboard                                                                      | 13 PG文件中未找到dashboard实际查询；补专项                                                                    | 共享；财务风险CDP历史                                                  |
| 制造主数据                                | manufacturing-route-contract                                                                                       | 新manufacturing-postgres专项6项真实通过（详见本文后继证据）；production PG旧直接种子仍另计                    | 共享；运营CDP历史                                                      |
| 采购/库存                                 | procurement-route-contract                                                                                         | 新procurement-postgres专项8项真实通过，真实资格/收货/台账/回滚；TD-PROC-001只登记不修（详见本文）             | 共享；运营CDP历史                                                      |
| MRP                                       | mrp-route-contract                                                                                                 | 新mrp-postgres专项8项真实通过；每例独立schema/固定展开净额/状态与失败回滚，非零库存采购及多桶仍欠（详见本文） | 共享；运营CDP历史                                                      |
| 生产执行/实际成本                         | production-_、production-cost-_                                                                                    | production-postgres已在，production-startup PG只验证启动只读；成本政策/计算等专项SQL缺口需补，不再称“零测试”  | 共享；运营CDP历史/P1种子真实路径不抵自动PG                             |
| 质量/不合格/CAPA                          | quality/ncr/capa各route-contract                                                                                   | 质量HTTP合同大量已补，但生产种子或下游查询不等于质量仓储专项；需补核心SQL/事务                                | 共享；运营CDP历史                                                      |
| 发货                                      | shipment-repositories（mock Db）、app                                                                              | 现13 PG中专项未见，生产/P1种子不冒称全矩阵                                                                    | 共享；履约CDP历史                                                      |
| Order360                                  | order-360-route-contract、scope-sql-order-360                                                                      | 授权PG可间接读取；缺专项汇总SQL完整证据，首测与缺口补齐                                                       | 共享；履约CDP历史                                                      |
| 在线业务文档/合同文档/OCR/电子签          | business-document-route-contract固定882、contract-document-api                                                     | 旧“任何层0引用”已过时；仍需确认/补真实仓储版本/发送事务路径                                                   | business-document-content/document-send/共享；编辑器CDP历史，PW文档7过 |
| 平台主数据/号码/规则/审计                 | master/number/rule/audit各contract、scope-sql-platform                                                             | platform-postgres与授权PG；业务规则/号码有实际路径                                                            | 共享；治理CDP历史                                                      |

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

盘点基线当时未找到直接new这六仓储（搜索 `new Postgres(Commission|Dashboard|Manufacturing|Mrp|Procurement|Risk)Repository`），后继现已补制造专项；佣金/风险已有真实HTTP间接路径，不把原否定泛化为零执行。主执行者修改具体test前还须完整读取目标源码/迁移/fixture。

## 补齐队列与其它债务

1. 六域各独立PG文件/提交，复用guard和随机owned schema、串行运行；没有的scope-sql/幂等/outbox仅如实解释。
2. 首测覆盖率后按未覆盖执行路径补业务文档/实际成本/质量/Order360/发货等真实缺口，保原冻结oracle，不能用新增mock数量冒充SQL覆盖。
3. TD-TEST-005选零新包类型断言：保DATA_SCOPES运行时精确值测试，现有Vitest expectTypeOf与tsc编译校验DataScope/Page/ErrorEnvelope代表契约，真实负向扰动证明；未实施不关闭。
4. TD-TEST-007文档提交关键词只命中CTR的旧source测试不删改，另补真实文档动作/receiver/version payload合同。
5. E回归链当前REG001、S2、S4自动API/Web都在pnpm-r-test；SEC003历史严重度P2不改称P1。REG001探针old依赖历史git对象，浅历史缺口仅静态候选，未实测不称CI已失败；后继若修不得静默减少old/current166校准或改workflow。

本地图是可复核的现状/工作清单，不是完成证据；所有缺口完成后逐项追加实际退出/耗时/注入/回滚SHA。

三份首步证据经独立只读review，无必要阻断；377/25文件范围及六域机制已交叉核验，采纳措辞收窄以不把P1历史产品意图外推所有11例因果。文档prettier/doc-lint（177篇）/diff check实际0；真实覆盖率和新增PG尚未运行，不预写B或完成状态。
