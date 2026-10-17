# 批次4 S4：Cookie／CSRF 实现设计与行为表

## 0. 设计基线、已决与当前停点

基线2e22837已人工验收S1–S3、裁定六项并正式授权S4；[开工R7](harness-batch4-s4-authorization-2026-10-17.md)独立提交a7d7833。主代理亲核人类原始实施授权及九旧Playwright专项回复：本轮九份不改，Cookie适配/逐文件真实变异/实际补跑合并为阶段5前硬前置，CDP不冲抵；production命名/runtime/config仍静态分类、不触生产。API/Web/CDP本轮被适配文件各自真实变异纪律不变，不重问已决选型。

**本步只有设计docs，后端编码前停协调只读复核。** 以下是已授范围内的明确实现约定和未来验证计划，不是已实现/已测结论。若实施发现[影响报告§2–6](harness-batch4-s4-session-impact-2026-10-17.md)以外的新影响面/新竞态，按C7停报，不现场扩大。SEC003真实完成前不关闭，安全评分不预填，最终整批仍须人工验收。

## 1. 不变量、模块与配置

不改变AuthenticationService.login产生的32随机字节base64url opaque token、现有secret-bound SHA-256入库算法、scrypt、CredentialStore/AuthorizationContext、SQL/schema/撤销事务/审计锁。logout撤请求session、改密/管理员重置仍撤全部目标session。签名双提交不是JWT、refresh token或新认证凭证；不用原始token/tokenHash作公开代际，不新增依赖、业务仓储口或G3白名单。

实现分层：

| 计划文件/层                                                                         | 单一职责与边界                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/config/src/browser-session.ts`＋`index.ts`                                | 纯配置类型/解析/冻结；不Node crypto、不依赖apps。源.ts和built入口都必须可原生导入                                                                                               |
| `apps/api/src/session-proof.ts`＋`security.ts`                                      | 新窄crypto helper封装签名/验证/代际；AuthenticationService私有持有/委托，使用现有session secret；原login/authenticate/logout/改密算法/参数不改，secret与tokenHash不进入DTO/日志 |
| `apps/api/src/middleware/session-carrier.ts`及必要同责小helper                      | 有界Cookie/原始头解析、载体分类、精确Origin和proof校验编排；不SQL、不跨仓储。新模块≤800/完整函数≤200/AST≤5，无新增豁免                                                          |
| `routes/auth.ts`、`app.ts`、`server.ts`                                             | 既有auth service和同一S2 limiter装配；仅认证/头适配及小路由接线，不挪业务权限/签名路由；不向ApiDependencies新增业务仓储端口                                                     |
| `apps/web/src/http.ts`、entry/login-flow/session-parser、三域client/owner及文档读取 | 共享浏览器会话上下文，不手注Bearer；原权限/timeout/correlation/幂等/分页/上传与route-wave仲裁保留。实际路径不是shared/http.ts                                                   |
| `scripts/e2e-cdp/`新独立opt-in模式/测试                                             | 自有真实HTTP Cookie预检及最终DOM主链/负向，不把Fetch.fulfill模拟当真实Cookie证明；原默认未知请求/写硬闸保持                                                                     |

`buildApp`在原独立security选项追加非secret browserSession配置；server由parseEnvironment显式传入，AuthenticationService继续从私有session配置派生proof。直接dispatch测试可使用同一公开非secret默认，但绝不硬编码测试签名密钥、缺方法降级放行或按测试环境关闭Cookie校验。生产auth实例必须具备全部新proof方法；旧mock只在真正触及新行为时逐处适配，不能为保旧oracle增加运行时legacy-login分支。

### 公开配置（本步不改配置源码/example）

| 环境键                           | 明确默认/验证                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_COOKIE_NAME`            | `__Host-kingturf-session`，RFC token安全子集/≤64 ASCII、与CSRF名称不同；始终HttpOnly/Secure/Lax、host-only，不提供降属性开关                                                                                                                                                                                                 |
| `CSRF_COOKIE_NAME`               | `__Host-kingturf-csrf`，同名规则；始终Secure/Lax/host-only，可读但不作为认证凭证，值也不记日志                                                                                                                                                                                                                               |
| `SESSION_COOKIE_PATH`            | `/`，两Cookie共用；只接受覆盖全部`/api/v1/`的明确路径前缀，拒控制符/分号/query/hash/反斜线。任一名称用`__Host-`时必须`/`；不设Domain                                                                                                                                                                                         |
| `SESSION_COOKIE_MAX_AGE_SECONDS` | 默认已解析SESSION_TTL_SECONDS，整数60..该TTL；登录认证Cookie实际Max-Age再向下取整、不超过该次expiresAt剩余时间，过期结果不发认证Cookie                                                                                                                                                                                       |
| `SESSION_TRUSTED_ORIGINS`        | dev/test默认精确`http://localhost:5173`及`http://127.0.0.1:4173`；production默认仓库固定站点`https://erp.kingturf.cn`。允许显式配置1..8个精确origin、去重/规范默认端口，不从Host/X-Forwarded-Host推导；production仅HTTPS，非生产HTTP仅loopback/localhost。空显式值/null/通配/用户信息/非根path/query/hash/多源拼接请求值拒绝 |
| `TOKEN_LOGIN_ENABLED`            | 严格布尔默认true以保已批工具兼容；false只关闭新token发放，不恢复旧browser JSON token，不冒充完整载体回滚                                                                                                                                                                                                                     |

