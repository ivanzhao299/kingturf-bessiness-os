# 前端3c⑩：在线文档编辑器（2026-10-16，实施与独立复核完成）

完成检查点：源码`78d726c`稳定干净实际HEAD完整`pnpm ci:local`真实exit0/181480.679ms（`/tmp/kingturf-3c10-78d726c-head-ci-2026-10-16.log`），结束HEAD仍78d726c/树空。API117/17099、web9/114、database68/domain14/config4/types1、PG链、读源22/CDP纯JS28、39能力19路径、结构0硬31旧软、预算11369/1898与audit齐。15runtime/1type≤172/完整函数165/AST5/root3066、完整800行14逆展开/70公开457链/15实际负向与恢复、旧新扩展37/另新正常33与原夹具29、独立实际候选审均无阻塞；三轮旧失败史与TD-WEB-005只登记不修保持。回滚`git revert 78d726c`（本组模块/root/readsource/新editor opt-in同撤，不撤前driver/register工具），完成docs独立提交后实际HEAD另全CI。下方“待跑/候选”均此前时点记录，不作当前未完成断言；剩余共享→3d–3f连续授权继续，3f后整批人工验收及Playwright补跑保持。

输入5ec8a65稳定干净实际HEAD完整CI真实0/179473.404ms（`/tmp/kingturf-3c9-5ec8a65-head-ci-2026-10-16.log`），结束HEAD不变/树空。沿既定3a→3f授权继续；本组业务迁移尚未开始，旧bootstrap3880/编辑器800行。仅主代理写入和串行执行，独立代理/协调只读复核。

## 旧护栏与失败边界

新增`--document-editor` opt-in，以独立wrapper提供15条精确route列表GET、唯一合成文档detail GET，原router先处理其余请求，仅session附加business-document:read，不授manage/approve/send/translate。保留未知query/路径/方法拒绝，业务写请求全部拒绝；fixture原件、原29与register四项、driver和网络闸门不改。纯JS28首跑真实0（`/tmp/kingturf-3c10-cdp-unit-2026-10-16.log`）。37=原29+register4+editor4，因overlay附加文档权限和响应，不当作原夹具正常29/33。

旧首j9qPOS实际exit1（`/tmp/kingturf-3c10-old-cdp37-2026-10-16.log`）：原33及编辑器只读打开/清洗、纸张缩放分页两新项共35绿，历史case点击超时，无目标几何，不能倒推其精确原因。新增仅失败后读取target/hit/ancestor几何的诊断，不改driver后，旧J8ArKa实际exit1/35绿（`/tmp/kingturf-3c10-old-cdp37-diagnostic-2026-10-16.log`）：V1已成功、V2按钮中心(1263.5,177.64)命中commandbar(y126.14..178.14)，layout高度0/history clientHeight32/workspace868、scrollHeight2510；两个preview3329776/3330053及owned root/profile均清理全真。

TD-WEB-005先登记仅留存，不修旧业务/CSS。独立复核确认桌面1440不是默认历史折叠，驱动center-hit拒绝正确。CSS工作区仅两显式grid行、实际三个child，V1填长比较区后第三隐式auto行挤占layout为合理推断；未隔离zoom/纸张序列贡献，不称根因全证或推论生产影响。保留长比较后V2点击不可达边界。

新未冻结护栏范围明确收回“同modal点击V2返回”，改为V1比较标题/当前V2状态/正文节点同ref且只读，然后真实关闭/重开V2再验READY译文；detail GET预期3→4，不放宽任何旧断言或click预算、不强制点、不删comparison或改DOM布局。新增三写按钮逐标签恰一且hidden、正文h2恰1/p恰120和译文p恰1，避免空集合every假绿。未覆盖保存、审批、创建翻译、发送、打印、下载或后端安全；只读合成DOM不替代真实API/PG/Playwright。

