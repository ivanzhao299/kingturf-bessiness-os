# B 本地私有执行器验证记录（2026-10-17）

## 授权/当前范围

按[直接P1人裁](../tasks/playwright-p1-artifact-authorization-2026-10-17.md)及[接线设计](../tasks/playwright-local-private-runner-2026-10-17.md)，独立`local p1|runtime label [privacy|interrupt|interrupt-stop]`。只环境/安全观察工具，不改原两config/产品/依赖/种子业务。当前仅候选静态检查通过，隐私/取消探针和真实B尚未运行，不预记成功。

复用原宿主guard/marker/PG只读同实例→owned API/preview回环；P1同schema原完整seed，身份/guardURL仅stdin传容器。B root/repo只读、声明两tmpfs、无Docker raw日志，拒额外持久可写volume/bind；系统特殊mount另有/dev/shm等，不声称只有两处可写。XDG五路径/TMPDIR/Chrome日志/tmp，原始stdout/stderr0600/HTML/error/截图仅临时文件系统。宿主仅固定字段双层重编码，不导出raw/PNG；原截图实际代码保持但证据未保留/未视觉验收。RAM/swap/虚拟化物理零落盘不保证。

## 静态与独立review

`node --test scripts/e2e-docker/private-contract.test.mjs`实际5/5，含精确local/C隔离、固定11/1原case清单、raw错误/标题/附件不转发、索引/状态/时间校验、0 exit缺发现/complete/用例或有失败均拒绝。观察reporter同步收case，异步onEnd写安全summary，错误/未知test令complete=false；子进程真实close、全发现/完成/无重复/全passed才可正常0。host另绑定固定CLI kind/label、probe↔明确privacy参数，非probe须先观察一次真实close/无signal且exit匹配，拒重复result。600s外层有界，原每例timeout/worker/retries保持，覆盖P1固定11×30s加初始化余量。

原`pnpm exec eslint scripts/e2e-docker/*.mjs`、相关Prettier、diff-check最终0；structure-gate0/29原豁免保持。初取消故障注入直接throw在finally被原no-unsafe-finally拒1，改用固定assert注入，不disable规则。

独立只读review初审三处必要收紧已实施：B stop失败不得跳过精确rm，后独立docker ps exact-name核空才报清理；探针不得冒充普通B成功；本地seed失败只固定stage/status不转动态path。额外建议已收紧local宿主异常只报固定phase，A原诊断保持。B`interrupt-stop`用于固定注入stop分支错误后验证实际强制移除；尚未执行，不声称已清理。外部Docker rm/确认失败会安全停报并保schema供检查，不伪报gone。

父bd7e14d为本工具回滚点；P1/runtime会话候选另在工作树，不纳入本工具提交。下一步先固定非秘密privacy探针/只读失配真变异/取消故障，再真实B逐文件及会话真变异；C/第二轮/业务失败原边界保持。最后稳定干净HEAD实际完整CI仍必跑。

## f56365c 动态隔离/故障探针

命令：`NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs local <kind> <label> [fault]`。无真实.env读取，参数中无密码/DSN。每次guard→同实例/marker只读通过（只读失配变异在发送身份前拒绝，故无pg-verified/API初始化）；独立label防覆盖，宿主只保存safe-events。

| kind / label / fault                              | 实际结果                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| p1 / local-privacy-positive-1 / privacy           | 固定非秘密raw+HTML canary只容器tmpfs，probe=true/complete=false/0case明确非spec绿；host0/5707ms                                   |
| p1 / local-root-rw-red-1 / privacy                | 真源去Docker只读root选项，实际容器配置检查在gateway阶段拒绝，host1/741ms，无身份发送/API初始化                                    |
| p1 / local-root-ro-restored-1 / privacy           | 完整清理后立即还原，probe0case再过，host0/5289ms                                                                                  |
| runtime / local-interrupt-stop-1 / interrupt-stop | 实际PW子进程spawn后SIGTERM取消，固定stop错误注入，仍实际force rm并独立exact-name ps核空；host1/5310ms，不算完整spec/无case result |

各次owned schema/container/preview最终三清理true。取消时未收到leader close事件，不能称观察到PW进程组自行drain；确认的是强制移除owned容器/namespace及其tmpfs成功。safe-events文件实测0600/目录0700，固定canary不在该安全文件，宿主对应`.test-results/private/canary.html`不存在；不泛称扫描全宿主或RAM/swap零材料。

