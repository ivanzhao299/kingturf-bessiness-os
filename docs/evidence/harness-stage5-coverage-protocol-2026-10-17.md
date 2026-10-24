# 阶段5覆盖率首测口径（测量前冻结）

## D稳定状态三连实际通过（4ca894f，非阶段5人工终验）

固定HEAD `4ca894f34caabea27ee56cdcdca271e287039690`，成本比较工具/证据已提交且树空之后，串行完整执行三次`pnpm ci:local`，不并发PG/浏览器、无中途编辑/提交/期待修改。每次spawn前与close后核HEAD相同/树空；三次均actual exit0/signal null/unchanged=true/clean=true，分别329429/330768/328574ms，均<900000ms。没有失败后重跑，不把此前checkpoint凑入本三次。driver `/tmp/kingturf-stage5-stability-4ca894f-driver-2026-10-17.log`，完整日志 `/tmp/kingturf-stage5-stability-4ca894f-d{1,2,3}-2026-10-17.log`。

| 轮次 | 完整CI耗时 | 真实coverage runId                   | result.json SHA256                                               |
| ---- | ---------: | ------------------------------------ | ---------------------------------------------------------------- |
| D1   |   329429ms | ceacbaa4-b963-4a17-a8fb-f622c60a5b31 | 765dd850ab35a5489929560f9fba844a2a4ed9920478b2c233f82568e00a8388 |
| D2   |   330768ms | 21e17843-86b4-4af0-8246-b568630ba8f9 | 706f95167e5a29941a096a81fdf6e70baa2ce5702e9a04f47269197c28cb67ee |
| D3   |   328574ms | cb08def4-83c6-4fde-9b7c-2b89979c2696 | 51497e92c2a6a3489386412f9ccffaa3fbf9d44144b4952d5832c32edbcc9191 |

三run都在`coverage/run-<runId>/result.json`，整体37389/48566、domain629/671、仓储9787/11512，deficits=[]，包分子API24683/Web11562/config298/database143/domain629/types74；全部分母、377生产源/25仓储/源hash和固定B不变。18个真实package child均0/null/drained=true，forcedCleanup=false/aborted=false；Vitest/provider3.2.6不变。每轮API134/17293、Web26/426、config2/71、database3/68、domain4/20、types2/5及原工具/build/audit全通过，成本比较工具三自测也在原追加组内实际执行。wrapper完整CI耗时不与manifest六包跨度混用。

独立只读复核已完成：driver三actual close/耗时/同HEAD/clean与三result SHA吻合，18 raw报告SHA及statement.start同行最大命中重算全部一致；库存/记录的源hash与固定B同，三阈值/B非下降无阻断。本轮独立审查未重读全部业务源码，当前源未变化另由主执行者首尾Git与CI实际扫描证实。C指定护栏测试在每轮链内运行，不是每轮重新临改产品做变异。

这是**当前授权产物状态**的D稳定性证据，不等于P冷成本/信用/驾驶舱已绿、结构例外获批或阶段5人工终验。人裁若另授实质产品/规则/fixture变更，必须在新稳定状态重做相应验证，不能沿用本次三连。最终仅文档收口提交后仍单独完整CI，未跑前不预写该新HEAD通过；HARNESS不归档。

## A核心/E/F检查点完整CI（0b78c94，仍非最终D三连）

固定干净HEAD `0b78c94468f9872e1811b1e54be3620bf0192e1d` 完整ci:local实际exit0/null/340356ms；首尾HEAD不变/树空，运行中无文件修改、并发PG/浏览器。API134/17293（含Quality6/Shipment6）、Web26/426（含文档动作12）、config71/database68/domain20/types5，原工具含TEST019四项/原335、build/audit无已知漏洞全部通过。日志 `/tmp/kingturf-stage5-e-a-core-f-full-ci-2026-10-17.log`。E新装载与A新增核心已在完整链实际执行，F文档通过门禁；P成本对比/数值裁断/函数期限尚待，不计D最终三连或竣工。

