# 2e Service 边界护栏与库存

## 授权与结论（2026-10-16）

授权提交 `4aad50a`，验收基线 `9f297de`（2d已人工验收），工程提交/回滚点 `9189818` 已协调及独立复核。本轮仅工程护栏，不迁移业务源码，不修改既有契约测试、仓储、SQL或scope-sql，不修TD-GATE-003、不降低D5。本轮止于业务提取前检查点，**不是2e整批完成或人工验收**。

限定生产API Runtime范围内，当前未找到单HTTP业务入口跨两个不同仓储的候选；因此下一业务提取候选为零。不创建空services目录或单仓转发Service，不将同仓多调用、HTTP校验/投影、组合根装配或仓储内部聚合扩大为迁移目标。

## 可复跑库存与归属

运行 `node scripts/analysis/service-boundary-gate.mjs --inventory` 输出逐组file/line、仓储端口、直接调用表达式及行号。扫描所有 `apps/api/src/**/*.ts`，不按routes目录排除；使用当前API tsconfig与既有TypeScript 5.9.3，无新依赖。

当前源码快照：153个TS文件；26个仓储实现文件及唯一组合根server.ts不作为Runtime入口，余126个Runtime文件；31个ApiDependencies仓储端口、219个静态defineRoute对象模板、130个旧request选择分支；234个含可达仓储调用的静态归属组、234条直接调用记录，单组最多一个仓储。组含helper与调用方，模板/分支不等于规范HTTP入口数，不能相加宣称端点总量。初版218模板/125Runtime的数字已被后续类型解析及精确层路径修正，不作为最终证据。

| 疑似点           | 实际归属与排除依据                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| production-reads | 三factory各注入production或productionCosts之一；不同入口，不是同入口跨仓（源码21–25、27/60/84行）                                             |
| foundation容器   | notifications/attachments/businessObjects/events共用容器，逐defineRoute归属单仓；579行事件完成/失败分支都是events                             |
| customer-360     | 95行路由对象；107行findCustomer及119行customer360均CRM，同仓两次                                                                              |
| lead-commands    | 58行executeLeadCommand的assign/transitionLead分支均CRM；可达helper并入调用入口后仍同仓                                                        |
| opportunities    | 145行PATCH路由的transitionOpportunity/updateOpportunity均commercial                                                                           |
| app内联路由      | shipment从1399行、contract-document从2118行、organization/employee从3032行起分别单仓；旧分支单独归属，不按app全文件累计                       |
| order-360        | routes/order-360.ts调用单个order360.get；多来源SQL聚合在order-360-repositories.ts内，不搬仓储内部职责                                         |
| 认证/装配        | auth.authenticate属于请求框架；server.ts装配不等于HTTP业务编排。organizations/employees/authorization仍纳入31个业务仓储端口，不因身份域而排除 |

只读独立核验对128个非测试/非仓储文件做直接调用检索，与本护栏精确分层口径126不同；该检索未覆盖别名/动态反射，不能代替AST库存。主代理对类型解析后的全部静态归属组及多调用疑点核对，结论限定为下述可机械解析范围。

## 规则

实现为 [service-boundary-gate.mjs](../../scripts/analysis/service-boundary-gate.mjs)，自测为 [service-boundary-gate.test.mjs](../../scripts/analysis/service-boundary-gate.test.mjs)。独立于旧structure-gate，零存量豁免。

- **S1**：services只能依赖真实ApiDependencies端口声明所在的API根层仓储模块、domain端口的具体实现repositories.ts，或packages模块。不是任意名为`*-repositories.ts`的文件。禁止Runtime/HTTP/Node库/未解析模块；import、export/reexport、type-only、import type表达式、dynamic import、require/import-equals均按AST解析，非字面量依赖拒绝。当前不需要service互导，尚不开放此边。
- **S2**：仓储禁止反向依赖services，包含type-only和API/packages转接，遍历TypeScript已解析源码依赖图；仓储相对依赖解析失败即失败，不能静默视为安全。
- **S3**：按ApiDependencies方法签名**声明身份**标注仓储来源，不按import数或方法名猜测。Pick/NonNullable/索引类型、方法别名、字面量键、延迟root、call/apply/bound invocation及实际receiver参与归属；bind捕获本身不计业务执行。每个defineRoute合并match/validate/handler，解析其本地/跨文件静态helper调用链；旧app按request.method/pathname分支划分并继承父分支及共享dispatch工作。可达两个仓储拒绝，不能以多仓容器直接判违规。
- **S4**：对直接仓储/方法的as断言和显式变量类型擦除（含结构重标注、any/unknown）、非有限字面量键拒绝。保留Pick等原声明来源可放行；有限字面量union按其类型签名分析，可能保守合并。

`pnpm service:check`默认阻断退出1；在ci:local中紧接structure:check。真实CLI注入测试随test:release-guardrails进入pnpm test，不复用/改写旧oracle。

## 已验证与能力边界

2026-10-17，批次4 S2新增基础设施端口 `ApiDependencies.loginRateLimiter`：只有此属性的非空类型解析为固定 `apps/api/src/middleware/login-rate-limit.ts` 中唯一真实 `LoginRateLimiter` 类声明身份才不作为业务仓储来源；合法类型别名可用，错类型、同名他源、他源重导出、同文件错类、union/intersection均拒绝。原五个基础设施分类及S1–S4、未知端口fail-closed、31业务端口规则不变。新增10条真实CLI对照含移除原B、仅以限流名注入B并跨仓调用的反例；临时退回纯名字skip时该反例真实红。首次S2源码bdbda0e全CI在未分类端口处失败；最初纯名字候选虽自测通过、独立初审也漏报，但协调发现改名逃逸后未提交，改声明身份并重新核验，保留失败史。独立门禁提交后另实际HEAD全CI，不豁免middleware目录或任意未知类型。