首次范围调整后A3Blga实际exit1（`/tmp/kingturf-3c10-old-cdp37-bounded-2026-10-16.log`）：前36项绿，最后case已完成译文/关闭操作，但立即断言dialog总数时尚有一个已关闭、display:none的主dialog；原close事件异步remove，新helper仅等open属性消失，未等真正移除。新未冻结close等待改为主dialog节点确实不存在，保持末尾总数恰0断言，不修改业务/driver/预算；preview3330735/root/profile清理全真。防空修订后纯JS28仍真实0。再次旧37待实际执行；业务源码尚未动，不预填候选、新红绿、提交或CI。

再次旧NXK2Es全37真实exit0（`/tmp/kingturf-3c10-old-cdp37-close-event-2026-10-16.log`），DOM137/viewport51/route78/text166/overflow63，各list/session6、cost7/detail2/orderEvidence2、15类documentList各6/detail4；网络blocked/unknown/failed三零，preview3330845退出/root/profile清理全真。以下业务迁移才在该次旧绿之后开始，不把后绿回写首三轮。

## 候选拆分与守恒证明

主代理完整读取原800行；临时生成器`/tmp/kingturf-3c10-extract.mjs`依据TS符号识别五局部状态引用，经apply_patch迁位。保留activeVersion/documentState/latestContent原声明与二次latestContent赋值时点，editable/savedEditorHtml仍正文初始HTML后声明；私有state只定义五对原let accessor，不提前求值、不spread或解构其值。heading仅读已初始化activeVersion，workspace不读取后两状态；context仅传state引用。onSaved及ports各helper用原ref裸局部调用，四处optional回调仍在原成功点活读activeVersion。

save注册早于原addVersionToHistory声明，用独立callbacks对象的getter在保存成功、versions.unshift后才取原arrow，再裸调用；初始化仅传callbacks ref，不spread/getter提前读取。保存仍两次读取body.innerHTML，成功时保留第三次条件比较、同一versions数组unshift、history/status/cache/onSaved顺序。review完整成功动作独立helper，保持状态→editable→setViewMode→控件/版本状态→render→cache→onSaved；并非以回调重置AST口径。send每次click原点才创建settings arrow；阻断提示独立自然职责helper，保留真实focus/scroll/callback顺序；渠道成功后才建sendKeys Map，译文选项、提交payload、await后onSaved分别活读版本。history预览不改当前版本；DOM/监听注册/append/showModal/RAF顺序不改。旧清洗、Date/locale、网络/缓存、打印/下载副作用原样保留，不提前做3e日期收敛或3f解析收紧。

首typecheck真实exit2（`/tmp/kingturf-3c10-type1-2026-10-16.log`），为Heading/Workspace通过聚合Context+ReturnType反向自指与迁位后unused imports；改为独立原始只读输入type、移除真正不再使用的root imports/entry引用后type2真实0。未引入any、runtime guard或绕过lint。首结构度量发现send blocked提示的focus回调AST6，按自然阻断提示职责拆出helper后实际AST≤5；不将其初版当达标。

`/tmp/kingturf-3c10-proof.mjs`对实际14次helper/factory调用逐一验证参数同ref/arity、plain pack/getter桥及原返回值后逆展开，五state访问归回原let、唯一save延迟getteralias在原调用点消除，**完整原800行函数AST相等**。两私有type原AST、root其余业务声明/顺序、剩余import绑定同源、42条实际runtime import边逐条解析、70公开绑定/457完整expect链均相等，无反向bootstrap或无用side-effect依赖。首证明脚本只因object literal尾逗号的文本比较失败（inverse1），改用AST对象字段次序比较后inverse2及final真实0，不改变业务候选。

| 新TS职责          | split | 完整函数最大 | AST |
| ----------------- | ----: | -----------: | --: |
| online-editor     |   142 |          128 |   4 |
| heading           |    32 |           27 |   2 |
| workspace         |   172 |          165 |   2 |
| pagination        |   135 |          131 |   3 |
| save              |   116 |          111 |   4 |
| review            |    83 |           77 |   5 |
| review-completion |    46 |           43 |   3 |
| history           |    69 |           64 |   5 |
| version-history   |    63 |           57 |   3 |
| translation       |   104 |           99 |   4 |
| send-settings     |    40 |           36 |   3 |
| send-form         |   108 |          101 |   4 |
| send-blocked      |    31 |           27 |   4 |
| send              |    89 |           80 |   5 |
| export            |    72 |           68 |   4 |
| types（纯type）   |    75 |            0 |   0 |

