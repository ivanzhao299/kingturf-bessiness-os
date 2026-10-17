# 批次4 S4：自然HTTP Secure Cookie预检

## 授权、基线与范围

2026-10-17，协调已亲核[设计](../tasks/harness-batch4-s4-design-2026-10-17.md)固定efae93d、实际干净HEAD完整CI0/211588.694ms，并直接续派仅`--cookie-http-preflight`工具小步。本步不进入后端业务编码，不重问六项选型；九旧Playwright延期裁定不变。3144562是他人独立文档提交，不算本工具源码或浏览器授权。

允许范围仅scripts/e2e-cdp必要工具/其测试、根package门禁接线及文档。未改apps/packages/SQL/infra/工作流/锁文件/Playwright，不新依赖、不sudo/降Secure/换localhost别名/新HTTPS/修改安全旗标，不真实API/PG/生产/外发。完整CI中的既有PG仅串行guard回环测试库，未扩矩阵。

## 实现与证明边界

- 新`cookie-http.mjs`：独立六对精确method/path，同源固定`http://127.0.0.1:4173`；拒query/hash/userinfo/其它端口/外域/其它路径与写。只该模式continue真实HTTP，旧network-policy与stub未改，不宽放/api。
- `preflight.mjs`：模式与probes/csp互斥；沿原已装Windows Chrome/随机CDP回环端口/全新owned profile。新listener由当前Node进程拥有并用ss核PID，非Vite代理/真实API；正常/错误/信号都走finally关闭连接/listener并核Chrome/profile清理，失败不报pass。
- 隔离测试页真DOM表单/按钮，经原driver物理点击，事件isTrusted；页面handler发same-origin fetch，绝不用Runtime.fetch/Fetch.fulfill/JS setCookie播种。先核CookieJar及document.cookie均空。
- 仅临时合成随机值；真实HTTP响应两独立`Set-Cookie`，实际CDP raw headersText内部核对两条/无Domain/精确属性；CookieJar内部核默认两个\_\_Host名称、Secure/Lax/Path=/与有效期、认证HttpOnly且CSRF可读。随后真实GET与POST由服务器内部比对Cookie/Origin/CSRF，输出只有布尔/计数/固定类别，不输出Cookie值/原始头/Network cookies数组/fixture正文/身份或连接串。
- 此夹具不实现生产签名算法、DB会话或撤销。只证明本机自然传输条件成立，不等于S4认证、完整CSRF、并发清理、Web迁移或Playwright已通过；SEC003保持开放。

## 实跑与失败史

首个自然Chrome run `GuBdbf`、还原后`jdNP1W`、定向脱敏后最终`whZpfc`均真实exit0（首次观测Chrome 154.0.8037.99、CDP1.3）：login/read/write各1、rejected0，Origin/Cookie回传/CSRF头/raw两Cookie/属性/HttpOnly不可见/trusted DOM均true；HTTP listenerGone、Chrome rootGone/profileProcessCount0、profileGone均通过。未用本地兼容兜底，故没有触发C7失败分支；这不承诺其它浏览器/部署环境。

日志：

- `/tmp/kingturf-s4-cookie-http-browser-first-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-browser-final-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-lifecycle-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-tools-regression-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-legacy29-full-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-csp3-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-legacy-lifecycle-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-tools-final-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-browser-redacted-final-2026-10-17.log`
- `/tmp/kingturf-s4-cookie-http-lifecycle-redacted-final-2026-10-17.log`

新手工`cookie-http-lifecycle.mjs`串行4/4：listener后注入故障、未知POST、SIGTERM、SIGINT，全为实际exit1/无pass/owned清理true；未知POST在Fetch硬闸拒绝，blockedRequests1。不是Vitest/Playwright计数。纯Node工具75/75=原65＋新10，包含互斥、精确放行/拒绝、真实HTTP双头/回传、折叠/Domain负例、错Cookie/Origin/proof无写、实例隔离、活动连接清理/重复close及失败bind不清他人listener；这些不冒充自然浏览器结果。