真实check run `8e319e61-f493-47e9-b085-56621de9a926`，整体37389/48566=76.985957%、domain629/671=93.740686%、仓储9787/11512=85.015636%，deficits=[]。包内API24683/26752、Web11562/20592，其余同下方首次达标；377源/25仓储/全部源码hash/分母和固定B一致，未变排除/豁免/规则。manifest六包各exit0/null/groupDrained，forcedCleanup/aborted皆false；内部跨度232032ms，不与完整CI外围340356ms混淆。结果SHA256 `3b64fda2d993570e6433bbae69161523c709a7a71c1484a9ce788b1363b2b133`，路径 `coverage/run-8e319e61-f493-47e9-b085-56621de9a926/result.json`。

独立只读按六raw报告SHA及statement.start同行最大命中重算，377文件、六包与三汇总全一致，精确整数交叉比较三目标+B不降通过；另一路核当前377源码hash也一致。不是派发即完成，也不把TS行覆盖冒充SQL/全业务矩阵。下方3f03e62及全部红史保留各自时点。

## 首次三目标同时达标与完整CI（非最终三连）

干净固定HEAD `3f03e6278f30800a6166a233c7db59cbc7675d0e`，完整`pnpm ci:local`实际exit0/signal null/299126ms；首尾同HEAD、树空，期间无编辑/提交、无并发PG/浏览器。原format/doclint/structure/service/capability/DB guard/migrate/status/lint/tsc、工具回归、六包V8、build、prod audit全部实际通过（audit无已知漏洞）。日志`/tmp/kingturf-stage5-web-behavior-full-ci-2026-10-17.log`。这不是D最终同状态三连之一：后继E/F及P1业务待裁仍欠，不借此宣布阶段5或项目竣工。

链内真实check run `5eb8eb3e-3323-4fd8-87f1-d7c8d4979be1`，六包exit0/null、groupDrained=true/forcedCleanup=false/aborted=false；API132/17281、Web25/414、config2/71、database3/68、domain4/20、types2/5。manifest内部跨度191940ms，与完整CI外围299126ms分列。生产377/仓储25、源hash及分母与B一致，inventoryHash仍`b5f1a41de8f5391051ad23b2a80aea7f9e2b44013b3387e97891c8bcb2daebd5`；Vitest/provider仍3.2.6，无新exclusion/重冻B/业务豁免。

| 组      | 覆盖行/总行 |   比例 | 固定B覆盖行 | 目标 | 结果 |
| ------- | ----------: | -----: | ----------: | ---: | ---- |
| 整体    | 36471/48566 | 75.10% |       31623 |  75% | 通过 |
| domain  |     629/671 | 93.74% |         496 |  90% | 通过 |
| API仓储 |  9145/11512 | 79.44% |        6782 |  70% | 通过 |

原整数/BigInt精确比较同时过三阈值+B不下降，deficits=[]；不是四舍五入擦线。整体比B多4848覆盖行，最后一次六域后70.26%失败到本次新增2349，分母未缩。包内API24041/26752、Web11286/20592、config298/308、database143/169、domain629/671、types74/74。Web新增有真实callback/固定payload/状态与失败断言及独立复核，[完整范围/失败史/模拟端口限制](harness-stage5-test-map-2026-10-17.md)；覆盖行命中不等于所有业务/浏览器/PG矩阵穷尽。

结果`coverage/run-5eb8eb3e-3323-4fd8-87f1-d7c8d4979be1/result.json` SHA256 `c9d56167e75d3469323aeb8419d5abd606131fbd5ad346a113807000923646ad`。六原报告SHA256依次API `5ca3c811ec1f0c55c679021c3f4ee7a292fa3dff4175b46262ae2b6bd2f25f84`；Web `7f6ac0a3a2da52f20142175f6887ed7b6a3ecdf8bf3cf2988dacb7275ec7f3fc`；config `464a6515f023615cccecdb3f5cde97cb9b205b745d09f2be3f60101d1b21d93b`；database `65bfc3f171fc8974489ccc2d6ba4972d12370975050910d92fe569c835ea745d`；domain `d28f084e7be25444141ebbbd619bf52f022ff8f020b17a73ffea48e04ba21e0f`；types `3e23c4b73f77af4fe95115e360872e42a59baa8e675367b736379ed5814a5aad`。独立原始报告复算另追加实际结论，不以派发替代完成。TEST002仅实施待终验，最终HEAD/三连及P线不由本次替代。

