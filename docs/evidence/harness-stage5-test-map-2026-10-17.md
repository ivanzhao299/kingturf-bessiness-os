# 阶段5现状测试地图与补齐清单

## A剩余核心：Quality真实PG六项

新增 `quality-postgres.integration.test.ts`：真实制造发布版本，参数化SQL只种同tenant/item FK的合成QUARANTINE lot；质量仓储实际createPlan→publish→open→sample→三类型result→complete→dispose。固定上下端点10/12与超界12.000001、发布后特征不可改/结果不可删、缺必填结果/类型错误/错误numeric verdict/重复观察拒绝，失败不得新增两ledger/results/audit/outbox，失败检验禁止release但可reject。GROUP仍tenant-bound，三列表及六写入口narrow scope拒绝，foreign发布/使用/transition/dispose拒绝。先占用后段inspection key，使dispose先lot写入后23505，再核counts和有效状态整体回滚、新key成功。最终release的审计/outbox精确配对，不外推全部中间命令均逐项配对。

原strict ESLint/typecheck0；loopback test DB guard实际0/855ms，六项PG实际0/null/15742ms（Vitest14.83s），日志 `/tmp/kingturf-stage5-quality-pg-{guard,first}-2026-10-17.log`，owned随机schema正常close，期间无其它PG/浏览器。独立只读核验无必要阻断。单lot/固定INCOMING plan，不充真实采购收货、生产issue消费方、HTTP角色、并发或全characteristic矩阵；产品/SQL迁移/旧oracle/覆盖分母不改。doc-lint当前被尚未纳入index的F草稿阻断，需F独立收口，不伪报文档门禁绿。

## A文档真实动作合同补齐（TD-TEST-007）

新增 `online-document-actions-behavior.test.ts` 12项，实际调用 save/review/send-form，不改原广源测试、旧expect或产品。固定文档ID/版本7，独立完整payload，API/history/onSaved的裸调用receiver，save/review等待与失败重试、后续本地编辑不覆盖、三审核动作状态，发送仅当前READY译文、失败同payload复用key/变更payload新key、QUEUED回执不输出收件地址。初次tsc拒绝测试夹具缺provider/错误DRAFT译文枚举及非UUID型mock key；仅新测试改为合法QUEUED/provider/固定UUID形状后，原strict ESLint/typecheck0，12/12实际0/415ms，日志 `/tmp/kingturf-stage5-online-document-actions-second-2026-10-17.log`。独立只读核验与实现一致、无必要阻断。

此为原补齐队列#4的专门行为护栏，TD-TEST-007仅实施待最终门禁，不宣称旧关键词本身变精确。DOM与openForm/requestId为受控端口；不证明原生校验、真实HTTP、外部投递、服务端幂等或全部并发组合。队列#2仍须补本轮Quality/Shipment真实PG核心；现存foundation PG已直接覆盖文档create/translate/未批拒send/异人批后send/重放冲突，production PG已直接覆盖成本policy/calculate/异人批/close，Order360已有真实HTTP+PG入口/来源/tenant/SELF投影。provider零命中不等于零SQL；不重复这些既有链，也不把剩余核心承诺挪到F“后续立项”。

第二路建议后再将初始documentData.currentVersion固定3，与操作state.activeVersion7分离；审核/发送显式POST，发送表单创建后activeVersion改9仍取提交时live版本。原strict lint/tsc再0、12/12实际0/359ms，日志 `/tmp/kingturf-stage5-online-document-actions-final-2026-10-17.log`；不宣称未单独测试的pending期间summary/time投影或外层权限/渠道门禁。

## E旧QTC装载可移植修复（独立测试工具，不改产品）

