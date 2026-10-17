# Docker 单 spec 回放证据（2026-10-17）

**文档发送后继**：原7项auth候选全过，真实旧token变异2败5过→完全清理后还原7过；原strict ESLint旧8错经本会话人类[独立R7](../tasks/playwright-document-lint-authorization-2026-10-17.md)仅最小机械修正，擦除类型除一个未使用void返回的块体外JS全字节同、47expect调用/参数同；机械后原7项再次通过。成本TD-TEST-013仍失败待裁不动，余5A/2B未执行，第二轮禁止；详情见末节。原全A额外tsc旧诊断仍2，不因lint修正写成全A类型绿。

**后继现时**：f3882a3干净HEAD完整CI实际0/201874.74ms后，成本仅auth候选PW1/12294ms、host1/17663ms、1通过1失败。原最后提示不可见、前URL/dialog/decisionId过；[C7事实/trace脱敏/候选与待裁](../tasks/playwright-cost-handoff-blocker-2026-10-17.md)。成本候选已精确还原未提交/未算适配变异完成，失败附件保留。当前login2过、cost1过1败、其它6A/2B未跑、C禁、未第二轮；下方“其它未执行”为原时点。最后文档HEAD完整CI另实跑，不等于PW全绿。

## 基线和环境执行器

成本小步 `12285318f7756b20d446d45523661eac150d1f6a` 已实际稳定干净HEAD完整CI0/202370.62ms，首尾同HEAD、unchanged/clean=true，日志 `/tmp/kingturf-docker-p1-cost-1228531-head-ci-2026-10-17.log`。API126/17242、Web14/313、无已知漏洞；此CI不是浏览器补跑。

本步沿[原R7](../tasks/playwright-docker-authorization-2026-10-17.md)和[增量R7](../tasks/playwright-docker-rulings-2026-10-17.md)只增加必要环境执行入口：

- `preflight.mjs spec <A文件名> <唯一标签>`；原宿主guard/marker→容器只读同实例核证→owned API/preview后才执行，真实容器127.0.0.1字节转发，镜像/Chrome/配置同原通道。
- `spec-runner.mjs`明确A8精确白名单；B2/C2/未知路径与不合法标签实际断言拒绝，不允许全目录发现。启动原Playwright CLI/原主配置/单worker/retries0，只用CLI独立output和HTML目录隔离证据，标签已存在即拒绝，不覆盖红绿史。stdout/stderr只存该本地结果目录，父进程只输出spec/label/真实exit/耗时。原retain-on-failure trace/截图保持；A用合成会话，不放真实认证材料。原网络stub边界不扩大为全部硬闸。
- 取消信号终止owned Playwright进程组、3秒后强制终止；先drain后清理容器/preview/schema。主机10分钟协作deadline，不称任意OS挂起都可有界结束。退出非0原样使容器/宿主非0。
- `tests/e2e/tsconfig.json`仅给A8/合成helper接现有strict TypeScript工程，沿已有browser配置和已安装API node types；原spec无法被ESLint project service找到的真实错误已确认，接线后原login spec ESLint实际0。无新依赖/规则放宽，不改两份Playwright配置，不执行C文件。

新增的手动 `pnpm exec tsc -p tests/e2e/tsconfig.json --noEmit` **实际exit2**：旧冻结 `document-send-product-quality.spec.ts:154` 把 `headers()['idempotency-key']` 的string|undefined推入string[]。不改该业务断言、不加非空断言/默认值、不放宽noUncheckedIndexedAccess。独立只读确认此额外全A tsc不是原根CI的lint/typecheck门禁，也未证明阻断Playwright；登记TD-TEST-012仅静态候选，若实际阻断原hook/补跑则C7，不声称全A类型通过。原hook/最终CI仍须照跑。

环境白名单断言已通过；实际spec执行/逐处适配/变异/首轮与第二轮仍待下列逐项补记，未运行不填绿。仅fixture/已授三文件oracle可改；其它形状/业务失败C7停报。原[全12份库存](playwright-docker-inventory-2026-10-17.md)、C禁跑与旧延期义务不变。

回滚：本环境小步父1228531，逆序撤后继适配再撤此入口/类型接线，先核相邻依赖；未实际revert。最终最后稳定干净HEAD完整CI另执行，不把前成本CI充后继CI。

## 执行器真实运行与取消窄补记

环境提交e871a8d后，用下节合成登录适配工作树实际执行原spec。第一次label `login-adapt-green-1`：PW1/2701ms、host1/8324ms（1失败/1通过），CDP addCookies的HTTP URL与\_\_Host Secure组合无效；**不是通过**，失败HTML/截图/trace均在 `.test-results/docker-pw/login-adapt-green-1/` 独立保留。夹具改显式host/path后 `login-adapt-green-2` PW0/2348ms、host0/7615ms，2通过。首日志root0600宿主不可读，仅对该精确生成文件恢复0644；后继A日志创建0644以便本地验收读取，仅本地受控目录/纯合成材料，不扩到真实认证B或公开托管。