15runtime/1type，最大file172/完整有body函数165/AST5，入口factory整体128而非把800行整搬进factory。root3880→3066、商业函数仍160；实际metrics TS282/55651→298/56214，测试146/65727→65760，root缩进启发式≥4由1419→1103、≥7由572→510、最大12→10，API4129/buildApp3598不变。该缩进非AST，不能仅据迁出关闭巨石/日期债务（台账41维持），日志`/tmp/kingturf-3c10-metrics-new-2026-10-16.log`。

## 冻结读源与实际负向

迁位后原未适配web真实2fail112pass（`/tmp/kingturf-3c10-web-unadapted-2026-10-16.log`）。只新增readOnlineEditorSources实际15runtime/唯一非空实现锚集合，接入原turf、原文档广源和原保存读源；保留root供其余diff/sanitizer与shellTail读取，原editor root slice改实际15源集合，其余contextual/CRM slice守卫不变。全部457完整expect不改，适配后9/114真实0。TD-TEST-007原跨域'/submit'仍如实保留，不趁拆分强化/改写旧断言。

15新runtime逐一扰动真实函数内DOM tag、状态/事件/纸张/操作文字为WEB-UAT（不改anchor，不追加死marker），每个原turf禁marker断言真实1fail113pass；每次完全还原后114真实绿，日志`/tmp/kingturf-3c10-<模块名>-read-source-{red,restored}-2026-10-16.log`。证明实际新读取仍绑定，不将源码断言负向称动态交互覆盖。最终type/lint/whole inverse/结构0硬31旧软/能力39权限19路径/build均实际0；启动gzip JS11369/CSS1898，deferred bootstrap-\_ihGLlW4.js/index-BRGHJLAb.js。新37及另正常33/29仍待实际跑，源码提交后稳定干净实际HEAD完整CI待跑；独立只读实际候选review已核TDZ/getter/receiver/保存审核发送顺序无阻塞，其未代跑测试。

回滚本组模块/root facade/最小读源/新document-editor opt-in整组revert，保留前组driver/register工具，不修TD-WEB-005；完成docs另独立提交及实际HEAD完整CI。后续editor剩余共享→3d–3f继续，3f后停供整批人工验收；API/packages/SQL/依赖/lock/workflows/评分/原Playwright九spec及原CDP29/register4不改，保护区及Playwright阶段5前补跑保持。用户已确认CRM输入按原重建后恢复值/焦点/选区验证，商业workspace/menu及未重绘cost input身份不变，未把CRM节点身份新增为冻结目标。

## 候选浏览器结果

新6mdAvK扩展全37真实exit0（`/tmp/kingturf-3c10-new-cdp37-2026-10-16.log`），与旧NXK2Es各case/计数/GET次数全同，网络三零、preview3354725/root/profile全清。另未启用editor overlay的新dDT4Qq正常33真实exit0（`/tmp/kingturf-3c10-new-normal-cdp33-2026-10-16.log`），DOM113/viewport48/route74/text150/overflow59、各list/session6/cost7/detail2/orderEvidence2，网络三零/preview3363480及owned root/profile清理全真。

另未启用两个overlay、原fixture的新2cHNqS正常29真实exit0（`/tmp/kingturf-3c10-new-normal-cdp29-2026-10-16.log`），DOM80/viewport47/route69/text142/overflow56、各list/session5/cost6/detail2/orderEvidence2，网络三零及preview3373712/owned资源清理全真。三种口径分别记录，不以扩展37代替原29，不将readonly副作用禁用夹具当保存/审批/发送覆盖。源码提交后实际干净HEAD全CI尚待跑；此前“待跑”均各记录时点状态。
