# 阶段5覆盖率首测口径（测量前冻结）

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
