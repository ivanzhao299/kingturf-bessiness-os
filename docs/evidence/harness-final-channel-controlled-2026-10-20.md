# TD018 受控收口 S1–S6 证据（尚未完成）

先0c98d6a[正式人类R7](../tasks/harness-final-channel-closeout-authorization-2026-10-20.md)，再3095081[S1–S3设计](../tasks/harness-final-channel-s1-s3-design-2026-10-20.md)。旧[网络失败史](harness-final-network-diagnostics-2026-10-20.md)与[P义务链](harness-final-browser-evidence-2026-10-20.md)保留；d973ce8实际干净HEAD完整CI0/401325ms是前检查点，不顶新结果。

## S1 完成驱动采集窗

仅将采集绝对上限改为SAMPLING_CAP_MS=15000，完成/close立即收取、不等cap；不是修改原relay5000ms。15秒选型依据为Windows既有3.6秒查询及首次超过10秒yield，不声称实测分位数或已保证所有Windows查询可用；真实正常采样验证在S2。取消确认原300ms暂保持，Windows取消不确认仍报false，真正原生监督与独立消亡验证须后继S2/S3。

新增3.6秒mock完成即收测试；原error无close测试改mock时钟14999→15000触发kill、再300ms未确认false。原12＋新增1=13纯测试实际全过（82.774178ms），strict lint/format实际0。没有运行真实采集/Windows/P1，原forward/preflight/spec/产品/两配置未改。回滚本S1仅cap与对应测试成组，不能把旧1.5秒用于已知3.6秒查询的受控激活。

S2真实canary/原生监督、S3三故障清理与独立审、S4原11认证红还原绿、S5同HEAD两轮38原UI、S6材料及最终新干净HEAD完整CI均尚未执行；未执行不预填绿。不push/部署/生产/网络配置/产品/依赖/§14。

## S2 原生监督/canary先行（尚未容器接线或S3）

独立审后弃用未运行的Console.In.ReadLineAsync草稿：微软同步TextReader实现不能提供自主监督。新C# helper采用专用30秒watchdog、内核创建时JOB_LIST＋HANDLE_LIST（不是create后assign），root/worker私有UTC创建身份、同handle终止、Job成员封闭归属；正常drain/cancel分离。原生代码由现有Framework64/v4.0.30319/csc.exe编译，明确System/System.Core/Web.Extensions引用、x64，不装依赖；源码/二进制只在本次owned临时目录，不含认证/原始查询或身份文件。正常编译必须实际exit0/signal null，源码/二进制由hash固定，runtime全部原生确认后才回收。

失败史：首canary build阶段实际host1/238ms，未启动native采样；第二数字诊断为四项CS0246/CS0103，系/noconfig后漏System引用，仅补现有Framework引用。首编译成功251/271ms后两次查询未通过（4892/4722ms），worker已started，第二固定stage8表明私有输出reader失败；两次root/Job回收均确认。仅新worker设UTF8并抑制模块加载进度后，真实查询4528ms/固定计数解析通过、root/Job回收与owned构建产物清理true；没有单独区分编码/进度两个因素，不外推业务/通道根因。

最终本版本命令`node scripts/e2e-docker/native-sampling-lifecycle.mjs all`，安全日志`/tmp/kingturf-controlled-native-eight-lifecycle-1-2026-10-20.log`，host实际0/null/45878ms（内层45848ms）；编译实际exit0/null/251ms，八情形全部实际通过：

| 情形           | 实际耗时ms | 原生实证                                                                                                                        |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| canary         | 5577       | 真实固定查询4269ms；真实私有IP/secret canary注入被parser拒绝，公开输出边界核查通过；helper/worker identity gone、Job成员0       |
| cancel         | 894        | 事前helper/worker identity匹配且活跃、Job成员≥1，取消后两原生identity gone/成员0                                                |
| lost-handoff   | 580        | 私有root登记后未ACK/query未启动即取消；root gone、无worker登记、Job0，不伪称worker逐PID轮询                                     |
| suspended-kill | 1063       | worker创建时入Job、私有创建身份已登记但未Resume；强杀root后helper/worker identity gone/Job0                                     |
| interop-kill   | 748        | 活跃后Linux transport KILL，外层独立native清理核两identity gone/Job0，不拿Linux close作native证明                               |
| native-kill    | 1047       | 原生root同handle终止，关闭最后target Job handle触发worker回收，随后两identity gone/Job0                                         |
| no-ack         | 31404      | stdin保持打开/不ACK且暂停消费输出，禁用host15秒取消；native实际leaseExpired=true，约30秒自主终止，非host EOF/35秒transport KILL |
| read-break     | 4263       | 活跃真实查询后断私有读端、host15秒取消禁用；结束后两identity gone/Job0                                                          |

