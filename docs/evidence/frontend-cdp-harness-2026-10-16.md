# 批次3 CDP确定性探头基线（2026-10-16）

## 当前结论与复跑

授权 `ad0435e`/执行记录 `02d93f4`，已独立收口的通道代码 `8456ef3`。其稳定干净HEAD完整 `pnpm ci:local` **真实exit0**（`/tmp/kingturf-cdp-channel-ci-2026-10-16.log`）：API117文件/17099、web9文件/114、原PG套件、预算11368/1898、audit无已知漏洞。该日志shell elapsed=175508371138ms明显失真，不当有效耗时；退出码/测试结果有效，后续用Node单调时钟计时。

本次在通道之上新增零npm依赖的 Node 原生 http/WebSocket CDP探头，**六场景、五类均实际运行**，最新 `8lZlf8` 真exit0；不是Playwright全套、不是21视图完整覆盖、不是业务API/SQL/真实安全矩阵通过。业务源码、原web114测试/fixtures、Playwright配置及九spec、后端/packages/SQL/lock/workflow/评分均未动。新web AST护栏/3a迁移尚未实施。

仓库根复跑（仅一个浏览器/preview串行，需Node24、WSL interop/Windows Chrome、已有本地build产物）：

```sh
node --test scripts/e2e-cdp/fixtures.test.mjs scripts/e2e-cdp/network-policy.test.mjs
node scripts/e2e-cdp/preflight.mjs --probes > /tmp/kingturf-cdp-probes.log 2>&1
```

纯JS **4 tests** 由根test:release-guardrails最小接入完整CI，独立计数，不并入web114/API17099。Windows ownership.NET与真实生命周期脚本仍手动，不接跨平台默认CI。所有新目录文件经根lint显式覆盖。浏览器正向六场景、两个定向负向及原生命周期五项分开报告，不能相加为Vitest或Playwright覆盖。

## 隔离与数据策略

仅 `http://127.0.0.1:4173`，每跑全新Windows临时profile、随机CDP端口、owned监听/PID/preview进程验证及finally清理沿[通道证据](windows-chrome-cdp-preflight-2026-10-16.md)。Chrome固定参数集F1：

```text
--headless=new --remote-debugging-port=0 --remote-debugging-address=127.0.0.1
--user-data-dir=D:\PersonalFiles\Temp\kingturf-cdp-preflight-<run后缀>
--no-first-run --no-default-browser-check --disable-background-networking about:blank
```

下面每跑均F1、Chrome154.0.8037.99，Windows listener127.0.0.1/本跑PID、preview127.0.0.1:4173/本跑子进程；profile只删除本次mkdtemp结果，不触用户Chrome/profile。未加安全放宽flag，未改网络/防火墙/portproxy，未提权/重做sudo，不用缓存Chromium。`--probes`及两个fault选项是Node驱动参数，不传给Chrome。

确定性全部stub：仅明确GET session/customers/cost-matrix-summaries/quotes/organizations/指定合成customer360六条端点响应；所有身份/记录为合成，未启真实API、未播种/触DB。Fetch在首次本地导航之前启用；仅本地GET `/`、`/assets/`前缀及favicon可continue；`/api`任意前缀全部送精确stub映射，未知/写方法一律拒绝且该跑失败；`/health`、`/ready`、`/version`、其他非静态路径和外域均拒绝。Vite真实proxy按startsWith匹配，不能只判断`/api/`；分类器反例覆盖/apix、encoded前缀、健康代理、外域、userinfo、非GET静态等。正向最终blockedRequests/unknownApiRequests/failedApiRequests均须0；不吞意外流量、不打印原始URL/query/header/body/CDP帧或fixtures，仅报逻辑资源计数。

成本hold精确匹配合成搜索q，不让初始成本GET误占hold；非匹配响应completion=null，不能解除该搜索的fulfilled信号。Fetch.fulfillRequest收到CDP ACK才触发该hold.fulfilled；cost/detail等待均有3.5秒上限，失败进入releaseAll及owned资源清理，非无限等待。初始GET不能提前完成search hold有独立纯JS反例。

## 六场景与五类真实计数

