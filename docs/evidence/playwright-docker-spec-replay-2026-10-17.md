# Docker 单 spec 回放证据（2026-10-17）

**Workspace等待点后继**：0c9a886候选后按本轮人裁仅q=慢请求等待，原16assert与切页/RAF动作不动，实际搜索在quotes后释放；广拦截真变异又使目标case超时，完整清理还原后该case过。全spec仍3过1败（360字段待裁未改），非全绿，[原命令/退出/耗时](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。旧2过2败为前时点，第二轮继续禁止。

**Workspace候选后继**：仅已授auth/单void候选原4例2过2败，原16expect同、lint0；首次成本GET被旧gate挂起、360缺必填字段另记TD-TEST-014/54项。[原失败/增量裁定](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)：等待点已人裁批准未实施、字段独立待裁；此候选只作可复现检查点，未完成全文件真变异/还原绿，不称已交付。其它3A/2B未跑、成本仍1过1败、第二轮禁，旧未执行计数保前时点。

**订单证据后继**：order-evidence仅会话fixture替换，真实旧token红→清理后还原原1例过，15expect及从viewport起全部操作字节同。当前login2/doc7/order1过；成本1过1败待TD-TEST-013，余4A/2B未跑、C禁/未第二轮。下方“余5A”等为前时点；末节含原命令/退出/耗时，最终完整CI未预填。

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

## order-evidence-product-quality：独立会话夹具适配

基线253b761。删除generic mock的旧token login/普通session分支，注册共享合成login fixture，原同员工/公司/两权限保持；初始restore401、用户真表单submit才login-context/新login/restore，generic业务API mock不改、不接真实API。原sales-order/360 payload、第一次503/200ms/retry、键盘/请求次数/字段设置/移动布局全部不动。

实际AST对比15个expect完整表达式相同，原从首viewport开始的动作/断言/附件代码全字节相同，eslint0/format通过。没有机械额外改动/新业务assert。

命令同首节，单文件=order-evidence-product-quality.spec.ts，各label日志/HTML/附件独立：

| label                 | 实际PW；host                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------- |
| order-adapt-green-1   | 1通过，PW0/3048ms；host0/8262ms                                                          |
| order-old-token-red-1 | 真实spec session输入加旧token，严格restore拒绝、原shell断言红；PW1/6450ms；host1/11745ms |
| order-restored-1      | 等完整close/owned清理后立即还原，1通过，PW0/3058ms；host0/8694ms                         |

每次host guard/容器READ ONLY同实例通过，owned三清理均true；红HTML及artifacts下test-failed-1.png/trace.zip实际存在，未覆盖/不跳过。最后无token变异，父253b761为独立回滚点。本文件绿不抵其它spec/成本失败/第二轮，不是API授权或真实Set-Cookie证据。最终最后提交完整CI必跑。

## startup-delivery：已授失败保会话 oracle 迁移

父dc32ffa。只fixture和4e691e5已授会话oracle：cold首goto前装合成restore401；原3处storage setup换合成Jar/新DTO，保原员工/空权限。进度case仍原session handler标记/资产800ms等待；此标记先于fulfill，沿旧时点，不单独证明HTTP响应完成再下载。JS/CSS abort/显式刷新与布局/Logo/下载业务断言不改；旧storage保值变Jar布尔相同，并要求刷新新增一次Cookie门控restore和原经营概览。503原保值变Jar布尔相同，原503→401重试顺序不改，401旧storage-null变登录/无shell，实际响应序列必须[503,401]；不要求清HttpOnly，原businessRequests=[]保留。

内存AST按旧非storage expect开头调用节点（含链式/内层重复，非独立断言数）计36节点，所有表达式原样保留；原cold从setViewport到结束动作/断言/附件字节同。只读review无必要阻断；原ESLint/Prettier最后0/diff-check0。首候选默认空回调曾被no-empty-function拒1，改为各调用方本已传入的必需回调，无disable或业务修改。

命令同首节，文件=startup-delivery.spec.ts；原5例，各唯一label/原附件策略：

| label                      | 实际PW；host                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| startup-adapt-green-1      | 5过，PW0/5963ms；host0/11857ms                                                                   |
| startup-asset-cookie-red-1 | 真源仅资产abort前删合成auth Cookie，JS/CSS两例Jar布尔false红，其余3过；PW1/6880ms；host1/12797ms |
| startup-asset-restored-1   | 完整close清理后还原，5过，PW0/5362ms；host0/11039ms                                              |
| startup-status-403-red-1   | 真源只把原retry目标401改403，原失效提示红、其余4过；PW1/10863ms；host1/16286ms                   |
| startup-status-restored-1  | 完整close清理后还原，5过，PW0/6241ms；host0/12660ms                                              |

各次owned schema/container/preview三清理true；红截图/trace/HTML各独立保留。变异均已移除，原产品/配置不动。这只是合成浏览器启动/失败恢复证据，非实际服务器撤销/认证安全。父dc32ffa为本文件回滚点；source/B仍待执行，Workspace/成本原失败不消除，不跑C/第二轮，最后HEAD实际全CI仍必跑。

## session-revocation：已授会话 oracle 最小迁移

父5ef45bc，依4e691e5三项人裁，仅该文件旧storage setup/oracle迁移。先种合成Secure/HttpOnly Jar再导航，不再先发一次未拦截真实restore；原员工/权限、cost搜索/拒绝payload及即时401登录提示/撤shell、403错误/留shell断言均保持。401不要求JS删除HttpOnly Cookie：原storage-null改为原即时UI失效，加显式reload仍登录/无shell；403原storage值改为Jar前后相等布尔，不输出值，并reload证同Cookie可恢复。恢复mock只在实际Cookie存在且未由实际业务401标记revoked时200，不能无条件200伪造恢复；revoked只属受控mock契约，不冒充真实服务端撤销。

新增deniedRequests>0避免未触发拒绝空过；最终restoreStatuses由浏览器response事件记录，显式reload后必须恰有[401]/[200]。初候选曾在handler记录预定status，首401变异使用该初版；恢复后改为实际响应观察，再完成403变异和最终绿。只读reviewer确认原目的保持；Jar比较只输出true/false，真实API/两实例安全另依原S4证据。

实际命令同首节，文件=session-revocation.spec.ts，label/真实结果：

| label                         | 实际PW；host                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| revocation-adapt-green-1      | 原2例通过，PW0/3765ms；host0/9702ms                                                                                                      |
| revocation-restored-200-red-1 | 真源删除restore的revoked条件，401例刷新登录断言红、403过；PW1/8697ms；host1/14515ms。未到最后status断言，不声称由其抓红                  |
| revocation-observed-green-1   | 还原且改实际response观察，2过，PW0/3637ms；host0/8959ms                                                                                  |
| revocation-403-clear-red-1    | 真源仅403拒绝响应发过期auth Cookie，浏览器接受删除，Jar相等布尔false抓红；401过，PW1/3897ms；host1/9421ms                                |
| revocation-restored-final-1   | 还原后执行被中断：401已过，PW leader close=null/SIGTERM，无完整spec-result；host1/8242ms。不算测试绿，确切中断源未证，不将其改称断言失败 |
| revocation-restored-final-2   | 等完整清理后同源码重跑，原2过；PW0/3577ms；host0/9211ms                                                                                  |

每轮owned schema/container/preview清理true；两变异截图/trace/HTML实际留各唯一目录，异常中断原日志亦保留。原ESLint/Prettier检查0，git diff --check0；未改产品/配置/业务断言，不清401 Jar、不修改网络防护。父5ef45bc为本文件回滚点；独立首轮继续，不抵cost/Workspace现存失败或B未跑，不启动第二轮。最终最后HEAD完整CI仍必跑。

## Workspace auth/单void部分通过检查点（未交付全文件）

只旧storage→共享合成Jar，原auth/session DTO包sessionResponse，员工/权限/所有业务mock原样；另按dc43e81本会话人裁改原setAttribute回调块体，原调用/值/await未读返回不变。16个expect调用参数与原文件同，机械transpile局部对照只该void形态不同、原ESLint0。

实际全4例命令/退出/附件与[TD-TEST-014事实](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)一致：workspace-adapt-candidate-1 PW1/38957ms、host1/44429ms，2过2败。第一/第四过不掩第二/第三失败。此提交仅保可复现auth/void候选；**原360字段及成本等待点尚无改动，整个文件未完成适配/真实绑定变异**，不是全部绿、不是跳过失败。后续各获准夹具修正另独立提交及真实红绿，最后才能重新核该文件交付状态。

回滚父为本次workspace夹具裁定R7提交；原失败历史不改，成本/产品源码/业务oracle/两PW配置/C/第二轮保护保持。最终最后HEAD完整CI仍必跑。
