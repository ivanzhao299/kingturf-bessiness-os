# 3c① 线索方案（2026-10-16，实施中）

## 输入与范围

3b源码487d698全CI0/177297.989ms、文档检查点5a5c586稳定干净实际HEAD全CI0/169744.518ms，日志 `/tmp/kingturf-3b-5a5c586-head-ci-2026-10-16.log`；协调独立复核通过，无阻塞，依原批次3授权续3c①，不新索许可。基线固定5a5c586，原bootstrap13757 split；本组只opportunities/technical-requirements/technical-solutions三真实视图及最小结构类型ports、必要原测试读源组织与CDP探头。store/加载/商业其他18视图不提前改，后端/packages/SQL/lock/workflow/生产/push部署、其他BOUND/SEC/N+1/D1/4/5保持冻结。

主代理完整读取原三个连续分支及generic装配尾。基线实际分支pipeline2684–2864=181行、CTR2865–3245=381行、solution3246–3496=251行；不是用旧历史行号套新代码。readonly scout给出同映射与闭包，主代理唯一写入/串行测试/DB/浏览器。不得整段381/251搬成新巨函数；新helper按创建表单、行卡片/动作/证据、字段与payload、视图DOM装配真实拆分，不reset回调嵌套。

## 浏览器基线与覆盖增量

先仅扩版本化CDP工具，源码仍5a5c586。新增 `--sales-views` opt-in：默认旧session/六GET不变，开启仅加三read权限与三个精确GET，各1条OPEN机会/APPROVED CTR/FINAL方案；旧三个fixture test/网络策略断言和原七case保持，新独立fixture test核三GET/POST拒绝/未知后缀拒绝/默认session不变。独立纯JS现5项（原4+1），不并入web114。

旧实现实际CDP `--probes --sales-views` 真实exit0，run mcQT3e，日志 `/tmp/kingturf-3c1-old-cdp-2026-10-16.log`、截图 `/tmp/kingturf-cdp-preflight-mcQT3e-probes.png`。10case=原7+三实际视图case；双viewport390×844/1440×1000逐视图用真实导航/onlyRoute、上下文标题、具体非空卡/行文本、document横溢出检查，不把pipeline内部有意横滚当文档横溢出。7不同路由（原overview/customers/costing/quotes+本组三路由），DOM38/viewport9/route31/text22/overflow16，GET counts session/customers/opportunities/ctrs/solutions/quotes/org各5、cost6/detail2；blocked/unknown/failed0，自有preview2595149/Chrome root/profile清理全真。原七case默认通道仍可独立跑；此结果不是创建/提交/审批/修订/附件/真实API权限矩阵/Playwright/21视图全覆盖。Windows安全仍按computer-use技能边界及用户明确CDP方法；不使用桌面UI或安全放宽flags。

## 候选与诊断（未完成）

SalesViewController为新结构类型，仅描述原对象公开读字段和方法；传入原controller引用、不复制状态、不绑定新receiver、不反向运行import bootstrap。ports为原plain词法函数引用；pipeline的rebuildWorkspace箭头只在原提交后回调时调用原commercialWorkspaceStructure(viewport,immutable,controller)，捕获原参数绑定，不提前重建/读缓存/存储/动态字段。三原权限条件留root原位置，route token映射/后续装配及generic fallback保持。

候选初测四模块split/AST/最长完整有body函数：sales-view-ports36/0/0，opportunity-view217/5/152，ctr-view481/5/127，solution-view298/4/115。typecheck最初真实exit2：CTR迁出后root openFileForm本地import未用，删除本地import，不删公开绑定、不做假引用；当时尚在运行的下一轮typecheck也报同项，不将这两次计绿。待其结束后修后typecheck及structure真实通过，强制0/原31；源码测试尚待实际读源适配/新目标红绿和完整守恒对拍，不预认本组完成。

原bootstrap.test手工草坪交接字段case从单读root→root+三个实际view模块，各readBoundSource非空唯一实际export函数锚；原字段/海运证据/WEB-UAT负向expect字面保持。三个view都曾处旧完整root负向范围，故不只补两个缺字段文件而漏掉pipeline负向范围。其余route映射未迁移，原runtime测试仍走root真实facade。新目标变异与457完整expect链守恒另实测，不用重复字段残留造绿。

## 整批共享残留去向（计划，不是完成声明）

只搬商业/治理/store仍不能把入口压至800，故提前落图，后续各步保行为/独立验证，不留到3f以收紧任意JSON.parse兜底。基线5a5c586静态位置仅用于定位，施工后按符号重定位：

