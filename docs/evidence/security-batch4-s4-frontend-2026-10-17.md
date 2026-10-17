# 批次4 S4 前端会话上下文切换

当前候选已解除预算阻断：最终build-final-candidate退出0，JS11992/CSS1898（原12000/4000阈值/品牌/资产/预算脚本全不改）。Web14/304、type-final及lint-final-candidate退出0，结构0/29；最终提交后稳定干净HEAD全CI仍待实际执行，不预填完成。下面预算“停报”是中途历史；协调后给出共享HTTP core真实职责边界，允许继续既授范围，已按之实现并复核，无新产品选型。

收尾core：首次restore静态调用http-core.exchange，唯一交换引擎保15秒全body timeout/abort/204/错误与引用；受保护json按原公开签名包装prepare/received/decoded hooks，RequestError同一类reexport。失效处理在已认证watch初始化、首个业务之前注册；首次401只登录无reload循环。真实received hook不调用变异让旧http/boundary两文件3红92绿→还原95绿；decoded hook不调用使新迟到body归属1红34绿→还原35绿（core-received/core-decoded日志，红1/绿0）。之前五文件实际红绿仍保留，不用新增test替它们。

预算不是移首次链：首次Cookie fetch/DTO解析/通知revision始终静态计入。真实postlogin的mount守卫/State/watch及用户交互/失败only actions分层；旧parseSessionResponse public wrapper保留、内部base record一次解析、严格proof次序/错误/引用不改。新通知只发固定非秘密状态字符串，不含proof/身份；版本改只读revision计数，不删通知窗口。新内部cause统一`Session changed`，唯一实际consumer bootstrap catch不展示cause而渲染原失败视图；不是改变冻结UI文案/删抛错条件。新的迁移提示与fallback完整说明已恢复，原品牌/旧正常UI不改。删除早期activeRoot残余死guard时确认该变量只做恒真存在检查、不再承载root路由；真正root仍由watch捕获。

lazy失败UI归属复核修正：fallback返回登录和完整版返回登录均推进startupEpoch，迟到import success验epoch，import失败只保留已显示可重试fallback、不重画覆盖登录。当前失效/logout真实换代用原整页reload清body modal，不假称逐个dispose所有dialog；同身份成功focus/网络失败/旧回调不reload。原workspace-loader只抽同责45秒loadModule，旧3例原样继续绿，新的交互提交在等模块前同步锁与即时进度。

## 启动预算阻断过程（历史，后续已过预算）

基线仍为25526c8；本前端WIP未提交、不称完成。按协调允许的真实按需边界整理后，build-seventh实际退出1：初始JS gzip12446 >12000，差446字节。品牌/资产/CSS/预算脚本与阈值零改；首次Cookie restore请求、解析和通知版本保护仍静态计入初始路径，不批准将它动态移出统计。只将SessionState/watch延至确认认证成功后、browser-login及LoginCoordinator延至用户提交后、failure-only UI延至错误态；提交锁与即时进度先于模块加载，45秒有界模块加载复用原workspace-loader同责原语。logout和身份比较已移出静态restore模块。上述整理仍不足达标，按协调指令带真实归因/差距停报，不扩大旧业务或资产优化，不跑明知预算阻断的完整CI。

## 固定语义与必要耦合落点

- session.ts：冻结SessionContext/session权限副本，唯一owner与本地epoch；旧响应只可失效仍属current的上下文。legacy-session.ts只读两旧键是否存在的布尔，清键后要求重登，不解释/交换旧值。无current的交互登录期间focus只累计通知，不自动bootstrap覆盖表单。
- http.ts：无手动Authorization，credentials same-origin，读取捕获generation与写proof，不活读Cookie；过期通知携原context，403不失效。成功在头、204返回前及JSON body之后检查owner；当前credential204先验owner再原失效通知，不把本次合法成功误作stale。超时/abort/correlation/幂等/204契约保留。
- entry.ts / session-signals.ts / session-watch.ts：initial restore→核验DTO→owner安装→workspace及三域await后再核epoch/通知版本，通知不会被迟到restore消去。自动最多补读一次，持续变化进入可见手动恢复。已install后初始化中focus即使同身份复验成功，原恢复revision仍不匹配，保守进入明确失败/手动恢复，不声称无缝继续；已挂载同generation/同权限/同proof成功复验保context/owner/表单/路由不变。单proof变化保持输入、暂停写、明确手动恢复，不自动升级旧闭包或重放写。旧表单已脱离时晚login本地通知后也主动check，不靠Broadcast自收。
- modal边界已由协调确认：旧expireSession原整页reload会清document.body弹窗，新SPA只移shell反而削弱。仅确认真实换代、仍current失效/logout、用户明确手动重载使用reload；普通网络错/同代focus/旧A迟到不reload，首次restore401只登录无循环。不改editor叶子/不扫未知DOM；真实body modal清理需下一步浏览器页生命周期证据，不声称逐个owner管理所有dialog。
- 三域client仅传context：endpoint/payload/权限/parser/分页/附件顺序/幂等保持。route-state owner来自捕获context，原publicEpoch/wave/source version不动。bootstrap三处isCurrent守卫，外层将通知revision一并绑定，session参数必须为context.session，避免权限快照与请求身份分离。此为WEB007必要耦合，不全面关闭旧债。
- 文档API/renderer/editor按workspace工厂捕获context，不把A旧闭包转成B；cache绑定generation/epoch/独立owner，owner失效clear，旧catch仅当前Map仍为原Promise才删。此为PERF003必要耦合，不称已证生产泄漏或全债关闭。

