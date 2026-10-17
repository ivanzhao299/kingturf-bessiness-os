# 批次4 S4：会话载体迁移影响报告（仅报告，硬停人工确认）

> **时点更新（2026-10-17）**：本文件为420f9ba批准前影响报告，原文/库存/失败史保留；2e22837计划§7“4-S1S3验收+S4选型”已逐项裁定六项并正式放行S4实施，故下文“仅报告/待确认/硬停”均为报告时点，不能覆盖当前授权。[S4开工R7引用](harness-batch4-s4-authorization-2026-10-17.md)说明已决范围和先设计后编码的小步复核，不重新开放六项选型。

## 1. 结论与权限边界

接手基线 `28197d22cc5166ad651f0b1e385df03b85034a4d`、分支harnessing、工作树干净。S1/S2/S3已由协调独立确认；沿[R7正式授权](harness-batch4-authorization-2026-10-17.md)只做本报告及必要导航/计划/台账文档。**S4未实施，TD-SEC-003不关闭，批次4尚未人工验收，阶段5不启动。** 本轮不改源码、测试、会话夹具、Cookie/CSRF/Origin行为、sessionStorage/Bearer、SQL/依赖/workflow；不push/部署/dispatch/生产访问。

浏览器未来必须迁至HttpOnly/Secure/SameSite=Lax opaque session Cookie，不是“继续浏览器Bearer，只加Origin”。推荐候选为**Cookie＋绑定已认证session的签名双提交CSRF＋严格配置Origin**；更小替代是**同一Cookie＋严格Origin-only CSRF**。两者都必须先解决跨标签身份归属及迟到Set-Cookie竞态，再明确非浏览器兼容与迁移体验。下列都是供选择的提案，不是实现许可或已通过的Cookie测试。

保留[ADR0003](../adr/0003-opaque-session-authentication.md)：随机不透明token、服务端secret-bound SHA-256哈希、scrypt密码、每次请求验证有效身份/成员/过期/撤销及原事务锁顺序。不是JWT、不改token本体、不重写SQL或全局会话schema。报告涉及未来新增DTO/代际/配置的可行性待确认，不能凭本报告推定已获修改相关包的许可。

所有源码位置以下均固定上述基线；范围清单与代码事实不等于生产实测。只读子代理分担API链路、广域Web与测试库存；主代理读取执行规则、entry/http/session/owner并作最终取舍，所有写入和完整CI仅主代理执行。

## 2. 当前浏览器链路：逐处事实与未来影响