父7fb4324登记后，完整旧源码复制为`apps/api/test/fixtures/qtc-root-capture-app-c7833e74.ts.fixture`（纯文本202118字节），与完整历史commit的原blob逐字节SHA相同，未删剪/改写代码。`qtc-root-capture-source.mjs`装载前校原Buffer字节数+固定SHA，缺文件/截断/等长篡改固定fail-closed，无fallback/运行时Git查找。probe仅替换读取渠道，原appUrl/TS transform/import重写及所有166+166场景/golden/335断言零diff；原golden另pin SHA。来源和摘要见TD-TEST-019及helper固定metadata，旧源码仍配当前依赖，**不是完整历史依赖复原**。

工具4/4实际0（缺失、截断、同长篡改、golden摘要）；原335正常Git实际0/723ms。以新独立空对象目录、空alternates、GIT_NO_LAZY_FETCH=1运行**完整原335**实际0/689ms，和修前原old探针缺对象exit1成对。不是拿missing fixture单测冒充缺Git实测；日志`/tmp/kingturf-stage5-qtc-source-{tools-first,335-first,335-missing-object-green}-2026-10-17.log`。原工具ESLint/Prettier0；原frontend-runtime-sources同Node--test组仅追加新source.test，完整test:release-guardrails实际0（含原Python10），日志`/tmp/kingturf-stage5-e-regression-guardrails-2026-10-17.log`。独立只读复核hash/来源/最小diff/失败关闭无必要阻断，产品/SQL/原期待/依赖/workflow不改。新完整CI仍待后继固定HEAD执行。

E机械P1补验：当前git core.hooksPath=.githooks，直接执行真实commit-msg hook读owned临时固定消息，非法非Conventional实际exit1、合法test(gates)实际exit0；日志`/tmp/kingturf-stage5-commit-hook-{red,green}-2026-10-17.log`。这是独立hook实测，不冒称ci:local自动模拟git提交。

E链内运行时事实以3f03e62完整CI日志为准：REG001原335；S2 login-rate-limit18/login-rate-limit-http7/client-address35；S4 browser-session-api33/session-proof11/auth-http-postgres20、Web browser-session35/http17/config browser-session42实际执行。S4 SEC003历史优先级P2不改成P1；真实Chrome网络矩阵不在默认CI。DUP001共享scope-sql分域合同与真实PG路径、DUP002各仓审计/outbox回滚及新六域实际执行；Web/BOUND当前bootstrap/边界87/控制器路径实际执行。API001复杂度/TEST001剩余PG缺口/SEC001强制仍开放，不冒充运行时已修复。TEST009旧证明脚本仅lint入口不称默认回归；TEST011完整seed/demo:seed/Dockerseed不在默认CI，P线前置实测与浏览器义务另列。后继最终E新HEAD完整CI需再核这些入口真实运行。

## E旧回归探针缺对象真实红（TD-TEST-019，仅登记）

原QTC old装载在隔离空Git对象目录/禁lazy-fetch实际exit1，缺c7833e7；repo正常对象和配置未改，既有335护栏在3f03e62完整CI仍绿。此是测试装载可移植性问题，不是旧业务回归复发。已先登记[TD-TEST-019](../exec-plans/tech-debt-tracker.md)，原58+PROC/RISK+本项=61，F不能漏新项；下方60等均历史。完整旧app文本fixture+固定commit/blob/字节SHA、保原166+166/335及当前依赖映射的候选已独立只读核，无必要阻断；尚未实施/未有空对象绿，不改产品/原oracle/workflow。

## 表单payload后继独立复核补强

46f6f7b后第二路建议已补：BOM两种替代料用例均deferred finish，resolve前外层回调未settle，resolve后settle，并显式finish reject向上传播；不再仅靠立即resolve的finish spy。CAPA每路前两次requestId端口返回不同固定值，第二次submit payload必须带second-command-key，不能只调用requestId却重用旧key。仍不证明生产随机key唯一/后端幂等。原eslint/tsc0，制造5+CAPA5实际10/10、exit0，日志`/tmp/kingturf-stage5-manufacturing-capa-strengthened-2026-10-17.log`。下方初版范围保留作时点历史。全部生产源码仍无diff，准备在本轮提交后的干净HEAD运行完整ci:local（含真实六包覆盖check）；此前单包数值不冒称总体达标。

