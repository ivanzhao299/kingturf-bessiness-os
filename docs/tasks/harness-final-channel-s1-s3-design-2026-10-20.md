# TD018 S1–S3 可核设计（工具层，无产品改动）

依据0c98d6a [正式R7](harness-final-channel-closeout-authorization-2026-10-20.md)。d973ce8最终CI实际0/401325ms已核，不代新实施；当前未实施/未真实canary或三故障，不预填通过。现有CDP只支持存活owner finally＋精确profile，不具备原生创建身份/失联监督，不能直接复用其lost-PID结论。

## S1 完成驱动窗口

采集任务完成立即收取，不等待固定窗口；绝对采集上限选15秒，依据是既有Windows查询3.6秒且首次全局查询曾超过10秒yield未取值（并无分位数样本，**不声称15秒是实测分位数**）。这是保守绝对上限，不是把原relay5000ms改成15秒。每项记录elapsed/available，不把超时不可用当零。主机窗口开始于任务启动，Windows另记私有握手/查询阶段延迟，后继真实正常查询核实可用性。

原relay仍5秒/原错误立即destroy/fail；只在原失败已发出后异步触发采集，不await sampler决定失败。正常drain与cancel分开：原失败已通知后、preview仍在时允许有界drain至采样完成；SIGTERM/强杀立即cancel。采集完成/取消的有界排空属于cleanup，不延迟原失败通知。纯测试改用mock时钟验证完成即收/15秒cap、取消、未知字段与原5秒不动；默认ci:local只跑纯测试，不执行系统采集。

## S2 原生Windows监督与受控激活

实施前独立审修订：弃用未运行的PowerShell监督草稿，改版本化C#原生helper，由本机已装.NET Framework compiler受控编译（不安装依赖），仅owned Windows临时目录内公开源码/二进制，正常编译exit与产物清理另记，运行前hash核定。编译阶段不混runtime故障证明，失败/取消不确认则保留并停。命令身份和所有PID/UTC创建ticks/Job nonce仅私有stdin/stdout内传，累计16KiB；外层仅白名单标量。root先启动独立watchdog、登记自身精确PID＋UTC ticks及即将创建的随机Job名，再建KILL_ON_JOB_CLOSE Job，完成Job设置后才处理ACK/创建任何worker；即使setup失败也已可按私有root identity核清。30秒上限不依赖stdin/查询/输出Flush；输入在独立Task同步ReadLine，不在主监督线程调用Console.In.ReadLineAsync。微软[TextReader实现](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/io/textreader.cs)证实同步包装的异步命名不能当非阻塞保证。

采样PowerShell worker以CREATE_SUSPENDED＋STARTUPINFOEX的PROC_THREAD_ATTRIBUTE_JOB_LIST在内核创建时即归属私有Job，再登记worker创建身份/ResumeThread；不采用“CreateProcess返回后才AssignJob”的孤儿窗口。仅NUL stdin和私有输出pipe通过HANDLE_LIST继承，不继承root控制stdin/Job handle。[微软属性文档](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)支持Windows10起创建时Job列表；失败须停，不退回非原子路径。Job封闭成员（最多32）不是当前ParentPID/名称推断，root异常最后Job句柄关闭会终止worker及Job后代；仍必须现场核原生终止而非拿机制说明充实测。

丢handoff窗口：host即使取消也继续有限读取私有早期identity；未ACK前不会启动查询，原生ACK等待/EOF或30秒lease终止。故障测试刻意延迟向调用方交回身份，证明取消先发生仍可从独立私有登记核精确native消亡。若启动到任何身份仍无法登记，或监督未到上限/无法核清，不假报gone，S3失败并停S4。

独立native inspect先打开并持有root同一native handle，使用该handle的GetProcessTimes核UTC ticks、固定本helper映像，再允许TerminateProcess该handle；重用PID/身份/映像不符禁止杀。先终止并确认root停止创建，再TerminateJobObject，轮询root句柄已signaled及Job active members为0；Job不存在只接受精确file-not-found，不把权限等错误充missing。不读命令行，不按ParentPID/名称找杀。root/Job私有身份仅来自本runtime已注册对象，不能接受任意外部PID。inspect自身同样自建Job/独立watchdog/有界协议；异常inspect也留owned登记，有限再次精确核查，否则全局清理未确认/停S3。正常inspect完成只窄证自然退出，不冒称自身也已由另一个无限递归inspect独立轮询。root正常采样仍另做独立原生identity/Job轮询。

受控preflight显式opt-in才传入容器sampling控制，默认命令/ci:local无真实采集。容器仅旁路报告固定连接计数/采样触发；host执行WSL/Windows侧采集。容器内relay原失败合同不变，host不通过docker exec争抢容器清理。激活只存在这条受控复现链路，不能扩成产品或通用采集服务。

先真实canary：正常原生计数查询完成＋核精确原生结束；另合成IP/认证/原文canary注入私有原始帧，验证公共标量输出无canary/地址/identity。所有原始帧仅RAM/不导出；不把纯parser canary代替真实运行。若原生监督/Windows查询不可用则停，不绕过/不改防火墙/portproxy/监听。

## S3 三故障现场与独立清理

复用Source既有owned schema/marker/同实例工具与原19生产器，不改19正文/业务样本/产品SQL。只有原beforeAll ready后、Windows监督已私有登记且受控runspace仍活跃时触发：

1. 正常取消：host可处理SIGTERM，采样取消/EOF；精确原生identity轮询消亡＋native子计数0，独立核Source/runtime schema、owned容器/preview回收。
2. 容器强杀：仅已核精确owned容器KILL；Windows采样者在容器外，host独立取消/检查其精确原生身份与子进程，不能拿containerGone当nativeGone；PG两schema另证。
3. 生产器强杀：仅该容器内原producer进程组KILL，host收原失败后独立取消Windows并轮询精确消亡；PG回收仍以原同实例/精确marker真值为准，不以producer afterAll代替。

另验证正常完成、lost-handoff取消、interop/监督异常、无ACK自主30秒lease及读端断开/停止消费；至少各有真实native注册→结束/轮询证据，host15秒EOF不能代自主lease证明。测试控制hold仅延长独立合成worker以确保故障时native活跃，不拖延/改写产品请求或relay5秒。记录真实退出、耗时、故障触发先后与各资源清理布尔；原始身份不入日志。停止失败按角色精确保留，禁止按名称/前缀/目录差集猜杀。

S1–S3各步单责提交/真实结果及回滚索引，独立只读复核齐后才能S4。实现发现新疑似问题仅TD登记；没有必要证据不得S4或凑两轮。工具接线/监督须成组逆序回滚，先确认无owned原生/容器/PG资源再撤监督代码。最后成功或明确停止后，新干净HEAD完整CI实际0再交人验，不§14。
