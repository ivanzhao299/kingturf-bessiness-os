# 批次4 D1 安全加固整体验收包（2026-10-17）

## 当前交验状态

S1–S3已于2e22837人工验收；S4六项选择及实施授权见该提交、[开工R7](../tasks/harness-batch4-s4-authorization-2026-10-17.md)与[固定设计](../tasks/harness-batch4-s4-design-2026-10-17.md)。S4后端、前端、真实网络/CDP及退出窄修现已完成实施和独立核验；**本包为批次4整体交验材料，不代表本次整批人工验收已通过**。本次只补文档，不改源码/测试/工具，不重复Chrome或PG矩阵。

实际最终源码检查点 `f114ee0038e8ef4568c1521b51efa606cb52da66`：稳定干净HEAD完整 `pnpm ci:local` **exit0 / 192524.18ms**，开始/结束同HEAD、clean=true、unchanged=true，日志 `/tmp/kingturf-s4-network-final-head-ci-2026-10-17.log`。API126文件/17242、Web14/313、config2/71、database3/68、domain3/14、types1/1；新增2工具测试确在test链；结构0违规/29原豁免、原启动预算JS11991/CSS1898 gzip、audit零已知漏洞。相对bfdc4ff，apps/packages/infra/PW/config/lock/预算与结构脚本零diff。最终本包文档提交后另在同一稳定干净HEAD跑完整CI，日志 `/tmp/kingturf-batch4-acceptance-final-head-ci-2026-10-17.log`；不把源码CI冒称未来文档HEAD结果。

## 四项前后行为及验收结论

| 范围        | 实施前                                                                | 实施后及实际证明                                                                                                                                                                                                                                    | 明确未承诺                                                                                            |
| ----------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S1 / SEC004 | API自身无统一三头，依赖nginx                                          | complete统一nosniff、SAMEORIGIN、strict-origin-when-cross-origin；正常/错误/413等原body/status/权限/首错不改，新增15/API严格oracle独立同步后全CI绿                                                                                                  | 非dispatch前传输异常或nginx自产响应全覆盖；未生产部署/核同名三头数量                                  |
| S2 / SEC002 | 登录仅scrypt成本，无失败窗/429                                        | 账户/IP独立10实际null失败/900秒；第10仍401、第11前置429/Retry-After不续禁；100×2^(k−1)ms上限1000ms、持锁退避。成功/异常不计且不清历史；容量/不可信链问题503；新增API61/config19与并发/窗口变异                                                      | 仅单进程登录；非分布式/全API限流或完整DoS防御，代理真实链待上线核实                                   |
| S3 / SEC001 | 无CSP                                                                 | API RO与外层nginx HTML RO；强制默认关闭。API新增9/config6、旧头oracle独立追加、原29/新CSP3、脱敏collector、合成发送202及本地头矩阵20通过                                                                                                            | RO不阻止违规；无生产receiver/一发布周期观察、无生产TLS/打印全覆盖，强制另授，不关闭全项               |
| S4 / SEC003 | Web把opaque token放sessionStorage并手注Bearer；浏览器与机器登录同出口 | HttpOnly/Secure/Lax Cookie认证＋session-bound签名双提交/严格Origin；Web不可变context/owner/generation/epoch、旧storage一次清键重登、同代保表单/真换代reload；机器独立token-login保无Cookie Bearer；真实API/PG/Chrome26及故障9，窄修bfdc4ff，最终CI0 | XSS不能读认证Cookie不等于无XSS/同源恶意动作；无JWT/新SQL会话模型；九旧PW延期、机器CLI未全执行、未部署 |

S4固定语义：普通401/403、logout204、credential204与session读取不发认证Set-Cookie；logout只撤请求session，改密/管理员重置仍原事务撤目标全部session。两合法login最后实际到达的认证Cookie决定共享身份，不保证最后点击胜出；两Cookie不假定原子，错配拒绝，不自动升级旧proof/重放写。跨logout晚到的另一合法login仍可建会话，改密前已建却晚到的session若已撤必须401。opaque/scrypt/服务端哈希/SQL/schema/撤销事务/网站HMAC算法未改变。

## 测试期望与夹具适配总索引