生命周期边界：该手工负例脚本45秒只发送SIGTERM，之后await exit没有最终等待上限；不能宣称任意异常必有界退出。本次四例确实退出并清理，HTTP listener自身close有3秒失败拒绝，但不能据此扩大成整个手工脚本的无条件保证。未为此顺手重构旧工具。

最后只读复核发现初轮Cookie日志继承旧launcher的profile路径/flags及连接诊断元数据；未输出Cookie值或raw头，但不应笼统声称整个旧日志只有布尔/计数。最终仅Cookie模式增加字段白名单：隐藏profile/flags/地址/原异常文本与版本字段，保匿名run标记、固定类别、owned PID/端口计数及布尔；旧模式报告不变。新单测用合成敏感标记验证被过滤。保留初轮历史日志，不覆盖隐去失败史；定向脱敏后工具75/75、自然正向whZpfc exit0、负例4/4均再次串行通过及清理，不把重复执行加为新增覆盖。

首次lint有两项先后真实失败：finally内throw触发no-unsafe-finally；默认空callback触发no-empty-function。均已修，后续lint绿；不是Cookie传输失败。旧preview/probes块首次去缩进及TS printer机械比较false，未据此宣称字节/AST全等；独立只读逐块复核确认旧执行序列/参数保持，else内变量缩域不越过原使用范围，对象字面量格式化无语义改变。此静态结论不代替真实回归。首次仅`--probes`实际基础7项EnPFj5绿，文件名含legacy29不代表29；随后按原七view开关命令另跑完整29，不能将7计为29或相加成唯一覆盖。保留这些诊断史，不说从未失败。

## 旧→新映射、变异与回归

| 文件/绑定                                    | 旧→新及依据                                                                                         | 实测                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preflight入口                                | 原csp/probes判别前新增独立cookie模式调用；原工具路径保在else，原网络硬闸不变。依据设计§6/本小步续派 | 真实把入口模式调用改为false，`actual entry enforces exclusivity`红exit1；立即还原后10/10绿。测试冲突参数附fault-after-profile，绕过互斥也不会启动Chrome |
| 新cookie-http白名单                          | 新独立精确method/path，不修改原classifyRequest                                                      | 把method比较===变!==，相关放行/拒绝两用例红exit1；还原10/10绿                                                                                           |
| 根package门禁                                | 原工具名单只追加cookie-http.test.mjs，无删旧文件/阈值/断言                                          | 实际75工具绿；最终CI须证明链内执行                                                                                                                      |
| 原default/probes/CSP/driver/network/fixtures | 不适配旧断言/夹具；新分支隔离，原preview/probes区仅结构包裹/格式变化                                | 旧完整29 ygavyh真实0，80/47/69/142/56与原计数一致；CSP3 IJt72p真实0；两者网络三零及owned清理通过。原生命周期5/5，均exit1/清理通过                       |

变异日志：`/tmp/kingturf-s4-cookie-http-entry-mutation-red-2026-10-17.log`、`entry-restored-green`同前缀后缀；`policy-mutation-red`、`policy-restored-green`同前缀后缀。只扰动实际目标，不改测试造红、无变异遗留。新增测试为新增工具行为，不放宽旧oracle。

原29命令：`node scripts/e2e-cdp/preflight.mjs --probes --sales-views --pricing-views --credit-contract-views --fulfillment-views --finance-risk-views --operations-views --dashboard-view`。CSP为原`--csp-observe`，原生命周期为`node scripts/e2e-cdp/lifecycle.mjs`；三者串行，不与CI/PG/其他浏览器并发。旧29与CSP3是既有合成探头回归，不是新Cookie业务覆盖；新4与旧5负例亦不混作新增9项。

## 交接与回滚

本步最终稳定干净HEAD完整`pnpm ci:local`日志预定`/tmp/kingturf-s4-cookie-http-final-head-ci-2026-10-17.log`，实际结果执行后交付，不预填。API/Web须全量保持绿；后端代码、会话配置及Web业务未进入本提交。

回滚基线efae93d：核后继后独立revert本工具提交及同责导航/证据即可，保S1–S3、S4设计和3144562；不改/清真实会话、无SQL迁移/部署/secret回退。工具完成及最终CI后停协调，亲核绿色后再直接续派已授权后端，不自行跨停点或进入阶段5。
