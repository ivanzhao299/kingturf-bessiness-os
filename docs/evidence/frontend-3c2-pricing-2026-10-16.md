# 3c② 成本、政策与报价（2026-10-16，源码候选验证中）

## 输入与边界

基线 `85affd3`，完整 CI 真实 exit 0 / 167711.351ms，结束 HEAD 未变且工作树干净，日志 `/tmp/kingturf-3c1-85affd3-head-ci-2026-10-16.log`。依既有批次3授权继续，无需重新许可。仅拆 costing / sales-policies / quotes 真实视图、最小结构类型端口及必要读源护栏与本地 CDP 探头。原9文件114测试、457完整断言、70公开绑定和预算阈值保持；后端、packages、SQL、lock、workflow、Playwright规格及配置冻结，不 push、不部署。

用户本轮明确“按原行为验证”：CRM 筛选重建输入节点并恢复值、焦点、选区；商业 workspace、菜单、未参与重绘的成本 input 身份不变。既有 CDP case 已绑定真实节点并按该口径验证，不新增 CRM 节点身份要求。矩阵自身重绘仍保留原 aria-label 对应值/焦点/选区恢复及 accepted/latest-wins 规则，不能把“未参与重绘”扩大到所有成本输入。

## 对照计划

先对旧实现增加独立 `--pricing-views` opt-in，默认原7、sales原10保持；仅补最小政策 read 权限及精确 GET、非空矩阵摘要/政策/报价记录。三视图分别检查双 viewport 真实导航、独占显示、具体卡片/行及文档横溢出。请求全部合成 stub，未知/写请求 fail closed。此通道不代表创建/审批/签发、真实 API、权限矩阵、全部21视图或 Playwright 覆盖。原9spec/config仍冻结未执行，阶段5前真实补跑义务保持。

候选分解以矩阵共享操作、因子表单、详情、台账、模型核算、政策和报价为实际职责；每完整函数≤200、AST≤5、文件≤800，不整块搬移，不创建 god store，不提前执行3e/3f行为变更。先保留原 controller 与动态权限/活DOM查找，再对候选执行守恒重建、读源红绿、原测试/预算/门禁及独立复核；未有结果前不声称通过。

## 旧实现实际对照

`node --test scripts/e2e-cdp/fixtures.test.mjs scripts/e2e-cdp/network-policy.test.mjs` 真实6/6通过（原5+pricing opt-in fixture1；不计web114）。旧实现 `node scripts/e2e-cdp/preflight.mjs --probes --pricing-views` 真实exit0，run `Kbfgj2`，日志 `/tmp/kingturf-3c2-old-cdp-2026-10-16.log`，截图 `/tmp/kingturf-cdp-preflight-Kbfgj2-probes.png`。10case（原7+本组三视图），DOM38/viewport9/route31/text22/overflow16；session/customers/policies/policyEvaluations/quotes/organizations各5，cost6/detail2；blocked/unknown/failed均0。自有preview2648137及Chrome root/profile清理全真。没有运行真实API写入或Playwright，开始视图修改前浏览器已结束。

## 实际迁移与验证

原三 guard、位置与装配顺序保留，bootstrap 12968→10972 split。新文件以真实职责分解，结构类型端口只描述原controller，permissions/控制器/矩阵cache仍原引用；数组快照在原渲染时点取，异步回调仍经controller动态读取当前状态。`rebuildWorkspace` 仅在原重建调用点执行，捕获原viewport/immutable/controller；无反向运行时import或God store。

| 新模块（commercial/）     | split | AST最大 | 最长完整函数 |
| ------------------------- | ----: | ------: | -----------: |
| cost-view.ts              |   115 |       3 |          101 |
| cost-matrix-bindings.ts   |    82 |       5 |           61 |
| cost-factor-form.ts       |   150 |       3 |          125 |
| cost-matrix-detail.ts     |   610 |       5 |          123 |
| cost-matrix-ledger.ts     |   398 |       5 |          110 |
| cost-model-heading.ts     |    63 |       4 |           58 |
| cost-model-evaluations.ts |   238 |       5 |          102 |
| policy-view.ts            |   302 |       5 |          102 |
| quote-view.ts             |    39 |       2 |           33 |
| quote-create.ts           |   176 |       4 |           98 |
| quote-cards.ts            |   192 |       5 |          135 |
| pricing-view-ports.ts     |    96 |       0 |            0 |

