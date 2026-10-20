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

### 被动实证与有限空载对照（后继）

`final-p1-auth-401-tcp-state-1`原11完整发现/完成：首例撤Cookie后实际GET会话401核验通过，随后原openRoute第9行失败，其余10过；PW1/24703ms、host1/null/34667ms，无relay、owned全清。临时五行已精确撤回，对已提交五期待版本零diff。紧随`final-p1-auth-exact-restored-2`前7例过后中断：PWnull/SIGTERM、host1/null/28443ms、complete=false，owned全清，不能充还原11绿。

后者实际固定事件为active4173/upstream CONNECT_TIMEOUT：`connected=false, connecting=true, upstreamDestroyed=false, downstreamDestroyed=false, activeSockets=8`。本次5秒计时点上游仍在TCP建立中，不是已连接HTTP响应/空闲超时；8是整个relay Set的socket数，不是根因或资源耗尽证明。不将这一次状态倒写为旧所有故障的已核原因；不归因认证、业务响应或某个具体网络组件。

依总R7网络基线/复现条件权限执行独立零认证对照：`node scripts/e2e-docker/tcp-baseline.mjs`，脚本不读取env/.env、不连DB/API、不发送payload，先独占4173且ss核自有PID，临时bind与既授owned preview相同0.0.0.0，不修改任何既有监听/转发/防火墙配置。宿主回环与固定只读镜像容器的host-gateway别名，各最多50次单并发、50ms间隔、同5秒deadline、首败停止。输出只有方向/固定计数/精确清理布尔；这不是P1替代路线或绕过正式gateway校验。

最终实际host0/null/6003ms，安全日志`/tmp/kingturf-final-tcp-connect-baseline-2026-10-20.log`：两侧各50尝试/50连接，timeout/refused/other均0，containerGone/childGone/listenerGone均true。初次实现前同一空载对照也50/50，辅助patch一次因格式化后的声明不匹配在编辑前失败，随后修正；最终入口/纯parser自测后以上述日志为准。2纯边界用例及strict lint0；独立只读实现审无必要阻断。

限制：探针复用Docker静态host-gateway别名，仅校IPv4，未执行正式forward对宿主预测gateway的独立同址比对；也未观察Windows/Docker VM内部状态。50/50仅说明该空载窗口别名可达，不能排除P1时序/负载下间歇TCP问题，不能证明relay/产品已修复。更深Docker Desktop/WSL/Windows转发环境只读专项已另询人类、未获批，不擅改网络配置，不重复P1求绿。独立最新A8/runtime及最终干净HEAD全CI继续；完整认证负例已证，但认证还原全绿/两完整浏览器轮仍欠。

### 后继：只增被动TCP状态，不放宽原失败合同

MRP五期待适配后原11一次全绿，但认证负例3/11及精确还原8/11再次active4173/upstream CONNECT_TIMEOUT，[失败史](harness-final-browser-evidence-2026-10-20.md)保留；两次均owned全清，不把部分失败/还原或重跑充完整闭环。

2026-10-20T05:37:29.238Z只读宿主快照（主执行器固定JSON stdout `td018-readonly-kernel-resource-snapshot`）：并行度20、load2.16/2.42/2.51、空闲内存12185399296字节；宿主累计TcpExt ListenOverflows/ListenDrops/TCPReqQFullDrop均0，TCPTimeouts1171。不是单run差值、不是Docker VM或Windows网关内核观测，不能据此确认/排除连接故障成因；不读取地址/进程参数/环境/流量内容。

仅给原CONNECT_TIMEOUT事件附加被动状态：四bool `connected/connecting/upstreamDestroyed/downstreamDestroyed`及bounded `activeSockets`计数，经独立重编码校验，丢弃其它原文字段。原4173/5432、网关同一、5000ms、connect后0、destroy/fail分支全部保持；不重试/降级/延时，不输出地址/端口实例/字节数/请求头或内容。上文“原文件未改”是初次合同核查时点，后继diff仅上述观测，不是修复网络。

两个纯工具用例实际0及strict lint0；固定镜像sha256:1a0e14c3…只读仓库/只读根/无DB环境的原`forward.test.mjs`四例实际0（7173.720066ms），先确认宿主无4173 preview，覆盖错网关、两占用端口及真实拒连硬失败/清理，容器--rm无残留。新状态尚未实际捕获本轮超时，不预填诊断结果；后继仅为获授权复现条件采集运行原用例，仍遇原失败即如实停止，不靠重复求绿。

独立只读diff/输出边界审无必要阻断；`activeSockets`是整个relay当时Set内两侧socket总数，不是单连接数，不外推请求数/并发用户数。审查未代主执行者做真实网络/浏览器测试。

TD-TEST-018仍开放/成因待核，本次完成资源基线与条件对照，不登记为修复或关闭。零新relay失败不能代替根因诊断。此页只读诊断证据可独立回滚，不删除原失败史；最终干净HEAD完整CI另验。
