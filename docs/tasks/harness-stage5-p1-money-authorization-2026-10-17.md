# 阶段5 P1 最小货币显示期待 R7

## 驾驶舱四固定值实施授权（2026-10-17）

### 实施与真实补跑（未抵达四KPI断言）

先独立授权f06b459，再只替换p1-demo.spec.ts中四个字面量数字；原matcher/定位、来源/责任钻取及其它测试字节全保持。主代理独立proof将aa2d4ff原文件按四个唯一旧词面各替换一次，所得完整文件与当前逐字节相同；apps/packages/scripts/infra/.github/依赖无diff，种子/两配置/网络硬闸保持。proof实际0，日志`/tmp/kingturf-stage5-p1-dashboard-four-literal-proof-2026-10-17.log`；原strict eslint/format实际0。不调用产品formatter、不读取页面实际值造期待。

真实原完整11例集合`stage5-p1-dashboard-fixed-1`：仅7完成，index0–5通过，index6驾驶舱用例失败5299ms，failureLine=9是openRoute的parent toBeAttached；该用例尚未抵达四KPI断言，不能称新四值已浏览器验证，更不能把此失败当数值不符。随后4173/upstream CONNECT_TIMEOUT/closing=false触发PWnull/SIGTERM，index7–10未完成；host1/null/26468ms（preflight1/25942ms）。原种子0/2756ms、既有成本种子计数1/2/1/2及异人/closed保持，guard/同实例/marker/只读tmpfs和owned schema/container/preview清理全true。安全日志`/tmp/kingturf-stage5-p1-dashboard-fixed-1-2026-10-17.log`；无raw/DOM/auth产物外导。TD018原故障再次记录，不改超时/转发/权限/产品，不通过反复重跑隐藏flaky。

本次仅四固定值适配已实施，浏览器四值核验/完整11例/P1认证真变异/第二轮仍未完成。最终提交HEAD完整CI另跑，不预填结果、不用完整CI代替受阻P1；DoD4/5与阶段5终验边界保持。

本会话直接收到人类答复`["request_user_input_async","call_ace2fa6a079c47759f8d36234361b00f",0]`：“批准四个固定值最小适配（推荐）”。批准范围严格为下方主代理/只读代理独立推导的隔离P1四值：bookedRevenue由2058608改950000、grossMargin由585399改229000、cashCollected由1550000改950000、openReceivable由508608改0，单位仍CNY。只替换四个固定文本中的数字，保留原定位/matcher及其余来源/责任钻取断言、原种子、产品、两配置、网络硬闸；不从实际页面值生成期待、不改其它业务数值。

接续干净aa2d4ff23af79187b77c1055e2065c2b8c4e3116，该HEAD完整CI实际0/null/331905ms、首尾HEAD同/树空；实际覆盖37492/48601、domain629/671、仓储9787/11512，固定B未改。先本R7独立docs提交，再四字面量适配/真实串行补跑，保留历次失败与TD018连接条件。尚未实施/未11绿/未完成P1认证真变异或第二轮，不沿用旧CI冒称后继通过；新最终HEAD仍实际完整CI。DoD4/5未完成，不扩结构/豁免或执行§14。

下方“待审批/审批前保留”均保留为推导与前次执行的历史时点，以本新增R7覆盖当前授权状态。

## 后继信用与驾驶舱裁定（2026-10-17）

信用最小实施实际结果：只改拒绝/过期两条，定位原卡`.qtc-metrics`并`toHaveText('申请 ¥950,000 · 敞口 ¥0 · 额度 ¥5,000,000')`，非前缀包含匹配；批准卡/三卡计数/三额度数组/seed/其它业务断言不动。strict eslint/format实际0。`stage5-p1-credit-zero-1`使用原完整11例集合、原两config、仅已授trace=off与只读tmpfs：信用case index0实际passed/1545ms；共9例完成8过1败，驾驶舱原bookedRevenue期待仍在line230失败，随后原TD018的4173 upstream CONNECT_TIMEOUT导致PW null/SIGTERM，MRP/生产两例未完成。host1/null/35460ms、种子0/2823ms、owned schema/container/preview清理全true；日志`/tmp/kingturf-stage5-p1-credit-zero-1-2026-10-17.log`。不是完整11绿/信用全spec认证变异/第二轮，也不以重跑隐去连接故障。驾驶舱四值审批前原样保留。

