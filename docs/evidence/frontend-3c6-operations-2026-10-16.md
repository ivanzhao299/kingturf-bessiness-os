# 3c⑥ 制造、采购、MRP 与质量（2026-10-16，候选）

## 现时检查点

业务候选源码**3f77a81**稳定干净实际HEAD完整`pnpm ci:local`真实exit0/**170456.489ms**，`/tmp/kingturf-3c6-3f77a81-head-ci-2026-10-16.log`；结束HEAD不变/树空。API117文件17099例、web9/114、PG链、读源22/CDP纯JS20、39权限19路径、structure0硬31旧软、预算11368/1898、audit零漏洞通过。36helper逆展开/70公开457链/27新runtime逐目标红→还原114、旧新同口径11与独立静态复核齐。

⑥整体仍待TD-TEST-006工具问题收口，无trace全28失败与trace28绿分别留证；业务全CI绿不替代浏览器组合结果。后续工具修正独立提交、业务源码零diff；完成docs实际HEAD也须完整CI。下方“待实际HEAD CI”为提交前时点历史。

## 独立工具定位与候选

工具候选首轮无trace全组合myDiOW/28项真实exit0（`/tmp/kingturf-3c6-tool-new-cdp28-2026-10-16.log`），DOM78/viewport45/route67/text134/overflow54，网络阻断/未知/失败0，preview3123110退出/root/profile清理全真。此正常运行未开任一trace；与旧有trace28计数一致，但不反推旧失败全是同因。只读独立复核工具diff无必要修正，原10测试逐字不动、阈值与业务一致、默认不执行观测，类别不代表CSS全稳定的限制保持；诊断读布局可能影响竞态，不能充作正常通过证据。独立工具实际提交HEAD全CI及提交后正常28另执行，未提前关闭复开条目。

在3f77a81完整CI结束且确认树空后，才给driver增加可选`--trace-click-layout`只读观测（初滚前/后/失败读取bbox、滚动祖先尺寸/scrollTop及动画，不增加操作或成功判定）。FbxNIM针对性现场真实exit1（`/tmp/kingturf-3c6-tool-scroll-diagnostic-2026-10-16.log`），24项先绿、制造desktop导航失败，preview3122795退出/root/profile清理全真。首滚前`innerWidth=1440/height=1000`，但MAIN=`app-shell mobile`，侧栏width1425、clientHeight=scrollHeight=1000、scrollTop0、target x915.5/y113；滚后仅window scrollX23、侧栏仍scrollTop0。约3秒后壳切desktop，侧栏width232、clientHeight1000/scrollHeight1488、scrollTop0，target x26/y1071，动画空。

该轮已证唯一滚动发生在旧移动布局，后resize改变滚动容器与目标位置；`crm/shell-frame.ts`原resize handler同步设置shell及已有commercial class，但事件执行晚于CDP metrics返回；driver旧viewport只等innerWidth/Height。不能将这份完整因果追认此前YgfqPn/a68rso/CQwqNj全部失败根因，也不修业务resize或延迟策略。

TD-TEST-006已在3f77a81先复开登记。独立最小候选只加强viewport原**同一次60×50ms waitFor**：metrics相等且如shell存在，其类别按真实viewportFor宽度阈值640/1024匹配；如shell下commercial存在也匹配。无shell（首登录前设metrics）仍正常通过；类别不按CDP mobile布尔值推断。不增加新等待预算、不写DOM/权限/路由/hash、不改click唯一scroll/原3秒/双50ms几何/真实命中/press-release/网络/清理/Playwright。类别同步不证明所有CSS过渡结束，原点击几何保护保持；若仍复现须继续基于现场定位，不盲目再加等待或滚动。

独立延迟布局VM在旧viewport真实红（`/tmp/kingturf-3c6-tool-viewport-old-red-2026-10-16.log`）：metrics即时变化，但shell/商业类别第3poll才同步，旧方法第1poll返回，`stale !== mobile`。修后原driver10断言原封不动＋新增3项、纯JS总23真实0（`/tmp/kingturf-3c6-tool-cdp-unit-2026-10-16.log`）：三宽度×shell/仅commercial延迟均等3poll、无shell1poll、永久stale恰60poll拒绝且无Input操作。业务/apps/packages/lock/workflows相对3f77a81零diff。新无trace28正在串行实际执行，独立工具提交后实际干净HEAD完整CI待跑，不预填修复/组合通过。

## 范围与输入

输入源码00766d6、完成docs693c42f；后者稳定干净实际HEAD完整`pnpm ci:local`真实exit0/173041.324ms，日志`/tmp/kingturf-3c5-693c42f-head-ci-2026-10-16.log`，结束HEAD不变/树空。沿既有3a→3f连续授权，不重复索许可，3f后整批人工验收。主代理完整读取旧bootstrap制造1897–2247、采购2248–2941、MRP2942–3249、质量3250–4240；只读代理核对路径/边界并独立审查。原70公开绑定、9文件114用例、457完整expect链与Playwright九spec/config冻结。API/packages/SQL/依赖/lock/评分/workflows不动，31旧豁免/12000与4000预算不变；TD-WEB-004仅登记不修、39项台账保持。

四原guard仍在root原序调用；新27runtime/1type按真实职责拆分，不用整块god factory或回调重置计量。root8129→5848 split，商业21/21主视图均已迁，但共享编辑器/列表工具/装配等仍在root，不称巨石清零、3c整批完成或撤豁免。共享残留后续继续，3d治理、3e store/date、3f边界未提前实施。

## 行为对拍与模块地图

主代理临时生成器`/tmp/kingturf-3c6-extract.mjs`按旧原文切片，经apply_patch写入；一次整patch输出被工具截断导致JSON解析失败、零应用，后按模块/四root块分批应用，未靠reset覆盖。首次typecheck真实失败：制造panel仍在root却未传参、两个表单漏publishedItems参数、supplier漏manufacturingItems参数与误识别status未用、type导入路径错误；均仅补同名同ref参数/修type路径/去未用解构，不改原业务。修正后typecheck真实0；不以随后绿覆盖首失败日志`/tmp/kingturf-3c6-type1-2026-10-16.log`。

临时`/tmp/kingturf-3c6-proof.mjs`对实际候选文件做36helper逆展开：逐处校验实参与形参同名、root结构端口引用、factory末return确为原节点，仅剥新限定桥接；async helper重新展开为原void async IIFE，所有业务条件/字面量/操作符/旧回调完整参与对拍。整份00766d6 bootstrap AST相等，70公开value/type名称与457完整expect链相等，初次和27目标全还原后的最终日志均exit0：`/tmp/kingturf-3c6-inverse{1,-final}-2026-10-16.log`。以下split/AST/完整有body函数最大值均实际递归量取，最大file221、完整函数143、AST5：

| 模块                            | split | AST | 完整函数 |
| ------------------------------- | ----: | --: | -------: |
| manufacturing-view              |    90 |   3 |       85 |
| manufacturing-cards             |    90 |   5 |       57 |
| manufacturing-forms             |   221 |   3 |       93 |
| supplier-register               |   129 |   4 |      124 |
| sourcing-register               |   148 |   4 |      143 |
| purchase-register               |    41 |   3 |       35 |
| inventory-register              |   101 |   5 |       96 |
| procurement-view                |    78 |   2 |       70 |
| purchase-order-cards            |    54 |   5 |       49 |
| purchase-documents              |   146 |   4 |      141 |
| purchase-actions                |   141 |   5 |      136 |
| mrp-view                        |    61 |   2 |       55 |
| mrp-actions                     |   146 |   4 |      141 |
| mrp-run                         |    44 |   3 |       39 |
| mrp-proposals                   |   116 |   4 |       66 |
| quality-view                    |    57 |   2 |       49 |
| complaints-view                 |    40 |   3 |       34 |
| complaint-actions               |    93 |   5 |       87 |
| complaint-assignment            |   121 |   5 |       58 |
| complaint-rows                  |   100 |   4 |       93 |
| complaint-ncr                   |    66 |   4 |       61 |
| complaint-workflow              |   138 |   4 |      127 |
| capa-forms                      |   209 |   2 |       51 |
| quality-plans                   |   118 |   5 |      113 |
| quality-inspections             |    91 |   4 |       85 |
| quality-inspection-cards        |   137 |   5 |      132 |
| quality-traceability            |    29 |   4 |       25 |
| operations-view-ports（纯type） |    39 |   0 |        0 |

制造definition数组及三new Date仍每次render执行；点击才get已发布物料、构造options/finish，item/BOM/routing三表单真拆分，lookup、条件payload、日期拼接不改。制造panel保留root原创建点，以同ref参数传入。采购八views原序快照、单refresh与四列完整节点创建点保留；每PO文档get/filter原位，OCR/签章分支不修；上传仍外层检查方法存在、change时晚取`controller.api.uploadContractDocument?.(...).then(refresh)`原receiver。MRP早latestRun/publishedOptions、原复制排序、冻结覆盖field/payload/按钮顺序不改。

质量三views早捕获，complaint→plan→inspection→traceability顺序不改；每render一个selected Map、同ref传actions/rows，批量submit时读取values及原对象版本。旧list complaint.version与点击fresh `await controller.api.get?.(...)`获取的ncr/capa版本各保留；新`void runComplaintWorkflow(...)`无额外await/新catch，保持旧IIFE到首await同步执行。闭环分支优先返回顺序、evidenceFields同数组、actions/incomplete在前几个NCR/CAPA分支之后才读，transitionNcr conditional payload与requestId/Date时点不改。独立只读全组及投诉闭环专审均未发现必要修正；静态审不替代写流程测试。

## 冻结测试真实读源与负向验证

原未适配9/114首跑也绿（`/tmp/kingturf-3c6-web-unadapted-2026-10-16.log`），但不能当新增27源负向覆盖；只扩原turf用例的source集合，以实际27runtime各唯一非空函数锚读取，纯type不列，原expect/fixture不改。每新模块实际业务字符串/DOM tag/权限literal改为WEB-UAT，27次测试均真实exit1，各完全还原后9/114真实exit0。不是改锚点造红，也未用绿掩盖未绑定；日志`/tmp/kingturf-3c6-{模块名}-read-source-{red,restored}-2026-10-16.log`。最终逆展开/70/457复算仍相等。

局部串行typecheck/lint/structure（0强制31旧豁免）/能力39权限19路径/纯JS20/build均真实0，日志`/tmp/kingturf-3c6-{type-final,lint,structure,capability,cdp-unit-final,build}-2026-10-16.log`。build bootstrap-BaD-4Pt7.js、index-BotpVzCv.js，登录gzip11368/1898；不替代提交后实际干净HEAD完整CI，结果须另记、不得预填。

## CDP 只读范围与旧基线

新增独立`--operations-views`：12个read权限、17个精确GET、4个主页面case；默认7/原各opt-in与driver10/网络硬闸/生命周期不改。制造item/BOM/routing3，采购supplier+procurement+inventory3（其中procurement真实引入RFQ/quote/PO/receipt四GET）共7GET，MRP policy+mrp2共3GET，quality-plan/quality/traceability/complaint4共4GET；制造items仅复用不重复计。唯一query为complaints精确`limit=100`、单页nextCursor:null，其他16无query；错query/未知详情/写请求拒绝。MRP proposals来自runs[0].proposals非空，不造独立endpoint。纯JS20项通过，新增fixture测试实际拒绝默认路由、写和错分页，检查12 read-only及17非空单页；其余19不改。

四页双viewport真实导航/独占显示/标题/非空子卡/overflow：制造三版本、采购供应商/RFQ/quote/PO/receipt/balance、MRP政策/run/proposal、质量plan/inspection/lot/complaint行。无complaint-sla:read、NCR/CAPA虚构read权限、文档read投影绕过；不称投诉创建/质量闭环写流程、采购文档上传/OCR/签章、真实账号安全矩阵、SQL/API或Playwright覆盖。

旧源码dist来自693c42f完整CI，旧首跑pbLEKr/11项真实exit0（`/tmp/kingturf-3c6-old-cdp11-2026-10-16.log`），DOM40/viewport11/route33/text50/overflow18；17新GET各5、cost6/detail2，网络三零，preview3071921退出/root与profile全清理。首fixture误用stage:'FINAL'，原业务读inspectionStage/inspection_stage，仅code断言未暴露；经独立只读核验改真实inspectionStage并加“最终检验”文本和fixture字段断言。只改未提交新fixture/probe，不修业务或旧断言。

补充旧基线mtwyB6/11项真实exit0（`/tmp/kingturf-3c6-old-cdp11-stage-2026-10-16.log`），text52其余计数同上；preview3072841退出/root/profile清理全真/网络三零。此时候选TS已落地但未build：前后旧dist SHA-256均为bootstrap-ESjICPmU.js=`ac2a1c5df87bac32fb261e05bce2e6d4e44c04bc4751dc75e19ac9c3fb4002bb`、index-CRemMOG-.js=`1c55785e5a609c2e8c71b2afeaea51aa86e92259e6929259fc517fd2eca845fe`；preview只读旧不可变bundle，未reset/覆盖候选。首11不追认包含补充字段断言。用户确认CRM筛选按原值/焦点/选区恢复、商业workspace/menu/未重绘cost input身份不变的口径保持。

新同口径a5cwnl/11项真实exit0（`/tmp/kingturf-3c6-new-cdp11-2026-10-16.log`），与补充旧mtwyB6全部case/计数/GET次数相同，网络三零，preview3113187退出/root/profile清理全真。

新全组合首跑YgfqPn真实exit1（`/tmp/kingturf-3c6-new-cdp28-2026-10-16.log`），26项先绿，在采购页之后、MRP操作前遇到`DOM condition timed out: stable unobscured click target`，不是28项已绿；preview3113281退出/root/profile清理全真。首日志没有采样失败时目标几何/命中状态，根因待核实，不直接归因业务回归或已知动画竞态；不改业务/driver/点击预算/判定，使用既有`--trace-nav-clicks`诊断复验，结果另记。

既有诊断开关复验VJ37Xf/28项真实exit0（`/tmp/kingturf-3c6-new-cdp28-trace-2026-10-16.log`），DOM78/viewport45/route67/text134/overflow54、各list/session5、cost6/detail2/单订单证据2，网络三零，preview3113475退出/root/profile清理全真。未改变业务/driver/预算；该诊断绿不能证明首跑失败根因，亦不追认首跑28全绿；另做无trace原样复验，结果待实际完成。

无trace原样复验a68rso真实exit1（`/tmp/kingturf-3c6-new-cdp28-retry-2026-10-16.log`），24项先绿、进入制造页前同稳定点击超时，preview3113578退出/root/profile清理全真。不无限重试碰绿；只在新增四页probe加可选`--trace-operations-failure`失败后只读现场，不改driver/判定/操作/超时。针对性诊断CQwqNj真实exit1（`/tmp/kingturf-3c6-new-cdp28-failure-diagnostic-2026-10-16.log`），25项先绿，采购desktop1440×1000锁定connected实际button routeprocurement，bbox x26/y1110/w189/h37，中心在viewport外、elementFromPoint=null、scrollX/Y0、animations为空；hash已经#/procurement。明确此轮是屏外而非当时未稳/命中邻项，首次scroll之后何时因何失效仍待核实，不能泛化此前失败因果。preview3113982退出/root/profile清理全真。

TD-TEST-006先复开登记（39项不新增），3f3aae7旧工具收口史保持；后续必要工具修正须独立最小提交与旧红新绿，不混业务/不放宽原3秒、命中及网络硬闸。当前⑥业务候选静态/原114/同口径11齐，但无trace全28可靠性仍阻塞，不称⑥检查点完成。带trace28绿单独记账。源码提交后实际HEAD完整CI待执行。

28为原24+4、23不同route含2CRM，不是28域，更不是21商业域所有写流程。回滚本组四原块/28新TS/最小读源与operations opt-in整组revert；前组、permissions桥/driver保留，完成docs独立回滚。共享残留继续原授权，不提前宣称3c/3d/3e/3f或整批验收。