| 批次/文件组       | 原→新及冻结部分                                                                                                                                                                                                 | 真实红绿/证据入口                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1旧API65文件76处 | 74严格envelope＋2直接headers只追加三头；24同形请求头不动；body/status/权限/首错/仓储/签名和会话输入保持                                                                                                         | [逐文件65/76映射](security-batch4-s1-oracle-map-2026-10-17.md)、[S1证据](security-batch4-s1-headers-2026-10-17.md)：旧实现新12断言真红，逆追加字段完整AST守恒；首次b02ad55全CI6994旧oracle红保留，59f9dfa绿 |
| S2新增测试与门禁  | 无旧API/Web期望改动，原config4不变＋19；新limiter端口按真实声明身份分类，不按名字豁免                                                                                                                           | [S2证据](security-batch4-s2-login-limit-2026-10-17.md)：阈值/转发/窗口真实1/2/1红→61绿；原生入口红→绿、纯名字逃逸红→49门禁绿；bdbda0e首次门禁CI失败不抹去                                                   |
| S3旧严格头        | 68文件81对象只加CSP；逆去该字段后完整122旧API文件AST相同，不改旧业务/fixture                                                                                                                                    | [逐处68/81映射](security-batch4-s3-oracle-map-2026-10-17.md)、[S3证据](security-batch4-s3-csp-2026-10-17.md)：真实移除RO头9红→70绿，旧无头9红，AST工具扰动无关断言红→还原绿                                 |
| S4 API6旧文件     | auth-route-contract、login-rate-limit-http、app、foundation-api旧login改机器token-login/JSON头；auth-http-postgres旧7处login仅机器路径；website-lead-ingest邻界适配双载体/机器分流，HMAC夹具与四参/receiver保持 | [后端逐文件表](security-batch4-s4-backend-2026-10-17.md)：真实机器端点变异使4文件9红75绿→84绿；PG选1红19跳过→全20绿；website首错1红93跳过→94绿，不称全20/94都红                                             |
| S4机器CLI/config  | verify_p1_demo只换机器login URL、JSON/Bearer业务断言保持；原config index/CSP/S1/普通Bearer业务不需全量迁夹具                                                                                                    | 同后端表：读取实际CLI绑定的URL变异1红→1绿；新配置/签名时间等独立变异；**不是完整写业务CLI已执行**                                                                                                           |
| S4 Web5旧文件     | http/session/login-flow/boundary-parsers/bootstrap必要上下文/DTO/回调适配；原业务权限/payload/分页/幂等/parser引用/457链保持，bootstrap三fixture参数及两个解析锚点有逆AST；其它旧文件不因候选库存而全改         | [前端逐文件表](security-batch4-s4-frontend-2026-10-17.md)：分别真实1/2/1/1/1红→8/4/3/87/88绿；core received/decoded真实扰动红→还原；首次boundary还原残行/预算多次失败保留；新browser-session35另计          |
| S4退出窄修        | http精确当前SessionContext POST `/api/v1/auth/logout`仅豁免本地pause，current/原generation/CSRF/服务端/响应归属不动；不resume、不自动restore/replay、其它unsafe禁写                                             | [窄修证据](security-batch4-s4-paused-logout-2026-10-17.md)：旧实现新增9中2红15绿，删除新实现例外再2红→还原17绿；API17242/Web313、真实DOM原失败链logout204→重登绿                                            |
| S4 Secure预检CDP  | preflight独立新模式，旧probes/CSP/driver网络与断言保持；不是SPA/API认证夹具                                                                                                                                     | [预检映射](security-batch4-s4-cookie-http-2026-10-17.md)：入口/精确白名单实际变异红→10绿，工具75；当时旧完整29/CSP3/旧生命周期5另回归，不能当最终S4真实API证明                                              |
| S4真实网络CDP     | 新独立session-network工具，不适配旧29/CSP3/fixtures/PW；固定真实API+PG+自然Jar，受控Runtime不充SPA DOM                                                                                                          | [最终网络证据](security-batch4-s4-network-2026-10-17.md)：移真头barrier1红1绿→2绿；真实changed分支删reload，DOM8绿后新身份检查精准红→原源码还原/重build26绿；所有变异未入库                                 |

历史批次3 CRM输入重建后值/焦点/选区恢复与360 `['orders','finance']`夹具修正已落盘；异步回复不构成本批新变更。本批不是把全部候选API/Web/CDP库存都适配，也未降低严格断言/预算/结构/G3白名单。适配总索引导向逐文件证据，不用新增测试数量代替旧文件真变异。

## 分层证据，不相互抵账