| 原残留                                                                        | 去向与边界                                                                                                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 商业overview1777–1855、production-cost2202–2403                               | overview属商业共享总览，在3c公共装配收尾；生产成本归3c④，不漏出21主路由地图。                                                                   |
| generic action9899–10155与商业route装配尾                                     | 3c六组末的commercial公共装配真实分解；本组三个具名fallback条目也保留此公共循环，原controller存在时skip逻辑不修、不擅收紧其高级请求JSON。        |
| 文档模板201–352、API/cache10179起、openOnlineDocumentEditor10513–11312完整800 | 已授权shared文档公共层收尾，分真实字段/命令/历史与装配函数≤200/AST≤5，保同一cache/session读时点与编辑器activeVersion/live refs，不把800整块搬。 |
| customer360Content11316–11410、replaceRouteView/导航insights、权限/文案等     | CRM/shared收尾，逐步真实模块/接口，保焦点恢复/可见顺序，日期仅随3e既有收敛，不借3c改日期语义。                                                  |
| installWorkspaceListTools11536–12101完整566（含storage）                      | shared列表工具按实际筛选/导出/持久化分解≤200/AST≤5；3f仅按迁后实际storage边界解析，不扩大到任意JSON业务载荷。                                   |
| governance约1124、制造callback212/投诉callback278、CommercialController/store | 分别3d、3c⑥、3e真实分解，均不整块搬、不用回调计数reset伪达标。                                                                                  |

## 本组最终局部验证（完整HEAD CI尚待）

实际新模块最终split/AST/最长完整函数：ports36/0/0，opportunity216/5/151，CTR480/5/127，solution297/4/115；bootstrap13757→12968 split，四模块均800/200/5内，原31/G3/G4不变。为保持DOM方法求值次序，行/卡片/创建/修订helper先赋回原const绑定再append，而非把helper调用塞append参数；独立readonly复核当前候选无阻塞（最终sha前缀caceae1d/fcf52e0f/7878d711/ports3352c210/rootf766d272）。

`/tmp/kingturf-3c1-conservation-2026-10-16.log` 从实际新helper取body，核唯一调用点实参绑定，受限内联card/CTR create-revise-actions-row/solution card，恢复solutionFields原默认参数/数组表达式与实际payload，核root rebuild箭头恰调用原函数/原三参数；整个commercial body规范化378403 UTF-16相同，进一步还原新增import及原openFileForm import后**整个bootstrap规范化相同**。非原文件原始字节不变声明，闭包/引用/receiver另经独立深审，非以规范化忽略业务字符串。`/tmp/kingturf-3c1-metrics-bindings-2026-10-16.log` 核原70公开名字、457完整expect链全序列相同；实际静态实现图21TS/非字面dynamic0。

适配后原9/114通过，日志 `/tmp/kingturf-3c1-web-adapted-2026-10-16.log`。三个实际新目标的运行代码（机会金额fallback、CTR code fallback、solution card文本）各临时变异为原禁止marker WEB-UAT，原字段case真实红exit1，逐次完全恢复后9/114绿；日志 `/tmp/kingturf-3c1-{opportunity,ctr,solution}-read-source-{red,restored}-2026-10-16.log`。未改任何原expect/fixture/阈值。web typecheck/lint/39-19/结构0硬31软/build通过，预算11368/1898，日志 `/tmp/kingturf-3c1-structure-final-2026-10-16.log`、`/tmp/kingturf-3c1-build-2026-10-16.log`。

新实现第一次CDP SCCi7F真实exit1：原第3case CRM筛选后page.route(costing)超时，active仍customers、可见CRM；仅前2case通过，**不计10绿**，日志 `/tmp/kingturf-3c1-new-cdp-2026-10-16.log`。preview2606894/Chrome57268/端口54324、root/profile清理全真。主代理未改源码/driver/数据/参数，原样独立profile重跑h9vQar真实exit0/10case；日志 `/tmp/kingturf-3c1-new-cdp-retry-2026-10-16.log`、截图 `/tmp/kingturf-cdp-preflight-h9vQar-probes.png`，DOM38/viewport9/route31/text22/overflow16与旧实现同口径，三新GET各5、其他counts同旧，blocked/unknown/failed均0，preview2606985/root/profile清理全真。独立静态诊断指出driver hit-test到实际派发间没有稳定坐标再核、原nav-children有220ms展开动画，可能导致点落空；**只是较强候选，原因待核实，不能由重试绿断言业务回归排除/工具已修复**。未改CSS/路由/业务逻辑绕过，也未把不确定工具时序定性新业务缺陷或据此修复。旧/新截图各自保留，不声称像素/PNG字节相同。

## 待验证与回滚

本组源码/工具/证据单责提交后稳定干净HEAD完整ci:local真0，原114/457断言/70绑定、预算/39-19/原31、实际新旧分支重建及独立只读复核、增量CDP10全部核后才续3c②。回滚本组恢复5a5c586视图，可保留3b/R7/能力读源门禁；本组opt-in CDP默认旧行为不变。原Playwright九spec/config冻结未执行，阶段5前用户提供LinuxChrome/免交互安装权限后真实全补跑义务保持；3f后停整批人工验收。