独立复算已完成：只读核验者按六份raw coverage-final重算同一源行statement.start最大命中算法，与377源/25仓储/源hash/报告hash/B及三分数均相符，无exclusion变化/非下降问题。复核是实际完成，不以此前派发代替结果；并不宣称命中行代表全业务或SQL矩阵。

## 六域专项后同HEAD复测：两目标达标，整体仍红

固定干净HEAD `effdbcf5807612793122718f88900c0fb75d0f4a`，真实`node scripts/analysis/coverage-run.mjs check`，run `9fd091d3-48a3-4a3d-8496-b3771a545a30`，最终host exit1/null/198482ms，唯一deficit=`overall: target not met`。六包各真实exit0/signal null/groupDrained=true/forcedCleanup=false/aborted=false；原API132文件17281项（含新六域39）、Web14/313、config2/71、database3/68、domain4/20、types2/5均通过。首尾Git HEAD相同、树空，运行中无编辑/提交；377生产文件/25仓储、清单hash和所有生产源hash与B不变。

| 组      | 当前覆盖行/总行 | 当前比例 | 原固定B覆盖行 | 目标 | 同分母还需覆盖行 |
| ------- | --------------: | -------: | ------------: | ---: | ---------------: |
| 整体    |     34122/48566 |   70.26% |         31623 |  75% |             2303 |
| domain  |         629/671 |   93.74% |           496 |  90% |                0 |
| API仓储 |      9145/11512 |   79.44% |          6782 |  70% |                0 |

所有B均不下降，新增整体覆盖2499行；没有重冻B或缩分母。包内计数：API24041/26752、Web仍8937/20592、config298/308、database143/169、domain629/671、types74/74。后继补Web真实行为，不用无断言调用/新exclude或type-only理由追阈值。当前双写scanner适用实际60台账（原58+PROC/RISK），没有新增豁免；下节58是该工具最初检查点。

结果`coverage/run-9fd091d3-48a3-4a3d-8496-b3771a545a30/result.json`，SHA256 `0f3aa1c648e745e59b09efb11d2fdcdcd263fd16332a0edf1474933a95d39dda`；清单hash `b5f1a41de8f5391051ad23b2a80aea7f9e2b44013b3387e97891c8bcb2daebd5`，六新report hash在manifest中，源位置/完整性已过原runner。日志`/tmp/kingturf-stage5-coverage-check-effdbcf-2026-10-17.log`。这次是完整六包覆盖率check，不是完整ci:local，也不是D最终同状态三连CI之一；门禁应保持失败，不提前关闭TEST002或上调最终评分。

## 双写豁免结构校验接线（不新增豁免）

上述六域后结果已独立只读按六原始报告的statement起始行同行max重新汇总，六report SHA/377源及25repo hash/固定B摘要逐项吻合，精确分数不下降和唯一overall deficit一致。manifest内部跨度196857ms，**不等于**外围host198482ms；两个时长口径分列，不以review声明替代真实运行。

`coverage-exemptions.mjs`用TS parser的真实comment ranges识别`// coverage-exempt(reason, until-YYYY-MM-DD)`，字符串/template/regexp内容不算注释；源码语法错误、标记畸形、无效日期、缺理由均失败。以源码path:line为身份，与台账JSON记录的reason/until逐值匹配；台账对应顶层TD状态必须精确“已豁免”，源缺台账、台账缺源、状态缺记录、重复/畸形都拦截。当前全377源和58项台账扫描实际`active=0`，没有创建业务豁免，不改inventory/分母/固定B或三目标。

未来经人工批准的记录格式为台账中的单行HTML注释（下方只是本协议模板，不是台账激活记录）：

```text
<!-- coverage-exempt {"debt":"TD-...","path":"apps/.../src/file.ts","line":1,"reason":"与源码同一理由","until":"YYYY-MM-DD","approval":"明确人工R7引用"} -->
```