## 制造／CAPA／成本因子表单固定payload护栏

新增制造表单5项、CAPA5项、成本因子4项及生产src外typed operations-context fixture，未加依赖/改产品/扩大覆盖排除。真实工厂与回调，openForm和finish/controller是受控端口：物料草高有/无、发布false、BOM根ID≠版本ID/固定decimal字符串/500bp/替代料有无；三工序固定code/工作中心/10/20/30次序/不同setup与节拍。只证明入参映射，制造日期为文本拼接，不证明未知product/日期合法性/权限/发布仓储约束。制造finish失败只显式覆盖item/routing，不称BOM全失败矩阵。

CAPA五路独立完整载荷：创建投诉版本7、动作CAPA8、完成CAPA9、验证投诉10/CAPA11、关闭CAPA12，冻结时间2026-10-17T12:34:56Z、证据/责任人/根因/验证内容与requestId端口固定key。每路pending submit时refresh0、完成后1；submit reject无新增refresh、refresh reject向上传播。员工显示名/编号/无名fallback、关闭原evidenceFields引用。这里固定key证调用requestId与载荷接线，不证明实际key生成唯一性或后端幂等，factory本身也不是权限检查。

成本因子新建/编辑选项引用、关联采购可空、编辑不含code/无物料不含selector、税率/step/预填；完整独立payload保持1.234567/12.345678为字符串、sortOrder 4转number、可选空key省略及现有默认值。字符串精度保持不等于财务算法正确/非法数字验证。

原eslint/tsc0，制造5/5实际0/296ms，CAPA+factor9/9实际0/343ms，独立只读复核无必要阻断；日志`/tmp/kingturf-stage5-manufacturing-forms-first-2026-10-17.log`、`/tmp/kingturf-stage5-capa-cost-factor-first-2026-10-17.log`。单包V8 Web25/413实际0/2.28s，`coverage/web-form-payloads-167e1fd-first/coverage-final.json`原算法11286/20592（制造216/216、CAPA202/202、factor145/145）；政策补强后原eslint/tsc0、Web25/414实际0/1.99s，日志`/tmp/kingturf-stage5-web-form-payloads-final-2026-10-17.log`。以上不是六包check/最终CI，也未更新B/TEST002；全量覆盖是否过75%仍由干净HEAD真实门禁确认。

## 政策新断言独立反例复核与真实筛选变异

167e1fd后的第二路指出风险mixed政策样本DRAFT/PUBLISHED同id/code/version，错误筛DRAFT也会假绿。已只改新样本草稿为draft-version-99/DRAFT-ONLY/v99，PUBLISHED预言仍version-1/RISK-1/v2。新7项原实现实际0，随后仅真实实现`order360-risk-controls.ts`选项`.filter`临从PUBLISHED改DRAFT；原期待不动，具名`pins only published options and employee, uses UTC end-of-date and waits for current load message`实际红（1败6过/exit1/313ms），diff显示收到草稿身份而非发布身份。等close后完整还原，原/恢复SHA256均`36b4a56e26fd6109d8a4bb4c49889eb3c7ab987bb752c8849eb8066146b380cd`、源码diff0，再7/7实际0。日志`/tmp/kingturf-stage5-risk-options-{distinct-green,filter-mutant-red,restored-green}-2026-10-17.log`。这是新断言有效性取证，不替代已记C最低三类或最终CI。

销售政策最新版同补正反两种输入序（v2/v1、v1/v2），原固定最大版本卡片预言不变，避免只抓last却放过first替代；现7项而非早期6项。后继Web全包结果另在下方表单payload补测中记录，不改产品终态/B/阈值/原测试。

## Web销售／风险政策固定预言与版本控制

