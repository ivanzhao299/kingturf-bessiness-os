# Docker Playwright 前置库存与通道准备（2026-10-17）

## 当前状态与授权

基线 `d801237548981d2caa02c22b77f3e774447392b1`，S4实施已收口且完整CI真实0/191602.5ms、首尾同HEAD/clean/unchanged；整批人工验收未预填通过。[R7完整授权](../tasks/playwright-docker-authorization-2026-10-17.md)独立提交 `8772284`。本页是先于A/B执行的逐行库存、环境准备与S4适配提案；本轮截至此处spec、两配置、业务源码均零改，未跑任何spec。只读独立复核覆盖全部12源/两配置，与主代理分类一致。

## 配置与发现范围

- `playwright.config.ts:4–18`：testDir全目录，单worker/retries0，默认 `http://127.0.0.1:4173`，由 `KINGTURF_BASE_URL` 覆盖；channel=chrome、headless、失败trace/截图保留，HTML结果在 `.test-results/playwright-report`。无webServer，需独立起preview/API；没有testMatch/testIgnore。不得裸跑全目录，必须逐spec显式白名单，防止发现C与带模块顶层guard的runtime。
- `playwright.runtime.config.ts:3–28`：独立默认 `http://127.0.0.1:5173`，`KINGTURF_RUNTIME_WEB_ORIGIN`只允许loopback HTTP无凭据/路径/query/hash；仅匹配runtime-local，browserName=chromium而非channel Chrome，trace与截图明确off（真实身份不得进入附件）。不能借主配置强行绕过其guard/泄漏身份。
- 两配置均不改。全部spec/config内静态搜索 `rg -n 'erp.kingturf.cn' tests/e2e playwright*.ts` 无字面生产主机；C的目标来自baseURL，不因缺字面地址而允许运行。生产C不curl/导航、不创建或借用真实账号。
- 以下“A”指浏览器测试本身使用合成API响应，不证明所有请求已硬闸；部分文件只拦指定路径，未匹配请求可能进preview代理。A准备时不启动真实API，真实网络硬闸/未匹配请求如何诊断需保留原语义，不静默吞失败。

## 全部12源逐文件分类（先库存，未执行）

统一主配置baseURL记为P：默认127.0.0.1:4173，本Docker授权要求容器访问实测网关IPv4:4173（不是生产）。账号仅下列合成角色或环境键名，不读取值。

