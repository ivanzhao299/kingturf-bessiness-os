# 批次4 S2登录限流：实施设计与行为表

完成状态：设计2ce5dab→业务bdbda0e→必要门禁b8c1212，后者实际干净HEAD完整CI0/194043.303ms；最终完成docs另实际HEAD全CI后停S2协调复核，不提前S3/S4。真实失败/门禁初审遗漏、回滚及未执行范围见[完成证据](../evidence/security-batch4-s2-login-limit-2026-10-17.md)。下文先行设计时态保留。

输入00ed10d，S1经协调独立确认（最终CI0/178476.659ms，API17114/Web266、干净树；协调另实际只读逆核65文件76期望0）。沿已授权D1/TD-SEC002续派，只实施S2，完成后停协调复核，不提前S3/S4。本文先落盘再实施，R2独立行为提交、旧期望若需变更逐处映射，不混重构/SQL/依赖/会话迁移。

## 具体算法（默认政策）

| 情况                                            | 行为与计数                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 非登录、依赖不可用、对象/login/password校验失败 | 原路径/首错保持；限流在原validate之后、auth.login之前，不计失败                                                                                                                |
| 账户键                                          | 精确沿auth的trim().toLocaleLowerCase('en-US')，随后SHA256摘要作为有界内存键，不保留/输出账号或密码；不把provisioning字符校验加到登录                                           |
| IP键                                            | 仅可信transport peer/下述显式代理链，无body/query/header自报peer；账户/IP两个命名空间独立，不用二者拼接成联合键                                                                |
| auth.login返回非null                            | 原200/原body；不计失败、不清零历史失败、无失败退避                                                                                                                             |
| auth.login实际返回null                          | 账户与IP各追加一次完成时刻；原401保持。第k次当前窗口失败等待min(100×2^(k−1),1000)ms后返回，k取两个桶当前失败数的较大值；等待期间持锁，限制下一次认证开始，不仅是延迟客户端画面 |
| auth.login抛出异常                              | 原DomainError/500映射保持，异常不作普通失败；finally释放锁/引用/容量                                                                                                           |
| 已有≥10次失败                                   | 下次认证前429，Retry-After为两维阻塞桶最早可释放一项所需等待的最大值，向上取秒至少1。第10次实际失败仍401，第11次才429；429不调用auth、不新增失败、不更新时刻/续禁              |
| 精确滑窗边界                                    | 仅保留now−timestamp<900000ms；恰15分钟剔除。无额外永久封禁/跨窗口backoff期限；时钟用进程单调performance.now，不受墙钟回拨                                                      |
| 容量不足/受信链非法                             | 独立503/internal_error、Retry-After:1，不冒称少于10失败就触发429，不调用auth/不计失败；原校验/依赖首错在前                                                                     |

429使用现有ErrorCode `invalid_request` 与原correlation envelope，503使用internal_error，不为此扩写packages/types。S1统一三头仍收尾。前端http把status带入RequestError→LoginCoordinator.run→loginFailureMessage(429)→entry显示状态，原429中文文案已真实接线，不改前端文案/业务。

## 并发、资源与恢复

- 每个buildApp实例唯一limiter，server从配置装配同一个实例；默认开启，可显式配置关闭用于回滚。固定账户锁→IP锁，持IP后不再拿账户，finally逆序释放。锁内重新清窗/检查后再auth；同账户或同IP串行，两键均不同可并行。inflight不是失败，也不是429预约；11全成功不得因预约误429，11失败只有前10进入auth，第11在重新检查后429。
- 默认最多10000个桶（账户/IP合计），64个已接纳请求（含活动和等锁），故等待者亦有全局硬上界；请求先原子预检两个桶容量再同时引用，不半分配。仅清过期且无活动/排队引用的桶，成功空闲无失败桶立即回收；不驱逐活跃失败桶或锁形成绕过。达到容量返回独立503，旧状态不被清空，窗口过期/队列释放后恢复。
- 每桶失败数组最多阈值项；桶内身份长度有界（账号摘要/IP），配置另限制桶数×阈值≤1000000。这是limiter自身状态/等待者界限，不是全HTTP堆或所有连接内存保证；原transport 35MB体积上限不变，不凭本批收紧登录字段/额外JSON字段。排队保留原请求，可能队首阻塞/超过前端15s预算；不加隐藏取消/新auth超时，未完成auth持续占用其有界名额，不释放活跃锁冒险并发。DB/传输总体防DoS不冒称已解决。
- 仅单进程内存：重启清零，多实例不共享，非Redis/分布式。默认代理汇聚及小容量可产生保守共享拒绝，部署前须验证；本批不部署或改防火墙。