## 实际检查与逐文件红绿

日志均为`/tmp/kingturf-s4-frontend-`前缀、`-2026-10-17.log`后缀。所有变异都改真实新实现，不改测试造红；红退出1、还原绿退出0，除下述明确保留的第一次还原故障。

| 实际适配旧文件/锚点                          | 必要新期望及六项依据                                                                                                                                                 | 实际变异与还原                                                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| http.test.ts：headers/401/credential         | 原Bearer/string→无Authorization/捕获context回调/GET代际，保原timeout/abort/错误/改密管理员差异；六项1/3/4                                                            | 删除生产generation头设置：1红7绿→还原8绿；http-mutation-red/http-restored-green                                                                                                                               |
| session.test.ts：current once/迟到旧值       | 原storage token相等→current owner/epoch，仍只失效一次且旧A不能伤B；六项3/4                                                                                           | 去掉expireSession的state.isCurrent守卫：2红2绿→还原4绿；session-mutation-red/session-restored-green                                                                                                           |
| login-flow.test.ts：single-flight初始化      | string结果→void，仍等认证/初始化且重复提交同pending；六项1/3                                                                                                         | 生产initialize不调用：1红2绿→还原3绿；login-flow-mutation-red/login-flow-restored-green                                                                                                                       |
| boundary-parsers.test.ts：会话DTO/client/doc | 旧存储token校验转新login proof/严格login/restore DTO；只改必要参数/认证缓存来源，保其它parser对象引用/错误先后/同步失效/Promise缓存/显式retry；六项1/3/6             | 生产parseSessionRestore加主动抛错：1红86绿。第一次多行逆patch漏移一行导致模块加载红（无tests），立即删除残留，最终87绿；boundary-mutation-red/boundary-restored-green（失败史）/boundary-restored-final-green |
| bootstrap.test.ts：三处治理构造参数/读源     | 三处fixture传SessionContext；原session-parser存储token锚点改restore并增login-parser唯一锚点，原原子权限/业务assertions冻结；加真实治理请求绑定context断言；六项1/3/6 | 治理生产load以null替context：1红87绿→还原88绿；bootstrap-mutation-red/bootstrap-restored-green。AST规范化仅逆撤上述三参数/两个parser锚点及新测试/import后，原文件AST严格相等=true（保原公开70/457链其它断言） |

其它旧Web测试文件零diff，包括workspace-loader.test.ts（真实同责loadModule抽取经原3例超时/失败/迟到检查继续执行）；新browser-session.test.ts独立新增绑定/通知/迟到200/204/body/无Cookie活读/暂停写/缓存/真实换代reload测试。新增helper仅合成非secret会话上下文，不用生产API/PG/浏览器或真实凭据。原commercial-route-data.test.ts未适配，原waves全部照跑，不能称它做了session夹具迁移。

Web最终本候选14文件294/294（web-seventh）；typecheck退出0（type-seventh），lint首次一项void shorthand错误后加花括号、还原退出0（lint-restored），结构0违规/29豁免（structure-final-candidate）。此前web-first263绿2红（旧callback期望、删除旧parser导致唯一锚点失败）按登记窄适配修正；web-second284断言绿但有1个未处理错误，mock重复消费同一Response body，改每次新Response并await末个请求后消除，后续287/290/294均完整退出0。最初entry机械替换留旧尾部引syntax/type红，立即删除旧段；helper最初在src外引TS6307，移入src/test-fixtures并修相对路径，未扩tsconfig。数次patch锚点失败无文件变更/一次大输出JSON截断均未隐去。

