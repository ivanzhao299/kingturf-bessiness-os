# 阶段5浏览器裁断考古与适配提案（未实施P1期待）

## 最新：已授固定布尔诊断实跑（数据差异不擅改期待）

7f8ffb7的独立`stage5-p1-fixed-diagnostics-1`真实seed0/2774ms、七类固定观察完整，诊断browser.close成功后exit0/2222ms，host0/null/10470ms、schema/container/preview均gone=true。无relay失败事件；原P1 spec未运行/未修改，不计原11绿。日志`/tmp/kingturf-stage5-p1-fixed-diagnostics-1-2026-10-17.log`及`.test-results/docker-local/stage5-p1-fixed-diagnostics-1/safe-events.jsonl`。只有预定义bool/计数导出，未读raw/认证/DOM文本产物、零PNG/未视觉验收。

| 类别          | 本次固定观察事实                                                                                                   | 结论边界                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| credit        | 三卡各状态1、额度5000000匹配3；批准敞口0=true；拒绝/过期原450000=false、0=true                                     | **原数据期待有实质差异**；不把它当货币格式变化，不改450000或seed                  |
| production    | 宽class匹配2、可见2；已有精确testid匹配1、可见1                                                                    | 原单locator存在歧义，不是实际工作台消失；尚未改原selector                         |
| Order360      | 展开前卡1、原RELEASED文本0、本地化已放行1、自然查看按钮1；展开后detail1、timeline18、原10事件编码齐                | 原整段count词面false；有新增催收分段/显示本地化与懒读差异，不能据此改原计数或事件 |
| commission    | 原政策pin0、本地化同code第1版pin1、原28500金额1                                                                    | 已确认版本显示变化；原五账链未在本诊断逐条验收                                    |
| risk          | 原HIGH/45文本0、本地化高风险/45为1；原CLOSED0、本地化已关闭1；原LOW_MARGIN词面false、固定中文门槛/原2410/2500=true | 支持显示本地化，不推断其它未抵达原断言全通过                                      |
| dashboard     | 原booked词面false、原四数值分别全部false；CNY单位true                                                              | **原数值期待实质不匹配**；未导出未知实际金额，不擅改原四数值/seed                 |
| manufacturing | 原PUBLISHED/V1词面0、本地化已发布/第1版6、版本总6                                                                  | 支持版本显示变化，原6条数量保留                                                   |

信用的0观察使用固定词面包含条件，不是完整实际数值读取；只据此说“0词面匹配”，不排除小数后缀或声称导出了实际金额。原450000未匹配的差异事实保持，不能因此改期待。Order360本次只确认timeline18与10事件编码，不推断其余summary计数全部正确。

main 7ad7062（fix: localize enterprise interface terminology）明确修改原bootstrap与对应测试，政策Vn→第n版、风险/制造状态使用业务label；af0de8f/7e3e46c货币/状态演进仍同源。1e80f2e为main产品可用性改进引入“查看全链路证据”；02f4943生产工单已给精确data-testid，当前production-orders-view:145/production-cost-view:63共用class。main意图证据不等于新期待自动授权。

最小后继显示适配提案（未实施）：仅状态/版本/事件本地化词面，生产工作台用已有精确testid，自然展开Order360后按独立字段仍核原五计数/18条时间线/原10编码事件可见；不对新增催收数设期待。原数值/币种/状态语义/事件/seed不变。credit450000和dashboard四数值保持停报并继续只读考古/建图核查，不包含在显示提案里；全11/每文件真变异/第二轮仍欠。C类生产不跑、TD018不放宽。

## 最新：已授金额候选仍有独立差异（非完整11例）

人类money R7已独立1068b94落盘，候选逐处映射见[授权文档](../tasks/harness-stage5-p1-money-authorization-2026-10-17.md)。相对cbb5aa1仅9行货币词面改动，独立只读复核确认原数值/币种契约/状态/计数/事件/seed及两配置保持，payments待核销与dashboard指标未泛改；不调用formatter生成期待。原lint/format通过。

`stage5-p1-money-first-1`：真实seed0/3154ms；发现11，仅9例有完成结果（1过8败），随后两次active upstream4173 CONNECT_TIMEOUT、PW null/SIGTERM，complete=false；host实际1/null/62186ms，schema/container/preview三owned清理true。不是11例完整跑，更不是P1绿/第二轮。已完成的固定结果：