| 类别                      | 文件/源码锚点                                               | baseURL / 后端与账号 / 数据依赖                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A                         | `cost-matrix-product-quality.spec.ts:3–24,81–177,313–475`   | P；两测试分别合成成本分析员、商务管理员，登录/session与成本读写route stub；36模型/13因子、冻结转报价等内联数据，无PG种子。第一测试仅指定路径stub，第二generic含fallback，不称全请求硬闸。                                                                                                                                                  |
| A                         | `document-send-product-quality.spec.ts:3–60,70–281`         | P；文档测试合成角色与权限，generic API route；内联文档/版本/connector及发送202，所有“发送”合成，不联系客户/provider。                                                                                                                                                                                                                      |
| A                         | `login-product-quality.spec.ts:3–54`                        | P；合成产品验收身份；只拦login/session，180ms延迟/401；无真实账号/PG，初始restore/login-context须S4适配。                                                                                                                                                                                                                                  |
| A                         | `order-evidence-product-quality.spec.ts:7–60,63–101`        | P；合成履约核对员，generic route；内联订单/合同/timeline，首503后成功、mobile证据，不需后端。                                                                                                                                                                                                                                              |
| A                         | `workspace-route-isolation.spec.ts:3–40,58–186`             | P；合成导航管理员，generic route；内联客户/空成本和延迟360，用于隔离/晚结果与失败，不需PG。                                                                                                                                                                                                                                                |
| A                         | `session-revocation.spec.ts:3–48`                           | P；合成会话验收角色，generic route；401/403循环只测浏览器行为，真实撤销由原API集成另证。首次goto在route安装之前，不能声称零未匹配请求。                                                                                                                                                                                                    |
| A                         | `startup-delivery.spec.ts:3–9,12–123`                       | P；合成startup身份；首冷登录无API stub，其余restore/session及资产延迟/abort；验证冷启动、业务资源预算/进度/失败恢复，无PG。                                                                                                                                                                                                                |
| A（需B级生产器前置）      | `source-nested-authorization.spec.ts:4–28,30–53`            | P；浏览器所有API由generic route回放，合成账号；模块顶层读 `.test-results/authz-ui-fixtures.json`。必须先guard本地PG运行原 `apps/api/test/authorization-http-postgres.integration.test.ts:13–16,238–249,342–344,557–559` 产denied/authorized/masked样本；浏览器回放不是浏览器真实API证明。先确认产物来源/时点，不打印内容中的敏感业务片段。 |
| B                         | `p1-demo.spec.ts:3–18,20–265`                               | P；真实/api登录，`KINGTURF_ADMIN_LOGIN`（代码默认admin）/`KINGTURF_ADMIN_PASSWORD`；无route stub。需隔离guard本地PG/API、合成管理员及信用审批身份和完整P1种子（订单/AR/付款/佣金/风险/MRP/生产等固定业务编号）。不得复用生产身份。                                                                                                         |
| B（有额外guard/通道阻断） | `runtime-local.spec.mjs:3–11,16–19,25–77`                   | runtime配置loopback默认5173；`KINGTURF_RUNTIME_ACCEPTANCE=1`、NODE*ENV=test、受guard的`KINGTURF_RUNTIME_DATABASE_URL`且owned `runtime_web*` schema、合成`KINGTURF_TEST_LOGIN/PASSWORD/COMPANY`。真实浏览器创建随机客户，DB持久化/审计及权限断言。不能将容器网关DSN伪装回环以绕guard。                                                      |
| C（禁止运行）             | `production-readonly.spec.ts:3–18,20–36,38–87`              | 主配置baseURL可外部指定；UAT或ADMIN环境身份、expectedRelease；真实health/ready/version且断environment=production、桌面/移动全菜单巡检。不静态改名作本地B；需独立目标/账号/生产只读授权。                                                                                                                                                   |
| C（禁止运行）             | `production-role-uat.spec.ts:19–21,143–170,183–235,239–322` | 主配置baseURL；角色账号JSON或显式PROVISION开关+管理员；真实API探针，可创建员工/identity/assignment并删除分配/停用（不只是只读）。需独立角色/写入/撤销授权及身份传递设计。本轮不设置这些开关、不执行。                                                                                                                                      |

总数A8（含回放1）/B2/C2。历史九份=上述A8+B的P1，不把runtime或两个production误算进“旧九”。所有A/B第一轮全绿才连续第二轮；本阶段先交库存/通道，不宣称已履行任何spec补跑义务。

## S4逐处旧→新映射提案（尚未修改）

共同新契约依据：`apps/web/src/browser-login.ts:21–33` 先login-context再login；`shared/login-parser.ts:5–22`要求login proof/expiry/generation，禁止raw token；`shared/session-parser.ts:4–18`要求generation与session-bound csrfToken；`entry.ts:208–214`发现旧storage即清键转登录，不会恢复；`browser-session.ts:5–10`每次启动读Cookie restore。合成fixture只满足客户端格式，不可冒称真实签名/Cookie服务端验证。真实签名与双Cookie必须B或此前S4自然网络另证。

