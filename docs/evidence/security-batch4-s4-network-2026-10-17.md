# S4 真实网络与应用 CDP 验证

**批次4交验补记（2026-10-17）**：工具f114ee0真实26正向/9负向及最终完整CI均完成；未再重复Chrome/PG矩阵。本轮累积源码f114ee0038e8ef4568c1521b51efa606cb52da66稳定干净HEAD完整CI实际exit0/192524.18ms，首尾同HEAD/clean=true；API126/17242、Web14/313、config71、结构0/29、预算11991/1898、audit0，日志 `/tmp/kingturf-s4-network-final-head-ci-2026-10-17.log`。这是后继累积检查点，不冒称重跑本页每个旧HEAD。SEC002/004核账已验收范围实施完成、SEC003载体迁移实施项关闭，SEC001强制段开放；本次整体人工验收仍待交付，九旧PW延期硬前置不抵销。[唯一批次4交验包](security-batch4-acceptance-2026-10-17.md)汇总分层/适配/回滚/残余候选；下方“待CI/未实施/开放/硬停”为各自原时点，不回写历史。最终本次文档HEAD完整CI另实际执行后交协调。

## 历史：f114ee0提交前工具候选检查点（当时完整CI待执行）

窄修独立bfdc4ff；本步工具严格失败门最终新profile26项exit0，资源故障9项通过。当时完整CI计划在工具/文档独立提交后的同一稳定干净HEAD执行，日志 `/tmp/kingturf-s4-network-final-head-ci-2026-10-17.log`，未预填结果。当时SEC003/评分开放、台账49项，不进入Docker/PW/阶段5。此节及下方“待执行/阻断/未修”保留各次历史时点；当前完成状态以上方交验补记及唯一交验包为准。

### 文件职责、旧→新与边界

| 文件（scripts/e2e-cdp/）                            | 新增职责/映射                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| session-network-fixture.mjs                         | 复用既有PG20随机schema/两API/seed纪律，真实生产server/仓储；临时两账户+COMPANY最小员工/商机/文档权限和一条DRAFT/V1，无生产SQL/schema修改                           |
| session-network-gateway.mjs                         | 固定4173真实同源SPA/API；精确原始URL/method白名单；仅文档列表允许字面`?route=opportunities`，详情只允许本轮精确document ID；上游头到达后、下游任何头flush前barrier |
| session-network-browser.mjs                         | 独立owned Windows Chrome生命周期，复用原ownership matcher；原flags/ActivePort/监听PID/loopback/endpoint身份，CDP异常与未知请求严格失败，无Cookie注入/Fetch.fulfill |
| session-network-node.mjs                            | 明确Node手工Cookie/Origin负例，不冒充Chrome                                                                                                                        |
| session-network-probes.mjs                          | SPA DOM登录/恢复页显式登出/重登，与受控Runtime.fetch网络矩阵分开；协议client显式no-store，DOM不改fetch策略                                                         |
| session-network-dom.mjs                             | 真第二tab实际表单登录广播、自然focus/visibility、真实PG文档编辑器/翻译/设置modal、实际frame导航与旧请求释放                                                        |
| session-network.mjs / session-network-lifecycle.mjs | 串行编排/分类计数、信号和故障清理；主套26与9负向不相加当用例总量                                                                                                   |
| session-network.test.mjs / package.json             | 2纯JS工具测试接`test:session-network-tools`，在CI build前运行；无dist仍2通过，真实runner独立assertBuiltWeb拒绝缺构建                                               |

旧preflight/driver/network-policy/fixtures/29合成/CSP3全部零diff，未作旧CDP会话适配，故不冒称旧29/CSP3这轮重跑；九旧PW/config未改未跑。真实DOM继续调用原driver Input物理点击/填写。只有http.ts适配，已单独9新增测试真红绿/真实实现变异及API/Web全量，详窄修证据。root package只增工具测试脚本，无依赖/lock变化。

### 实际正向分类与证明范围

最终 `/tmp/kingturf-s4-network-final-strict-chrome-2026-10-17.log` **exit0 / 26项**：Chrome154.0.8037.99/CDP1.3、原安全flags、新owned profile，自然HTTP Secure Cookie。gateway blocked0、CDP asynchronousFailure=false、全部listener/root/profile/两API/schema清理true。