- API/mock/独立crypto/config及Web运行时/读源：最终API17242、Web313、config71等属于全CI；不称全部真实HTTP/SQL/浏览器用例。既有真实PG20仍在全API链，多实例撤销/事务原断言保持。
- 新真实网络26：**Node手工Cookie/Origin4、真实SPA DOM8、Chrome自然Jar＋受控Runtime.fetch14**。包括真实头flush前barrier、B已自然请求确认后放旧头、实际员工写计数为零、同/异账户不同session及改密撤销范围；Node缺/null/foreign Origin明确instrumented，GET豁免不豁免认证。
- DOM8有真双tab实际登录广播、自然focus/visibility同代保节点/值/activeElement/选区，真实PG文档详情→body editor/翻译/settings，换代main frame导航清理、旧detail/mount不覆盖B。focus按该tab/requestId loadingFinished＋无在途＋两RAF断言；初始401为200ms、旧结果释放后250ms有限窗口，不称任意未来事件形式证明；整页销毁旧realm不冒充无导航同realm owner guard证明。
- 9资源负向：listener/profile故障、setup截止、API spawn错误、server错误、fixture SIGTERM、browser SIGINT、未知写、cleanup SIGTERM；实际均受控exit1且对应listener/API/root/profile/schema清理。240s/120s/35s只协作截止或诊断，非任意PG/OS挂起的强制有界kill保证。工具连接超时只在合成fixture，不改数据库包。
- S3原29/CSP3/本地nginx20为S3时点实跑；S4预检当时另回归29/CSP3；最终网络没有重跑/适配旧合成29/CSP3。本轮不再次启动这些矩阵。RO collector不是生产receiver，合成发送202不是邮件送达。
- **九旧Playwright/config保持未改未跑**，已按人类专项裁定把Cookie适配、每文件真变异与完整实际补跑合并为后继硬前置，CDP不抵账。production命名spec不访问生产。Docker通道的他人文档3144562不算本轮构建/补跑；Docker/R7须后继独立续派，当前不启动。

最终strict26日志 `/tmp/kingturf-s4-network-final-strict-chrome-2026-10-17.log`；9负例汇总 `/tmp/kingturf-s4-network-lifecycle-summary-2026-10-17.log`；Chrome154/CDP1.3、原安全flags、新profile、自然127.0.0.1:4173 Secure Cookie、最终blocked0/asynchronousFailure=false/owned全部清理。无秘密/DSN/原始Cookie或proof输出；旧失败/脱敏事件按分证据保留，不复述敏感值。

## 配置默认与生产边界

| 配置                                                     | 默认/已实施约束                                                                                                                                       | 部署注意                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| S1三头                                                   | nosniff / SAMEORIGIN / strict-origin-when-cross-origin                                                                                                | API complete覆盖不等于nginx自产/dispatch前全覆盖；同名三头代理重复数尚待上线核实                                   |
| `LOGIN_RATE_LIMIT_*`                                     | enabled=true、failures10、window900s、base100/max1000ms、buckets10000、pending64、trustedProxies空                                                    | 精确可信IP非CIDR；默认忽略伪造XFF。生产compose必要S2透传已在库，未部署；真实双代理peer/追加链必须核实              |
| CSP_ENFORCE / 外层nginx开关                              | API false、外层off；始终RO，强制仅各自显式打开，外层统一CSP头                                                                                         | 两开关不是同一配置；内层直连HTML无CSP；无report-uri/report-to接收端。生产一发布周期观察后另授强制                  |
| SESSION_COOKIE_NAME / CSRF_COOKIE_NAME / PATH            | `__Host-kingturf-session` / `__Host-kingturf-csrf` / `/`；Secure/Lax/host-only，auth HttpOnly，双头独立                                               | 无降Secure选项；本机自然HTTP通过不保证其它环境                                                                     |
| SESSION_COOKIE_MAX_AGE_SECONDS / SESSION_TRUSTED_ORIGINS | max-age默认SESSION_TTL_SECONDS且登录不超该次剩余寿命；dev/test精确http://localhost:5173与http://127.0.0.1:4173，production精确https://erp.kingturf.cn | 不信任Host/X-Forwarded-Host、不通配；恢复只修CSRF不刷新auth Cookie。S4新键未增加compose透传，不假定外层env自动传播 |
| TOKEN_LOGIN_ENABLED                                      | true；仅无Cookie/Authorization/Origin/site的机器独立出口，与browser login共享S2 limiter                                                               | false只停新机器token发放，非载体迁移回滚；完整业务CLI未全跑，不借机器出口向Web恢复raw token                        |