保持矩阵accepted=false早返、原controller请求序列、live host/局部section替换与输入恢复、280ms debounce/page1、分页失败恢复；因子字段仍点击时生成。冻结报价成本的提交/读回ID/刷新/重建/权限/hash/connected/rAF守卫不变；政策load和报价policy evaluation→revisionState→quote submit→清preferredID→partial refresh→重建顺序保持。Tab Map在原详情actions之后、tabs创建与两attr设置之后创建，同Map传因子/历史panel；首候选曾过早分配，验证中恢复原时点，不是业务bug修复。协调曾误将首候选时点当旧oracle要求传入提前创建Map，直接核85affd3:3260–3265后撤回该审查建议，现保原顺序。

`/tmp/kingturf-3c2-plan-final-2026-10-16.log` 核**实际12模块和完整bootstrap与受限源切片提取计划AST相同**；脚本成功提示虽写token-for-token，实为AST比较（非原始字节声明）。另 `/tmp/kingturf-3c2-inverse-final-2026-10-16.log` 从实际新body、纯表达式、字段/payload及async callback取源，37处受限逆展开，原始helper实参/端口对象/解构桥由计划检查独立核绑定；还原整个旧bootstrap AST相同，保留业务字面量、条件与运算树，不以忽略这些内容造等。原70公开名字和457完整expect链（含not/resolves）全序列相同。独立只读终审组合hash `ff52e31dde02408a66b8bf68f1d35c250882e1730380aaed4b84afa678ebc434` 无必要语义阻塞；该复核不是代跑测试。

## 原测试读源组织及负向实测

只改bootstrap.test.ts读取组织：首个turf handoff字段/WEB-UAT负向case，原root+三sales视图扩大为实际root+原三模块+本组11个runtime模块，各非空、实现锚点唯一；新纯type ports不冒作原运行时代码。原成本来源字段case root→实际cost-factor-form（createCostFactorFields锚点）+cost-matrix-detail（appendCostDetailActions锚点），原三个字段及refresh原文断言保持。route映射仍在root，不适配不必要的测试。

未适配真实web红1/113，日志 `/tmp/kingturf-3c2-web-unadapted-2026-10-16.log`；适配后9/114绿，`/tmp/kingturf-3c2-web-adapted-2026-10-16.log`。本组11runtime模块逐个扰动真实显示文案/字段/placeholder为原禁止marker WEB-UAT，各次原测试真实exit1，逐次全恢复后9/114 exit0，日志 `/tmp/kingturf-3c2-{模块名}-read-source-{red,restored}-2026-10-16.log`。无新expect替换旧expect、无fixture/预算阈值变化。全恢复后再做计划/逆展开/绑定/457核验，均绿。

最终web typecheck、lint、39直接能力/19平台路径、结构0强制/31原豁免、build通过；预算JS11368/CSS1898 gzip不改阈值，workspace bundle bootstrap-DwzsQqL6.js，日志 `/tmp/kingturf-3c2-{typecheck-final,lint1,capabilities,structure-final,build}-2026-10-16.log`。API/packages/infra/workflow/lock/Playwright规格和配置diff为空。此处局部绿不冒作提交后干净实际HEAD全CI。

## 浏览器失败、诊断与待闭环项

新实现合并 `--sales-views --pricing-views` 两次真实exit1（QIls1h/lyJJq2），日志 `/tmp/kingturf-3c2-new-cdp[-retry]-2026-10-16.log`；均只有前5case绿，第6 late-customer-detail 中切换costing超时，实际active/visible仍technical-solutions，不能计13绿。两次preview2808042/2813483及root/profile清理全真；清理后held detail释放触发failedApi1/unknown0，不用该副产物解释更早导航超时，也不隐去它。源码、数据、驱动、参数在第二次原样重跑前未改。

随后只在自有driver增 `--trace-nav-clicks` opt-in 被动观测，默认原路径不加观测调用，不替换真实鼠标事件/不改hash/不静默重试。记录菜单匿名selector/rect/center hit/ancestor展开状态、活动动画及捕获click的实际路由，不记录真实业务文本或凭据。诊断运行 `WQe9Ve` 真实exit0/13case，日志 `/tmp/kingturf-3c2-nav-diagnostic-2026-10-16.log`，DOM44/viewport15/route37/text34/overflow22，session/customers/opportunities/ctrs/solutions/policies/policyEvaluations/quotes/organizations各5、cost6/detail2，blocked/unknown/failed0，自有preview2840464与root/profile清理全真，截图 `/tmp/kingturf-cdp-preflight-WQe9Ve-probes.png`。该次含诊断观测，不冒称无观测原参数已绿。

诊断直接看到costing目标在取点到点击后13.3ms内y420→445，同一point(120.5,438.5)由hit costing变technical-solutions，nav-children动画运行约50ms；但本次捕获的实际click仍是costing且最终hash正确。因此**确认存在移动靶/稳定取点缺口，不把它当两次失败的根因已完全证实**。后续仅自有driver最小可靠性修正/纯JS负向/无诊断合并13单责收尾，不改业务/原超时/断言/网络硬闸/资源清理；完成前本组浏览器稳定路径仍待闭环。