| 分类                             | 数量 | 已证事实                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node instrumented Origin         | 4    | 缺/null/foreign Origin403+员工行数零增；GET无Origin/CSRF200但无认证401；真实raw两Set-Cookie/noDomain/属性/no-store/JSON无token只算Node证据                                                                                                                                                                                                             |
| 真实SPA DOM                      | 8    | 自身新增响应范围的两Cookie/JSON无token/no-store及真实Cookie回传、HttpOnly不可读、DOM登录workspace→故障恢复页真实logout204→重登；旧storage存在一次清键强制重登、下次Cookie恢复；真双tab自然focus同代保shell/textarea节点/值/activeElement/选区；另一tab实际DOM登录广播引发主frame换代导航、清真实body editor/翻译/settings；旧detail/旧mount释放不覆盖B |
| Chrome自然Jar＋受控Runtime.fetch | 14   | 同/不同账户两种头顺序4；旧401/logout头后到、晚login跨logout3；同/不同账户旧proof/旧generation拒绝且零员工写2（另旧A logout拒绝/B仍活）；仅迟到CSRF Cookie导致B proof403/零写，显式restore后新动作201一项；改密同目标旧B撤销/事务后新B存活、旧login头跨改密已撤、异账户B不受旧改密头影响3；两真实API实例下真实PG过期拒绝1                               |

DOM focus在该tab精确session URL/requestId的Network.loadingFinished、无在途restore、两RAF后才断言，不拿gateway上游头/200ms当复验完成。此为传输/事件循环有限观察，不是任意未来任务证明。初始401只在200ms窗口计一次导航/一次session请求；旧结果释放后250ms检查，无长期穷尽声称。旧detail/mount的真实整页导航销毁旧realm是本设计清理策略，不冒充不导航的同realm owner guard证明（后者由Web测试另证）。settings还等真实connectors200，正文断seed文本/contentEditable=true，未注入假modal/实际发送或提交译文/连接器配置。

协议`__s4`私有测试client绝非真实entry/http owner；它只证明Jar/API/PG/头顺序。Cache no-store是该受控client为避免未到达头的同URL GET串行缓存锁而显式设置；前两次协议旧401 case出现CDP deadline、8项后退出，不能当业务缺陷或已证明浏览器缓存根因。最后无该deadline。过期是fixture参数化将本轮session expires_at设过去，证明服务器/跨实例拒绝真实过期行，不是等完整TTL的wall-clock测试。两Cookie不假定原子，错配案例明确403再显式修复、无自动重放。

### 负向清理、变异与失败史

`/tmp/kingturf-s4-network-lifecycle-summary-2026-10-17.log` **9/9实际通过**，各子日志同前缀加listener-fault/profile-fault/deadline-during-setup/spawn-error/server-error/fixture-sigterm/browser-sigint/unknown-write/cleanup-sigterm。每例实际exit1、无network-pass，按资源到达阶段核API/schema、gateway、profile/root清理；spawn失败只登记1个child且无实际pid，未误杀外来进程。unknown-write的Chrome blocked=1，未放宽硬闸。

中断立即置exit1，setup各关键await后/用例边界核标记，不race未settle工作与teardown。临时连接仅工具内connect_timeout5秒/statement_timeout5秒/lock_timeout3秒，不改packages/database；35秒cleanup计时只发requiresInspection并禁止pass，**不是强制kill、不是任意DB/OS挂起可有界退出保证**。driver120秒同为超时检测/发信号；本9个具体故障已实际清理，不泛化任意故障。

真变异：gateway去掉`await barrier.released`使纯JS1fail/1pass（`/tmp/kingturf-s4-network-gateway-mutation-red-2026-10-17.log`），还原2pass（restored-green同前缀）；真实session-watch changed分支删reload并重build，Chrome8pass后精准新身份profile超时（`/tmp/kingturf-s4-network-dom-reload-mutation-red-2026-10-17.log`），还原原文件git diff0/rebuild后26绿。没有改测试造红，未提交临时业务变异。

