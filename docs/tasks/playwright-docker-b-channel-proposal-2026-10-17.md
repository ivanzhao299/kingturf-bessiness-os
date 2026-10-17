# Docker Playwright B 类最小通道候选（2026-10-17，仅提案）

## 已证阻断与裁定边界

基线d801237/S4新会话。网关IPv4 HTTP原定通道的preview静态页面已实测200，但Chrome155下isSecureContext=false、合成Secure Cookie不入Jar；实际API配置拒绝将该HTTP网关加入trustedOrigins，runtime配置也拒绝非loopback Web origin。详见[库存与实测](../evidence/playwright-docker-inventory-2026-10-17.md)。不改Secure/Origin、产品源码、PW配置、浏览器安全旗标，不以注入Cookie/伪造Origin代替自然认证。

下列均未执行、不是授权已扩大。原任务明确容器KINGTURF_BASE_URL=http://网关:4173；改为容器回环URL是有意义的通道变更，必须另有范围裁定。本提案不启动转发/API/PG/种子，不开始B。

## 候选：容器内精确回环字节转发

保留主机现有命令 `vite preview --port 4173 --strictPort --host 0.0.0.0` 与实际add-host/getent网关接入。只在本轮owned容器内起绑定127.0.0.1:4173的字节级TCP转发，目标严格为已测宿主网关:4173；浏览器真实导航和主配置baseURL改用 `http://127.0.0.1:4173`。不是URL字符串伪装或Chrome不安全例外：浏览器实际连本机listener，由该listener转发传输字节。

不改写Host/Origin/Cookie/Set-Cookie或响应body，不终止TLS、不插入认证、不改同源相对API路径。浏览器的真实Origin为127.0.0.1:4173，与既有dev/test明确trustedOrigin一致；主机Vite原proxy再接原loopback API。应用Cookie仍自然Secure/HttpOnly/Lax/host-only、原签名双提交检查。须以实测确认Chrome版本、自然Cookie写入/回传、真实Origin及非法Origin拒绝，不能仅由网络拓扑推断。

新转发器若获准，仅依赖已有Node net、放scripts/e2e-docker并版本化；固定本地地址/端口/目标、拒绝非预期目标、绑定失败硬失败、连接错误不吞、信号时关闭owned sockets/server。记录真实命令/退出/耗时、listener与容器身份；不占他人4173、不清理他人进程，退出先停测试/转发再容器/主机preview。必要环境脚本不能变成拦API或改响应的隐形fixture。

### runtime的Web与数据库分别处理

- Web：仅若前项通道获准，保持runtime配置原样，以其既有KINGTURF_RUNTIME_WEB_ORIGIN显式设真实容器127.0.0.1:4173。配置仍browserName=chromium、trace/screenshot=off；不能借主配置Chrome跑runtime来规避其身份保护。
- PG：runtime spec会在容器内直接查数据库，主机loopback与容器loopback不是同一对象。不得只把网关DSN改写成127.0.0.1让guard通过。候选必须在owned容器真实建立独立回环TCP listener→实测宿主测试PG网关端口，且**先在宿主对实际目标执行原assertTestDatabaseTarget**（NODE*ENV=test/loopback/数据库名含test）、核actual database、PG服务身份及owned随机runtime_web* schema。容器侧再用实际转发连接验证current_database/current_schema与本轮随机marker/权限隔离，双侧均有证据才准使用，不只记录连接串字面通过。不得打印完整DSN/密码，不把PG/身份写进镜像层。
- 本任务尚无通道变更/额外PG连接准备裁定；不新增PG容器/网络/权限、不绕guard、不使用旧runtime schema。无法明确小范围验证时，runtime B保持待决，不能以P1或A绿充数。

## P1 种子最小认证候选（原脚本不改）

`scripts/seed_p1_demo.mjs:11–18`仍POST `/api/v1/auth/login`取raw token，后续29–39用Bearer；S4浏览器端点不再返回token。原任务列出demo:seed为种子方案，不等于允许把未列写文件的旧seed脚本静默改造。

可裁定最小改动只把该机器认证URL换到 `/api/v1/auth/token-login`，同样JSON body、无Cookie/Authorization/Origin/site的独立Node请求；显式核TOKEN_LOGIN_ENABLED=true（现默认true），仍与S2共享限流。原admin/approver两身份、Bearer头、固定编号、幂等key、业务请求与全部种子断言保持，不增加新身份或放宽服务端。由guard本地隔离PG/API的环境准备提供合成身份，不读取真实.env/生产凭据；真实种子前再核目标，仅本轮owned schema允许写。该认证适配需独立提交/真实变异红→还原绿，旧seed与原本新verify CLI不能混称同一适配。

本步仅提案；seed脚本未改、未运行。若拒绝改原脚本，则需另明确允许的必要环境脚本提供相同可验证种子，不能复制整段业务编排逃避范围/重复守则。

## 与会话断言裁定分开

三份非fixture范围是startup-delivery的旧storage oracle、session-revocation的旧storage oracle、runtime-local的storage Bearer权限探针及page.request匿名401假设；协调已另请求最小范围人裁。runtime等价匿名应使用独立无会话request context，不能简单把401改200。P1内嵌认证helper属于已有fixture例外，但真实通道仍须解决。本提案不替代这些裁定，不触C两份，不扩覆盖率/一般阶段5。

## 待核验/未执行

回环转发、自然S4登录/CSRF/受信Origin负例、PG双侧真实身份/marker、seed变异、A/B逐spec首轮与第二轮均未执行；C永久保持本轮未授权不跑。现有入口200、配置拒绝与合成Cookie能力探针不是上述测试成功证据。
