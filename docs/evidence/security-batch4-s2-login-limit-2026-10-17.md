# 批次4 S2：登录失败滑窗与渐进退避（TD-SEC-002）

状态：S2实施及独立只读核验完成，待协调确认，非批次4人工验收。S1最终00ed10d经协调确认后，设计2ce5dab先登记行为，独立业务提交bdbda0e，必要门禁声明身份分类独立提交b8c1212。b8c1212开始/结束均同一干净HEAD，完整 `pnpm ci:local` 真实exit0/194043.303ms，日志 `/tmp/kingturf-batch4-s2-b8c1212-head-ci-2026-10-17.log`。最终完成文档独立提交后另实际干净HEAD完整CI，结果以 `/tmp/kingturf-batch4-s2-final-head-ci-2026-10-17.log` 为准，不预填。只完成S2，停协调复核，不提前S3/S4或阶段5。

## 授权与行为范围

[R7授权](../tasks/harness-batch4-authorization-2026-10-17.md)允许登录账户/IP独立双维10失败/15分钟、渐进退避、配置/example及必要生产compose环境透传；[具体设计](../tasks/harness-batch4-s2-design-2026-10-17.md)先于实施落盘。原依赖、对象与字段validate仍在限流之前，调用原auth.login receiver与参数；只有实际返回null才计两桶失败，第10次仍401、第11次前置429，Retry-After向上取秒取两维恢复时间最大值。精确窗口仅保留时间差小于900000ms；429不调用auth、不新增时间戳、不续禁。成功保原200/body且不计/不清零/无失败退避；异常原映射且不计。401失败后持账户→IP锁等待min(100×2^(k−1),1000)ms，保证下一次认证也被退避；不是只延迟画面。

只保护登录，不宣称其它API全局限流已完成。429沿现有invalid_request，容量不足或受信链非法单列503/internal_error、Retry-After:1；原S1三头/correlation收尾保持，前端已有429提示接线不改。无旧API/Web测试期望修改：旧4条配置测试字节保持，仅追加19条。无Cookie/CSRF/Origin/sessionStorage/Bearer/签名夹具迁移，S4仍仅报告并硬停人类确认。

## 实现与真实配置链

- 每buildApp一个limiter，server从config装配同一个实例。同步原子预检双桶容量及引用，再依固定账户→IP FIFO锁；锁内清窗/重验，finally逆序解锁及释放引用。11并发失败只调用auth10次，11成功全部可调用；不同双键并行。不会把inflight计为失败或预约429。
- 默认10000桶（账户/IP合计）、64个活动/等待请求、每桶最多阈值项；仅回收无引用且无保留失败桶，不驱逐活跃失败/锁。全图有界O(n)清扫，配置桶数×阈值≤1000000。账号只存SHA256(trim+en-US lower)有界键，密码/原账号不写限流状态或日志。
- 身份根仅socket.remoteAddress与headersDistinct的XFF原始数组；默认trust-none忽略伪造XFF/X-Real-IP。显式精确IP信任时，唯一XFF头、≤16地址/4096字符、全部严格IP，右向左取首个不可信地址；缺失/非法/重复/全可信链503。内部dispatch缺peer进入unknown桶，非法真实peer不是unknown绕过。
- config共享纯IP规范化器统一IPv4-mapped/IPv6大小写与压缩，拒CIDR/hostname/zone/括号/外层空白/非法地址。无新依赖或Node类型扩散。config源入口保持.ts相对导入，仅本包allowImportingTsExtensions/build rewriteRelativeImportExtensions，保证原生Node源包与编译产物均可解析。
- 八个公开LOGIN_RATE_LIMIT配置集中默认及冻结；整数边界见设计。example只追加公开块，compose只追加必要S2透传；原DB/secret/其它项字节保持，不执行compose或部署。默认双代理会保守聚合在peer桶，上线前必须核实实际两层peer/追加链再显式配置，不能猜代理IP/固定跳数。

## 测试、全链与守恒证据

| 检查         | 实际结果与边界                                                                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新API四文件  | 61/61：地址35、状态/并发18、HTTP dispatch7、原生配置入口1；最终定向日志 `/tmp/kingturf-batch4-s2-targeted-final-2026-10-17.log`                                                                                                                                                   |
| 配置         | 原4+新19=23/23；默认/非法整数/布尔/信任IP/冻结/乘积/原首错保持                                                                                                                                                                                                                    |
| 并发/时钟    | 10/11、精确到期/429不续禁、完成时刻计数、success/异常不计不清、9失败交错、共享任一键串行/双键不同并行、交叉键排队spy、容量回收/等待异常释放；注入单调时钟/等待，不真实等15分钟                                                                                                    |
| HTTP         | 429完整body/Retry-After/S1三头/correlation；500/503也断言三头/关联ID，首错/receiver/200原body引用。transport绑定为源码断言与mock字段，不是新真实socket/重复头实验                                                                                                                 |
| IP解析       | 入库确定合法1536次调用与Node isIP/URL对拍、有限非法表；不声称完整无效语法证明。协调另报告seed123456789、LCG1664525/1013904223、5000×7+12=35012确定样本调用（含重复）0差异，未由本执行步回放；首工具oracle未先拒zone而URL抛错exit1，缩回设计scope后0，非实现bug                    |
| 门禁适配     | 39旧+10新=49/49真实CLI；31仓储端口/219模板/157源文件/0违规。只绑定固定源唯一真实类声明身份；错类型/他源/重导出/union/intersection/仅改名B跨仓均拒绝；未知端口、S1–S4与G3不扩免                                                                                                    |
| 全CI b8c1212 | API122文件17175/17175，Web13/266，config23/database68/domain14/types1及原13套PG链，工具/format/doc-lint/lint/type/build/audit全绿；结构0违规/29旧豁免，启动gzip JS11794/CSS1898不变                                                                                               |
| 原生入口     | 完整CI build后只读导入源config、built config与API dist均0；`/tmp/kingturf-batch4-s2-b8c1212-native-import-2026-10-17.log`。未启动server/端口/DB，不是Docker镜像构建                                                                                                               |
| 保护区       | `/tmp/kingturf-batch4-s2-conservation-2026-10-17.log`：旧API/Web tests与原4配置测试字节保持；compose逆去八行与example新增块前缀同00ed10d。apps/web、database/domain/types、SQL/schema/lock/.github/nginx零diff；必要config/transport/auth及精确门禁例外如上，不冒称全仓源码零diff |

