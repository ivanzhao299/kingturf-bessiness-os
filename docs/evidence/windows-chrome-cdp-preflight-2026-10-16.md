# Windows Chrome CDP 通道预检（2026-10-16）

## 范围与结论

现时收口：通道初稿 `ea6b5e0`→安全收口 `2ef6f83` 后，协调终审发现无引号分支假阳性，已删除并加两条false对照。最新正常实跑 **IYIfOu真实0**、生命周期负向 **5/5**（子进程均预期exit1且清理通过）、谓词 **1 test/9对照** 真实0。根lint显式扫描 scripts/e2e-cdp；下面各旧跑/七对照为历史，不混作最终同一次运行。

### 最终引号分支收紧（2ef6f83之后）

协调以具体反例指出第三个无引号分支会接受含空格裸路径及quoted note内部的userdata文本；这是新通道候选匹配器问题，非业务行为修复。删除该分支，保留本launcher实际使用的双引号整参数及值引号形态；新增 `chrome.exe --user-data-dir=<含空格profile> --headless=new`、`chrome.exe "--note=x --user-data-dir=<profile> end"` 必须false，JS/.NET同一谓词九对照真实0。ownership.test明确为Windows/WSL手动测试，**不接默认CI**，避免非Windows环境依赖PowerShell；CI仅lint新目录。代码变更后的真实生命周期5/5再跑证明当前launcher可安全清理，未恢复宽匹配分支。

最新正常 `kingturf-cdp-preflight-IYIfOu`：Chrome154.0.8037.99、Windows PID34688/127.0.0.1:55268、owned preview1972709/4173；HTTP版本、ActivePort端点身份、Browser.getVersion、WSL页面文档/JS/CSS200与公共DOM控件均通过。preview exited/rootGone/profileGone=true、profileProcessCount0后pass，真实exit0；日志 `/tmp/kingturf-cdp-quoted-normal-2026-10-16.log`，DOM `/tmp/kingturf-cdp-preflight-IYIfOu-dom.json`。全flags仍同下文、无安全放宽。

| 当前最终负向case   | run后缀 | Chrome PID/端口               | preview PID | 清理与结果                                                   |
| ------------------ | ------- | ----------------------------- | ----------- | ------------------------------------------------------------ |
| profile-init-error | Rs6xLi  | 未启动                        | 未启动      | exit1、profileGone=true                                      |
| lost-launch-pid    | F1R5rj  | 启动4688后模拟丢返回/端口未查 | 未启动      | exit1、rootGone=null、profileProcessCount0、profileGone=true |
| preview-error      | V58S47  | 63540/54307                   | 1972151     | exit1，preview/root/profile回收                              |
| SIGTERM            | qMW9zZ  | 44540/57326                   | 1972192     | 受控exit1而非信号强退，preview/root/profile回收              |
| SIGINT             | Sa8foF  | 28004/63319                   | 1972243     | 受控exit1而非信号强退，preview/root/profile回收              |

driver真实exit0/5通过，汇总 `/tmp/kingturf-cdp-quoted-lifecycle-summary-2026-10-16.log`，逐case `/tmp/kingturf-cdp-lifecycle-1792128670617-<case>.log`；每跑无stderr/无pass/无cleanup-failure。未触其他Chrome/profile，所删均为本次新建可再生目录。完整稳定提交CI结果另交接，不把负向或预检计入Vitest、五类harness或Playwright。

基线 `ad0435e`，续派授权 `02d93f4`（计划§7「3a前置裁定2」）。实际通道通过：WSL→Windows Chrome loopback CDP、Browser.getVersion、Chrome→WSL preview 导航及真实登录 DOM、文档/JS/CSS 200、owned 进程与独立 profile 清理。**这不是五类 harness 探头通过，更不是 Playwright 全套通过。** 尚无业务源码迁移、新 web 护栏或 DB 写入。