### 驾驶舱独立固定值推导（待审批，未改四期待）

主代理与只读commercial_inventory分别从业务源码推导，不读取DOM实值反推：

| 指标           | 原期待  | 隔离P1候选（CNY） | 独立计算/来源                                                                                                                                              |
| -------------- | ------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bookedRevenue  | 2058608 | 950000            | seed_p1_demo.mjs:402–424只有SO-KT-P1-DEMO，总额950000；dashboard-repositories.ts:24/34求订单total和                                                        |
| grossMargin    | 585399  | 229000            | seed:141–195成本(8000×62.5＋8000×18.75＋50000)×1.03＝721000；232–238毛利950000−721000；domain/index.ts:549–588固定小数算法，dashboard:35求已发报价margin和 |
| cashCollected  | 1550000 | 950000            | seed:426–465应收950000/首收500000并核销，504–529余450000收齐并核销；dashboard:27/36求allocation_entries.amount和                                           |
| openReceivable | 508608  | 0                 | 同一应收950000减两次核销950000；dashboard:26/37求ar_open_item_balances.remaining_amount和                                                                  |

适用条件：fixture.mjs:31–39/71–80新建随机隔离schema，仅运行当前P1种子；dashboard-query.ts:1–7默认UTC当前年（本次2026）、CNY；SQL仍按tenant/DataScope/币种/时间筛选聚合，不改为只查演示订单。共享脏库/其它年份不能直接复用本期待。原四期待位于p1-demo.spec.ts:222–229附近；审批前全部保留。后继审批只涉及四固定值，不动来源/责任钻取断言、产品、seed或网络硬闸。

人类直接答复`call_0976b8f5d525481a96ee9a4ec2450a84`：第0项批准保留当前种子，只把拒绝/过期两处敞口期待改为结清后0并精确核验；采用完整指标文本等值断言，避免0前缀误绿。其它卡/申请额/额度/业务参数不动。第1项选择隔离P1驾驶舱口径，但仅批准独立推导固定四值并再提交审批，尚未批准改四个期待。本节覆盖下方旧“450000待裁”当前状态，失败史保留；见[正式R7](harness-stage5-authorization-2026-10-17.md)。

主执行者亲读协调会话01a12db5-380f-79c2-9329-8bcc500a27c8中人类消息01a1490e-d723-7723-a534-0951f0ad7d34。questionItemId：`["request_user_input_async","call_dd0e2120495445669087b3dbae8dba45",0]`；原答复：“批准最小金额显示适配（推荐）”。不是把只读review当人类授权。

原问题范围：“是否批准 P1 的最小金额显示期待适配？考古确认主线 af0de8f／7e3e46c 有意引入货币本地化；当前固定输入 CNY/950000 显示为‘¥950,000’，与旧‘申请 950000’‘CNY 950000’不匹配。仅对逐处有该产品变更依据的货币文本，改用独立固定的本地化期待；原币种、数值、条目数、状态、事件、种子全部保持，不调用产品 formatter 生成期待，并做真实变异；其它未通过的数据或行为仍上报。本次需要单独裁定，因为上次批准仅覆盖路由。证据：docs/evidence/harness-stage5-browser-rulings-2026-10-17.md 的‘金额显示新增C7’。”

## 范围与停止边界

### 逐处候选映射（本次实际部分失败见后继证据）

固定字面量直接写进测试，不import/call产品formatter。af0de8f新增货币格式；7e3e46c进一步用于订单/Order360/应收/佣金，均为main祖先。当前消费者及原→新对应如下：

| 当前消费者                          | 原期待 → 固定新期待                                                                                 | 保留项                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| commercial/credit-view.ts:30        | 申请950000→申请¥950,000；敞口0/450000→敞口¥0/¥450,000；额度5000000→额度¥5,000,000（实际空格沿原句） | 三卡、批准/拒绝/过期及三额度数组不变                             |
| commercial/sales-orders-view.ts:152 | CNY 950000→¥950,000                                                                                 | 原订单号及exact=true不变                                         |
| commercial/receivables-view.ts:74   | 未核销 CNY 0→未核销 ¥0                                                                              | 原发票号、余额0不变                                              |
| commercial/order360-view.ts:47      | CNY 950000 · RELEASED→¥950,000 · RELEASED                                                           | 原RELEASED/计数18/全部事件不变，即使有后继状态本地化差异也不顺改 |
| commercial/commission-ledger.ts:27  | CNY 28500→¥28,500                                                                                   | 原政策/五状态账链不变                                            |