执行器窄修：异步mkdir/open后spawn前再次检查abort；记录原leader close的exit/null与signal后再传播中断，保留原非零，不把leader.close当整组空。原3秒KILL定时器在leader close后清除，最终owned容器精确删除是后代进程的兜底边界。

真实故障命令为同一入口追加 `interrupt`，label `login-owned-interrupt-1`：真实PW spawn发安全spec-started后才给host SIGTERM。`/tmp/kingturf-docker-login-owned-interrupt-1-2026-10-17.log` host实际1/5592ms；子日志末行owned-playwright-close exit=null、terminationSignal=SIGTERM。container-failed后schemaGone/containerGone/previewGone全true，随后实际Docker本task label列表为空。只证明本受控取消路径，不称任意OS挂起或leaderclose即排空。独立只读复核无必要阻断，未执行额外PG/测试。

实际核 `.test-results/docker-pw/login-adapt-green-1/html/index.html`、独立artifacts下test-failed-1.png/trace.zip，以及generation红的独立HTML/同类附件均存在；没有拿默认报告目录或覆盖旧红。具体登录适配/变异结果下节补记，环境窄修与fixture独立提交。

## login-product-quality：会话夹具独立适配

基线60ab881。只替换原两处auth stub/补冷启动夹具；原session员工/权限、两次180ms延迟、loginRequests计数、导航/进度/防重复提交/密码清空/错误断言不动。AST实际比较原9个expect完整表达式相同，两测试从page.goto起的操作与断言全部字节相同。没有因新协议修改产品源码/业务断言/配置。

| 旧位置/行为                                     | 新夹具映射                                                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| login原15–23：token登录、普通DTO session始终200 | `installSyntheticLogin`初始restore401；只有用户提交后login-context合成proof→POST login合成expiresAt/generation/csrf→restore完整原员工DTO+proof。登录及后续restore仍各180ms、请求计数只在POST login增加。                                                  |
| login原40–45：仅login401                        | `installSyntheticColdStart`补初始restore401/login-context；原login401的payload与所有错误/密码/UI断言原样。                                                                                                                                                |
| 新共享helper                                    | `tests/e2e/fixtures/browser-session.ts`只做合成协议形状/显式host/path合成Cookie；未识别auth路径abort，绝不触真实本地auth。断言intent/POST/login csrf接线，generation43/新session形状，不伪造真实API授权证据。原各业务route stub边界不扩大为全部网络硬闸。 |

逐spec真实命令：`NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs spec login-product-quality.spec.ts <label>`；容器实际执行原CLI单文件 `--config=playwright.config.ts --output=.test-results/docker-pw/<label>/artifacts`，原Chrome/worker/retries/trace/截图不变。日志 `/tmp/kingturf-docker-<label>-2026-10-17.log`，PW原始log/HTML/附件在上述同标签目录。

| label                         | 实际PW结果/耗时；host结果/耗时                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| login-adapt-green-1           | 1失败/1通过，exit1/2701ms；host1/8324ms，新增Cookie字段错误历史，非变异通过证据                        |
| login-adapt-green-2           | 2通过，exit0/2348ms；host0/7615ms                                                                      |
| login-helper-generation-red-1 | 真实helper源generation43→42，原成功登录断言红；1失败/1通过，exit1/7623ms；host1/13117ms                |
| login-helper-restored-1       | 立即还原43；2通过，exit0/2415ms；host0/8123ms                                                          |
| login-spec-old-token-red-1    | 真实login spec传入会话额外旧token字段，客户端严格restore拒绝；1失败/1通过，exit1/7619ms；host1/13086ms |
| login-spec-restored-1         | 立即还原旧token变异；2通过，exit0/2305ms；host0/7673ms                                                 |

真实红均原断言失败且保留截图/trace/HTML；最终helper=43、session无token，变异不入库。每次host guard/容器只读同一性先通过，owned三清理全true；两次红不是改期望/跳过/重试刷绿。原hook ESLint实际0；额外全A tsc旧诊断仍如前，不宣称全A类型绿。API/Web全量和最后干净HEAD完整CI在本适配提交后另实际执行。

仅此文件首轮候选已绿（2测试），不是A8全绿；其它7A/2B未执行/未适配，C2不改不跑，第二完整轮未开始。父60ab881为本夹具适配回滚点；共享helper与本spec一起回滚，后继消费者先撤，保留工具/成本独立链。

## document-send-product-quality：会话适配及获准机械兼容

父ba294ae人类R7，原始人类消息本会话直接收到，协调后亲核01a148a2-7e6a-7e80-a135-1a9652b3ec90，非协调代授。独立只读复核无必要阻断。

会话只把原openDocument的旧storage init换 `seedSyntheticCookies(page)`，原auth/session DTO包 `sessionResponse` 添加合成generation/csrf；保原员工、权限、文档/connector数据、全部业务route mock及断言。该spec原catch-all API合成响应保持，不进入真实API，mock Jar不是服务端Set-Cookie/授权证明。