| 文件/精确位置                                                          | 旧行为 → 所需新行为                                                                                                              | 边界/保留                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cost:81–95、313–337                                                    | login返回token/session无proof → 初始restore401、login-context合成proof、login成功新DTO、随后restore同generation/proof            | 两套身份/权限/成本业务payload、UI/分页/核算/转报价断言不改；仅内联fixture。每个文件至少实际一次fixture变异红→还原绿。                                                                                |
| document-send:27–49                                                    | initScript写旧storage/session DTO → 去旧storage注入，以新restore DTO预置合成已认证会话                                           | 内联fixture，发送/connector/权限/幂等/未保存编辑/零导航等全部业务断言冻结。                                                                                                                          |
| login:15–23、40–45                                                     | token登录/普通session及无初始restore → 初始401、login-context、成功新login/restore DTO，失败保401                                | 登录计数、重复submit、180ms阶段与单错误/密码清空断言冻结，不降等待/跳过。                                                                                                                            |
| order-evidence:9–20                                                    | generic token登录/session → 初始401、login-context、成功新DTO/restore                                                            | 订单/合同/timeline与503重试/请求计数/mobile断言冻结。                                                                                                                                                |
| workspace:4–24                                                         | initScript旧storage/session → 去注入、新restore合成会话                                                                          | 路由/节点身份/迟到响应断言冻结；360:154–161另缺unavailableSections，为**非S4数据形状候选**，此刻不顺手补或改parser。旧CDP夹具授权不自动扩大为本spec授权。                                            |
| session-revocation:9–29                                                | goto后旧storage注入/普通session → 新restore合成认证会话、不注入旧token                                                           | 注入点属fixture；**38与43–45直接断storage为null/保旧值，不是仅fixture**。应另明确最小新断言（Cookie不被普通401清理/403保上下文等）与原行为范围，协调判定前不改。                                     |
| startup:60–65、82–85、102–104                                          | 旧storage启动/普通session → 新restore成功DTO或503→401状态机，不注入旧token                                                       | **90–92/115–117/121直接旧storage断言**超仅fixture；保持暂态失败可恢复、业务下载门、资产失败显式刷新语义，具体替换断言待范围裁定，不能删除断言称绿。冷登录12–54还需初始restore401 fixture才有登录页。 |
| source-nested:6–9、21–23                                               | producer Bearer session普通DTO＋合成token登录 → 消费侧为回放session追加合成新proof/generation、初始401/login-context/新login DTO | 不改真实PG producer、denied/authorized/masked业务样本、敏感字段可见性断言。产物前置保持，纯回放不验证真实授权。                                                                                      |
| p1-demo:6–17                                                           | APIRequestContext POSTlogin取token→注入storage → 真实浏览器login-context/login、共享自然Cookie身份后进入工作台                   | 这是内联认证helper而非外部fixture文件；需严格对齐已授S4夹具适配范围，不能绕过真实CSRF/Origin。17以后所有业务可见性/种子断言不借机改；失败另登记。                                                    |
| runtime-local:25–33、50–59                                             | UI登录新客户端自行切换；50–58读storage拼Bearer探禁读、59假设page.request未认证401 → 新Cookie身份请求与独立匿名request必须区分    | **50–59非仅fixture且改变请求/断言归属**；page.request与page共享Cookie，不能原样当匿名。guard、随机客户持久化/审计/403业务语义不放宽，先停具体裁定。                                                  |
| production-readonly:10–17；role-uat:145–150、158–185、234–235、257–318 | API token登录/storage及API/Bearer→分别设计自然Cookie浏览器登录与无Cookie机器端点/上下文隔离                                      | 只静态登记，不改不跑；C专项授权/生产目标未授。                                                                                                                                                       |

B额外种子阻断：`scripts/seed_p1_demo.mjs:11–18`仍POST普通login取token，后续Bearer（29–39）；S4的verify CLI适配不包括这个seed脚本。不能直接运行种子、降防护或顺手修改；需明确“必要环境脚本”与旧seed适配的最小范围。现仅静态事实，不称业务bug。

## 通道准备实测与已知限制

- Docker客户端/服务端29.8.1，本地基镜像 `mcr.microsoft.com/playwright:v1.62.1-noble` ID `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`；建议目标tag `kingturf-e2e:pw1.62.1-chrome` 开工查询不存在，未覆盖他人tag。原有三个PG容器未动。
- `docker run --rm --add-host=kt-e2e-host:host-gateway ... getent ahostsv4 kt-e2e-host` 实测IPv4 **192.168.65.254**；4173/3000开工无listener。不会将此地址硬编码成未来永久事实。
- Chrome安装容器 `kt-pw-chrome-20261017-d801237` / label `kingturf.task=docker-pw-d801237`，root实测uid0；只读挂载node_modules到/work/node_modules，没挂.env/仓库/PG，不传认证或DB变量；`npx --no-install playwright --version`实际1.62.1，随后install chrome。安装日志 `/tmp/kingturf-docker-pw-chrome-install-2026-10-17.log`；完成rc、镜像commit/id与Chrome版本待实测补记，未预填成功。
- 首次镜像inspect使用缺省不存在的Config.User模板取值而报template错误；后继独立image ID与容器uid实测修正诊断，未改镜像/业务来规避。
- **真实配置预检已拒绝**：纯内存调用实际 `parseBrowserSessionEnvironment`，设test环境trustedOrigin为 `http://192.168.65.254:4173`，抛 `SESSION_TRUSTED_ORIGINS requires HTTPS outside local development`。锚点 `packages/config/src/browser-session.ts:64–80`，不需PG/身份即可复现；默认信任仅localhost5173/127.0.0.14173。因此B在既定网关HTTP通道不能靠添加环境Origin获准，不能改产品代码/降Origin。Secure Cookie自然存取在该非loopbackHTTP也未实测，旧入口smoke不证明会话可用。
- runtime配置明确拒非loopback Web origin，容器内DB guard也要求回环测试库/owned schema；不能将网关DSN传给guard冒称可用。独立通道调整须先有明确范围，当前不猜HTTPS、host-resolver、安全旗标或网络模式。
- preview如启动仅 `pnpm --filter @kingturf/web exec vite preview --port 4173 --strictPort --host 0.0.0.0`，不改配置；容器须add-host、repo含node_modules mount、PLAYWRIGHT_BROWSERS_PATH=/ms-playwright、NO_PROXY/no_proxy=\*。此页未先启动A/B或真实API/PG。
- 本步将完成可独立镜像/静态入口准备后交协调事实检查；上述明确非fixture断言与B通道/seed阻断解决前，spec/config保持零diff。C不跑，不能靠A绿代表B或两轮稳定性。