配置校验追加在旧配置、S2、CSP原校验之后，旧首错与secret/DB/example原字节前缀保持；`.env.example`只追加上述公开值/理由。不读真实.env/连接串。现compose未透传这些新键且无env_file，本步不改compose、不假设外层env自动传播；默认值让现有装配无需新增部署动作，进程级覆盖可配置，但不能据此宣称Docker部署已支持全部覆盖或生产已配置。任何未来部署/额外透传仍按部署权限单独核，不在本步现场扩大infra。

## 2. Proof具体格式、材料与生命周期

以现有session secret为唯一稳定根材料；crypto均在API私有helper内。使用HMAC-SHA256、带长度前缀的UTF-8字段框架，版本/用途域隔离，不能简单拼接可变字段。下表是符号公式，无任何实际key/token/signature样例：

| 输出/用途         | 定义                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 已认证写proof key | HMAC(rootSecret, frame(`kingturf/csrf/session-key/v1`, rawSessionToken))；不能用员工ID/expiry替代session绑定                                                                                                                                               |
| 公开generation    | base64url(HMAC(rootSecret, frame(`kingturf/session-generation/v1`, rawSessionToken)))，32字节；不是tokenHash/认证凭证、不接受为Bearer，不参与权限授予                                                                                                      |
| 已认证CSRF proof  | `v1.s.<nonce>.<mac>`；nonce为32 CSPRNG字节base64url，mac为上述session-key对frame(`write`,nonce)的HMAC；同session合法复用，换session则拒绝                                                                                                                  |
| 未认证login proof | `v1.l.<issuedAt>.<nonce>.<mac>`；另用`kingturf/csrf/login-key/v1`域，并绑定请求当前认证Cookie的原token；无认证Cookie时使用明确empty-binding而非伪造会话。nonce32随机字节；issuedAt规范秒整数，最多300秒旧/5秒未来容差；只允许browser login，不能用于业务写 |

预登录MAC精确公式：loginKey = HMAC(rootSecret, frame(`kingturf/csrf/login-key/v1`, bindingKind, bindingValue))；mac = HMAC(loginKey, frame(`kingturf/csrf/login-proof/v1`, canonicalIssuedAt, nonce))。bindingKind明确区分session-cookie与empty，bindingValue分别为当前原token与空字段；时间、nonce、用途及绑定全部受MAC保护，不能修改明文issuedAt续期。独立负例分别只改issuedAt、只改nonce、empty与有Cookie互换绑定，并以移除时间签名的真实变异证明相关检查变红。

