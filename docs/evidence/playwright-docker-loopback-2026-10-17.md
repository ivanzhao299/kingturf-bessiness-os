# Docker 回环通道实际验证（2026-10-17）

## 授权/范围/基线

增量R7 `4e691e5`，父 `c2ff52b`，原始[三项人类裁定](../tasks/playwright-docker-rulings-2026-10-17.md)。本步仅scripts/e2e-docker本地环境工具、最小JS门禁接线与本证据；未改spec/两PW配置/seed/业务源码，不跑C或任何spec，不预填两轮。镜像身份重核 `kingturf-e2e:pw1.62.1-chrome` / `sha256:1a0e14c3fd2351aab685106ad17d86b0bd38e6ed89cc0d0d2be809579f8dab3e`，Chrome155.0.8059.84。网关重新getent为192.168.65.254，现有5432 TCP实际连通；没有修改监听/防火墙/新增PG容器。

## 工具职责和敏感边界

- `forward.mjs`只绑定容器127.0.0.1固定4173/5432，lookup kt-e2e-host与宿主实测numeric gateway相等后才开listener；原始双向字节pipe，不改Host/Origin/Cookie/Set-Cookie/PG/TLS。错误硬失败、两个socket成对关闭、跟踪owned sockets/server；不接任意URL/端口。连接5s截止，连接后无闲置30s伪失败。
- `fixture.mjs`只从调用者显式DATABASE*URL（不读.env）走原assertTestDatabaseTarget；宿主先创建随机runtime_web* schema/随机marker，记录actual database/current schema/postmaster start/system_identifier（字符串）。容器核验前无migration/用户/API写。核验后才迁移/建三合成身份和原权限关联，API只127.0.0.1:3000，TOKEN_LOGIN_ENABLED显式true；不是P1业务种子已执行。
- `container.mjs`真实回环连接转发后的PG，原guard＋固定PoolClient READ ONLY事务仅SELECT比较同db/schema/start/instance/宿主marker；任一不符拒绝，绝不在容器重建marker。自然Chrome登录/proof仅内存，stdout仅固定事件/布尔/计数，未开trace/截图或输出身份材料。
- `preflight.mjs`重核镜像/空闲端口，owned容器由stdin接敏感control，不把DB/会话秘密放docker argv/-e/镜像层；收到pg-verified才初始化真实API与preview。preview仅原CLI4173/strictPort/host0.0.0.0，container真实baseURL127.0.0.1:4173。AbortController在关键await后拦后继create，finally先停container/等待in-flight初始化drain，再停preview/API和DROP精确owned schema；未确认child停止不删schema。协作截止120s不是任意OS/PG挂起的强制结束保证。
- 原runtime配置/guard/trace截图off不变；本步自然预检用主配置同款Chrome，不称runtime/bundled Chromium已补跑。

## 正向实际证明

命令：宿主 `NODE_ENV=test DATABASE_URL=<private guarded loopback test target> node --experimental-transform-types scripts/e2e-docker/preflight.mjs`。尖括号仅脱敏占位，真实目标通过内存env提供，未读取.env/打印DSN。容器命令由工具固定create/start及stdin控制，repo含node_modules挂载、/ms-playwright、NO_PROXY/no_proxy=\*；源码记录完整可复跑命令，日志不含control。

最终正向日志 `/tmp/kingturf-docker-loopback-preflight-5-2026-10-17.log`：实际 **exit0 / 6089ms**，host guard/marker→container只读五项同一→自然浏览器→owned清理。Chrome155真实页面secureContext=true、自然auth HttpOnly/Secure/Lax/path=/与csrf Secure/Lax；login实际Origin精确127.0.0.1:4173（allHeaders采集），无Cookie注入或伪造Origin。捕获**同一次restore的generation+csrf快照**，缺/null/foreign Origin三个请求除Origin外带合法Cookie/generation/proof，均403；合法自然同源POST201。宿主PG查询拒绝Origin的customer写入0、合法签名写入1。只这些有限请求，不称完整E2E/全CSRF或生产安全已通过。

## 故障、真实负向及清理