expiry以Asia/Singapore日历日比较，until当日有效、次日00:00恢复拦截；有精确UTC15:59:59→16:00边界反例。approval非空只核结构，**不自动证明人类批准真伪**，新建/续期仍须人工确认并先R7落盘，不能只改日期自续。扫描器仅元数据审计，不排除可执行行或绕最终三目标。

已接入coverage-run在原DB guard前，对同一productionInventory检查；工具单测新增4项、总15/15实际通过，真实全仓scanner exit0（日期2026-10-17）、原ESLint/Prettier通过，独立只读review无必要阻断。反例包括双向孤儿/状态/字段错配、真实注释与literal、重复、坏日期和次日到期；尚未当前新HEAD完整ci:local，不冒称最终覆盖率达标。

## 首测结果（其后各节“尚未”描述保留为测量前历史）

后继domain边界补测单包报告629/671（20项全绿，原分母671不变）达到该单包90%；[实际补测与安全注入](harness-stage5-test-map-2026-10-17.md)。不更新冻结B、不据此推断新的六包整体/仓储比率；最终check与三连CI仍待。

真实check已于278f22a干净固定HEAD执行：六包原测试全部通过、计数与B逐项相同（无基线下降），run `9bdede8a-0453-439a-96d2-79c268e97ebe`，最终明确列出三项target not met并实际exit1/signal=null/108680ms；首尾HEAD不变、工作区干净、各组无强制清理。日志`/tmp/kingturf-stage5-coverage-check-278f22a-2026-10-17.log`，结果`coverage/run-9bdede8a-0453-439a-96d2-79c268e97ebe/result.json`。因此三目标确在拦截，不是只打印缺口；不是完整ci:local执行或绿灯。后继仍须补真实路径、豁免双写校验及最终三连CI。

5b3dd0ac249bdf8bc1c1d28995cb3deed77a17c2干净固定HEAD，真实`NODE_ENV=test pnpm coverage:measure`经原回环测试库guard执行，host实际exit0/signal=null/104178ms、首尾HEAD相同且工作区干净。六包真实close0、同PGID无存活成员、无强制清理/取消；API126文件/17242、Web14/313、config2/71、database3/68、domain3/14、types1/1全部通过。377文件/25仓储完整性与源码位置校验通过，未导入文件未排除，纯类型规则未放宽。

固定[B记录](harness-stage5-coverage-baseline-2026-10-17.json)保存整数计数、UUID、HEAD/清单hash、六包实际执行和报告SHA；该记录SHA256为`73bf74135208cdba109401f2d37507ac81ac7ba03cd9beb497feec849bc6a8ed`，check显式pin且不自动更新。B₀=31623/48566（约65.11%），B_d=496/671（约73.92%），B_r=6782/11512（约58.91%），**三目标全部未达**。同分母至少还需4802/108/1277条被覆盖行，分组会重叠，不把缺口相加。measure退出0仅表示真实度量成功；后继check必须三阈值+B不下降同时满足，不能以基线替代阈值。

原始本地报告`coverage/run-53d6621c-420f-48a7-bb0f-1627e8f99ee0/result.json` SHA256 `5cd8f8f20c57af9b28f57ea8be09a38c74a89133cb0336a0bcdb429b64d4353a`；日志`/tmp/kingturf-stage5-coverage-first-5b3dd0a-2026-10-17.log`。独立复核发现进程表检查抛错的异常清理缺口：本轮未触发，不改写本轮成功史；下一独立工具修复需真实反例验证。当前证据只证明同PGID排空，不宣称脱组后代、宿主SIGKILL或实际PG异常后的schema清理。豁免双写scanner、实际check失败与最终CI尚待完成。

## 首测前进程与输入快照加固

### 首测后的独立复核与异常修复

只读独立复核已逐一比对B记录与实际result/六包JSON的SHA、runId、执行和清理字段、377源码hash、25仓储及三个比例/缺口；全部一致。当前HEAD后续变化不冒充首测HEAD的完整CI证据。

