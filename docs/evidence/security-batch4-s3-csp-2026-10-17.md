# 批次4 S3：CSP Report-Only 验证与边界

## 状态与授权

输入 S2 最终 `74c78c3`（实际干净 HEAD 全 CI 0/203898.679ms）。沿 [R7](../tasks/harness-batch4-authorization-2026-10-17.md) 与 [S3 设计](../tasks/harness-batch4-s3-design-2026-10-17.md)，只实施 TD-SEC-001 Report-Only 与默认关闭的强制开关；不部署、不 push、不改 workflow、不访问生产。S4 仅影响报告、实施前硬停人工确认；本次没有 Cookie/CSRF/Origin/sessionStorage/Bearer 协议迁移、CRM 业务或旧 360 夹具修改。异步确认中的 CRM 状态恢复与 360 unavailableSections 是已完成批次3的历史授权，不算本次改动。

| 提交      | 内容                                                  | 当时验证                                                         |
| --------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `10f841e` | 先行设计/行为登记                                     | 文档校验                                                         |
| `762e393` | 独立 API/config/外层 nginx 行为                       | 新 API 9/config 29，定向类型/lint/结构通过；未称该提交全 CI 通过 |
| `a4c2ca3` | 独立旧 oracle 映射及证明                              | 68 文件81头对象只加 CSP；122旧 API 文件逆去 CSP 后完整 AST 相同  |
| 工具候选  | opt-in 本地 HTML collector、合成发送及本地 nginx 验证 | 下述定向实测；源码实际干净 HEAD 全 CI 待执行                     |

完成文档的独立提交及实际干净 HEAD 全 CI 也尚待执行；此处不预填成功。SEC-001 只完成 RO 段候选，不关闭未来强制生产段；台账仍48，TD-HYG-002只登记不修，评分不提前上调。

## 行为与部署边界

公共策略在 `packages/config/src/csp.ts`，API 完成响应始终加 `content-security-policy-report-only`；`CSP_ENFORCE` 严格布尔、默认 false，仅显式 true 才额外加同策略强制头。server 的独立安全选项不扩大业务依赖端口，原配置验证顺序、S1 三头、S2 限流、body/status/correlation/telemetry 保持。

外层 `infra/nginx/erp.kingturf.cn.conf` HTTPS `location /` 隐藏上游两个 CSP 头并统一一个 RO。文件独立开关默认 off，与 API 环境变量不同；API=true/outer=off 仍只有 RO。内层 nginx 未改，直连内层 HTML 没有 CSP；内层各 location 的 Cache-Control 不妨碍外层加头。HTTP301/ACME、真实 host TLS、外层自产502未验证。既有 workflow 不安装/reload host nginx，仓库改动不代表生产生效；本次不运行部署动作。

没有 report-uri/report-to/接收服务，只有本地浏览器事件采集，不能称生产观察通道就绪。策略不加 unsafe-inline/unsafe-eval 或广域来源，仅 img 放品牌 data:image 需求。打印 popup 的动态 inline style 已知但本次未打开打印；发送 modal 中 CSSOM 分页有执行，不是打印全覆盖，也不是强制兼容证明。未来须完整发布周期真实观察及新人工授权才能考虑强制。

## API、严格 oracle 与保护区

- 新 API9、config 原23+新6=29。定向 app51+security helper3+S2 HTTP7+CSP9=70 实际通过。新 API 的无依赖未知路径保留503，不能冒称404；真404由旧 app 用例保留。
- `scripts/analysis/csp-oracle-check.mjs --baseline 74c78c3 --target SHA` 只输出元数据；[逐处映射](security-batch4-s3-oracle-map-2026-10-17.md) 为68文件81对象，涵盖 S1 的65/76及 helper/S2 429。独立字面量而非生产 helper 构造期望；完整122旧文件的所有 AST 子节点逆去唯一 CSP 字段后等同。S1 固定 b02ad55→59f9dfa 历史工具未改，不假称其默认目标适用于 S3。
- 实际移除 RO 头变异9红，恢复后70绿；旧无头实现9红。实际无关断言变异被完整 AST 工具抓住，恢复后证明绿。
- whole app/server 逆去唯一安全参数/传参后完整 AST 相同；config 测试去3新增 AST 语句后旧23相同；`.env.example` 原字节前缀不变、仅追加公开 CSP 默认，compose 仅一个公开默认透传行。
- 相对74c78c3，`apps/web`、database/domain/types、锁文件、workflow、preview Dockerfile 与原 Playwright 配置/spec 均无改动。源/构建入口 import 不启动 server、不开端口、不解析真实环境。原11 TS spec（本地9命名+production2）及 runtime-local MJS/两配置未本次执行，阶段5前 Linux Chrome 补跑义务仍在；不为验证访问生产。

