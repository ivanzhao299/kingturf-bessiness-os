# 阶段5浏览器裁断考古与适配提案（未实施P1期待）

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