版本化复跑入口：`node scripts/e2e-cdp/preflight.mjs > /tmp/kingturf-cdp-preflight.log 2>&1`（仓库根，Node24，先有 `pnpm --filter @kingturf/web build` 的 dist）。代码仅用 Node 原生 http/WebSocket/进程与文件 API，零新 npm 依赖；eslint 只将新目录纳入现有脚本 JS override，旧规则不放宽。它从 Windows 临时目录创建每跑独立 profile，不读取真实 Chrome profile/登录/密码；预检页未登录，不播种、不启 API/DB。所有页面请求先经 Fetch 拦截，API 和外域一律拒绝，不掉到 Vite 的 3000 proxy；预检不提供任何 API fixture。

## 实际路径、版本与启动参数

- Windows 路径：`C:\Program Files\Google\Chrome\Application\chrome.exe`；WSL 路径：`/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`。另外两个常见安装路径检查未命中；未扫描用户 profile。
- 文件资源 ProductVersion/FileVersion：`154.0.8037.99`，PowerShell 非交互 Get-Item VersionInfo 查询退出0；未直接无 profile 执行 chrome --version。
- HTTP `/json/version`：`Chrome/154.0.8037.99`、protocol `1.3`；CDP `Browser.getVersion` 同版本。
- 每跑全参数：`--headless=new --remote-debugging-port=0 --remote-debugging-address=127.0.0.1 --user-data-dir=<本跑独立Windows临时目录> --no-first-run --no-default-browser-check --disable-background-networking about:blank`。端口0由OS随机分配，从该 profile 的 DevToolsActivePort 读取；Get-NetTCPConnection 证明监听地址和 owned PID。
- 没有 no-sandbox、disable-web-security、remote-allow-origins=\*，未提权/修改网络、防火墙、portproxy、Playwright配置或spec。WSL localhost 已成功，未尝试主机IP兜底；代码只在 localhost 失败时作默认路由主机IP诊断，不能改监听到0.0.0.0。

## 逐次真实记录（不拼接不同运行）

| run id 后缀 | Windows PID / CDP端口 | preview PID | 实际结果                                                                                         | `/tmp`日志                                      | 清理                                                                        |
| ----------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------- |
| ycQzDB      | 8184 / 60315          | 未启动      | 初版仅HTTP版本/owned loopback连通；**未做CDP握手/导航**；exit0仅传输范围                         | kingturf-cdp-preflight-2026-10-16.log           | rootGone=true、profileProcessCount=0、profileGone=true                      |
| uk9sG0      | 63068 / 65050         | 1918906     | 临时候选CDP版本、导航与登录DOM通过；文档/JS/CSS200；exit0                                        | kingturf-cdp-navigation-2026-10-16.log          | preview exited=true、rootGone=true、profileProcessCount=0、profileGone=true |
| Aoc7b8      | 44932 / 61740         | 1937892     | 版本化修后候选CDP版本/导航/DOM/资源200通过，另有4173 owned listener证据；**清理后才pass**；exit0 | kingturf-cdp-versioned-preflight-2026-10-16.log | preview exited=true、rootGone=true、profileProcessCount=0、profileGone=true |

完整 run id 为 `kingturf-cdp-preflight-<后缀>`；实际 Windows profile 为 `D:\PersonalFiles\Temp\<run id>`，仅本次新建目录被递归清理，其他 Chrome 进程/profile 未终止或删除。本次删除仅可再生临时浏览器数据，不需要恢复。DOM快照在 `/tmp/<run id>-dom.json`（后两跑）；版本化快照要点如下：

```json
{
  "url": "http://127.0.0.1:4173/",
  "title": "金特夫企业经营管理系统",
  "readyState": "complete",
  "heading": "业务一体化管理",
  "formCount": 1,
  "inputCount": 2,
  "bodyText": "金特夫\nKING TURF\n\n企业经营管理系统\n\n业务一体化管理\n\n销售、采购、生产、质量与财务协同\n\n企业账号登录\n\n登录金特夫\n\n请输入企业账号和密码\n\n登录"
}
```

导航响应：`/` Document200、`/assets/index-BJzBC5Vq.js` Script200、`/assets/index-DwuoPpOZ.css` Stylesheet200；favicon404非阻塞，保留不修。未记录 headers、body、query 或原始 CDP 帧；仅无登录静态页面快照，blockedRequests=0。preview绑定127.0.0.1:4173，最终脚本先确认空闲，再以 ss 验证监听PID=本次子进程；不借用或终止已有服务。