日志：`/tmp/kingturf-batch4-s3-{csp-old-red,csp-green2,config-green,api-restored-final,csp-header-mutant-red,oracle-mutant-red,conservation}-2026-10-17.log`；证明 `/tmp/kingturf-batch4-s3-oracle-proof-2026-10-17.json`。日志名为便于定位，不要求旧证据在新环境永久存在；可从固定提交重算。

## CDP：真实本地 HTML 与严格合成发送

`preflight.mjs --csp-observe` 独立 opt-in，默认入口/原 fixtures/probes 不改。test-only preview 给真实 built Document RO（无 API proxy），先开启 Runtime/binding、安装新文档 collector 再首次导航，网络独立核 HTML 头相等且无强制头。临时 Chrome profile/随机回环 CDP/4173自有预览，保留未知请求及全部非允许写 fail-closed，不加浏览器安全绕过旗标。

collector 两端投影，directive/disposition/phase 有限枚举；URL 仅固定 loopback-document/static/api/other、external-http、data:/blob: 等类别，绝不保留原 origin/path/userinfo/query/hash。没有 token/sample/inline代码/完整报告；每文档1000、Node接收2000、样本100、计数饱和上限。phase 是事件到达时标记，不保证严格因果归属。

新 fixture 使用每跑临时随机密码/opaque token，不打印或持久化；真实 DOM 登录→工作台→打开 APPROVED 合成文档→点击发送→精确 connector GET→填表→精确 UUID/send POST。实际 method/url/headers/postData、精确字段、首次绑定 UUIDv4 幂等键均校验；权限仅读/发送，不把旧草稿夹具改成可发送。独立 network 断言202，DOM另断任务ID/排队状态，不称已送达。无真实 API/PG/邮件外发；不预置 sessionStorage、不用直接 fetch 代替真实点击。

| 实测                   | 日志（`/tmp/kingturf-batch4-s3-` 前缀） | 结果/口径                                                                                                                   |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 原基础7，`tsLzM3`      | `cdp-original29-2026-10-17.log`         | 名称有历史误称，实际仅7，不计作29                                                                                           |
| 原完整29，`Us0W3d`     | `cdp-original29-full-2026-10-17.log`    | 实际退出0；DOM80/viewport47/route69/text142/overflow56，网络三零/自有清理全真                                               |
| CSP3，`4Lyd6t`         | `cdp-final-2026-10-17.log`              | 实际退出0；DOM18/viewport1/route2/text3/overflow1；login/session/connector/send各1，独立send202=1；Document1，事件总1/drop0 |
| 无 collector，`tG6nhE` | `cdp-no-collector-red-2026-10-17.log`   | 实际退出1，真实登录与发送先成功，但无真事件哨兵被拦；自有清理全真                                                           |
| 多余写，`i9JQKA`       | `cdp-extra-write-red-2026-10-17.log`    | 实际退出1，unknownApiRequests=1，未知POST硬闸生效；自有清理全真                                                             |

成功事件仅 `sentinel:script-src-elem:report=1`：故意插入 inline script 确实执行且浏览器真实事件确实采到；非伪造 dispatchEvent。有限正常阶段本次零事件，不推广为“全部业务零违例”。首正向 `6mvMIe` 在独立 Network202 计数补齐前，只算早期成功，不与最终证据混用。最后 UUIDv4 版本/variant 约束收紧后的实际提交后正向仍待记录。

65 工具单测（原34+observer8+send20+nginx client3）已实际通过：`/tmp/kingturf-batch4-s3-tools-final-2026-10-17.log`；新精确 fixture 缺字段/错误key/未知写等负向，不改旧34断言。原29命令：

```sh
node scripts/e2e-cdp/preflight.mjs --probes --sales-views --pricing-views --credit-contract-views --fulfillment-views --finance-risk-views --operations-views --dashboard-view
```

## 本地 nginx 矩阵与清理

仅已有 `nginx:1.28-alpine`、`--pull never --network none`，不发布 host port、不拉镜像/构建/装包/host nginx/TLS证书。外层配置片段换本地地址，合成 upstream 控制两个 CSP 头及 Cache-Control。API头flag×outerflag四组合，每组 `/`、index、asset、API、upstream503 五条：20项断 RO恰好1、强制仅outertrue、Cache-Control/status守恒。它是合成 upstream header矩阵，不冒称实际 NodeAPI+inner完整集成；实际 API由单测、built HTML另由浏览器证明。