| 场景                | 实际探头                                                                                                                                                                                                   | 原行为/绑定依据                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 合成工作台          | 可见客户行identity文本、文档级无横向溢出                                                                                                                                                                   | 绑定真实.customer-row .identity，不用display:contents的.crm-records当可见box（style.css:1005）                                                                                                                                                  |
| CRM筛选             | Input真实click/Control+A/insertText；筛至一行；商业workspace、菜单每节点、未参与重绘的cost input身份不变；CRM输入值/焦点/选区恢复；真实点击成本再回客户，值保持                                            | bootstrap.ts:14155-14159、14548-14562；旧隔离spec:58-85。CRM input原本被重建，**不要求其对象身份不变**；用户确认按原行为验证，协调纠正先前过宽措辞，不新增业务裁定。成本自身请求刷新会重建其section/input（:3845-3872），不跨该事件要求身份保持 |
| 设备/路由/文本/溢出 | 1440×1000桌面↔390×844 mobile；同页等待shell类别更新并检溢出，再独立重新挂载；真实点击客户/成本/报价；活动标题可见、唯一aria-current、至少一匹配目标view可见、非目标view零rect；文档scrollWidth≤clientWidth | resizeTarget可选resize绑定:13292-13303。路由click监听:12321-12414；既有route-view token过滤语义不加强业务。内表可局部滚动，不将它算文档溢出                                                                                                     |
| late cost→quotes    | 精确q请求hold started→真实导航报价→逐rAF查非目标paint→release→Fetch fulfillment ACK→再至少2帧/350ms→零泄漏；成本搜索值仍保持                                                                               | 旧隔离spec:88-141。不是release后盲等，不是零动画帧冒绿，不在日志回显q                                                                                                                                                                           |
| late customer→cost  | 真点客户行并hold360→真点成本→release/ACK→隐藏CRM详情h2更新但成本仍活动、完整菜单数量、成本输入可见                                                                                                         | 旧隔离spec:143-173。此h2按原spec允许hidden，text显式visible=false，仅此数据更新探头；活动页文本仍须可见                                                                                                                                         |
| customer360 503     | 真点客户行→可见局部alert→客户route仍有效/菜单保持→真点成本仍可用                                                                                                                                           | 旧隔离spec:175-185；仅合成HTTP503，不是验证真实后端权限或真实可用性                                                                                                                                                                             |

最新正向统计（`8lZlf8`）：六场景全部通过；DOM **22**（逻辑click/fill操作，不是低层协议包数）、viewport **3**、route **21**（重复断言次数，**不是21个不同视图**）、text **9**（其中隐藏详情更新1）、overflow **9**。distinct业务route仅customers/costing/quotes；API逻辑计数session5/customers5/cost6/quotes5/organizations5/detail2，全部stub；网络blocked0/unknown0/failed0。

真实截图 `/tmp/kingturf-cdp-preflight-8lZlf8-probes.png`，已主代理目视确认成本页、合成身份与菜单，sha256 `4d9d7db33a3e5c0fd9af36436fa015349a6a378b6c768ee2c65072a4fef6ddaa`；没有截图编辑。公共登录DOM快照沿每跑`/tmp/<run id>-dom.json`，不转存业务原文/fixture至日志。

## 每跑日志/失败与修正史

完整run id=`kingturf-cdp-preflight-<后缀>`，日志均在`/tmp/kingturf-cdp-`下；表内日志名补该前缀。所有表内跑的preview exited/rootGone/profileGone均true、profileProcessCount0；未使用强退绕过finally。所有实测失败保留，未把它们写成skip或通过。

| 后缀   | Windows PID/CDP端口 | preview PID | 结果与原因                                                                                                                        | 日志后缀                             |
| ------ | ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| lDkVep | 58564/60586         | 1999670     | exit1；只hash导航未产生新文档，session init未执行，工作台等待超时；改about:blank→本地新文档                                       | probes-baseline-2026-10-16.log       |
| 1phQC1 | 50324/55607         | 2001512     | exit1；成本路由点击发生在菜单展开动画期间；改unobscured hit检测后真实点击，不改业务事件                                           | probes-baseline2-2026-10-16.log      |
| TJjnKp | 50104/54502         | 2002996     | exit0六场景；尚未收紧proxy白名单/目标可见/ACK窗口，不冒作最终证明                                                                 | probes-baseline3-2026-10-16.log      |
| hosSpQ | 43492/55217         | 2003714     | exit0六场景；proxy白名单、live设备切换已补，后续再补目标/文本可见与ACK窗口                                                        | probes-isolated-2026-10-16.log       |
| Wz18at | 53144/55363         | 2007964     | **预期exit1**；真实CDP未知/api前缀负向，api-stub-rejected，非harness-pass；未掉到真实proxy                                        | unmapped-api-negative-2026-10-16.log |
| Yeqg7a | 36892/57077         | 2020340     | exit1；可见文本绑定display:contents容器为零rect；改真实可见identity，不放宽visible条件                                            | probes-final-2026-10-16.log          |
| 512Pxr | 63688/49587         | 2029792     | exit0六场景、可见/ACK窗口/最终网络0已补；随后将cost hold精确绑定q                                                                 | probes-bound-2026-10-16.log          |
| MiM5PB | 40748/54401         | 2031673     | **预期exit1**；本跑DOM临时隐藏全部route views，active仍customers而visible=[]，路由探头真实红，无harness-pass，清理后新profile恢复 | hidden-route-negative-2026-10-16.log |
| 8lZlf8 | 65824/54511         | 2031742     | **最新exit0**；q精确绑定、ACK窗口、正目标可见/文本/五类/最终网络0全部通过，新profile证明DOM注入已恢复                             | probes-query-bound-2026-10-16.log    |