## 核验、诊断史与回滚

### 收紧后的正常与异常实测

正常run `kingturf-cdp-preflight-GgOcEG`：Windows PID31944、127.0.0.1:62774、preview PID1965769/4173；ActivePort第二行browser path与HTTP返回WS endpoint的path/port/ws/no-userinfo校验成功，Browser.getVersion154.0.8037.99。文档/JS/CSS200、title/heading及formCount1/inputCount2/loginInput=true/passwordInput=true；最终输出已去掉bodyText原文，避免未来误记敏感内容。preview exited=true、rootGone=true、profileProcessCount0、profileGone=true后才pass；真实exit0，日志 `/tmp/kingturf-cdp-final-preflight-2026-10-16.log`，DOM `/tmp/kingturf-cdp-preflight-GgOcEG-dom.json`。

额外中间正常run `84wrie`（PID47872/54270、preview1950096）真实0、同一版本/资源/DOM通过、清理全true，日志 `/tmp/kingturf-cdp-hardened-preflight-2026-10-16.log`；这是精确参数匹配最终收紧前的中间证据，不替代GgOcEG。

手动串行复跑：`node --test scripts/e2e-cdp/ownership.test.mjs`（无Chrome/不查真实进程；合成命令行的JS与PowerShell .NET regex七个正反例）及 `node scripts/e2e-cdp/lifecycle.mjs`（真实隔离Chrome、五项预期失败）。脚本诊断参数 `--fault-after-profile`、`--fault-lost-pid`、`--fault-after-preview`、`--pause-after-preview` 只用于生命周期验证，不是Chrome flags或业务路径，不注入真实账户。

| 最终负向case       | run后缀 | Chrome PID/随机端口                          | preview PID | 预期/实际退出及清理                                                                                             |
| ------------------ | ------- | -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| profile-init-error | 3gqhYL  | 未启动/无端口                                | 未启动      | exit1；profileGone=true，初始化中断也受finally保护                                                              |
| lost-launch-pid    | Sh28rc  | 启动实际23024，模拟丢返回后脚本未知/未查端口 | 未启动      | exit1；按唯一profile完整参数+exe回收，rootGone=null（未知PID不伪报true）、profileProcessCount0/profileGone=true |
| preview-error      | oz1AgQ  | 58928/58731                                  | 1965180     | exit1；preview exited/rootGone/profileGone=true、profileProcessCount0                                           |
| SIGTERM            | DplcQB  | 56308/54392                                  | 1965615     | signal被处理、最终exit1而非信号强退；全部owned资源回收                                                          |
| SIGINT             | qHqeYv  | 65624/49513                                  | 1965664     | signal被处理、最终exit1而非信号强退；全部owned资源回收                                                          |

最终负向汇总 `/tmp/kingturf-cdp-lifecycle-final-summary-2026-10-16.log`，逐跑完整日志 `/tmp/kingturf-cdp-lifecycle-1792128453707-<case>.log`，driver实际exit0/5通过，子进程均exit1/无stderr/无preflight-pass/无cleanup-failure。已知限制：信号在同步PowerShell或有界网络等待期间不会瞬时执行，最多等该步骤边界才清理，不称立即取消；无法回收则exit1并保留profile证据，不按全Chrome名kill。profile归属是完整参数边界正则+可执行路径+本跑随机目录，不是通用Windows argv解析器；七对照含相邻前缀/child/无关note，不触其他真实Chrome。

前一轮负向同样5/5，后续因归属从Contains收紧到完整参数而重复验证，历史未覆盖删除：run后缀 ld0B32/4XWTDc/y6Okqp/oc29Dm/tVRcK3，各case见 `/tmp/kingturf-cdp-lifecycle-summary-2026-10-16.log` 与 `/tmp/kingturf-cdp-lifecycle-<case>.log`；它们不用于宣称最终精确谓词已测。

