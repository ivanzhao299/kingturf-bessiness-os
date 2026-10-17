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