其余失败保留：首两次退出缺陷和诊断见下；首次工具测试lint空arrow2条已修、runner清理补丁一处额外括号导致prettier/eslint语法失败（执行前，无资源作用）已修；文档patch还曾因冗余尾锚点原子失败，未落部分内容。收紧DOM自身响应绑定后的`final-bound-chrome`在第9项发生未分类CDP异步失败，全部清理，具体原因**待核实**；曾试加仅限观察到取消的窄分类，bound2绿但cancelledResumes=0，未证根因，最终撤回分类保持任何resume异常严格失败。最终strict26绿，不宣称间歇CDP风险已消失。未读取/输出真实秘密、token/proof/Cookie值、DSN或CDP cookie数组。

执行命令：先`pnpm --filter @kingturf/web build`，仅guard回环test DATABASE_URL环境下`NODE_ENV=test node --experimental-transform-types scripts/e2e-cdp/session-network.mjs`；负向同环境运行`session-network-lifecycle.mjs`。真实suite手动opt-in，不进入普通CI/Playwright。无dist验证曾临时移开本轮自建ignored dist，纯JS2通过且assertBuiltWeb负向拒绝，随后已还原，不移动外来目录。最终提交仅工具/脚本/证据/导航，业务只bfdc4ff窄修；逆序回滚先本工具、再bfdc4ff回b38c75c，保后端/S1–S3，已撤session不复活，不自动清Cookie。

后继检查点：[暂停状态显式退出窄修](security-batch4-s4-paused-logout-2026-10-17.md)经协调/frontier判为已授S4内部实现矛盾，非C7新选型；已局部修复且真实失败链重跑成功。下方“仅登记/未修”为失败时点。网络完整DOM/生命周期/变异及最终CI仍待执行。

## 输入与范围

输入 b38c75c：稳定干净 HEAD 完整 `pnpm ci:local` exit0 / 192629.727ms，API126/17242、Web14/304、config71、结构0/29、预算11992/1898。日志 `/tmp/kingturf-s4-frontend-final-head-ci-2026-10-17.log`。这是前端证据，不是本页网络验证。沿已授权设计§4/6/7继续；SEC003/评分开放，不跑九旧PW/Docker/阶段5，不push/部署/workflow。

## 先行策略

guard回环test PG、随机独占schema，现迁移/scrypt/组织员工凭据权限表，两真实API共schema/secret。临时合成账户/密码/secret，不读真实.env，不输出身份、密码、token、proof、Cookie或DSN。参数化SQL统计真实员工写/会话审计副作用；工具seed/到期安排不改生产SQL/schema。先停API再关连接、只删本轮精确schema。

owned gateway在127.0.0.1:4173同源提供构建后真实SPA/代理真实API；上游真实响应到达后、下游writeHead/flushHeaders/首次write/end前barrier，分开观测事务提交与头放行，不只延body/JS，不Fetch.fulfill。Chrome既有安装/原安全flags/随机loopback CDP/全新owned profile，不碰用户窗口；精确method/path白名单，未知API/写/外域拒绝且整套失败。Secure不降级，不换别名/HTTPS。

## 矩阵（全部待执行）

| 设计锚点 | 网络/PG oracle                                                | Chrome oracle                                                                                                   |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| §4.1     | 旧401/logout204/credential204无认证Set-Cookie                 | B自然Cookie GET后放旧头；不同目标B/事务后新B存活，同目标旧B撤销                                                 |
| §4.2     | 同账户不同session/不同账户                                    | A→B、B→A头顺序后自然GET，以最后实际Cookie为准                                                                   |
| §4.3     | A proof+B Cookie拒绝、员工写计数不变                          | 不自动重放；错配/迟到restore仅修CSRF，有限恢复后手动新写                                                        |
| §4.4     | 晚login跨logout/改密、跨实例撤销/过期                         | 放真实头后自然GET区分存活/已撤，不拿JS epoch作网络证明                                                          |
| §6应用   | 两Set-Cookie/no-store/login JSON无token/服务端收到Cookie      | DOM登录→workspace→登出→重登，HttpOnly/Secure/Lax/Path/无Domain及实际回传                                        |
| §7负向   | 缺/null/foreign Origin标Node instrumented；GET豁免/双载体拒绝 | 缺/错/跨session CSRF与零写副作用                                                                                |
| §5       | 既有Web304/PG20不冒充新增Chrome调度                           | 真tab广播/focus同代保表单、换代reload清body dialog、旧请求/mount不覆盖B、初始401无reload循环、mount冲突手动重试 |