每次随机容器名及精确 owner label，syntax/runtime **运行前**登记；不依赖启动回执成功才清理。逐名 inspect exactlabel 后删，仅匹配严格 Docker not-found 才当不存在；所有权/inspect/rm失败传播且报名称/status元数据，继续尝试其余自有名。目录 finally独立清理。正常每组 attempted2/removed1/notFound1/directoryGone=true。故障 `--fault-start-result` 真实启动后模拟未知回执，实际退出1且自有 runtime仍删除、目录清理；不是只测未启动路径。

HTTP client 持续写开 stdin 防 BusyBox nc EOF 提前退出，stdout16KB/stderr2KB上限；5秒超时尝试SIGKILL后独立settle并销毁stdio，不依赖close；成功路径另断Docker CLI status=0。三个真单测用kill返回false且永不close的假子进程验证超时/超量/正常；只证明Promise有界/迟到事件无影响，不声称kill成功或真实CLI必然已退出。同步Docker操作15秒/SIGKILL。不是无限等“工具清理成功”；清理失败即明确失败，实际容器/目录清理另列元数据。

先前健康20日志 `nginx-final-verified-2026-10-17.json`/`nginx-final-verified-cleanup-2026-10-17.log`；实际未知启动回执故障 `nginx-start-fault-red-2026-10-17.{json,log}`。严格超时修正与CLI status=0断言后的最新20项实际退出0：`/tmp/kingturf-batch4-s3-nginx-cli-zero-final-2026-10-17.json`，四组owned清理全真（同前缀`nginx-cli-zero-cleanup-2026-10-17.log`）。最新未知启动回执故障实际退出1、attempted2/removed1/notFound1/目录消失：同前缀`nginx-bounded-start-fault-2026-10-17.{json,log}`。

## 失败史与未覆盖

1. 新API测试初次7绿2红是测试夹具错误：无依赖未知路径预期误写404、correlation非UUID；只改新增测试，未迎合测试改业务。旧无头实现红、去头变异红均独立保存。
2. URL最初只去query/hash还保留path/origin，独立审发现可泄露身份片段，实际负向红后改固定类别，两端投影；不把旧候选称脱敏合格。
3. 初版 wget 在503不输出所需头；换同步nc后另有空响应红，EOF提前退出只是候选原因，未确证。改异步nc保持stdin后多次20绿。初版超时仅SIGTERM/等close被独立审判为非严格有界，已抽独立client并增加永不close反例；这是静态缺陷，不冒称曾实际挂死。
4. 初版清理若rm抛错会跳目录、未知启动回执可能漏容器，均独立审后按上节修正；真实启动故障反例清理绿。初版工具AST6，抽header/cleanup helper后降5，无豁免。
5. 显式 prettier `.env.example` 无parser退出2，排除此非支持格式后重查；若干patch锚点不匹配原子无写后重试，诊断路径拼错一次，无业务变更。
6. 输出卫生：初版oracle `--patch` 与一次旧fixture宽搜索曾把过多旧合成夹具内容送工具输出；已告知、无真实secret读取/生产接触，不在证据重述值。现工具拒绝--patch，只输出计数/布尔，避免重复输出夹具/头值/连接串。
7. 工具提交首次被pre-commit lint拦（8处：浏览器document全局、测试空report及未用解构变量），未绕过hook；改为globalThis.document、显式undefined回调及delete sample后lint0/65单测重绿，日志`tools-eslint-{red,green}-2026-10-17.log`。一次纯元数据诊断Node命令多余括号语法退出1，修正后读取故障清理元数据成功，未修改被测对象。

最终容量实测（split行数/完整最长函数/AST深度）：config CSP 13/8/2、config index 127/70/2、安全头helper 24/21/2；新collector203/121/4、send fixture169/122/4、send probes98/88/4、nginx client56/52/4、smoke247/34/5，日志 `/tmp/kingturf-batch4-s3-capacity-final-2026-10-17.jsonl`。新MJS是人工复用AST度量，不冒称已纳入TS结构门禁；既有preflight存量体量不在这张新模块表内，无新增豁免。

本次不覆盖全部写安全矩阵、打印popup、真实报告接收端/生产观察周期、真实外层TLS/自产错误、其他API限流、S4或Playwright；原有债务不顺手修。没有SQL/新依赖/结构G3白名单扩大。

## 回滚与停点

按最终后继文档→工具→`a4c2ca3` oracle→`762e393`行为→`10f841e`设计逆序配套 revert，先检查实际依赖与自有变更，不自动执行。保留S1/S2及各自历史回滚链；不能只撤行为而留严格新期望。API `CSP_ENFORCE=false` 与外层off只撤强制，不撤RO，也不能互相替代。无DB迁移/数据回滚/生产操作。

源码候选提交和完成文档各实际稳定干净HEAD完整CI0后停止交协调复核，不以中途定向绿代替。S4报告另依协调步骤推进；任何S4实施仍硬停人工确认。