父dfd063e新增policy-view六项、risk-controls七项，真实模块回调、表单/控制器为mock端口。销售政策独立完整规则预言：20.55%→2055bp、10.256%→1026bp，创建/修订publish true；评价30.125%→3013、2.255%→226、只列已发布政策与固定成本选项，列表给定DTO的通过/审批/原因/hash展示不充实际规则引擎输出。销售政策与CTR最新版本样本改为v2在v1前，锁最大版本而非最后输入；CTR修订拒绝另补status sentinel，原11项不删。创建销售政策deferred load后读当前message，其它销售动作失败不reload/不覆盖status，不冒称逐路径延迟load。

风险政策固定五rule code、bp/天数数值、effectiveAt UTC日始；修订按snake-case预填/根ID，payload不含publish。版本卡权限/状态、发布固定version路径，发布仅成功pending后load，不声称reject已处理。createRiskPolicyButton是无权限factory，caller权限不在本例。风险评价按钮gate按权限+订单/政策**数组非空**，只有options过滤PUBLISHED；不称仅草稿政策时按钮隐藏。固定订单/责任人/版本ID与validUntil/dueAt UTC 23:59:59.000Z，invalid日期提交前拒绝、deferred load后当前message；create/revise/evaluate失败不reload且status sentinel不变。均不证浏览器/后端。

原eslint/tsc0；policy首次tsc缺完整未使用query结构，仅补完整原类型值不放宽规则；target销售6/6实际0/312ms、风险7/7实际0/320ms。全Web22/399带V8实际0/2.31s，`coverage/web-policy-risk-dfd063e-first/coverage-final.json`按原算法10742/20592，policy296/296、risk-controls224/224。独立只读复核无必要阻断，据建议补状态sentinel；后全Web22/399再次实际0，日志`/tmp/kingturf-stage5-policy-risk-final-2026-10-17.log`。首单包V8日志`/tmp/kingturf-stage5-web-policy-risk-coverage-2026-10-17.log`；后继断言补强不更新B，以上非六包门禁/完整CI。产品/原测试/PG/seed/P1四值不改。

## Web技术需求单版本与动作护栏

父874e4d6新增`ctr-view-behavior.test.ts`最终11项，真实appendCtrView与回调，独立写定输入50.5/8000.25/8→requirements数值字段，不从生产mapper生成期待。创建路径deferred load期间status不变，改变controller.message后resolve再观察新消息；创建/修订submit reject不load。最新非DRAFT根版本可修订，旧版本/无根/最新仍DRAFT均无修订按钮；旧新规格差异与附件计数、修订预填/固定根路径与payload。上传固定版本ID且原File引用、不额外load；提交评审固定expectedVersion，两审批固定decision/reason；各拒绝后不写成功status。严格等待load后读取当前message只在创建路径动态验证，未泛称所有回调均有延迟测试。

原eslint/tsc0；首10项9过1败/exit1/334ms，新测试upload文本定位误取只有一个按钮文本的父actions，改精确BUTTON，不改产品或业务期待。随后带V8全Web20/385实际0/2.16s（`coverage/web-ctr-874e4d6-first/coverage-final.json`按原算法Web10349/20592、ctr473/473、lead218/218）；复核建议后增最新DRAFT负例，最终Web20/386实际0/1.85s。日志`/tmp/kingturf-stage5-ctr-view-first-2026-10-17.log`、`/tmp/kingturf-stage5-web-ctr-coverage-2026-10-17.log`、`/tmp/kingturf-stage5-ctr-view-final-2026-10-17.log`。openForm/openFileForm与控制器端口为mock，不充真实浏览器/上传/PG；单包覆盖不更新B、不充六包门禁或完整CI。独立只读复核无必要阻断，产品/原测试/seed保持。

## Web线索列表渲染与命令接线护栏

父4840b35新增`lead-records-behavior.test.ts`9项，真实appendLeadList/CrmController.visibleLeads与leadPageItems；12条pool加重复lead样本真实去重、第2页两行、search回1页并显示唯一匹配、分页回调/空队列。新增/生命周期/分配/改派/释放固定payload与原Lead引用、权限/整数版本/已知owner门槛；员工选项/无选项输入区别。create pending完成前不bootstrap、成功后原shell/controller引用；各form命令reject不bootstrap。claim只测原对象传入与成功等待，不称reject恢复（源码.then无catch），不制造未捕获拒绝。