root/worker创建ticks不进公共日志；worker存在的六类均有私有worker登记及原PID创建身份消亡核验，Job0表示封闭后代成员归零，不是只扫ParentPID。未注册worker的两项单独标false。全部runtime nativeGone/artifactGone true；inspect自身正常完成只窄证原生exit0，异常inspect另保留owned登记/有限精确核查，不能以Linuxclose充成功。纯工具13＋native结构/边界3=16实际全过、strict lint0；实际容器接线、与PG三故障联合证据/独立审仍未完成，不能先P1。

## S3 源端三故障受控接线（已完成）

在同一版本、同一隔离本地PG目标上，native hold 先完成注册/活跃，再启动 source preflight；采样器位于容器外，source 端分别执行真实取消、精确 owned 容器强杀、原 producer 进程组强杀。三次均保留原 relay/preflight 失败结果，且只导出固定布尔字段。每次私有日志为 `/tmp/kingturf-final-controlled-source-{cancel,kill,failure}-1-2026-10-20.log`，权限0600；日志不进入证据或版本库。

| 故障           | source 结果                                                                      | source 清理                                 | native 清理                                           | 备注                                          |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| source-cancel  | preflight exit=1；producer exit=143；stage=producer                              | schemaGone/markerMatched/containerGone=true | nativeGone/nativeChildrenGone=true；queryStarted=true | 取消后原生采样仍完成精确回收                  |
| source-kill    | preflight exit=1；owned container 强杀                                           | schemaGone/markerMatched/containerGone=true | nativeGone/nativeChildrenGone=true；queryStarted=true | 仅杀该次白名单容器，未依赖容器状态证明 native |
| source-failure | preflight exit=1；producer signal=SIGKILL；stage=catalog；ownershipVerified=true | schemaGone/markerMatched/containerGone=true | nativeGone/nativeChildrenGone=true；queryStarted=true | producer 强杀后的同实例 marker 回收成立       |

三次受控回放均有 `source-producer-ready`，source-owned cleanup、owned cleanup 和容器结束事件；runtime 关闭均 `nativeRuntimeGone=true`、`nativeArtifactsGone=true`。追加的 native 结构/边界与现有网络工具合计 53 项测试全过；没有运行 P1，也没有改 relay 5 秒、失败硬闸、产品、网络配置、workflow 或依赖。S3 三故障和原生实现已具备独立审查材料，可进入授权的 S4 P1 两次 11 例回放。

## S4 P1 受控回放（按连接超时停止）

精确还原首跑 `final-controlled-p1-restore-1` 实际 `exit=0/null`，发现11、完成11、通过11、失败0、超时0；旁路未触发采样，owned schema/container/preview 与 native runtime/artifacts 均清理。安全日志为 `/tmp/kingturf-final-controlled-p1-restore-1-2026-10-20.log`，未纳入仓库。

随后只在首例临时加入认证撤销片段，首个 relay 事件即为固定 `port=4173 / side=upstream / code=CONNECT_TIMEOUT / closing=false`；本次 child `exit=1`、发现0，未形成认证负例11例结果，按授权停止，不重试求绿。sampler 只在该 relay 事件后触发，nativeGone/nativeChildrenGone/runtimeGone/artifactsGone 全true；安全日志为 `/tmp/kingturf-final-controlled-p1-auth-negative-1-2026-10-20.log`，未纳入仓库。临时片段已移除，`tests/e2e/p1-demo.spec.ts` SHA-256 恢复为 `37734ce8bae62a0bf5690339658a43cc63e18ac69b04529e97da5ddb4c5bb1c2`，工作树无该文件差异。

因此本轮未达到“认证负例11/11＋精确还原11/11”，也未启动 S5 两轮；连接超时数据不足仍是阻断，原5秒 relay/失败硬闸保持。

## 最终干净 HEAD 门禁

提交 `1902c0f` 后使用固定回环测试库 `kingturf_test` 实跑 `DATABASE_URL=postgresql://kingturf:local-development-only@127.0.0.1:5432/kingturf_test pnpm ci:local`：format、doc-lint、structure、service boundary、capability、database guard/migrate/status、lint、typecheck、coverage、build、security 全部通过。覆盖结果为 377 源文件/25 仓库，overall 37,543/48,601，domain 629/671，repository 9,838/11,512，deficits=[]；API 135 文件/17,297，Web 27/436；结构强制违规0、存量豁免29、G5限期豁免4；安全审计无高危。该门禁不改变 P1 负例和两轮未完成状态。

## 2026-10-21 S4a 同状态对比：停止并上报