当前payments-view:79的“待核销”仍用原recordText，workspace-dashboard:50仍用原unit/value，均**不改**；数量、比率、评分、状态与其余期待也不改。CNY符号按现有明确formatter契约，固定数值不变，不新增无据币种API步骤。候选lint/format已通过；尚未11绿、尚未完成每文件真变异或截图视觉验收。

- 基于已授逐路由候选e25ac38；先逐处核当前消费者及main产品本地化提交，映射原货币数字/币种到固定显示文本，不能泛改所有数字或状态。
- 不用产品formatter或共享实际值生成期待；固定独立期待仍对原数值、币种、数量与证据有分辨力，须真实变异红→完整还原绿。
- 原条目数、状态/事件/表单参数、seed保持。数量/时间/评分/比率等非货币文本不在此许可；新数据/行为失败仍C7。
- 不改产品、DOM/CSS、超时/retry/原两配置；不放宽TD018或把部分结果充11全绿。
- 不扩成本提示消失裁断；C生产不跑，A/B全绿才第二完整轮。
- P1原始产物仍readonly容器/owned tmpfs不导出，首版零PNG；未做视觉验收，不回写旧失败史。

[逐路由R7](harness-stage5-p1-route-authorization-2026-10-17.md)、[已有考古/实际部分失败](../evidence/harness-stage5-browser-rulings-2026-10-17.md)保留原时点；本R7先独立docs提交后才改货币期待。接手7117c41（coverage接线候选，尚未首测B/未全CI）；不把该工具提交当覆盖率达标。

回滚本R7 docs可独立revert须核后继依赖；后继货币适配独立提交/映射/实际结果，产品源码零diff。