## 文件及验证纪律

拟新增独立opt-in工具；真实DOM复用driver。若提取Chrome生命周期适配旧preflight，先登记旧→新与逐文件真变异，再单独重跑原29/CSP3，不混自然Cookie结果。原fixture/网络硬闸/PW不变。输出仅固定类别/计数/布尔，正常/失败/信号验证API/listener/Chrome/profile/schema精确清理。独立提交后同一稳定干净HEAD完整CI0再交协调，未完成不预填。

历史CRM/360异步选择不替代当前执行，已落盘不重改。主代理曾误将旧回复当当前结束，已恢复；两次不存在路径读取无写入；先行docs patch两次索引锚点错误均原子失败无部分落盘。协调两次JS括号SyntaxError执行前失败无外部作用，修正后初派实际一次。

## 实际检查点：恢复页退出阻断（未完成，不提交候选为已测试实现）

新增七个 `session-network*` 文件仍是WIP，旧preflight/driver/fixtures/网络策略/业务源码/PW均未改。没有抽取旧launcher；新独立owner沿既有flags/ActivePort/精确进程验证实现，仅真正共享ownership matcher和driver，不称生命周期已抽取复用。独立只读复核证实gateway barrier在下游写头前；发现的query/raw URL硬闸、逐资源清理、CDP异步failclosed和中断race已在候选修正：现在中断标记由有界setup/用例边界检查，等待当前工作settle才清理，不Promise.race遗留后台工作。生命周期故障/信号实测、这些修正的变异及全矩阵仍未执行，不能算闭环。

实际日志：

- `/tmp/kingturf-s4-network-first-2026-10-17.log` exit1：真实DOM登录/工作台及Cookie属性1项通过，挂载冲突退出未通过；当时隐藏错误详情，不能倒推失败细节。全部owned资源清理true。
- `/tmp/kingturf-s4-network-second-2026-10-17.log` exit1：Node手工Cookie/Origin缺、null、foreign零员工写及GET豁免4项通过；Chrome真实DOM登录/工作台1项通过；随后 `DOM logout returns login` 超时。全部owned清理true。
- `/tmp/kingturf-s4-network-signout-diagnostic-2026-10-17.log` exit1：同样5项通过；固定诊断 `logoutRequests=0 / hasLoginForm=false / retryFailureVisible=true`，再次同位置超时。gateway listener、Chrome root/profile、两API子进程及随机schema全部已清理。Chrome154.0.8037.99/CDP1.3，原安全flags/新profile/自然Secure Cookie未降级。

确定调度：真实SPA登录B→workspace→reload，hold真实employees响应头→真实同页另一个BroadcastChannel发invalidate→watch同代复验→释放employees头→显示手动恢复页→真实Input点击“返回登录”。这是显式调度信号，不是自然跨tab行为证明。没有注入假modal/伪造认证。

独立只读核对因果：entry.ts:243–246、262的revision验证再次pause owner并抛错；startup-failure.ts:40–48调用POST logout，http.ts:30–32因canWrite=false在fetch前抛本地403，界面显示“退出未完成”。刷新仍可恢复，不能称全部手动恢复不可用。挂载冲突保守失败本身已在前端证据登记，**新确认的是其“返回登录”操作被同一暂停门禁拦住**。登记TD-WEB-009，业务修复须独立处理，当前不擅自给所有paused写放行/恢复proof/绕过代际检查。

已执行：新增纯JS2项（精确URL负例、真实头barrier）通过、七文件eslint通过、prettier通过、doc-lint152通过。首eslint曾因测试空arrow报2条，已加注释后通过；另一次多文件patch因browser匹配行变化原子失败，随后按实际行重做。未执行：Runtime协议矩阵（DOM阻断前未到达）、同代focus/tab/dialog/旧mount完整矩阵、逐文件真变异、生命周期负向、API/Web全量和本步最终HEAD完整CI。工具里的`__s4`协议请求只可算Chrome自然Jar+受控Runtime.fetch，不可冒充SPA owner处理或DOM登录写。迟到restore当前候选尚须按真实login-context使l域Cookie后hold restore，断仅CSRF Set-Cookie→B proof403/零写→显式restore新写201；同账户不同session旧proof也须补独立拒绝例。SEC003/评分开放，WIP不标验收/无新提交。