| 场景/日志（/tmp/kingturf-docker-）                                                       | 实际结果                                                                                                                 | 未混称                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `loopback-database/schema/started/instance/marker-2026-10-17.log` 五次各只扰一项宿主期望 | 容器每次exit1，host测试断言拒绝并exit0；无API/用户种子开始，精确schema/container清理                                     | 不把host0写成容器接受；不在容器生成对照marker |
| `loopback-setup-sigterm/ setup-sigint-2026-10-17.log` 在实际迁移await期间注入两信号      | host每次exit1（3840/3798ms），原in-flight排空/Abort检查，未后继起preview；owned schema/container清理                     | 非只kill Docker后漏在途初始化，非普通spec失败 |
| `forward-negatives-2026-10-17.log` 4个容器内Node测试                                     | 4/4，exit0；错误gateway拒绝、4173/5432分别被外来占用时失败且外来listener不被关闭、宿主preview拒连传播失败并释放owned端口 | 无DB身份、无业务写，不充作浏览器用例          |

上述为1条自然正向流程（内含3 Origin负例）＋11条工具负向（5同一性/2信号/4relay），不是12条独立业务E2E。事后ss确认4173/3000无listener，docker task label无owned容器；原三个PG容器未动，镜像保留。每次fixture close查询owned namespace余数0；不查询/清除他人schema。

## 失败史，不被最终绿抹去

1. 初次plain eslint不含新目录导致type-information规则报错；局部config尝试又出现多tsconfigRootDir、随后empty-function规则错误。未跳hook/未放宽规则；删仅本轮未提交的重复局部config，最终只根eslint原plain-JS列表加新目录、根lint命令加精确glob。实际no-unused-vars注入在新目录root eslint **exit1**，移除临时探针后新目录原规则全绿。
2. `loopback-preflight/ preflight-2-2026-10-17.log`：PG同一性先绿，合成员工组织归属违反原employees_organization_owner_fk（23503）；仅本轮fixture补TEAM/tenant归属，业务/约束不改，各次清理成功。
3. `loopback-preflight-3/ preflight-4-2026-10-17.log`：自然探针失败，最终定位合法写漏同次generation；同时修采集为allHeaders、保持CSRF原header名称。补齐合法材料而不放宽服务端；失败的负例不单独作为Origin精度证据，最终第5次负例才按全合法材料只扰Origin记录。
4. 不把该通道成功冒称九旧spec或runtime已执行，不改此前网关HTTP不可Secure/配置拒绝证据。

## 门禁/回滚/后继

**独立复核后的最终工具补记**：同一性/原始byte forwarding保持；补preview spawn error与private stdin EPIPE受控失败，容器browser launch中断会abort/checkpoint并排空原任务再关资源。宿主API listener PID与preview实际listener进程组双核后才发送合成登录材料，避免只凭HTTP ready混认外来服务；清理best-effort关所有DB句柄，child未证退出不DROP。容器事件stdout仅固定event/布尔/有限计数/版本白名单，未知事件失败不回显原文。Origin负例在同次restore后重新取Jar并核csrfCookie等于proof，再只扰Origin。

最终源码定向正向 `/tmp/kingturf-docker-loopback-final-positive-2026-10-17.log` **exit0/5817ms**，自然Cookie/Origin3负例/201与PG0/1再次通过。新增三实际负向 `/tmp/kingturf-docker-loopback-final-fail-stdin-2026-10-17.log`（exit1/1027ms）、`final-fail-preview-spawn`（1/4575ms）、`final-browser-launch-sigterm`（1/5244ms），均真实owned-cleanup/schemaGone/containerGone/previewGone。现合计14工具负向（原11＋3），仍非业务spec数量。

首轮stdin fault遇Docker create/start竞态，`lifecycle-fail-stdin`日志如实报cleanup-failed并保留一份自有marker-only schema/退出容器；主代理核精确container label/退出态与schema后缀，再核只有channel_marker表后清理，未碰其它资源/业务数据。随后工具加仅自有容器原子force-removal处理start竞态，最终同fault自动清理通过；不把首轮“host exit1符合预期”冒称当时资源全清。最终ss4173/3000及task label再次无残留。

新工具root eslint及Prettier通过，4容器Node负向、5PG同一性拒绝、2setup信号与自然流程实跑如上；结构/文档门禁随提交前实测。环境脚本独立回滚到4e691e5，根lint接线与环境工具配套撤；schema无持久业务数据保留、原SQL/迁移未改。最后会话提交仍需稳定干净HEAD完整ci:local；本步不是该未来检查已完成。后续按已授seed机器URL独立变异，再fixture/三份oracle、A8→B2/全部绿后第二轮。发现非S4问题C7具体停报，不借通道修业务。