预登录proof完全stateless，不建预会话表/全局nonce池，不作一次性凭证；成功登录总换为`s`域的新nonce/proof。旧Cookie即使已过期/撤销，只可作为login-CSRF绑定材料，不能因此通过authenticate；畸形/空/重复认证Cookie仍401、不能降级机器。账户/密码仍须原校验与S2认证；登录前proof不把旧身份直接升级成新session。

Cookie proof与头proof必须同值；严格有界语法/唯一字段/43字符base64url及规范编码后，对固定长度字节用timingSafeEqual验证MAC/绑定和相等性，不用字符串`===`代替签名比较；无效格式可先拒绝。认证请求仍先原DB authenticate，故同session CSRF复用不越过过期/撤销；改SESSION_SECRET仍同时影响原哈希认证，不新增自动密钥轮换/兜底key。所有实例必须使用相同已有secret，证明必须含跨实例一致性。

CSRF Cookie登录时与认证Cookie同范围/寿命；恢复时可复用已验证`s`proof，缺失/不匹配才签发新CSRF值，最大年龄取配置值。恢复没有从AuthorizationContext查询session expiry的新SQL，故不宣称恢复CSRF Cookie寿命精确等于剩余session TTL；它可能成为无效Cookie字节，但后端认证到期始终拒绝。原session DTO不含expiry，不伪造该字段。

## 3. 入口、恢复与载体行为表

新增请求头：`x-kingturf-csrf`、`x-kingturf-session-generation`、`x-kingturf-session-intent`。前端proof/generation保在绑定已验证页面身份的内存上下文，不每请求读取最新CSRF Cookie替换旧页面proof。跨源CORS不开放；引导GET须精确intent自定义头，跨站普通导航不能凭环境Cookie悄悄获取/轮换proof；GET不要求Origin/已有CSRF。