## 客户端IP与真实配置链

- server仅传socket.remoteAddress及headersDistinct的X-Forwarded-For原始值数组到内部ApiRequest字段；默认trust-none，未信任peer完全忽略XFF/X-Real-IP（即使伪造/非法）。直接内部buildApp未提供peer的兼容调用进入单独unknown桶，不作为公网绕过；transport提供的非法peer拒绝。
- `LOGIN_RATE_LIMIT_TRUSTED_PROXIES`默认空，逗号分隔**精确IP**（不接受CIDR/hostname/all-private），统一IPv4-mapped IPv6/IPv6大小写压缩。仅peer命中时解析唯一一条XFF，最多16地址/4096字符，拒空元素/非法IP/重复头/缺链/全可信无最终不可信身份；从右向左跳过显式可信地址，第一不可信地址为身份，左侧可伪造前缀不作为身份。缺一个代理信任只会保守聚合在代理桶，不能猜真实生产IP或固定跳数。
- parseEnvironment新增冻结loginRateLimit对象：enabled=true，failureLimit=10（可显式配置，合法整数），windowSeconds=900，baseDelayMs=100，maxDelayMs=1000（≥base），maxBuckets=10000，maxPending=64，trustedProxies=[]；整数有限上下界/乘积约束、布尔只true/false、代理严格IP校验，默认值集中导出避免复制。
- 最终具体校验边界：FAILURES 1..1000，WINDOW_SECONDS 1..86400，BASE_DELAY_MS/MAX_DELAY_MS各1..5000且max≥base，MAX_BUCKETS 2..100000，MAX_PENDING 1..1024，桶数×失败阈值≤1000000。显式运维配置可改变默认阈值，不伪称任何配置下都是10/15分钟。新增纯共享IP parser不依赖Node类型；config本包源.ts导入配合局部allowImportingTsExtensions/构建rewriteRelativeImportExtensions，原生源包及built导入均独立验证，不改package exports/共享tsconfig。
- 配置键前缀`LOGIN_RATE_LIMIT_`：ENABLED、FAILURES、WINDOW_SECONDS、BASE_DELAY_MS、MAX_DELAY_MS、MAX_BUCKETS、MAX_PENDING、TRUSTED_PROXIES。更新.env.example只追加这些公开默认；生产compose是显式environment清单，须仅追加S2变量透传/默认，保原DB/secret项字节不动，不执行compose/部署。默认trust-none在双代理后会把用户聚到peer桶，部署前必须核实两层实际peer与追加链再显式配代理，不宣称example写好即可生产可用。

## 验证与停点

新增测试覆盖10/11与精确窗口、反复429不续禁、成功/异常不计且成功不清零、账户/IP各自独立、大小写空白、伪造/受信/非法XFF与mapped地址、11并发失败/11并发成功、9失败后成功与失败交错、finally释放/不同双键并行、桶/队列有界及恢复、429 Retry-After/S1三头/correlation、原validate/依赖/500首错、配置默认/非法值/冻结/compose键接线。时钟与退避注入测试调度，不真实等待15分钟，不复用生产数据。

相关测试及全API/web、源码实际干净HEAD完整CI0；最终证据独立提交后实际HEAD再完整CI0/干净。新代码逐文件≤800/完整函数≤200/AST≤5，G1/G2/G3不豁免/白名单不扩。旧契约若因S2获批行为变化需改，先列旧→新→D1；不降低严格断言/偷偷调大测试阈值。会话/Bearer/签名fixtures不迁移，S4仅报告硬停。S2确认后才续派S3。

## 工具输出脱敏失败史

协调此前read_thread(includeOutputs:false)仍带commandExecution命令而误回显本地测试连接信息，已向用户说明；本执行步读取.env.example也误回显示例连接信息，未读取真实.env或生产值。此处只记事件不复述命令/值；后续工具内过滤，只输出必要键/摘要，不擅自轮换凭据或触生产。read_thread若需使用先在工具内JSON筛选agentMessage/final摘要，禁止输出command字段。配置/compose检查不展开环境变量。
