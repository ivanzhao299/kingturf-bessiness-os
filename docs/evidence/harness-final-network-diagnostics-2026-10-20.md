# 终验 TD-TEST-018：资源与复现条件诊断

范围：[终验R7](../tasks/harness-final-acceptance-authorization-2026-10-20.md)仅准只读网络/资源诊断；不修产品、不放宽relay失败条件、连接超时或浏览器安全，不以重跑成功关闭旧故障。

## 固定资源基线

2026-10-20T04:32:11.603Z只读宿主与Docker资源观测，安全日志`/tmp/kingturf-final-p-td018-resource-baseline-2026-10-20.log`：可用并行度/逻辑CPU/Docker CPU均20；宿主与Docker总内存33569787904字节，宿主空闲12322689024字节；load 1/5/15分钟为2.32/2.24/2.63；宿主`/dev/shm`总量/可用均16784891904字节。只读观测不包括进程参数、环境、认证、原始流量或页面内容。

runtime执行后2026-10-20T04:37:58.021Z再次只读观测：CPU与总内存不变，宿主空闲11773636608字节，load 1.68/2.37/2.63；宿主shm仍全部可用。该条来自主执行器当时的固定JSON标准输出（event `td018-readonly-resource-after-runtime`），不是上述前置基线文件内的记录。它不是容器内shm峰值或内存压力连续采样，不能据此排除瞬时资源问题，也不能将负载变化作为旧故障成因。

## 网络合同与已证复现条件

`scripts/e2e-docker/forward.mjs`只转发容器回环4173/5432到预先核验的数值Docker网关；DNS解析必须与该网关相同。上游连接建立前超时5000ms，连接建立后`setTimeout(0)`；活动连接error/timeout仍拒绝原failure promise，closing事件不混作活动故障。原文件未改，不添加重试或忽略事件。

| 观测范围                                 | 真实结果                                                      | 能/不能推出的结论                                               |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| 旧P1安全定位、金额/四KPI部分回放         | active 4173/upstream CONNECT_TIMEOUT，部分例未完成，owned清理 | 旧连接故障确实存在；不是RESET，也不是全部业务断言失败的同一原因 |
| 本轮完整原P1 `final-p1-whole-positive-1` | 11完整发现，10过1败，MRP原卡数断言失败；无relay事件           | 该次MRP失败不能归因于CONNECT_TIMEOUT；不证明旧环境故障已修复    |
| 最新七A `final-a-current-<kind>-1`       | 23原例全过、无relay事件、owned全清                            | 七文件该次通过；不等于完整A8或两完整轮                          |
| 本轮runtime `final-runtime-current-1`    | 原1例通过、无relay事件、owned全清                             | 该次真实登录/持久化旅程可达；不证明P1长旅程的旧超时已消失       |

旧失败/命令和固定条件见[原P1阻断](../tasks/playwright-p1-replay-blocker-2026-10-17.md)、[四KPI部分回放](../tasks/harness-stage5-p1-money-authorization-2026-10-17.md)，最新原例结果见[P证据](harness-final-browser-evidence-2026-10-20.md)。目前没有可确定复现的充分条件或根因；不制造共享宿主压力、不改监听/防火墙/PG实例、不导出请求内容。后续按获授权的最新完整轮继续观察相同固定事件，若再现只据实登记并停止依赖项，独立工作继续。

## 当前结论

### 本机专项只读结果与精确下一步提案（596a927授权后）

后继直接人裁`call_f8e442fef3e840fe94903ab61b5f333a`已独立839d5ce [R7](../tasks/harness-final-network-sampling-authorization-2026-10-20.md)：**只实施采集工具与纯测试，不授权再次P1**。下文“另询”是提案时点，现仅工具部分已获批，真实接线/激活与复现仍未执行。

只读代理采集截至2026-10-20 06:01:30 UTC，主代理据固定标量报告收口：WSL 2.7.11.0、kernel 6.18.33.2、networking mode=mirrored；Windows build 10.0.26100.1；Docker Desktop 4.93.0.240920，Engine/CLI 29.8.1，daemon同WSL2 kernel，默认bridge driver/1个IPAM entry。正式容器未指定自定义网络，以host-gateway别名解析后仍执行预核数值网关同址校验；这描述拓扑，不代表故障归属。

查询范围为`wslinfo --networking-mode`、`uname -r`、`wsl.exe --version`数字提取、Docker Desktop ProductVersion、`docker version/info/network inspect bridge`指定标量、WSL `ss`固定端口状态/队列、`nstat`固定TCP计数及Windows `Get-NetTCPConnection`固定端口listener/全局SynSent计数；没有读取env/进程参数/认证/流量内容，也未执行服务/探针/测试/浏览器/PG或网络配置变更。只保留核验后的版本、布尔、计数/拓扑，不导地址或系统原文。Windows初次全局SynSent查询超过10秒yield未取值，随后同只读查询3.6秒成功0，无权限阻断；不是故障窗口采集。