首跑`stage5-p1-money-first-1`仅9完成/1过8败后TD018中断，非完整11；原订单/AR/付款链通过，其余新差异不在货币许可内。全部固定结果与未抵达断言见[失败史](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。本候选不是文件适配收口或变异绿证明。

## 最小只读诊断产物增量R7（直接人类答复）

用户直接回答questionItemId `["request_user_input_async","call_c6716c69e26a40909872123527728d67",0]`：“允许上述最小只读诊断（推荐）”。许可为独立只读诊断，仅导出**预定义业务条件的匹配布尔值/计数**，例如拒绝卡片原敞口匹配、原KPI匹配、版本/状态映射、工作台存在。不得导出DOM文本、认证材料或原始产物，不改产品/seed/原断言/网络硬闸；原tmpfs/readonly容器、trace off及owned清理纪律保持。不是新的期待适配、不是批准任意查询/数据外传，也不是对未完成两例的结果推定。

后继先版本化固定键/条件和类型白名单，再真实串行执行并保留实际退出/失败史；原spec只读，诊断不算原11绿或真变异闭环。此R7先独立docs提交，A–F继续，不等待P线全绿。

### 只读诊断接线（待实际浏览器）

`preflight.mjs local p1 <独占label> diagnostics`沿原readonly仓库/root、log-driver=none、owned tmpfs、原seed和同一性/relay硬闸启动；不运行或修改原P1 spec。独立`p1-diagnostics.mjs`手动真Chrome、单context串行读七页，固定390×844，只自然登录/菜单及查看订单证据的GET动作；不启动trace/截图，不导出DOM/原始错误或认证材料，debug模式明确拒绝。

条件在`p1-diagnostics-contract.mjs`预先钉死：credit原三卡/敞口/额度匹配；production宽class及精确testid的存在/可见数；Order360原/本地化状态、自然展开后原计数词面/事件编码数；commission原/本地化版本pin与原金额；risk原/本地化严重度/关闭/规则词面；dashboard原四数值/原词面/币种匹配；manufacturing原/本地化版本数。每键只允许boolean或0–1000整数，ID必须固定string，unknown/缺键/额外字段/字符串值拒绝；不输出实际差异文本或实际未知金额，不调用产品formatter造期待。

新诊断context禁Service Worker；本地Playwright1.62.1类型文档确认route不能覆盖SW捕获请求，独立review后收紧。HTTP请求仅允许精确127.0.0.1:4173 origin的GET/HEAD/OPTIONS和自然login POST（无query/URL凭据），其余请求与全部WebSocket关闭并使诊断失败；没有改原relay失败规则/两配置。七类观察事件由宿主再次重编码并独立记集合，只有实际browser.close成功且集合完整才接收独立diagnostics-result。该complete只代表七类诊断完成，**不计原11P1成功**；中断只保留已验证的partial观察。

新4项contract反例＋原private7项＋session网络2项实际13/13，原ESLint/Prettier通过；已接根test:session-network-tools（零新依赖）。独立只读review未见raw/auth导出路径，SW缺口已按建议收紧；还未实跑新诊断、不称网络写闸已浏览器负向实证或完整CI绿。原P1 spec/seed/两配置/forward当前零diff。

后继真实诊断已完成：7f8ffb7七类观察2222ms、host0/10470ms、browser关闭/owned三清理true，无原P1执行。确认信用拒绝/过期敞口匹配0而非450000、dashboard原四数值均不匹配；这些保持数据C7，不借显示适配改期待。其余本地化/重复class/自然展开细节和待裁方案见[全部固定事实](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。原“待实际浏览器”段保留接线时点，不覆盖本后继结果；没有原始DOM/auth或未知实际金额导出。

## 显示／定位增量R7（直接人类批准）

用户直接回答questionItemId `["request_user_input_async","call_3239bc72cd554967ac50abcb28006405",0]`：“批准上述最小显示／定位适配（推荐）”。问题原文批准范围：独立固定中文状态与版本词面、已有精确生产testid、自然展开Order360后仍核原五计数/18条时间线/原10事件编码可见；不改原数值/币种/状态语义/事件/seed，信用450000与dashboard四原值差异不包含，继续停报核查。

实施须逐处查当前消费者与main有意显示演进，不能泛改未使用label的原raw文本。中文期待用独立字面量，不调用产品label函数生成。原十个事件编码身份保持，通过已有title定位相应事件行并仍要求行可见；不是把属性存在充作原raw编码字面在页面显示。原五计数仍独立验证，18条时间线另验，不对新增催收分段编造期待。生产仅原工单工作台用已存在精确testid，不删成本面板或改DOM/CSS。

先独立R7 docs提交，再改spec/逐处映射/真实补跑及最终真变异；其它未覆盖数据差异仍C7，不将此批准扩为新数值许可、原11已绿或第二轮放行。

### 显示候选逐处映射（实际7过2败后中断）

相对6700fd8，仅原P1 spec按已授映射：order360-evidence:45/52的RELEASED/APPROVED→已放行/已批准、同文件自然详情及title编码保留；commission-policy:69原V1→第1版；risk-view:20–61的HIGH/CLOSED/LOW_MARGIN/四状态→固定高/已关闭/中文规则/待处理-已确认-已升级-已关闭；workspace-dashboard责任钻取:85只改HIGH/CLOSED显示，四指标数字原样；manufacturing-cards:25的PUBLISHED/V1→已发布/第1版（仍6）；sourcing-register:22和purchase-order-cards:21的ISSUED/RECEIVED→已签发/已收货；mrp-run:17/mrp-proposals:67的COMPUTED/RELEASED→已计算/已放行（原6/3/6及数量不变）；production-orders-view:119–129的ISSUE/RETURN/QUARANTINE/五状态链→独立中文词面（原领退数量/roll数量/三工序全保），两处原生产class限定到已有testid。

Order360五计数拆为原应收/回款、原佣金/风险/证据两段，忽略新增催收段的未知计数但不放宽原五值，另固定时间线18；十个原事件编码原样title定位且对应行仍toBeVisible。未改credit450000/dashboard四数值、seed/产品/两配置/forward。原ESLint发现新状态tuple推断两处string|undefined，补as const后原lint/format及13工具项实际0；独立只读review无必要阻断，hasText订单前缀潜在多单歧义保留实际补跑判定，不先虚构seed多单或改原业务oracle。

实际`stage5-p1-display-first-1`发现11/仅9完成：7过，credit原450000与dashboard原bookedRevenue两败后TD018中断；host1/39336ms/owned全清/HEAD与spec不变，MRP/production两例未完成。所有固定结果见[失败史](../evidence/harness-stage5-browser-rulings-2026-10-17.md)，不是原11全绿或每文件真变异收口。