| index              | 结果/durationMs | 原断言失败站点                                                                                        |
| ------------------ | --------------- | ----------------------------------------------------------------------------------------------------- |
| 0 credit           | failed/6447     | line48，拒绝卡片原敞口450000（只改本地化词面）；三卡计数及批准卡原敞口已先通过，失败具体值/原因未读取 |
| 1 order/AR/payment | passed/1832     | 无；原订单/应收/付款与核销链本轮通过                                                                  |
| 2 mobile           | failed/2339     | line120，production-workbench可见；不改类名/伪造DOM求绿                                               |
| 3 Order360         | failed/6533     | line139，原RELEASED状态连同固定金额文本；不据源码猜全部原因                                           |
| 4 commission       | failed/6655     | line171，原政策version-pin文案；金额断言尚未抵达                                                      |
| 5 risk             | failed/6700     | line194，原HIGH/45文本；状态/规则后续尚未抵达                                                         |
| 6 dashboard        | failed/6403     | line213，原bookedRevenue2058608文本；其余指标尚未抵达                                                 |
| 7 manufacturing    | failed/6558     | line239，原PUBLISHED/V1数量6；三个编号先通过                                                          |
| 8 procurement      | failed/5406     | line9，真实菜单parent挂载等待；与网络失败关系未定，不宣称业务失败                                     |

MRP/production独立两例没有完成结果。日志`/tmp/kingturf-stage5-p1-money-first-1-2026-10-17.log`及`.test-results/docker-local/stage5-p1-money-first-1/safe-events.jsonl`。期间只从精确owned容器读取cases.json并经safeLocalCases重编码固定字段；不读取raw/DOM/auth，零PNG导出/未视觉验收。未改timeout/retry/relay规则，TD018仍登记。候选保留为失败检查点，不继续改这些非货币断言或产品；已向用户询问是否允许最小固定布尔/计数只读诊断产物扩展，其它A–F不等待此裁定。每文件真实变异红→全绿义务未完成。

## 最新：逐路由已授候选实跑，新增金额显示C7

用户已在证据b1eab97后批准逐路由方案，[原话R7 f4b54c2](../tasks/harness-stage5-p1-route-authorization-2026-10-17.md)。本候选只自然DOM登录、真实菜单/ready等待及逐页截图；原11标题/金额/状态/事件/seed不改。旧下方“待裁/未实施P1逐路由”是批准前材料，不覆盖本段。

| 回放                       | 实际固定结果                                                                                                                                             | 完整性与清理                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| stage5-p1-route-first-1    | 原seed0/3412ms；PW1/310270ms，11 completed failed（10 timedOut、mobile原可见断言失败line109）                                                            | discovered11/complete=true，host1/321925ms；未有relay失败，owned三清理true  |
| stage5-p1-route-attached-1 | 先补parent attached真实挂载等待；仅index0/1 failed，原credit count3在line46、原订单CNY950000可见在line66；随后active4173 CONNECT_TIMEOUT、PWnull/SIGTERM | discovered11/complete=false，host1/28483ms、owned三清理true；不是完整11结果 |

首候选先即时parent.isVisible可能在DOM未挂载时误跳桌面展开，是本轮测试helper静态竞态；只读review指出后，等首跑完整结束/清理才加原parent attached等待，未改timeout/业务值或中途改文件。mobile相同13次验证改展开固定行号，以便不导出raw仍定位具体原断言，selector/顺序/路由一一保持。首版AST前后11标题/原expect表达式/数字字面量均同；最终mobile展开只使原13次循环检查变13个固定站点，不减少业务检查。独立review确认该挂载等待与13映射无必要静态阻断，但未代主执行浏览器。

日志：`/tmp/kingturf-<label>-2026-10-17.log` 与 `.test-results/docker-local/<label>/safe-events.jsonl`。首跑进行中仅在精确owned容器读取 `cases.json`，经safeLocalCases再次白名单重编码固定partial；不读raw stdout/HTML/错误上下文/认证头/DOM文本。raw与PNG仍tmpfs随容器清理未导出，零PNG非视觉验收。

### 金额显示新增C7（不改原期待）

明确main产品提交 `af0de8f1cbfad6b56d4795eda5845ba868305301`（fix: localize production business surfaces）新增displayMoney并将信用raw文案换为Intl zh-CN货币格式；是main祖先，早于Harness。当前shared/business-format:43–54、credit-view:30、sales-orders-view:152仍同逻辑。主执行者对当前formatter做固定合成输入CNY/950000的纯函数执行（TS转CommonJS VM，只stub未使用日期import），得到 `¥950,000`；“申请 950000”子串和“CNY 950000”精确文本均不匹配。此证明格式函数/旧词面的差异，不冒充真实DOM中已读取所有实际金额，也不归因其余未完成例。

本次逐路由许可未包含金额文案期待变更。当前停止该spec，保原两失败断言，不改币种/950000或seed、不复跑粉饰、不将TD018放宽。最小后继建议另裁：只对有明确af0de8f显示演进依据的货币文本，用独立固定本地化期待保持原币种/数值/计数/状态，未显示的业务差异仍逐项上报；不能调用产品displayMoney来同时生成实际与期待。全部11绿/每文件真变异仍未完成，第二轮未开，独立A–F继续。

## 来源与当前边界

5230625计划§7四项裁断＋[阶段5R7](../tasks/harness-stage5-authorization-2026-10-17.md)。主执行者与独立只读scout核git/当前源；禁止把静态实现变化等同已批准P1期待变更。原P1完整11败和最新partial3保留，原spec精确恢复。

## P1产品历史：有明确意图，但后继期待仍待裁