| 精确入口/请求                               | 新行为及首错/限制                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/auth/login-context`            | 新预登录引导，要求intent=`login`、无Authorization。只设CSRF Cookie、返回login proof；不创建session/不调用login、不设认证Cookie；已存在合法形态认证Cookie时绑定该值，无认证Cookie也可引导。认证Cookie畸形/歧义或CSRF重复401；单个坏CSRF可覆盖修复，intent错误403；响应no-store                      |
| POST `/api/v1/auth/login`                   | browser专用；原login/password形状校验后，严格Origin＋`l`域双提交绑定必须成功，才调用原S2 limiter/原auth.login三参。即使无Cookie也防login CSRF；成功只发两独立Cookie＋`{expiresAt,generation,csrfToken}`，绝不JSON返回raw token。登录body不新增字段，原credential验证/401/429/503语义保持           |
| POST `/api/v1/auth/token-login`             | 机器独立出口：enabled、无任何Cookie头/Authorization、无Origin、无sec-fetch-site，精确无query且JSON媒体类型，原凭据校验后与browser login共用**同一个**limiter和账户/IP窗口/退避。成功保持`{token,expiresAt}`且不设Cookie。Origin即使同源也拒绝以避免Web误取token；User-Agent/clientType不作信任依据 |
| GET `/api/v1/auth/session`，Cookie认证      | 原profile/permissions DTO追加generation；intent=`restore`时专门引导/修复`s`proof，返回csrfToken，必要时只设CSRF Cookie，绝不刷新/删除认证Cookie。无intent则不改Cookie、不回CSRF值；原身份读库不变。GET无Origin/无CSRF仍可认证；若带旧generation且与实际Cookie不符则401，不直接返回新身份           |
| GET `/api/v1/auth/session`，Bearer          | 保原DTO/body和会话检查，无Cookie/proof签发；机器兼容不是browser恢复路径                                                                                                                                                                                                                            |
| Cookie业务POST/PUT/PATCH/DELETE等非安全方法 | 全量严格Origin、认证、generation＋`s`域Cookie/头双提交；任何校验失败在业务handler/写仓储之前结束，无副作用。generation错/缺按401失去旧上下文处理；Origin/CSRF错403，不冒称token过期                                                                                                                |
| Cookie业务GET/HEAD                          | 只豁免Origin/CSRF，不豁免认证/权限；前端带generation则必须匹配，保证旧页读取不自动跨身份；无该头的安全读取仍可认证。GET不得产生业务写                                                                                                                                                              |
| 同请求认证Cookie＋Authorization             | API受保护路径及auth/HMAC入口统一401，包括空/畸形/重复认证Cookie、畸形Authorization；不先挑一个“能认证”的值、不fallback。无关Cookie不算认证载体                                                                                                                                                     |
| 显式Bearer业务                              | 没有任何session/CSRF相关Cookie，唯一非空Bearer；Origin或sec-fetch-site出现则403，不借工具分支绕过ambient browser上下文。Node/CLI可能自带sec-fetch-mode，不将mode单独当浏览器判据；原权限/过期/撤销/调用/响应保持                                                                                   |
| website HMAC精确原入口                      | 仍在Bearer业务认证前，由原canonical(parsed body)＋String(Number(timestamp))、时间窗/恒时HMAC认证；不改算法/签名fixture。相关Cookie/Authorization先401；Origin与Sec-Fetch-Site须均缺失，否则403；仅mode不拒。精确矩阵/首错见下文，无Origin机器请求保持可用                                          |

所有浏览器认证/引导响应（login-context、browser login及Cookie session读取/恢复，包括错误响应）明确`Cache-Control: no-store`，网络测试直接断该头，不以credentials或自定义intent代替缓存契约。

`login-context`与`session`的intent GET是明确CSRF引导流程，不新增认证载体。预登录会把共享CSRF Cookie从`s`换为`l`，其他已登录tab可能暂时403，这是保守拒绝而非认证失效；恢复CSRFCookie迟到最多造成proof失配/拒绝，绝不覆盖认证Cookie。重复恢复限一次自动尝试，仍冲突则停在明确登录/手动重试态，不无限循环、不自动重放原写。

同host多端口Cookie共享不等于Origin共享。按已选固定Origin集合比较scheme/host/port，拒缺失、字面null、非法或多值Origin；只对状态改变请求强制。原安全public `/health`/`/ready`/`/version`保持首位；原缺dependencies 503保持，其后才本认证入口/载体策略。HTTP解码/JSON错误/413仍是原transport边界，未成功解码请求不承诺先得到双载体401；有效API请求在业务逻辑前完成拒歧义。新增403先于limiter，CSRF/Origin失败不计密码失败、不占S2 auth调用；原字段类型400先于login安全预检，必须有明确组合错误测试。

### 有界头与多Set-Cookie

server显式透传相关头及headersDistinct原值数组供唯一性检查；ApiRequest原headers保单值兼容。Cookie总量≤8192字节、Origin≤2048、CSRF≤256、generation规范32字节；只解析配置的session/CSRF名称，不拒绝所有analytics Cookie。认证Cookie空/非法/重复始终401、不降级；CSRF Cookie重复歧义亦拒绝。单个CSRF Cookie缺失/空/畸形/不匹配，普通写仍403，但login-context的合法intent/无Authorization/合法认证Cookie形态引导或通过认证的session restore可覆盖修复；这两个GET保既定Origin/CSRF豁免，不要求先持有有效proof，不令用户卡死于无法重登。上述修复例外不绕过总长度/重复头/载体歧义检查。多个原Origin/Authorization不靠Node合并值推断唯一性；不改S2 forwardedFor来源或body上限。

website HMAC入口精确矩阵：认证或CSRF相关Cookie、任何Authorization先401拒歧义；随后Origin只接受缺失，任何存在值（含同源、异源、空/null/多值/非法）403。Sec-Fetch-Site只接受缺失，same-origin/same-site/cross-site/none/空/非法/多值均403；仅Sec-Fetch-Mode存在不单独拒绝，保Node机器请求兼容。头检查通过才进入原timestamp/签名/body验证顺序，canonical(parsed body)、String(Number(timestamp))、签名fixture与原错误契约不改。新增矩阵逐项测试首错，不用含糊的“不可信”替代；不扩成其他业务缓存/签名改造。

ApiResponse.headers改窄公共别名`Readonly<Record<string,string|readonly string[]>>`，route类型/helper/complete保数组，不改变原单值header期望。安全头helper仍过滤两个CSP头并固定原三头/RO；server两writeHead经小helper克隆只读数组为Node可写string[]，不join、不过滤Set-Cookie、不丢correlation/content-type/204语义。网络断独立raw Set-Cookie两条及每个属性，不用对象快照代替真实HTTP。

## 4. 清理、并发登录与可证明的身份语义

**固定清理原则**：普通401/403、logout204、credential204、只读session响应都不写认证Cookie；logout只撤该请求绑定session，改密仍原事务撤全部目标session。所谓“清理路径”是服务器撤销＋客户端丢弃旧内存/权限/cache/owner并回登录，不偷加延迟删除认证Cookie的端点；允许保留无效Cookie字节，后续严格browser login覆盖。403不自动读取新CSRF Cookie重试旧写。

**并发login定义**：浏览器最后实际应用的认证Cookie决定后续共享session，**不保证最后点击/最后认证完成胜出**。不增加多Cookie会话、服务端浏览器绑定表/SQL、全局操作序号或声称JS锁控制响应头应用顺序。两合法login按任意顺序到达均允许；成功JSON只能触发重新GET session验证，不能作为永久挂载身份。双Cookie不假定原子成对覆盖，交错失配即403无写；重新引导当前实际session的proof后，用户重新发起新操作才可成功。

迟到login跨越logout仍可创建共享有效身份，因为logout只撤它认证的原session，不取消其他登录；这是已盘点的并发语义，不声称无清Cookie解决所有登录竞态。改密后，迟到旧login响应若指向原事务已撤session，后续session GET必须401；若是改密后凭新密码真正新建session，则仍依原认证规则。两个不同账户及同账户不同session都要按请求实际Cookie与页面proof绑定，员工ID相同不能跳过。

网络级验证由guard回环测试库/真实Node HTTP控制响应头flush时刻，并由真实临时Chrome验证Cookie实际入库/回传与后续身份/写结果：

1. 延迟旧401/logout204/credential204至B新登录两Set-Cookie已到达后才放行；检查旧响应无认证Set-Cookie，后续实际session仍B。改密全撤会撤同一目标的较早B时不能伪报B存活：分别测试不同目标B与事务后新B，及同目标已撤B必须401。
2. A/B login头按A→B、B→A两顺序，同/不同账户；不按JS回调推论身份，后续真实Cookie请求才是oracle。
3. 保留A页面内存proof，实际Cookie已B，原写必须拒绝且仓储无副作用；失配不自动重放。CSRFCookie/head错配、迟到恢复CSRFCookie后亦拒绝并有限恢复。
4. 在途login晚于logout、改密提交后旧login响应晚到、跨实例撤销/过期；每个结果按原会话事务与请求实际认证时间分开，不能以JS epoch替网络证据。

## 5. 前端代际与必要同文件适配

浏览器`SessionContext`仅含session DTO/公开generation/页面内存csrfToken及本地epoch，绝无raw token/hash；共享HTTP transport接受上下文快照，发请求前不把旧快照替成全局最新身份。Cookie随credentials same-origin，原x-correlation-id/幂等/15秒全交换timeout/abort/204保留，移除手注Authorization。

entry首启动先检查旧键**是否存在的布尔**，不日志/交换旧值；有旧键一次删除kingturf.session/sessionExpired并要求重登。后续无旧键走Cookie GET session intent restore；401回登录、网络失败保可重试，不把“storage为空”继续当未登录。login-flow保持single-flight，先GET login-context获页面login proof，再真实DOM POST browser login、然后无旧generation的GET session重新核验才mount。

401回调携请求generation/epoch；仅仍属于当前已挂载上下文才失效重启，不清Cookie；旧回调不得登出已换代B。跨tab用非敏感失效信号（BroadcastChannel＋focus/visibility重核），只传generation/状态，不传proof/token；广播不是认证依据。检测变化先禁写/dispose旧owner/清缓存，重新读权限再mount；旧表单不得自动获得B最新proof后提交。

| 同文件必要适配                                    | 旧→新及理由/不得扩展                                                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| entry/bootstrap（TD-WEB-007耦合）                 | 旧token equality/无完成时复核→捕获会话上下文epoch/generation，await workspace及三域load完成后、replaceChildren之前再验证owner；旧成功/失败均不提交到新shell。仅服务此次无rawtoken后的身份归属，不修路由门控等旁支                   |
| commercial/store/route-state/read-owner及三域闭包 | storage token callback→同一已验证SessionContext owner；保publicEpoch/source version/isCurrent/串行波次，不用永真替代，不将逻辑丢弃冒称网络已取消                                                                                    |
| shared/document-read-service（TD-PERF-003耦合）   | 原每次读storage/仅path缓存→绑定session generation的服务/cache owner；失效清理；旧catch只在当前Map仍为同一Promise/owner时删除，防旧会话删除新项。这是同文件必要代际适配，单列新检查，不把静态候选泛化成已证生产泄露或关闭全部PERF003 |
| CRM/governance/controller与client                 | mount token闭包→会话快照transport；当前/旧请求生命周期按同一owner判提交，保权限/原API payload/顺序；不扩改任意其他生命周期债务                                                                                                      |

每处耦合在实施证据登记旧/新行、符号、理由与真实红绿；本设计不把这些计划动作算已修或无差别纳入TD-WEB-007/TD-PERF-003全项。

## 6. Secure真实HTTP预检：后端编码前前置

现CDP所有API由Fetch.fulfill模拟，不能证明Secure入库。下一实施步先新增独立`--cookie-http-preflight`，与probes/csp模式互斥：复用已有Chrome路径/随机CDP端口/全新owned profile/固定4173同源，4173由自有回环HTTP handler真实响应；不真实API/PG/外部站点、不借跨端口浏览器fetch冒充same-origin。只精确新预检GET/POST白名单Fetch.continueRequest，未知请求/外域/写仍fail，不通配/api。

新临时profile不播种cookie/storage；自有隔离测试页的真实DOM登录按钮触发fetch→真实HTTP两Set-Cookie→实际同源GET/POST服务端内部比对Cookie/Origin/CSRF头。此时不是旧SPA登录成功证明。Cookie元数据断HttpOnly/Secure/Lax/path；host-only由响应无Domain、浏览器存储domain及实际回传联合证明，不冒称CDP直接提供hostOnly位。另断JS不能读认证Cookie、实际后续回传；只输出布尔/计数/固定类别，不回显Network.getCookies/raw头/身份字段。新增HTTP listener/PID/端口纳入明确owner与异常/超时/信号清理、独立负向；不动外来文件/进程。

该最小handler只证明本机自然Cookie传输，不能冒充后端实施/DB撤销/完整CSRF已验；最终应用另真实跑登录→工作台→logout→重登与CSRF缺/错/跨session/双载体负例。Origin缺/null/异源由真实HTTP网络用例覆盖；CDP若重写负向头，必须标instrumented，不说自然浏览器会发送该头。不得用Runtime.fetch代替DOM动作，不能以Fetch.fulfill/HTTP200空体/单一document.cookie阴性替证。

若现HTTP `127.0.0.1:4173`不能实际存储并回传Secure Cookie，立即C7回报，停后端编码；不降Secure、不换localhost别名兜底、不放宽Chrome安全旗标、不sudo/缓存浏览器、不自行建HTTPS证书。此处只是设计，当前未运行/未证成功。

## 7. 旧期望映射、逐文件变异与分步门禁

影响报告§6固定库存仍是候选：124 API源=123测试+helper、13 Web测试、27 CDP源；不全改81 authenticate候选。后端新增Cookie/proof/Origin/头测试，旧机器Bearer常规业务body/status/权限/签名顺序冻结；旧login rawtoken行为只迁往token-login，browser login及session Cookie DTO/头变化逐处登记。新配置严格默认/错误优先另单列，S1/CSP响应头oracle不借S4重写。

每个API/Web/CDP被适配文件实施前登记“文件/原锚点→新锚点/旧期望→新期望/2e22837哪项依据/变异目标/实际红日志/还原绿日志”，缺任何一项不能标适配完成。变异必须扰动真正绑定的新实现并使该文件相关用例红，不能改测试为假红、误扰动fixture导致不相关错误、放宽toEqual或调用生产helper生成oracle。API mock、真实API网络/PG、Web运行时/读源绑定、CDP工具/真实浏览器分别计数；还原立即核无变异遗留，不并行跑PG/CI/build/browser。

未来检查至少包含：Cookie属性/寿命/不含rawtoken JSON、双载体401及畸形不降级；prelogin/session proof错域/缺/错/跨session/规范编码/合法复用/nonce时窗；Origin缺/null/异scheme/host/port/后缀/多值/伪Host；GET豁免但认证不豁免；两个login出口交错共享S2 10/11/429/退避/成功异常语义；真实两Set-Cookie和上述清理/登录响应乱序；权限/过期/撤销/改密全目标/跨实例；旧401与旧成功mount/route/cache归属；CDP主链/负例/所有owned清理。

九旧本地Playwright本轮**不改、不变异、不运行**，其Cookie适配＋各文件真实变异＋补跑一并为阶段5前硬前置；production两命名spec/runtime MJS/两配置仍静态分类/无diff不访问生产。当前API/Web/CDP适配可真实闭环，但不得称原Playwright或整批全部测试已适配通过、不得以静态read-source/移植CDP替spec变异。

分步：①本R7/设计docs完整CI后停协调；②Secure预检绿才后端独立行为提交，新增API测试及API＋Web全量绿；③前端独立行为提交，映射/逐文件红绿＋API/Web全量；④真实网络清理矩阵与CDP主链/负例；⑤最终稳定干净HEAD全CI0、台账SEC001仅RO/强制另批、SEC002/004核账、SEC003据实完成关闭、安全评分与四项前后行为/期望总清单/回滚证据后停人工验收。不自行阶段5。

## 8. 回滚、记录与本步验收

不引入“旧browser JSON token兼容开关”来绕过迁移；TOKEN_LOGIN_ENABLED=false只停机器token发放，不能回滚既发Cookie/CSRF/前端。若未来退S4，须核后继后按证据→工具/测试映射→前端→后端/config配套revert至2e22837，保S1/S2/S3；opaque/SQL不变所以没有数据迁移回退，既已撤销的会话不会因回退复活，旧storage不恢复，需重登。不改secret作回滚、不自动清会话/部署。

本步仅R7/设计docs，未实施上述helper、配置、端点、fixture或预检。R7 a7d7833只通过format/doc-lint及非文档零差异，不能称Cookie实测；设计最后实际稳定干净HEAD全`pnpm ci:local`结果在提交后交付，日志 `/tmp/kingturf-batch4-s4-design-final-head-ci-2026-10-17.log`。源码/测试/工具/infra/锁/workflow相对2e22837须零diff。

只读复核未发现新的架构阻塞；已按建议精确补记预登录MAC全部字段、浏览器认证响应no-store、跨tab proof暂时失配及隔离预检/host-only证明边界。上述均为设计澄清，未执行实现或浏览器验证。

工作中曾检测到外来未跟踪`tests/e2e/zz-accept-smoke.spec.ts`，随后消失；又出现外来通道证据及plan/index改动。均非主代理产生，未读取该spec/通道正文、未暂存/覆盖/删除；owner后以3144562提交三份文档，当前只剩本设计WIP。保留该独立提交，不将其冒称S4产物或运行授权；最终CI仅在本次文档提交后的同一干净HEAD串行运行。