机械范围仅原8处：两个已测量locator用MeasuredLocator类型投影保原非空假设，去6个box!，不加null分支；单一合成connector路由的ConnectorRoute类型投影给postDataJSON().expectedVersion静态形状，原expect参数/0保持，不加运行时schema/any。requestSubmit原生void回调仅块体，原一次调用、异常及undefined结果不变；调用方仅await未读返回，不称任意猴补方法返回值都可观察等价。

内存transpile实际通过：除上述唯一void arrow形态，其余生成JS逐字节同；47个expect调用/参数AST全同，统一原arrow后的运行SHA256 `aab364b24e910e64f3861a1e3a83984f83ff3697ddf303d21d2b1c214e388f3a`。这只证明擦除/该局部void等价，不是新增业务校验。初次比较命令的shell引用破坏输入而失败，后改UTF16 hex传值，不回显源码/assertion值；不是实际源码行为差异。直接as NonNullable候选曾被原style规则拒2错，最终改类型投影，规则未放宽。

原 `pnpm exec eslint tests/e2e/document-send-product-quality.spec.ts` auth候选实际1/8旧错；内存lint原bd7e80b源码实际1/9（多出的旧storage void已被auth替换消除）。获准机械后真实0。三类机械真实源变异各lint1→立即还原0：首box重新加!同时触no-non-null/no-unnecessary；去ConnectorRoute参数投影触unsafe字段（及未用alias）；恢复void shorthand触no-confusing。均为lint门禁变异，不混记为浏览器用例。

额外全A `tsc -p tests/e2e/tsconfig.json --noEmit` 最后仍实际2，仅原header keys push string|undefined诊断（现162）；该第9种问题不在本8处批准中，保持未修。其它A旧lint只读baseline核：order0、revocation0、source0；workspace2（5/67 void）、startup3（61/83/103旧storage void），未改变它们，不把本文件许可扩大。

实际PW命令同首节，仅文件名=document-send-product-quality.spec.ts、label如下；每份/tmp安全日志及独立本地PW log/HTML/artifacts均以同label保存。

| label                       | 实际PW；host                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| document-adapt-green-1      | 7通过，PW0/9584ms；host0/14978ms                                                                                                                        |
| document-old-token-red-1    | 真实源只向DRAFT/bound合成session加旧token，2失败/5通过，PW1/67583ms；host1/72963ms；原openDocument业务入口因严格session拒绝到不了，两case均保截图/trace |
| document-restored-1         | **过早恢复启动错误**：原红运行未drain时发起，端口预检EADDRINUSE拒绝，host1/85ms；未启动API/容器/浏览器，独立owned schema前置已清理，不算恢复绿          |
| document-restored-2         | 等红工具close及owned清理后严格串行，7通过，PW0/9482ms；host0/14807ms                                                                                    |
| document-mechanical-final-1 | 获准机械后7通过，PW0/9790ms；host0/15054ms                                                                                                              |

一次过早启动违反本轮严格串行约定，未隐去/充绿；立即恢复等待完整close后才再执行。红worker已载入的变异使两DRAFT case真实失败，未将提前改回源码冒称验证通过；后续restored-2和mechanical-final均在资源完全清理后独立全7过。每轮最终owned三清理均true，最终变异不入库。两红case原HTML/截图/trace在document-old-token-red-1独立目录实际核存在。

本文件适配/获准机械单一职责提交，父ba294ae回滚点；成本不受其覆盖，完整A8尚未绿、第二轮未开始，C2仍禁。最后HEAD完整CI仍必跑，不把前f3882a3 CI作未来提交CI；后续独立首轮继续。

## 本地非生产 spec 机械门禁库存

e92bbe9后仅在已有strict TS工程补本地P1文件include，供未来获准内联认证适配使用原projectService/hook；不改两PW配置/规则/依赖，不把C两生产文件纳入此库存或执行。A-only runner白名单仍不扩B，B浏览器尚未执行。

主代理一次只读ESLint内存lint bd7e80b的A8+B2原源码，规则与各原文件配置保持，不写源码/构建/PG/浏览器。基线结果：

| 文件                                                                                          | 旧诊断/界线                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cost-matrix、login、order-evidence、session-revocation、source-nested、p1-demo、runtime-local | 各0；不是PW执行或认证适配已绿                                                                                                                                   |
| document-send                                                                                 | 9：28旧storage void（S4 fixture替换消除）；118/119、269/270六个!、167 void arrow、202 JSON any；后八个已有独立人裁/已实施并原7绿，其余额外tsc诊断未修           |
| workspace-route-isolation                                                                     | 5旧storage void随已授auth fixture迁移；67 await evaluate回调setAttribute void不属会话fixture，候选仅原一次调用改块体、结果未用，但本文件未获doc八处许可，不先改 |
| startup-delivery                                                                              | 61/83/103均旧storage void，属于原已授S4 auth fixture替换范围；不借机改业务下载/失败/会话语义                                                                    |

接线后P1/runtime原ESLint实际0。该库存不增加根全A tsc新门禁，不为旧keys诊断先改业务断言，也不泛化doc人裁；未知真实运行问题继续分事实/推断登记。父e92bbe9为本P1工程接线回滚点，最终HEAD全CI另必跑。
