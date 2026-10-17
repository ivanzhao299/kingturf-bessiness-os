# 阶段5 P1 最小货币显示期待 R7

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