诊断首次Web失败时曾直接读取本地test failure展开，输出含自造合成proof值；非真实凭据/连接或签名fixture，不复述值。之后只投影计数/测试名/退出码，不再打印失败对象正文。未读真实.env或prompt-history。

预算历史：初次13532，postlogin watch职责拆分13268/13254，认证后State拆分12982，用户提交后proof拆分12881，failure-only UI12714，按协调具体候选连同LoginCoordinator及postlogin函数拆分后12446，均是真实构建退出1，不覆盖日志build-first至build-seventh。初结构entry嵌套6→自然职责拆分/具名回调后0违规；无预算/门禁/豁免放宽。当前不执行API全量或最终ci:local，不将后端25526c8的绿冒称此前端WIP绿；提交/后续网络级验证均待预算阻断解决。

## 范围与先行映射

提交钩子首次拦Prettier（precommit-format日志），为真实变异逆patch留下的格式差异；语义还原绿不等于格式已绿。按暂存精确文件集机械格式化、重新暂存后再走原钩子，不绕过检查；最终HEAD CI仍须实际执行。

### 后续CDP映射准备（本步不改工具/夹具、不运行）

固定影响报告§6的候选继续作为下一步精确盘点入口，不因历史CRM/360答复扩大本步范围：fixtures.mjs的旧storage播种→专用Cookie恢复/DTO上下文；probes/boundary-probes的token/storage期望→代际/不可读认证Cookie/失效归属，旧UI断言保留；csp-send-fixtures的createCspSendRouter与csp-send-probes登录主链→login-context→browser login→session再核，合成202与真实Cookie网络证据分开。preflight/driver/network-policy仅在另派后按精确新端点/intent接线，保未知请求/写fail-closed、owned profile/监听器/清理；不能宽放通配/api或把Fetch.fulfill当真实Jar。csp-observer无storage注入断言不删除。真实迟到头、实际Jar、DOM登录→工作台→logout→重登/CSRF负例/清理矩阵仍由协调下一步派发；旧9份PW/config本步逐字冻结、补跑硬前置不抵销。

后端25526c8稳定干净HEAD完整CI0/203058.579ms经协调独立确认后，续派固定设计§4–§6前端小步。仅Web/对应测试/必要工具及文档；不改后端、SQL、infra、旧PW或依赖，不跑浏览器/Docker。SEC003/评分保持开放。旧CRM/360异步回复不是新范围。后端结果见[后端证据](security-batch4-s4-backend-2026-10-17.md)。

实施前必要旧→新：http的Bearer/string→捕获只读SessionContext/Cookie/代际及写proof；entry/login-flow的storage认证→旧键存在布尔清键重登/restore/login-context→login→session核验；session的token/storage equality→owner/epoch/current equality。三域client只替会话参数，不动权限/payload/幂等/分页。商业route-state的storage活读→捕获owner，原wave/publicEpoch/source version不变。bootstrap异步完成前owner再核（WEB007必要耦合）；文档服务每shell捕获context，缓存绑定generation+owner且同Promise才删除（PERF003必要耦合），旧闭包不转用新身份，不声称两整项债务关闭。

旧测试候选逐文件（未执行不标绿）：http.test.ts原Authorization期望→无Authorization/代际/CSRF，超时/abort/错误/204冻结；session.test.ts原storage清理→仅当前owner失效；login-flow.test.ts原string回调→非secret结果，single-flight/错误提示冻结；boundary-parsers.test.ts原token parser及client/doc参数→严格新DTO/parser/SessionContext，原其它解析/引用/错误顺序冻结；commercial-route-data.test.ts原storage相等owner→SessionContext owner，route/wave断言冻结；bootstrap.test.ts若读源受影响仅必要S4绑定差异，70公开/457链其余冻结。其它文件依实际零diff判断。每个实际适配文件须扰动真实新实现使相关用例红、立即还原绿，后补精确选例/日志/退出码。

focus/visibility同generation/同权限成功复验不无条件dispose/重挂载或清缓存，保原表单/路由；真正身份/权限变化才重新挂载。若只proof改变，不能让旧闭包活读最新proof升级，须保留输入并有界手动恢复，不自动重放写。

当前尚未完成实现/验证。最终Web/API全量与稳定干净HEAD完整CI后停协调；本步不以epoch模拟声称Chrome Cookie Jar/迟到Set-Cookie网络级验证通过。回滚前核后继，前端及对应测试/证据配套逆撤至25526c8；不恢复旧storage/token、不自动部署或回滚。