定向负向可复跑：`node scripts/e2e-cdp/preflight.mjs --probes --fault-unmapped-api`、`node scripts/e2e-cdp/preflight.mjs --probes --fault-hidden-target`；预期exit1、无harness-pass、清理全部true。这两项**不计六个正向场景**、不计原生命周期五项或web114。隐藏注入仅当前本地页面style，不写业务文件，不改冻结spec。

其他诊断史：早期模板字符串正则反斜杠被eslint报no-useless-escape两项，修正确实转义后再跑；一处apply_patch预期503多行格式与实际单行不符，校验失败无修改，读取实际片段重施成功。最初仅搜直接resize绑定误判无动态设备更新，补读resizeTarget后公开更正，并增live class/overflow检查。未隐去失败、未顺修favicon404/业务问题。

协调曾提前猜读尚不存在的`docs/evidence/windows-chrome-cdp-harness-2026-10-16.md`，rg实际退出2，随后用rg --files定位本文件；仅文档定位失误、无写入，不算harness失败。两位协调独立只读reviewer终审当前候选无必要阻塞，不要求为未来任意延迟扩大工程。

独立reviewer只读指出并复核：Vite proxy前缀漏口、目标view可见性、hidden detail例外、hold ACK与取消界限、精确q/空completion反例；最终query/completion增量及8lZlf8/MiM5PB证据可冻结。协调独立纯JS4/4真exit0（约48ms），没有与主代理并发Browser/PG写。旧通道五生命周期/九谓词对照保留在通道证据，本轮未重复无关检查。当前源码候选完整CI在提交稳定后另跑，结果随后版本化记录，不以局部绿替代全CI。

## 后续覆盖与Playwright补跑义务

| 里程碑 | 该基线已有/仍需扩展                                                                                                          | 未覆盖与补跑                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 3a     | 基线已含真实输入/导航、localization标题、HTTP stub边界、live设备/溢出、隔离race；form打开/取消需随提取加定向探头，C3护栏先行 | 原web114/预算/能力/metrics/完整CI照跑；无测试读取适配/变异已完成的宣称                                |
| 3b     | CRM筛选与三项race已在独立CDP基线                                                                                             | 原p1-demo **11 tests** 真实业务台账/API未执行；不能说stub等价旧P1                                     |
| 3c六组 | 当前仅costing/quotes，21视图还须逐组精确fixture/route/text/设备/溢出地图扩展                                                 | 不把21次route断言当21域完整覆盖                                                                       |
| 3d     | 只有organization表面初始化，未做合成角色组合矩阵                                                                             | 原production-role-uat **16代表角色模板** 的真实账户/拒绝API探针未测；环境缺失skip不算通过，须明确补跑 |
| 3e     | 四个旧隔离场景的CDP基线可重复（CRM身份/late cost/late detail/局部503）                                                       | 原workspace-route-isolation **4 tests** 仍未执行，CDP与Playwright分开计数                             |
| 3f     | parser尚未实施/未测                                                                                                          | 未来畸形拒绝需独立行为变更登记提交，不混纯提取；SQL/真实安全矩阵不在stub覆盖                          |

**Playwright配置及九spec一字未改、全部未执行；阶段5终验前须用户提供Linux Chrome或免交互安装权限后全部真实补跑。** 本义务是批次3人工验收显式边界，不能因CDP绿取消；当前不启动4/5/N+1修复/D1/其他BOUND/SEC，不更新评分。

回滚：本harness脚本、根纯JS测试接线及本证据/地图可整体独立revert至`8456ef3`，保留已经验证的通道与授权；不会恢复任何业务数据（本批未触DB）。各次删除仅本跑临时profile，均可再生，无用户数据需恢复。

协议依据：[CDP Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/)、[Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)、[Emulation](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/)；采用输入/请求截取/指标方法，不加安全放宽flag。