按新的 [环境重建复现 R7](../tasks/harness-final-channel-reconstruction-authorization-2026-10-21.md)，只做一次认证负例与紧随其后的无负例单例冒烟。认证负例临时片段仅在首例 `openAuthenticatedWorkspace` 后加入三行：清 Cookie、请求 `/api/v1/auth/session`、断言401；片段随后逐字移除，`tests/e2e/p1-demo.spec.ts` SHA-256 恢复为 `37734ce8bae62a0bf5690339658a43cc63e18ac69b04529e97da5ddb4c5bb1c2`。

认证负例 `final-controlled-p1-auth-negative-s-a-1` 在第一个 relay 事件即失败：`port=4173`、`side=upstream`、`code=CONNECT_TIMEOUT`、`closing=false`；发现0，未形成11例结果。旁路 sampler 只在该事件后触发，`nativeGone=true`、`nativeChildrenGone=true`、runtime/artifacts 清理均为真；owned schema/container/preview 清理为真。安全日志为 `/tmp/kingturf-final-controlled-p1-auth-negative-s-a-1-2026-10-20.log`，未进入仓库。

紧随其后的无负例 runtime 单例 `final-controlled-s4a-smoke-b-1` 完成1/1，`exit=0/null`，单例耗时831ms，preflight exit=0；它执行真实 `/` 登录并进入 hash 路由，容器/schema/preview 清理全真。安全日志由 preflight 私有目录保存，未进入仓库。

同状态对比结果是：无负例路径可达，认证撤销片段路径触发后出现固定连接超时，形成测试侧路径线索。按 R7 分支规则到此停止并上报，不进入 S4b 环境重建、不再跑认证负例、不启动 S5 两轮；原 relay 5 秒和失败硬闸保持，不能据此归因产品或确定网络根因。

## 2026-10-21 T1/T2 归因收口

按 [归因收口 R7](../tasks/harness-final-channel-attribution-authorization-2026-10-21.md)，在首例 `openAuthenticatedWorkspace` 后同一位置加入单行无害注释，运行一次 `final-controlled-p1-harmless-t-a-1`。结果与认证撤销片段一致：首个固定 `4173/upstream/CONNECT_TIMEOUT`、`closing=false`，无 `local-result`，发现数为0；native sampler 的 `nativeGone/nativeChildrenGone`、runtime/artifacts、owned schema/container/preview 均清理为真。安全日志为 `/tmp/kingturf-final-controlled-p1-harmless-t-a-1-2026-10-20.log`，未进入仓库。

因此 T1 判定 **M1**：只要在该位置改变正式 spec 文件字节，受控容器路径就可在 runner 产生发现结果前触发相同 relay 超时；不能把认证撤销语义单独判为 M2。正式文件已逐字恢复，SHA-256 为 `37734ce8bae62a0bf5690339658a43cc63e18ac69b04529e97da5ddb4c5bb1c2`。

T2 静态边界如下：`container.mjs` 在收到控制后先调用 `startForwards`，再进入 PG 同一性核验和 `runPrivateSpec`；`private-runner.mjs` 随后才以固定 `tests/e2e/p1-demo.spec.ts` 路径、只读 `/work` bind、tmpfs 结果目录和 `--trace=off` 启动 Playwright。撤 Cookie、会话 GET 和单行注释都位于该 spec 的测试函数体内，模块顶层只有 Playwright/AppRoute 导入和环境变量读取，不能在 relay 初始化前执行。S4a 的无负例 runtime 单例通过，而 T1 无害字节变更也在发现0阶段超时，机制证据落在“spec 文件变更/挂载同步/runner 加载边界与 relay 的时序耦合”；它不能证明具体 Docker、WSL 或 Windows 根因，也不能归因产品或正式测试语义。

按 M1/T2 分支，TD018 负例有效性采用等价证明继续收口；本轮不修工具、不重试认证负例。历史真实红、当前 mock/PG 认证拒绝路径和真实注入红记录继续作为证明包组成部分。T1/T2 完成后正式正文恢复，进入两轮正常态 A8+B2。

## 2026-10-21 S5 两轮结果与终态

第一轮正常态 A8+B2 全部通过：26 个 A8 UI、Source producer 19＋UI3、runtime 1、P1 11，所有 preflight exit=0、无 relay failure、owned 清理全真。第二轮 A8、Source、runtime 全部通过；P1 首个 `4173/upstream/CONNECT_TIMEOUT` 即失败，preflight exit=1，未产生 local-result。原 relay 5 秒合同与失败硬闸保持，按授权停止重试。

结合 T1 无害片段同样触发超时和 T2 的加载边界，TD018 终态为：**片段触发性超时（测试侧，M1+T2）+ S4a 已排除一般环境坏态 + 认证拒绝/撤销以 mock、PG/HTTP 和历史真实注入红形成等价证明**。两轮正常态没有形成完整双绿闭环；不宣称 Harness 竣工，等待人工终验。