空闲快照：WSL/Windows的4173 listener均0；5432 WSL listener1、队列RecvQ/SendQ=0/4096，Windows listener0；WSL 4173 SYN_SENT/ESTABLISHED均0，Windows全局SynSent0。WSL累计ListenOverflows/ListenDrops/TCPReqQFullDrop均0、TCPTimeouts1177、TCPSynRetrans58。累计计数不是单次故障差值，先前1171到1177的变化不能归属某条连接；此时没有owned preview，监听0符合空闲状态。没有历史超时同期Docker VM/WSL/Windows三层证据，不能据mirrored、版本或50/50空载归因，更不能推荐立即修改某配置。

**结论：未确定故障组件，暂不提出无证据的网络配置修复。**精确下一步候选仅为同期被动取证，尚未新增工具或改runner：

1. 在原CONNECT_TIMEOUT事件仍立即destroy/fail、原5秒与pass/fail不变；旁路只读采集不参与判定，不等待采集再报失败，不新增P1重试。
2. 同一有界时间窗只取容器relay固定端口connecting状态计数、WSL固定4173监听队列及SYN-RECV/SYN-SENT数、前后固定TCP计数差、Windows固定4173按状态计数/全局SynSent；只导白名单整数/布尔、采样延迟及unavailable，绝不地址/进程/错误原文。
3. 采集进程须精确自有、有限时取消与清理，不改系统监听/转发/防火墙。先以纯mock/canary核输出不泄IP/认证/原文、采集失败不改原超时/拒绝/owned清理；再决定是否需一次明确获批的原失败复现，不自动重复P1求绿。

该新增采集工具/runner变更及真实复现将另询人类，不把当前只读专项扩大成工程实施；若仍缺Docker VM队列权限也另裁。方案目标是区分容器出口、WSL接收队列、Windows转发层的同期证据，不预设其中一层有错。TD018保持开放，P1还原全11/两完整轮仍阻断，独立A8/runtime已完成、最终干净HEAD全CI继续。

### 仅工具实施与纯验证（未接线/未激活）

新`passive-sampling.mjs`独立API：baseline只启动固定计数读取，trigger为void/one-shot异步任务，close取消并排空自有任务；**未在forward/preflight导入或调用**，两原文件零diff，不能称已在真实故障点采样或真正不影响失败时序已有实证。容器层仅接受未来现场的固定`connecting/active`计数投影，不启动docker exec与原清理竞争。WSL固定4173 ss队列/状态、nstat固定五计数、Windows固定4173状态/全局SynSent；原文仅限16KiB进程内RAM，固定parser丢弃地址/未知值，无raw logger或错误输出，子命令环境仅PATH/LC_ALL、无shell/认证环境。

nstat用`-asz`，已只读核本机man：`-s/--noupdate`不写历史，未实际执行采样命令。每个私有子进程组1500ms deadline/300ms有限取消确认；不确认close/组消失则`childrenGone=false`，不将SIGKILL发出冒成功。特别是取消/异常Windows interop时，Linux组消失不证明原生Windows进程终止，强制报false/unavailable；**真实激活前仍需精确Windows取消清理方案与验证，不可把当前纯mock充跨系统清理保证**。同时采样不等于同一瞬间，只有实际激活后延迟/差值才有解释价值。

12个新增纯测试覆盖IP/secret canary不外泄、坏/缺/重复/溢出/重置计数fail closed、one-shot/void、读/observer异常不外抛、固定只读命令/限制env、模拟取消/输出超限/未确认组、mock计时1500+300及Windows取消不假报gone。初次strict lint发现两个空mock体，补注释后实际0；最初10测试过，最终12及原工具合计49/49过（303.349778ms），strict lint0。没有运行采样工具的真实命令/P1/新增探针。最终干净HEAD完整CI另实跑；纯测试不充实际转发修复或真实清理通过。

独立只读审指出的Windows取消假报风险已按上述false分支/纯负例修订；同审提醒先前Windows查询3.6秒，1.5秒采集窗可能经常不可用，必须保留unavailable而非当0或暗自延时。当前未激活，暂无真实性能/清理结论；后继激活方案需同时解决Windows可取消性与窗口可用性，不改原relay5秒。

### 被动实证与有限空载对照（后继）

`final-p1-auth-401-tcp-state-1`原11完整发现/完成：首例撤Cookie后实际GET会话401核验通过，随后原openRoute第9行失败，其余10过；PW1/24703ms、host1/null/34667ms，无relay、owned全清。临时五行已精确撤回，对已提交五期待版本零diff。紧随`final-p1-auth-exact-restored-2`前7例过后中断：PWnull/SIGTERM、host1/null/28443ms、complete=false，owned全清，不能充还原11绿。