这里13套PG指API PG套件，另database PG归database68（合计14份PG测试文件）。完成证据八文档经独立只读复核无必要阻塞，未代跑测试/DB或写文件。

五新runtime split/完整函数/AST：client-address24/21/3、limiter120/42/4、state20/9/2、config65/26/3、IP67/27/3，均≤800/200/5；config index121/67/2。结构阈值/29豁免/G3白名单不扩；完整函数手工AST审计不冒称全仓已强制200。

## 真实失败、变异与复核

1. config初用node:net/URL因build排除测试后缺Node类型失败，改纯共享解析，不增依赖。初.js源导入在Vitest重映射可过、原生Node真实ERR_MODULE_NOT_FOUND；改.ts及局部构建重写，新增原生子进程测试。临时回退.js实际1红，恢复1绿：`/tmp/kingturf-batch4-s2-native-binding-{red,restored}-2026-10-17.log`。
2. exactOptionalPropertyTypes首次类型错误、首API lint9问题及结构G2格式6均真实失败后修正；可选transport字段显式undefined、无空箭头/规则放宽，拆配置代理helper后0/29。不是首跑全绿。
3. 临时阈值检查归零、未信任peer采XFF、窗口<改≤分别真实1/2/1红，日志 `/tmp/kingturf-batch4-s2-{threshold,forwarding,window}-mutant-red-2026-10-17.log`；全部恢复后61绿，无变异入库。
4. bdbda0e首次干净HEAD完整CI真实exit1/14024.039ms，停未分类loginRateLimiter端口，后续测试未跑；`/tmp/kingturf-batch4-s2-bdbda0e-head-ci-2026-10-17.log`。新增正向旧门禁红，最初纯名字skip候选41自测绿/独立初审漏报；协调发现仓储改名逃逸后未提交，改真实声明身份并补10对照。临时纯名skip时“移除原B后改名跨仓”反例真实红，恢复49绿：`/tmp/kingturf-batch4-s2-name-skip-mutant-red-2026-10-17.log`、`/tmp/kingturf-batch4-s2-infrastructure-final-green-2026-10-17.log`。b8c1212独立门禁提交后完整重跑才0。三次patch锚不匹配原子失败无写入，正确锚重试；一次只读rg未命中exit1不作测试失败。
5. 独立reviewer/frontier只读核并发引用/锁顺序/null计数/恢复/IP/config，最终声明身份候选亦重核无阻塞；不代跑测试/DB/写入。先前名称级分类初审遗漏及协调原生入口发现均保留。工具输出脱敏失误见设计，只记事件不重述连接值，未读真实.env或生产秘密。

## 限制、登记与回滚

单进程/重启清零/多实例不共享；O(n)扫有界状态不等于完整DoS防御。默认64包含等待者，原35MB体积上限不变，排队保留请求；同账户/IP可能队首阻塞并超过前端15s，auth不结束会持续占有名额，不增隐藏取消/超时。503容量可能拒绝合法流量，信任配置错误可能保守聚合，均需部署前核实。无新CDP/Playwright，原9spec仍待阶段5前补跑，不将mock字段或原PG HTTP替代新代理网络实验。

R4新增TD-HYG-002：旧preview Dockerfile:16/18仍COPY已删testing/ui，文件相对00ed10d未变、目标不存在；仅登记疑似镜像构建风险，未构建或证明生产失败，台账48含历史。不修SEC006/007、BOUND003/004、七N+1等旁支。

回滚需先核后继依赖：b8c1212门禁与bdbda0e业务应配套逆序撤回，避免删分类而依赖字段仍在造成CI红；2ce5dab设计与本证据docs可独立revert。可先显式LOGIN_RATE_LIMIT_ENABLED=false恢复原auth调用作为限流紧急开关，但配置需合法且不代替部署授权；回滚保留S1三头/00ed10d。未执行自动回滚/push/部署/dispatch/workflow/生产访问，停S2协调复核，S3待续派、S4仅影响报告后硬停人类。
