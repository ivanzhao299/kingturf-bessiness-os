# P1 首轮失败与安全定位待核（2026-10-17）

## 实际首轮，不充绿

f56365c工具，P1仅openAuthenticatedWorkspace自然DOM登录候选，原11个测试正文从首test起全字节同；两config/业务源码/SQL/依赖/seed业务不变。独立只读review确认会话适配范围/原业务期待保持；未提交该spec候选，当前仍须定位失败及真变异。

精确命令：`NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs local p1 p1-first-round-1`，身份仅stdin，原P1 main Chrome/config，命令级traceoff按直接人裁。原同schema全seed实际0/3030ms，实际成本1 policy/2 rates/1 run/2 events/异人批准/关单检查通过。

PW真实close exit1/signal=null，耗时65088ms；固定discovered=11/complete=true，11例全部failed，各约5343–5515ms。host真实1/73640ms；owned schema/container/preview三清理true。安全日志`/tmp/kingturf-docker-p1-first-round-1-2026-10-17.log`及`.test-results/docker-local/p1-first-round-1/safe-events.jsonl`只留固定索引/状态/耗时/原case起始行。

原raw stdout/HTML/error-context/截图按[P1人类产物例外](playwright-p1-artifact-authorization-2026-10-17.md)仅容器tmpfs，已随owned容器清理，不读不导出。未留PNG/trace、未视觉验收；不能声称原失败截图已保留或凭raw定位根因。

## 待核与边界

当前safe line为测试声明行，不是失败行；均约5s只支持共同helper等待期望候选，**尚不证明登录成功、具体assert或lazy UI根因**。TD-TEST-016新增/56顶层项，只登记不改产品/原业务期待、不把auth迁移借机加导航/删商机阶段看板等待。

必要只读诊断工具增补failureLine：仅当Playwright `result.error.location.file`精确为固定P1/runtime spec路径时取整数行，否则0；契约再限0..10000，不读取message/stack/snippet、不导出path/raw。原case索引/状态与完成计数保持，0未知不能虚构定位。独立只读review无必要隐私阻断，unit含固定行61/foreign-file→0/越界拒绝；诊断重跑另记，非第二完整轮，不触原11业务断言。

Workspace字段/成本提示仍另待裁，P1若显露其它非S4期待须具体C7，原11失败不跳过。runtime独立首轮可续；全部A+B绿后才第二完整轮，C/生产/push/部署/workflow/一般阶段5禁，最终最后稳定干净HEAD实际完整CI必跑。

## 定位重跑中断（未完成，不充绿）

`p1-safe-location-1`同一原11例/无业务改动，同schema原seed通过；PW实际close=null/SIGTERM，host1/44424ms，未有完整local-result。owned三清理true，raw仍按人裁仅tmpfs已清。该次不能计完成/绿，也未拿到安全失败行，**中断源尚未知**，不凭SIGTERM断言是用户取消或relay故障。

仅增加无行为变更观测：转发器原socket错误/连接timeout/listener失败条件全部保留，只输出固定port/side/code枚举（其它OTHER，不读原message/流量）；安全reporter每例同步写临时partial，onEnd才complete，取消/nullclose仅报local-progress complete=false，不充当结果。5单测/原lint通过，待独立只读review/实际诊断；P1/rootcause与任何业务期待仍待核。

## 进一步只读 DOM 分类候选（未运行）

runtime原生接线/1例及Cookie omit红绿已完成，不以此抵P1失败。为区分已登录但非当前路由与认证失败，未提交P1 helper候选仅把原末heading断言原样置try/finally，finally只读固定shell/pipeline标题rect、hash是否overview、route属性是否opportunities；不读页面文本/表单值/Cookie/存储，不写导航/DOM/业务数据，原11个test正文全字节同。诊断失败归固定unavailable，无return吞掉原assert。

只P1固定annotation→reporter七个枚举（其它none）→contract同白名单，原错误/stack/路径不外发，原exit0/完成计数条件不改。unit新增raw annotation canary不转发，实际7/7；首新诊断title非空写法原prefer-optional-chain lint1，改等价可选链后最终lint/format0，无disable。独立只读review无必要阻断，强调phase只是finally时刻粗粒度快照，none也可能是未执行分支，不作根因定论。后继同11例只安全诊断，原C7范围/expect/timeout保持，不启动第二轮。