后者实际固定事件为active4173/upstream CONNECT_TIMEOUT：`connected=false, connecting=true, upstreamDestroyed=false, downstreamDestroyed=false, activeSockets=8`。本次5秒计时点上游仍在TCP建立中，不是已连接HTTP响应/空闲超时；8是整个relay Set的socket数，不是根因或资源耗尽证明。不将这一次状态倒写为旧所有故障的已核原因；不归因认证、业务响应或某个具体网络组件。

依总R7网络基线/复现条件权限执行独立零认证对照：`node scripts/e2e-docker/tcp-baseline.mjs`，脚本不读取env/.env、不连DB/API、不发送payload，先独占4173且ss核自有PID，临时bind与既授owned preview相同0.0.0.0，不修改任何既有监听/转发/防火墙配置。宿主回环与固定只读镜像容器的host-gateway别名，各最多50次单并发、50ms间隔、同5秒deadline、首败停止。输出只有方向/固定计数/精确清理布尔；这不是P1替代路线或绕过正式gateway校验。

最终实际host0/null/6003ms，安全日志`/tmp/kingturf-final-tcp-connect-baseline-2026-10-20.log`：两侧各50尝试/50连接，timeout/refused/other均0，containerGone/childGone/listenerGone均true。初次实现前同一空载对照也50/50，辅助patch一次因格式化后的声明不匹配在编辑前失败，随后修正；最终入口/纯parser自测后以上述日志为准。2纯边界用例及strict lint0；独立只读实现审无必要阻断。

限制：探针复用Docker静态host-gateway别名，仅校IPv4，未执行正式forward对宿主预测gateway的独立同址比对；也未观察Windows/Docker VM内部状态。50/50仅说明该空载窗口别名可达，不能排除P1时序/负载下间歇TCP问题，不能证明relay/产品已修复。更深Docker Desktop/WSL/Windows只读专项在596a927已按[直接人裁R7](../tasks/harness-final-network-environment-authorization-2026-10-20.md)落盘，配置修改仍另批，不重复P1求绿。独立最新596a927 A8原26/runtime原1已全绿且owned全清，Source另19生产器/精确回收通过；最终干净HEAD全CI另验。完整认证负例已证，但认证还原全绿/两完整浏览器轮仍欠。

### 后继：只增被动TCP状态，不放宽原失败合同

MRP五期待适配后原11一次全绿，但认证负例3/11及精确还原8/11再次active4173/upstream CONNECT_TIMEOUT，[失败史](harness-final-browser-evidence-2026-10-20.md)保留；两次均owned全清，不把部分失败/还原或重跑充完整闭环。

2026-10-20T05:37:29.238Z只读宿主快照（主执行器固定JSON stdout `td018-readonly-kernel-resource-snapshot`）：并行度20、load2.16/2.42/2.51、空闲内存12185399296字节；宿主累计TcpExt ListenOverflows/ListenDrops/TCPReqQFullDrop均0，TCPTimeouts1171。不是单run差值、不是Docker VM或Windows网关内核观测，不能据此确认/排除连接故障成因；不读取地址/进程参数/环境/流量内容。

仅给原CONNECT_TIMEOUT事件附加被动状态：四bool `connected/connecting/upstreamDestroyed/downstreamDestroyed`及bounded `activeSockets`计数，经独立重编码校验，丢弃其它原文字段。原4173/5432、网关同一、5000ms、connect后0、destroy/fail分支全部保持；不重试/降级/延时，不输出地址/端口实例/字节数/请求头或内容。上文“原文件未改”是初次合同核查时点，后继diff仅上述观测，不是修复网络。

两个纯工具用例实际0及strict lint0；固定镜像sha256:1a0e14c3…只读仓库/只读根/无DB环境的原`forward.test.mjs`四例实际0（7173.720066ms），先确认宿主无4173 preview，覆盖错网关、两占用端口及真实拒连硬失败/清理，容器--rm无残留。新状态尚未实际捕获本轮超时，不预填诊断结果；后继仅为获授权复现条件采集运行原用例，仍遇原失败即如实停止，不靠重复求绿。

独立只读diff/输出边界审无必要阻断；`activeSockets`是整个relay当时Set内两侧socket总数，不是单连接数，不外推请求数/并发用户数。审查未代主执行者做真实网络/浏览器测试。

TD-TEST-018仍开放/成因待核，本次完成资源基线与条件对照，不登记为修复或关闭。零新relay失败不能代替根因诊断。此页只读诊断证据可独立回滚，不删除原失败史；最终干净HEAD完整CI另验。