## 失败史与边界

### 后补：9429a31源码全CI与TD-TEST-006工具候选

源码检查点 `9429a31` 稳定干净实际HEAD完整CI真实exit0/177525.943ms（`/tmp/kingturf-3c2-9429a31-head-ci-2026-10-16.log`），结束HEAD不变/工作树空；API117/17099、web9/114、database3/68、domain3/14、config1/4、types1/1、原PG链、读源22/CDP纯JS6、39/19、结构0/31、预算11368/1898、build/audit均绿，协调独立通过。CI不替代浏览器闭环。

先登记TD-TEST-006（台账现38项，原37历史不改），业务影响无，仅自有CDP工具；新增driver.test.mjs，对旧driver真实运行moving测试exit1，实际在x40派发而最终稳定中心是x65，日志 `/tmp/kingturf-cdp-stable-click-old-red-2026-10-16.log`。修正仅driver：初始scroll一次并锁同一真实DOM节点；同一原60×50ms/绝对3秒预算中，连续两次相隔50ms均connected/非零/中心在viewport/真实center hit、x/y/width/height各≤0.5px且scroll位置同；包含目标或DOM顺序在目标之前的sidebar nav-children当前running/pending max-height transition不可放行，不等待无关常驻/opacity动画。getAnimations不可用时回退几何/命中检查、trace标注API可用性。最终point直接真实press/release，不再scroll、不改hash、不静默retry；原waitFor/onlyRoute/业务/Playwright/网络/清理不变。

新driver10项纯JS真绿，含moving、相关/前序布局transition、无关动画、换节点、隐藏/遮挡/越界/持续移动统一deadline无输入、错route仍失败且只点一次；deadline负向仅测试进程局部Date.now虚拟时钟，不改真实超时。连原fixture/network6共16绿，日志 `/tmp/kingturf-cdp-stable-click-{unit,all-unit}-2026-10-16.log`，不计web114。CI仅既有node测试命令精确增加driver.test路径，无依赖/lock变更。

新driver无trace运行 `--probes --sales-views --pricing-views`，WbkqpO真实exit0/13case（原7+sales3+pricing3），日志 `/tmp/kingturf-cdp-stable-click-real13-2026-10-16.log`；DOM44/viewport15/route37/text34/overflow22，session/customers/opportunities/ctrs/solutions/policies/policyEvaluations/quotes/organizations各5、cost6/detail2，blocked/unknown/failed0。自有preview2886115与root/profile清理全真，截图 `/tmp/kingturf-cdp-preflight-WbkqpO-probes.png`。此非全21视图/Playwright覆盖。

独立只读复核driver/10用例/最小CI接入无必要阻塞；采样到派发仍有有限竞态，**不声称彻底消除误点，不由新绿反推旧两次失败根因全证**。业务源码保持9429a31不变，工具单责提交后干净实际HEAD全CI仍待实跑。下文原待验证语句保留各自时点；一次本补充多文件patch因prettier表格空格与匹配行不同被原子拒绝，未应用半补丁，按实际行重做。

生成脚本两次非唯一切片/一次parse预检定位失败，均在应用业务补丁前中止；首个整文件补丁输出过大截断导致JSON解析失败，亦未应用。初次类型检查exit2（入口遗留引用），改为同原闭包rebuild后通过；初次结构门禁4强制，继续按真实focus恢复、核算按钮、报价提交、纯状态/键盘表达式分解，途中类型检查再次拦住新增return换行导致的void（尚未运行该候选业务），改为括号表达式保持原值；第二/第三结构门禁分别拦tabs7层/核算消息6层，继续真实分解后0/31。原嵌套门禁/白名单未放宽。首计划证明误把SourceFile.text全格式当literal比较而红，修比较器排除SourceFile元文本而保留实际literal；逆展开1–3红因未剥quoteContext.ports类型桥，修证明器后第4与final绿，未为证明改业务条件。一次能力命令误用不存在的analysis路径，MODULE_NOT_FOUND，不计通过；改跑实际verify_frontend_capability_manifest.mjs后39/19绿。

源码与本组最小探头单责提交后，稳定干净实际HEAD完整ci:local仍须真实跑；其后driver可靠性单责闭环与最终文档HEAD另验证，再续已授权3c③。回滚本组恢复85affd3，保留3a/3b/R7门禁；原Playwright九spec/config仍未执行且阶段5前全补跑。3f后停整批人工验收，4/5与其他保护区不启动。