公开键完整拼写/合法边界见[S2设计](../tasks/harness-batch4-s2-design-2026-10-17.md)与[S4设计§1](../tasks/harness-batch4-s4-design-2026-10-17.md)。不读取真实.env、轮换secret、执行生产配置或部署。本批安全实施不等于生产启用/全站安全已解决。

## 提交链、实际CI与逆序回滚

| 小步顺序（先→后）                                          | 实际已知绿色检查点                                                                                     | 回滚顺序/保留                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| R7 bed8b40；S1 b02ad55→59f9dfa→完成docs00ed10d             | 59f9dfa全CI0/180503.567ms；00ed10d全CI0/178476.659ms                                                   | 后继先撤；oracle59f9dfa与行为b02ad55配套，保先行授权；仅退一边使严格头oracle不匹配                                                |
| S2设计2ce5dab→bdbda0e→b8c1212→docs74c78c3                  | b8c1212全CI0/194043.303ms；74c78c3全CI0/203898.679ms                                                   | 门禁声明分类b8c1212与业务bdbda0e配套逆撤，保S1；enabled=false只为显式运维开关，不是自动部署/撤源码                                |
| S3设计10f841e→762e393→a4c2ca3→f693ee2→docs e291cd5→28197d2 | f693ee2全CI0/219878.817ms；e291cd5为192316.095ms；28197d2为206309.018ms                                | 先工具、oracle、行为/config/nginx配套逆撤至74c78c3，保S1/S2；不修改独立S1旧固定证明基线                                           |
| S4报告420f9ba→人工2e22837→a7d7833→设计efae93d→预检fead2d1  | 设计全CI0/211588.694ms；fead2d1全CI0/205231.486ms                                                      | 设计/授权/工具按后继依赖逆序；保S1–S3及外来独立3144562，不把该提交计本批源码                                                      |
| 后端6c453e4→aaf182b→25526c8                                | 25526c8全CI0/203058.579ms，保两轮CI失败史                                                              | 先前端/工具再后端三提交配套逆撤；分别为载体实现、无会话缓存分类getter额外读取修正、config本地URL类型构建修正，不回退SQL/哈希/算法 |
| 前端b38c75c→退出bfdc4ff→真实工具f114ee0                    | b38c75c全CI0/192629.727ms；bfdc4ff定向API/Web/Chrome且工具WIP未称干净HEAD CI；f114ee0全CI0/192524.18ms | 先f114ee0再bfdc4ff再b38c75c，保后端；完整S4回滚再逆撤后端/config/预检至2e22837，先核相邻hunk/依赖，不保证任意跳步revert无冲突     |

本包最终文档可独立revert但不改变实现；未执行任何实际回滚。opaque/SQL未迁移，无数据迁移回退；已撤session不会因代码回退复活，旧storage不恢复，需重登。不改secret当回滚、不自动清Cookie、不推送/部署/workflow。历史失败包含S1严格oracle、S2声明分类、S4后端两轮构建/缓存及前端预算/退出与CDP间歇失败，逐份分证据保留，不能由最终绿倒推旧失败均无效。

## 台账、评分与交接

49顶层条目不删历史：SEC001只RO段完成、强制开放；SEC002登录范围/SEC004已验收实施完成；SEC003按固定六项及真实网络/最终源码CI关闭**实施项**，本次整体人工验收待交付，九PW延期义务仍硬前置。TD-WEB-009实施完成待整体验收；WEB007/PERF003仅S4必要同文件代际适配，整项不泛化关闭。SEC006/007、BOUND003/004、七N+1、HYG002不扩修。

在既有TD-TEST-006下新增可检索后继待核候选，不新增顶层ID：`final-bound-chrome`第9项未分类CDP异步失败，资源清理；最终strict26绿不证明旧根因或风险消失，仅登记待核实、不放宽失败分类、不回写原点击/viewport历史已解决结论。[质量评分](../QUALITY_SCORE.md)保原1–5四维及既有数值，仅追加安全当前事实和已测/未测依据；无覆盖率量化/生产实测依据，不能借本批抬分或宣布阶段5目标通过。

最终文档HEAD完整CI真实0后停协调交验，不自启Docker/R7/PW/阶段5。后继生产/强制CSP/代理链与机器调用迁移/延期PW均由独立授权和证据收口，不以本包代替。