真实源把case输出改为展开原reporter对象，非秘密canary单测实际1/4过1败；完整结束后立即还原，5/5/exit0，原lint/diff0，工具源码与f56365c同。该变异只unit边界，不计浏览器case。日志`/tmp/kingturf-local-private-raw-red-1-2026-10-17.log`及各`/tmp/kingturf-docker-<label>-2026-10-17.log`保留安全输出，不保raw产物。

P1首轮随后启动、同schema完整seed实际0/3030ms及成本计数检查通过；此时浏览器11例仍运行，尚不记绿/不记完成。runtime正常首轮尚未执行。各probe不是第二完整轮，成本/Workspace原待裁失败不消除。

## P1 首轮后继与安全定位字段

上述运行后继已完整结束：PW1/65088ms、close signal=null、discovered11/complete=true/11 failed，host1/73640ms，owned三清理true。[真实结果/未留raw限制](../tasks/playwright-p1-replay-blocker-2026-10-17.md)。TD-TEST-016/56项，不能以种子绿替代浏览器绿。

为不导出raw而定位，安全reporter仅新增failureLine：错误location精确固定本spec路径才取正整数，否则0；契约再限0..10000，不读message/stack/snippet或外发路径。unit5含正确固定行/外路径0/越界拒绝实际通过，独立只读review无必要隐私阻断。只安全诊断字段提交，不改业务/原config，不声称该字段本身证明因果；同文件诊断重跑待执行。

32bb2b4后的`p1-safe-location-1`实际PW close=null/SIGTERM、host1/44424ms/owned全清，无完整local-result、不算完成/绿，中断源未知。原onEnd才落summary，取消时失去已结束case定位；后继仅同步逐例安全partial（writer可注入，unit不写宿主临时文件），onEnd才complete，取消/nullclose也可固定local-progress/complete=false；原成功完整性检查不降。

另给forward加固定observer，原错误/timeout/listener全局失败条件和byte pipe保持，仅port4173/5432、side及固定errno枚举/OTHER传宿主白名单，不输出原error/message/地址或流量。该观测尚未实际复现原因，不把旧中断改写成已证ECONNRESET。原unit5/lint0，后继诊断另实际记；无产品/config/P1期待变化。

首只读review因模型容量失败，不计已审；复用另一独立reviewer后窄diff无必要阻断。其指出主动closing期间也可能产生socket错误，事件不能单独证明先前中断来源；据此仅加closing布尔并在host校验，未改失败条件，诊断须区分清理期间事件。partial/取消守卫经只读复核不会充绿，后继实际运行再验证。

## 实际诊断与 reporter options 缺口（TD-TEST-017）

43047ec后`p1-safe-location-2`原seed0/3158ms，实际安全事件为port4173/upstream/CONNECT_TIMEOUT/closing=false，随后PW close=null/SIGTERM、local-progress discovered0/complete=false/cases[]，host1/41330ms，owned全清。不算完整/绿；这不是RESET证据，不实施peer-reset容错候选，且不能回写旧SIGTERM来源已证。一次尝试只读当前安全partial时容器已不存在，目标存在断言拒绝，未读任何raw/fixture/认证数据；不算测试绿。

另从已安装Playwright1.62.1官方源码`lib/runner/index.js:4916–4917,4925–4926`亲核：框架会`new reporterConstructor(options)`。43047ec新增`PrivateReporter(writer=writeFileSync)`把此options对象当writer，实际持久化会非函数；旧无构造器的f56365c完整11例全败记录不受此新增缺口影响。故43047ec此次0项partial不是“已证没有执行case”，而是安全观测不可用，不能给真实发现数作假。

先登记TD-TEST-017/57顶层项；新增直接用`new PrivateReporter({})`的原生调用形状回归，实际unit exit1/5过1败，日志`/tmp/kingturf-local-private-reporter-options-red-1-2026-10-17.log`。这属于本轮已授私有执行器自身兼容缺口，不借机修产品/业务期待；下一步仅分开options与unit writer参数、还原其它语义，独立提交/真实回归。当前未修、不充绿。

ed614ba红例独立后，最小改为`constructor(options={},writer=writeFileSync)`：真实PW首参核为object但不作writer，默认真实fs writer；unit显式第二参注入，其它持久化/安全字段/完整性/失败规则不改。首 `_options` 未使用候选虽6unit过，原lint1/pre-commit拒绝、未提交；改显式核原生对象契约不降规则。原生形状回归由红转绿，最终实际6/6、原lint/format/diff0；真实PW接线验证仍待runtime/P1实际跑，不以unit替代。独立只读核调用兼容无阻断，不据其代替lint；仅TD-TEST-017修正候选，尚不提前关闭实际验证项。

