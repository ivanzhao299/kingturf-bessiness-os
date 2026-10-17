# 阶段5覆盖率首测口径（测量前冻结）

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