进程表异常已用真实反例复现：临时owned目录中的失败`ps`命令，让leader退出后检查抛错、同组真实后代留活；原实现2过1败，新增用例在“同组应为空”断言红（PID2603596）。用例finally独立KILL并验证排空，只移除其owned临时目录，未碰PG。修复为异常路径仍给已知owned PGID发送TERM、等待后KILL，再检查；若检查仍不可用明确失败、携带PGID要求人工核查，不报drained成功。修复后工具11/11、原ESLint/Prettier通过。同组取消用例还改为后代注册TERM handler后发READY，再触发取消，避免把spawn当作handler已就绪。未运行PG中断实验，不声称脱组后代或PG schema清理已证。

在1068b94后接线owned Linux进程组：每次guard/Vitest独立进程组，SIGINT/SIGTERM传递整组，等待真实close并用仅PID/PGID/state的进程表确认无存活后代；必要强制清理会使测量失败，不能以leader退出充当整树结束。清单校验同时要求groupDrained=true、forcedCleanup=false、aborted=false。启动及完成均要求整个Git工作区干净且HEAD不变，防止只冻结生产源却换测试、配置、runner或依赖。

覆盖工具实际10项通过（inventory8＋process2），后者包含可控Node父子进程拒绝TERM后取消、整组清理验证；原ESLint与Prettier通过。此为无PG的进程实验，不证明实际PG中断后的schema自动清理，也不是六包首测或B值。首测期间主代理不改文件、不并发PG或浏览器任务；失败保留后再处理。

## 范围与版本