## runtime-local：真实首轮与已授会话 oracle 迁移

6fe9ef5工具后，依4e691e5三文件人裁，仅原旧storage Bearer拒绝探针改浏览器自然同源Cookie fetch，仍403/无items；原匿名page.request改独立`request.newContext`，只baseURL/无storageState/无额外headers，finally dispose，仍401。原真实页面登录、客户创建/读取、DB持久化和audit尾部全字节同，guard/公司/两config/无mock/原trace-screenshot off不改；runtime仍原bundled Chromium配置，不把main Chrome版本冒充它的另采实测版本。独立只读review无必要阻断，原lint/format/diff0。

命令同上，kind=runtime，各独立label：

| label                          | 实际PW；host                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| runtime-first-round-1          | 原1例通过，PW0/1965ms、case772ms；host0/8313ms                                                                                                                                                               |
| runtime-cookie-omit-red-1      | 真源仅AR fetch加credentials:omit，原403断言红/failureLine54，PW1/1613ms；host1/6992ms；只留整数定位，不读raw Received值                                                                                      |
| runtime-cookie-restored-1      | 完整close/清理后还原，原1例通过，PW0/1742ms；host0/7481ms                                                                                                                                                    |
| runtime-shared-anonymous-red-1 | **额外变异未检出**：将独立anonymous改共享page.request，实际1例通过/PW0/1740ms、host0/8013ms，不因label叫red就计红；该通道浏览器与APIRequestContext对Secure回环HTTP的派送差异仅候选，未读Jar/头或证明具体原因 |
| runtime-anonymous-restored-1   | 完整close/清理后还原独立context，原1例通过，PW0/1701ms；host0/8680ms                                                                                                                                         |

各轮真实close signal=null、discovered1/complete=true，最后原case通过意味着原客户持久化/同公司/审计及Cookie403/独立匿名401断言均通过；owned三清理true，原raw/图仅tmpfs已清未导出，不称留有失败截图。无需为额外共享变异硬造红：原契约每文件至少一项真实红，已由Cookie omit满足；预告过的浏览器替换匿名额外变异未实施，不改其它assert。该未检出与分辨能力边界如实保留，不能称其验证了独立Jar隔离负例。

原生PW实际加载/onBegin→cases.json→onEnd现已用正常完整1例实证，不仅unit；TD-TEST-017只reporter兼容实施项关闭，57顶层ID含历史保持。runtime会话迁移/每文件真红绿完成，父6fe9ef5为该spec独立回滚点。A六份全绿/成本与Workspace各一败，B runtime绿/P1原11败仍待安全诊断/裁定；第二完整轮禁/C禁，最后稳定干净HEAD完整CI仍必跑。

## P1 固定 DOM 分类安全字段

9ee083c后，仅安全case字段增phase七个固定枚举，runtime/无标记为none，任何外来annotation内容折叠none；controller/host沿同契约再重编码，不导出原描述。unit新增annotation canary及非法phase拒绝，实际7/7/原lint/format0。P1 working helper只读finally分类说明见[诊断范围](../tasks/playwright-p1-replay-blocker-2026-10-17.md)，未包含在本工具提交；原断言/11 test正文/成功完整性保持，独立只读review无必要阻断。字段只是粗快照，不是因果证明/新增业务oracle，尚未实际P1复跑。

## P1 DOM 诊断实际结果与停点

8b21715工具实际 `local p1 p1-dom-location-1`：discovered11/complete=false，3 completed failed，index0/1 failureLine19、phase overview-board-hidden（5407/5404ms），index2 failureLine19、phase unclassified（5388ms）。随后active upstream4173 CONNECT_TIMEOUT/closing=false，PW null/SIGTERM，host1/27929ms，owned全清。安全文件仅固定枚举，raw/PNG未导出已清。不计完整11或绿；前两例只支持原helper路由可见性不符，第三与其它例原因未知，不把粗快照当因果证明。

[P1阻断与精确候选封存](../tasks/playwright-p1-replay-blocker-2026-10-17.md)记录原文件恢复及补丁SHA；本轮停止该spec，TD-TEST-016等待非S4可见性oracle裁定，TD-TEST-018通道超时只登记不放宽。runtime真实原1例/至少一真实变异红绿有效；第二完整轮未开/C禁/零PNG非视觉验收，最终稳定干净HEAD全CI另实跑。