openForm与实例createLead/claim/mutateLead被mock/spy，故不证明真实API写入/控制器二次权限或浏览器原生表单。独立只读复核无必要阻断。新测试首lint一处void简写及tsc一处exactOptional显式undefined，分别改块体与实际缺省version样本，原规则不降；原eslint/tsc0，target9/9实际0/316ms，日志`/tmp/kingturf-stage5-lead-records-first-2026-10-17.log`，Web全19文件375项实际exit0，日志`/tmp/kingturf-stage5-lead-records-final-2026-10-17.log`。产品/原测试/网络/B不改，不充最终CI/六包覆盖门禁。

## Web共享表单与文件表单编排护栏

父d11e9b9新增`forms-behavior.test.ts`24项，调用原openForm/openFileForm。明确将native validity与FormData作为受控外部输入，验证字段metadata/选项/初值/分组/提示、现有datetime-local映射为text、无效控件计数/焦点/aria修复、entries trim及非字符串转空、busy重复submit拒绝、成功close/remove/finally恢复、Error/非Error失败保留并重试、dirty取消/Escape确认与无confirm分支。敏感操作只证明**勾选后按钮启用及失败恢复当前勾选状态**；submit listener本身不校checkbox，不把该UI提示写成后端/程序submit安全门禁，不顺改产品。文件例注入实际File的size元数据，验证25MiB+1拒绝/恰好边界接受、传原File引用、失败重试/取消/按钮恢复，不分配大buffer、不充真实上传。

首原eslint/tsc0，target23过1败/exit1/317ms：Vitest节点深matcher格式化要求partial double未支持的getAttributeNames，未扩伪DOM API，只改FormData spy次数+首参toBe同form引用；第二24过/exit0/324ms。独立只读复核无必要阻断并收窄敏感按钮措辞。日志`/tmp/kingturf-stage5-forms-{first,second}-2026-10-17.log`。

后继原eslint/tsc0，同冻结include/exclude单包V8 Web18文件366项实际exit0/2.13s；`coverage/web-forms-d11e9b9-first/coverage-final.json`按原算法9835/20592（相比最后六包8937增898），forms235/235、production-actions224/224、shipment-actions97/97。日志`/tmp/kingturf-stage5-web-forms-coverage-2026-10-17.log`。此工作区单包测量非六包门禁、不更新B/不关TEST002、非完整CI。固定microtask与DOM/native端口限制同上，不声称穷尽所有分支/原生校验/真实浏览器提交。

## Web生产／发运动作回调护栏

父c14884e新增`fulfillment-actions-behavior.test.ts`15项，复用部分DOM；只mock表单入口以捕获原生产回调，不mock生产/发运动作模块。固定四工单状态→权限/action/reason/evidence/key，终态无按钮；报工固定decimal/key与ISO日期、无效日期先拒绝；领退料按append时balances引用（换Map值不偷换批次），固定库存IDs/日期/无效索引；成品按固定report/location选项和order itemVersion提交（locations同样在append捕获）。不把选项端口当真实库存/质量门禁。

发运验证RELEASED/权限/已有shipments门槛；非数组也显示按钮明确为当前兼容行为，不是合法业务数据背书。固定运单/封车证据/key；POD过滤DELIVERED、按所点击shipment绑定ID/回单证据。四transition的pending submit尚未完成时不refresh，发运pending submit不load，pending load不更新status；所有动作类别有submit reject后不刷新/不写成功状态，发运load reject也不更新成功状态。并未逐个证明refresh自身等待、真实表单校验、API接收或后端事务。

独立只读复核无必要阻断并据建议补失败/延迟load断言；首lint1处测试recordText对unknown stringify，改显式string/number分支，不降规则。原eslint/tsc0，首15/15实际0/336ms，日志`/tmp/kingturf-stage5-fulfillment-actions-first-2026-10-17.log`；补强后Web全17文件342项实际exit0，日志`/tmp/kingturf-stage5-fulfillment-actions-final-2026-10-17.log`。无产品/种子/网络硬闸改动；这不是浏览器全套、六包覆盖门禁或最终CI。