自测用一次性临时fixture启动**真实Node进程**，断言违规退出1且有对应规则；合法对照退出0；结束仅删除本次mkdtemp目录，不改生产源码。覆盖普通/结构重标注、跨闭包及跨文件helper、validate+handler、defineRoute别名、call/apply/bind及异仓receiver、分离bound路由放行、旧嵌套分支、API与packages反向转接、所有列明依赖语法、伪仓储文件及未解析端口。第一次原型曾因修改TypeScript共享signature数组触发栈溢出，已改为复制数组；真实树最终复跑成功，不能将原型失败覆盖为从未失败。

这是静态结构护栏，**不是JavaScript任意执行流证明**：不证明eval/反射、require的别名或createRequire、函数变量重赋、任意高阶回调/参数传递、手工重建函数签名、嵌套对象容器擦除、显式结构参数/返回类型及所有间接赋值保留来源；不检查新建但未注入ApiDependencies的私有仓储实例。route继承全部词法外层factory/map回调的共享执行组（遇外层route停止），并不等于任意跨参数回调流已被证明。上述未支持写法必须独立审查并在新增真实形态前补规则与注入测试，不得以当前绿灯宣称不存在隐式编排。旧app选择器依赖直接request.method/pathname，别名predicate可能导致保守合并；未知语法需显式审查，不自动加白名单。

service是否只是转发、业务语义是否值得提取仍需人工/独立复核，不是S3已实现的判定。packages自身依赖方向仍遵循ARCHITECTURE原规则，本护栏只检查与Service边界有关的边，不替代整仓分层或typecheck。原13套PG/93例不因此新增业务覆盖，更不证明权限/幂等/并发/生产安全全部完备。

TD-GATE-003仍未修复：本护栏扫描routes不等于G1/G2/G3扫描已修复；D5阻断及31旧豁免不变。最终命令/退出码和源码/证据提交见计划§4.2.19与§7。

## 本轮验证记录

- 早期护栏自测依次21/25/33/36例真实进程通过；复核反馈继续收紧结构重标注、真实receiver、bind仅捕获、伪仓储模块、packages转接、路由声明身份及factory共享调用。最终版本39例（含多层map及合法对照）单独运行，状态见§7。
- 首次候选ci:local退出1，68.648秒，失败在护栏自测；当时测试进程已加载旧夹具而执行期间规则改为核真实routes/types声明，两个新旧快照不匹配用例失败。保留失败日志，不作为验收成功证据。以后冻结源码再运行，不在CI执行中编辑候选。
- 冻结36例候选完整ci:local实际退出0，164.464秒，API117文件/17099例（含原13套PG），随后根据独立复核再补词法外层继承及39例。此成功不能冒充最后修正后的最终HEAD验证；最终实际HEAD另跑完整ci:local并在交接回报退出码。
- 两个新脚本独立TS AST函数跨度计量（非旧G2缩进口径）：初次计量437/294行、最大函数179/22行，最后39例版本另核；不以此声称已有函数≤200门禁或TD-GATE-003已修复。

最终39例工程9189818：主代理真实CLI39/39退出0（17.892秒）；协调方独立39/39退出0（18.883703秒），独立inventory退出0，各项指标一致。独立readonly reviewer最终无限定范围必要阻塞。主代理工程实际HEAD9189818完整ci:local真实退出0（168.983秒），API117文件/17099例通过，原13套PG仍由主代理串行执行；独立CLI不访问数据库。最后脚本/自测换行行数437/323（split含末空段438/324），最大完整函数180/22行。

协调复核的SHA256：gate `da205b9d041888b0fa499444a5bcbcd1795958804726155bc63f42d8edbf108a`；测试 `8f1ad4856ab26b376f5fb5e33ab79835d75cf962561583ba3f913888a439ec81`；工程时本文档 `cd212e7a29bc60c20d985878c5ccff0f9580ae0a69109197b55399e7ef5f0c4f`（本证据追加后文档哈希自然变化，脚本/测试不变）。日志保存在/tmp/kingturf-2e-source-ci.log、/tmp/kingturf-2e-independent-guard.log；库存由上述命令随时复算，不仅依赖临时产物。

本独立证据提交后再跑最终实际HEAD完整ci:local，并在交接报实际退出码，未成功不得用源码CI替代。2e整批零候选结案或扩至同仓编排均待用户验收/决策，本轮不自行宣布、不新增透传层。

## Batch4惰性路由执行单元（2026-10-26）

S1–S4原规则保持。S5适配ADR-0012的直接`yield projectedReply`：只信任checker解析到`routes/dispatch/context.ts`的真实工厂，同步generator中直接yield表达式语句、同步非generator projector；async、提前构建数组和变量中转强制拒绝。pending与projector归同一S3单元，原共享前置工作沿委托/消费边传入执行单元，跨仓储仍拒绝。不是按目录、函数名或RouteAttempts类型放行；CLI注入保留全部原测试及新增负例。调用图对任意高阶callback仍非完整证明，源码独立复核继续必要。