基线授权28215b0，Vitest固定3.2.6；唯一新增直接依赖拟用@vitest/coverage-v8@3.2.6开发依赖，必要传递依赖变化另列。不升级Vitest、不引Istanbul或其它工具栈。参考[Vitest v3配置](https://v3.vitest.dev/config/#coverage)并核已装3.2.6 `dist/chunks/defaults.*`：enabled=false、all=true、allowExternal=false；v3网站当前patch不冒充精确已装版本。

首测前生产文件集合：各包src递归TS，排除测试 `*.test.ts/*.spec.ts` 和声明 `*.d.ts`，不排服务器/入口/巨文件/难测文件。共377文件：apps/api159、apps/web209、config5、database2、domain1、types1；API仓储25，按所有顶层 `*-repositories.ts`/`repositories.ts` 及可能的repositories子目录全集，不只目录glob。后继新增生产文件自动入分母，不准冻结旧清单来漏新文件。

tests目录、Vitest/Vite配置、scripts和构建dist不在此“生产TS覆盖率”分母；工具Node--test的运行证据另列而非当TS覆盖率。types/index.ts有运行时DATA_SCOPES不可整包豁免；真正纯类型文件若无可执行行报N/A（0/0），不伪造100%。

## 计数与数据流

- 六包逐包串行使用现有Vitest配置与原测试集，显式coverage.v8/all/include=src生产集合、allowExternal=false；每包独立JSON报告，报告文件路径规范化到仓库相对真实路径后按owner包归属汇总，跨包import不能重复计分母。
- 行覆盖率 = covered executable lines / total executable lines，分子分母为整数；整体是总分子/总分母，不平均各包百分比。domain与API仓储独立分组，三项阈值用精确整数交叉相乘判断，显示四舍五入不能提前放行。
- 未import生产源码仍须provider all计入零覆盖分母；校验实际报告对冻结/动态文件清单完整覆盖，缺包/缺文件/空报告/旧报告一律失败，不用“没报告”当0行或跳过。报告metadata绑定run ID、HEAD、源文件清单/hash、工具版本/生成时间、各包实际退出。
- raw coverage statement计数需按Istanbul JSON语义生成行计数（同一行多statement取最大hit）；不能把statement覆盖率冒成行覆盖。最小反例应覆盖同一行混合hits、跨行statement、纯类型、未import、重复归属、临界比例、旧报告和缺包。
- API auth-http-postgres:233–240等spawn的独立Node server不自动进入Vitest provider；首测保守不采这些child hit并明确局限，不用HTTP用例绿推断覆盖。PG直接仓储与同进程API正常采；未来若采child必须证明flush/映射/去重，不暗中合并。

## B基线与门禁

本文件没有实测B值。首次完整六包执行后才记录B₀/B_d/B_r的整数分子分母、原始报告SHA/HEAD/命令/耗时。B是精确不下降底线，不能低于三目标即验收；最终整体≥75%、domain≥90%、API仓储≥70%须同时达到。进ci:local后失败给出缺口、报告位置及补真实路径/恢复实现指引，不指示缩分母或无据exclude。

豁免注释 `// coverage-exempt(reason, until-YYYY-MM-DD)` 与台账“已豁免”双写、逐条校验；到期次日按Asia/Singapore恢复拦截，续期要人工确认。不用豁免移除最终三目标分母或绕开全局目标；首版不创建任何业务豁免。

首测、B不下降/目标失败、假报告及有效报告反例、真实缺陷注入、三连CI全在后继证据追加；当前仅协议，不称门禁或覆盖率已完成。

## 首测接线候选（尚未实测B）

唯一直接新依赖已固定 `@vitest/coverage-v8@3.2.6`，原Vitest3.2.6与所有旧package版本未升级/删除。pnpm实际新增43个package定义（provider1＋传递42）：remapping2.3.0、Babel helper-string-parser7.29.7/helper-validator-identifier7.29.7/parser7.29.9/types7.29.8、v8-coverage1.0.2、cliui8.0.2、istanbul schema0.1.6、parseargs0.11.0、ansi-regex5.0.1/6.4.0、ansi-styles6.2.3、ast-v8-to-istanbul0.3.12、brace-expansion2.1.7、eastasianwidth0.2.0、emoji-regex8.0.0/9.2.2、foreground-child3.3.1、glob10.5.0、html-escaper2.0.2、is-fullwidth-code-point3.0.0、istanbul-lib-coverage3.2.2/lib-report3.0.1/lib-source-maps5.0.6/reports3.2.0、jackspeak3.4.3、js-tokens10.0.0、lru-cache10.4.3、magicast0.3.5、make-dir4.0.0、minimatch9.0.9、minipass7.1.3、package-json-from-dist1.0.1、path-scurry1.11.1、signal-exit4.1.0、string-width4.2.3/5.1.2、strip-ansi6.0.1/7.2.0、test-exclude7.0.2、wrap-ansi7.0.0/8.1.0。Babel/parser/mapping为provider传递依赖，不额外增加直接工具链；已有resolve-uri等必要snapshot optional标记改变、版本不变。安装警告glob10.5.0 deprecated保留，未以无警告/零风险表述。

`coverage-inventory.mjs`枚举当前TS源，遇新增JS/其它运行扩展直接失败要求审范围，不悄然漏分母。按Istanbul起始行/max hit计数，statement行列必须在真实源码内；空map仅TS擦除后真正纯类型允许N/A，DATA_SCOPES运行值不可豁免。原5unit后review指出空map及旧报告来源绑定两缺口，已补纯类型/位置/真实run上下文测试至8过；首lint一处动态delete被拒，改Reflect.deleteProperty后原lint/format0，不降规则。

`coverage-run.mjs`先guard回环test库，在内存先mint UUID/HEAD/377源hash/精确版本，再独占创建新run目录；每包输出在其真实Vitest启动前必须不存在。六包串行实际close0/signalnull后才读该新路径、绑定report hash/mtime/起止与owner；末尾再枚举所有源/hash与HEAD，新增/改变均拒绝，不在读取旧报告后现造来源。反例覆盖同源未变但旧runId/旧package结果、缺包、旧时间与中断。真实provider是否遗漏纯类型/仅import-reexport文件尚待首测，不据unit泛化放宽。

根 `coverage:measure`只度量并列三目标缺口，不作为CI验收；`test:coverage`保原工具单测、覆盖工具单测与六包原Vitest测试，`ci:local`同一test步骤换该命令。check必须读取后继真实B记录，三targets+B同时精确拦截；B记录尚无时不得放行。当前新接线全CI/真实provider/豁免双写scanner尚未验证或完成，不提前关闭TEST002。structure0/29、service0及原lint/format/diff已过；首测结果另记。