## Web上下文业务文档真实回调护栏（Node端口，不是浏览器验收）

父62cd870后新增`contextual-documents-behavior.test.ts`十项（含表驱动），调用原`appendContextualDocuments`和HTML构建器，不改生产实现；新增`test/fixtures/behavior-dom.ts`明确为部分DOM double及四项自测。helper在生产src外，不新增依赖、不移除原src夹具、不改变冻结377生产源/覆盖分母；Web tsconfig只扩include到test/\*_/_.ts以接受原严格lint/tsc检查，未放宽规则。

独立固定payload/HTML sentinel验证：管理与只读入口、无权限无读取、模板选择/下载点击接线、wrapped/unwrapped subject列表先截100再过滤坏ID、subject原对象传给label/prefill（mock参数`toBe`）、订单联动客户/三员工绑定、可选ID省略、POST双击忙态/固定字段/转义、原创建与详情DTO引用传入编辑器、五权限位、保存回调版本更新。详情只在点击后GET，重复点击仅一个pending请求，创建/读取Error及非Error失败后按钮恢复且重试有实际编辑器/终态断言；空列表与失败区分，技术资料路由不读subject。保存测试只证首次打开和回调更新，不称保存后再次打开已覆盖。

独立只读复核无必要阻断，指出深等不等于引用，已补精确toBe。模拟锚点clickCalls只证handler接线，不证真实下载；visibleAppRoutes固定端口只证输出过滤/去重，不证实际权限映射。helper无原生校验/事件冒泡/布局/网络/真实modal，固定五轮microtask不是通用异步静止证明，以上不替代原Playwright/CDP。

初始helper原lint两处（void简写/tsconfig范围），新增测试七处require-await/void/optional风格及一处多余optional均仅修新代码；原规则不降。最终原eslint/tsc0，Web16文件327项实际exit0/1.88s，日志`/tmp/kingturf-stage5-web-contextual-final-2026-10-17.log`。首轮同冻结all/include/exclude的单包V8亦16/327、exit0/2.02s，`coverage/web-contextual-62cd870-first/coverage-final.json`按原同行statement-start max计Web9341/20592（前8937，同分母增404），contextual-documents420/420。补引用断言后第二轮16/327、实际exit0/2.06s，`coverage/web-contextual-62cd870-final/coverage-final.json`同9341/20592，日志`/tmp/kingturf-stage5-web-contextual-coverage-final-2026-10-17.log`。命中全部计数行不等于全部业务/浏览器语义；这两次dirty WIP单包测量不更新B、不称新六包check/完整CI或TEST002验收。

## 六域专项实施齐备：驾驶舱最后一域（非全阶段验收）

父6081dfb后新增`dashboard-postgres.integration.test.ts`，每例复用owned真实商业图。五项真实guard0/PG5过、exit0/null/17740ms（测试15088ms），显式shuffle.tests/seed20261017及start/result记录；日志`/tmp/kingturf-stage5-dashboard-pg-first-2026-10-17.log`。首lint1处refreshedAt可能object被String转换，改显式string guard，原lint/tsc/format0，不降规则。独立只读核源码/输入与固定oracle，无必要阻断。

独立固定十指标：商机950000×60%=570000、订单950000、固定报价毛利250000、已分配100000、应收/逾期850000、订单1、风险活动1/critical0、佣金计提28500；非从产品输出自动造期待。验证真实订单状态/来源/basis、钻取行、SELF/COMPANY/GROUP同owner可见、同tenant非owner/外tenant/空scope所有值零与钻取空；起点含/终点不含，现金按allocation.created_at而非银行received_at；关闭风险任务后活动0但钻取仍CLOSED；取消佣金后原计提额仍在聚合。get前后audit/outbox/risk_events/commission_entries计数不变，只称所列证据无新增，静态SQL为读，不冒称完整数据库写监控。