| 当前位置/符号                                                                   | 已核事实                                                                                                     | 若获实施授权的适配面（提案）                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/entry.ts:23` login，`:148` LoginCoordinator                       | POST登录解析JSON token，回调写sessionStorage后bootstrap                                                      | 浏览器响应不能再暴露raw token；改为Cookie成功语义及非secret会话上下文；不得只删setItem而留下旧解析器                    |
| `entry.ts:183` bootstrapApplication                                             | 无本地token直接显示登录；有token才GET session；401只在当前storage仍等于该token时清理；再动态加载workspace    | Cookie不可由JS检查，启动必须向同源session端点恢复并区分401/网络错误；不能继续用“storage为空”判未登录                    |
| `entry.ts:15`、`session.ts:10` expireSession                                    | workspace请求401回传请求token，比较当前token再清理并reload；启动401另有handler                               | 用已验证会话的非授权代际区分旧/新响应；403保持不退出；不能把token/raw hash当作公开代际                                  |
| `entry.ts:83` startupFailureView返回登录                                        | 当前仅removeItem并显示登录，不调用server logout                                                              | Cookie版仅删JS状态不能登出；须明确服务器撤销、UI与Cookie清理/竞态策略，不伪称已有登出UI全链                             |
| `apps/web/src/http.ts:28` json                                                  | `:38`显式Bearer，`:53`已credentials same-origin；15秒覆盖全交换；`:57`当前token401回调，`:67`改密204同样失效 | 统一transport切Cookie/CSRF/非secret代际；保超时、204、correlation、abort与错误解析；别把credentials配置视为Cookie已实施 |
| `apps/web/src/shared/session-parser.ts:4,10,17`                                 | stored token轻量语法、login要求token、session要求员工/公司/权限                                              | login/session新响应另逐处旧→新；移除存储载体不等于取消边界解析；expiry提示可以保非secret标记                            |
| `login-flow.ts:21` LoginCoordinator；`workspace-loader.ts:4`                    | 同一表单single-flight；业务模块独立45秒加载                                                                  | 保重复提交保护；它不串行其他标签页的login/logout，也不保证晚完成workspace属于当前会话                                   |
| `bootstrap.ts:618,646,650–662,668,723` mountWorkspace                           | mount起点清文档缓存；从session权限快照创建CRM/commercial/governance及token owner，等三域数据后替换root       | 全部装配改显式会话上下文；异步完成必须再核身份/代际再挂载，重新授权并销毁旧shell/owner，不能只替transport               |
| `shared/crm-http.ts:10`、`shared/commercial-http.ts:6`                          | 三域请求集中于json，CRM/commercial闭包捕获mount token；商业还含分页、幂等写及上传                            | 按请求绑定已验证身份，不让旧A界面以新B Cookie发写；保分页/幂等/上传契约                                                 |
| `governance/controller.ts:9,16,34`                                              | 捕获token/权限，并行读后直接赋views；写后load，无独立session代际                                             | 防旧结果在新身份重挂载后提交，不能冒称已有Commercial owner覆盖全部域                                                    |
| `commercial/store/route-state.ts:13`、`read-owner.ts:19,72`、`route-read.ts:22` | storage token相等才owner存活；publicEpoch/source version/isCurrent控制逻辑丢弃；不是网络取消                 | 删除storage后必须替换sessionIsCurrent来源，保route/wave仲裁；写也需身份绑定，不能用永真回调替旧保护                     |
| `shared/document-read-service.ts:4–22`、`bootstrap.ts:519,625`                  | 模块级服务实际发请求时读当前storage；path命中缓存不读token；mount时clear                                     | 请求、Promise缓存和编辑/发送操作须绑定同一会话上下文；跨身份不能混用旧权限与新Cookie                                    |

限定搜索：`apps/web/src`非测试TS中查`sessionStorage|localStorage|document\.cookie|credentials:|BroadcastChannel|addEventListener\(['"]storage`，未见现有Cookie读写/跨标签失效广播；不是全生产否定结论。搜`auth/logout|auth/credential`的非测试Web源码仅命中http改密204判定，不能把API存在等同已有自服登出/改密UI。

旧顶层异步mount缺代际复核是已登记TD-WEB-007；旧请求失败按path删新缓存候选是TD-PERF-003。这里只列迁移交互，不修、不开重复条目、不把静态候选推成已复现跨账号泄露；台账仍48。未来若需修原问题，必须另明确行为授权/提交/护栏，不混成载体守恒。

## 3. API、事务与执行顺序

当前`apps/api/src/app.ts:546–613`顺序是：

```text
三个public GET → 缺dependencies 503 → POST auth/login（S2）
→ POST integrations/website/leads（独立HMAC）
→ Bearer authenticate/401 → 其余业务路由与capability
```

| 位置/契约                                                                       | 当前事实                                                                                                                                                                                                             | 未来影响/不可改变的边界                                                                                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts:381–385` bearer；`:598–613` authenticate                                | 仅解析Authorization Bearer；每业务请求auth.authenticate                                                                                                                                                              | Cookie解析/双载体规则是新行为，不直接替换成“Cookie或Bearer随便取一个”                                                                    |
| `server.ts:166–179` request适配                                                 | 只复制Authorization/correlation/idempotency/website时间签名；无Cookie/Origin                                                                                                                                         | 接入原始Cookie/Origin及重复头拒绝策略，明确大小/歧义限制，不盲信Host/X-Forwarded-Host；S2 socketpeer/XFF另保持                           |
| `routes/auth.ts:23–71` login                                                    | 对象/字段/凭据校验→S2 limiter→auth.login；当前JSON返回token/expiry                                                                                                                                                   | 浏览器与CLI发放响应须分离，browser login也防login CSRF，保S2失败计数/退避；Origin新增首错位置须单列，不偷偷改变老400/503优先级           |
| `routes/auth.ts:77–86,115–137`                                                  | logout及credential需要已认证token；改密204撤全部目标会话                                                                                                                                                             | Cookie调用也认证/CSRF/Origin；旧logout/改密迟到不得清新会话Cookie；管理员重置另保capability/公司边界                                     |
| `security.ts:97–99,140–166,211–226` AuthenticationService                       | secret与token做SHA-256哈希（不是HMAC）；32随机字节base64url登录，仅hash送createSession；按当前时间认证、按hash撤销                                                                                                   | 载体迁移仍用同一服务端校验/撤销，不给Cookie新权限、不加缓存延迟，不输出raw/hash                                                          |
| `repositories.ts:294–343,410–433,470–478`                                       | token_hash/expiry事务写；撤销；每次查未过期未撤销且身份/员工/成员有效；改密/重置原子撤销                                                                                                                             | 保事务/审计/锁和多实例一致性，不以迁移为名重写SQL；已认证在途业务可完成的ADR边界保持                                                     |
| `routes/website-lead-ingest.ts:24–40`；根级`website-lead-ingest.ts:25–31,58–75` | 精确website入口在Bearer之前；route的rawBody实际上是已解析request.body，根级ingestor对对象键排序canonical，再以Number(timestampHeader)的String值＋点＋canonical(body)作既有HMAC输入，恒时比较并验时间窗；无Bearer要求 | 是独立机器鉴权，不应被全局Origin先行阻断；保已解析body的既有canonical签名及数值时间转换，不改成原始HTTP字节验签，不改签名fixtures/时间窗 |
| `app.ts:2127–2265` signature-envelope create/complete                           | 已在Bearer之后，并要求contract-signature:send/confirm                                                                                                                                                                | 不是公开webhook；绝不为“签署兼容”绕过认证/权限                                                                                           |

**插入点风险**：全局Origin若放在public/login/HMAC之前，会改变无Origin机器登录、HMAC集成及旧首错；只放Bearer后又漏浏览器login CSRF。未来须按明确端点/载体类别接线，而不是依据User-Agent或无Origin就认定机器可信。此轮不重排任何分支；“未找到其它公开webhook”仅限本表已查app/routes，不能外推部署或外部服务。

### 多值响应头不能遗漏

`ApiRequest.headers`在`app.ts:263–270`为单字符串map；`ApiResponse.headers`在`:272–275`为`Record<string,string>`，`routes/types.ts:18–26`承袭，`middleware/security-headers.ts:3–22`过滤/展开string map，`app.ts:4116–4122`再合并correlation，最后`server.ts:140–145,181–185`两个writeHead。

若session Cookie＋CSRF Cookie同响应，须端到端保留独立Set-Cookie字段，不能逗号合并；未来适配至少响应类型→route返回→安全头helper→complete→两写头分支→网络级断言。Node支持string数组，但当前项目类型不支持；这是待授权适配面，不是本轮改类型或改S1/S3头期望的理由。[Node24 HTTP文档](https://nodejs.org/docs/latest-v24.x/api/http.html#responsesetheadername-value)与[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)说明多值及浏览器JS不可读取该响应头。

## 4. 两个Cookie候选与请求类别

以下是本地代码事实基础上的方案推断，不是从标准直接推出唯一产品答案。两案都要求host-only（不设Domain）、HttpOnly/Secure/SameSite=Lax session Cookie，Path/名称/寿命/登出清除属性仍需明确；可考虑`__Host-`前缀但不得未经确认确定名字。HttpOnly减少token被JS读取，不消灭XSS代发请求；SameSite也不是CSRF替代。

| 候选       | Cookie与CSRF                                                                                                                                      | 收益/成本及待确认                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B 推荐** | 不透明session Cookie；另一可读CSRF Cookie与页面内存中已验证session绑定的CSRF值双提交为自定义头，服务端验证签名及当前认证session绑定；叠严格Origin | 防止未绑定随机值的弱方案；页面保留原会话绑定值可拒绝共享Cookie已换B的旧A页写，若每请求读取最新CSRF Cookie则此优势消失。增加获取/轮换、至少两Set-Cookie、多实例密钥一致性与跨tab成本。token本体不出现在可读Cookie/头/DTO；CSRF虽非认证凭证也不记日志 |
| A 小替代   | 同一HttpOnly session Cookie；所有浏览器状态改变请求严格配置Origin校验，不另加双提交                                                               | 改动少、少一个Cookie；缺失/null也拒绝会造成兼容性限制，强依赖浏览器/代理行为核验。不是保留浏览器Bearer，不按Referer宽松兜底                                                                                                                         |

CSRF签名须绑定每次登录session，而非员工ID/邮箱；不能只做Cookie=header。登录前还没有已认证session，B不能直接套已认证CSRF：候选为严格Origin＋同源预登录nonce/临时会话，成功后换为绑定正式session的CSRF；预登录态不能直接升级复用。此入口、临时态容量/清理、密钥域分离须另设计并授权，A则依严格Origin防login CSRF。上述比较参考[OWASP CSRF指引](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#signed-double-submit-cookie-recommended)；本项目采用哪案仍待人工。

### 配置Origin、缺失与null的拟议契约

期望Origin应由可信服务端配置精确列举scheme/host/port，分别核开发/测试/生产，不从请求Host或X-Forwarded-Host现算，不通配子域/端口，不做后缀匹配。合法性/默认端口规范化、空/null/多值/含userinfo/path/query/hash拒绝规则及配置首错必须新增独立测试；此轮不新增配置项。Cookie写请求的missing/null/cross-origin均建议403且无业务副作用；不将Referer存在或SameSite通过当作默认豁免。[OWASP Origin章节](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#using-standard-headers-to-verify-origin)支持强匹配及缺失/null不视作可信来源；这里选择“严格拒绝而非其他fallback”是产品提案。

覆盖POST/PUT/PATCH/DELETE等状态改变动作，明确包括browser login、logout、credential、管理员身份/重置、导入/附件/发送/审批等业务写。public安全GET保持只读；session GET恢复只读，不滚动写session Cookie，CSRF引导若需Set-Cookie应设计为专门受控流程，不能暗中加到每次401或GET。

| 请求类别                                | 推荐候选规则（非实施）                                                                                                                 | 兼容/失败边界                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| browser login（未登录也可能带旧Cookie） | 原login入口专用于browser Cookie响应，不返rawtoken；严格Origin，B另预登录证明；保S2                                                     | 即使无Cookie仍防login CSRF，不能用“无Cookie”跳过；旧Cookie存在时先明确身份替换策略                                                |
| browser已认证Cookie业务                 | 验Cookie；状态改变请求验Origin，B再验session-bound双提交；保权限/幂等/审计；只读session GET可无Origin，不全局拦                        | csrf/Origin失败不是auth失效，不清会话；会话/CSRF相关名称的空/非法/重复歧义值拒绝，无Bearer降级；不拒绝所有无关Cookie              |
| 同时有session Cookie与Bearer            | **推荐直接拒绝歧义**，包括看似同值及Cookie无效时；不fallback                                                                           | 若人工选Cookie优先也必须走Cookie的全部CSRF/Origin，禁止Bearer优先借机器例外绕过ambient Cookie                                     |
| 无session Cookie＋显式Bearer工具        | 是否保留为独立人工选项；若保留仍每次认证/过期/撤销/权限/审计，限定显式兼容端点与JSON规范，CORS不宽放                                   | 无Origin本身不是身份；存在不可信Origin/浏览器上下文不能静默借工具例外。不能据CLI易用而恢复Web的存储token                          |
| 非浏览器取得token                       | 推荐独立、显式启用的token-login出口（路径/权限待定），复用原凭据校验/S2；要求无session Cookie，拒浏览器Origin/上下文，不设浏览器Cookie | 不靠User-Agent或可任填clientType证明机器；此分离减少误暴露，不宣称能区分所有客户端。浏览器login JSON不暴露token；不在本轮新增端点 |
| 独立website HMAC                        | 仅精确旧入口、无session Cookie、独立有效HMAC可保无Origin兼容；保已解析body canonical/数值timestamp转换与旧错误优先                     | Cookie或Bearer混入不得借HMAC例外跳浏览器保护；推荐拒歧义；不改变签名契约或把业务签署路由变公开                                    |

非浏览器Bearer是否继续支持、是否需要受限token发放出口，必须单独确认；不能在批准Cookie时顺带决定CLI废弃或给所有写接口豁免。仅分登录URL不令两类opaque token密码学不可互换；若还要求用途/发放来源隔离，需要另审服务端元数据/策略，不能偷偷改变ADR0003或扩SQL。双载体拒绝须覆盖已识别session Cookie名但空/畸形/重复，以及异常Authorization；解析失败不得降级成“无Cookie机器”。所有新错误码/先后次序（403与400/401/503/429）及Cookie/签名混用失败顺序均须在未来行为表逐处登记。

## 5. 跨标签、迟到响应与体验：实施前阻塞项

1. **共享身份不同**：sessionStorage按origin/tab隔离（opener初始复制后独立），Cookie按host/path共享且不隔离端口。未来同host另一端口/另一tab登录B可使A tab下一请求携B；旧权限快照/表单不能被当B意图执行。需要人工接受“同浏览器同host单一账号”或要求独立profile/host；Cookie不提供原逐tab多账号体验。[MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)、[RFC6265 §8.5](https://www.rfc-editor.org/rfc/rfc6265.html#section-8.5)。
2. **重新核验与挂载**：候选为每tab内存保存已验证的非授权session代际，跨tab仅广播失效/换身份信号；focus/visibility恢复及敏感写前重新核session，上下文改变先禁写、dispose owner、清缓存/旧视图再重新取权限挂载。广播不是认证依据，员工ID相同也不代表同次登录。服务端对旧UI请求代际与实际Cookie的绑定/拒绝契约需设计，不能只让http每次读取最新可读CSRF Cookie而把A旧界面自动升级成B。未确定DTO/代际产生方式，不暴露raw token/hash，也不假称已证明无需任何接口变化。
3. **迟到401不能清新Cookie**：浏览器接收Set-Cookie发生在JS处理响应之前。原token equality只能控制JS清storage/reload，不能拦住服务端旧401带expired Set-Cookie把新登录清掉；单纯AbortController或JS epoch也不构成撤销已应用头的保证。候选最低要求是普通401、权限403和只读session响应不自动删除/刷新认证Cookie，JS只在匹配本tab已验证代际时更新UI。
4. **logout/改密/并发登录同样有竞态**：A请求在途→B新登录设置Cookie→A迟到logout/改密响应删除同名Cookie，仍可清B；并发login的迟到成功也会覆盖。RFC指出并发Set-Cookie存在竞态。[RFC6265 §4.1.1](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1)。logout仍撤请求绑定session，改密仍按原事务撤全部目标session，绝不缩小撤销范围；两者的Cookie清理另行设计。候选是避免这些响应无条件删除共享Cookie（留下无效Cookie值的体验须人工接受），并严格串行/协调所有会写认证Cookie的操作；或另设计经实测可证明的协议。不能仅检查服务器请求时的Cookie就保证响应到达时仍是同一Cookie，不能声称广播/锁覆盖失联tab、刷新或网络未知结果。清理/并发策略未确认前是实施阻塞。
5. **撤销/权限与在途操作**：保原改密撤全部目标session、跨实例即时读库；权限改变、账号停用、expiry在恢复与请求校验处再查。已经通过认证的业务请求可能完成，Cookie迁移不等于可取消已提交事务。跨tab权限刷新/丢失未保存输入的提示、路由退回行为需人工接受。
6. **迁移体验**：推荐一次清理旧sessionStorage后要求重登，不用JS中的旧Bearer静默换Cookie；旧服务端token是否集中撤销/自然过期是不同决策，不做DB清理。替代限时交换要额外防CSRF/重放/身份冲突、设截止与回滚，不能以过渡名义让browser长期双载体。此轮不删任何存储、不令任何用户退出。
7. **本地Secure兼容未知**：MDN列localhost例外，但不能把它外推到现有WSL→Windows Chrome的127.0.0.1 built preview或HTTP dev/API分端口；CDP Fetch fulfill Cookie入库/发送、路径/host/port和真实Origin行为都须获授权后实际核验。[MDN Secure属性](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure)。不能降Secure、改Chrome安全旗标或假称当前CDP已测Cookie；若需本地HTTPS证书/启动设施另确认，不访问生产补证。

## 6. 测试与工具库存（接手HEAD重盘）

以下固定28197d2重新盘点，不能沿用S2的“123源=122测试+helper/Bearer84/authenticate80”。只读静态AST和词面扫描，未执行Cookie场景/未适配任何fixture；数字是候选，不是全部必改，也不是运行用例数。`apps/web/test`目录不存在，实际位置是`apps/web/src/*.test.ts`。

| 搜索范围                        | 文件数/静态test注册                                                                   | Bearer候选文件/词出现 | authenticate候选文件/词出现 | sessionStorage候选文件/词出现 |
| ------------------------------- | ------------------------------------------------------------------------------------- | --------------------- | --------------------------- | ----------------------------- |
| `apps/api/test/**/*.ts`含helper | 124 TS源=123 `*.test.ts`＋`fixtures/released-order-http.ts`；直接it/test1674，each975 | 83/138                | 81/305                      | 0/0                           |
| `apps/web/src/**/*.test.ts`     | 13测试；直接132，each23                                                               | 1/1                   | 1/3                         | 1/2                           |
| `tests/e2e`的TS/MJS spec        | 12源=11TS＋runtime-local MJS；直接37（TS36/MJS1），each0                              | 2/13                  | 1/2                         | 8/15                          |
| `scripts/e2e-cdp/*.mjs`         | 27源、6 test文件/直接51；不等同本次CI运行65                                           | 2/2                   | 0/0                         | 5/6                           |
| `scripts/verify_p1_demo.mjs`    | 1 MJS工具，无test注册                                                                 | 1/3                   | 0/0                         | 0/0                           |

case-insensitive精确正则为`\bBearer\b`、`\bauthenticate\b`、`\bsessionStorage\b`；只输出路径/行号/符号/计数，不输出匹配行正文。静态AST直接注册总1894、each998：API640个字面量each表/3088元素，Web2表/4元素；356个动态表不能静态展开。调用点/表元素不等于Vitest运行17184或Node循环展开数，不据此加总“精确会话测试”。API另1 JSON fixture不计TS源；词面命中可能是注释或普通业务认证helper，也会漏不使用这些词的真实会话/解析测试。

### 逐组候选旧→新与变异提案（仅提案，零适配）

| 组/当前锚点                                                                                                                                                   | 未来适配候选与必须保留的断言                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/test/auth-route-contract.test.ts:18,32,54`、`auth-http-postgres.integration.test.ts:119,300`、`authorization-http-postgres.integration.test.ts:100` | 当前login JSON token/显式Bearer→人工选定browser Cookie与机器兼容两条；保密码验证、事务/撤销/身份状态、capability/首错/审计/相关ID。变异：漏Cookie属性/认证、忽略撤销/过期、跨公司/权限改变须红                                                                                                                                                   |
| `identity-access-route-contract.test.ts:24`、`identity-provision-route.test.ts:17`、`login-rate-limit.test.ts:237`及其他API普通route候选                      | 不把81 authenticate文件都改成Cookie；先分auth mock与真实transport，机器Bearer可保原fixture。改密/管理员重置/限流语义不因载体改变；网站HMAC/业务签署的body与签名fixture冻结，新增CSRF分类负向独立                                                                                                                                                 |
| `apps/web/src/http.test.ts:11,19,26,45,55,82,100,120`、`session.test.ts:18,27`、`login-flow.test.ts:5,34,47`、`boundary-parsers.test.ts`                      | 当前Authorization注入/token相等/改密204与login parser→非secret代际/新JSON语义；保超时/abort/403不登出/延迟401不伤新会话、single-flight和解析错误。session.test无sessionStorage词仍是候选，不能因正则0排除                                                                                                                                        |
| 原本地9个TS spec                                                                                                                                              | `cost-matrix-product-quality`、`document-send-product-quality`、`login-product-quality`、`order-evidence-product-quality`、`p1-demo`、`session-revocation`、`source-nested-authorization`、`startup-delivery`、`workspace-route-isolation`；扩展名均`.spec.ts`、目录`tests/e2e`。逐处区分真实DOM登录与storage预置/route stub，不全量重写所有断言 |
| 本地关键锚点                                                                                                                                                  | `session-revocation.spec.ts:11,38,43`、`startup-delivery.spec.ts:61,83,90,103,115,121`、`workspace-route-isolation.spec.ts:5`、`document-send-product-quality.spec.ts:28`、`p1-demo.spec.ts:14`、`runtime-local.spec.mjs:51,53`：未来Cookie jar/恢复/撤销及跨tab变体；保真实DOM、路由隔离、权限与网络闸，不直接用API请求冒充点击                 |
| 两个production命名spec                                                                                                                                        | `production-readonly.spec.ts:7,16,51`；`production-role-uat.spec.ts:143,163,184,234,260–318`。只静态分类，当前零执行；不能为“清单完整”访问生产或拿其做本地变异输入                                                                                                                                                                               |
| 两配置                                                                                                                                                        | 根`playwright.config.ts`、`playwright.runtime.config.ts`冻结且未本轮执行；未来配置改动/运行环境另确认。11TS＋runtime MJS不是“原9套已补跑”                                                                                                                                                                                                        |
| 原CDP                                                                                                                                                         | `fixtures.mjs:643`预置存储、`boundary-probes.mjs:23,32`、`probes.mjs`及相关fixture/probe/driver/network-policy。未来适配必须保exact本地路由/未知请求与未知写fail-closed、独立profile/清理与旧UI断言；不全局替换token或关闭网络硬闸                                                                                                               |
| S3新增CDP                                                                                                                                                     | `csp-send-fixtures.mjs`/`csp-send-probes.mjs:21`/`csp-send.test.mjs:76,219`是真DOM合成登录和精确send；`csp-observer.test.mjs:73`断不注入sessionStorage。未来改Cookie模拟需真实浏览器证明Set-Cookie入库/回传、保持login→session→send202与哨兵/HTML头独立证明，不仅改字符串                                                                        |
| CDP测试库存口径                                                                                                                                               | 六test文件为`fixtures.test.mjs`、`driver.test.mjs`、`network-policy.test.mjs`、`ownership.test.mjs`、`csp-observer.test.mjs`、`csp-send.test.mjs`；当前CI显式CDP五路径加独立nginx client测试实际65，文件存在不等于ownership本轮单独执行。当前S4不补跑浏览器或扩工具                                                                              |
| `scripts/verify_p1_demo.mjs:17,19,275,314` get及显式Bearer                                                                                                    | 非浏览器调用候选；若保Bearer可沿旧契约，否则先定义新取token/载体与日志脱敏，不能擅自把工具改Cookie或打印认证值                                                                                                                                                                                                                                   |

实际实施前仍需逐处列“旧期望→选定新期望→具体人工确认项”，动态fixture factory与读源断言需证明仍绑定新目标并至少每组一次有效变异红→恢复绿；负向应涵盖缺/错CSRF、旧session绑定、错误Origin、ambient Cookie＋Bearer绕过、迟到响应、未知路由与权限，不削弱原toEqual/状态/body/correlation/签名顺序以迎合新方案。本轮只是候选清单与未来矩阵，未执行这些变异或Cookie测试。

另用文件名补漏：`rg --files apps/api/test | rg -i 'auth|security|password|session|identity|authorization|login|credential|token'`得10候选（auth-http-postgres.integration、auth-route-contract、authorization-http-postgres.integration、authorization-routes、identity-access-route-contract、identity-provision-route、login-rate-limit、login-rate-limit-http、security、security-headers，均`.test.ts`）。这包含非会话的安全头候选，不能全标必改；也不能因无password/session命名就说服务层测试缺失。`security.test.ts:18,26,30,98,163,213,236,244`为服务测试注册点，不因Bearer正则未命中排除。

Web read-source/解析与store-loading候选补充：`bootstrap.test.ts:46,57,99,119,197,231`是读源helper群，须核绑定/切片仍有效；`boundary-parsers.test.ts:40`起、`commercial-store-contract.test.ts:26`起、`commercial-loading.test.ts:22`起、`commercial-route-data.test.ts:135`起与`workspace-loader.test.ts:6`起是运行时测试候选，不含上述读源helper，须另评估语义影响。不能只替源码路径或删掉含token的断言。S3精确router符号`csp-send-fixtures.mjs:createCspSendRouter:47`、probes `runCspSendProbes:10`、`csp-send.test.mjs:loggedIn:66`；`preflight.mjs:271`网络拦截、`:347–349`选择router、`:450–451`触发send probes是工具接线候选。这些仅位置，不输出fixture、token、签名或连接值。

## 7. 未来实施验收矩阵（全部未执行）

| 类别        | 未来必须真实验证的正反与并发场景                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 登录/恢复   | browser无raw token；正确/错误凭据、S2 10/11与退避；刷新/无旧storage/有效Cookie恢复、无Cookie/过期/撤销/网络失败、初始化重复提交；login CSRF与旧身份替换                                                                              |
| 载体/头     | Cookie HttpOnly/Secure/Lax/host/path/寿命；重复/非法Cookie、两Set-Cookie网络分离、CSP/S1/correlation保持；browser不得读raw token/Set-Cookie；无CORS宽放                                                                              |
| CSRF/Origin | 正确双提交/签名/session绑定；缺/错/伪造/跨session或过期会话误用；同session合法复用不因“重放”一词而拒绝，签名双提交不是天然一次性。Origin精确/缺失/null/异scheme/host/port/后缀陷阱/多值/代理伪造；失败无业务副作用、不计错误auth失效 |
| 所有写入口  | login/logout/credential/admin reset、发送/提交/审批/上传/导入等；先后错误400/401/403/429/503表；publicGET和HMAC未误拦，业务signature仍需capability                                                                                   |
| 代际/跨tab  | A/B两tab身份切换、同身份重登、权限变化/撤销/expiry、旧成功挂载/旧错误/延迟401；旧UI不得以新Cookie写；route/wave/缓存不跨会话提交                                                                                                     |
| Cookie竞态  | 迟到401无Set-Cookie清新；logout/改密/并发login迟到与新登录；读响应不滚动token；网络未知回执、tab崩溃/刷新与协调失效边界；不仅断JS状态                                                                                                |
| 机器兼容    | 若获准，明确无Cookie Bearer token发放/认证/撤销；Cookie+Bearer/HMAC歧义拒绝；缺Origin机器login与HMAC独立保留；不得把浏览器伪clientType当授权                                                                                         |
| 护栏适配    | 逐处旧→新→具体人工决策/不变量；原严格body/status/correlation/权限/签名先后冻结，只有批准消失的旧载体期望可改；每组实际变异红→恢复绿；旧oracle不是调用生产helper生成                                                                  |
| 运行层次    | API mock＋真实guard测试库/HTTP＋真实浏览器Cookie行为，各自边界分开；原Playwright需Linux Chrome后真实补跑，CDP不抵销；源码及完成docs分别实际干净HEAD完整CI                                                                            |

## 8. 批次4 S1–S3交付与回滚导航

| 步骤           | 独立提交/真实绿色检查点                                                                                                               | 期望/验证边界与回滚索引                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1安全三头     | 授权bed8b40；行为b02ad55首CI1；oracle59f9dfa全CI0/180503.567ms；完成00ed10d全CI0/178476.659ms                                         | 65文件76期望仅追加三头，保旧语义；应用complete范围非所有传输/代理响应。实现与oracle配套逆撤，见[S1证据](../evidence/security-batch4-s1-headers-2026-10-17.md)/[逐处映射](../evidence/security-batch4-s1-oracle-map-2026-10-17.md)                                                                  |
| S2登录限流     | 设计2ce5dab；行为bdbda0e首CI1/新端口未分类；声明身份门禁b8c1212全CI0/194043.303ms；完成74c78c3全CI0/203898.679ms                      | 账户/IP10失败15分钟、持锁退避、429不续禁、容量503；61新API/19config/10gate，旧oracle冻结。单进程/重启清零/默认trust-none，上线前核实际代理链；非全API DoS。门禁/业务配套回滚，见[S2证据](../evidence/security-batch4-s2-login-limit-2026-10-17.md)                                                 |
| S3 Report-Only | 设计10f841e；行为762e393；oracle a4c2ca3；工具f693ee2全CI0/219878.817ms；完成e291cd5全CI0/192316.095ms及最终28197d2全CI0/206309.018ms | 68文件81CSP期望、122旧API完整逆AST；工具65、原CDP29、新3、nginx20；本地有限观察只有故意sentinel。无receiver/生产发布周期/强制/打印实测。source＋oracle＋工具配套逆撤，见[S3证据](../evidence/security-batch4-s3-csp-2026-10-17.md)/[映射](../evidence/security-batch4-s3-oracle-map-2026-10-17.md) |

API最新123文件/17184，Web13/266、config29、database68/domain14/types1；这些是S1–S3现有Bearer载体的验证，不是S4 Cookie已绿。S3 API false与outer off独立，inner直连HTML无CSP，仓库nginx变化未安装/reload；TD-HYG-002只登记、SEC006/007/BOUND003/004/七N+1/既有前端候选不修。原11TS Playwright及runtime MJS/两配置未本轮执行，不能称整批4人工验收或阶段5完成。

本报告可独立revert回接手28197d2，仅撤文档不触S1–S3行为；若后继有文档依赖先核再配套。既有回滚只作索引，未实际执行revert、数据库清理或部署。最终文档提交后实际稳定干净HEAD完整CI专用日志 `/tmp/kingturf-batch4-s4-report-final-head-ci-2026-10-17.log`，结果执行后报告；不预填SHA/成功，不在CI运行时改候选。

## 9. 人工待确认（报告交付后硬停）

| 决策                   | 推荐与替代                                                                                                                                 | 当前状态                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| D1-S4-1 CSRF           | B Cookie＋session-bound签名双提交＋严格Origin；替代A同Cookie＋严格Origin-only                                                              | 待确认，两案均不是保留Web Bearer           |
| D1-S4-2 非浏览器       | 显式保留无Cookie Bearer与受限token-login出口；双载体/HMAC混入拒歧义；也可选择废弃并迁CLI                                                   | 待确认，不推定工具兼容自动获批             |
| D1-S4-3 体验/代际      | 接受同host跨tab单身份，切换先失效/核session/重挂载；旧storage一次清理重登                                                                  | 待确认；限时交换是额外替代方案             |
| D1-S4-4 Cookie写入竞态 | 普通401不清Cookie；logout撤该session、改密原事务撤全部目标session；Cookie清理独立防迟到清新会话，可保留无效Cookie字节或另设计清理/并发协议 | 待确认并需可证明的网络级方案；JS epoch不够 |
| D1-S4-5 配置/运行      | 精确受信Origin集合、Cookie名称/path/寿命、Secure本地/HTTP/CDP实测条件；若需本地HTTPS另授权                                                 | 待确认，不降Secure或放宽浏览器安全         |
| D1-S4-6 实施范围       | 逐组旧→新映射/变异实测，明确是否一并授权涉及TD-WEB-007/TD-PERF-003的必要代际适配；SQL/模型/其它债务不纳入                                  | 待明确后才列实施批次/实际许可文件          |

在这些选择明确、实施范围另获人工确认前，**停止，不继续S4实现**。本次完整CI仅证明文档未破坏S1–S3现有系统，不代表候选Cookie方案安全性已实测。

## 10. 报告核验与纠正记录

仅静态盘点与文档校验，未运行Cookie/CSRF/Origin实验、未适配源码/测试/签名fixture。初稿采信前置库存把website的rawBody变量误称原始HTTP body，并把根级`:58–75`误挂route文件；独立复核提醒后主代理亲读route全44行及根级canonical/ingest，提交前已统一为已解析body既有canonical签名和数值时间转换。初稿Cookie未知名/只读GET Origin/CSRF“重放”歧义也在复核后收窄，不引一次性token新语义。两次只读文件定位有不存在旧路径/glob的exit2，按实际文件表纠正；不是业务失败、未改被测对象，不在输出重述任何认证值。

最终改动须用`git diff --name-only 28197d2 HEAD`证仅文档，源码及测试相对接手HEAD零diff；该证明、最终SHA/树空/CI真实退出码与耗时以提交后实际检查交付，不预填。S3 28197d2最后CI日志`/tmp/kingturf-batch4-s3-final-state-head-ci-2026-10-17.log`为206309.018ms/exit0；S4最终CI日志另用本报告§8所列路径，不覆盖S3证据。