`a4ee6aa`新增原P1测试（重复seed验收），早于产品导航演进。`d4e9dbd`（feat: split navigation by business process）新增 `docs/engineering/KT-UI-PROD-06_PROCESS_NAVIGATION.md`，第5行“每个菜单只打开一个主要任务页面”，第22–24行规定工作台单明细路由、概括工作台不再业务操作入口、不得混入其它阶段操作台；该提交属于main祖先。导航单页规则先于S4；仅前两例hidden有实际快照，不推断其它页或全部失败因果。

当前workspace-routes:5–26逐类映射、navigation:90–105空hash→overview、:127–181显隐；P1 helper原等商机heading不是overview。只有此前partial前两例实际见到overview下board存在但无rect，不能据考古归因第三例/所有11例的数值或后续断言。

最小申请方案：自然DOM登录（既授Cookie迁移）后保留原商机heading期待，但先通过真实菜单进入opportunities并等加载；其后每case真实菜单访问相应页面再做原业务断言。新增route/加载等待，所有原金额、数量、状态、事件、表单操作参数和seed不改；无CSS/DOM假可见、无产品修改。下表只是待裁提案，未改spec/未运行。

| 原case（顺序）     | 拟真实路由/等待                                                                                                                                                                                                | 保守性说明                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1 credit outcomes  | credit-review                                                                                                                                                                                                  | 原950000/三结果/额度敞口断言全保                                                                              |
| 2 order/AR/payment | sales-orders→receivables→payments                                                                                                                                                                              | 旧同页各块分别逐页原断言；截图需在各自当前页拍，非同时可见                                                    |
| 3 mobile           | 原13类按workspace-routes逐页导航：credit-review/contracts/sales-orders/receivables/payments/commissions/order-360/business-risks/overview/manufacturing-master/procurement/material-planning/production-orders | 390×844/每类可见/JSON textarea0保留；最后需回sales-orders截图。由“同时”改“逐页”是明确非会话期待适配，不擅自做 |
| 4 Order360         | order-360                                                                                                                                                                                                      | 原金额/状态/计数18/事件全保                                                                                   |
| 5 commission       | commissions                                                                                                                                                                                                    | 28500及五不可变ledger状态全保                                                                                 |
| 6 risk             | business-risks                                                                                                                                                                                                 | HIGH45/LOW_MARGIN2410门槛2500/四状态全保                                                                      |
| 7 dashboard        | overview                                                                                                                                                                                                       | 原五指标/来源/责任钻取全保                                                                                    |
| 8 manufacturing    | manufacturing-master                                                                                                                                                                                           | 原版本6/发布按钮0/三个编号全保                                                                                |
| 9 procurement      | procurement                                                                                                                                                                                                    | 原资格/采购/收货/lot/3704.5全保                                                                               |
| 10 MRP             | material-planning                                                                                                                                                                                              | 原提案6/冻结3/数量等全保                                                                                      |
| 11 production      | production-orders                                                                                                                                                                                              | 原工序3/issue/return/隔离产出及全状态链全保                                                                   |

需要用户对上述逐页适配明确裁定。此次提交的是已查到的产品意图证据＋逐例方案，不将提交材料当批准。P线等待该项时继续其它独立任务，不重问已授Cookie/Workspace。

## 成本提示旧新对比：静态＋现存实际证据，仍需受控对比

96ff158初始成本交接，107aac2明确按quote:read/create分流：赋“正在进入销售报价”、重建workspace、跳quotes并开预选dialog；同提交原E2E在dialog后要求原提示可见。当前cost-matrix-detail:545–580仍赋同文案/同切页；没有找到有意取消成功提示的产品决策。

580cc72引入lazy route-read，当前route-read:81–84写共享message“已加载…”，bootstrap:361–368把该前缀显示为空；目标route ready时route-state:55–61可不重读。这只能支持未预载路径覆盖候选，不证明所有路径消失或只是位置变化。[旧首轮trace脱敏事实](../tasks/playwright-cost-handoff-blocker-2026-10-17.md)是quotes+dialog+预选通过、after文本为空；没有采到中间帧，不能断言从未存在。

下一最小诊断：以同一原合成业务样本比较旧产品版本/当前未预载/当前先真实访问quotes再回costing三个条件，只观测提示文本的固定match/可见时间和原业务断言，auth载体做各版本必要适配但不改产品；拒绝输出auth/原始DOM。若只位置/时机变动且信息确实保留，显式行为登记后按已授适配；若信息确实丢失，带对比证据上报用户产品决策，禁止改产品/删期待。本轮尚未执行此新对比，不预断结论。

## Workspace与TD018

Workspace新授权允许仅输入/载体适配。目标旧360合成响应只补服务端真实固定tuple `unavailableSections: ['orders', 'finance']`（crm-repositories:869/types:371），不再采用历史未批空数组提案；16原expect与动作保持，字段缺失和auth变异实跑另记。TD018仍只登记active CONNECT_TIMEOUT，不放宽转发条件。A/B全部绿前不开第二轮，C两份不跑。