最终静态独立reviewer已核对应新增归属谓词与cleanup调用点，无新的实质阻塞；协调亦复核异常/信号/endpoint路径。reviewer未执行浏览器或写操作，实际串行运行来自主代理。完整CI在稳定提交上另跑、实际结果随交接，不把预检/负向计入Vitest或Playwright。

lint接线真实注入：临时 `scripts/e2e-cdp/lint-probe.mjs` 引用未定义 missingLintProbe，根 `pnpm lint` 实际exit1且明确命中该文件/no-undef（`/tmp/kingturf-cdp-lint-injection-2026-10-16.log`），随后完整删除该临时文件；最终全CI将验证还原后根lint绿，不提交坏样本。

独立 reviewer 只读核验 uk9sG0 的实际通道/清理证据，提出握手无超时、preview误认已有服务、先报pass后清理三个复跑风险。Aoc7b8已实跑修后候选：8秒握手上限、4173空闲与owned PID校验、清理失败exit1且清理完成后pass。后续独立修后核验/提交HEAD完整CI结果交接另报，不用此局部预检冒充全CI。

失败史：规则读取首轮工具输出截断后分段补齐；读取不存在的 docs/FRONTEND.md 与 scripts/ci-local.mjs 返回1，仅文档定位误猜；授权记录补丁一次空hunk未通过校验、修后成功；新脚本首次eslint报 no-empty与no-unsafe-finally共3项，第二轮仍2项，均在浏览器执行前退出，未创建额外profile；改为注释重试与明确清理状态后eslint/语法检查0。上述不是浏览器通道失败，未隐去。旧sudo失败见原前置证据，未重跑sudo。

回滚：本通道代码/eslint目录登记/本证据及地图可独立revert至授权02d93f4；不撤ad0435e人工裁定、E1源码或31旧豁免。当前 Playwright 配置及九spec字节不动，全部保持未执行；**阶段5终验前须用户提供Linux Chrome/免交互安装权限后真实补跑全部spec**。

## 下一步覆盖边界（待实现，不能计通过）

| 里程碑 | CDP候选需覆盖                                                                                                        | 仍待Playwright/阶段5补跑                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 3a     | 合成身份、真实click/fill、桌面↔390×844、路由aria-current/非目标view不渲染、文本、document横向溢出                    | form/http/route/locale原单测与完整CI照跑；登录/真实API不是此静态预检已测 |
| 3b     | CRM筛选、workspace/input/menu节点身份保持、路由回切                                                                  | 原p1-demo 11 tests的真实API及业务台账证据，不被stub取代                  |
| 3c六组 | 21视图逐组route/text/设备/溢出，按组记录五类实际计数                                                                 | 对应原九spec业务覆盖逐项补跑，不称stub验证SQL                            |
| 3d     | roles合成权限可见性及拒绝映射，真实安全矩阵未覆盖                                                                    | production-role-uat按原环境条件真实补跑，未执行/skip不算绿               |
| 3e     | cost hold→quotes逐rAF/350ms无闪现、customer360 hold→costing不覆盖/菜单保持、customer360503局部alert；CRM筛选身份保持 | 原workspace-route-isolation 4 tests保持未执行，后续真实补跑              |
| 3f     | 畸形HTTP/storage parser与有效输入守恒，独立行为变更提交                                                              | 阶段5覆盖率/SQL/真实安全矩阵，当前未完成                                 |

统一数据策略确定为 **CDP Fetch全部/api/\* stub、未知API fail-closed、外域拒绝**，不混真实API，不触DB；合成身份/fixture不回显。五类探头需版本化harness另行实现与单独计数，不并入web114/API17099，启动一次不能当上述探头全绿。4/5/N+1修复/D1/其他BOUND/SEC未启动，评分不更新。

方法参考：[Microsoft WSL网络方向说明](https://learn.microsoft.com/en-us/windows/wsl/networking)、[Chrome独立调试profile要求](https://developer.chrome.com/blog/remote-debugging-port)、[CDP协议](https://chromedevtools.github.io/devtools-protocol/)。仅采用其本地回环/独立profile/协议说明，未执行文中网络或防火墙配置建议。