## 准备完成补记（不代表spec补跑）

安装实际exit0，Playwright1.62.1、Google Chrome155.0.8059.84。目标tag在commit前再次核不存在，固化本地 `kingturf-e2e:pw1.62.1-chrome`，actual ID `sha256:1a0e14c3fd2351aab685106ad17d86b0bd38e6ed89cc0d0d2be809579f8dab3e`；未push。上节安装/commit“待实测”为准备中的历史时点，以本补记为准；安装耗时未单独精确计量，不预填。

宿主按原CLI起preview；容器原tag、add-host、只读repo含node_modules、NO_PROXY/no_proxy=\*、PLAYWRIGHT_BROWSERS_PATH原值，以Playwright直接launch channel chrome/headless（无自加args），仅访问实际网关根路径、确认#app。未匹配生产或API；探针主动abort所有/api请求，所以**不是登录/UI验收或任何spec**。日志 `/tmp/kingturf-docker-pw-origin-preflight-2026-10-17.log`，实际exit0：status200、browser155.0.8059.84、secureContext=false、clientCookieAccepted=false、jarCookieAccepted=false、authenticationExercised=false。仅尝试无敏感数据的合成\_\_Host- Secure Cookie，没注入真实auth/proof，不据此冒称已测服务端Set-Cookie登录全链。

原API配置纯内存网关Origin拒绝已证；另以实际runtime配置导入并设KINGTURF_RUNTIME_WEB_ORIGIN为实测网关，真实拒绝 `Runtime browser acceptance requires a loopback HTTP Web origin`，无配置改动。原根package无type导致Node模块类型诊断warning，未为此改package。

准备容器已核label/退出0后 `docker rm kt-pw-chrome-20261017-d801237`；一次性probe容器--rm自动清理。owned preview核/proc/cmdline后向精确PID962398发SIGTERM，pnpm外层exit1/内部143是本次正常主动清理，不记作spec失败。镜像保留可复用；最终ss确认4173/3000无listener、Docker label查询owned容器零残留，原三个PG容器不动。

协调/frontier确认三份非fixture改动边界为实际冲突，已请求最小范围人裁；此处不代替人类回复，spec/配置继续零diff。B通道与seed原脚本的[最小候选仅docs](../tasks/playwright-docker-b-channel-proposal-2026-10-17.md)另列：owned容器真实回环字节转发、不改Cookie/Origin、数据库双侧guard与actual marker、机器seed仅token-login候选；都未执行，改变原定GW baseURL需独立裁定，不降Secure/Origin/安全旗标。

## 回滚与下一步

R7文档可独立revert到d801237，不涉及源码/数据；本地Chrome镜像只作环境，不push，不在存在依赖容器时删除。安装容器与后续owned preview/浏览器正常失败均精确清理；原有PG与他人环境保持。最终本步证据提交后在稳定干净HEAD完整CI真实执行，日志 `/tmp/kingturf-docker-pw-preparation-final-ci-2026-10-17.log`，再交协调；未执行spec命令/退出码/两轮结果不得标绿。后继只有已授A→B补跑及明确范围内夹具逐文件变异，不进入覆盖率/一般阶段5/收官。