查询不对称明确为**现状刻画，不是业务正确性背书**：USD仍显示风险（无currency谓词）；future from仍保留AR/risk（仅as-of to）；取消佣金仍计commission_amount（无有效状态过滤）。不为“统一口径”改SQL，也不把本合成图数值移植到P1。此专项单图/币种数据、未覆盖每个组织锚点/20条订单limit/多币种汇率或全财务算法，P1原四值仍C7。

六份新增PG专项均有实际绿记录（分别的最终检查点，**不是同HEAD全链或最终三连CI**）：制造6、MRP8、采购8、风险6、佣金6、驾驶舱5，共39项；每域独立提交，原scope/事务不发明幂等/审计机制。TEST003仅实施待终验；PROC/RISK新债仍开放，A其它真实缺口/B三目标/D三连/E/F/浏览器义务均未被这39项替代。下方5/6及更早进度按当时时点保留。

## 后继实际补测：佣金专项PG

父ec16d93后新增独立`commission-postgres.integration.test.ts`，每例复用已核共享真实商业图/owned schema、原lint/tsc/format0。六项覆盖policy版本/发布/不可变及audit+outbox精确action/aggregate/id/version；独立固定950000收入、250000毛利/2631bp、100000回款→1052bp、300bp→28500，三独立政策分别自动RELEASED/回款FROZEN/毛利FROZEN及seq1/2账；真实SELF/TEAM锚点/外租户/无scope与同tenant非owner不可见；同key持久行重放无新增、新key同业务唯一冲突；释放门槛、付款/追索必填外部引用、PAID/CLAWED_BACK各28500及连续账/累计金额/终态/不可变；无效refs/期间格式及后置outbox冲突时ledger/状态/version/audit整体回滚。初始图已另有AUTH-COM记录，不假定空表，也不因helper名称把它计作RELEASED证据。

首guard0，全六项实际5过1败/exit1/null/20593ms：新测试误取首次返回不存在的canonicalHash与replay.canonical_hash比较。产品首次DTO和持久行形状本来不同，未补产品字段；等close后改为**重放前**读既存hash快照、校64hex及固定金额，保id/order/前后count/audit/outbox无增，第二轮6过/exit0/null/20327ms。独立复核指出owner=beneficiary样本无法区分错误按受益人过滤，补真实另一同tenant受益人：builder SELF仍可见，reviewer SELF即使是beneficiary仍不可见；最终6/6、exit0/null/20429ms（测试18550ms），真实shuffle.tests/seed20261017及start/result记录证明乱序。日志`/tmp/kingturf-stage5-commission-pg-{first,second,final}-2026-10-17.log`。独立只读核固定oracle/事务后段冲突/范围无必要阻断。

口径：重放比较是既存身份/hash不变，不把DB值当金额算法预言；金额/比例/状态均独立固定。无真实外部付款、outbox投递、全币种、并发、后续实际回款后释放矩阵证明；各层鉴权仍分别由HTTP契约验证，不把direct repo context当全权限体系。未改生产/原fixture/P1数值/seed/网络。TEST003目前5/6，驾驶舱及其它A缺口、B目标和最终CI仍欠。

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
| 佣金                                      | commission-route-contract、scope-sql-commission                                                                    | 新commission-postgres专项6项真实PG绿，固定金额/范围/ledger/证据回滚（详见本文）                               | 共享；财务风险CDP历史                                                  |
| 风险                                      | risk-route-contract、scope-sql-risk                                                                                | 新risk-postgres专项6项真实PG绿，固定评分/状态/租户/回滚；TD-RISK-001只登记不修（详见本文）                    | 共享；财务风险CDP历史                                                  |
| 经营看板                                  | dashboard-route-contract、scope-sql-dashboard                                                                      | 新dashboard-postgres专项5项真实PG绿；固定十指标/scope/时币边界/当前投影（详见本文）                           | 共享；财务风险CDP历史                                                  |
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
